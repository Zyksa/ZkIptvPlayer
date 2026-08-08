import { invoke } from '@tauri-apps/api/core'
import type { FfmpegStatus } from './ffmpeg'

export interface SystemCapabilities {
  hardware_acceleration: string
  audio_codecs: string[]
  video_codecs: string[]
  direct3d11_status: boolean
  nvdec_status: boolean
  fast_seeking: boolean
}

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function getFfmpegStatus(): Promise<FfmpegStatus> {
  return invoke<FfmpegStatus>('get_ffmpeg_status')
}

export async function ensureFfmpeg(): Promise<string> {
  return invoke<string>('ensure_ffmpeg')
}

export const minimizeWindow = async () => {
  if (isTauri()) {
    try {
      await invoke('window_minimize')
    } catch (e) {
      console.warn('Tauri window_minimize error:', e)
    }
  }
}

export const toggleMaximizeWindow = async () => {
  if (isTauri()) {
    try {
      await invoke('window_toggle_maximize')
    } catch (e) {
      console.warn('Tauri window_toggle_maximize error:', e)
    }
  }
}

export const closeWindow = async () => {
  if (isTauri()) {
    try {
      await invoke('window_close')
    } catch (e) {
      console.warn('Tauri window_close error:', e)
    }
  }
}

export const toggleFullscreen = async (): Promise<boolean> => {
  if (isTauri()) {
    try {
      // Returns the new fullscreen state so the UI stays in sync with the
      // actual window (avoids the icon/state desync bug).
      return await invoke<boolean>('window_toggle_fullscreen')
    } catch (e) {
      console.warn('Tauri window_toggle_fullscreen error:', e)
    }
  }
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen().catch(() => {})
    return true
  } else {
    await document.exitFullscreen().catch(() => {})
    return false
  }
}

export const openExternalUrl = async (url: string): Promise<boolean> => {
  if (isTauri()) {
    try {
      await invoke('open_external_url', { url })
      return true
    } catch (e) {
      console.warn('Failed to open external URL:', e)
    }
  }
  return window.open(url, '_blank', 'noopener,noreferrer') !== null
}

/**
 * Build the proxy URL for a media stream.
 * Calls the Rust backend to determine whether FFmpeg transcoding is available.
 * Live streams are always routed through the direct proxy (no transcode).
 * Falls back to the direct byte-forwarding proxy if the Rust command fails.
 */
export const getProxyStreamUrl = async (targetUrl: string, isLive = false): Promise<string> => {
  if (!targetUrl) return ''
  if (targetUrl.startsWith('blob:') || targetUrl.startsWith('http://127.0.0.1:14221')) {
    return targetUrl
  }
  if (isTauri()) {
    try {
      return await invoke<string>('get_proxy_stream_url', { url: targetUrl, live: isLive })
    } catch (e) {
      console.warn('get_proxy_stream_url invoke failed, using direct proxy:', e)
    }
  }
  return `http://127.0.0.1:14221/proxy?url=${encodeURIComponent(targetUrl)}`
}

/**
 * Synchronous fallback for contexts that can't await.
 * Live streams use the direct proxy; VOD uses FFmpeg transcode when available.
 */
export const getProxyStreamUrlSync = (targetUrl: string, isLive = false): string => {
  if (!targetUrl) return ''
  if (targetUrl.startsWith('blob:') || targetUrl.startsWith('http://127.0.0.1:14221')) {
    return targetUrl
  }
  if (isLive) {
    return `http://127.0.0.1:14221/proxy?url=${encodeURIComponent(targetUrl)}`
  }
  return `http://127.0.0.1:14221/transcode?url=${encodeURIComponent(targetUrl)}`
}

export const openInExternalPlayer = async (url: string): Promise<boolean> => {
  if (isTauri()) {
    try {
      await invoke('open_in_external_player', { url })
      return true
    } catch (e) {
      console.warn('Failed to open external player:', e)
      return window.open(url, '_blank') !== null
    }
  }
  return window.open(url, '_blank') !== null
}

export const probeDuration = async (url: string): Promise<number> => {
  if (isTauri()) {
    try {
      const dur = await invoke<number>('probe_duration', { url })
      return dur
    } catch (e) {
      console.warn('Tauri probe_duration error:', e)
    }
  }
  return 0
}

/**
 * Returns the duration (seconds) FFmpeg reported for the given stream URL while
 * transcoding, or 0 if FFmpeg hasn't analyzed the input yet. Replaces a separate
 * ffprobe pass that would open a second (throttled) connection to the provider.
 */
export const getTranscodeDuration = async (url: string): Promise<number> => {
  if (isTauri()) {
    try {
      return await invoke<number>('get_transcode_duration', { url })
    } catch (e) {
      console.warn('get_transcode_duration error:', e)
    }
  }
  return 0
}

export const getSystemCapabilities = async (): Promise<SystemCapabilities> => {
  if (isTauri()) {
    try {
      return await invoke<SystemCapabilities>('get_system_capabilities')
    } catch (e) {
      console.warn('Failed to fetch native system caps:', e)
    }
  }
  return {
    hardware_acceleration: 'Direct3D11 / NVDEC / VAAPI Active (Simulated)',
    audio_codecs: ['Dolby Digital AC-3 5.1', 'EAC-3', 'DTS Digital', 'MP2', 'AAC', 'FLAC', 'MP3'],
    video_codecs: ['H.264/AVC', 'HEVC 4K 10-bit', 'AV1 Native', 'MPEG-TS (.ts)', 'Matroska (.mkv)'],
    direct3d11_status: true,
    nvdec_status: true,
    fast_seeking: true,
  }
}

export const proxyFetch = async (url: string, headers?: Record<string, string>): Promise<string> => {
  if (isTauri()) {
    try {
      return await invoke<string>('proxy_http_request', { url, headers })
    } catch (e) {
      console.warn('Tauri proxy_http_request failed, falling back to standard fetch:', e)
    }
  }
  const res = await fetch(url, { headers })
  return await res.text()
}
