/**
 * Multilingual utilities for guest-facing menu content.
 * These helpers power language selection, fallback rendering,
 * and translation status across MenuBuilder and GuestPreview.
 *
 * In Replit, language resolution may move server-side for SEO.
 * These utils remain useful for client-side preview and builder UI.
 */

import type { ItemTranslation } from "@/types/menu";

/** Supported guest-facing languages with display metadata */
export interface SupportedLanguage {
  code: string;
  label: string;      // English label
  nativeLabel: string; // Label in the language itself
  flag: string;        // Emoji flag for quick visual ID
}

export const DEFAULT_LANGUAGE = "en";

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "en", label: "English", nativeLabel: "English", flag: "🇬🇧" },
  { code: "es", label: "Spanish", nativeLabel: "Español", flag: "🇪🇸" },
  { code: "fr", label: "French", nativeLabel: "Français", flag: "🇫🇷" },
  { code: "de", label: "German", nativeLabel: "Deutsch", flag: "🇩🇪" },
  { code: "it", label: "Italian", nativeLabel: "Italiano", flag: "🇮🇹" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português", flag: "🇵🇹" },
  { code: "zh", label: "Chinese", nativeLabel: "中文", flag: "🇨🇳" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "Korean", nativeLabel: "한국어", flag: "🇰🇷" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", flag: "🇸🇦" },
];

export function getLanguage(code: string): SupportedLanguage | undefined {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code);
}

/**
 * Resolve translated content for a menu item.
 * Falls back to the original content when a translation is missing.
 *
 * @param baseLang - The restaurant's base language code (defaults to DEFAULT_LANGUAGE).
 *   When langCode matches baseLang, the original fields are returned directly.
 *   This allows restaurants with a non-English base language to work correctly.
 *
 * isFallback semantics:
 *   false — item name (and description, if present) are in the requested language.
 *   true  — either no translation exists at all, OR the name is translated but the
 *           description is missing and the original description is shown instead.
 *           In both cases a visible language-code badge is rendered so guests are
 *           never silently shown base-language content under a different language.
 */
export function resolveTranslation(
  original: ItemTranslation,
  translations: Record<string, ItemTranslation>,
  langCode: string,
  baseLang: string = DEFAULT_LANGUAGE
): ItemTranslation & { isFallback: boolean } {
  if (langCode === baseLang) {
    return { ...original, isFallback: false };
  }
  const t = translations[langCode];
  if (t && t.name) {
    const descriptionFallsBack = !t.description && !!original.description;
    return {
      name: t.name,
      description: t.description || original.description,
      isFallback: descriptionFallsBack,
    };
  }
  return { ...original, isFallback: true };
}

/**
 * Get the set of languages that have at least one translated item or category.
 */
export function getAvailableLanguages(
  items: Array<{ translations: Record<string, { name: string }> }>,
  categories?: Array<{ translations?: Record<string, { name: string }> }>
): string[] {
  const langs = new Set<string>();
  items.forEach((item) => Object.keys(item.translations).forEach((l) => langs.add(l)));
  categories?.forEach((cat) => {
    if (cat.translations) Object.keys(cat.translations).forEach((l) => langs.add(l));
  });
  return Array.from(langs).sort();
}

/**
 * Translation coverage for a set of items in a given language.
 */
export interface TranslationCoverage {
  langCode: string;
  translated: number;
  total: number;
  percentage: number;
}

export function getTranslationCoverage(
  items: Array<{ translations: Record<string, { name: string }> }>,
  langCode: string
): TranslationCoverage {
  const total = items.length;
  const translated = items.filter((i) => i.translations[langCode]?.name).length;
  return {
    langCode,
    translated,
    total,
    percentage: total > 0 ? Math.round((translated / total) * 100) : 0,
  };
}
