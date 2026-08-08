import type {
  XtreamCredentials,
  XtreamAuthResponse,
  Category,
  LiveChannel,
  Movie,
  MovieDetail,
  Series,
  SeriesDetail,
  EPGProgram
} from '@/types/iptv'
import { isTauri, proxyFetch } from './tauri'

const ALLOWED_PROTOCOLS = ['http:', 'https:']
const DEFAULT_PROTOCOL = 'http:'
const REQUEST_TIMEOUT_MS = 30_000

function isValidProtocol(url: URL): boolean {
  return ALLOWED_PROTOCOLS.includes(url.protocol)
}

const cleanUrl = (url: string): string => {
  let cleaned = url.trim()
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = DEFAULT_PROTOCOL + '//' + cleaned
  }
  cleaned = cleaned.replace(/\/+$/, '')

  let parsed: URL
  try {
    parsed = new URL(cleaned)
  } catch {
    throw new Error(`URL serveur invalide : ${url}`)
  }

  if (!isValidProtocol(parsed)) {
    throw new Error(`Protocole non autorisé : ${parsed.protocol}. Seuls http et https sont acceptés.`)
  }

  // Reject URLs containing userinfo, redirects, or embedded credentials to limit SSRF surface
  if (parsed.username || parsed.password) {
    throw new Error('L\'URL serveur ne doit pas contenir d\'identifiants intégrés.')
  }

  return parsed.toString()
}

function sanitizeIdentifier(value: string): string {
  // Keep only alphanumeric, dash, underscore and dot to prevent injection in path/query
  return value.replace(/[^a-zA-Z0-9_.-]/g, '')
}

function sanitizeExtension(ext: string): string {
  const cleaned = ext.toString().trim().replace(/^\./, '').toLowerCase()
  if (!cleaned) return 'mp4'
  // Allow only common media extensions
  if (!/^[a-z0-9]{1,6}$/.test(cleaned)) return 'mp4'
  return cleaned
}

function validateCredentials(creds: XtreamCredentials): void {
  if (!creds || typeof creds.serverUrl !== 'string' || typeof creds.username !== 'string' || typeof creds.password !== 'string') {
    throw new Error('Identifiants incomplets.')
  }
  if (!creds.serverUrl.trim()) throw new Error('URL serveur manquante.')
  if (!creds.username.trim()) throw new Error('Nom d\'utilisateur manquant.')
  if (!creds.password.trim()) throw new Error('Mot de passe manquant.')
}

const buildApiUrl = (creds: XtreamCredentials, action?: string, params: Record<string, string> = {}): string => {
  validateCredentials(creds)
  const base = `${cleanUrl(creds.serverUrl)}/player_api.php`
  const search = new URLSearchParams({
    username: creds.username,
    password: creds.password,
    ...(action ? { action } : {}),
    ...params
  })
  return `${base}?${search.toString()}`
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    if (isTauri()) {
      try {
        const text = await proxyFetch(url)
        return safeJsonParse<T>(text)
      } catch (err) {
        console.warn('Native proxy fetch failed, falling back to standard fetch:', err)
      }
    }

    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return safeJsonParse<T>(await response.text())
  } finally {
    clearTimeout(timeoutId)
  }
}

function safeJsonParse<T>(text: string): T {
  // Avoid __proto__ / constructor pollution when parsing untrusted server responses
  const cleaned = text.replace(/"\s*(__proto__|constructor|prototype)\s*"\s*:/g, '"__removed__":')
  return JSON.parse(cleaned) as T
}

// Simple in-memory detail cache keyed by server + username + id.
// This avoids re-fetching the same movie/series detail when a user re-opens a modal.
const detailCache = new Map<string, MovieDetail | SeriesDetail>()

function cacheKey(creds: XtreamCredentials, id: number | string): string {
  return `${cleanUrl(creds.serverUrl)}::${creds.username}::${id}`
}

function clearDetailCache(): void {
  detailCache.clear()
}

