import { loadEnvFile } from "node:process";
import { accessSync, constants, mkdirSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const envFile = resolve(__dirname, "..", ".env");
try {
  loadEnvFile(envFile);
} catch {
  // Production should inject secrets through the process manager/container.
}

type NodeEnvironment = "development" | "test" | "production";
const environment = (process.env.NODE_ENV || "development") as NodeEnvironment;
if (!["development", "test", "production"].includes(environment)) {
  throw new Error("NODE_ENV harus development, test, atau production.");
}

const required = (name: string, value: string | undefined) => {
  if (!value?.trim()) throw new Error(`${name} wajib dikonfigurasi.`);
  return value.trim();
};

const positiveNumber = (name: string, value: string | undefined, fallback: number, max: number) => {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > max) throw new Error(`${name} harus berupa angka positif maksimal ${max}.`);
  return parsed;
};

const databaseUrl = environment === "test" ? process.env.DATABASE_URL || "mysql://test:test@localhost:3306/test" : required("DATABASE_URL", process.env.DATABASE_URL);
const accessSecret = environment === "production"
  ? required("JWT_ACCESS_SECRET", process.env.JWT_ACCESS_SECRET)
  : process.env.JWT_ACCESS_SECRET || "development-only-secret";
if (environment === "production" && (accessSecret.length < 32 || accessSecret === "development-only-secret")) {
  throw new Error("JWT_ACCESS_SECRET production harus minimal 32 karakter dan bukan secret development.");
}

const corsOrigins = (process.env.CORS_ORIGINS || (environment === "production" ? "" : "http://localhost:5173"))
  .split(",").map((origin) => origin.trim()).filter(Boolean);
if (environment === "production" && (!corsOrigins.length || corsOrigins.includes("*"))) {
  throw new Error("CORS_ORIGINS production wajib berisi allowlist origin dan tidak boleh '*'.");
}
for (const origin of corsOrigins) {
  try {
    const parsed = new URL(origin);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("protocol");
  } catch {
    throw new Error(`CORS_ORIGINS mengandung origin tidak valid: ${origin}`);
  }
}

const mediaDirInput = process.env.MEDIA_DIR || "uploads";
if (environment === "production" && !isAbsolute(mediaDirInput)) {
  throw new Error("MEDIA_DIR production harus berupa path absolut.");
}
const mediaDir = resolve(mediaDirInput);
mkdirSync(mediaDir, { recursive: true });
try {
  accessSync(mediaDir, constants.W_OK);
} catch {
  throw new Error(`MEDIA_DIR tidak writable: ${mediaDir}`);
}

const cookieSecure = process.env.COOKIE_SECURE === "true";
if (environment === "production" && !cookieSecure) throw new Error("COOKIE_SECURE=true wajib di production.");

const trustProxyInput = process.env.TRUST_PROXY?.trim() || "false";
const trustProxy =
  trustProxyInput === "true"
    ? true
    : trustProxyInput === "false"
      ? false
      : Number.isInteger(Number(trustProxyInput)) && Number(trustProxyInput) >= 0
        ? Number(trustProxyInput)
        : (() => {
            throw new Error("TRUST_PROXY harus berupa true, false, atau jumlah hop proxy non-negatif.");
          })();

export const config = Object.freeze({
  nodeEnv: environment,
  port: positiveNumber("PORT", process.env.PORT, 3000, 65535),
  databaseUrl,
  corsOrigins,
  jwtAccessSecret: accessSecret,
  jwtAccessTtlSeconds: positiveNumber("JWT_ACCESS_TTL_SECONDS", process.env.JWT_ACCESS_TTL_SECONDS, 900, 86400),
  jwtRefreshTtlDays: positiveNumber("JWT_REFRESH_TTL_DAYS", process.env.JWT_REFRESH_TTL_DAYS, 30, 365),
  cookieSecure,
  cookieName: process.env.COOKIE_NAME?.trim() || "tpb_refresh",
  cookieDomain: process.env.COOKIE_DOMAIN?.trim() || undefined,
  mediaDir,
  mediaMaxMb: positiveNumber("MEDIA_MAX_MB", process.env.MEDIA_MAX_MB, 10, 100),
  trustProxy,
});
