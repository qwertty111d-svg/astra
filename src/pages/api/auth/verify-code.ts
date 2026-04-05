export const prerender = false;

import type { APIRoute } from "astro";
import {
  COOKIE_NAME,
  createSession,
  guessOs,
  publicUser,
  verifyRegistrationCodeAndCreateUser,
} from "../../../lib/server/auth.js";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, code } = await request.json();

    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanCode = String(code || "").trim();

    if (!cleanEmail || !cleanCode) {
      return json({ ok: false, error: "Введи email и код." }, 400);
    }

    const user = await verifyRegistrationCodeAndCreateUser({
      email: cleanEmail,
      code: cleanCode,
    });

    const userAgent = request.headers.get("user-agent") ?? "";
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      "unknown";

    const session = await createSession({
      userId: user.id,
      name: "Browser session",
      os: guessOs(userAgent),
      ip,
    });

    cookies.set(COOKIE_NAME, session.token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: import.meta.env.PROD,
      maxAge: 60 * 60 * 24 * 30,
    });

    return json({ ok: true, user: publicUser(user), redirectTo: "/account" });
  } catch (err) {
    return json(
      { ok: false, error: err instanceof Error ? err.message : "Ошибка сервера." },
      400
    );
  }
};
