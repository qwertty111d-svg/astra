import type { APIRoute } from "astro";
import {
  getCurrentAuthOrNull,
  logAudit,
  logoutOtherSessions,
  updateUser,
} from "../../../lib/server/auth.js";
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIp,
  resetRateLimit,
} from "../../../lib/server/rate-limit.js";
import {
  consumeRecoveryCode,
  verifyTwoFactorCode,
} from "../../../lib/server/two-factor.js";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = await getCurrentAuthOrNull(request);
    if (!auth?.user || !auth?.session) {
      return json({ ok: false, error: "Требуется вход в аккаунт." }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const twoFactorCode = String(body.twoFactorCode ?? "").trim();
    const recoveryCode = String(body.recoveryCode ?? "").trim();

    const ip = getClientIp(request);
    const rate = await checkRateLimit(
      resetRateLimit,
      `logout-others:${ip}:${auth.user.id}`
    );

    if (!rate.success) {
      return createRateLimitResponse(
        "Слишком много попыток завершения сессий. Подожди немного и попробуй снова."
      );
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

    if (nextRecoveryCodes !== auth.user.twoFactorRecoveryCodes) {
      await updateUser({ ...auth.user, twoFactorRecoveryCodes: nextRecoveryCodes });
    }

    const removedCount = await logoutOtherSessions(auth.user.id, auth.session.token);

    await logAudit({
      userId: auth.user.id,
      action: "other_sessions_revoked",
      ip,
      userAgent: request.headers.get("user-agent"),
    });

    return json({
      ok: true,
      removedCount,
      message:
        removedCount > 0
          ? `Завершено сессий: ${removedCount}.`
          : "Других активных сессий не найдено.",
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Ошибка сервера.",
      },
      400
    );
  }
};
