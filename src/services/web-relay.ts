// Client for the web-mode local server (server/web-server.mjs).
// Used whenever the app runs in a plain browser instead of the Tauri shell.

// Must match API_HEADER in server/web-server.mjs. The custom header makes the
// browser send a CORS preflight that the server never approves, so only this
// app (same origin) can call the relay.
const API_HEADERS = { 'X-ZkPlayer': '1' }

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (body && typeof body.error === 'string') return body.error
  } catch {
    // not JSON
  }
  return `HTTP ${res.status}`
}

/** Fetches a remote URL through the local relay (bypasses the IPTV server's missing CORS headers). */
export async function relayFetchText(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`, { headers: API_HEADERS, signal })
  if (!res.ok) throw new Error(await readError(res))
  return res.text()
}

/** Asks the local server to open the stream in VLC. Throws with a readable message on failure. */
export async function openInVlc(url: string, title?: string): Promise<void> {
  const res = await fetch('/api/vlc', {
    method: 'POST',
    headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, title }),
  })
  if (!res.ok) throw new Error(await readError(res))
}
