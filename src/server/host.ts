export function getHost(req: Request): string {
  const hdr = req.headers.get('x-forwarded-host') || req.headers.get('host')
  if (!hdr) throw new Error('Missing host header')
  // Remove port if present
  return hdr.split(':')[0].toLowerCase()
}
