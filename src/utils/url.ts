const ALLOWED_IMAGE_PROTOCOLS = ['http:', 'https:']
const FORBIDDEN_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '[::]', '169.254.169.254']

export function isSafeImageUrl(url: string | undefined | null): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url.trim())
    if (!ALLOWED_IMAGE_PROTOCOLS.includes(parsed.protocol)) return false
    const hostname = parsed.hostname.toLowerCase()
    if (FORBIDDEN_HOSTS.includes(hostname)) return false
    if (hostname.startsWith('127.') || hostname.startsWith('10.') || hostname.startsWith('192.168.')) return false
    if (hostname.startsWith('172.')) {
      const secondOctet = Number(hostname.split('.')[1])
      if (!Number.isNaN(secondOctet) && secondOctet >= 16 && secondOctet <= 31) return false
    }
    return true
  } catch {
    return false
  }
}
