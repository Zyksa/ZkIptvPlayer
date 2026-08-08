use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ffi::OsStr;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{OnceLock, RwLock};
use std::time::{Duration, Instant};
use tauri::Window;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use tokio::process::Command as AsyncCommand;
use tokio::sync::mpsc;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn hidden_command<S: AsRef<OsStr>>(program: S) -> std::process::Command {
    let mut command = std::process::Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

fn hidden_async_command<S: AsRef<OsStr>>(program: S) -> AsyncCommand {
    let mut command = AsyncCommand::new(program);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

// The FFmpeg cache is mutable because FFmpeg can be installed while the app is
// running. Caching `Option<String>` directly in a OnceLock would permanently
// cache `None` and force a restart after a successful installation.
static FFMPEG_PATH: OnceLock<RwLock<FfmpegPathState>> = OnceLock::new();
static DOWNLOAD_STATE: AtomicU8 = AtomicU8::new(FfmpegDownloadState::Idle as u8);

// Reuse HTTP clients so DNS resolution, TCP sockets and TLS sessions are pooled.
static API_HTTP_CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
static STREAM_HTTP_CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();

// Durations parsed from each transcode FFmpeg's stderr ("Duration: HH:MM:SS.xx"),
// keyed by the original stream URL. Lets the frontend fill the seek bar without a
// separate ffprobe pass, which would open a SECOND connection to providers that
// throttle/drop each connection after a few MB (making the throttle worse).
static TRANSCODE_DURATIONS: OnceLock<RwLock<HashMap<String, TranscodeDuration>>> = OnceLock::new();

#[derive(Debug, Clone, Copy)]
struct TranscodeDuration {
    seconds: f64,
    captured_at: Instant,
}

fn transcoded_durations() -> &'static RwLock<HashMap<String, TranscodeDuration>> {
    TRANSCODE_DURATIONS.get_or_init(|| RwLock::new(HashMap::new()))
}

fn remember_transcode_duration(url: String, seconds: f64) {
    const DURATION_TTL: Duration = Duration::from_secs(10 * 60);
    let mut durations = transcoded_durations()
        .write()
        .unwrap_or_else(|e| e.into_inner());
    durations.retain(|_, value| value.captured_at.elapsed() < DURATION_TTL);
    durations.insert(
        url,
        TranscodeDuration {
            seconds,
            captured_at: Instant::now(),
        },
    );
}

/// Parse the "Duration: HH:MM:SS.xx" token FFmpeg prints once it has analyzed the
/// input (requires -loglevel info). Returns total seconds.
fn parse_ffmpeg_duration(line: &str) -> Option<f64> {
    const KEY: &str = "Duration: ";
    let idx = line.find(KEY)?;
    let rest = &line[idx + KEY.len()..];
    let token = rest.split([',', ' ']).next()?;
    let mut parts = token.split(':');
    let h: f64 = parts.next()?.parse().ok()?;
    let m: f64 = parts.next()?.parse().ok()?;
    let s: f64 = parts.next()?.parse().ok()?;
    if parts.next().is_some() {
        return None;
    }
    Some(h * 3600.0 + m * 60.0 + s)
}

#[repr(u8)]
#[derive(Default, Debug, Clone, Copy, PartialEq, Eq)]
enum FfmpegDownloadState {
    #[default]
    Idle,
    Downloading,
    Done,
    Failed,
}

impl FfmpegDownloadState {
    fn current() -> Self {
        match DOWNLOAD_STATE.load(Ordering::Acquire) {
            1 => Self::Downloading,
            2 => Self::Done,
            3 => Self::Failed,
            _ => Self::Idle,
        }
    }

    fn store(self) {
        DOWNLOAD_STATE.store(self as u8, Ordering::Release);
    }
}

struct DownloadStateGuard;

impl Drop for DownloadStateGuard {
    fn drop(&mut self) {
        if FfmpegDownloadState::current() == FfmpegDownloadState::Downloading {
            FfmpegDownloadState::Failed.store();
        }
    }
}

#[derive(Debug, Default)]
enum FfmpegPathState {
    #[default]
    Uninitialized,
    Missing,
    Available(String),
}

fn ffmpeg_path_state() -> &'static RwLock<FfmpegPathState> {
    FFMPEG_PATH.get_or_init(|| RwLock::new(FfmpegPathState::Uninitialized))
}

fn cached_ffmpeg() -> Option<String> {
    let guard = ffmpeg_path_state()
        .read()
        .unwrap_or_else(|e| e.into_inner());
    match &*guard {
        FfmpegPathState::Available(path) => Some(path.clone()),
        FfmpegPathState::Uninitialized | FfmpegPathState::Missing => None,
    }
}

fn cache_ffmpeg(path: Option<String>) {
    let mut guard = ffmpeg_path_state()
        .write()
        .unwrap_or_else(|e| e.into_inner());
    *guard = match path {
        Some(path) => FfmpegPathState::Available(path),
        None => FfmpegPathState::Missing,
    };
}

fn api_http_client() -> Result<&'static reqwest::Client, String> {
    API_HTTP_CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .user_agent("IPTVSmarters/3.0.0 (VLC/3.0.18-git LibVLC/3.0.18)")
                .connect_timeout(std::time::Duration::from_secs(15))
                .timeout(std::time::Duration::from_secs(30))
                .pool_idle_timeout(std::time::Duration::from_secs(90))
                .tcp_keepalive(std::time::Duration::from_secs(30))
                .build()
                .map_err(|e| e.to_string())
        })
        .as_ref()
        .map_err(Clone::clone)
}

