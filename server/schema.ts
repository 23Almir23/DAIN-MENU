/**
 * Drizzle ORM schema — Phase 1 core tables.
 *
 * Aligned with src/types/menu.ts domain types.
 * Each table maps to a domain entity; translations are
 * in their own tables to support future i18n queries efficiently.
 *
 * Relationships:
 *   restaurants (1) ──< categories (many)
 *   restaurants (1) ──< menu_items (many)
 *   categories  (1) ──< category_translations (many, one per lang)
 *   menu_items  (1) ──< item_translations (many, one per lang)
 *
 * Not in Phase 1 (added later):
 *   users, photos, qr_configs, credit_transactions,
 *   ai_action_log, import_sessions, billing
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─────────────────────────────────────────────
// RESTAURANTS
// ─────────────────────────────────────────────

/**
 * One row per restaurant (single-tenant for now).
 * Multi-tenancy: add user_id FK when auth lands in Phase 1 step 2.
 *
 * Decisions:
 * - social_links stored as JSONB-equivalent (text[]) is too limited;
 *   using text so we can store JSON array directly for Phase 1 simplicity.
 *   Will migrate to a proper social_links table in a later phase.
 * - opening_hours kept as free text (matching current frontend).
 *   Structured hours (day → open/close) is a Phase 4 concern.
 * - guest_theme stored here instead of a separate config table (simpler).
 */
export const restaurants = pgTable("restaurants", {
  id: uuid("id").primaryKey().defaultRandom(),
  /**
   * Owner of this restaurant. References users.id from shared/models/auth.ts.
   * Nullable — existing rows and the seed case don't have an owner yet.
   * Enforced at the API layer: every authenticated endpoint scopes by userId.
   * Multi-tenancy path: add a restaurant_memberships join table; keep this as "primary owner".
   */
  userId: text("user_id"),
  name: text("name").notNull(),
  description: text("description").default(""),
  cuisine: text("cuisine").default(""),
  logo: text("logo"),
  primaryColor: text("primary_color").default("#f97316"),

  // Contact
  address: text("address").default(""),
  phone: text("phone").default(""),
  email: text("email"),
  website: text("website"),
  city: text("city"),
  postalCode: text("postal_code"),
  country: text("country"),

  // Brand
  brandName: text("brand_name"),
  coverImage: text("cover_image"),

  // Legal (nullable — not all restaurants will fill this in)
  legalCompanyName: text("legal_company_name"),
  ownerName: text("owner_name"),
  taxNumber: text("tax_number"),
  vatId: text("vat_id"),
  commercialRegisterNumber: text("commercial_register_number"),
  legalForm: text("legal_form"),
  registeredAddress: text("registered_address"),

  // Operations
  openingHours: text("opening_hours"),
  holidayNotes: text("holiday_notes"),
  serviceTypes: text("service_types").array(),
  supportedLanguages: text("supported_languages").array().default(["en"]),
  currency: text("currency").default("USD"),
  defaultLocale: text("default_locale").default("en"),
  baseLanguage: text("base_language").notNull().default("en"),

  // Public / guest
  socialLinks: text("social_links"),
  guestContactInfo: text("guest_contact_info"),
  guestNotes: text("guest_notes"),
  allergyDefaults: text("allergy_defaults"),
  guestTheme: text("guest_theme").default("elegant"),
  template: text("template").default("noir"),
  coverImage: text("cover_image"),

  // Billing contact
  billingContactName: text("billing_contact_name"),
  billingEmail: text("billing_email"),
  billingNotes: text("billing_notes"),

  // Billing state — managed via /api/billing routes (Phase 3)
  credits: integer("credits").notNull().default(50),
  plan: text("plan").notNull().default("free"),
  creditHistory: text("credit_history").notNull().default("[]"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// CATEGORY TRANSLATIONS
// ─────────────────────────────────────────────

/**
 * One row per (category, language) pair.
 * Unique constraint prevents duplicate translations for the same language.
 * Frontend stores these inline on the category object; API will hydrate them.
 */
export const categoryTranslations = pgTable(
  "category_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    langCode: text("lang_code").notNull(),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("category_translations_unique").on(t.categoryId, t.langCode)]
);

// ─────────────────────────────────────────────
// MENU ITEMS
// ─────────────────────────────────────────────

/**
 * Price stored as numeric(10,2) — matches the frontend `number` type
 * without requiring a cents conversion during migration. If needed,
 * we can switch to integer cents in a future migration with a data transform.
 *
 * image stores a URL (future: FK to photos table). For Phase 1, it may
 * still receive a data URI from the frontend — that's acceptable temporarily.
 * Photo upload to object storage is a Phase 2 concern.
 */
export const menuItems = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description").default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  image: text("image"),
  allergens: text("allergens").array().default([]),
  calories: integer("calories"),
  isAvailable: boolean("is_available").notNull().default(true),
  isPopular: boolean("is_popular").notNull().default(false),
  isSpecial: boolean("is_special").notNull().default(false),
  soldOut: boolean("sold_out").notNull().default(false),
  needsReview: boolean("needs_review").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// SERVICE SESSIONS
// ─────────────────────────────────────────────

/**
 * One row per service period.
 * startedAt: when the operator clicked "Start service".
 * endedAt:   null while the session is open; set when "End service" is clicked.
 * clearedItemsSnapshot: JSON string recording what was reset at session start.
 */
export const serviceSessions = pgTable("service_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  clearedItemsSnapshot: text("cleared_items_snapshot"),
});

// ─────────────────────────────────────────────
// ITEM TRANSLATIONS
// ─────────────────────────────────────────────

/**
 * One row per (item, language) pair.
 * Mirrors the frontend `translations` object on MenuItem.
 */
export const itemTranslations = pgTable(
  "item_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    langCode: text("lang_code").notNull(),
    name: text("name").notNull(),
    description: text("description").default(""),
  },
  (t) => [uniqueIndex("item_translations_unique").on(t.itemId, t.langCode)]
);

// ─────────────────────────────────────────────
// RELATIONS (for Drizzle relational queries)
// ─────────────────────────────────────────────

export const restaurantsRelations = relations(restaurants, ({ many }) => ({
  categories: many(categories),
  menuItems: many(menuItems),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [categories.restaurantId],
    references: [restaurants.id],
  }),
  translations: many(categoryTranslations),
  menuItems: many(menuItems),
}));

