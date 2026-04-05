const getEnv = (key: string) => {
  const fromProcess = process.env[key];
  if (fromProcess && fromProcess.trim()) return fromProcess.trim();

  const fromImportMeta = (import.meta as any)?.env?.[key];
  if (typeof fromImportMeta === "string" && fromImportMeta.trim()) {
    return fromImportMeta.trim();
  }

  return "";
};

type TurnstileResult =
  | { ok: true }
  | { ok: false; error: string; codes?: string[] };

export async function verifyTurnstileToken(input: {
  token: string;
  ip?: string;
}): Promise<TurnstileResult> {
  const secret = getEnv("TURNSTILE_SECRET_KEY");

  if (!secret) {
    if (import.meta.env.DEV) return { ok: true };
    return { ok: false, error: "Антибот-защита не настроена." };
  }

  const token = String(input.token || "").trim();
  if (!token) {
    return { ok: false, error: "Подтверди, что ты не бот." };
  }

  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);

    if (input.ip && input.ip !== "unknown") {
      form.set("remoteip", input.ip);
    }

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.success) {
      return {
        ok: false,
        error: "Проверка антибота не пройдена. Попробуй ещё раз.",
        codes: Array.isArray(data?.["error-codes"]) ? data["error-codes"] : [],
      };
    }

    return { ok: true };
  } catch (error) {
    console.error("[TURNSTILE ERROR]", error);
    return {
      ok: false,
      error: "Сервис антибот-проверки временно недоступен. Попробуй ещё раз.",
    };
  }
}
