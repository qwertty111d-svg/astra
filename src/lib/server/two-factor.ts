import crypto from "node:crypto";
import * as OTPAuth from "otpauth";

export const PRE_2FA_COOKIE = "pre_2fa_token";

function getEnv(name: string) {
  const value = process.env[name] || (import.meta as any)?.env?.[name] || "";
  return String(value).trim();
}

function getEncryptionKey() {
  const raw = getEnv("TOTP_ENCRYPTION_KEY");
  if (!raw) throw new Error("TOTP_ENCRYPTION_KEY не задан");
  return crypto.createHash("sha256").update(raw).digest();
}

function getSigningKey() {
  const raw = getEnv("AUTH_SIGNING_SECRET");
  if (!raw) throw new Error("AUTH_SIGNING_SECRET не задан");
  return raw;
}

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64");
}

export function encryptSecret(secretBase32: string) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secretBase32, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(payload: string) {
  const key = getEncryptionKey();
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function generateTwoFactorSetup(email: string) {
  const secret = new OTPAuth.Secret();
  const totp = new OTPAuth.TOTP({
    issuer: "Astra",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });

  const secretBase32 = secret.base32;
  return {
    secret: secretBase32,
    otpauthUrl: totp.toString(),
    encryptedSecret: encryptSecret(secretBase32),
  };
}

export function verifyTwoFactorCode(input: {
  email: string;
  encryptedSecret: string;
  code: string;
}) {
  const secretBase32 = decryptSecret(input.encryptedSecret);
  const totp = new OTPAuth.TOTP({
    issuer: "Astra",
    label: input.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });

  const token = String(input.code || "").replace(/\s+/g, "");
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

function normalizeRecoveryCode(code: string) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function hashRecoveryCode(code: string) {
  return crypto
    .createHash("sha256")
    .update(normalizeRecoveryCode(code))
    .digest("hex");
}

export function generateRecoveryCodes(count = 8) {
  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    const formatted = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    plainCodes.push(formatted);
    hashedCodes.push(hashRecoveryCode(formatted));
  }

  return {
    plainCodes,
    storageValue: JSON.stringify(hashedCodes),
  };
}

export function packRecoveryCodes(codes: string[]) {
  return codes.join("\n");
}

export function unpackRecoveryCodes(value: string) {
  return String(value || "")
    .split(/\r?\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function consumeRecoveryCode(
  storageValue: string | null | undefined,
  inputCode: string
) {
  if (!storageValue) {
    return { ok: false, nextStorageValue: null as string | null };
  }

  let codes: string[] = [];
  try {
    const parsed = JSON.parse(storageValue);
    if (Array.isArray(parsed)) codes = parsed.map((item) => String(item));
  } catch {
    return { ok: false, nextStorageValue: storageValue };
  }

  const hash = hashRecoveryCode(inputCode);
  const nextCodes = codes.filter((item) => item !== hash);

  if (nextCodes.length === codes.length) {
    return { ok: false, nextStorageValue: storageValue };
  }

  return {
    ok: true,
    nextStorageValue: nextCodes.length ? JSON.stringify(nextCodes) : null,
  };
}

export function createPreTwoFactorToken(userId: string, next = "/account") {
  const payload = JSON.stringify({
    u: userId,
    n: next.startsWith("/") ? next : "/account",
    e: Date.now() + 5 * 60 * 1000,
  });

  const encoded = base64UrlEncode(payload);
  const signature = crypto
    .createHmac("sha256", getSigningKey())
    .update(encoded)
    .digest();

  return `${encoded}.${base64UrlEncode(signature)}`;
}

export function readPreTwoFactorToken(token: string) {
  if (!token || !token.includes(".")) return null;

  const [encoded, signature] = token.split(".");
  const expected = crypto
    .createHmac("sha256", getSigningKey())
    .update(encoded)
    .digest();
  const actual = base64UrlDecode(signature);

  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(encoded).toString("utf8"));
  if (!payload?.u || !payload?.e || Number(payload.e) < Date.now()) return null;

  return {
    userId: String(payload.u),
    next:
      typeof payload.n === "string" && payload.n.startsWith("/")
        ? payload.n
        : "/account",
  };
}
