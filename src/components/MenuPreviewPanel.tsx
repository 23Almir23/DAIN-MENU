/**
 * MenuPreviewPanel — Live guest menu preview for the workspace right panel.
 *
 * Renders the guest menu in mobile mode (frameless, no device chrome) using
 * the same theme tokens and item rendering logic as GuestPreview.tsx.
 * Subscribes to useMenu() so it updates immediately when any menu mutation
 * invalidates the ["/api/menu"] query cache.
 *
 * Intentionally mirrors GuestPreview's renderMenu(true, false) output.
 * "true" = forceMobile, "false" = no frame.
 *
 * The Share CTA at the bottom:
 *   "Copy guest link"  — visible when availableItems >= 1
 *   "Get QR code →"    — visible when menuReady (availableItems >= 3 AND totalCategories >= 1)
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, Star, Sparkles, Leaf, Copy, QrCode, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMenu } from "@/hooks/use-menu";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useMenuStats } from "@/hooks/use-menu-stats";
import { sortCategories, formatPrice } from "@/lib/menu-utils";
import {
  resolveTranslation,
  getAvailableLanguages,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  getLanguage,
} from "@/lib/i18n-utils";
import { getGuestTheme, type GuestThemeId } from "@/data/guest-themes";
import { toast } from "sonner";
import type { MenuItem } from "@/types/menu";

export function MenuPreviewPanel({ previewUpdatedAt, filterNeedsReview }: { previewUpdatedAt?: number | null; filterNeedsReview?: boolean }) {
  const navigate = useNavigate();
  const { categories, menuItems, isLoading } = useMenu();
  const { restaurant } = useRestaurant();
  const stats = useMenuStats();

  const [selectedLang, setSelectedLang] = useState(DEFAULT_LANGUAGE);
  const [activeCategory, setActiveCategory] = useState("");
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const hasAutoSelected = useRef(false);

  const theme = getGuestTheme((restaurant?.guestTheme || "elegant") as GuestThemeId);
  const t = theme.preview;
  const sorted = sortCategories(categories);

  const baseLangCode = restaurant?.baseLanguage ?? DEFAULT_LANGUAGE;
  const currency = restaurant?.currency ?? "USD";

  const availableLangs = useMemo(
    () => getAvailableLanguages(menuItems, categories),
    [menuItems, categories]
  );

  const languageOptions = useMemo(() => {
    const codes = [baseLangCode, ...availableLangs.filter((l) => l !== baseLangCode)];
    return codes.map((code) => getLanguage(code)).filter(Boolean) as typeof SUPPORTED_LANGUAGES;
  }, [availableLangs, baseLangCode]);

  // Auto-select best language on first load
  useEffect(() => {
    if (hasAutoSelected.current) return;
    if (isLoading) return;
    const navLang = (navigator.language ?? "").split("-")[0].toLowerCase();
    if (navLang && navLang !== baseLangCode && availableLangs.includes(navLang)) {
      setSelectedLang(navLang);
    } else {
      setSelectedLang(baseLangCode);
    }
    hasAutoSelected.current = true;
  }, [isLoading, availableLangs, baseLangCode]);

  // Keep activeCategory in sync with sorted categories
  useEffect(() => {
    if (sorted.length > 0 && (!activeCategory || !sorted.some((c) => c.id === activeCategory))) {
      setActiveCategory(sorted[0]?.id ?? "");
    }
  }, [sorted, activeCategory]);

  const effectiveActiveCategory =
    activeCategory && sorted.some((c) => c.id === activeCategory)
      ? activeCategory
      : sorted[0]?.id ?? "";

  const filteredItems = menuItems.filter(
    (i) => i.categoryId === effectiveActiveCategory && i.isAvailable
  );
  const hasAnyItems = menuItems.some((i) => i.isAvailable);

  const popularItems = useMemo(
    () => menuItems.filter((i) => i.isPopular && i.isAvailable),
    [menuItems]
  );

  const specialItems = useMemo(
    () => menuItems.filter((i) => i.isSpecial && i.isAvailable && !i.soldOut),
    [menuItems]
  );

  const menuReady = stats.availableItems >= 3 && stats.totalCategories >= 1;
  const hasItems = stats.availableItems >= 1;

  const copyGuestLink = () => {
    if (!restaurant?.id) return;
    const url = `${window.location.origin}/guest?r=${restaurant.id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setLinkCopied(true);
        toast.success("Guest link copied!");
        setTimeout(() => setLinkCopied(false), 2000);
      })
      .catch(() => toast.error("Could not copy link"));
  };

  const borderColor =
    theme.id === "warm" ? "#e8ddd0" : theme.id === "elegant" ? "#e8e4df" : "#e5e7eb";

  return (
    <div className="flex flex-col h-full" data-testid="workspace-preview-panel">
      {/* Panel label */}
      <div className="px-4 py-2.5 border-b shrink-0 flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium">Guest view · Mobile</p>
        {previewUpdatedAt ? (
          <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
            Updated {new Date(previewUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        ) : filterNeedsReview ? (
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Showing current state</span>
        ) : (
          <p className="text-[10px] text-muted-foreground/60 italic">live preview</p>
        )}
      </div>

      {/* Preview viewport — scrollable */}
      <div
        className="flex-1 overflow-y-auto flex flex-col items-center py-3 px-2"
        style={{ backgroundColor: "#f4f4f5" }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div
            className="w-full overflow-hidden"
            style={{
              backgroundColor: t.bodyBg,
              borderRadius: "0.75rem",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              minHeight: 400,
            }}
          >
            {/* Header */}
            <div className="p-4 text-center" style={{ background: t.headerBg, color: t.headerText }}>
              <h2
                className="text-base"
                style={{ fontFamily: t.fontHeading, fontWeight: theme.id === "contemporary" ? 700 : 400 }}
              >
                {restaurant?.name ?? "Your Restaurant"}
              </h2>
              {restaurant?.cuisine && (
                <p className="text-xs mt-0.5" style={{ opacity: 0.8, fontFamily: t.fontBody }}>
                  {restaurant.cuisine}
                </p>
              )}
            </div>

            {/* Language switcher */}
            <div
              className="px-3 py-2 flex items-center gap-2 overflow-x-auto"
              style={{ borderBottom: `1px solid ${borderColor}` }}
            >
              <Globe className="h-3 w-3 shrink-0" style={{ color: t.accentColor }} />
              {languageOptions.length === 1 ? (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap"
                  style={{ backgroundColor: t.accentColor, color: "#fff", fontFamily: t.fontBody }}
                >
                  {languageOptions[0].flag} {languageOptions[0].nativeLabel}
                </span>
              ) : (
                languageOptions.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setSelectedLang(lang.code)}
                    className="px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap transition-colors"
                    style={{
                      fontFamily: t.fontBody,
                      backgroundColor:
                        selectedLang === lang.code
                          ? t.accentColor
                          : theme.id === "warm" ? "#f0e6d8" : theme.id === "elegant" ? "#f0ece7" : "#f3f4f6",
                      color: selectedLang === lang.code ? "#fff" : "#666",
                    }}
                  >
                    {lang.flag} {lang.nativeLabel}
                  </button>
                ))
              )}
            </div>

            {/* Empty state */}
            {!hasAnyItems ? (
              <div className="py-12 text-center px-4" style={{ fontFamily: t.fontBody }}>
                <p className="text-sm" style={{ fontFamily: t.fontHeading, color: "#333" }}>
                  No items yet
                </p>
                <p className="text-xs mt-1" style={{ color: "#888" }}>
                  Add items in the editor to see them here.
                </p>
              </div>
            ) : (
              <>
                {/* Specials */}
                {specialItems.length > 0 && (
                  <div className="px-3 py-3" style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles
                        className="h-3 w-3"
                        style={{
                          color: theme.id === "warm" ? "#c17f3c" : theme.id === "elegant" ? "#8b7355" : t.accentColor,
                        }}
                      />
                      <p
                        className="text-[9px] uppercase"
                        style={{
                          color: theme.id === "warm" ? "#c17f3c" : theme.id === "elegant" ? "#8b7355" : t.accentColor,
                          fontFamily: t.fontBody,
                          letterSpacing: "0.08em",
                        }}
                      >
                        Today's Specials
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {specialItems.slice(0, 2).map((item) => {
                        const resolved = resolveTranslation(
                          { name: item.name, description: item.description },
                          item.translations,
                          selectedLang,
                          baseLangCode
                        );
                        return (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-2 py-1.5"
                          >
                            <span className="text-xs" style={{ fontFamily: t.fontHeading, color: t.accentColor }}>
                              {resolved.name}
                            </span>
                            <span className="text-xs shrink-0" style={{ fontFamily: t.fontHeading, color: "#444" }}>
                              {formatPrice(item.price, currency)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Popular strip */}
                {popularItems.length > 0 && (
                  <div className="px-3 py-2" style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <p
                      className="text-[9px] uppercase mb-1.5"
                      style={{ color: t.accentColor, fontFamily: t.fontBody, letterSpacing: "0.08em" }}
                    >
                      Popular
                    </p>
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                      {popularItems.slice(0, 4).map((item) => {
                        const resolvedName = resolveTranslation(
                          { name: item.name, description: item.description },
                          item.translations,
                          selectedLang,
                          baseLangCode
                        ).name;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveCategory(item.categoryId);
                              setHighlightedItemId(item.id);
                              setTimeout(() => setHighlightedItemId(null), 1600);
                            }}
                            className="flex-none px-2 py-1 rounded-full text-[10px] whitespace-nowrap"
                            style={{
                              backgroundColor: theme.id === "warm" ? "#f0e6d8" : theme.id === "elegant" ? "#f0ece7" : "#f3f4f6",
                              color: "#555",
                              fontFamily: t.fontBody,
                              border: `1px solid ${borderColor}`,
                            }}
                          >
                            {resolvedName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Category tabs */}
                <div className="overflow-x-auto" style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <div className="flex p-2 gap-1">
                    {sorted.map((cat) => {
                      const catItemCount = menuItems.filter((i) => i.categoryId === cat.id && i.isAvailable).length;
                      if (catItemCount === 0) return null;
                      const catTranslation = selectedLang !== baseLangCode && cat.translations?.[selectedLang];
                      const catName = catTranslation ? catTranslation.name : cat.name;
                      const isActive = effectiveActiveCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setActiveCategory(cat.id)}
                          className="px-3 py-1 text-xs whitespace-nowrap transition-all"
                          style={{
                            fontFamily: theme.id === "elegant" ? t.fontHeading : t.fontBody,
                            fontWeight: theme.id === "elegant" ? 400 : 500,
                            borderRadius: t.borderRadius,
                            backgroundColor: isActive ? t.accentColor : "transparent",
                            color: isActive ? "#fff" : "#777",
                          }}
                        >
                          {catName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Item list */}
                <div className="p-3 space-y-2" style={{ fontFamily: t.fontBody }}>
                  {filteredItems.length === 0 ? (
                    <p className="text-center py-6 text-xs" style={{ color: "#999" }}>
                      No items in this category
                    </p>
                  ) : (
                    filteredItems.map((item) => (
                      <PreviewMenuItem
                        key={item.id}
                        item={item}
                        themeId={theme.id as GuestThemeId}
                        preview={t}
                        selectedLang={selectedLang}
                        baseLang={baseLangCode}
                        highlighted={item.id === highlightedItemId}
                        currency={currency}
                      />
                    ))
                  )}
                </div>

                {/* Footer */}
                <div
                  className="p-3 text-center text-[10px]"
                  style={{ borderTop: `1px solid ${borderColor}`, color: "#bbb", fontFamily: t.fontBody }}
                >
                  Powered by{" "}
                  <span style={{ fontFamily: t.fontHeading, color: t.accentColor }}>Dain</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Share CTA — sticky at bottom */}
      {hasItems && (
        <div className="shrink-0 border-t p-3 space-y-2 bg-background">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs gap-2"
            onClick={copyGuestLink}
            data-testid="preview-panel-copy-link"
          >
            {linkCopied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {linkCopied ? "Copied!" : "Copy guest link"}
          </Button>
          {menuReady && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 text-xs gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/qr-codes")}
              data-testid="preview-panel-qr-code"
            >
              <QrCode className="h-3.5 w-3.5" />
              Get QR code →
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Themed item renderer (mirrors GuestPreview's ThemedMenuItem) ──────────────

function PreviewMenuItem({
  item, themeId, preview, selectedLang, baseLang, highlighted = false, currency = "USD",
}: {
  item: MenuItem;
  themeId: GuestThemeId;
  preview: ReturnType<typeof getGuestTheme>["preview"];
  selectedLang: string;
  baseLang: string;
  highlighted?: boolean;
  currency?: string;
}) {
  const resolved = resolveTranslation(
    { name: item.name, description: item.description },
    item.translations,
    selectedLang,
    baseLang
  );

  // Elegant / Maison
  if (themeId === "elegant") {
    return (
      <div
        className="py-3 transition-colors duration-500"
        style={{
          borderBottom: "1px solid #e8e4df",
          backgroundColor: highlighted ? "#f0ece7" : "transparent",
          opacity: item.soldOut ? 0.7 : 1,
        }}
      >
        <div className="flex gap-2 items-start">
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline gap-2">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span
                  className="text-sm"
                  style={{
                    fontFamily: preview.fontHeading,
                    color: item.soldOut ? "#aaa" : item.isPopular ? preview.accentColor : "inherit",
                    textDecoration: item.soldOut ? "line-through" : undefined,
                  }}
                >
                  {resolved.name}
                </span>
                {item.soldOut && (
                  <span className="text-[8px] px-1 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "#f0ece7", color: "#999" }}>Sold out</span>
                )}
                {!item.soldOut && item.isPopular && (
                  <Star className="h-3 w-3 shrink-0" style={{ color: preview.accentColor, fill: preview.accentColor }} />
                )}
                {resolved.isFallback && selectedLang !== baseLang && (
                  <span className="text-[8px] px-1 py-0.5 rounded shrink-0" style={{ backgroundColor: "#f0ece7", color: "#999" }}>{baseLang.toUpperCase()}</span>
                )}
              </div>
              <span className="text-sm shrink-0" style={{ fontFamily: preview.fontHeading, color: item.soldOut ? "#bbb" : "#444" }}>
                {formatPrice(item.price, currency)}
              </span>
            </div>
            {!item.soldOut && resolved.description && (
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "#888", fontStyle: "italic" }}>
                {resolved.description}
              </p>
            )}
            {!item.soldOut && (item.allergens.length > 0 || item.calories) && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {item.allergens.map((a) => (
                  <span key={a} className="text-[9px] capitalize px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#f0ece7", color: "#8b7355" }}>{a}</span>
                ))}
                {item.calories && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#f0ece7", color: "#8b7355" }}>{item.calories} cal</span>
                )}
              </div>
            )}
          </div>
          {item.image && (
            <img src={item.image} alt={resolved.name} className="w-12 h-12 shrink-0 object-cover rounded" style={{ filter: item.soldOut ? "grayscale(60%)" : undefined }} />
          )}
        </div>
      </div>
    );
  }

  // Contemporary / Studio
  if (themeId === "contemporary") {
    return (
      <div
        className="p-3 transition-all duration-500"
        style={{
          backgroundColor: preview.cardBg,
          borderRadius: preview.borderRadius,
          border: item.soldOut ? "1px solid #e5e7eb" : item.isPopular ? `1px solid ${preview.accentColor}30` : "1px solid #e5e7eb",
          borderLeft: !item.soldOut && item.isPopular ? `3px solid ${preview.accentColor}` : undefined,
          boxShadow: highlighted ? `0 0 0 2px ${preview.accentColor}` : undefined,
          opacity: item.soldOut ? 0.65 : 1,
        }}
      >
        <div className="flex gap-2 items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className="text-xs font-semibold"
                    style={{ fontFamily: preview.fontHeading, textDecoration: item.soldOut ? "line-through" : undefined, color: item.soldOut ? "#9ca3af" : undefined }}
                  >
                    {resolved.name}
                  </span>
                  {item.soldOut && (
                    <span className="text-[8px] px-1 py-0.5 rounded font-medium shrink-0" style={{ backgroundColor: "#f3f4f6", color: "#6b7280" }}>SOLD OUT</span>
                  )}
                  {!item.soldOut && item.isPopular && (
                    <span className="text-[8px] px-1 py-0.5 rounded font-medium shrink-0" style={{ backgroundColor: preview.accentColor, color: "#fff" }}>POPULAR</span>
                  )}
                  {resolved.isFallback && selectedLang !== baseLang && (
                    <span className="text-[8px] px-1 py-0.5 rounded shrink-0" style={{ backgroundColor: "#f3f4f6", color: "#999" }}>{baseLang.toUpperCase()}</span>
                  )}
                </div>
                {!item.soldOut && resolved.description && (
                  <p className="mt-0.5 text-[10px] leading-relaxed" style={{ color: "#6b7280" }}>{resolved.description}</p>
                )}
              </div>
              <span className="text-xs font-bold shrink-0" style={{ color: item.soldOut ? "#9ca3af" : "#111" }}>{formatPrice(item.price, currency)}</span>
            </div>
            {!item.soldOut && (item.allergens.length > 0 || item.calories) && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {item.allergens.map((a) => (
                  <span key={a} className="text-[9px] capitalize px-1.5 py-0.5 rounded-md font-medium" style={{ backgroundColor: "#f3f4f6", color: "#374151" }}>{a}</span>
                ))}
                {item.calories && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium" style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}>{item.calories} cal</span>
                )}
              </div>
            )}
          </div>
          {item.image && (
            <img src={item.image} alt={resolved.name} className="w-12 h-12 shrink-0 object-cover" style={{ borderRadius: preview.borderRadius, filter: item.soldOut ? "grayscale(50%)" : undefined }} />
          )}
        </div>
      </div>
    );
  }

  // Warm / Osteria + custom fallback
  const bg = themeId === "warm" && item.isPopular && !item.soldOut ? "#fef5ec" : preview.cardBg;
  const highlightBg = highlighted && themeId === "warm" ? "#fde8ce" : bg;
  return (
    <div
      className="p-3 transition-colors duration-500"
      style={{
        backgroundColor: item.soldOut ? preview.cardBg : highlightBg,
        borderRadius: preview.borderRadius,
        border: themeId === "warm" ? "1px solid #e8ddd0" : "1px solid #e5e7eb",
        opacity: item.soldOut ? 0.65 : 1,
      }}
    >
      <div className="flex gap-2 items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="text-sm"
                  style={{
                    fontFamily: preview.fontHeading,
                    textDecoration: item.soldOut ? "line-through" : undefined,
                    color: item.soldOut ? "#aaa" : undefined,
                  }}
                >
                  {resolved.name}
                </span>
                {item.soldOut && (
                  <span className="text-[8px] px-1 py-0.5 shrink-0" style={{ borderRadius: preview.borderRadius, backgroundColor: themeId === "warm" ? "#f0e6d8" : "#f3f4f6", color: "#999" }}>
                    Sold out
                  </span>
                )}
                {!item.soldOut && item.isPopular && (
                  <Star className="h-3.5 w-3.5 shrink-0" style={{ color: preview.accentColor, fill: preview.accentColor }} />
                )}
                {resolved.isFallback && selectedLang !== baseLang && (
                  <span className="text-[8px] px-1 py-0.5 rounded-full shrink-0" style={{ backgroundColor: themeId === "warm" ? "#f0e6d8" : "#f3f4f6", color: "#999" }}>
                    {baseLang.toUpperCase()}
                  </span>
                )}
              </div>
              {!item.soldOut && resolved.description && (
                <p className="mt-1 text-xs leading-relaxed" style={{ color: themeId === "warm" ? "#8a7562" : "#6b7280" }}>
                  {resolved.description}
                </p>
              )}
            </div>
            <span className="shrink-0 text-sm" style={{ fontFamily: preview.fontHeading, color: item.soldOut ? "#bbb" : themeId === "warm" ? "#5c3d2e" : "#333" }}>
              {formatPrice(item.price, currency)}
            </span>
          </div>
          {!item.soldOut && (item.allergens.length > 0 || item.calories) && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.allergens.map((a) => (
                <span key={a} className="text-[9px] capitalize px-1.5 py-0.5" style={{ borderRadius: preview.borderRadius, backgroundColor: themeId === "warm" ? "#f0e6d8" : "#f3f4f6", color: themeId === "warm" ? "#7a5540" : "#374151" }}>
                  {a}
                </span>
              ))}
              {item.calories && (
                <span className="text-[9px] px-1.5 py-0.5 flex items-center gap-0.5" style={{ borderRadius: preview.borderRadius, backgroundColor: themeId === "warm" ? "#f0e6d8" : "#eff6ff", color: themeId === "warm" ? "#7a5540" : "#6366f1" }}>
                  <Leaf className="h-2 w-2" /> {item.calories} cal
                </span>
              )}
            </div>
          )}
        </div>
        {item.image && (
          <img src={item.image} alt={resolved.name} className="w-12 h-12 shrink-0 object-cover" style={{ borderRadius: preview.borderRadius, filter: item.soldOut ? "grayscale(50%)" : undefined }} />
        )}
      </div>
    </div>
  );
}