fn stream_http_client() -> Result<&'static reqwest::Client, String> {
    STREAM_HTTP_CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .user_agent("IPTVSmarters/3.0.0 (VLC/3.0.18-git LibVLC/3.0.18)")
                .connect_timeout(std::time::Duration::from_secs(15))
                // Do not set a total request timeout: live streams and large VOD
                // responses legitimately keep their body open for hours.
                .read_timeout(std::time::Duration::from_secs(30))
                .pool_idle_timeout(std::time::Duration::from_secs(90))
                .tcp_keepalive(std::time::Duration::from_secs(30))
                .build()
                .map_err(|e| e.to_string())
        })
        .as_ref()
        .map_err(Clone::clone)
}

fn downloaded_ffmpeg_dir() -> Option<PathBuf> {
    let local_app_data = dirs::data_local_dir()?;
    Some(local_app_data.join("com.zkplayer.desktop").join("ffmpeg"))
}

fn detect_ffmpeg() -> Option<String> {
    // 1. Check downloaded FFmpeg in AppLocalData (auto-downloaded by ZkPlayer)
    if let Some(download_dir) = downloaded_ffmpeg_dir() {
        let downloaded_exe = find_ffmpeg_in_dir(&download_dir).unwrap_or_else(|| {
            download_dir
                .join("ffmpeg.exe")
                .to_string_lossy()
                .to_string()
        });
        if Path::new(&downloaded_exe).exists()
            && hidden_command(&downloaded_exe)
                .arg("-version")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .map(|s| s.success())
                .unwrap_or(false)
        {
            eprintln!("[ZkPlayer] FFmpeg found downloaded: {}", downloaded_exe);
            return Some(downloaded_exe);
        }
    }

    // 2. Check if ffmpeg is in PATH
    if let Ok(output) = hidden_command("ffmpeg")
        .arg("-version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
    {
        if output.status.success() {
            eprintln!("[ZkPlayer] FFmpeg found in PATH");
            return Some("ffmpeg".to_string());
        }
    }

    // 3. Check bundled resource path (next to the executable) — legacy fallback
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let bundled = exe_dir.join("resources").join("ffmpeg.exe");
            if bundled.exists() {
                eprintln!("[ZkPlayer] FFmpeg found bundled: {}", bundled.display());
                return Some(bundled.to_string_lossy().to_string());
            }
            let bundled_flat = exe_dir.join("ffmpeg.exe");
            if bundled_flat.exists() {
                eprintln!(
                    "[ZkPlayer] FFmpeg found next to exe: {}",
                    bundled_flat.display()
                );
                return Some(bundled_flat.to_string_lossy().to_string());
            }
        }
    }

    // 4. Check well-known Windows paths
    let known_paths = [
        "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
        "C:\\ffmpeg\\bin\\ffmpeg.exe",
    ];
    for p in &known_paths {
        if Path::new(p).exists() {
            eprintln!("[ZkPlayer] FFmpeg found at: {}", p);
            return Some(p.to_string());
        }
    }

    // 5. Scan WinGet packages directory
    if let Ok(user_profile) = std::env::var("USERPROFILE") {
        let winget_dir = format!(
            "{}\\AppData\\Local\\Microsoft\\WinGet\\Packages",
            user_profile
        );
        if let Ok(entries) = std::fs::read_dir(&winget_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.to_lowercase().contains("ffmpeg") {
                    // Search recursively for ffmpeg.exe inside this package
                    if let Some(found) = find_ffmpeg_in_dir(&entry.path()) {
                        eprintln!("[ZkPlayer] FFmpeg found via WinGet: {}", found);
                        return Some(found);
                    }
                }
            }
        }
    }

    eprintln!("[ZkPlayer] WARNING: FFmpeg NOT found. AC-3/DTS audio will be silent.");
    None
}

fn find_ffmpeg_in_dir(dir: &Path) -> Option<String> {
    let direct = dir.join("ffmpeg.exe");
    if direct.exists() {
        return Some(direct.to_string_lossy().to_string());
    }
    let in_bin = dir.join("bin").join("ffmpeg.exe");
    if in_bin.exists() {
        return Some(in_bin.to_string_lossy().to_string());
    }
    // Check one level of subdirectories (e.g. ffmpeg-8.1.2-full_build/bin/)
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let sub = entry.path().join("bin").join("ffmpeg.exe");
                if sub.exists() {
                    return Some(sub.to_string_lossy().to_string());
                }
                let sub_direct = entry.path().join("ffmpeg.exe");
                if sub_direct.exists() {
                    return Some(sub_direct.to_string_lossy().to_string());
                }
            }
        }
    }
    None
}

fn get_ffmpeg() -> Option<String> {
    if let Some(path) = cached_ffmpeg() {
        return Some(path);
    }

    // Only one thread performs the filesystem/process scan. Other callers wait
    // briefly on the write lock and then reuse its result.
    let mut guard = ffmpeg_path_state()
        .write()
        .unwrap_or_else(|e| e.into_inner());
    match &*guard {
        FfmpegPathState::Available(path) => return Some(path.clone()),
        FfmpegPathState::Missing => return None,
        FfmpegPathState::Uninitialized => {}
    }

    let detected = detect_ffmpeg();
    *guard = match detected.clone() {
        Some(path) => FfmpegPathState::Available(path),
        None => FfmpegPathState::Missing,
    };
    detected
}

