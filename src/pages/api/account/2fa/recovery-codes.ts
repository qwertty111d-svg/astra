import type { APIRoute } from "astro";
import { getCurrentAuthOrNull, logAudit, updateUser, verifyPassword } from "../../../../lib/server/auth.js";
import { generateRecoveryCodes, packRecoveryCodes, verifyTwoFactorCode } from "../../../../lib/server/two-factor.js";
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
      return json({ ok: false, error: "Сначала подключи 2FA." }, 400);
    }

    const { currentPassword, code } = await request.json().catch(() => ({}));
    const password = String(currentPassword || "");
    const cleanCode = String(code || "").trim();

    if (!password || !cleanCode) {
      return json({ ok: false, error: "Введи пароль и код 2FA." }, 400);
    }

    if (!verifyPassword(password, auth.user.passwordHash)) {
      return json({ ok: false, error: "Неверный текущий пароль." }, 400);
    }

    const ip = getClientIp(request);
    const rate = await checkRateLimit(twoFactorRateLimit, `2fa-recovery:${ip}:${auth.user.id}`);
    if (!rate.success) {
      return createRateLimitResponse("Слишком много попыток. Подожди немного и попробуй снова.");
    }

    const valid = verifyTwoFactorCode({
      email: auth.user.email,
      encryptedSecret: auth.user.twoFactorSecret,
      code: cleanCode,
    });

    if (!valid) {
      return json({ ok: false, error: "Неверный код 2FA." }, 400);
    }

    const recovery = generateRecoveryCodes();

    await updateUser({
      ...auth.user,
      twoFactorRecoveryCodes: recovery.storageValue,
    });

    await logAudit({
      userId: auth.user.id,
      action: "2fa_recovery_codes_regenerated",
      ip,
      userAgent: request.headers.get("user-agent"),
    });

    return json({
      ok: true,
      recoveryCodes: recovery.plainCodes,
      recoveryCodesText: packRecoveryCodes(recovery.plainCodes),
      message: "Новый набор recovery codes создан.",
    });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Ошибка сервера." },
      400
    );
  }
};
