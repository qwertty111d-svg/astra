import { defineMiddleware } from "astro:middleware";
import { getCurrentAuthOrNull } from "./lib/server/auth.js";

const PROTECTED = [/^\/account(?:\/.*)?$/, /^\/checkout(?:\/.*)?$/, /^\/admin(?:\/.*)?$/];

function applySecurityHeaders(response: Response) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), browsing-topics=()"
  );

  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: https: blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "frame-src https://challenges.cloudflare.com",
      "connect-src 'self' https://challenges.cloudflare.com",
    ].join("; ")
  );

  if (import.meta.env.PROD) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const auth = await getCurrentAuthOrNull(context.request);

  context.locals.user = auth?.user ?? null;
  context.locals.session = auth?.session ?? null;

  const pathname = context.url.pathname;
  const needsAuth = PROTECTED.some((pattern) => pattern.test(pathname));

  if (needsAuth && !auth?.user) {
    const nextUrl = encodeURIComponent(pathname);
    return applySecurityHeaders(context.redirect(`/login?next=${nextUrl}`));
  }

  const response = await next();
  return applySecurityHeaders(response);
});
