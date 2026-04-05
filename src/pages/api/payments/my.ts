import type { APIRoute } from "astro";
import { getCurrentAuthOrNull } from "../../../lib/server/auth.js";
import { getPaymentRequestsForUser } from "../../../lib/server/payments.js";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const GET: APIRoute = async ({ request }) => {
  const auth = await getCurrentAuthOrNull(request);
  if (!auth?.user) {
    return json({ ok: false, error: "Нужно войти в аккаунт." }, 401);
  }

  const requests = await getPaymentRequestsForUser(auth.user.id);
  return json({ ok: true, requests });
};
