import { desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { auditLogs } from "./schema";

export type AuditEvent = {
  id: string;
  action: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

function randomId(size = 16) {
  return randomBytes(size).toString("hex");
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export async function writeAuditEvent(input: {
  userId?: string | null;
  action: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  await db.insert(auditLogs).values({
    id: randomId(),
    userId: input.userId ?? null,
    action: input.action,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: new Date(),
  });
}

export async function getRecentAuditEventsForUser(userId: string, limit = 8): Promise<AuditEvent[]> {
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
    createdAt: toIso(row.createdAt),
  }));
}

export function formatAuditAction(action: string) {
  const map: Record<string, string> = {
    login_success: "Успешный вход",
    login_failed: "Неудачный вход",
    login_2fa_challenge: "Запрошен код 2FA",
    login_2fa_success: "Вход с 2FA",
    login_2fa_failed: "Ошибка 2FA",
    password_changed: "Смена пароля",
    password_reset_requested: "Запрошен сброс пароля",
    password_reset_completed: "Пароль сброшен",
    email_change_started: "Запущена смена email",
    email_verification_resent: "Повторная отправка письма",
    logout_other_sessions: "Завершены другие сессии",
    two_factor_enabled: "2FA включена",
    two_factor_disabled: "2FA отключена",
    recovery_codes_rotated: "Обновлены recovery codes",
  };
  return map[action] || action;
}
