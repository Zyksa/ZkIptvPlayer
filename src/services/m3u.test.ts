import { describe, expect, it } from 'vitest'
import { M3uService } from './m3u'

const PLAYLIST = `#EXTM3U
#EXTINF:-1 tvg-id="news-1" tvg-logo="https://img.test/news.png" group-title="Actualités",France Info
https://stream.test/live/news-1.ts
#EXTINF:-1 tvg-logo="https://img.test/movie.png" group-title="Films 4K",Un Film
https://stream.test/movie/user/pass/42.mkv
#EXTINF:-1 tvg-logo="https://img.test/series.png" group-title="Séries",Une Série S01E02
https://stream.test/series/user/pass/84.mp4`

describe('M3uService', () => {
  it('classifies live, movie and series entries without losing metadata', () => {
    const parsed = M3uService.parseM3uText(PLAYLIST)

    expect(parsed.liveChannels).toHaveLength(1)
    expect(parsed.liveChannels[0]).toMatchObject({ name: 'France Info', epg_channel_id: 'news-1' })
    expect(parsed.movies).toHaveLength(1)
    expect(parsed.movies[0]).toMatchObject({ name: 'Un Film', container_extension: 'mkv' })
    expect(parsed.series).toHaveLength(1)
    expect(parsed.series[0]).toMatchObject({ name: 'Une Série S01E02' })
  })

  it('preserves EXTINF metadata across async chunk boundaries', async () => {
    const parsed = await M3uService.parseM3uTextAsync(PLAYLIST, undefined, 1)

    expect(parsed.liveChannels[0]?.name).toBe('France Info')
    expect(parsed.movies[0]?.name).toBe('Un Film')
    expect(parsed.series[0]?.name).toBe('Une Série S01E02')
  })
})
