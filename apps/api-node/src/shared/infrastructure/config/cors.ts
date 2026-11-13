function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, "");
}

export function parseAllowedOrigins(value: string): Set<string> {
  return new Set(value.split(",").map(normalizeOrigin).filter(Boolean));
}

export function isOriginAllowed(origin: string | undefined, configuredOrigins: Set<string>, nodeEnv: string): boolean {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);
  if (configuredOrigins.has(normalizedOrigin)) return true;
  if (nodeEnv === "production") return false;

  try {
    const url = new URL(normalizedOrigin);
    const host = url.hostname;
    const isLocalOrTunnel =
      ["localhost", "127.0.0.1", "[::1]"].includes(host) ||
      host.endsWith(".loca.lt") ||
      host.endsWith(".ngrok-free.app") ||
      host.endsWith(".trycloudflare.com") ||
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
    return isLocalOrTunnel && ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}
