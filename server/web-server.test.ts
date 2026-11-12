import { describe, expect, it } from 'vitest'
import { EventEmitter } from 'node:events'
import { handleApi, parseRemoteUrl } from './web-server.mjs'

function fakeReq(url: string, headers: Record<string, string>, method = 'GET') {
  return Object.assign(new EventEmitter(), { url, method, headers })
}

function fakeRes() {
  const res = {
    status: 0,
    body: '',
    headersSent: false,
    writeHead(status: number) {
      res.status = status
      res.headersSent = true
      return res
    },
    end(chunk?: string) {
      if (chunk) res.body += chunk
    },
  }
  return res
}

describe('parseRemoteUrl', () => {
  it('accepts network stream URLs', () => {
    expect(parseRemoteUrl('http://host:8080/live/u/p/1.ts')?.href).toBe('http://host:8080/live/u/p/1.ts')
    expect(parseRemoteUrl('rtmp://host/app')).not.toBeNull()
  })

  it('rejects local files, VLC options and junk', () => {
    expect(parseRemoteUrl('file:///C:/Windows/win.ini')).toBeNull()
    expect(parseRemoteUrl('--extraintf=lua')).toBeNull()
    expect(parseRemoteUrl('')).toBeNull()
    expect(parseRemoteUrl(42)).toBeNull()
  })
})

describe('handleApi', () => {
  it('ignores non-API paths', async () => {
    const res = fakeRes()
    expect(await handleApi(fakeReq('/index.html', { host: 'localhost:14300' }), res)).toBe(false)
  })

  it('rejects calls without the app header (cross-site requests)', async () => {
    const res = fakeRes()
    await handleApi(fakeReq('/api/health', { host: 'localhost:14300' }), res)
    expect(res.status).toBe(403)
  })

  it('rejects foreign Host headers (DNS rebinding)', async () => {
    const res = fakeRes()
    await handleApi(fakeReq('/api/health', { host: 'evil.example:14300', 'x-zkplayer': '1' }), res)
    expect(res.status).toBe(403)
  })

  it('answers trusted calls', async () => {
    const res = fakeRes()
    await handleApi(fakeReq('/api/health', { host: '127.0.0.1:14300', 'x-zkplayer': '1' }), res)
    expect(res.status).toBe(200)
  })

  it('refuses to relay non-http URLs', async () => {
    const res = fakeRes()
    await handleApi(fakeReq('/api/fetch?url=file%3A%2F%2F%2Fetc%2Fpasswd', { host: 'localhost', 'x-zkplayer': '1' }), res)
    expect(res.status).toBe(400)
  })
})
