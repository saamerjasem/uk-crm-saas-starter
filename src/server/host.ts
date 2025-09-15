export function getHost(req: Request) {
  // Vercel sets x-forwarded-host; fall back to host for local
  const h =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "";
  // strip comma list and possible port, normalise case
  return h.split(",")[0].trim().split(":")[0].toLowerCase();
}
