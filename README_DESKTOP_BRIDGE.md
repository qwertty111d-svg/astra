# Astra Desktop + Site Bridge

Что уже добавлено:

- API для desktop-приложения:
  - `POST /api/desktop/login`
  - `GET /api/desktop/session`
  - `GET /api/desktop/license`
  - `POST /api/desktop/logout`
  - `POST /api/desktop/device/register`
- Таблица `desktop_devices`
- Простая логика лицензии на стороне сайта

Что должен делать desktop-клиент:

1. Логиниться через `POST /api/desktop/login`
2. Сохранять `token`
3. Отправлять `Authorization: Bearer <token>` в `session`, `license`, `logout`, `device/register`
4. Кнопкой покупки открывать `https://astraboost.ru/pricing`

Пример `POST /api/desktop/login`:

```json
{
  "email": "user@example.com",
  "password": "secret123",
  "deviceName": "Astra Desktop",
  "deviceFingerprint": "WIN-UNIQUE-ID",
  "appVersion": "0.1.0"
}
```

Пример ответа:

```json
{
  "ok": true,
  "token": "...",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "name": "User"
  },
  "license": {
    "plan": "PRO",
    "active": true,
    "expiresAt": "2026-05-01T00:00:00.000Z"
  }
}
```
