import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(moduleDirectory, "../../../../../../");
for (const envPath of [
  path.resolve(process.cwd(), ".env"),
  path.resolve(moduleDirectory, "../../../../.env"),
  path.resolve(moduleDirectory, "../../../../../.env"),
  path.resolve(repositoryRoot, ".env")
]) {
  dotenv.config({ path: envPath, override: false });
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required. Copy .env.example to .env at the repository root and fill in the shared database credentials.`);
  return value;
}

function number(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
  return parsed;
}

export function parseBooleanEnv(value: string | undefined, fallback: boolean, name = "value"): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  throw new Error(`${name} must be true or false`);
}

function bool(name: string, fallback: boolean): boolean {
  return parseBooleanEnv(process.env[name], fallback, name);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: number("API_PORT", 3001),
  frontendUrl: process.env.FRONTEND_URL?.trim() ?? "http://localhost:5173",
  uploadDir: process.env.UPLOAD_DIR?.trim()
    ? path.resolve(repositoryRoot, process.env.UPLOAD_DIR.trim())
    : path.resolve(repositoryRoot, "apps/api-node/uploads"),
  db: {
    host: process.env.DB_HOST?.trim() ?? "localhost",
    port: number("DB_PORT", 3306),
    name: process.env.DB_NAME?.trim() ?? "lnfs_auth",
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    ssl: bool("DB_SSL", false),
    sslCaPath: process.env.DB_SSL_CA_PATH?.trim()
  },
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN?.trim() ?? "15m",
  refreshTokenDays: number("REFRESH_TOKEN_DAYS", 30),
  bcryptSaltRounds: number("BCRYPT_SALT_ROUNDS", 12),
  otpTtlMinutes: number("OTP_TTL_MINUTES", 10),
  otpMaxAttempts: number("OTP_MAX_ATTEMPTS", 5),
  cookieSecure: bool("COOKIE_SECURE", process.env.NODE_ENV === "production"),
  smtp: {
    host: required("SMTP_HOST"),
    port: number("SMTP_PORT", 465),
    secure: bool("SMTP_SECURE", true),
    user: required("SMTP_USER"),
    pass: required("SMTP_PASS"),
    from: required("SMTP_FROM")
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY?.trim() || null,
    model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite",
    timeoutMs: number("GEMINI_TIMEOUT_MS", 30_000)
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() || null,
    apiKey: process.env.CLOUDINARY_API_KEY?.trim() || null,
    apiSecret: process.env.CLOUDINARY_API_SECRET?.trim() || null
  }
};
