export const prerender = false;

import type { APIRoute } from "astro";
import { desktopJson, desktopOptions } from "../../../lib/server/desktop-api.js";
import { destroyDesktopSession, getDesktopAuth } from "../../../lib/server/desktop.js";

export const POST: APIRoute = async ({ request }) => {
  const auth = await getDesktopAuth(request);
  if (!auth?.token) {
    return desktopJson({ ok: false, error: "Сессия не найдена." }, 401);
  }

  await destroyDesktopSession(auth.token);
  return desktopJson({ ok: true });
};

export const OPTIONS: APIRoute = async () => desktopOptions();
