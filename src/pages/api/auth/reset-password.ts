import type { APIRoute } from "astro";
import { getUserByPasswordResetToken, resetPasswordByToken } from "../../../lib/server/auth.js";
import { writeAuditEvent } from "../../../lib/server/audit.js";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();
    const newPassword = String(body.newPassword ?? "");
    const beforeUser = token ? await getUserByPasswordResetToken(token) : null;

    await resetPasswordByToken({ token, newPassword });

    if (beforeUser) {
      await writeAuditEvent({
        userId: beforeUser.id,
        action: "password_reset_completed",
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown",
        userAgent: request.headers.get("user-agent"),
      });
    }

    return json({
      ok: true,
      message: "Пароль обновлён. Войди заново.",
      redirectTo: "/login?reset=success",
    });
  } catch (err) {
    return json(
      { ok: false, error: err instanceof Error ? err.message : "Ошибка сервера." },
      400
    );
  }
};