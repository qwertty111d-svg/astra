import type { APIRoute } from "astro";
import {
  COOKIE_NAME,
  createSession,
  getUserById,
  guessOs,
  logAudit,
  updateUser,
} from "../../../lib/server/auth.js";
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIp,
  twoFactorRateLimit,
} from "../../../lib/server/rate-limit.js";
import {
  PRE_2FA_COOKIE,
  consumeRecoveryCode,
  readPreTwoFactorToken,
  verifyTwoFactorCode,
} from "../../../lib/server/two-factor.js";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code ?? "").trim();
    const recoveryCode = String(body.recoveryCode ?? "").trim();

    if (!code && !recoveryCode) {
      return json({ ok: false, error: "Введи код из приложения или recovery code." }, 400);
    }

    const preToken = cookies.get(PRE_2FA_COOKIE)?.value || "";
    const payload = readPreTwoFactorToken(preToken);

    if (!payload) {
      return json({ ok: false, error: "Сессия 2FA истекла. Войди заново." }, 401);
    }

    const ip = getClientIp(request);
    const rate = await checkRateLimit(
      twoFactorRateLimit,
      `2fa-login:${ip}:${payload.userId}`
    );

    if (!rate.success) {
      return createRateLimitResponse(
        "Слишком много попыток 2FA. Подожди немного и попробуй снова."
      );
    }

    const user = await getUserById(payload.userId);

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      cookies.delete(PRE_2FA_COOKIE, { path: "/" });
      return json({ ok: false, error: "2FA недоступна. Войди заново." }, 400);
    }

    let usedRecovery = false;

    if (recoveryCode) {
      const result = consumeRecoveryCode(user.twoFactorRecoveryCodes, recoveryCode);
      if (!result.ok) {
        return json({ ok: false, error: "Неверный recovery code." }, 400);
      }
      await updateUser({ ...user, twoFactorRecoveryCodes: result.nextStorageValue });
      usedRecovery = true;
    } else {
      const valid = verifyTwoFactorCode({
        email: user.email,
        encryptedSecret: user.twoFactorSecret,
        code,
      });

      if (!valid) {
        await logAudit({
          userId: user.id,
          action: "2fa_login_failed",
          ip,
          userAgent: request.headers.get("user-agent"),
        });
        return json({ ok: false, error: "Неверный код 2FA." }, 400);
      }
    }

    const userAgent = request.headers.get("user-agent") ?? "";
    const session = await createSession({
      userId: user.id,
      name: "Browser session",
      os: guessOs(userAgent),
      ip: ip || "127.0.0.1",
    });

    cookies.set(COOKIE_NAME, session.token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: import.meta.env.PROD,
      maxAge: 60 * 60 * 24 * 30,
    });

    cookies.delete(PRE_2FA_COOKIE, { path: "/" });

    await logAudit({
      userId: user.id,
      action: usedRecovery ? "login_success_recovery_code" : "login_success_2fa",
      ip,
      userAgent,
    });

    return json({
      ok: true,
      redirectTo: payload.next,
      message: usedRecovery
        ? "Вход выполнен по recovery code."
        : "2FA подтверждена.",
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Ошибка сервера при 2FA.",
      },
      500
    );
  }
};
