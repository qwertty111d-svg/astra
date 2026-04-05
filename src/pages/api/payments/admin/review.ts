import type { APIRoute } from "astro";
import { getCurrentAuthOrNull } from "../../../../lib/server/auth.js";
import { approvePaymentRequest, isAdminEmail, rejectPaymentRequest } from "../../../../lib/server/payments.js";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = await getCurrentAuthOrNull(request);
    if (!auth?.user) return json({ ok: false, error: "Нужно войти." }, 401);
    if (!isAdminEmail(auth.user.email)) return json({ ok: false, error: "Недостаточно прав." }, 403);

    const body = await request.json().catch(() => ({}));
    const requestId = String(body.requestId ?? "").trim();
    const action = String(body.action ?? "").trim().toLowerCase();
    const adminNote = String(body.adminNote ?? "");

    if (!requestId) return json({ ok: false, error: "requestId обязателен." }, 400);

    const result = action === "approve"
      ? await approvePaymentRequest({ requestId, adminEmail: auth.user.email, adminNote })
      : await rejectPaymentRequest({ requestId, adminEmail: auth.user.email, adminNote });

    return json({ ok: true, request: result });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Ошибка обработки заявки." }, 400);
  }
};
