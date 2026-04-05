import { verifyTwoFactorCode } from "./two-factor.js";

export function verifySensitiveTwoFactor(input: {
  user: any;
  twoFactorCode?: string;
}) {
  const cleanCode = String(input.twoFactorCode ?? "").trim();

  if (!input.user?.twoFactorEnabled) {
    return { ok: true as const };
  }

  if (!input.user?.twoFactorSecret) {
    return { ok: false as const, error: "2FA для аккаунта настроена некорректно." };
  }

  if (!cleanCode) {
    return { ok: false as const, error: "Введите код 2FA для подтверждения действия." };
  }

  const valid = verifyTwoFactorCode({
    email: input.user.email,
    encryptedSecret: input.user.twoFactorSecret,
    code: cleanCode,
  });

  if (!valid) {
    return { ok: false as const, error: "Неверный код 2FA." };
  }

  return { ok: true as const };
}
