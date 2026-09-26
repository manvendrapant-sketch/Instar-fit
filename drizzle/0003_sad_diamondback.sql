ALTER TABLE "coaches" ADD COLUMN "published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;