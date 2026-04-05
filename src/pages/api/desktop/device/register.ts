export const prerender = false;

import type { APIRoute } from "astro";
import { desktopJson, desktopOptions } from "../../../../lib/server/desktop-api.js";
import { getDesktopAuth, registerDesktopDevice } from "../../../../lib/server/desktop.js";

export const POST: APIRoute = async ({ request }) => {
  const auth = await getDesktopAuth(request);
  if (!auth?.user || !auth?.token) {
    return desktopJson({ ok: false, error: "Нужна desktop-сессия." }, 401);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const deviceName = String(body.deviceName ?? "Astra Desktop").trim();
    const deviceFingerprint = String(body.deviceFingerprint ?? "").trim();
    const platform = String(body.platform ?? "Windows").trim();
    const appVersion = String(body.appVersion ?? "").trim();

    const device = await registerDesktopDevice({
      userId: auth.user.id,
      sessionToken: auth.token,
      deviceName,
      deviceFingerprint,
      platform,
      appVersion,
    });

    return desktopJson({
      ok: true,
      device: {
        id: device.id,
        deviceName: device.deviceName,
        deviceFingerprint: device.deviceFingerprint,
        platform: device.platform,
        appVersion: device.appVersion,
        lastSeenAt: device.lastSeenAt,
        createdAt: device.createdAt,
      },
    });
  } catch (error) {
    console.error("[DESKTOP DEVICE REGISTER ERROR]", error);
    return desktopJson({ ok: false, error: error instanceof Error ? error.message : "Не удалось зарегистрировать устройство." }, 500);
  }
};

export const OPTIONS: APIRoute = async () => desktopOptions();
