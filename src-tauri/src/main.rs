// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--enable-features=PlatformAudioDecoder,MediaFoundationVideoCapture,DirectCompositionVideoOverlays,MediaFoundationClear --enable-platform-audio-decoder --enable-direct-composition --force-wave-audio --ignore-gpu-blocklist --enable-accelerated-video-decode"
    );
    zkplayer_desktop::run();
}
