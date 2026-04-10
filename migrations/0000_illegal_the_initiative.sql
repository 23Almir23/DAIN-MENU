CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"lang_code" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"lang_code" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"image" text,
	"allergens" text[] DEFAULT '{}',
	"calories" integer,
	"is_available" boolean DEFAULT true NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"cuisine" text DEFAULT '',
	"logo" text,
	"primary_color" text DEFAULT '#f97316',
	"address" text DEFAULT '',
	"phone" text DEFAULT '',
	"email" text,
	"website" text,
	"city" text,
	"postal_code" text,
	"country" text,
	"brand_name" text,
	"cover_image" text,
	"legal_company_name" text,
	"owner_name" text,
	"tax_number" text,
	"vat_id" text,
	"commercial_register_number" text,
	"legal_form" text,
	"registered_address" text,
	"opening_hours" text,
	"holiday_notes" text,
	"service_types" text[],
	"supported_languages" text[] DEFAULT '{"en"}',
	"currency" text DEFAULT 'USD',
	"default_locale" text DEFAULT 'en',
	"social_links" text,
	"guest_contact_info" text,
	"guest_notes" text,
	"allergy_defaults" text,
	"guest_theme" text DEFAULT 'elegant',
	"billing_contact_name" text,
	"billing_email" text,
	"billing_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_translations" ADD CONSTRAINT "item_translations_item_id_menu_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "category_translations_unique" ON "category_translations" USING btree ("category_id","lang_code");--> statement-breakpoint
CREATE UNIQUE INDEX "item_translations_unique" ON "item_translations" USING btree ("item_id","lang_code");