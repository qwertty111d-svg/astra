# Astra final polish bundle

Что внутри:
- audit log и блок "Последние действия" в кабинете и безопасности
- подтверждение 2FA на чувствительных действиях:
  - смена пароля
  - смена email
  - завершение других сессий
- чистка debug/preview ответов для production
- логирование ключевых событий:
  - успешный вход
  - неудачный вход
  - вызов 2FA
  - успешный вход с 2FA
  - ошибка 2FA
  - смена пароля
  - запрос сброса пароля
  - завершение других сессий
  - запуск смены email
  - повторная отправка письма подтверждения

Что заменить:
- src/lib/server/audit.ts
- src/lib/server/sensitive-2fa.ts
- src/pages/api/auth/login.ts
- src/pages/api/auth/login-2fa.ts
- src/pages/api/auth/request-password-reset.ts
- src/pages/api/auth/reset-password.ts
- src/pages/api/account/change-password.ts
- src/pages/api/account/change-email.ts
- src/pages/api/account/resend-email-verification.ts
- src/pages/api/account/logout-other-sessions.ts
- src/pages/account.astro
- src/pages/account/security.astro

После замены:
1. git add .
2. git commit -m "Add audit log and sensitive 2FA checks"
3. git push
4. redeploy

Что проверить:
- обычный логин
- логин с 2FA
- смену пароля с 2FA
- смену email с 2FA
- завершение других сессий с 2FA
- появление блока "Последние действия" в кабинете и безопасности
