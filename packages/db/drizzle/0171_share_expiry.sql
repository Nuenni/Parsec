ALTER TABLE "issue" ADD COLUMN IF NOT EXISTS "share_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_view" ADD COLUMN IF NOT EXISTS "share_expires_at" timestamp with time zone;
