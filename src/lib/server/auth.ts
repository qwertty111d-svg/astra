import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, ne } from "drizzle-orm";
import { db } from "./db";
import { auditLogs, sessions, users, verificationCodes } from "./schema";

export const COOKIE_NAME = "session_token";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  pendingEmail: string | null;
  pendingEmailVerificationToken: string | null;
  pendingEmailVerificationExpiresAt?: string | null;
  passwordHash: string;
  passwordResetToken?: string | null;
  passwordResetExpiresAt?: string | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  pendingTwoFactorSecret: string | null;
  twoFactorRecoveryCodes: string | null;
  plan: string | null;
  subscriptionEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionRecord = {
  token: string;
  userId: string;
  name: string;
  os: string;
  ip: string;
  createdAt: string;
  lastSeenAt: string;
};

export type VerificationCodeRecord = {
  id?: string;
  email: string;
  name: string;
  passwordHash: string;
  code: string;
  expiresAt: string;
  createdAt: string;
};

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function normalizeEmail(email: unknown) {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

function mapUser(row: any): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: Boolean(row.emailVerified),
    pendingEmail: row.pendingEmail ?? null,
    pendingEmailVerificationToken: row.pendingEmailVerificationToken ?? null,
    pendingEmailVerificationExpiresAt: toIso(row.pendingEmailVerificationExpiresAt),
    passwordHash: row.passwordHash,
    passwordResetToken: row.passwordResetToken ?? null,
    passwordResetExpiresAt: toIso(row.passwordResetExpiresAt),
    twoFactorEnabled: Boolean(row.twoFactorEnabled),
    twoFactorSecret: row.twoFactorSecret ?? null,
    pendingTwoFactorSecret: row.pendingTwoFactorSecret ?? null,
    twoFactorRecoveryCodes: row.twoFactorRecoveryCodes ?? null,
    plan: row.plan ?? null,
    subscriptionEndsAt: toIso(row.subscriptionEndsAt),
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
  };
}

function mapSession(row: any): SessionRecord {
  return {
    token: row.token,
    userId: row.userId,
    name: row.name,
    os: row.os,
    ip: row.ip,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    lastSeenAt: toIso(row.lastSeenAt) ?? new Date().toISOString(),
  };
}

function mapCode(row: any): VerificationCodeRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    code: row.code,
    expiresAt: toIso(row.expiresAt) ?? new Date().toISOString(),
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  };
}

export async function getUsers() {
  const rows = await db.select().from(users);
  return rows.map(mapUser);
}

export async function saveUsers(items: UserRecord[]) {
  await db.transaction(async (tx) => {
    for (const user of items) {
      await tx
        .insert(users)
        .values({
          id: user.id,
          name: user.name,
          email: normalizeEmail(user.email),
          emailVerified: user.emailVerified,
          pendingEmail: user.pendingEmail ?? null,
          pendingEmailVerificationToken: user.pendingEmailVerificationToken ?? null,
          pendingEmailVerificationExpiresAt: toDate(user.pendingEmailVerificationExpiresAt ?? null),
          passwordHash: user.passwordHash,
          passwordResetToken: user.passwordResetToken ?? null,
          passwordResetExpiresAt: toDate(user.passwordResetExpiresAt ?? null),
          twoFactorEnabled: user.twoFactorEnabled,
          twoFactorSecret: user.twoFactorSecret ?? null,
          pendingTwoFactorSecret: user.pendingTwoFactorSecret ?? null,
          twoFactorRecoveryCodes: user.twoFactorRecoveryCodes ?? null,
          plan: user.plan ?? null,
          subscriptionEndsAt: toDate(user.subscriptionEndsAt ?? null),
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            name: user.name,
            email: normalizeEmail(user.email),
            emailVerified: user.emailVerified,
            pendingEmail: user.pendingEmail ?? null,
            pendingEmailVerificationToken: user.pendingEmailVerificationToken ?? null,
            pendingEmailVerificationExpiresAt: toDate(user.pendingEmailVerificationExpiresAt ?? null),
            passwordHash: user.passwordHash,
            passwordResetToken: user.passwordResetToken ?? null,
            passwordResetExpiresAt: toDate(user.passwordResetExpiresAt ?? null),
            twoFactorEnabled: user.twoFactorEnabled,
            twoFactorSecret: user.twoFactorSecret ?? null,
            pendingTwoFactorSecret: user.pendingTwoFactorSecret ?? null,
            twoFactorRecoveryCodes: user.twoFactorRecoveryCodes ?? null,
            plan: user.plan ?? null,
            subscriptionEndsAt: toDate(user.subscriptionEndsAt ?? null),
            updatedAt: new Date(user.updatedAt),
          },
        });
    }
  });

  return items;
}

