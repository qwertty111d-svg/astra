import type { APIRoute } from "astro";
import { COOKIE_NAME, destroySession, getCurrentToken } from "../../../lib/server/auth.js";

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
  const token = getCurrentToken(request);

  if (token) {
    await destroySession(token);
  }

  cookies.set(COOKIE_NAME, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    expires: new Date(0),
  });

  return json({
    ok: true,
    redirectTo: "/login",
  });
};