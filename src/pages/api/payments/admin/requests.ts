import type { APIRoute } from "astro";
import { getCurrentAuthOrNull } from "../../../../lib/server/auth.js";
import { getPendingPaymentRequestsWithUsers, isAdminEmail } from "../../../../lib/server/payments.js";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const GET: APIRoute = async ({ request }) => {
  const auth = await getCurrentAuthOrNull(request);
  if (!auth?.user) return json({ ok: false, error: "Нужно войти." }, 401);
  if (!isAdminEmail(auth.user.email)) return json({ ok: false, error: "Недостаточно прав." }, 403);

  const requests = await getPendingPaymentRequestsWithUsers();
  return json({ ok: true, requests });
};