async fn download_file(url: &str, dest: &Path) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to start FFmpeg download: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "FFmpeg download failed with status: {}",
            response.status()
        ));
    }

    let parent = dest.parent().ok_or("Invalid destination path")?;
    tokio::fs::create_dir_all(parent)
        .await
        .map_err(|e| format!("Failed to create download dir: {}", e))?;
    let temp_path = dest.with_extension("zip.tmp");
    let mut file = tokio::fs::File::create(&temp_path)
        .await
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write download chunk: {}", e))?;
    }
    file.flush()
        .await
        .map_err(|e| format!("Failed to flush FFmpeg download: {}", e))?;
    drop(file);

    tokio::fs::rename(&temp_path, dest)
        .await
        .map_err(|e| format!("Failed to finalize download: {}", e))?;
    Ok(())
}

fn extract_zip(zip_path: &Path, out_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(out_dir).map_err(|e| format!("Failed to create extract dir: {}", e))?;
    let file = fs::File::open(zip_path).map_err(|e| format!("Failed to open zip: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip: {}", e))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;
        let name = entry.name();
        // Only extract ffmpeg.exe and ffprobe.exe from the bin folder
        let lower = name.to_lowercase();
        if !lower.ends_with("/bin/ffmpeg.exe") && !lower.ends_with("/bin/ffprobe.exe") {
            continue;
        }
        let file_name = Path::new(name)
            .file_name()
            .ok_or("Invalid zip entry name")?;
        let out_path = out_dir.join(file_name);
        let mut out_file = fs::File::create(&out_path)
            .map_err(|e| format!("Failed to create extracted file: {}", e))?;
        let mut buf = [0u8; 8192];
        loop {
            let n = entry
                .read(&mut buf)
                .map_err(|e| format!("Failed to read zip data: {}", e))?;
            if n == 0 {
                break;
            }
            out_file
                .write_all(&buf[..n])
                .map_err(|e| format!("Failed to write extracted file: {}", e))?;
        }
    }

    fs::remove_file(zip_path).map_err(|e| format!("Failed to remove zip: {}", e))?;

    if !out_dir.join("ffmpeg.exe").exists() {
        return Err("FFmpeg.exe was not found in the downloaded archive".to_string());
    }

    Ok(())
}

