export const prerender = false;

import type { APIRoute } from "astro";
import { touchSession } from "../../../lib/server/auth.js";
import { desktopJson, desktopOptions } from "../../../lib/server/desktop-api.js";
import { getDesktopAuth, getDesktopDevicesForUser, getDesktopLicense } from "../../../lib/server/desktop.js";

export const GET: APIRoute = async ({ request }) => {
  const auth = await getDesktopAuth(request);
  if (!auth?.user) {
    return desktopJson({ ok: false, authenticated: false, error: "Нужна desktop-сессия." }, 401);
  }

  await touchSession(auth.token);
  const devices = await getDesktopDevicesForUser(auth.user.id);

  return desktopJson({
    ok: true,
    authenticated: true,
    token: auth.token,
    user: {
      id: auth.user.id,
      name: auth.user.name,
      email: auth.user.email,
      emailVerified: auth.user.emailVerified,
      plan: auth.user.plan,
      subscriptionEndsAt: auth.user.subscriptionEndsAt,
    },
    license: getDesktopLicense(auth.user),
    devices: devices.map((device) => ({
      id: device.id,
      deviceName: device.deviceName,
      deviceFingerprint: device.deviceFingerprint,
      platform: device.platform,
      appVersion: device.appVersion,
      lastSeenAt: device.lastSeenAt,
      createdAt: device.createdAt,
    })),
  });
};

export const OPTIONS: APIRoute = async () => desktopOptions();