export const categoryTranslationsRelations = relations(categoryTranslations, ({ one }) => ({
  category: one(categories, {
    fields: [categoryTranslations.categoryId],
    references: [categories.id],
  }),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [menuItems.restaurantId],
    references: [restaurants.id],
  }),
  category: one(categories, {
    fields: [menuItems.categoryId],
    references: [categories.id],
  }),
  translations: many(itemTranslations),
}));

export const itemTranslationsRelations = relations(itemTranslations, ({ one }) => ({
  item: one(menuItems, {
    fields: [itemTranslations.itemId],
    references: [menuItems.id],
  }),
}));

export const serviceSessionsRelations = relations(serviceSessions, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [serviceSessions.restaurantId],
    references: [restaurants.id],
  }),
}));

// ─────────────────────────────────────────────
// INSERT SCHEMAS (Zod, via drizzle-zod)
// ─────────────────────────────────────────────

export const insertRestaurantSchema = createInsertSchema(restaurants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertCategoryTranslationSchema = createInsertSchema(categoryTranslations).omit({
  id: true,
});

export const insertMenuItemSchema = createInsertSchema(menuItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertItemTranslationSchema = createInsertSchema(itemTranslations).omit({
  id: true,
});

export const insertServiceSessionSchema = createInsertSchema(serviceSessions).omit({
  id: true,
});

// ─────────────────────────────────────────────
// INFERRED TYPES
// ─────────────────────────────────────────────

export type Restaurant = typeof restaurants.$inferSelect;
export type InsertRestaurant = ReturnType<(typeof insertRestaurantSchema)["parse"]>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = ReturnType<(typeof insertCategorySchema)["parse"]>;

export type CategoryTranslation = typeof categoryTranslations.$inferSelect;
export type InsertCategoryTranslation = ReturnType<(typeof insertCategoryTranslationSchema)["parse"]>;

export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = ReturnType<(typeof insertMenuItemSchema)["parse"]>;

export type ItemTranslation = typeof itemTranslations.$inferSelect;
export type InsertItemTranslation = ReturnType<(typeof insertItemTranslationSchema)["parse"]>;

export type ServiceSession = typeof serviceSessions.$inferSelect;
export type InsertServiceSession = ReturnType<(typeof insertServiceSessionSchema)["parse"]>;
