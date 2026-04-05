import type { APIRoute } from "astro";
import { Resend } from "resend";
import { createPasswordResetRequest } from "../../../lib/server/auth.js";
import { writeAuditEvent } from "../../../lib/server/audit.js";
import { getClientIp, resetRateLimit } from "../../../lib/server/rate-limit.js";
import { readEnv } from "../../../lib/server/env.js";

export const prerender = false;

const resendApiKey = readEnv("RESEND_API_KEY");
const emailFrom = readEnv("EMAIL_FROM");
const resend = resendApiKey ? new Resend(resendApiKey) : null;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const ip = getClientIp(request);
  const { success } = await resetRateLimit.limit(`reset:${ip}`);

  if (!success) {
    return json(
      { ok: false, error: "Слишком много попыток. Попробуйте позже." },
      429
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!email) {
      return json({ ok: false, error: "Введи email." }, 400);
    }

    const result = await createPasswordResetRequest(email);

    if (!result) {
      return json({
        ok: true,
        message:
          "Если аккаунт с таким email существует, ссылка для сброса уже подготовлена.",
      });
    }

    const origin = new URL(request.url).origin;
    const resetUrl = `${origin}/reset-password?token=${result.token}`;

    if (!resend || !emailFrom) {
      if (import.meta.env.DEV) {
        console.log(`[ASTRA RESET LINK] ${email}: ${resetUrl}`);
        return json({
          ok: true,
          message:
            "Если аккаунт с таким email существует, ссылка для сброса уже подготовлена.",
        });
      }

      return json(
        { ok: false, error: "Сервис отправки писем недоступен." },
        503
      );
    }

    const { error } = await resend.emails.send({
      from: `Astra <${emailFrom}>`,
      to: [email],
      subject: "Сброс пароля Astra",
      html: `
        <div style="font-family:Arial,sans-serif;padding:24px;background:#0b0b10;color:#fff">
          <h2 style="margin:0 0 16px">Сброс пароля Astra</h2>
          <p style="margin:0 0 12px;color:#cfcfe7">
            Нажми кнопку ниже, чтобы задать новый пароль.
          </p>
          <p style="margin:18px 0;">
            <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#8b5cf6;color:#fff;text-decoration:none;font-weight:700;">
              Сбросить пароль
            </a>
          </p>
          <p style="margin:0;color:#9fa0b3">Ссылка действует 1 час.</p>
        </div>
      `,
    });

    if (error) {
      return json(
        { ok: false, error: error.message || "Не удалось отправить письмо." },
        500
      );
    }

    await writeAuditEvent({
      userId: result.user.id,
      action: "password_reset_requested",
      ip,
      userAgent: request.headers.get("user-agent"),
    });

    return json({
      ok: true,
      message:
        "Если аккаунт с таким email существует, письмо для сброса отправлено.",
    });
  } catch (err) {
    return json(
      { ok: false, error: err instanceof Error ? err.message : "Ошибка сервера." },
      400
    );
  }
};
