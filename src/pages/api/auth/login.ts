import type { APIRoute } from "astro";
import {
  COOKIE_NAME,
  createSession,
  findUserByEmail,
  guessOs,
  verifyPassword,
} from "../../../lib/server/auth.js";
import { getClientIp, loginRateLimit } from "../../../lib/server/rate-limit.js";
import { createPreTwoFactorToken, PRE_2FA_COOKIE } from "../../../lib/server/two-factor.js";
import { verifyTurnstileToken } from "../../../lib/server/turnstile.js";

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
    const ip = getClientIp(request);
    const { success } = await loginRateLimit.limit(`login:${ip}`);

    if (!success) {
      return json(
        { ok: false, error: "Слишком много попыток входа. Попробуйте позже." },
        429
      );
    }

    const body = await request.json().catch(() => ({}));

    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    const next = String(body.next ?? "/account");
    const turnstileToken = String(body.turnstileToken ?? "");
    const website = String(body.website ?? "").trim();

    if (website) {
      return json({ ok: false, error: "Запрос отклонён." }, 400);
    }

    const antiBot = await verifyTurnstileToken({ token: turnstileToken, ip });
    if (!antiBot.ok) {
      return json({ ok: false, error: antiBot.error }, 400);
    }

    if (!email || !password) {
      return json({ ok: false, error: "Заполни email и пароль." }, 400);
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return json({ ok: false, error: "Пользователь не найден." }, 404);
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return json({ ok: false, error: "Неверный пароль." }, 400);
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const preToken = createPreTwoFactorToken(user.id, next);

      cookies.set(PRE_2FA_COOKIE, preToken, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: import.meta.env.PROD,
        maxAge: 60 * 5,
      });

      return json({
        ok: true,
        requiresTwoFactor: true,
        redirectTo: "/login-2fa",
      });
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

    return json({
      ok: true,
      redirectTo: next.startsWith("/") ? next : "/account",
    });
  } catch (error) {
    console.error("[LOGIN ERROR]", error);
    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ошибка сервера при входе.",
      },
      500
    );
  }
};
