import { invoke } from '@tauri-apps/api/core'
import { isTauri } from './tauri'

export interface FfmpegStatus {
  available: boolean
  path: string
  downloading: boolean
  phase: 'idle' | 'preparing' | 'downloading' | 'extracting' | 'installing' | 'done' | 'error'
  downloaded_bytes: number
  total_bytes: number
  error: string
}

/**
 * Check whether FFmpeg is available and whether it is currently being downloaded.
 */
export async function getFfmpegStatus(): Promise<FfmpegStatus> {
  if (!isTauri()) {
    return {
      available: false,
      path: '',
      downloading: false,
      phase: 'idle',
      downloaded_bytes: 0,
      total_bytes: 0,
      error: '',
    }
  }
  try {
    return await invoke<FfmpegStatus>('get_ffmpeg_status')
  } catch (e) {
    console.warn('Failed to fetch FFmpeg status:', e)
    return {
      available: false,
      path: '',
      downloading: false,
      phase: 'idle',
      downloaded_bytes: 0,
      total_bytes: 0,
      error: '',
    }
  }
}

/**
 * Trigger the automatic download and installation of FFmpeg.
 * Returns the path to the installed ffmpeg.exe on success.
 */
export async function ensureFfmpeg(): Promise<string> {
  if (!isTauri()) {
    throw new Error('Installation native indisponible dans le navigateur')
  }
  return invoke<string>('ensure_ffmpeg')
}
