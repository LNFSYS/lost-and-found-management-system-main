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
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}
