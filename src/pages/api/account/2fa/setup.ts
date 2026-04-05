import type { APIRoute } from "astro";
import { getCurrentAuthOrNull, updateUser } from "../../../../lib/server/auth.js";
import { generateTwoFactorSetup } from "../../../../lib/server/two-factor.js";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = await getCurrentAuthOrNull(request);

    if (!auth?.user) {
      return json({ ok: false, error: "Требуется вход в аккаунт." }, 401);
    }

    const setup = generateTwoFactorSetup(auth.user.email);

    await updateUser({
      ...auth.user,
      pendingTwoFactorSecret: setup.encryptedSecret,
    });

    return json({
      ok: true,
      secret: setup.secret,
      otpauthUrl: setup.otpauthUrl,
      message: "Ключ 2FA создан.",
    });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Ошибка сервера." },
      400
    );
  }
};
