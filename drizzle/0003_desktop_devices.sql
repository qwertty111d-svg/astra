CREATE TABLE IF NOT EXISTS "desktop_devices" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "session_token" text,
  "device_name" text NOT NULL,
  "device_fingerprint" text NOT NULL,
  "platform" text NOT NULL DEFAULT 'Windows',
  "app_version" text,
  "last_seen_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "desktop_devices_user_id_idx" ON "desktop_devices" ("user_id");
CREATE INDEX IF NOT EXISTS "desktop_devices_fingerprint_idx" ON "desktop_devices" ("device_fingerprint");
