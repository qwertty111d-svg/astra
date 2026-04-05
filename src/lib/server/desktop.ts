import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db.js";
import { createSession, findUserByEmail, getCurrentAuth, guessOs, publicUser, type UserRecord, verifyPassword } from "./auth.js";
import { desktopDevices, sessions, users } from "./schema.js";

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeText(value: unknown, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeFingerprint(value: unknown) {
  return normalizeText(value, 191);
}

export function getDesktopDeviceLimit(plan: string | null | undefined) {
  const normalized = String(plan ?? "").trim().toUpperCase();
  if (normalized === "LIFETIME") return 5;
  if (normalized === "PRO") return 3;
  return 1;
}

export function getDesktopLicense(user: Pick<UserRecord, "plan" | "subscriptionEndsAt">) {
  const plan = String(user.plan ?? "").trim().toUpperCase() || null;
  const expiresAt = user.subscriptionEndsAt ?? null;
  const isLifetime = plan === "LIFETIME";
  const hasFutureSubscription = Boolean(
    expiresAt && new Date(expiresAt).getTime() > Date.now()
  );
  const active = Boolean(plan && (isLifetime || hasFutureSubscription));

  return {
    plan,
    active,
    expiresAt,
    features: {
      proOptimization: active,
      fpsBoost: active,
      advancedCleanup: active,
      registryTweaks: active,
      serviceTweaks: active,
      oneClickRollback: active,
    },
    deviceLimit: getDesktopDeviceLimit(plan),
  };
}

export async function ensureDesktopDevicesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS desktop_devices (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      session_token text,
      device_name text NOT NULL,
      device_fingerprint text NOT NULL,
      platform text NOT NULL DEFAULT 'Windows',
      app_version text,
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS desktop_devices_user_id_idx ON desktop_devices (user_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS desktop_devices_fingerprint_idx ON desktop_devices (device_fingerprint)
  `);
}

export async function getDesktopAuth(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : request.headers.get("x-desktop-token")?.trim();

  if (!token) {
    return getCurrentAuth(request);
  }

  const sessionRows = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1);
  const session = sessionRows[0];
  if (!session) return null;

  const userRows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  const user = userRows[0];
  if (!user) return null;

  return {
    token,
    session: {
      token: session.token,
      userId: session.userId,
      name: session.name,
      os: session.os,
      ip: session.ip,
      createdAt: toIso(session.createdAt) ?? new Date().toISOString(),
      lastSeenAt: toIso(session.lastSeenAt) ?? new Date().toISOString(),
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
      pendingEmail: user.pendingEmail ?? null,
      pendingEmailVerificationToken: user.pendingEmailVerificationToken ?? null,
      pendingEmailVerificationExpiresAt: toIso(user.pendingEmailVerificationExpiresAt),
      passwordHash: user.passwordHash,
      passwordResetToken: user.passwordResetToken ?? null,
      passwordResetExpiresAt: toIso(user.passwordResetExpiresAt),
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
      twoFactorSecret: user.twoFactorSecret ?? null,
      pendingTwoFactorSecret: user.pendingTwoFactorSecret ?? null,
      twoFactorRecoveryCodes: user.twoFactorRecoveryCodes ?? null,
      plan: user.plan ?? null,
      subscriptionEndsAt: toIso(user.subscriptionEndsAt),
      createdAt: toIso(user.createdAt) ?? new Date().toISOString(),
      updatedAt: toIso(user.updatedAt) ?? new Date().toISOString(),
    },
  };
}

export async function registerDesktopDevice(input: {
  userId: string;
  sessionToken?: string | null;
  deviceName?: string | null;
  deviceFingerprint?: string | null;
  platform?: string | null;
  appVersion?: string | null;
}) {
  await ensureDesktopDevicesTable();

  const fingerprint = normalizeFingerprint(input.deviceFingerprint) || `anon-${input.userId}`;
  const deviceName = normalizeText(input.deviceName || "Astra Desktop", 120) || "Astra Desktop";
  const platform = normalizeText(input.platform || "Windows", 80) || "Windows";
  const appVersion = normalizeText(input.appVersion || "", 50) || null;

  const existingRows = await db
    .select()
    .from(desktopDevices)
    .where(and(eq(desktopDevices.userId, input.userId), eq(desktopDevices.deviceFingerprint, fingerprint)))
    .orderBy(desc(desktopDevices.lastSeenAt))
    .limit(1);

  const now = new Date();

  if (existingRows[0]) {
    const rows = await db
      .update(desktopDevices)
      .set({
        sessionToken: input.sessionToken ?? existingRows[0].sessionToken ?? null,
        deviceName,
        platform,
        appVersion,
        lastSeenAt: now,
      })
      .where(eq(desktopDevices.id, existingRows[0].id))
      .returning();

    return rows[0];
  }

  const rows = await db
    .insert(desktopDevices)
    .values({
      id: randomUUID(),
      userId: input.userId,
      sessionToken: input.sessionToken ?? null,
      deviceName,
      deviceFingerprint: fingerprint,
      platform,
      appVersion,
      lastSeenAt: now,
      createdAt: now,
    })
    .returning();

  return rows[0];
}

export async function getDesktopDevicesForUser(userId: string) {
  await ensureDesktopDevicesTable();
  return db
    .select()
    .from(desktopDevices)
    .where(eq(desktopDevices.userId, userId))
    .orderBy(desc(desktopDevices.lastSeenAt));
}

export async function destroyDesktopSession(token: string) {
  await ensureDesktopDevicesTable();
  await db.update(desktopDevices).set({ sessionToken: null }).where(eq(desktopDevices.sessionToken, token));
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function loginDesktop(input: {
  email: string;
  password: string;
  deviceName?: string | null;
  deviceFingerprint?: string | null;
  appVersion?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const user = await findUserByEmail(input.email);
  if (!user) {
    throw new Error("Пользователь не найден.");
  }

  if (!verifyPassword(input.password, user.passwordHash)) {
    throw new Error("Неверный пароль.");
  }

  if (user.twoFactorEnabled) {
    throw new Error("Для desktop входа пока отключи 2FA в кабинете на сайте.");
  }

  const session = await createSession({
    userId: user.id,
    name: normalizeText(input.deviceName || "Astra Desktop", 120) || "Astra Desktop",
    os: guessOs(input.userAgent || "Windows") || "Windows",
    ip: normalizeText(input.ip || "127.0.0.1", 64) || "127.0.0.1",
  });

  const device = await registerDesktopDevice({
    userId: user.id,
    sessionToken: session.token,
    deviceName: input.deviceName,
    deviceFingerprint: input.deviceFingerprint,
    appVersion: input.appVersion,
    platform: "Windows",
  });

  return {
    token: session.token,
    user: publicUser(user),
    session,
    license: getDesktopLicense(user),
    device: {
      id: device.id,
      deviceName: device.deviceName,
      deviceFingerprint: device.deviceFingerprint,
      platform: device.platform,
      appVersion: device.appVersion,
      lastSeenAt: toIso(device.lastSeenAt),
      createdAt: toIso(device.createdAt),
    },
  };
}
