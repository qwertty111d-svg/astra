import type { APIRoute } from "astro";
import { Resend } from "resend";
import {
  createEmailChangeRequest,
  getCurrentAuthOrNull,
  logAudit,
  updateUser,
  verifyPassword,
} from "../../../lib/server/auth.js";
import {
  checkRateLimit,
  createRateLimitResponse,
  emailChangeRateLimit,
  getClientIp,
} from "../../../lib/server/rate-limit.js";
import {
  consumeRecoveryCode,
  verifyTwoFactorCode,
} from "../../../lib/server/two-factor.js";

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

    const body = await request.json().catch(() => ({}));
    const newEmail = String(body.newEmail ?? "").trim().toLowerCase();
    const currentPassword = String(body.currentPassword ?? "");
    const twoFactorCode = String(body.twoFactorCode ?? "").trim();
    const recoveryCode = String(body.recoveryCode ?? "").trim();

    if (!newEmail || !currentPassword) {
      return json({ ok: false, error: "Введи новый email и текущий пароль." }, 400);
    }

    const ip = getClientIp(request);
    const rate = await checkRateLimit(
      emailChangeRateLimit,
      `change-email:${ip}:${auth.user.email}`
    );

    if (!rate.success) {
      return createRateLimitResponse(
        "Слишком много попыток смены email. Подожди немного и попробуй снова."
      );
    }

    if (!verifyPassword(currentPassword, auth.user.passwordHash)) {
      return json({ ok: false, error: "Неверный текущий пароль." }, 400);
    }

    let nextRecoveryCodes = auth.user.twoFactorRecoveryCodes ?? null;

    if (auth.user.twoFactorEnabled) {
      if (!twoFactorCode && !recoveryCode) {
        return json({ ok: false, error: "Подтверди действие кодом 2FA или recovery code." }, 400);
      }

      if (recoveryCode) {
        const result = consumeRecoveryCode(auth.user.twoFactorRecoveryCodes, recoveryCode);
        if (!result.ok) {
          return json({ ok: false, error: "Неверный recovery code." }, 400);
        }
        nextRecoveryCodes = result.nextStorageValue;
      } else if (!auth.user.twoFactorSecret || !verifyTwoFactorCode({
        email: auth.user.email,
        encryptedSecret: auth.user.twoFactorSecret,
        code: twoFactorCode,
      })) {
        return json({ ok: false, error: "Неверный код 2FA." }, 400);
      }
    }

    const userWithFreshCodes = nextRecoveryCodes !== auth.user.twoFactorRecoveryCodes
      ? await updateUser({ ...auth.user, twoFactorRecoveryCodes: nextRecoveryCodes })
      : auth.user;

    const result = await createEmailChangeRequest(userWithFreshCodes, newEmail);
    const origin = new URL(request.url).origin;
    const verifyUrl = `${origin}/api/account/verify-email?token=${encodeURIComponent(result.token)}`;

    await logAudit({
      userId: auth.user.id,
      action: "email_change_started",
      ip,
      userAgent: request.headers.get("user-agent"),
    });

    if (!resend || !emailFromRaw) {
      if (import.meta.env.DEV) {
        console.log(`[ASTRA EMAIL VERIFY] ${newEmail}: ${verifyUrl}`);
      }
      return json({
        ok: true,
        message: "Письмо для подтверждения подготовлено.",
      });
    }

    const { error } = await resend.emails.send({
      from: emailFrom,
      to: [newEmail],
      subject: "Подтверждение нового email в Astra",
      html: `
        <div style="font-family:Arial,sans-serif;padding:24px;background:#0b0b10;color:#fff">
          <h2 style="margin:0 0 16px">Подтверждение email</h2>
          <p style="margin:0 0 12px;color:#cfcfe7">
            Нажми кнопку ниже, чтобы подтвердить новый email для аккаунта Astra.
          </p>
          <p style="margin:18px 0;">
            <a href="${verifyUrl}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#8b5cf6;color:#fff;text-decoration:none;font-weight:700;">
              Подтвердить email
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

    return json({
      ok: true,
      message: "Письмо для подтверждения отправлено.",
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
