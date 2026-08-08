import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'
import { isTauri } from './tauri'
import type { AppUpdateInfo } from '@/types/iptv'
import packageJson from '../../package.json'

async function getCurrentVersion(): Promise<string> {
  if (isTauri()) {
    try {
      return await getVersion()
    } catch {
      // fall through to package.json fallback
    }
  }
  return packageJson.version ?? '1.0.0'
}

export interface UpdateProgress {
  event: 'PENDING' | 'DOWNLOADING' | 'DOWNLOADED' | 'ERROR'
  progress?: number
  total?: number
}

export const UpdaterService = {
  /**
   * Check for available updates using the Tauri Updater plugin.
   * Falls back to a simple GitHub Releases check in browser dev mode.
   */
  async checkForUpdates(): Promise<AppUpdateInfo> {
    const currentVersion = await getCurrentVersion()

    if (isTauri()) {
      try {
        const update = await check()
        if (!update) {
          return { available: false, version: currentVersion, releaseNotes: '', downloadUrl: '', pubDate: new Date().toISOString() }
        }
        return {
          available: true,
          version: update.version,
          releaseNotes: update.body || 'Nouvelle version disponible.',
          downloadUrl: '',
          pubDate: update.date || new Date().toISOString(),
        }
      } catch {
        return { available: false, version: currentVersion, releaseNotes: '', downloadUrl: '', pubDate: new Date().toISOString() }
      }
    }

    // Browser fallback for development
    try {
      const res = await fetch('https://api.github.com/repos/Zyksa/ZkIptvPlayer/releases/latest')
      const release = await res.json()
      const latestVer = (release.tag_name || release.name || 'v1.0.0').replace(/^v/, '')
      return {
        available: this.compareVersions(latestVer, currentVersion) > 0,
        version: latestVer,
        releaseNotes: release.body || 'Nouvelle version disponible.',
        downloadUrl: release.html_url || 'https://github.com/Zyksa/ZkIptvPlayer/releases',
        pubDate: release.published_at || new Date().toISOString(),
      }
    } catch {
      return { available: false, version: currentVersion, releaseNotes: '', downloadUrl: '', pubDate: new Date().toISOString() }
    }
  },

  /**
   * Download and install the update, reporting progress via callbacks.
   * Returns true if a relaunch is required.
   */
  async installUpdate(
    onProgress?: (state: UpdateProgress) => void
  ): Promise<boolean> {
    if (!isTauri()) {
      onProgress?.({ event: 'ERROR' })
      return false
    }

    const update = await check()
    if (!update) {
      onProgress?.({ event: 'ERROR' })
      return false
    }

    onProgress?.({ event: 'DOWNLOADING', progress: 0, total: 100 })

    let downloadedBytes = 0
    let totalBytes = 0
    try {
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            totalBytes = event.data.contentLength || 0
            onProgress?.({ event: 'DOWNLOADING', progress: 0, total: totalBytes })
            break
          case 'Progress':
            downloadedBytes += event.data.chunkLength
            onProgress?.({ event: 'DOWNLOADING', progress: downloadedBytes, total: totalBytes })
            break
          case 'Finished':
            onProgress?.({ event: 'DOWNLOADED' })
            break
        }
      })

      return true
    } catch (err) {
      console.error('Update install failed:', err)
      onProgress?.({ event: 'ERROR' })
      return false
    }
  },

  async relaunchApp() {
    if (isTauri()) {
      await relaunch()
    }
  },

  compareVersions(v1: string, v2: string): number {
    const p1 = v1.split('.').map(Number)
    const p2 = v2.split('.').map(Number)
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const num1 = p1[i] || 0
      const num2 = p2[i] || 0
      if (num1 > num2) return 1
      if (num1 < num2) return -1
    }
    return 0
  }
}
