import type { Category, LiveChannel, Movie, Series } from '@/types/iptv'
import { isTauri, proxyFetch } from './tauri'

export interface ParsedM3uPlaylist {
  liveCategories: Category[]
  vodCategories: Category[]
  seriesCategories: Category[]
  liveChannels: LiveChannel[]
  movies: Movie[]
  series: Series[]
}

type M3uEntryType = 'live' | 'movie' | 'series'

const SERIES_GROUP_RE = /\b(series|séries|saison|season|tv shows?)\b/i
const MOVIE_GROUP_RE = /\b(vod|films?|movies?|cinema|cine|4k uhd|uhd|box office)\b/i
const SERIES_TITLE_RE = /\b(s\d+\s*[ex-]?\s*\d+|saison\s*\d+|season\s*\d+|episode\s*\d+)\b/i

function getUrlExtension(url: string): string {
  const clean = url.split(/[?#]/)[0]
  const dotIdx = clean.lastIndexOf('.')
  return dotIdx > 0 ? clean.slice(dotIdx + 1).toLowerCase() : ''
}

function classifyEntry(group: string, title: string, url: string): M3uEntryType {
  if (SERIES_GROUP_RE.test(group)) return 'series'
  if (SERIES_TITLE_RE.test(title)) return 'series'
  if (MOVIE_GROUP_RE.test(group)) return 'movie'

  const ext = getUrlExtension(url)
  if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'm4v', 'flv', 'wmv'].includes(ext)) return 'movie'
  if (['m3u8', 'ts'].includes(ext)) return 'live'

  const lowerUrl = url.toLowerCase()
  if (/\/(movie|vod|film)s?\//.test(lowerUrl)) return 'movie'
  if (/\/(series|season|episode)s?\//.test(lowerUrl)) return 'series'

  return 'live'
}

function makeCategoryId(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'general'
}

interface MutablePlaylist {
  liveCategories: Map<string, Category>
  vodCategories: Map<string, Category>
  seriesCategories: Map<string, Category>
  liveChannels: LiveChannel[]
  movies: Movie[]
  series: Series[]
  channelCounter: number
  currentMeta: Record<string, string> | null
}

function emptyPlaylist(counter = 1): MutablePlaylist {
  return {
    liveCategories: new Map<string, Category>(),
    vodCategories: new Map<string, Category>(),
    seriesCategories: new Map<string, Category>(),
    liveChannels: [],
    movies: [],
    series: [],
    channelCounter: counter,
    currentMeta: null,
  }
}

function parseLines(
  lines: readonly string[],
  result: MutablePlaylist,
  startIndex = 0,
  endIndex = lines.length
): void {
  let currentMeta = result.currentMeta
  let channelCounter = result.channelCounter

  for (let lineIndex = startIndex; lineIndex < endIndex; lineIndex++) {
    const rawLine = lines[lineIndex]
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('#EXTINF:')) {
      currentMeta = {}
      const tvgLogo = line.match(/tvg-logo="([^"]*)"/i)?.[1] || ''
      const tvgName = line.match(/tvg-name="([^"]*)"/i)?.[1] || ''
      const groupTitle = line.match(/group-title="([^"]*)"/i)?.[1] || 'Général'
      const epgId = line.match(/tvg-id="([^"]*)"/i)?.[1] || ''

      const commaIdx = line.indexOf(',')
      const title = commaIdx >= 0 ? line.substring(commaIdx + 1).trim() : tvgName || 'Chaîne Sans Nom'

      currentMeta.title = title
      currentMeta.logo = tvgLogo
      currentMeta.group = groupTitle
      currentMeta.epgId = epgId
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      if (!currentMeta) {
        currentMeta = { title: `Stream ${channelCounter}`, group: 'Général', logo: '' }
      }

      const groupName = currentMeta.group || 'Général'
      const catId = makeCategoryId(groupName)
      const streamUrl = line
      const title = currentMeta.title
      const type = classifyEntry(groupName, title, streamUrl)

      if (type === 'movie') {
        if (!result.vodCategories.has(catId)) {
          result.vodCategories.set(catId, { category_id: catId, category_name: groupName })
        }
        result.movies.push({
          num: channelCounter,
          name: title,
          stream_type: 'movie',
          stream_id: channelCounter,
          stream_icon: currentMeta.logo,
          category_id: catId,
          container_extension: streamUrl.toLowerCase().endsWith('.mkv') ? 'mkv' : 'mp4',
          streamUrl,
        })
      } else if (type === 'series') {
        if (!result.seriesCategories.has(catId)) {
          result.seriesCategories.set(catId, { category_id: catId, category_name: groupName })
        }
        result.series.push({
          num: channelCounter,
          name: title,
          series_id: channelCounter,
          cover: currentMeta.logo,
          category_id: catId,
          genre: groupName,
          streamUrl,
        })
      } else {
        if (!result.liveCategories.has(catId)) {
          result.liveCategories.set(catId, { category_id: catId, category_name: groupName })
        }
        result.liveChannels.push({
          num: channelCounter,
          name: title,
          stream_type: 'live',
          stream_id: channelCounter,
          stream_icon: currentMeta.logo,
          epg_channel_id: currentMeta.epgId,
          category_id: catId,
          streamUrl,
        })
      }

      channelCounter++
      currentMeta = null
    }
  }

  result.channelCounter = channelCounter
  result.currentMeta = currentMeta
}

