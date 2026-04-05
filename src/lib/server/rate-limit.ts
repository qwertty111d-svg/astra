import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { readEnv } from "./env.js";

type RateLimitResult = { success: boolean; limit: number; remaining: number; reset: number; pending: Promise<unknown> };
type RateLimitLike = { limit: (key: string) => Promise<RateLimitResult> };

const upstashUrl = readEnv("UPSTASH_REDIS_REST_URL");
const upstashToken = readEnv("UPSTASH_REDIS_REST_TOKEN");
const hasUpstash = Boolean(upstashUrl && upstashToken);

const redis = hasUpstash
  ? new Redis({
      url: upstashUrl,
      token: upstashToken,
    })
  : null;

function createLimiter(maxRequests: number, window: `${number} ${"s" | "m" | "h" | "d"}`, prefix: string): RateLimitLike {
  if (!redis) {
    return {
      async limit() {
        return {
          success: true,
          limit: maxRequests,
          remaining: maxRequests,
          reset: Date.now() + 60_000,
          pending: Promise.resolve(),
        };
      },
    };
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, window),
    prefix,
  });
}

export const loginRateLimit = createLimiter(5, "10 m", "rl:login");
export const sendCodeRateLimit = createLimiter(3, "10 m", "rl:send-code");
export const resetRateLimit = createLimiter(3, "15 m", "rl:reset");
export const emailChangeRateLimit = createLimiter(3, "15 m", "rl:change-email");
export const resendEmailRateLimit = createLimiter(3, "15 m", "rl:resend-email");
export const verifyCodeRateLimit = createLimiter(8, "10 m", "rl:verify-code");
export const twoFactorRateLimit = createLimiter(6, "10 m", "rl:2fa");

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

export async function checkRateLimit(ratelimit: RateLimitLike, key: string) {
  return ratelimit.limit(key);
}

export function createRateLimitResponse(message: string) {
  return new Response(
    JSON.stringify({
      ok: false,
      error: message,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    }
  );
}
