import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthMode, XtreamCredentials, M3uCredentials, XtreamUserInfo, XtreamServerInfo } from '@/types/iptv'
import { XtreamService } from '@/services/xtream'
import { M3uService, type ParsedM3uPlaylist } from '@/services/m3u'
import {
  deleteM3uCatalogCache,
  readM3uCatalogCache,
  writeM3uCatalogCache,
} from '@/services/catalog-cache'

const STORAGE_KEY = 'zkplayer_auth_session'
const M3U_CACHE_KEY = 'zkplayer_m3u_cache'
const M3U_CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface M3uCacheEnvelope {
  timestamp: number
  data: ParsedM3uPlaylist
}

function isFreshM3uCache(value: M3uCacheEnvelope | null): value is M3uCacheEnvelope {
  return !!value?.data && Date.now() - value.timestamp <= M3U_CACHE_TTL_MS
}

async function loadM3uCache(): Promise<ParsedM3uPlaylist | null> {
  try {
    const indexedCache = await readM3uCatalogCache<M3uCacheEnvelope>()
    if (isFreshM3uCache(indexedCache)) return indexedCache.data
    if (indexedCache) await deleteM3uCatalogCache()
  } catch {}

  // One-time compatibility path for catalogs saved by versions that used
  // synchronous localStorage. Migrate it to IndexedDB after a successful read.
  const saved = localStorage.getItem(M3U_CACHE_KEY)
  if (!saved) return null
  try {
    const parsed: M3uCacheEnvelope = JSON.parse(saved)
    if (!isFreshM3uCache(parsed)) return null
    await writeM3uCatalogCache(parsed).catch(() => {})
    localStorage.removeItem(M3U_CACHE_KEY)
    return parsed.data
  } catch {}
  return null
}

async function saveM3uCache(data: ParsedM3uPlaylist) {
  const envelope: M3uCacheEnvelope = { timestamp: Date.now(), data }
  try {
    await writeM3uCatalogCache(envelope)
    localStorage.removeItem(M3U_CACHE_KEY)
  } catch {
    // Keep the previous storage path as a compatibility fallback on WebViews
    // where IndexedDB is disabled.
    try {
      localStorage.setItem(M3U_CACHE_KEY, JSON.stringify(envelope))
    } catch {}
  }
}

async function clearM3uCache() {
  localStorage.removeItem(M3U_CACHE_KEY)
  await deleteM3uCatalogCache().catch(() => {})
}

export interface AuthSession {
  mode: AuthMode
  xtreamCreds?: XtreamCredentials
  m3uCreds?: M3uCredentials
  rememberMe: boolean
}

export const useAuthStore = defineStore('auth', () => {
  const authMode = ref<AuthMode>('xtream')
  const credentials = ref<XtreamCredentials | null>(null)
  const m3uCredentials = ref<M3uCredentials | null>(null)
  const userInfo = ref<XtreamUserInfo | null>(null)
  const serverInfo = ref<XtreamServerInfo | null>(null)
  const parsedM3uData = ref<ParsedM3uPlaylist | null>(null)

  const isLoading = ref(false)
  const isAutoLoggingIn = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => {
    if (authMode.value === 'xtream') {
      return !!credentials.value && !!userInfo.value
    } else {
      return !!m3uCredentials.value && !!parsedM3uData.value
    }
  })

  async function initSession() {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return

    try {
      const session: AuthSession = JSON.parse(saved)
      if (!session.rememberMe) return

      isAutoLoggingIn.value = true
      authMode.value = session.mode

      if (session.mode === 'xtream' && session.xtreamCreds) {
        await login(session.xtreamCreds, true)
      } else if (session.mode === 'm3u' && session.m3uCreds) {
        // Fast-path: restore cached catalog instantly so the UI appears immediately.
        const cached = await loadM3uCache()
        if (cached) {
          m3uCredentials.value = session.m3uCreds
          parsedM3uData.value = cached
          isAutoLoggingIn.value = false
          return
        }
        await loginM3u(session.m3uCreds, true)
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    } finally {
      isAutoLoggingIn.value = false
    }
  }

  async function login(creds: XtreamCredentials, rememberMe = true): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      const authRes = await XtreamService.authenticate(creds)
      authMode.value = 'xtream'
      credentials.value = creds
      userInfo.value = authRes.user_info
      serverInfo.value = authRes.server_info

      if (rememberMe) {
        const session: AuthSession = { mode: 'xtream', xtreamCreds: creds, rememberMe: true }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
      return true
    } catch (err: any) {
      error.value = err.message || 'Erreur lors de la connexion au serveur IPTV'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function loginM3u(m3uCreds: M3uCredentials, rememberMe = true): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      const parsed = await M3uService.parseM3uFromUrlAsync(m3uCreds.playlistUrl, undefined, 600)
      if (parsed.liveChannels.length === 0 && parsed.movies.length === 0 && parsed.series.length === 0) {
        throw new Error('La playlist M3U est vide ou invalide.')
      }

      authMode.value = 'm3u'
      m3uCredentials.value = m3uCreds
      parsedM3uData.value = parsed
      void saveM3uCache(parsed)

      if (rememberMe) {
        const session: AuthSession = { mode: 'm3u', m3uCreds, rememberMe: true }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
      return true
    } catch (err: any) {
      error.value = err.message || 'Impossible d\'analyser la playlist M3U'
      return false
    } finally {
      isLoading.value = false
    }
  }

  function logout() {
    credentials.value = null
    m3uCredentials.value = null
    userInfo.value = null
    serverInfo.value = null
    parsedM3uData.value = null
    localStorage.removeItem(STORAGE_KEY)
    void clearM3uCache()
  }

  return {
    authMode,
    credentials,
    m3uCredentials,
    userInfo,
    serverInfo,
    parsedM3uData,
    isLoading,
    isAutoLoggingIn,
    error,
    isAuthenticated,
    initSession,
    login,
    loginM3u,
    logout
  }
})
