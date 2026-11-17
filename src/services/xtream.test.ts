import { describe, expect, it } from 'vitest'
import { XtreamService } from './xtream'

const creds = { serverUrl: 'http://example.test:8080', username: 'user', password: 'pass' }

describe('XtreamService stream URLs', () => {
  it('does not insert a double slash after the server origin', () => {
    expect(XtreamService.buildEpisodeStreamUrl(creds, 402704, 'mkv')).toBe('http://example.test:8080/series/user/pass/402704.mkv')
    expect(XtreamService.buildMovieStreamUrl(creds, 12, 'mp4')).toBe('http://example.test:8080/movie/user/pass/12.mp4')
    expect(XtreamService.buildLiveStreamUrl(creds, 7)).toBe('http://example.test:8080/live/user/pass/7.ts')
  })

  it('handles server URLs typed with a trailing slash or a sub-path', () => {
    expect(XtreamService.buildLiveStreamUrl({ ...creds, serverUrl: 'example.test:8080/' }, 7)).toBe('http://example.test:8080/live/user/pass/7.ts')
    expect(XtreamService.buildLiveStreamUrl({ ...creds, serverUrl: 'http://example.test/iptv/' }, 7)).toBe('http://example.test/iptv/live/user/pass/7.ts')
  })
})
