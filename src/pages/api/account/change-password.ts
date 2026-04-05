import type { APIRoute } from "astro";
import {
  getCurrentAuthOrNull,
  hashPassword,
  logAudit,
  logoutOtherSessions,
  updateUser,
  verifyPassword,
} from "../../../lib/server/auth.js";
import {
  consumeRecoveryCode,
  verifyTwoFactorCode,
} from "../../../lib/server/two-factor.js";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = await getCurrentAuthOrNull(request);
    if (!auth) {
      return json({ ok: false, error: "Не авторизован" }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    const logoutOthers = Boolean(body.logoutOthers ?? true);
    const twoFactorCode = String(body.twoFactorCode ?? "").trim();
    const recoveryCode = String(body.recoveryCode ?? "").trim();

    if (!currentPassword || !newPassword) {
      return json({ ok: false, error: "Заполни все поля" }, 400);
    }

    if (newPassword.length < 8) {
      return json({ ok: false, error: "Новый пароль должен быть минимум 8 символов" }, 400);
    }

    if (!verifyPassword(currentPassword, auth.user.passwordHash)) {
      return json({ ok: false, error: "Текущий пароль неверный" }, 400);
    }

    let nextRecoveryCodes = auth.user.twoFactorRecoveryCodes ?? null;

    if (auth.user.twoFactorEnabled) {
      if (!twoFactorCode && !recoveryCode) {
        return json({ ok: false, error: "Подтверди действие кодом 2FA или recovery code." }, 400);
      }

      if (recoveryCode) {
        const result = consumeRecoveryCode(auth.user.twoFactorRecoveryCodes, recoveryCode);
        if (!result.ok) {
          return json({ ok: false, error: "Неверный recovery code." }, 400);
        }
        nextRecoveryCodes = result.nextStorageValue;
      } else if (!auth.user.twoFactorSecret || !verifyTwoFactorCode({
        email: auth.user.email,
        encryptedSecret: auth.user.twoFactorSecret,
        code: twoFactorCode,
      })) {
        return json({ ok: false, error: "Неверный код 2FA." }, 400);
      }
    }

    await updateUser({
      ...auth.user,
      passwordHash: hashPassword(newPassword),
      twoFactorRecoveryCodes: nextRecoveryCodes,
    });

    if (logoutOthers) {
      await logoutOtherSessions(auth.user.id, auth.token);
    }

    await logAudit({
      userId: auth.user.id,
      action: "password_changed",
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || null,
      userAgent: request.headers.get("user-agent"),
    });

    return json({
      ok: true,
      message: "Пароль обновлён",
    });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Ошибка сервера." },
      400
    );
  }
};
