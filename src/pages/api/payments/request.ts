import type { APIRoute } from "astro";
import { getCurrentAuthOrNull } from "../../../lib/server/auth.js";
import { createPaymentRequest, getPlanConfig, normalizePlan } from "../../../lib/server/payments.js";

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
    if (!auth?.user) {
      return json({ ok: false, error: "Нужно войти в аккаунт." }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const plan = normalizePlan(body.plan);
    const payerNote = String(body.payerNote ?? "");
    const paymentRequest = await createPaymentRequest({
      userId: auth.user.id,
      plan,
      payerNote,
    });

    const planConfig = getPlanConfig(plan);

    return json({
      ok: true,
      request: paymentRequest,
      message: `Заявка на тариф ${planConfig.label} создана. После проверки оплаты доступ включится.`,
    });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Ошибка создания заявки." }, 400);
  }
};
