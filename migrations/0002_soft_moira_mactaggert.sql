ALTER TABLE "menu_items" ADD COLUMN "is_special" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "sold_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "base_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "credits" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "credit_history" text DEFAULT '[]' NOT NULL;