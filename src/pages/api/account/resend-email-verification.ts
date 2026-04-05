import type { APIRoute } from "astro";
import { Resend } from "resend";
import { getCurrentAuthOrNull } from "../../../lib/server/auth.js";
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIp,
  resendEmailRateLimit,
} from "../../../lib/server/rate-limit.js";
import { writeAuditEvent } from "../../../lib/server/audit.js";

export const prerender = false;

const getEnv = (key: string) => {
  const fromProcess = process.env[key];
  if (fromProcess && fromProcess.trim()) return fromProcess.trim();
  const fromImportMeta = (import.meta as any)?.env?.[key];
  if (typeof fromImportMeta === "string" && fromImportMeta.trim()) {
    return fromImportMeta.trim();
  }
  return "";
};

const resendApiKey = getEnv("RESEND_API_KEY");
const emailFromRaw = getEnv("EMAIL_FROM");
const emailFrom = emailFromRaw.includes("<")
  ? emailFromRaw
  : `Astra <${emailFromRaw}>`;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

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

    if (!auth.user.pendingEmail || !auth.user.pendingEmailVerificationToken) {
      return json({ ok: false, error: "Нет ожидающего подтверждения email." }, 400);
    }

    const expiresAt = auth.user.pendingEmailVerificationExpiresAt
      ? new Date(auth.user.pendingEmailVerificationExpiresAt).getTime()
      : 0;

    if (!expiresAt || expiresAt < Date.now()) {
      return json(
        { ok: false, error: "Срок подтверждения истёк. Запусти смену email заново." },
        400
      );
    }

    const ip = getClientIp(request);
    const rate = await checkRateLimit(
      resendEmailRateLimit,
      `resend-email:${ip}:${auth.user.email}`
    );

    if (!rate.success) {
      return createRateLimitResponse(
        "Слишком много повторных отправок. Подожди немного и попробуй снова."
      );
    }

    const origin = new URL(request.url).origin;
    const verifyUrl = `${origin}/api/account/verify-email?token=${encodeURIComponent(
      auth.user.pendingEmailVerificationToken
    )}`;

    if (!resend || !emailFromRaw) {
      if (import.meta.env.DEV) {
        console.log(`[ASTRA EMAIL RESEND] ${auth.user.pendingEmail}: ${verifyUrl}`);
        return json({
          ok: true,
          message: "Письмо подтверждения подготовлено.",
          previewUrl: verifyUrl,
        });
      }

      return json({ ok: false, error: "Сервис отправки писем недоступен." }, 503);
    }

    const { error } = await resend.emails.send({
      from: emailFrom,
      to: [auth.user.pendingEmail],
      subject: "Повторное подтверждение email в Astra",
      html: `
        <div style="font-family:Arial,sans-serif;padding:24px;background:#0b0b10;color:#fff">
          <h2 style="margin:0 0 16px">Подтверждение email</h2>
          <p style="margin:0 0 12px;color:#cfcfe7">
            Повторная отправка ссылки для подтверждения нового email.
          </p>
          <p style="margin:18px 0;">
            <a href="${verifyUrl}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#8b5cf6;color:#fff;text-decoration:none;font-weight:700;">
              Подтвердить email
            </a>
          </p>
          <p style="margin:0;color:#9fa0b3">Ссылка действует до истечения текущего токена.</p>
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
      userId: auth.user.id,
      action: "email_verification_resent",
      ip,
      userAgent: request.headers.get("user-agent"),
    });

    return json({
      ok: true,
      message: "Письмо подтверждения отправлено ещё раз.",
      ...(import.meta.env.DEV ? { previewUrl: verifyUrl } : {}),
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Ошибка сервера.",
      },
      400
    );
  }
};