export const XtreamService = {
  async authenticate(creds: XtreamCredentials): Promise<XtreamAuthResponse> {
    const url = buildApiUrl(creds)
    const data = await fetchJson<XtreamAuthResponse>(url)
    if (!data || !data.user_info) {
      throw new Error('Identifiants Xtream invalides ou serveur indisponible.')
    }
    if (data.user_info.status !== 'Active') {
      throw new Error(`Compte non actif. Statut : ${data.user_info.status}`)
    }
    return data
  },

  async getLiveCategories(creds: XtreamCredentials): Promise<Category[]> {
    const url = buildApiUrl(creds, 'get_live_categories')
    return await fetchJson<Category[]>(url)
  },

  async getVodCategories(creds: XtreamCredentials): Promise<Category[]> {
    const url = buildApiUrl(creds, 'get_vod_categories')
    return await fetchJson<Category[]>(url)
  },

  async getSeriesCategories(creds: XtreamCredentials): Promise<Category[]> {
    const url = buildApiUrl(creds, 'get_series_categories')
    return await fetchJson<Category[]>(url)
  },

  async getLiveChannels(creds: XtreamCredentials, categoryId?: string): Promise<LiveChannel[]> {
    const params: Record<string, string> = {}
    if (categoryId && categoryId !== 'all') {
      params.category_id = sanitizeIdentifier(categoryId)
    }
    const url = buildApiUrl(creds, 'get_live_streams', params)
    return await fetchJson<LiveChannel[]>(url)
  },

  async getMovies(creds: XtreamCredentials, categoryId?: string): Promise<Movie[]> {
    const params: Record<string, string> = {}
    if (categoryId && categoryId !== 'all') {
      params.category_id = sanitizeIdentifier(categoryId)
    }
    const url = buildApiUrl(creds, 'get_vod_streams', params)
    return await fetchJson<Movie[]>(url)
  },

  async getSeries(creds: XtreamCredentials, categoryId?: string): Promise<Series[]> {
    const params: Record<string, string> = {}
    if (categoryId && categoryId !== 'all') {
      params.category_id = sanitizeIdentifier(categoryId)
    }
    const url = buildApiUrl(creds, 'get_series', params)
    return await fetchJson<Series[]>(url)
  },

  async getMovieDetail(creds: XtreamCredentials, vodId: number): Promise<MovieDetail> {
    if (!Number.isFinite(vodId) || vodId <= 0) throw new Error('ID film invalide.')
    const key = cacheKey(creds, vodId)
    const cached = detailCache.get(key)
    if (cached) return cached as MovieDetail
    const url = buildApiUrl(creds, 'get_vod_info', { vod_id: Math.floor(vodId).toString() })
    const detail = await fetchJson<MovieDetail>(url)
    detailCache.set(key, detail)
    return detail
  },

  async getSeriesDetail(creds: XtreamCredentials, seriesId: number): Promise<SeriesDetail> {
    if (!Number.isFinite(seriesId) || seriesId <= 0) throw new Error('ID série invalide.')
    const key = cacheKey(creds, seriesId)
    const cached = detailCache.get(key)
    if (cached) return cached as SeriesDetail
    const url = buildApiUrl(creds, 'get_series_info', { series_id: Math.floor(seriesId).toString() })
    const detail = await fetchJson<SeriesDetail>(url)
    detailCache.set(key, detail)
    return detail
  },

  async getEPG(creds: XtreamCredentials, streamId: number, limit = 10): Promise<EPGProgram[]> {
    try {
      if (!Number.isFinite(streamId) || streamId <= 0) return []
      const url = buildApiUrl(creds, 'get_short_epg', {
        stream_id: Math.floor(streamId).toString(),
        limit: Math.max(1, Math.min(100, Math.floor(limit))).toString()
      })
      const res = await fetchJson<{ epg_listings?: EPGProgram[] }>(url)
      return Array.isArray(res.epg_listings) ? res.epg_listings : []
    } catch {
      return []
    }
  },

  buildLiveStreamUrl(creds: XtreamCredentials, streamId: number, format = 'ts'): string {
    validateCredentials(creds)
    if (!Number.isFinite(streamId) || streamId <= 0) throw new Error('ID stream invalide.')
    const server = cleanUrl(creds.serverUrl)
    const cleanFormat = sanitizeExtension(format)
    return `${server}/live/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${Math.floor(streamId)}.${cleanFormat}`
  },

  buildMovieStreamUrl(creds: XtreamCredentials, streamId: number, ext = 'mp4'): string {
    validateCredentials(creds)
    if (!Number.isFinite(streamId) || streamId <= 0) throw new Error('ID film invalide.')
    const server = cleanUrl(creds.serverUrl)
    const cleanExt = sanitizeExtension(ext)
    return `${server}/movie/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${Math.floor(streamId)}.${cleanExt}`
  },

  buildEpisodeStreamUrl(creds: XtreamCredentials, episodeId: string | number, ext = 'mp4'): string {
    validateCredentials(creds)
    const id = episodeId.toString().trim()
    if (!id || /[<>"'&\s]/.test(id)) throw new Error('ID épisode invalide.')
    const server = cleanUrl(creds.serverUrl)
    const cleanExt = sanitizeExtension(ext)
    return `${server}/series/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${encodeURIComponent(id)}.${cleanExt}`
  },

  clearDetailCache
}
