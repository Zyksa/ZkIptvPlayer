// ZkPlayer — web mode local server.
//
// Serves the built Vue app (dist/) on http://localhost:14300 and exposes two
// local-only endpoints the browser cannot do by itself:
//   GET  /api/fetch?url=…  relays IPTV catalog requests (Xtream / M3U servers
//                          send no CORS headers, so the browser can't read them)
//   POST /api/vlc          launches VLC on the stream URL
//
// No dependencies beyond Node itself, no native binary, nothing to sign.

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, createReadStream, statSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, extname, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'

export const DEFAULT_PORT = 14300
const FETCH_TIMEOUT_MS = 60_000
const MAX_TITLE_LENGTH = 200
// Header the app sends on every API call. A custom header forces a CORS
// preflight, which this server never approves, so other websites open in the
// browser cannot drive these endpoints.
const API_HEADER = 'x-zkplayer'
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const STREAM_PROTOCOLS = new Set(['http:', 'https:', 'rtmp:', 'rtsp:', 'udp:', 'rtp:', 'mms:'])

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

/** Rejects requests that don't come from the app itself (DNS rebinding, cross-site calls). */
function isTrustedApiRequest(req) {
  const hostname = (req.headers.host || '').replace(/:\d+$/, '')
  return ALLOWED_HOSTS.has(hostname) && req.headers[API_HEADER] === '1'
}

/** Parses a stream/catalog URL and only accepts network protocols (no file:, no VLC options). */
export function parseRemoteUrl(raw, protocols = STREAM_PROTOCOLS) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 4096) return null
  try {
    const url = new URL(raw)
    return protocols.has(url.protocol) ? url : null
  } catch {
    return null
  }
}

function vlcCandidates() {
  if (process.platform === 'win32') {
    const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], 'C:\\Program Files', 'C:\\Program Files (x86)']
    const paths = roots.filter(Boolean).map((root) => join(root, 'VideoLAN', 'VLC', 'vlc.exe'))
    return [...new Set(paths)].filter((p) => existsSync(p)).concat('vlc')
  }
  if (process.platform === 'darwin') {
    const app = '/Applications/VLC.app/Contents/MacOS/VLC'
    return existsSync(app) ? [app, 'vlc'] : ['vlc']
  }
  return ['vlc']
}

function trySpawn(command, args) {
  return new Promise((resolvePromise) => {
    let child
    try {
      child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: false })
    } catch {
      resolvePromise(false)
      return
    }
    child.once('error', () => resolvePromise(false))
    child.once('spawn', () => {
      child.unref()
      resolvePromise(true)
    })
  })
}

const PLAYLIST_DIR = join(tmpdir(), 'zkplayer-web')
const PLAYLIST_MAX_AGE_MS = 24 * 60 * 60 * 1000

/**
 * Writes a one-entry playlist so VLC shows the real title. A global
 * `--meta-title` would stick to every later stream of a reused VLC instance.
 */
function writeTitledPlaylist(streamUrl, title) {
  mkdirSync(PLAYLIST_DIR, { recursive: true })
  const now = Date.now()
  for (const name of readdirSync(PLAYLIST_DIR)) {
    const file = join(PLAYLIST_DIR, name)
    try {
      if (now - statSync(file).mtimeMs > PLAYLIST_MAX_AGE_MS) unlinkSync(file)
    } catch {
      // in use or already gone
    }
  }
  const file = join(PLAYLIST_DIR, `${now}-${randomBytes(4).toString('hex')}.m3u`)
  writeFileSync(file, `#EXTM3U\n#EXTINF:-1,${title}\n${streamUrl}\n`, 'utf8')
  return file
}

/**
 * Opens the stream in VLC. `--one-instance` reuses an already-open VLC window,
 * so clicking another channel switches the stream instead of stacking windows.
 */
export async function launchVlc(streamUrl, title) {
  let target = streamUrl
  if (title) {
    try {
      target = writeTitledPlaylist(streamUrl, title)
    } catch {
      // no temp dir: play the raw URL, VLC just shows the file name
    }
  }
  const args = ['--one-instance', target]
  for (const command of vlcCandidates()) {
    if (await trySpawn(command, args)) return true
  }
  return false
}