function flattenResult(result: MutablePlaylist): ParsedM3uPlaylist {
  return {
    liveCategories: Array.from(result.liveCategories.values()),
    vodCategories: Array.from(result.vodCategories.values()),
    seriesCategories: Array.from(result.seriesCategories.values()),
    liveChannels: result.liveChannels,
    movies: result.movies,
    series: result.series,
  }
}

export const M3uService = {
  async parseM3uFromUrl(playlistUrl: string): Promise<ParsedM3uPlaylist> {
    let rawText = ''
    if (isTauri()) {
      try {
        rawText = await proxyFetch(playlistUrl)
      } catch {
        const res = await fetch(playlistUrl)
        rawText = await res.text()
      }
    } else {
      const res = await fetch(playlistUrl)
      rawText = await res.text()
    }

    return this.parseM3uText(rawText)
  },

  parseM3uText(text: string): ParsedM3uPlaylist {
    const result = emptyPlaylist()
    const lines = text.split(/\r?\n/)
    parseLines(lines, result)
    return flattenResult(result)
  },

  async parseM3uTextAsync(
    text: string,
    onProgress?: (done: number, total: number) => void,
    chunkLines = 500
  ): Promise<ParsedM3uPlaylist> {
    return new Promise((resolve) => {
      const allLines = text.split(/\r?\n/)
      const total = allLines.length
      const result = emptyPlaylist()
      let processed = 0

      const parseChunk = () => {
        if (processed >= total) {
          resolve(flattenResult(result))
          return
        }
        const end = Math.min(processed + chunkLines, total)

        parseLines(allLines, result, processed, end)

        processed = end
        onProgress?.(Math.min(processed, total), total)

        if (processed >= total) {
          resolve(flattenResult(result))
        } else {
          setTimeout(parseChunk, 0)
        }
      }

      parseChunk()
    })
  },

  async parseM3uFromUrlAsync(
    playlistUrl: string,
    onProgress?: (done: number, total: number) => void,
    chunkLines = 500
  ): Promise<ParsedM3uPlaylist> {
    let rawText = ''
    if (isTauri()) {
      try {
        rawText = await proxyFetch(playlistUrl)
      } catch {
        const res = await fetch(playlistUrl)
        rawText = await res.text()
      }
    } else {
      const res = await fetch(playlistUrl)
      rawText = await res.text()
    }

    return this.parseM3uTextAsync(rawText, onProgress, chunkLines)
  },
}
