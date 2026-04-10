/**
 * Shared domain types for Menu Master UI.
 *
 * These types define the data model and will map 1:1 to database tables
 * when the backend is implemented in Replit.
 *
 * Naming convention:
 * - Interfaces      = database table rows
 * - `translations`  = separate i18n tables (menu_item_translations, category_translations)
 * - `*Input`        = mutation payloads (create/update)
 * - `*Derived`      = computed display values (never persisted)
 * - AppState        = removed in Phase 3; data now comes from dedicated API hooks
 *
 * Domain boundaries:
 * ┌─────────────┬──────────────────────────────────────────┐
 * │ Domain      │ Tables / entities                        │
 * ├─────────────┼──────────────────────────────────────────┤
 * │ Restaurant  │ restaurants, social_links                │
 * │ Menu        │ categories, items, item_translations,    │
 * │             │ category_translations, photos            │
 * │ Guest       │ guest_theme (on restaurant), qr_config   │
 * │ AI / Credits│ credit_transactions, ai_action_log       │
 * │ Billing     │ plans, invoices                          │
 * │ Import      │ import_sessions                          │
 * └─────────────┴──────────────────────────────────────────┘
 */

import type { GuestThemeId } from "@/data/guest-themes";

// ═══════════════════════════════════════════════════════════
// MENU DOMAIN
// ═══════════════════════════════════════════════════════════

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  /** URL or data URI. In Replit: foreign key to photos table */
  image?: string;
  allergens: string[];
  calories?: number;
  isAvailable: boolean;
  isPopular: boolean;
  isSpecial: boolean;
  soldOut: boolean;
  /** Set to true by AI routes (rewrite, translate, import) until operator reviews */
  needsReview: boolean;
  /** Keyed by ISO 639-1 code. In Replit: menu_item_translations table */
  translations: Record<string, ItemTranslation>;
}

export interface ItemTranslation {
  name: string;
  description: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  order: number;
  /** Keyed by ISO 639-1 code. In Replit: category_translations table */
  translations: Record<string, CategoryTranslation>;
}

export interface CategoryTranslation {
  name: string;
}

// ═══════════════════════════════════════════════════════════
// PHOTO DOMAIN
// ═══════════════════════════════════════════════════════════

/**
 * Photo metadata — separate from MenuItem so photos can be
 * managed independently (gallery, reuse across items, storage cleanup).
 * In Replit: photos table with foreign key to restaurant.
 */
export interface PhotoMeta {
  id: string;
  url: string;
  /** Original filename from upload */
  originalName?: string;
  /** MIME type */
  mimeType?: string;
  /** File size in bytes */
  sizeBytes?: number;
  /** Which item this photo belongs to (nullable for restaurant-level photos) */
  itemId?: string;
  /** Upload source */
  source: PhotoSource;
  createdAt: string;
}

export type PhotoSource = "upload" | "camera" | "import" | "ai-generated";

// ═══════════════════════════════════════════════════════════
// RESTAURANT DOMAIN
// ═══════════════════════════════════════════════════════════

export interface Restaurant {
  id: string;
  name: string;
  description: string;
  cuisine: string;
  logo?: string;
  primaryColor: string;
  address: string;
  phone: string;

  // Brand identity
  brandName?: string;
  coverImage?: string;
  template?: string;

  // Contact
  email?: string;
  website?: string;
  city?: string;
  postalCode?: string;
  country?: string;

  // Legal / official — In Replit: could be a separate `business_details` table
  legalCompanyName?: string;
  ownerName?: string;
  taxNumber?: string;
  vatId?: string;
  commercialRegisterNumber?: string;
  legalForm?: string;
  registeredAddress?: string;

  // Operations
  openingHours?: string;
  holidayNotes?: string;
  serviceTypes?: ServiceType[];
  supportedLanguages?: string[];
  currency?: CurrencyCode;
  defaultLocale?: string;
  /** ISO 639-1 code for the operator's primary menu content language. Default "en". */
  baseLanguage?: string;

  // Guest experience
  guestTheme?: string;
  /** CSS-variable design template for the guest view (noir | linen | slate | sage). */
  template?: string;

  // Public / social
  socialLinks?: SocialLink[];
  guestContactInfo?: string;
  guestNotes?: string;
  allergyDefaults?: string;

  // Billing contact
  billingContactName?: string;
  billingEmail?: string;
  billingNotes?: string;
}

export type ServiceType = "dine-in" | "takeaway" | "delivery" | "catering";

export type CurrencyCode = "USD" | "EUR" | "GBP" | "CHF" | "CAD" | "AUD" | "JPY";

export interface SocialLink {
  platform: string;
  url: string;
}

// ═══════════════════════════════════════════════════════════
// GUEST / QR DOMAIN
// ═══════════════════════════════════════════════════════════

/**
 * QR code destination config.
 * In Replit: qr_configs table, one per restaurant.
 */
export interface QRConfig {
  /** The guest-facing URL this QR points to */
  guestUrl: string;
  /** Which theme to render */
  themeId: GuestThemeId;
  /** Default language for the guest view */
  defaultLang: string;
  /** Whether to show the language switcher */
  showLanguageSwitcher: boolean;
}

// ═══════════════════════════════════════════════════════════
// AI / CREDITS DOMAIN
// ═══════════════════════════════════════════════════════════

export interface CreditTransaction {
  id: string;
  /** Human-readable action label (e.g. "Rewrite Descriptions") */
  action: string;
  /** Positive = credit added, negative = credit spent */
  amount: number;
  date: string;
  /** Context: which item or batch this relates to */
  itemName?: string;
}

/**
 * Log of AI actions run — useful for auditing and preventing re-runs.
 * In Replit: ai_action_log table.
 */
export interface AIActionLog {
  id: string;
  actionType: AIActionType;
  itemIds: string[];
  itemsChanged: number;
  creditsUsed: number;
  /** For translate actions */
  langCode?: string;
  createdAt: string;
}

export type AIActionType = "rewrite" | "translate" | "allergens" | "calories";

// ═══════════════════════════════════════════════════════════
// BILLING DOMAIN
// ═══════════════════════════════════════════════════════════

export type PlanId = "free" | "starter" | "pro";

// ═══════════════════════════════════════════════════════════
// IMPORT DOMAIN
// ═══════════════════════════════════════════════════════════

/**
 * Tracks how the restaurant was onboarded.
 * In Replit: import_sessions table.
 */
export interface ImportSession {
  id: string;
  source: ImportSource;
  status: "pending" | "processing" | "completed" | "failed";
  /** Number of items/fields imported */
  itemsImported?: number;
  createdAt: string;
  completedAt?: string;
}

export type ImportSource = "google-business" | "menu-upload" | "manual";

