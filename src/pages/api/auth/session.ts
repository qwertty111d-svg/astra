export const prerender = false;

import type { APIRoute } from "astro";
import { getCurrentAuth, publicUser } from "../../../lib/server/auth.js";

export const GET: APIRoute = async ({ request }) => {
  const auth = await getCurrentAuth(request);

  return new Response(
    JSON.stringify({
      ok: true,
      authenticated: Boolean(auth),
      user: auth ? publicUser(auth.user) : null,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
};