function readJsonBody(req, limit = 16 * 1024) {
  return new Promise((resolvePromise, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('Body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

async function handleFetch(req, res, requestUrl) {
  const target = parseRemoteUrl(requestUrl.searchParams.get('url'), new Set(['http:', 'https:']))
  if (!target) return sendJson(res, 400, { error: 'URL invalide' })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  req.on('close', () => controller.abort())
  try {
    const upstream = await fetch(target, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'VLC/3.0.21 LibVLC/3.0.21', Accept: '*/*' },
    })
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    if (!upstream.body) return res.end()
    Readable.fromWeb(upstream.body).on('error', () => res.destroy()).pipe(res)
  } catch (e) {
    if (!res.headersSent) sendJson(res, 502, { error: `Serveur IPTV injoignable : ${e?.cause?.code || e?.message || e}` })
    else res.destroy()
  } finally {
    clearTimeout(timer)
  }
}

async function handleVlc(req, res) {
  let body
  try {
    body = await readJsonBody(req)
  } catch {
    return sendJson(res, 400, { error: 'Requête invalide' })
  }
  const stream = parseRemoteUrl(body?.url)
  if (!stream) return sendJson(res, 400, { error: 'URL de flux invalide' })
  const title = typeof body.title === 'string' ? body.title.replace(/[\r\n]+/g, ' ').slice(0, MAX_TITLE_LENGTH).trim() : ''

  if (await launchVlc(stream.href, title)) return sendJson(res, 200, { ok: true })
  return sendJson(res, 500, { error: 'VLC est introuvable. Installez-le depuis https://www.videolan.org/vlc/' })
}

/**
 * API handler shared by the standalone server and the Vite dev server.
 * Returns true when the request was an /api call (handled), false otherwise.
 */
export async function handleApi(req, res) {
  const requestUrl = new URL(req.url || '/', 'http://localhost')
  if (!requestUrl.pathname.startsWith('/api/')) return false

  if (!isTrustedApiRequest(req)) {
    sendJson(res, 403, { error: 'Forbidden' })
    return true
  }
  if (requestUrl.pathname === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, { ok: true })
  } else if (requestUrl.pathname === '/api/fetch' && req.method === 'GET') {
    await handleFetch(req, res, requestUrl)
  } else if (requestUrl.pathname === '/api/vlc' && req.method === 'POST') {
    await handleVlc(req, res)
  } else {
    sendJson(res, 404, { error: 'Not found' })
  }
  return true
}

function serveStatic(req, res, distDir) {
  const requestUrl = new URL(req.url || '/', 'http://localhost')
  let pathname
  try {
    pathname = decodeURIComponent(requestUrl.pathname)
  } catch {
    res.writeHead(400).end()
    return
  }
  let filePath = resolve(distDir, '.' + pathname)
  if (filePath !== distDir && !filePath.startsWith(distDir + sep)) {
    res.writeHead(403).end()
    return
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(distDir, 'index.html') // SPA fallback
  }
  const isAsset = pathname.startsWith('/assets/')
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  createReadStream(filePath).pipe(res)
}

function openBrowser(url) {
  const [command, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]]
  trySpawn(command, args)
}

export function startServer({ port = DEFAULT_PORT, open = true } = {}) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const distDir = join(root, 'dist')
  if (!existsSync(join(distDir, 'index.html'))) {
    console.error('dist/ est introuvable. Lancez d\'abord « npm run build:web ».')
    process.exit(1)
  }

  const server = createServer(async (req, res) => {
    try {
      if (await handleApi(req, res)) return
      serveStatic(req, res, distDir)
    } catch (e) {
      console.error(e)
      if (!res.headersSent) sendJson(res, 500, { error: 'Erreur interne' })
      else res.destroy()
    }
  })

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`ZkPlayer tourne déjà sur http://localhost:${port} — ouverture du navigateur.`)
      if (open) openBrowser(`http://localhost:${port}`)
      setTimeout(() => process.exit(0), 500)
      return
    }
    throw e
  })

  // Bound to loopback only: nothing on the network can reach the relay.
  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}`
    console.log(`\n  ZkPlayer (mode web) → ${url}\n  Laissez cette fenêtre ouverte. Ctrl+C pour arrêter.\n`)
    if (open) openBrowser(url)
  })
  return server
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || DEFAULT_PORT
  startServer({ port, open: !process.argv.includes('--no-open') })
}
