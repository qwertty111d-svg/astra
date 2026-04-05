export const prerender = false;

import type { APIRoute } from "astro";
import { desktopJson, desktopOptions } from "../../../lib/server/desktop-api.js";
import { getDesktopAuth, getDesktopLicense } from "../../../lib/server/desktop.js";

export const GET: APIRoute = async ({ request }) => {
  const auth = await getDesktopAuth(request);
  if (!auth?.user) {
    return desktopJson({ ok: false, error: "Нужна desktop-сессия." }, 401);
  }

  return desktopJson({
    ok: true,
    license: getDesktopLicense(auth.user),
    user: {
      id: auth.user.id,
      email: auth.user.email,
      plan: auth.user.plan,
      subscriptionEndsAt: auth.user.subscriptionEndsAt,
    },
  });
};

export const OPTIONS: APIRoute = async () => desktopOptions();
