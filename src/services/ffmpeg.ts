import { invoke } from '@tauri-apps/api/core'
import { isTauri } from './tauri'

export interface FfmpegStatus {
  available: boolean
  path: string
  downloading: boolean
}

export interface FfmpegDownloadProgress {
  status: 'idle' | 'downloading' | 'done' | 'error'
  message?: string
}

/**
 * Check whether FFmpeg is available and whether it is currently being downloaded.
 */
export async function getFfmpegStatus(): Promise<FfmpegStatus> {
  if (!isTauri()) {
    return { available: false, path: '', downloading: false }
  }
  try {
    return await invoke<FfmpegStatus>('get_ffmpeg_status')
  } catch (e) {
    console.warn('Failed to fetch FFmpeg status:', e)
    return { available: false, path: '', downloading: false }
  }
}

/**
 * Trigger the automatic download and installation of FFmpeg.
 * Returns the path to the installed ffmpeg.exe on success.
 */
export async function ensureFfmpeg(): Promise<string | null> {
  if (!isTauri()) {
    return null
  }
  try {
    return await invoke<string>('ensure_ffmpeg')
  } catch (e) {
    console.error('Failed to ensure FFmpeg:', e)
    return null
  }
}
