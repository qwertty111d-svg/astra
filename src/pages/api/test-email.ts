import type { APIRoute } from "astro";
import { Resend } from "resend";

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export const GET: APIRoute = async () => {
  if (import.meta.env.PROD) {
    return new Response("Not Found", { status: 404 });
  }

  const resendApiKey = getEnv("RESEND_API_KEY");
  const emailFromRaw = getEnv("EMAIL_FROM");

  if (!resendApiKey) {
    return json({
      ok: false,
      error: "RESEND_API_KEY missing",
      debug: {
        hasApiKey: false,
        hasEmailFrom: Boolean(emailFromRaw),
      },
    }, 500);
  }

  if (!emailFromRaw) {
    return json({
      ok: false,
      error: "EMAIL_FROM missing",
      debug: {
        hasApiKey: true,
        hasEmailFrom: false,
      },
    }, 500);
  }

  const resend = new Resend(resendApiKey);
  const from = emailFromRaw.includes("<")
    ? emailFromRaw
    : `Astra <${emailFromRaw}>`;

  try {
    const result = await resend.emails.send({
      from,
      to: [emailFromRaw.replace(/^.*<|>$/g, "").trim()],
      subject: "Astra test email",
      html: `
        <div style="font-family:Arial,sans-serif;padding:24px;background:#0b0b10;color:#fff">
          <h2 style="margin:0 0 16px">Astra</h2>
          <p style="margin:0;color:#cfcfe7">Тестовое письмо отправлено успешно.</p>
        </div>
      `,
    });

    return json({
      ok: true,
      data: result.data ?? null,
      debug: {
        hasApiKey: true,
        hasEmailFrom: true,
        from,
      },
    });
  } catch (error) {
    return json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
      debug: {
        hasApiKey: true,
        hasEmailFrom: true,
        from,
      },
    }, 500);
  }
};