export async function getSessions() {
  const rows = await db.select().from(sessions);
  return rows.map(mapSession);
}

export async function saveSessions(items: SessionRecord[]) {
  await db.transaction(async (tx) => {
    for (const session of items) {
      await tx
        .insert(sessions)
        .values({
          token: session.token,
          userId: session.userId,
          name: session.name,
          os: session.os,
          ip: session.ip,
          createdAt: new Date(session.createdAt),
          lastSeenAt: new Date(session.lastSeenAt),
        })
        .onConflictDoUpdate({
          target: sessions.token,
          set: {
            userId: session.userId,
            name: session.name,
            os: session.os,
            ip: session.ip,
            lastSeenAt: new Date(session.lastSeenAt),
          },
        });
    }
  });

  return items;
}

export async function getVerificationCodes() {
  const rows = await db.select().from(verificationCodes);
  return rows.map(mapCode);
}

export async function saveVerificationCodes(items: VerificationCodeRecord[]) {
  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx
        .insert(verificationCodes)
        .values({
          id: item.id ?? randomId(16),
          email: normalizeEmail(item.email),
          name: item.name,
          passwordHash: item.passwordHash,
          code: item.code,
          expiresAt: new Date(item.expiresAt),
          createdAt: new Date(item.createdAt),
        })
        .onConflictDoUpdate({
          target: verificationCodes.id,
          set: {
            email: normalizeEmail(item.email),
            name: item.name,
            passwordHash: item.passwordHash,
            code: item.code,
            expiresAt: new Date(item.expiresAt),
            createdAt: new Date(item.createdAt),
          },
        });
    }
  });

  return items;
}

export async function findUserByEmail(email: string) {
  const cleanEmail = normalizeEmail(email);
  const rows = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getUserById(id: string) {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getUserByPasswordResetToken(token: string) {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.passwordResetToken, token), gt(users.passwordResetExpiresAt, new Date())))
    .limit(1);

  return rows[0] ? mapUser(rows[0]) : null;
}

