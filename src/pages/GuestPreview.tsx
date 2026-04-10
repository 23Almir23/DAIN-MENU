import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBilling } from "@/hooks/use-billing";
import { useMenu } from "@/hooks/use-menu";
import { useRestaurant } from "@/hooks/use-restaurant";
import { usePublicMenu } from "@/hooks/use-public-menu";
import { usePublicRestaurant } from "@/hooks/use-public-restaurant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Star, Leaf, Smartphone, Monitor, ChefHat, Globe, Palette, Check, Lock, QrCode, X, Sparkles, Copy, MapPin, Phone, Wifi } from "lucide-react";
import { sortCategories, formatPrice } from "@/lib/menu-utils";
import {
  resolveTranslation,
  getAvailableLanguages,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  getLanguage,
} from "@/lib/i18n-utils";
import { PageWrapper } from "@/components/PageWrapper";
import { PageHeader } from "@/components/PageHeader";
import { Eye } from "lucide-react";
import { GUEST_THEMES, getGuestTheme, type GuestThemeId } from "@/data/guest-themes";
import { getTemplateVars } from "@/lib/themes";
import { toast } from "sonner";
import type { MenuItem } from "@/types/menu";

interface GuestPreviewProps {
  standalone?: boolean;
}

export default function GuestPreview({ standalone = false }: GuestPreviewProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const restaurantId = standalone ? (searchParams.get("r") ?? null) : null;

  // Authenticated hooks — disabled in standalone mode (guests have no session)
  const { plan } = useBilling(!standalone);
  const { categories: authCategories, menuItems: authMenuItems, isLoading: authMenuLoading } = useMenu(!standalone);
  const { restaurant: authRestaurant } = useRestaurant(!standalone);

  // Public hooks — enabled only in standalone mode
  const { categories: pubCategories, menuItems: pubMenuItems, isLoading: pubMenuLoading, isError: pubMenuError } = usePublicMenu(restaurantId, standalone);
  const { restaurant: pubRestaurant, isLoading: pubRestaurantLoading, isNotFound: pubRestaurantNotFound, isError: pubRestaurantError } = usePublicRestaurant(restaurantId, standalone);

  // Unified data — standalone uses public API, admin uses auth hooks
  const categories = standalone ? pubCategories : authCategories;
  const menuItems = standalone ? pubMenuItems : authMenuItems;
  const isLoading = standalone ? (pubMenuLoading || pubRestaurantLoading) : authMenuLoading;
  const restaurant = standalone ? pubRestaurant : authRestaurant;

  const queryClient = useQueryClient();
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [selectedLang, setSelectedLang] = useState(DEFAULT_LANGUAGE);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const hasAutoSelected = useRef(false);

  // Signal that the operator has opened preview (used by useActivation milestone #3).
  // Only fires in admin mode (non-standalone) once menu data has loaded.
  useEffect(() => {
    if (!standalone && menuItems.length > 0) {
      localStorage.setItem("menuai_preview_opened", "1");
    }
  }, [standalone, menuItems.length]);

  // Inject social/SEO meta tags for the public guest page.
  // Fires once restaurant data loads; cleans up on unmount.
  useEffect(() => {
    if (!standalone || !restaurant) return;

    const title = `${restaurant.name} — Menu`;
    const description = restaurant.cuisine
      ? `Browse the menu at ${restaurant.name}. ${restaurant.cuisine} cuisine.`
      : `Browse the menu at ${restaurant.name}.`;

    document.title = title;

    const upsertMeta = (attr: "name" | "property", key: string, value: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.content = value;
    };

    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", window.location.href);
    upsertMeta("property", "og:type", "website");

    return () => {
      document.title = "Dain Menu";
    };
  }, [standalone, restaurant?.name, restaurant?.cuisine]);

  // Share nudge — shown once in admin mode until dismissed
  const [showShareNudge, setShowShareNudge] = useState(
    () => !standalone && !localStorage.getItem("menuai_share_nudge_dismissed")
  );

  const dismissShareNudge = () => {
    localStorage.setItem("menuai_share_nudge_dismissed", "1");
    setShowShareNudge(false);
  };

  const themeMutation = useMutation({
    mutationFn: (guestTheme: GuestThemeId) =>
      fetch("/api/restaurant", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestTheme }),
      }).then((r) => { if (!r.ok) throw new Error("Failed to save theme"); return r.json(); }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/restaurant"] }),
  });

  const theme = getGuestTheme((restaurant?.guestTheme || "elegant") as GuestThemeId);
  const templateVars = getTemplateVars(restaurant?.template ?? restaurant?.guestTheme);
  const sorted = sortCategories(categories);
  const [activeCategory, setActiveCategory] = useState(sorted[0]?.id || "");

  // In standalone mode, fallback must target the first category that actually has available items,
  // because empty categories are hidden from the tab bar. Falling back to sorted[0] when it has no
  // available items would leave guests stuck on "No items available" even when other tabs have items.
  const firstAvailableCategoryId = standalone
    ? sorted.find((c) => menuItems.some((i) => i.categoryId === c.id && i.isAvailable))?.id ?? sorted[0]?.id ?? ""
    : sorted[0]?.id ?? "";

  // Resolve the active tab: falls back to first category after data loads (fixes blank-list race on initial mount).
  // In standalone mode also require the active category to have at least one available item —
  // otherwise a user could be stuck on an empty hidden tab even when firstAvailableCategoryId is correct.
  const activeCategoryHasItems =
    !standalone || menuItems.some((i) => i.categoryId === activeCategory && i.isAvailable);

  const effectiveActiveCategory =
    activeCategory && sorted.some((c) => c.id === activeCategory) && activeCategoryHasItems
      ? activeCategory
      : firstAvailableCategoryId;

  const filteredItems = menuItems.filter((i) => i.categoryId === effectiveActiveCategory && i.isAvailable);
  const hasAnyItems = menuItems.some((i) => i.isAvailable);
  const popularItems = useMemo(
    () => menuItems.filter((i) => i.isPopular && i.isAvailable),
    [menuItems]
  );

  const specialItems = useMemo(
    () => menuItems.filter((i) => i.isSpecial && i.isAvailable && !i.soldOut),
    [menuItems]
  );

  const availableLangs = useMemo(
    () => getAvailableLanguages(menuItems, categories),
    [menuItems, categories]
  );
  const showLanguageSwitcher = availableLangs.length > 0;

  // The restaurant's base language (e.g. "de" for a German restaurant).
  // Defaults to DEFAULT_LANGUAGE while restaurant is still loading.
  const baseLangCode = restaurant?.baseLanguage ?? DEFAULT_LANGUAGE;

  // Currency for price formatting. Defaults to USD while restaurant is loading.
  const currency = restaurant?.currency ?? "USD";

  // Language switcher options: base language first, then available translations (deduped).
  const languageOptions = useMemo(() => {
    const codes = [baseLangCode, ...availableLangs.filter(l => l !== baseLangCode)];
    return codes
      .map((code) => getLanguage(code))
      .filter(Boolean) as typeof SUPPORTED_LANGUAGES;
  }, [availableLangs, baseLangCode]);

  // Auto-select the guest's likely language on first load.
  // Priority: (1) navigator language if it matches an available translation,
  //           (2) restaurant's defaultLocale if it matches an available translation,
  //           (3) the restaurant's base language as the final fallback.
  // Fires only once per mount — never overrides a manual language pick.
  useEffect(() => {
    if (hasAutoSelected.current) return;
    if (isLoading) return;

    const navLang = (navigator.language ?? "").split("-")[0].toLowerCase();
    const defaultLocale = restaurant?.defaultLocale;

    if (navLang && navLang !== baseLangCode && availableLangs.includes(navLang)) {
      // Browser language matches an available translation → use it
      setSelectedLang(navLang);
    } else if (defaultLocale && defaultLocale !== baseLangCode && availableLangs.includes(defaultLocale)) {
      // Restaurant's configured default locale matches an available translation → use it
      setSelectedLang(defaultLocale);
    } else {
      // Fall back to the restaurant's base language
      setSelectedLang(baseLangCode);
    }
    hasAutoSelected.current = true;
  }, [isLoading, availableLangs, baseLangCode, restaurant]);

  const selectTheme = (id: GuestThemeId) => {
    if (id === "custom" && plan === "free") {
      toast.info("Custom branding is a paid plan feature. During early access all plans are free — upgrade to Starter or Pro on the Plan & Credits page.");
      return;
    }
    themeMutation.mutate(id);
    toast.success(`Guest menu theme set to "${GUEST_THEMES.find(t => t.id === id)?.name}"`);
  };

  // ── Guest view renderer ──

  const renderMenu = (forceMobile = false, frame = true) => {
    const isMobile = forceMobile || device === "mobile";
    const width = isMobile ? "w-full max-w-[480px]" : "w-full max-w-2xl";

    // Active category info for banner/heading
    const activeCat = sorted.find((c) => c.id === effectiveActiveCategory);
    const catTrans = selectedLang !== baseLangCode && activeCat?.translations?.[selectedLang];
    const activeCatName = catTrans ? catTrans.name : activeCat?.name ?? "";
    const catHasPhotos = filteredItems.some((i) => i.image);
    const catBannerImage = filteredItems.find((i) => i.image)?.image as string | undefined;

    return (
      <div
        className={`overflow-hidden transition-all ${frame ? "shadow-2xl" : ""} ${width}`}
        style={{
          ...templateVars,
          borderRadius: frame ? "1.25rem" : 0,
          backgroundColor: "var(--bg)",
          minHeight: 600,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        {/* Cover photo header */}
        <div className="relative" style={{ height: 200, backgroundColor: "var(--bg-card)" }}>
          {restaurant?.coverImage ? (
            <img
              src={restaurant.coverImage}
              alt={restaurant.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ backgroundColor: "var(--accent)", opacity: 0.08 }}
            />
          )}
          {/* Language switcher overlay — top right */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
            {languageOptions.length === 1 ? (
              <span
                className="px-2.5 py-1 rounded-full text-xs backdrop-blur-sm flex items-center gap-1"
                style={{ backgroundColor: "rgba(0,0,0,0.45)", color: "#fff" }}
              >
                <Globe className="h-3 w-3" />
                <span>{languageOptions[0].flag}</span> {languageOptions[0].nativeLabel}
              </span>
            ) : (
              languageOptions.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLang(lang.code)}
                  className="px-2.5 py-1 rounded-full text-xs backdrop-blur-sm transition-all flex items-center gap-1"
                  style={{
                    backgroundColor: selectedLang === lang.code ? "var(--accent)" : "rgba(0,0,0,0.4)",
                    color: "#fff",
                  }}
                >
                  <span>{lang.flag}</span> {lang.nativeLabel}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Info card — overlaps the cover photo by 20px */}
        <div
          className="mx-4 rounded-2xl px-5 py-4 relative -mt-5 shadow-sm"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <h2
            className="text-xl font-bold leading-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {restaurant?.name ?? ""}
          </h2>
          {restaurant?.cuisine && (
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {restaurant.cuisine}
            </p>
          )}
          <div className="flex flex-wrap gap-3 mt-3">
            {(restaurant?.address || restaurant?.city) && (
              <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {[restaurant.address, restaurant.city].filter(Boolean).join(", ")}
              </span>
            )}
            {restaurant?.phone && (
              <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {restaurant.phone}
              </span>
            )}
            {restaurant?.guestContactInfo && (
              <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                <Wifi className="h-3.5 w-3.5 shrink-0" />
                {restaurant.guestContactInfo}
              </span>
            )}
          </div>
        </div>

        {/* Empty state */}
        {isLoading ? null : !hasAnyItems ? (
          <div className="py-16 text-center px-6">
            <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
              {standalone ? "Menu coming soon" : "No items yet"}
            </p>
            <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
              {standalone ? "Check back shortly — we're preparing something delicious." : "Add items in Menu Builder to see them here."}
            </p>
          </div>
        ) : (
          <>
            {/* Today's Specials section */}
            {specialItems.length > 0 && (
              <div
                className="px-4 py-4"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-1.5 mb-3">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                  <p className="text-[10px] uppercase" style={{ color: "var(--accent)", letterSpacing: "0.08em" }}>
                    Today&apos;s Specials
                  </p>
                </div>
                <div className="space-y-2">
                  {specialItems.map((item) => {
                    const resolved = resolveTranslation(
                      { name: item.name, description: item.description },
                      item.translations,
                      selectedLang,
                      baseLangCode
                    );
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl flex items-start gap-3"
                        style={{ backgroundColor: "var(--bg-card)", borderLeft: "3px solid var(--accent)", border: "1px solid var(--border)", borderLeftWidth: 3, borderLeftColor: "var(--accent)" }}
                      >
                        {item.image && (
                          <img src={item.image} alt={resolved.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{resolved.name}</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ backgroundColor: "var(--accent)", color: "#fff" }}>Special</span>
                              </div>
                              {resolved.description && (
                                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{resolved.description}</p>
                              )}
                            </div>
                            <span className="text-sm font-bold shrink-0" style={{ color: "var(--price-color)" }}>{formatPrice(item.price, currency)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Popular dishes strip */}
            {popularItems.length > 0 && (
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="text-[10px] uppercase mb-2" style={{ color: "var(--accent)", letterSpacing: "0.08em" }}>
                  Popular dishes
                </p>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
                  {popularItems.map((item) => {
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
                        className="flex-none flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors"
                        style={{ backgroundColor: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                      >
                        {item.image && (
                          <img src={item.image} alt={resolvedName} className="w-4 h-4 rounded-full object-cover shrink-0" />
                        )}
                        <span>{resolvedName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category pill tabs */}
            <div className="overflow-x-auto scrollbar-hide" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex px-4 py-3 gap-2">
                {sorted.map((cat) => {
                  const catItemCount = menuItems.filter((i) => i.categoryId === cat.id && i.isAvailable).length;
                  if (catItemCount === 0 && standalone) return null;
                  const catTranslation = selectedLang !== baseLangCode && cat.translations?.[selectedLang];
                  const catName = catTranslation ? catTranslation.name : cat.name;
                  const catIsFallback = !catTranslation && selectedLang !== baseLangCode;
                  const isActive = effectiveActiveCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className="px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all flex items-center gap-1 font-medium"
                      style={{
                        backgroundColor: isActive ? "var(--accent)" : "var(--bg-card)",
                        color: isActive ? "#fff" : "var(--text-secondary)",
                        border: isActive ? "1px solid var(--accent)" : "1px solid var(--border)",
                      }}
                    >
                      {catName}
                      {catIsFallback && (
                        <span className="text-[8px] opacity-60 leading-none" style={{ color: isActive ? "#fff" : "#999" }}>
                          {baseLangCode.toUpperCase()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Items */}
            <div className="p-4 space-y-3">
              {filteredItems.length === 0 ? (
                <p className="text-center py-8" style={{ color: "var(--text-secondary)" }}>No items available in this category</p>
              ) : (
                filteredItems.map((item) =>
                  item.image ? (
                    <GuestItemCard
                      key={item.id}
                      item={item}
                      selectedLang={selectedLang}
                      baseLang={baseLangCode}
                      highlighted={item.id === highlightedItemId}
                      currency={currency}
                    />
                  ) : (
                    <GuestItemRow
                      key={item.id}
                      item={item}
                      selectedLang={selectedLang}
                      baseLang={baseLangCode}
                      highlighted={item.id === highlightedItemId}
                      currency={currency}
                    />
                  )
                )
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div
          className="p-4 text-center text-xs"
          style={{ borderTop: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          Powered by <span style={{ color: "var(--accent)", fontWeight: 600 }}>Dain</span>
        </div>
      </div>
    );
  };

  // ── Standalone guest mode ──
  if (standalone) {
    // Visited /guest with no ?r= param — likely a mis-click or broken link
    if (!restaurantId) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6" style={{ backgroundColor: "#fafafa" }}>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <ChefHat className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center max-w-xs">
            <p className="text-xl font-semibold tracking-tight">Menu not found</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              This link doesn't point to a specific restaurant menu. Ask your server for the correct QR code.
            </p>
          </div>
          <a
            href="/"
            className="text-sm text-primary font-medium hover:underline underline-offset-4"
          >
            ← Back to Dain Menu
          </a>
        </div>
      );
    }
    if (!isLoading && pubRestaurantNotFound) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6" style={{ backgroundColor: "#fafafa" }}>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <ChefHat className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center max-w-xs">
            <p className="text-xl font-semibold tracking-tight">Menu not available</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              This menu isn't available right now. Please ask your server for assistance.
            </p>
          </div>
          <a
            href="/"
            className="text-sm text-primary font-medium hover:underline underline-offset-4"
          >
            ← Back to Dain Menu
          </a>
        </div>
      );
    }
    if (!isLoading && (pubRestaurantError || pubMenuError)) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6" style={{ backgroundColor: "#fafafa" }}>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <ChefHat className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center max-w-xs">
            <p className="text-xl font-semibold tracking-tight">Unable to load menu</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Something went wrong loading this menu. Please try again in a moment.
            </p>
          </div>
          <a
            href="/"
            className="text-sm text-primary font-medium hover:underline underline-offset-4"
          >
            ← Back to Dain Menu
          </a>
        </div>
      );
    }
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.preview.bodyBg }}>
          <div className="flex flex-col items-center gap-3" style={{ color: "#999" }}>
            <ChefHat className="h-8 w-8 animate-pulse" style={{ color: theme.preview.accentColor }} />
            <p className="text-sm" style={{ fontFamily: theme.preview.fontBody }}>Loading menu…</p>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col items-center" style={{ backgroundColor: theme.preview.bodyBg }}>
        {renderMenu(true, false)}
      </div>
    );
  }

  // ── Admin preview mode ──
  return (
    <PageWrapper maxWidth="xl">
      <PageHeader title="Guest Preview" icon={Eye} description="This is how your guests see your menu after scanning the QR code.">
        <div className="flex items-center gap-2">
          {showLanguageSwitcher ? (
            <Badge variant="secondary" className="gap-1 rounded-full">
              <Globe className="h-3 w-3" />
              {availableLangs.length} language{availableLangs.length !== 1 ? "s" : ""}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 rounded-full text-muted-foreground">
              <Globe className="h-3 w-3" />
              No translations yet
            </Badge>
          )}
          <Button
            variant={showThemePicker ? "default" : "outline"}
            size="sm"
            onClick={() => setShowThemePicker(!showThemePicker)}
            className="gap-1.5"
          >
            <Palette className="h-4 w-4" />
            {theme.name}
          </Button>
          <div className="flex gap-1 border rounded-xl p-1">
            <Button variant={device === "mobile" ? "default" : "ghost"} size="sm" onClick={() => setDevice("mobile")}>
              <Smartphone className="h-4 w-4" />
            </Button>
            <Button variant={device === "desktop" ? "default" : "ghost"} size="sm" onClick={() => setDevice("desktop")}>
              <Monitor className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PageHeader>

      {/* Share nudge — shown once when operator has items and hasn't dismissed */}
      {showShareNudge && menuItems.length > 0 && (
        <div
          data-testid="banner-share-nudge"
          className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3"
        >
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <QrCode className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">This is exactly what your guests see after scanning the QR code.</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ready to go live? Copy the link or put a QR code on your tables.</p>
            {authRestaurant?.id ? (
              <div className="flex items-center gap-1.5 mt-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/guest?r=${authRestaurant.id}`}
                  className="h-7 text-xs font-mono bg-background"
                  data-testid="input-share-nudge-url"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-7 px-2"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/guest?r=${authRestaurant.id}`).then(() => toast.success("Link copied!")).catch(() => toast.error("Could not copy link"));
                  }}
                  data-testid="button-share-nudge-copy"
                  aria-label="Copy link"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="mt-2 h-7 flex items-center">
                <p className="text-xs text-muted-foreground">Loading your link…</p>
              </div>
            )}
            <div className="mt-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => { dismissShareNudge(); navigate("/qr-codes"); }}
                data-testid="button-share-nudge-qr"
              >
                <QrCode className="h-3.5 w-3.5 mr-1" /> Get QR code →
              </Button>
            </div>
          </div>
          <button
            onClick={dismissShareNudge}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            data-testid="button-share-nudge-dismiss"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Theme Picker */}
      {showThemePicker && (
        <div className="animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-sans-heading">Guest Menu Design</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Choose how guests experience your menu after scanning the QR code.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GUEST_THEMES.map((t) => {
              const isSelected = (restaurant?.guestTheme || "elegant") === t.id;
              const isCustomLocked = t.id === "custom" && plan === "free";
              return (
                <Card
                  key={t.id}
                  className={`cursor-pointer transition-all relative overflow-hidden group ${
                    isSelected ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md"
                  } ${isCustomLocked ? "opacity-80" : ""}`}
                  onClick={() => selectTheme(t.id)}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center z-10">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}
                  {isCustomLocked && (
                    <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-muted flex items-center justify-center z-10">
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}

                  {/* Theme preview swatch */}
                  <div className="h-24 relative overflow-hidden" style={{ background: t.preview.headerBg }}>
                    <div className="absolute bottom-0 left-0 right-0 h-12" style={{ background: `linear-gradient(to top, ${t.preview.bodyBg}, transparent)` }} />
                    {/* Mini card previews */}
                    <div className="absolute bottom-2 left-3 right-3 flex gap-1.5">
                      {[1, 2].map((i) => (
                        <div
                          key={i}
                          className="flex-1 h-6 rounded-sm"
                          style={{
                            backgroundColor: t.preview.cardBg,
                            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <CardContent className="p-4 space-y-2">
                    <div>
                      <h3 className="font-sans-heading text-sm">{t.name}</h3>
                      <p className="text-xs text-muted-foreground">{t.tagline}</p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{t.description}</p>
                    <p className="text-[10px] text-muted-foreground/70 pt-1 border-t">
                      {t.idealFor}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-center">{renderMenu()}</div>
    </PageWrapper>
  );
}

// ── GuestItemCard — item with a photo (16:9 ratio) ──
function GuestItemCard({
  item,
  selectedLang,
  baseLang,
  highlighted = false,
  currency = "USD",
}: {
  item: MenuItem;
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

  return (
    <div
      className="rounded-2xl overflow-hidden transition-colors duration-500"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        outline: highlighted ? "2px solid var(--accent)" : undefined,
        opacity: item.soldOut ? 0.65 : 1,
      }}
    >
      {/* 16:9 image */}
      <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
        <img
          src={item.image as string}
          alt={resolved.name}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: item.soldOut ? "grayscale(40%)" : undefined }}
        />
        {item.soldOut && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: "rgba(0,0,0,0.5)", color: "#fff" }}>
              Sold out
            </span>
          </div>
        )}
        {item.isSpecial && !item.soldOut && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: "var(--accent)", color: "#fff" }}>
            Special
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm leading-snug" style={{ color: "var(--text-primary)", textDecoration: item.soldOut ? "line-through" : undefined }}>
                {resolved.name}
              </span>
              {item.isPopular && !item.soldOut && (
                <Star className="h-3 w-3 shrink-0" style={{ color: "var(--accent)", fill: "var(--accent)" }} />
              )}
              {resolved.isFallback && selectedLang !== baseLang && (
                <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--border)", color: "var(--text-secondary)" }}>{baseLang.toUpperCase()}</span>
              )}
            </div>
            {resolved.description && (
              <p className="text-xs mt-0.5 leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                {resolved.description}
              </p>
            )}
            {item.allergens && item.allergens.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {item.allergens.map((a) => (
                  <span key={a} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
          <span className="font-bold text-sm shrink-0 mt-0.5" style={{ color: "var(--price-color)" }}>
            {formatPrice(item.price, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── GuestItemRow — text-only item (no photo) ──
function GuestItemRow({
  item,
  selectedLang,
  baseLang,
  highlighted = false,
  currency = "USD",
}: {
  item: MenuItem;
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

  return (
    <div
      className="py-3 transition-colors duration-500"
      style={{
        borderBottom: "1px solid var(--border)",
        backgroundColor: highlighted ? "var(--bg-card)" : "transparent",
        opacity: item.soldOut ? 0.65 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="font-semibold text-sm leading-snug"
              style={{ color: "var(--text-primary)", textDecoration: item.soldOut ? "line-through" : undefined }}
            >
              {resolved.name}
            </span>
            {item.soldOut && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--border)", color: "var(--text-secondary)" }}>Sold out</span>
            )}
            {item.isSpecial && !item.soldOut && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "var(--accent)", color: "#fff" }}>Special</span>
            )}
            {item.isPopular && !item.soldOut && (
              <Star className="h-3 w-3 shrink-0" style={{ color: "var(--accent)", fill: "var(--accent)" }} />
            )}
            {resolved.isFallback && selectedLang !== baseLang && (
              <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--border)", color: "var(--text-secondary)" }}>{baseLang.toUpperCase()}</span>
            )}
          </div>
          {resolved.description && (
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {resolved.description}
            </p>
          )}
          {item.allergens && item.allergens.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {item.allergens.map((a) => (
                <span key={a} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="font-bold text-sm shrink-0 mt-0.5" style={{ color: "var(--price-color)" }}>
          {formatPrice(item.price, currency)}
        </span>
      </div>
    </div>
  );
}

function ThemedMenuItem({
  item,
  themeId,
  preview,
  selectedLang,
  baseLang,
  highlighted = false,
  currency = "USD",
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

  // ── Elegant / Maison ──
  if (themeId === "elegant") {
    return (
      <div
        className="py-4 transition-colors duration-500"
        style={{
          borderBottom: "1px solid #e8e4df",
          backgroundColor: highlighted ? "#f0ece7" : "transparent",
          opacity: item.soldOut ? 0.7 : 1,
        }}
      >
        <div className="flex gap-3 items-start">
          {/* Text block */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline gap-2">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span
                  style={{
                    fontFamily: preview.fontHeading,
                    fontSize: "1rem",
                    color: item.soldOut ? "#aaa" : item.isPopular ? preview.accentColor : "inherit",
                    textDecoration: item.soldOut ? "line-through" : undefined,
                  }}
                >
                  {resolved.name}
                </span>
                {item.soldOut && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "#f0ece7", color: "#999", letterSpacing: "0.04em" }}>Sold out</span>
                )}
                {!item.soldOut && item.isPopular && (
                  <Star className="h-3 w-3 shrink-0" style={{ color: preview.accentColor, fill: preview.accentColor }} />
                )}
                {resolved.isFallback && selectedLang !== baseLang && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: "#f0ece7", color: "#999" }}>{baseLang.toUpperCase()}</span>
                )}
              </div>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <span className="h-px w-5" style={{ backgroundColor: "#e8e4df" }} />
                <span style={{ fontFamily: preview.fontHeading, color: item.soldOut ? "#bbb" : "#444" }}>{formatPrice(item.price, currency)}</span>
              </div>
            </div>
            {!item.soldOut && resolved.description && (
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "#888", fontStyle: "italic" }}>{resolved.description}</p>
            )}
            {!item.soldOut && (item.allergens.length > 0 || item.calories) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {item.allergens.map((a) => (
                  <span key={a} className="text-[10px] capitalize px-2 py-0.5 rounded-full" style={{ backgroundColor: "#f0ece7", color: "#8b7355" }}>{a}</span>
                ))}
                {item.calories && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#f0ece7", color: "#8b7355" }}>
                    {item.calories} cal
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Thumbnail — only when an image exists */}
          {item.image && (
            <img
              src={item.image}
              alt={resolved.name}
              className="w-14 h-14 shrink-0 object-cover"
              style={{ borderRadius: "0.375rem", filter: item.soldOut ? "grayscale(60%)" : undefined }}
            />
          )}
        </div>
      </div>
    );
  }

  // ── Contemporary / Studio ──
  if (themeId === "contemporary") {
    return (
      <div
        className="p-4 transition-all duration-500 hover:shadow-sm"
        style={{
          backgroundColor: preview.cardBg,
          borderRadius: preview.borderRadius,
          border: item.soldOut ? "1px solid #e5e7eb" : item.isPopular ? `1px solid ${preview.accentColor}30` : "1px solid #e5e7eb",
          borderLeft: item.soldOut ? undefined : item.isPopular ? `3px solid ${preview.accentColor}` : undefined,
          boxShadow: highlighted ? `0 0 0 2px ${preview.accentColor}` : undefined,
          opacity: item.soldOut ? 0.65 : 1,
        }}
      >
        <div className="flex gap-3 items-start">
          {/* Text + price block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-sm"
                    style={{ fontFamily: preview.fontHeading, fontWeight: 600, textDecoration: item.soldOut ? "line-through" : undefined, color: item.soldOut ? "#9ca3af" : undefined }}
                  >
                    {resolved.name}
                  </span>
                  {item.soldOut && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0" style={{ backgroundColor: "#f3f4f6", color: "#6b7280" }}>SOLD OUT</span>
                  )}
                  {!item.soldOut && item.isPopular && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0"
                      style={{ backgroundColor: preview.accentColor, color: "#fff" }}
                    >
                      POPULAR
                    </span>
                  )}
                  {resolved.isFallback && selectedLang !== baseLang && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: "#f3f4f6", color: "#999" }}>{baseLang.toUpperCase()}</span>
                  )}
                </div>
                {!item.soldOut && resolved.description && (
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: "#6b7280" }}>{resolved.description}</p>
                )}
              </div>
              <span className="text-sm font-bold shrink-0" style={{ color: item.soldOut ? "#9ca3af" : "#111" }}>{formatPrice(item.price, currency)}</span>
            </div>
            {!item.soldOut && (item.allergens.length > 0 || item.calories) && (
              <div className="flex flex-wrap gap-1 mt-2.5">
                {item.allergens.map((a) => (
                  <span key={a} className="text-[10px] capitalize px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: "#f3f4f6", color: "#374151" }}>{a}</span>
                ))}
                {item.calories && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}>
                    {item.calories} cal
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Thumbnail — only when an image exists */}
          {item.image && (
            <img
              src={item.image}
              alt={resolved.name}
              className="w-16 h-16 shrink-0 object-cover"
              style={{ borderRadius: preview.borderRadius, filter: item.soldOut ? "grayscale(50%)" : undefined }}
            />
          )}
        </div>
      </div>
    );
  }

  // ── Warm / Osteria + Custom (fallback) ──
  const warmPopularBg = themeId === "warm" && item.isPopular && !item.soldOut ? "#fef5ec" : preview.cardBg;
  const warmHighlightBg = themeId === "warm" && highlighted ? "#fde8ce" : warmPopularBg;
  return (
    <div
      className="p-4 transition-colors duration-500"
      style={{
        backgroundColor: item.soldOut ? preview.cardBg : warmHighlightBg,
        borderRadius: preview.borderRadius,
        border: themeId === "warm" ? "1px solid #e8ddd0" : "1px solid #e5e7eb",
        opacity: item.soldOut ? 0.65 : 1,
      }}
    >
      <div className="flex gap-3 items-start">
        {/* Text + price block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  style={{
                    fontFamily: preview.fontHeading,
                    fontSize: "0.9375rem",
                    textDecoration: item.soldOut ? "line-through" : undefined,
                    color: item.soldOut ? "#aaa" : undefined,
                  }}
                >
                  {resolved.name}
                </span>
                {item.soldOut && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 shrink-0"
                    style={{ borderRadius: preview.borderRadius, backgroundColor: themeId === "warm" ? "#f0e6d8" : "#f3f4f6", color: "#999" }}
                  >
                    Sold out
                  </span>
                )}
                {!item.soldOut && item.isPopular && (
                  <Star
                    className="h-4 w-4 shrink-0"
                    style={{ color: preview.accentColor, fill: preview.accentColor }}
                  />
                )}
                {resolved.isFallback && selectedLang !== baseLang && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: themeId === "warm" ? "#f0e6d8" : "#f3f4f6", color: "#999" }}>{baseLang.toUpperCase()}</span>
                )}
              </div>
              {!item.soldOut && resolved.description && (
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: themeId === "warm" ? "#8a7562" : "#6b7280" }}>{resolved.description}</p>
              )}
            </div>
            <span className="shrink-0" style={{ fontFamily: preview.fontHeading, fontSize: "1.05rem", color: item.soldOut ? "#bbb" : themeId === "warm" ? "#5c3d2e" : "#333" }}>
              {formatPrice(item.price, currency)}
            </span>
          </div>
          {!item.soldOut && (item.allergens.length > 0 || item.calories) && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {item.allergens.map((a) => (
                <span
                  key={a}
                  className="text-[10px] capitalize px-2 py-0.5"
                  style={{
                    borderRadius: preview.borderRadius,
                    backgroundColor: themeId === "warm" ? "#f0e6d8" : "#f3f4f6",
                    color: themeId === "warm" ? "#7a5540" : "#374151",
                  }}
                >
                  {a}
                </span>
              ))}
              {item.calories && (
                <span
                  className="text-[10px] px-2 py-0.5 flex items-center gap-0.5"
                  style={{
                    borderRadius: preview.borderRadius,
                    backgroundColor: themeId === "warm" ? "#f0e6d8" : "#eff6ff",
                    color: themeId === "warm" ? "#7a5540" : "#6366f1",
                  }}
                >
                  <Leaf className="h-2.5 w-2.5" /> {item.calories} cal
                </span>
              )}
            </div>
          )}
        </div>
        {/* Thumbnail — only when an image exists */}
        {item.image && (
          <img
            src={item.image}
            alt={resolved.name}
            className="w-16 h-16 shrink-0 object-cover"
            style={{ borderRadius: preview.borderRadius, filter: item.soldOut ? "grayscale(50%)" : undefined }}
          />
        )}
      </div>
    </div>
  );
}
