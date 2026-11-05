ALTER TABLE "project_document" ADD COLUMN IF NOT EXISTS "share_token" uuid;--> statement-breakpoint
ALTER TABLE "project_document" ADD COLUMN IF NOT EXISTS "share_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_document" ADD COLUMN IF NOT EXISTS "share_include_children" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_document" ADD COLUMN IF NOT EXISTS "share_include_issues" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "project_document" ADD CONSTRAINT "project_document_share_token_unique" UNIQUE("share_token");
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;
