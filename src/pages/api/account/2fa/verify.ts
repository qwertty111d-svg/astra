import type { APIRoute } from "astro";
import { getCurrentAuthOrNull, logAudit, updateUser } from "../../../../lib/server/auth.js";
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

    const { code } = await request.json().catch(() => ({}));
    const cleanCode = String(code || "").trim();

    if (!cleanCode) {
      return json({ ok: false, error: "Введи 6-значный код." }, 400);
    }

    if (!auth.user.pendingTwoFactorSecret) {
      return json({ ok: false, error: "Сначала создай ключ 2FA." }, 400);
    }

    const ip = getClientIp(request);
    const rate = await checkRateLimit(twoFactorRateLimit, `2fa-verify:${ip}:${auth.user.id}`);

    if (!rate.success) {
      return createRateLimitResponse("Слишком много попыток 2FA. Подожди немного и попробуй снова.");
    }

    const valid = verifyTwoFactorCode({
      email: auth.user.email,
      encryptedSecret: auth.user.pendingTwoFactorSecret,
      code: cleanCode,
    });

    if (!valid) {
      return json({ ok: false, error: "Неверный код 2FA." }, 400);
    }

    const recovery = generateRecoveryCodes();

    await updateUser({
      ...auth.user,
      twoFactorEnabled: true,
      twoFactorSecret: auth.user.pendingTwoFactorSecret,
      pendingTwoFactorSecret: null,
      twoFactorRecoveryCodes: recovery.storageValue,
    });

    await logAudit({
      userId: auth.user.id,
      action: "2fa_enabled",
      ip,
      userAgent: request.headers.get("user-agent"),
    });

    return json({
      ok: true,
      recoveryCodes: recovery.plainCodes,
      recoveryCodesText: packRecoveryCodes(recovery.plainCodes),
      message: "2FA подключена. Сохрани recovery codes.",
    });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Ошибка сервера." },
      400
    );
  }
};
