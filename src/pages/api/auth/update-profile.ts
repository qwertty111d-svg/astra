export const prerender = false;

import type { APIRoute } from "astro";
import {
  getCurrentAuthOrNull,
  publicUser,
  updateUser,
} from "../../../lib/server/auth.js";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = await getCurrentAuthOrNull(request);

    if (!auth) {
      return json({ ok: false, error: "Не авторизован." }, 401);
    }

    const { name } = await request.json();
    const cleanName = String(name || "").trim();

    if (!cleanName || cleanName.length < 2) {
      return json({ ok: false, error: "Имя должно быть не короче 2 символов." }, 400);
    }

    const user = await updateUser({
      ...auth.user,
      name: cleanName,
    });

    return json({ ok: true, user: publicUser(user) });
  } catch (err) {
    return json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Ошибка сервера.",
      },
      400
    );
  }
};