export async function updateUser(updatedUser: UserRecord) {
  const rows = await db
    .update(users)
    .set({
      name: updatedUser.name,
      email: normalizeEmail(updatedUser.email),
      emailVerified: updatedUser.emailVerified,
      pendingEmail: updatedUser.pendingEmail ?? null,
      pendingEmailVerificationToken: updatedUser.pendingEmailVerificationToken ?? null,
      pendingEmailVerificationExpiresAt: toDate(updatedUser.pendingEmailVerificationExpiresAt ?? null),
      passwordHash: updatedUser.passwordHash,
      passwordResetToken: updatedUser.passwordResetToken ?? null,
      passwordResetExpiresAt: toDate(updatedUser.passwordResetExpiresAt ?? null),
      twoFactorEnabled: updatedUser.twoFactorEnabled,
      twoFactorSecret: updatedUser.twoFactorSecret ?? null,
      pendingTwoFactorSecret: updatedUser.pendingTwoFactorSecret ?? null,
      twoFactorRecoveryCodes: updatedUser.twoFactorRecoveryCodes ?? null,
      plan: updatedUser.plan ?? null,
      subscriptionEndsAt: toDate(updatedUser.subscriptionEndsAt ?? null),
      updatedAt: new Date(),
    })
    .where(eq(users.id, updatedUser.id))
    .returning();

  if (!rows[0]) {
    throw new Error("Пользователь не найден");
  }

  return mapUser(rows[0]);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  if (!storedHash?.startsWith("scrypt$")) return false;

  const [, salt, originalHash] = storedHash.split("$");
  if (!salt || !originalHash) return false;

  const checkHash = scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(originalHash, "hex");
  const b = Buffer.from(checkHash, "hex");

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function randomId(size = 24) {
  return randomBytes(size).toString("hex");
}

export function randomToken(size = 32) {
  return randomId(size);
}

function getCookieValue(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";
  const cookies = raw.split(";");

  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

export function guessOs(userAgent: string) {
  const ua = userAgent.toLowerCase();

  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os")) return "macOS";
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "iOS";
  if (ua.includes("linux")) return "Linux";

  return "Unknown OS";
}

export async function createSession(input: {
  userId: string;
  name?: string;
  os?: string;
  ip?: string;
}) {
  const now = new Date();

  const rows = await db
    .insert(sessions)
    .values({
      token: randomId(32),
      userId: input.userId,
      name: input.name || "Browser session",
      os: input.os || "Unknown OS",
      ip: input.ip || "127.0.0.1",
      createdAt: now,
      lastSeenAt: now,
    })
    .returning();

  return mapSession(rows[0]);
}

export async function destroySession(token: string) {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function destroyOtherSessions(userId: string, currentToken: string) {
  const existing = await db.select().from(sessions).where(eq(sessions.userId, userId));
  const removedCount = existing.filter((session) => session.token !== currentToken).length;

  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.token, currentToken)));

  return removedCount;
}

export async function destroyAllSessionsForUser(userId: string) {
  const existing = await db.select().from(sessions).where(eq(sessions.userId, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  return existing.length;
}

export async function logoutOtherSessions(userId: string, currentToken: string) {
  return destroyOtherSessions(userId, currentToken);
}

export async function touchSession(token: string) {
  const rows = await db
    .update(sessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(sessions.token, token))
    .returning();

  return rows[0] ? mapSession(rows[0]) : null;
}

export async function getSessionsForUser(userId: string) {
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.lastSeenAt));

  return rows.map(mapSession);
}

export async function getCurrentAuth(request: Request) {
  const token = getCookieValue(request, COOKIE_NAME);
  if (!token) return null;

  const sessionRows = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1);
  const session = sessionRows[0];
  if (!session) return null;

  const userRows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  const user = userRows[0];
  if (!user) return null;

  return { token, session: mapSession(session), user: mapUser(user) };
}

export async function getCurrentAuthOrNull(request: Request) {
  return getCurrentAuth(request);
}

export function getCurrentToken(request: Request) {
  return getCookieValue(request, COOKIE_NAME);
}

export function publicUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    pendingEmail: user.pendingEmail ?? null,
    pendingEmailVerificationExpiresAt: user.pendingEmailVerificationExpiresAt ?? null,
    plan: user.plan,
    subscriptionEndsAt: user.subscriptionEndsAt,
  };
}

export async function createRegistrationCode(input: {
  name: string;
  email: string;
  password: string;
}) {
  const name = String(input.name ?? "").trim();
  const email = normalizeEmail(input.email);
  const password = String(input.password ?? "");

  if (!name || !email || !password) {
    throw new Error("Заполни все поля.");
  }

  if (name.length < 2) {
    throw new Error("Имя должно быть не короче 2 символов.");
  }

  if (password.length < 8) {
    throw new Error("Пароль должен быть не короче 8 символов.");
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new Error("Аккаунт с таким email уже существует. Попробуй войти.");
  }

  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.delete(verificationCodes).where(eq(verificationCodes.email, email));

  await db.insert(verificationCodes).values({
    id: randomId(16),
    email,
    name,
    passwordHash: hashPassword(password),
    code,
    expiresAt,
    createdAt: new Date(),
  });

  return { code, email };
}

