import type { APIRoute } from "astro";
import { getCurrentAuthOrNull, logAudit, updateUser, verifyPassword } from "../../../../lib/server/auth.js";
import {
  consumeRecoveryCode,
  verifyTwoFactorCode,
} from "../../../../lib/server/two-factor.js";
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIp,
  twoFactorRateLimit,
} from "../../../../lib/server/rate-limit.js";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = await getCurrentAuthOrNull(request);

    if (!auth?.user) {
      return json({ ok: false, error: "Требуется вход в аккаунт." }, 401);
    }

    if (!auth.user.twoFactorEnabled || !auth.user.twoFactorSecret) {
      return json({ ok: false, error: "2FA уже отключена." }, 400);
    }

    const { currentPassword, code, recoveryCode } = await request.json().catch(() => ({}));
    const password = String(currentPassword || "");
    const cleanCode = String(code || "").trim();
    const cleanRecovery = String(recoveryCode || "").trim();

    if (!password) {
      return json({ ok: false, error: "Введи текущий пароль." }, 400);
    }

    if (!verifyPassword(password, auth.user.passwordHash)) {
      return json({ ok: false, error: "Неверный текущий пароль." }, 400);
    }

    if (!cleanCode && !cleanRecovery) {
      return json({ ok: false, error: "Введи код 2FA или recovery code." }, 400);
    }

    const ip = getClientIp(request);
    const rate = await checkRateLimit(twoFactorRateLimit, `2fa-disable:${ip}:${auth.user.id}`);
    if (!rate.success) {
      return createRateLimitResponse("Слишком много попыток отключения 2FA. Подожди немного и попробуй снова.");
    }

    let nextRecoveryCodes = auth.user.twoFactorRecoveryCodes ?? null;

    if (cleanRecovery) {
      const result = consumeRecoveryCode(auth.user.twoFactorRecoveryCodes, cleanRecovery);
      if (!result.ok) {
        return json({ ok: false, error: "Неверный recovery code." }, 400);
      }
      nextRecoveryCodes = result.nextStorageValue;
    } else {
      const valid = verifyTwoFactorCode({
        email: auth.user.email,
        encryptedSecret: auth.user.twoFactorSecret,
        code: cleanCode,
      });
      if (!valid) {
        return json({ ok: false, error: "Неверный код 2FA." }, 400);
      }
    }

    await updateUser({
      ...auth.user,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      pendingTwoFactorSecret: null,
      twoFactorRecoveryCodes: null,
    });

    await logAudit({
      userId: auth.user.id,
      action: cleanRecovery ? "2fa_disabled_by_recovery" : "2fa_disabled",
      ip,
      userAgent: request.headers.get("user-agent"),
    });

    return json({ ok: true, message: "2FA отключена." });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Ошибка сервера." },
      400
    );
  }
};
