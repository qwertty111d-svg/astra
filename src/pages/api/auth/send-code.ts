export const prerender = false;

import type { APIRoute } from "astro";
import { Resend } from "resend";
import {
  createRegistrationCode,
  removeRegistrationCode,
} from "../../../lib/server/auth.js";
import { getClientIp, sendCodeRateLimit } from "../../../lib/server/rate-limit.js";
import { verifyTurnstileToken } from "../../../lib/server/turnstile.js";

const getEnv = (key: string) => {
  const fromProcess = process.env[key];
  if (fromProcess && fromProcess.trim()) return fromProcess.trim();
  const fromImportMeta = (import.meta as any)?.env?.[key];
  if (typeof fromImportMeta === "string" && fromImportMeta.trim()) return fromImportMeta.trim();
  return "";
};

const resendApiKey = getEnv("RESEND_API_KEY");
const emailFromRaw = getEnv("EMAIL_FROM");
const emailFrom = emailFromRaw.includes("<") ? emailFromRaw : `Astra <${emailFromRaw}>`;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export const POST: APIRoute = async ({ request }) => {
  const ip = getClientIp(request);
  const { success } = await sendCodeRateLimit.limit(`send-code:${ip}`);

  if (!success) {
    return json(
      { ok: false, error: "Слишком много запросов кода. Попробуйте позже." },
      429
    );
  }

  try {
    const { name, email, password, turnstileToken, website } = await request.json();

    if (String(website ?? "").trim()) {
      return json({ ok: false, error: "Запрос отклонён." }, 400);
    }

    const antiBot = await verifyTurnstileToken({
      token: String(turnstileToken ?? ""),
      ip,
    });

    if (!antiBot.ok) {
      return json({ ok: false, error: antiBot.error }, 400);
    }

    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "");

    const { code } = await createRegistrationCode({
      name: cleanName,
      email: cleanEmail,
      password: cleanPassword,
    });

    if (!resend || !emailFromRaw) {
      console.log(`[ASTRA VERIFY CODE] ${cleanEmail}: ${code}`);
      return json({
        ok: true,
        message: "Код создан. Проверь почту или логи сервера.",
        debug: {
          hasResendApiKey: Boolean(resendApiKey),
          hasEmailFrom: Boolean(emailFromRaw),
        },
      });
    }

    const { error } = await resend.emails.send({
      from: emailFrom,
      to: [cleanEmail],
      subject: "Код подтверждения Astra",
      html: `
        <div style="font-family:Arial,sans-serif;padding:24px;background:#0b0b10;color:#fff">
          <h2 style="margin:0 0 16px">Подтверждение аккаунта Astra</h2>
          <p style="margin:0 0 12px;color:#cfcfe7">Твой одноразовый код:</p>
          <div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:12px 0 18px;color:#a78bfa">
            ${code}
          </div>
          <p style="margin:0;color:#9fa0b3">Код действует 10 минут.</p>
        </div>
      `,
    });

    if (error) {
      await removeRegistrationCode(cleanEmail);
      return json(
        { ok: false, error: error.message || "Не удалось отправить письмо." },
        500
      );
    }

    return json({
      ok: true,
      message: "Код отправлен на почту.",
    });
  } catch (err) {
    return json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Ошибка сервера.",
      },
      400
    );
  }
};