async fn download_and_install_ffmpeg() -> Result<String, String> {
    if let Some(path) = get_ffmpeg() {
        FfmpegDownloadState::Done.store();
        return Ok(path);
    }

    loop {
        let state = FfmpegDownloadState::current();
        if state == FfmpegDownloadState::Downloading {
            return Err("FFmpeg download already in progress".to_string());
        }
        if DOWNLOAD_STATE
            .compare_exchange(
                state as u8,
                FfmpegDownloadState::Downloading as u8,
                Ordering::AcqRel,
                Ordering::Acquire,
            )
            .is_ok()
        {
            break;
        }
    }
    let _state_guard = DownloadStateGuard;

    // Use a known reliable Windows FFmpeg build (gyan.dev official mirror)
    const FFMPEG_URL: &str = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";

    let result: Result<String, String> = async {
        let download_dir =
            downloaded_ffmpeg_dir().ok_or("Could not determine local app data directory")?;
        let install_root = download_dir
            .parent()
            .ok_or("Could not determine FFmpeg install parent")?;
        let staging_dir = install_root.join("ffmpeg.installing");
        let backup_dir = install_root.join("ffmpeg.backup");
        let zip_path = staging_dir.join("ffmpeg.zip");

        if staging_dir.exists() {
            tokio::fs::remove_dir_all(&staging_dir)
                .await
                .map_err(|e| format!("Failed to clear FFmpeg staging dir: {}", e))?;
        }
        download_file(FFMPEG_URL, &zip_path).await?;
        let extract_zip_path = zip_path.clone();
        let extract_dir = staging_dir.clone();
        tokio::task::spawn_blocking(move || extract_zip(&extract_zip_path, &extract_dir))
            .await
            .map_err(|e| format!("FFmpeg extraction task failed: {}", e))??;

        if find_ffmpeg_in_dir(&staging_dir).is_none() {
            return Err("FFmpeg executable missing after extraction".to_string());
        }

        if backup_dir.exists() {
            tokio::fs::remove_dir_all(&backup_dir)
                .await
                .map_err(|e| format!("Failed to clear FFmpeg backup dir: {}", e))?;
        }
        if download_dir.exists() {
            tokio::fs::rename(&download_dir, &backup_dir)
                .await
                .map_err(|e| format!("Failed to preserve previous FFmpeg install: {}", e))?;
        }
        if let Err(error) = tokio::fs::rename(&staging_dir, &download_dir).await {
            if backup_dir.exists() {
                let _ = tokio::fs::rename(&backup_dir, &download_dir).await;
            }
            return Err(format!("Failed to activate FFmpeg install: {}", error));
        }
        if backup_dir.exists() {
            let _ = tokio::fs::remove_dir_all(&backup_dir).await;
        }

        let exe = find_ffmpeg_in_dir(&download_dir).unwrap_or_else(|| {
            download_dir
                .join("ffmpeg.exe")
                .to_string_lossy()
                .to_string()
        });
        Ok(exe)
    }
    .await;

    match result {
        Ok(path) => {
            eprintln!("[ZkPlayer] FFmpeg installed at: {}", path);
            cache_ffmpeg(Some(path.clone()));
            FfmpegDownloadState::Done.store();
            Ok(path)
        }
        Err(e) => {
            eprintln!("[ZkPlayer] FFmpeg install failed: {}", e);
            FfmpegDownloadState::Failed.store();
            Err(e)
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FfmpegStatus {
    pub available: bool,
    pub path: String,
    pub downloading: bool,
}

#[tauri::command]
async fn get_ffmpeg_status() -> FfmpegStatus {
    let downloading = FfmpegDownloadState::current() == FfmpegDownloadState::Downloading;
    if let Some(path) = get_ffmpeg() {
        return FfmpegStatus {
            available: true,
            path,
            downloading,
        };
    }
    FfmpegStatus {
        available: false,
        path: String::new(),
        downloading,
    }
}

#[tauri::command]
async fn ensure_ffmpeg() -> Result<String, String> {
    if let Some(path) = get_ffmpeg() {
        return Ok(path);
    }
    download_and_install_ffmpeg().await
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemCapabilities {
    pub hardware_acceleration: String,
    pub audio_codecs: Vec<String>,
    pub video_codecs: Vec<String>,
    pub ffmpeg_available: bool,
    pub ffmpeg_path: String,
}

#[tauri::command]
fn get_system_capabilities() -> SystemCapabilities {
    let ffmpeg = get_ffmpeg();
    SystemCapabilities {
        hardware_acceleration: if ffmpeg.is_some() {
            "FFmpeg Audio Remux + Direct3D11 GPU".to_string()
        } else {
            "Direct3D11 GPU (No FFmpeg - limited audio)".to_string()
        },
        audio_codecs: vec![
            "AAC (native)".to_string(),
            "Dolby AC-3 5.1 → AAC (via FFmpeg)".to_string(),
            "EAC-3 → AAC (via FFmpeg)".to_string(),
            "DTS → AAC (via FFmpeg)".to_string(),
        ],
        video_codecs: vec![
            "H.264/AVC (pass-through)".to_string(),
            "H.265/HEVC 4K (pass-through)".to_string(),
            "MPEG-TS (.ts)".to_string(),
            "Matroska (.mkv)".to_string(),
        ],
        ffmpeg_available: ffmpeg.is_some(),
        ffmpeg_path: ffmpeg.unwrap_or_default(),
    }
}

#[tauri::command]
fn window_minimize(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn window_toggle_maximize(window: Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn window_close(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn window_toggle_fullscreen(window: Window) -> Result<bool, String> {
    let is_full = window.is_fullscreen().unwrap_or(false);
    let new_state = !is_full;
    window
        .set_fullscreen(new_state)
        .map_err(|e| e.to_string())?;
    Ok(new_state)
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let parsed = reqwest::Url::parse(&url).map_err(|_| "URL externe invalide".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Seuls les liens HTTP et HTTPS sont autorisés".to_string());
    }

    #[cfg(windows)]
    {
        hidden_command("rundll32.exe")
            .arg("url.dll,FileProtocolHandler")
            .arg(parsed.as_str())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("Impossible d'ouvrir le navigateur: {error}"))?;
        Ok(())
    }

    #[cfg(not(windows))]
    {
        Err("L'ouverture externe est uniquement disponible sous Windows".to_string())
    }
}

#[tauri::command]
fn get_proxy_stream_url(url: String, live: bool) -> String {
    let encoded = urlencoding::encode(&url);
    // Both VOD and live go through FFmpeg when available:
    //  - VOD: remux + transcode AC-3/DTS audio to AAC (browsers can't decode them).
    //  - Live: Xtream serves live as MPEG-TS (.ts), which Chromium's <video> cannot
    //    play natively. FFmpeg remuxes .ts → fragmented MP4 (video copied, audio →
    //    AAC) so the webview can play it. Low latency is preserved by the live=1
    //    input flags handled in the proxy (nobuffer / low_delay / short max_delay).
    // If FFmpeg is unavailable we fall back to the direct byte proxy.
    if get_ffmpeg().is_some() {
        if live {
            format!("http://127.0.0.1:14221/transcode?url={}&live=1", encoded)
        } else {
            format!("http://127.0.0.1:14221/transcode?url={}", encoded)
        }
    } else {
        format!("http://127.0.0.1:14221/proxy?url={}", encoded)
    }
}

fn get_ffprobe() -> Option<String> {
    if let Some(ffmpeg) = get_ffmpeg() {
        if ffmpeg == "ffmpeg" {
            return Some("ffprobe".to_string());
        }
        let ffmpeg_path = std::path::PathBuf::from(&ffmpeg);
        if let Some(parent) = ffmpeg_path.parent() {
            let ffprobe_path = parent.join("ffprobe.exe");
            if ffprobe_path.exists() {
                return Some(ffprobe_path.to_string_lossy().to_string());
            }
        }
    }
    None
}

fn unwrap_proxy_target(url: String) -> String {
    if !url.contains("127.0.0.1:14221") {
        return url;
    }

    reqwest::Url::parse(&url)
        .ok()
        .and_then(|parsed| {
            parsed
                .query_pairs()
                .find_map(|(key, value)| (key == "url").then(|| value.into_owned()))
        })
        .unwrap_or(url)
}

fn stream_origin_for_log(url: &str) -> String {
    reqwest::Url::parse(url)
        .ok()
        .map(|parsed| parsed.origin().ascii_serialization())
        .filter(|origin| !origin.is_empty() && origin != "null")
        .unwrap_or_else(|| "<invalid-stream-url>".to_string())
}

#[tauri::command]
async fn probe_duration(url: String) -> Result<f64, String> {
    let raw_target = unwrap_proxy_target(url);

    if let Some(ffprobe_bin) = get_ffprobe() {
        let output = hidden_async_command(ffprobe_bin)
            .arg("-v")
            .arg("error")
            .arg("-show_entries")
            .arg("format=duration")
            .arg("-of")
            .arg("default=noprint_wrappers=1:nokey=1")
            .arg(&raw_target)
            .output()
            .await
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            let duration_str = String::from_utf8_lossy(&output.stdout);
            if let Ok(duration) = duration_str.trim().parse::<f64>() {
                return Ok(duration);
            }
        }
    }
    Err("Failed to probe duration".to_string())
}

/// Returns the duration (seconds) FFmpeg reported for the given stream URL while
/// transcoding, or 0 if not available yet. Consumes the entry on success so the
/// map doesn't grow unbounded.
#[tauri::command]
async fn get_transcode_duration(url: String) -> f64 {
    let mut g = transcoded_durations()
        .write()
        .unwrap_or_else(|e| e.into_inner());
    g.remove(&url)
        .filter(|duration| duration.captured_at.elapsed() < Duration::from_secs(10 * 60))
        .map(|duration| duration.seconds)
        .unwrap_or(0.0)
}

#[tauri::command]
fn open_in_external_player(url: String) -> Result<(), String> {
    let raw_target = unwrap_proxy_target(url);

    let possible_vlc_paths = [
        "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe",
        "C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe",
    ];

    for vlc_path in &possible_vlc_paths {
        if Path::new(vlc_path).exists() && hidden_command(vlc_path).arg(&raw_target).spawn().is_ok()
        {
            return Ok(());
        }
    }

    if hidden_command("vlc").arg(&raw_target).spawn().is_ok() {
        return Ok(());
    }

    hidden_command("cmd")
        .args(["/C", "start", "", &raw_target])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn proxy_http_request(
    url: String,
    headers: Option<HashMap<String, String>>,
) -> Result<String, String> {
    let client = api_http_client()?;

    let mut req = client.get(&url);
    if let Some(hdrs) = headers {
        for (k, v) in hdrs {
            req = req.header(&k, &v);
        }
    }

    let res = req.send().await.map_err(|e| e.to_string())?;
    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

// ───── Local Proxy Server ─────

async fn read_http_request(socket: &mut tokio::net::TcpStream) -> Option<Vec<u8>> {
    const MAX_HEADER_BYTES: usize = 64 * 1024;
    let mut request = Vec::with_capacity(8192);
    let mut chunk = [0u8; 4096];

    while request.len() < MAX_HEADER_BYTES {
        let bytes_read = socket.read(&mut chunk).await.ok()?;
        if bytes_read == 0 {
            return None;
        }
        request.extend_from_slice(&chunk[..bytes_read]);
        if request.windows(4).any(|window| window == b"\r\n\r\n") {
            return Some(request);
        }
    }

    None
}

fn proxied_hls_resource(base_url: &reqwest::Url, resource: &str) -> String {
    let absolute = base_url
        .join(resource)
        .map(|url| url.to_string())
        .unwrap_or_else(|_| resource.to_string());
    format!(
        "http://127.0.0.1:14221/proxy?url={}",
        urlencoding::encode(&absolute)
    )
}

fn rewrite_hls_uri_attributes(line: &str, base_url: &reqwest::Url) -> String {
    const URI_PREFIX: &str = "URI=\"";
    let mut rest = line;
    let mut rewritten = String::with_capacity(line.len());

    while let Some(prefix_index) = rest.find(URI_PREFIX) {
        let value_start = prefix_index + URI_PREFIX.len();
        rewritten.push_str(&rest[..value_start]);
        let value_and_rest = &rest[value_start..];
        let Some(value_end) = value_and_rest.find('"') else {
            rewritten.push_str(value_and_rest);
            return rewritten;
        };
        rewritten.push_str(&proxied_hls_resource(
            base_url,
            &value_and_rest[..value_end],
        ));
        rest = &value_and_rest[value_end..];
    }
    rewritten.push_str(rest);
    rewritten
}

fn rewrite_m3u8_playlist(text: &str, base_url: &reqwest::Url) -> String {
    let mut rewritten = String::with_capacity(text.len() + text.len() / 4);
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            rewritten.push('\n');
        } else if trimmed.starts_with('#') {
            rewritten.push_str(&rewrite_hls_uri_attributes(line, base_url));
            rewritten.push('\n');
        } else {
            rewritten.push_str(&proxied_hls_resource(base_url, trimmed));
            rewritten.push('\n');
        }
    }
    rewritten
}

async fn handle_proxy_connection(mut socket: tokio::net::TcpStream) {
    let request = match read_http_request(&mut socket).await {
        Some(request) => request,
        None => {
            let response = "HTTP/1.1 431 Request Header Fields Too Large\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
            let _ = socket.write_all(response.as_bytes()).await;
            return;
        }
    };

    let req_str = String::from_utf8_lossy(&request);
    let first_line = req_str.lines().next().unwrap_or("");

    // Parse request: GET /transcode?url=...&seek=N&live=1&video=h264 or GET /proxy?url=...
    let mut target_url = String::new();
    let mut is_transcode = false;
    let mut seek_seconds: Option<f64> = None;
    let mut is_live = false;
    let mut force_h264 = false;
    let mut range_hdr: Option<String> = None;

    if first_line.starts_with("GET /transcode?") {
        is_transcode = true;
        // Extract everything between GET /transcode? and the trailing HTTP/1.x
        if let Some(qs) = first_line.strip_prefix("GET /transcode?") {
            let qs_str = qs.split(' ').next().unwrap_or("");
            // Parse query params: url=...&seek=...&live=1
            for param in qs_str.split('&') {
                if let Some(val) = param.strip_prefix("url=") {
                    target_url = urlencoding::decode(val).unwrap_or_default().to_string();
                } else if let Some(val) = param.strip_prefix("seek=") {
                    seek_seconds = val.parse::<f64>().ok();
                } else if param
                    .strip_prefix("video=")
                    .map(|v| v.eq_ignore_ascii_case("h264"))
                    .unwrap_or(false)
                {
                    force_h264 = true;
                } else if param
                    .strip_prefix("live=")
                    .map(|v| v == "1")
                    .unwrap_or(false)
                {
                    is_live = true;
                }
            }
        }
    } else if first_line.starts_with("GET /proxy?url=") {
        if let Some(url_part) = first_line.strip_prefix("GET /proxy?url=") {
            if let Some(clean) = url_part.split(' ').next() {
                target_url = urlencoding::decode(clean).unwrap_or_default().to_string();
            }
        }
    } else if first_line.contains("?url=") {
        if let Some(url_part) = first_line.split("?url=").nth(1) {
            if let Some(clean) = url_part.split(' ').next() {
                target_url = urlencoding::decode(clean).unwrap_or_default().to_string();
            }
        }
    }

    // Parse Range header
    for line in req_str.lines().skip(1) {
        if line.to_lowercase().starts_with("range:") {
            range_hdr = Some(line.to_string());
            break;
        }
    }

    if target_url.is_empty() {
        let resp = "HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n";
        let _ = socket.write_all(resp.as_bytes()).await;
        return;
    }

    // ───── FFmpeg Transcode Path ─────
    if is_transcode {
        if let Some(ffmpeg_bin) = get_ffmpeg() {
            let seek_info = seek_seconds
                .map(|s| format!(" seek={:.1}s", s))
                .unwrap_or_default();
            let live_info = if is_live { " live=1" } else { "" };
            let video_info = if force_h264 { " video=h264" } else { "" };
            eprintln!(
                "[ZkPlayer Proxy] TRANSCODE:{} {} → FFmpeg",
                seek_info,
                stream_origin_for_log(&target_url)
            );
            eprintln!(
                "[ZkPlayer Proxy] Transcode options:{}{}",
                live_info, video_info
            );

            let mut cmd = hidden_async_command(ffmpeg_bin);
            cmd.arg("-hide_banner")
                // info + nostats: print the input stream info once (incl. the
                // "Duration:" line we parse for the seek bar) without the periodic
                // frame= status spam.
                .arg("-loglevel")
                .arg("info")
                .arg("-nostats");

            // Live-specific low-latency input flags
            if is_live {
                cmd.arg("-fflags")
                    .arg("+nobuffer+discardcorrupt")
                    .arg("-flags")
                    .arg("low_delay")
                    .arg("-max_delay")
                    .arg("500000")
                    .arg("-thread_queue_size")
                    .arg("512");
            } else {
                // VOD: providers throttle/drop each connection after a few MB, so
                // FFmpeg reconnects constantly and packets arrive mangled at the
                // seams. discardcorrupt drops those instead of letting them derail
                // the demuxer / audio decoder (e.g. silent TrueHD after a reconnect).
                cmd.arg("-fflags").arg("+discardcorrupt");
            }

            // NOTE: seek (-ss) is applied AFTER -i (output seeking), see below.
            // Input seeking (-ss before -i) with -c:v copy misaligns audio/video
            // on resume: video snaps to the keyframe ≤ T while audio is trimmed to
            // the exact T, leaving a persistent A/V offset.

            // Build custom HTTP headers to satisfy IPTV provider anti-hotlink checks
            let mut http_headers = String::new();
            if let Ok(base) = reqwest::Url::parse(&target_url) {
                let origin = base.origin().ascii_serialization();
                if !origin.is_empty() {
                    http_headers.push_str(&format!("Referer: {}/\r\n", origin));
                    http_headers.push_str(&format!("Origin: {}\r\n", origin));
                    http_headers.push_str("Accept: */*\r\n");
                    http_headers.push_str("Accept-Language: en-US,en;q=0.9\r\n");
                    http_headers.push_str("Cache-Control: no-cache\r\n");
                }
            }
            if !http_headers.is_empty() {
                cmd.arg("-headers").arg(&http_headers);
            }

            cmd.arg("-reconnect")
                .arg("1")
                .arg("-reconnect_streamed")
                .arg("1")
                .arg("-reconnect_delay_max")
                .arg("5")
                .arg("-user_agent")
                .arg("VLC/3.0.18 LibVLC/3.0.18")
                .arg("-i")
                .arg(&target_url);
            // Output seeking (-ss AFTER -i): FFmpeg discards everything before T
            // for BOTH audio and video and starts at the same keyframe ≤ T, so
            // A/V stays aligned after a resume.
            if let Some(ss) = seek_seconds {
                cmd.arg("-ss").arg(format!("{:.3}", ss));
            }
            // NO -copyts: let FFmpeg subtract each stream's start_time so audio
            // tracks that start late (e.g. EAC-3/AC-3 with a codec-delay / ts
            // offset, like 1917's "start: 1.000000") line up with video instead
            // of lagging by that offset. -avoid_negative_ts make_zero then
            // normalizes the first PTS to 0 for the browser timeline.
            cmd.arg("-avoid_negative_ts")
                .arg("make_zero")
                // Keep audio locked to video: re-encoding AC-3/DTS → AAC without
                // async correction makes timestamps drift over long films.
                // aresample=async=1 inserts/skips samples to maintain A/V sync.
                .arg("-af")
                .arg("aresample=async=1");

            if force_h264 {
                // WebView2 does not reliably expose HEVC/10-bit decoding on every
                // Windows installation, even though VLC handles the same source.
                // This compatibility path is only requested after native playback
                // fails, keeping the zero-cost video pass-through as the fast path.
                cmd.arg("-c:v")
                    .arg("libx264")
                    .arg("-preset")
                    .arg("ultrafast")
                    .arg("-tune")
                    .arg("zerolatency")
                    .arg("-crf")
                    .arg("23")
                    .arg("-pix_fmt")
                    .arg("yuv420p")
                    .arg("-tag:v")
                    .arg("avc1");
            } else {
                cmd.arg("-c:v").arg("copy");
            }

            cmd.arg("-c:a")
                .arg("aac")
                .arg("-b:a")
                .arg("192k")
                .arg("-ac")
                .arg("2");

            // Output fragmented MP4 (seekable in browser and works for live streams)
            cmd.arg("-f")
                .arg("mp4")
                .arg("-movflags")
                .arg("frag_keyframe+empty_moov+default_base_moof");

            cmd.arg("pipe:1")
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());
            cmd.kill_on_drop(true);

            match cmd.spawn() {
                Ok(mut child) => {
                    let stdout = child.stdout.take();
                    let stderr = child.stderr.take();

                    // Log FFmpeg stderr in background for debugging, and capture
                    // the input "Duration:" line so the frontend can fill the seek
                    // bar without a separate ffprobe pass.
                    if let Some(stderr_stream) = stderr {
                        let dur_key = target_url.clone();
                        tauri::async_runtime::spawn(async move {
                            let reader = BufReader::new(stderr_stream);
                            let mut lines = reader.lines();
                            while let Ok(Some(line)) = lines.next_line().await {
                                if cfg!(debug_assertions) {
                                    eprintln!(
                                        "[FFmpeg] {}",
                                        line.replace(&dur_key, "<stream-url>")
                                    );
                                }
                                if let Some(secs) = parse_ffmpeg_duration(&line) {
                                    remember_transcode_duration(dur_key.clone(), secs);
                                }
                            }
                        });
                    }

                    if let Some(mut stdout_stream) = stdout {
                        let content_type = "video/mp4";
                        let cache_hdr = if is_live {
                            "Cache-Control: no-cache\r\n"
                        } else {
                            ""
                        };
                        let resp_hdr = format!(
                            "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: *\r\n{}Content-Type: {}\r\nTransfer-Encoding: chunked\r\n\r\n",
                            cache_hdr, content_type
                        );

                        if socket.write_all(resp_hdr.as_bytes()).await.is_err() {
                            let _ = child.kill().await;
                            return;
                        }

                        // Read FFmpeg output into a buffer at FULL speed and write to
                        // the browser at its (realtime) pace. Without this, the proxy
                        // paces FFmpeg at playback speed, so it can never read ahead;
                        // the provider drops each connection after ~2MB and every
                        // reconnect gap underruns the browser (~5s stutter). With the
                        // buffer, FFmpeg pulls the source at line speed and builds a
                        // read-ahead cushion that absorbs the reconnect gaps.
                        // VOD: 512*32KB = 16MB (~14s @ 9Mbps). Live: small for latency.
                        let buf_slots = if is_live { 32 } else { 512 };
                        let (tx, mut rx) = mpsc::channel::<Vec<u8>>(buf_slots);
                        tauri::async_runtime::spawn(async move {
                            let mut buf = [0u8; 32768];
                            loop {
                                match stdout_stream.read(&mut buf).await {
                                    Ok(0) => break,
                                    Ok(n) => {
                                        if tx.send(buf[..n].to_vec()).await.is_err() {
                                            break;
                                        }
                                    }
                                    Err(_) => break,
                                }
                            }
                        });

                        let mut socket_closed = false;
                        let mut header = String::with_capacity(16);
                        while let Some(chunk) = rx.recv().await {
                            header.clear();
                            use std::fmt::Write as _;
                            let _ = write!(&mut header, "{:x}\r\n", chunk.len());
                            if socket.write_all(header.as_bytes()).await.is_err() {
                                socket_closed = true;
                                break;
                            }
                            if socket.write_all(&chunk).await.is_err() {
                                socket_closed = true;
                                break;
                            }
                            if socket.write_all(b"\r\n").await.is_err() {
                                socket_closed = true;
                                break;
                            }
                        }
                        if !socket_closed {
                            let _ = socket.write_all(b"0\r\n\r\n").await;
                        }
                        let _ = child.kill().await;
                        return;
                    }
                }
                Err(e) => {
                    eprintln!("[ZkPlayer Proxy] FFmpeg spawn FAILED: {}", e);
                }
            }
        } else {
            eprintln!("[ZkPlayer Proxy] TRANSCODE requested but FFmpeg not available, falling back to direct proxy");
        }
        // Fall through to direct proxy if FFmpeg failed
    }

    // ───── Direct HTTP Proxy (fallback) ─────
    eprintln!(
        "[ZkPlayer Proxy] DIRECT: {}",
        stream_origin_for_log(&target_url)
    );

    let client = match stream_http_client() {
        Ok(client) => client,
        Err(e) => {
            eprintln!("[ZkPlayer Proxy] HTTP client initialization failed: {}", e);
            return;
        }
    };

    let mut req_builder = client.get(&target_url);
    if let Some(ref r) = range_hdr {
        if let Some(val) = r.split(':').nth(1) {
            req_builder = req_builder.header("Range", val.trim());
        }
    }

    // Many IPTV providers require referer/origin matching the server
    if let Ok(base) = reqwest::Url::parse(&target_url) {
        let origin = base.origin().ascii_serialization();
        if !origin.is_empty() {
            req_builder = req_builder
                .header("Referer", format!("{}/", origin))
                .header("Origin", origin.clone())
                .header("Accept", "*/*")
                .header("Accept-Language", "en-US,en;q=0.9")
                .header("Cache-Control", "no-cache");
        }
    }

    let mut response = match req_builder.send().await {
        Ok(res) => res,
        Err(e) => {
            eprintln!("[ZkPlayer Proxy] Upstream fetch FAILED: {}", e);
            let resp = "HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n";
            let _ = socket.write_all(resp.as_bytes()).await;
            return;
        }
    };

    let status = response.status();
    let status_code = status.as_u16();
    let status_text = status.canonical_reason().unwrap_or("OK");

    let raw_mime = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    // Handle m3u8 playlists: rewrite segment URLs to go through our proxy
    let is_m3u8 =
        target_url.contains(".m3u8") || raw_mime.contains("mpegurl") || raw_mime.contains("m3u8");

    if is_m3u8 {
        let text_body = match response.text().await {
            Ok(t) => t,
            Err(e) => {
                eprintln!("[ZkPlayer Proxy] Failed to read m3u8 body: {}", e);
                return;
            }
        };

        let base_url = match reqwest::Url::parse(&target_url) {
            Ok(u) => u,
            Err(_) => return,
        };

        let rewritten = rewrite_m3u8_playlist(&text_body, &base_url);

        let resp_hdr = format!(
            "HTTP/1.1 {} {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: *\r\nCache-Control: no-cache\r\nContent-Type: application/x-mpegURL\r\nContent-Length: {}\r\n\r\n",
            status_code, status_text, rewritten.len()
        );

        if socket.write_all(resp_hdr.as_bytes()).await.is_ok() {
            let _ = socket.write_all(rewritten.as_bytes()).await;
        }
        return;
    }

    // Infer MIME type from URL extension
    let inferred_mime = if target_url.ends_with(".mkv") {
        "video/x-matroska"
    } else if target_url.ends_with(".mp4") {
        "video/mp4"
    } else if target_url.ends_with(".ts") {
        "video/mp2t"
    } else if !raw_mime.is_empty() {
        &raw_mime
    } else {
        "application/octet-stream"
    };

    let content_length = response
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let content_range = response
        .headers()
        .get("content-range")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let mut hdrs = format!(
        "HTTP/1.1 {} {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: *\r\nAccept-Ranges: bytes\r\nContent-Type: {}\r\n",
        status_code, status_text, inferred_mime
    );
    if !content_length.is_empty() {
        hdrs.push_str(&format!("Content-Length: {}\r\n", content_length));
    }
    if !content_range.is_empty() {
        hdrs.push_str(&format!("Content-Range: {}\r\n", content_range));
    }
    hdrs.push_str("\r\n");

    if socket.write_all(hdrs.as_bytes()).await.is_err() {
        return;
    }

    while let Ok(Some(chunk)) = response.chunk().await {
        if socket.write_all(&chunk).await.is_err() {
            break;
        }
    }
}

fn start_proxy_server() {
    // Detect FFmpeg without delaying WebView creation. If playback starts before
    // this finishes, get_ffmpeg() waits on the same cache lock and preserves the
    // previous behavior.
    tauri::async_runtime::spawn_blocking(|| {
        let _ = get_ffmpeg();
    });

    tauri::async_runtime::spawn(async move {
        let listener = match TcpListener::bind("127.0.0.1:14221").await {
            Ok(l) => {
                eprintln!("[ZkPlayer] Proxy server listening on 127.0.0.1:14221");
                l
            }
            Err(e) => {
                eprintln!("[ZkPlayer] FATAL: Failed to bind proxy server: {}", e);
                return;
            }
        };

        loop {
            if let Ok((socket, _)) = listener.accept().await {
                tauri::async_runtime::spawn(handle_proxy_connection(socket));
            }
        }
    });
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|_app| {
            start_proxy_server();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_capabilities,
            window_minimize,
            window_toggle_maximize,
            window_close,
            window_toggle_fullscreen,
            open_external_url,
            get_proxy_stream_url,
            open_in_external_player,
            probe_duration,
            get_transcode_duration,
            proxy_http_request,
            ensure_ffmpeg,
            get_ffmpeg_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{parse_ffmpeg_duration, rewrite_m3u8_playlist, unwrap_proxy_target};

    #[test]
    fn parses_ffmpeg_duration_without_allocating_parts() {
        assert_eq!(
            parse_ffmpeg_duration("Duration: 01:02:03.50, start: 0.0"),
            Some(3723.5)
        );
        assert_eq!(parse_ffmpeg_duration("Duration: N/A, bitrate: N/A"), None);
        assert_eq!(parse_ffmpeg_duration("no duration here"), None);
    }

    #[test]
    fn unwraps_only_the_url_query_parameter() {
        let wrapped = "http://127.0.0.1:14221/transcode?url=https%3A%2F%2Fexample.test%2Fmovie.mp4%3Ftoken%3Da%2526b&seek=42";
        assert_eq!(
            unwrap_proxy_target(wrapped.to_string()),
            "https://example.test/movie.mp4?token=a%26b"
        );
    }

    #[test]
    fn leaves_direct_urls_unchanged() {
        let direct = "https://example.test/live.m3u8?token=abc";
        assert_eq!(unwrap_proxy_target(direct.to_string()), direct);
    }

    #[test]
    fn rewrites_hls_segments_and_uri_attributes() {
        let base = reqwest::Url::parse("https://media.test/path/master.m3u8?token=abc").unwrap();
        let playlist = "#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI=\"keys/key.bin\"\nsegment-1.ts\n";
        let rewritten = rewrite_m3u8_playlist(playlist, &base);

        assert!(rewritten.contains("proxy?url=https%3A%2F%2Fmedia.test%2Fpath%2Fkeys%2Fkey.bin"));
        assert!(rewritten.contains("proxy?url=https%3A%2F%2Fmedia.test%2Fpath%2Fsegment-1.ts"));
        assert!(
            rewritten.contains("#EXT-X-KEY:METHOD=AES-128,URI=\"http://127.0.0.1:14221/proxy?url=")
        );
    }
}
