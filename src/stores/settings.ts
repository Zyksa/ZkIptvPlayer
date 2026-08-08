import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const SETTINGS_STORAGE_KEY = 'zkplayer_settings'

export interface AppSettings {
  hardwareAcceleration: boolean
  accelApi: 'direct3d11' | 'nvdec' | 'auto'
  audioPassthrough: boolean
  dolbyDecodersEnabled: boolean
  fastSeek: boolean
  seekStepSeconds: number
  bufferSizeMb: number
  autoPlayNextEpisode: boolean
  customTitlebar: boolean
}

const defaultSettings: AppSettings = {
  hardwareAcceleration: true,
  accelApi: 'direct3d11',
  audioPassthrough: false,
  dolbyDecodersEnabled: true,
  fastSeek: true,
  seekStepSeconds: 10,
  bufferSizeMb: 64,
  autoPlayNextEpisode: true,
  customTitlebar: true,
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...defaultSettings })

  const saved = localStorage.getItem(SETTINGS_STORAGE_KEY)
  if (saved) {
    try {
      settings.value = { ...defaultSettings, ...JSON.parse(saved) }
    } catch {
      localStorage.removeItem(SETTINGS_STORAGE_KEY)
    }
  }

  watch(
    settings,
    (val) => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(val))
    },
    { deep: true }
  )

  function resetToDefaults() {
    settings.value = { ...defaultSettings }
  }

  return {
    settings,
    resetToDefaults,
  }
})
