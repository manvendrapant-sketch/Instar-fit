CREATE TYPE "public"."coaching_mode" AS ENUM('online', 'in_person', 'both');--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "specialties" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "coaching_mode" "coaching_mode" DEFAULT 'online' NOT NULL;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "time_zone" text DEFAULT 'America/New_York' NOT NULL;--> statement-breakpoint
ALTER TABLE "coaches" ADD COLUMN "storefront_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "includes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "length_weeks" integer;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "session_minutes" integer;