export async function removeRegistrationCode(email: string) {
  const cleanEmail = normalizeEmail(email);
  await db.delete(verificationCodes).where(eq(verificationCodes.email, cleanEmail));
}

export async function verifyRegistrationCodeAndCreateUser(input: {
  email: string;
  code: string;
}) {
  const email = normalizeEmail(input.email);
  const code = String(input.code ?? "").trim();

  const rows = await db
    .select()
    .from(verificationCodes)
    .where(eq(verificationCodes.email, email))
    .orderBy(desc(verificationCodes.createdAt))
    .limit(1);

  const pending = rows[0] ? mapCode(rows[0]) : null;

  if (!pending) {
    throw new Error("Код не найден. Сначала запроси его заново.");
  }

  if (new Date(pending.expiresAt).getTime() < Date.now()) {
    await removeRegistrationCode(email);
    throw new Error("Код истёк. Запроси новый.");
  }

  if (pending.code !== code) {
    throw new Error("Неверный код.");
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    await removeRegistrationCode(email);
    throw new Error("Аккаунт с таким email уже существует. Попробуй войти.");
  }

  const now = new Date();

  const created = await db
    .insert(users)
    .values({
      id: randomId(16),
      name: pending.name,
      email,
      emailVerified: true,
      pendingEmail: null,
      pendingEmailVerificationToken: null,
      pendingEmailVerificationExpiresAt: null,
      passwordHash: pending.passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      pendingTwoFactorSecret: null,
      twoFactorRecoveryCodes: null,
      plan: null,
      subscriptionEndsAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await removeRegistrationCode(email);

  return mapUser(created[0]);
}

export async function createEmailChangeRequest(user: UserRecord, newEmail: string) {
  const cleanEmail = normalizeEmail(newEmail);

  if (!cleanEmail) {
    throw new Error("Введи новый email.");
  }

  if (cleanEmail === normalizeEmail(user.email)) {
    throw new Error("Это уже текущий email.");
  }

  const existingUser = await findUserByEmail(cleanEmail);
  if (existingUser && existingUser.id !== user.id) {
    throw new Error("Этот email уже занят.");
  }

  const verificationToken = randomToken(32);
  const verificationExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const updated = await updateUser({
    ...user,
    pendingEmail: cleanEmail,
    pendingEmailVerificationToken: verificationToken,
    pendingEmailVerificationExpiresAt: verificationExpiresAt,
  });

  return {
    user: updated,
    token: verificationToken,
    expiresAt: verificationExpiresAt,
  };
}

export async function createPasswordResetRequest(email: string) {
  const cleanEmail = normalizeEmail(email);
  const user = await findUserByEmail(cleanEmail);

  if (!user) {
    return null;
  }

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await updateUser({
    ...user,
    passwordResetToken: token,
    passwordResetExpiresAt: expiresAt,
  });

  return { user, token, expiresAt };
}

export async function resetPasswordByToken(input: {
  token: string;
  newPassword: string;
}) {
  const token = String(input.token ?? "").trim();
  const newPassword = String(input.newPassword ?? "");

  if (!token) {
    throw new Error("Токен сброса не найден.");
  }

  if (newPassword.length < 8) {
    throw new Error("Новый пароль должен быть минимум 8 символов.");
  }

  const user = await getUserByPasswordResetToken(token);

  if (!user) {
    throw new Error("Ссылка недействительна или уже истекла.");
  }

  const updatedUser = await updateUser({
    ...user,
    passwordHash: hashPassword(newPassword),
    passwordResetToken: null,
    passwordResetExpiresAt: null,
  });

  await destroyAllSessionsForUser(updatedUser.id);

  return updatedUser;
}


export async function getRecentAuditLogs(userId: string, limit = 8) {
  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    ip: row.ip ?? null,
    userAgent: row.userAgent ?? null,
    createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
  }));
}

export async function logAudit(input: {
  userId?: string | null;
  action: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  await db.insert(auditLogs).values({
    id: randomId(16),
    userId: input.userId ?? null,
    action: input.action,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: new Date(),
  });
}
