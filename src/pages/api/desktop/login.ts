export const prerender = false;

import type { APIRoute } from "astro";
import { loginDesktop } from "../../../lib/server/desktop.js";
import { desktopJson, desktopOptions } from "../../../lib/server/desktop-api.js";
import { getClientIp, loginRateLimit } from "../../../lib/server/rate-limit.js";

export const POST: APIRoute = async ({ request }) => {
  try {
    const ip = getClientIp(request);
    const { success } = await loginRateLimit.limit(`desktop-login:${ip}`);

    if (!success) {
      return desktopJson({ ok: false, error: "Слишком много попыток входа. Попробуйте позже." }, 429);
    }

    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    const deviceName = String(body.deviceName ?? "Astra Desktop").trim();
    const deviceFingerprint = String(body.deviceFingerprint ?? "").trim();
    const appVersion = String(body.appVersion ?? "").trim();

    if (!email || !password) {
      return desktopJson({ ok: false, error: "Нужны email и пароль." }, 400);
    }

    const result = await loginDesktop({
      email,
      password,
      deviceName,
      deviceFingerprint,
      appVersion,
      ip,
      userAgent: request.headers.get("user-agent") ?? "",
    });

    return desktopJson({ ok: true, ...result });
  } catch (error) {
    console.error("[DESKTOP LOGIN ERROR]", error);
    return desktopJson({ ok: false, error: error instanceof Error ? error.message : "Ошибка desktop-входа." }, 500);
  }
};

export const OPTIONS: APIRoute = async () => desktopOptions();
