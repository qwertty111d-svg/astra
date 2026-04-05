ALTER TABLE "audit_logs" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "os" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "ip" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "last_seen_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "last_seen_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_reset_expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "verification_codes" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification_codes" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification_codes" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pending_email_verification_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pending_email_verification_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reset_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pending_two_factor_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_codes" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_codes" ADD COLUMN "password_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_codes" ADD COLUMN "code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "pending_email_token_hash";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "pending_email_expires_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password_reset_token_hash";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "two_factor_secret_encrypted";--> statement-breakpoint
ALTER TABLE "verification_codes" DROP COLUMN "code_hash";--> statement-breakpoint
ALTER TABLE "verification_codes" DROP COLUMN "purpose";--> statement-breakpoint
ALTER TABLE "verification_codes" DROP COLUMN "attempts";