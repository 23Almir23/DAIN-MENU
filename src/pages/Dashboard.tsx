import { useBilling } from "@/hooks/use-billing";
import { useMenuStats } from "@/hooks/use-menu-stats";
import { useMenu } from "@/hooks/use-menu";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useActivation } from "@/hooks/use-activation";
import { useServiceSession } from "@/hooks/use-service-session";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ActivationChecklist } from "@/components/ActivationChecklist";
import {
  UtensilsCrossed, Sparkles, Eye, QrCode, Star, CreditCard, Globe,
  ArrowRight, Upload, CheckCircle2, AlertCircle, ChefHat,
  PlayCircle, StopCircle, X, Ban, Flame, Camera, PenLine,
} from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import type { ElementType } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageWrapper } from "@/components/PageWrapper";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/menu-utils";
import { useMenuReadiness, useAvailableLanguages } from "@/hooks/use-selectors";
import { getLanguage } from "@/lib/i18n-utils";
import { useCopilotContext } from "@/hooks/use-copilot";
import { resolveCopilotSignals } from "@/lib/copilot-signals";
import type { SignalIconKey } from "@/lib/copilot-signals";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function Dashboard() {
  const { credits, plan } = useBilling();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const serviceSectionRef = useRef<HTMLDivElement>(null);
  const { categories, menuItems, isLoading } = useMenu();
  const { restaurant } = useRestaurant();
  const stats = useMenuStats();
  const availableLangs = useAvailableLanguages();
  const readiness = useMenuReadiness();
  const activation = useActivation();
  const { session, isLoading: sessionLoading, start, isStarting, end, isEnding } = useServiceSession();
  const qc = useQueryClient();
  const baseLangCode = restaurant?.baseLanguage ?? "en";
  const baseLangMeta = getLanguage(baseLangCode);

  const { data: copilotCtx, isLoading: copilotLoading, isError: copilotError } = useCopilotContext({ staleTime: 60_000 });
  const buddySignals = copilotCtx ? resolveCopilotSignals(copilotCtx).slice(0, 2) : [];

  const clearSoldOutMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/items/clear-sold-out", { method: "POST", credentials: "include" });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as { message?: string }).message ?? `Error ${r.status}`); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/menu"] });
      toast.success(t("dashboard.toasts.soldOutCleared"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const clearSpecialsMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/items/clear-specials", { method: "POST", credentials: "include" });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as { message?: string }).message ?? `Error ${r.status}`); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/menu"] });
      toast.success(t("dashboard.toasts.specialsCleared"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [serviceCardDismissed, setServiceCardDismissed] = useState(
    () => sessionStorage.getItem("serviceCardDismissed") === "1"
  );
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [startClearSoldOut, setStartClearSoldOut] = useState(false);
  const [startClearSpecials, setStartClearSpecials] = useState(false);
  const [endClearSoldOut, setEndClearSoldOut] = useState(false);
  const [endClearSpecials, setEndClearSpecials] = useState(false);

  const needsReviewItems = menuItems.filter((i) => i.needsReview).length;

  const cmdStateIsActivation =
    !activation.isLoading &&
    menuItems.length > 0 &&
    !session &&
    needsReviewItems === 0 &&
    !(copilotCtx && copilotCtx.missingDescriptions > 0) &&
    !copilotCtx?.translationCoverage.some((tc) => tc.pct > 0 && tc.pct < 100) &&
    !activation.allComplete;

  const soldOutItems = menuItems.filter((i) => i.soldOut);
  const specialItems = menuItems.filter((i) => i.isSpecial);
  const soldOutCount = soldOutItems.length;
  const specialsCount = specialItems.length;
  const showServiceReadinessCard =
    !isLoading && !sessionLoading && !session && !serviceCardDismissed &&
    (soldOutCount > 0 || specialsCount > 0);
  const showInServiceBanner = !sessionLoading && !!session;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("focus") === "service" && serviceSectionRef.current) {
      serviceSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.search]);

  const baseLangDisplay = baseLangMeta
    ? `${baseLangMeta.flag} ${baseLangMeta.nativeLabel}`
    : "🇺🇸 English";
  const guestLangValue = isLoading
    ? "—"
    : availableLangs.length > 0
      ? `${baseLangMeta?.flag ?? "🇺🇸"} +${availableLangs.length}`
      : baseLangMeta?.flag ?? "🇺🇸";
  const guestLangSub = isLoading
    ? ""
    : availableLangs.length > 0
      ? `${baseLangDisplay} → ${t("dashboard.translations", { count: availableLangs.length })}`
      : `${baseLangDisplay} · ${t("dashboard.noTranslations")}`;

  const statCards: { label: string; value: string | number; icon: ElementType; sub: string; link?: { text: string; to: string } | null }[] = [
    { label: t("dashboard.stats.menuItems"), value: isLoading ? "—" : stats.totalItems, icon: UtensilsCrossed, sub: isLoading ? "" : t("dashboard.stats.available", { count: stats.availableItems }) },
    { label: t("dashboard.stats.guestLanguages"), value: guestLangValue, icon: Globe, sub: guestLangSub },
    { label: t("dashboard.stats.popularItems"), value: isLoading ? "—" : stats.popularItems, icon: Star, sub: isLoading ? "" : t("dashboard.stats.highlightedForGuests") },
    { label: t("dashboard.stats.aiCredits"), value: credits, icon: CreditCard, sub: t("dashboard.stats.planLabel", { plan }) },
  ];

  return (
    <PageWrapper maxWidth="xl">
      <div>
        <h1 className="text-3xl font-serif tracking-tight">{restaurant?.name ?? ""}</h1>
        <p className="text-muted-foreground mt-2">
          {isLoading ? t("dashboard.loadingMenu") : (
            <>
              {t("dashboard.itemCount", { count: stats.totalItems, cats: stats.totalCategories })}
              {availableLangs.length > 0 && t("dashboard.guestLangSuffix", { count: availableLangs.length })}
            </>
          )}
        </p>
      </div>

      <div ref={serviceSectionRef} />

      {/* In-service banner */}
      {showInServiceBanner && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30" data-testid="card-in-service">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
                  <PlayCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-sans-heading text-sm text-green-800 dark:text-green-300">{t("dashboard.service.isLive")}</p>
                  <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
                    {t("dashboard.service.focusLive", { time: new Date(session!.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}
                  </p>
                </div>
              </div>
              {!endDialogOpen ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-400"
                  onClick={() => setEndDialogOpen(true)}
                  data-testid="button-end-service"
                >
                  <StopCircle className="h-4 w-4 mr-1" />
                  {t("dashboard.service.endService")}
                </Button>
              ) : (
                <div className="flex flex-col gap-2 min-w-[200px]">
                  <p className="text-xs text-green-700 dark:text-green-400 font-medium">{t("dashboard.service.resetOnEnd")}</p>
                  {soldOutCount > 0 && (
                    <label className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={endClearSoldOut}
                        onChange={(e) => setEndClearSoldOut(e.target.checked)}
                        className="rounded"
                      />
                      {t("dashboard.service.clearSoldOut", { count: soldOutCount })}
                    </label>
                  )}
                  {specialsCount > 0 && (
                    <label className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={endClearSpecials}
                        onChange={(e) => setEndClearSpecials(e.target.checked)}
                        className="rounded"
                      />
                      {t("dashboard.service.clearSpecials", { count: specialsCount })}
                    </label>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                      onClick={() => setEndDialogOpen(false)}
                    >
                      {t("dashboard.service.cancel")}
                    </Button>
                    <Button
                      size="sm"
                      disabled={isEnding}
                      className="bg-green-600 text-white hover:bg-green-700"
                      onClick={() =>
                        end({
                          soldOutItemIds: endClearSoldOut ? soldOutItems.map((i) => i.id) : [],
                          specialItemIds: endClearSpecials ? specialItems.map((i) => i.id) : [],
                        }, {
                          onSuccess: () => {
                            setEndDialogOpen(false);
                            setEndClearSoldOut(false);
                            setEndClearSpecials(false);
                            toast.success(t("dashboard.toasts.serviceEnded"));
                          },
                          onError: (e: Error) => toast.error(e.message),
                        })
                      }
                      data-testid="button-confirm-end-service"
                    >
                      {isEnding ? t("dashboard.service.endingService") : t("dashboard.service.endService")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service readiness card */}
      {showServiceReadinessCard && (
        <Card className="border-primary/30 bg-primary/[0.03]" data-testid="card-service-readiness">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <PlayCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-sans-heading text-sm">{t("dashboard.service.readyForService")}</p>
                  <button
                    onClick={() => { setServiceCardDismissed(true); sessionStorage.setItem("serviceCardDismissed", "1"); }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={t("common.dismiss")}
                    data-testid="button-dismiss-service-card"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {t("dashboard.service.carryoverDesc", {
                    items: [
                      soldOutCount > 0 ? t("dashboard.service.soldOutCarry", { count: soldOutCount }) : "",
                      specialsCount > 0 ? t("dashboard.service.specialsCarry", { count: specialsCount }) : "",
                    ].filter(Boolean).join(t("dashboard.service.andConnector")),
                  })}
                </p>
                <div className="flex flex-wrap gap-2 mt-3 items-center">
                  {soldOutCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/70 rounded-lg px-3 py-1.5">
                      <Ban className="h-3.5 w-3.5 text-destructive/70" />
                      {t("dashboard.service.soldOutCarry", { count: soldOutCount })}
                    </div>
                  )}
                  {specialsCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/70 rounded-lg px-3 py-1.5">
                      <Flame className="h-3.5 w-3.5 text-primary/70" />
                      {t("dashboard.service.specialsCarry", { count: specialsCount })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex flex-wrap gap-3">
                {soldOutCount > 0 && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none" data-testid="label-clear-sold-out">
                    <input
                      type="checkbox"
                      checked={startClearSoldOut}
                      onChange={(e) => setStartClearSoldOut(e.target.checked)}
                      className="rounded"
                      data-testid="checkbox-clear-sold-out"
                    />
                    <Ban className="h-3 w-3 text-destructive/70" />
                    {t("dashboard.service.startClearSoldOut")}
                  </label>
                )}
                {specialsCount > 0 && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none" data-testid="label-clear-specials">
                    <input
                      type="checkbox"
                      checked={startClearSpecials}
                      onChange={(e) => setStartClearSpecials(e.target.checked)}
                      className="rounded"
                      data-testid="checkbox-clear-specials"
                    />
                    <Flame className="h-3 w-3 text-primary/70" />
                    {t("dashboard.service.startClearSpecials")}
                  </label>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={isStarting}
                  onClick={() => start({
                    soldOutItemIds: startClearSoldOut ? soldOutItems.map((i) => i.id) : [],
                    specialItemIds: startClearSpecials ? specialItems.map((i) => i.id) : [],
                  }, {
                    onSuccess: () => toast.success(t("dashboard.toasts.serviceStarted")),
                    onError: (e: Error) => toast.error(e.message),
                  })}
                  data-testid="button-start-service"
                >
                  <PlayCircle className="h-4 w-4 mr-1.5" />
                  {isStarting ? t("dashboard.starting") : t("dashboard.service.startService")}
                </Button>
                {soldOutCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={clearSoldOutMutation.isPending}
                    onClick={() => clearSoldOutMutation.mutate()}
                    data-testid="button-clear-sold-out"
                  >
                    <Ban className="h-3.5 w-3.5 mr-1.5" />
                    {t("dashboard.sections.clearSoldOut")}
                  </Button>
                )}
                {specialsCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={clearSpecialsMutation.isPending}
                    onClick={() => clearSpecialsMutation.mutate()}
                    data-testid="button-clear-specials"
                  >
                    <Flame className="h-3.5 w-3.5 mr-1.5" />
                    {t("dashboard.sections.clearSpecials")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => { setServiceCardDismissed(true); sessionStorage.setItem("serviceCardDismissed", "1"); }}
                  data-testid="button-not-now-service"
                >
                  {t("dashboard.service.notNow")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty-state: when no items */}
      {!isLoading && menuItems.length === 0 && !session && (
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent overflow-hidden" data-testid="card-empty-import">
          <CardContent className="p-7">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Upload className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold">{t("dashboard.sections.importMenuDesc")}</h2>
                    <Badge className="text-[10px]">{t("dashboard.sections.startHereBadge")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-lg">
                    {t("dashboard.sections.importMenuSub")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => navigate("/setup?stage=choose")} data-testid="button-import-menu-empty">
                    <Upload className="h-4 w-4 mr-2" />
                    {t("dashboard.sections.importYourMenu")}
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/menu")} data-testid="button-add-manually-empty">
                    <UtensilsCrossed className="h-4 w-4 mr-2" />
                    {t("dashboard.sections.addManually")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t("dashboard.sections.importMenuSub")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard command block (NBA) — dynamic text in English (API-state-driven, same policy as copilot signals) */}
      {!activation.isLoading && menuItems.length > 0 && !session && (() => {
        type CmdState =
          | { kind: "needs-review"; n: number }
          | { kind: "missing-descriptions"; n: number }
          | { kind: "incomplete-translation"; langCode: string; langName: string; pct: number; remaining: number }
          | { kind: "activation-incomplete" }
          | { kind: "qr-ready" };

        const cmdState: CmdState = (() => {
          if (needsReviewItems > 0) return { kind: "needs-review", n: needsReviewItems } satisfies CmdState;
          if (copilotCtx && copilotCtx.missingDescriptions > 0) return { kind: "missing-descriptions", n: copilotCtx.missingDescriptions } satisfies CmdState;
          if (copilotCtx) {
            const partial = copilotCtx.translationCoverage
              .filter((c) => c.pct > 0 && c.pct < 100)
              .sort((a, b) => a.pct - b.pct)[0];
            if (partial) {
              const langName = getLanguage(partial.langCode)?.label ?? partial.langCode.toUpperCase();
              const remaining = Math.ceil(((100 - partial.pct) / 100) * menuItems.length);
              return { kind: "incomplete-translation", langCode: partial.langCode, langName, pct: partial.pct, remaining } satisfies CmdState;
            }
          }
          if (!activation.allComplete) return { kind: "activation-incomplete" } satisfies CmdState;
          return { kind: "qr-ready" } satisfies CmdState;
        })();

        let icon: ElementType = QrCode;
        let headline = "";
        let body = "";
        let actionLabel = "";
        let onAction = () => {};
        let secondaryLabel: string | null = null;
        let onSecondary: (() => void) | null = null;
        let cardClass = "border-primary/20";
        let iconClass = "bg-primary/10";

        if (cmdState.kind === "needs-review") {
          icon = Sparkles;
          headline = t("dashboard.cmd.needsReview.headline", { count: cmdState.n, n: cmdState.n });
          body = t("dashboard.cmd.needsReview.body");
          actionLabel = t("dashboard.sections.reviewChanges");
          onAction = () => navigate("/menu?filter=needsReview");
          cardClass = "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20";
          iconClass = "bg-blue-100 dark:bg-blue-900/40";
        } else if (cmdState.kind === "missing-descriptions") {
          icon = PenLine;
          headline = t("dashboard.cmd.missingDescriptions.headline", { count: cmdState.n, n: cmdState.n });
          body = t("dashboard.cmd.missingDescriptions.body");
          actionLabel = t("dashboard.cmd.missingDescriptions.action");
          onAction = () => navigate("/menu?intent=rewrite");
        } else if (cmdState.kind === "incomplete-translation") {
          icon = Globe;
          headline = t("dashboard.cmd.incompleteTranslation.headline", { langName: cmdState.langName, pct: cmdState.pct });
          body = t("dashboard.cmd.incompleteTranslation.body", { count: cmdState.remaining, remaining: cmdState.remaining, langName: cmdState.langName });
          actionLabel = t("dashboard.cmd.incompleteTranslation.action", { langName: cmdState.langName });
          onAction = () => navigate(`/menu?intent=translate&lang=${cmdState.langCode}`);
        } else if (cmdState.kind === "activation-incomplete") {
          if (!activation.nameSet) {
            icon = ChefHat;
            headline = t("dashboard.cmd.setName.headline");
            body = t("dashboard.cmd.setName.body");
            actionLabel = t("dashboard.cmd.setName.action");
            onAction = () => navigate("/settings");
          } else if (!activation.hasOpenedPreview) {
            icon = Eye;
            headline = t("dashboard.cmd.checkPreview.headline");
            body = t("dashboard.cmd.checkPreview.body");
            actionLabel = t("dashboard.cmd.checkPreview.action");
            onAction = () => navigate("/preview");
          } else if (!activation.hasRunAI) {
            icon = Sparkles;
            headline = t("dashboard.cmd.enhance.headline");
            body = t("dashboard.cmd.enhance.body");
            actionLabel = t("dashboard.cmd.enhance.action");
            onAction = () => {
              if (copilotCtx) {
                if (copilotCtx.missingDescriptions > 0) navigate("/menu?intent=rewrite");
                else {
                  const lowestTrans = copilotCtx.translationCoverage
                    .filter((c) => c.pct < 100)
                    .sort((a, b) => a.pct - b.pct)[0];
                  navigate(lowestTrans ? `/menu?intent=translate&lang=${lowestTrans.langCode}` : "/menu");
                }
              } else navigate("/menu");
            };
          } else {
            icon = QrCode;
            headline = t("dashboard.cmd.getQR.headline");
            body = t("dashboard.cmd.getQR.body");
            actionLabel = t("dashboard.cmd.getQR.action");
            onAction = () => navigate("/qr-codes");
          }
        } else {
          icon = QrCode;
          headline = t("dashboard.cmd.qrReady.headline");
          body = t("dashboard.cmd.qrReady.body");
          actionLabel = t("dashboard.cmd.qrReady.action");
          onAction = () => navigate("/qr-codes");
          secondaryLabel = t("dashboard.cmd.qrReady.secondary");
          onSecondary = () => navigate("/preview");
        }

        const IconComp = icon;
        return (
          <Card className={cardClass} data-testid="card-next-action">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className={`h-10 w-10 rounded-xl ${iconClass} flex items-center justify-center shrink-0`}>
                  <IconComp className={`h-5 w-5 ${cmdState.kind === "needs-review" ? "text-blue-600 dark:text-blue-400" : "text-primary"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-sans-heading text-sm">{headline}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{body}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Button
                      size="sm"
                      className={cmdState.kind === "needs-review" ? "bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600" : undefined}
                      onClick={onAction}
                      data-testid="button-next-action"
                    >
                      {actionLabel} <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                    {secondaryLabel && onSecondary && (
                      <Button size="sm" variant="ghost" onClick={onSecondary} className="text-muted-foreground">
                        {secondaryLabel}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Stats grid */}
      {menuItems.length > 0 && !session && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s) => (
            <Card key={s.label} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wider">{s.label}</CardDescription>
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-serif">{s.value}</div>
                <p className="text-xs text-muted-foreground capitalize mt-1">{s.sub}</p>
                {s.link && (
                  <Link
                    to={s.link.to}
                    className="text-xs text-primary underline underline-offset-2 hover:opacity-80 transition-opacity mt-1 block"
                    data-testid={`link-stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {s.link.text}
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Activation checklist */}
      {!activation.isLoading && !activation.allComplete && menuItems.length > 0 && !session && !cmdStateIsActivation && (
        <ActivationChecklist
          nameSet={activation.nameSet}
          hasItems={activation.hasItems}
          hasOpenedPreview={activation.hasOpenedPreview}
          hasRunAI={activation.hasRunAI}
        />
      )}

      {/* AI-Buddy block */}
      {menuItems.length > 0 && !session && !copilotError && (() => {
        const BUDDY_ICON_MAP: Record<SignalIconKey, React.ElementType> = {
          AlertCircle, Sparkles, PenLine, Globe, Ban, Star, PlayCircle, CreditCard,
        };
        return (
          <Card data-testid="card-ai-buddy">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-sm font-sans-heading">{t("dashboard.stats.menuItems")}</p>
              </div>
              {copilotLoading ? (
                <div className="space-y-2.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : buddySignals.length === 0 ? (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground" data-testid="ai-buddy-all-clear">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <span>{t("dashboard.buddyAllClear")}</span>
                </div>
              ) : (
                <div className="space-y-2" data-testid="ai-buddy-signals">
                  {buddySignals.map((s) => {
                    const IconComp = BUDDY_ICON_MAP[s.iconKey];
                    const iconColor =
                      s.severity === "error" ? "text-destructive" :
                      s.severity === "warning" ? "text-amber-500" : "text-blue-500";
                    const onAction = () => navigate(s.navigateTo);
                    return (
                      <div key={s.key} className="flex items-center gap-2.5 text-sm" data-testid={`ai-buddy-signal-${s.key}`}>
                        <IconComp className={`h-4 w-4 shrink-0 ${iconColor}`} />
                        <span className="flex-1 min-w-0 text-muted-foreground leading-snug">{s.stripText}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 h-7 px-2 text-xs gap-1"
                          onClick={onAction}
                          data-testid={`ai-buddy-action-${s.key}`}
                        >
                          {s.stripActionLabel}
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* 3 permanent entry paths */}
      {menuItems.length > 0 && !session && (
        <div data-testid="section-menu-entry">
          <h2 className="text-lg font-sans-heading mb-3">{t("dashboard.sections.importMenu")}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="cursor-pointer hover:shadow-md transition-all group" onClick={() => navigate("/setup?stage=choose")} data-testid="entry-card-import">
              <CardContent className="p-5 flex flex-col items-center gap-3 text-center">
                <div className="h-11 w-11 rounded-xl bg-primary/8 flex items-center justify-center group-hover:bg-primary/12 transition-colors">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-sans-heading text-sm">{t("dashboard.sections.importYourMenu")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.sections.entryImportSub")}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-all group" onClick={() => navigate("/menu")} data-testid="entry-card-manual">
              <CardContent className="p-5 flex flex-col items-center gap-3 text-center">
                <div className="h-11 w-11 rounded-xl bg-primary/8 flex items-center justify-center group-hover:bg-primary/12 transition-colors">
                  <UtensilsCrossed className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-sans-heading text-sm">{t("dashboard.sections.addManually")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.sections.entryManualSub")}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-all group" onClick={() => navigate("/menu?action=scan")} data-testid="entry-card-scan">
              <CardContent className="p-5 flex flex-col items-center gap-3 text-center">
                <div className="h-11 w-11 rounded-xl bg-primary/8 flex items-center justify-center group-hover:bg-primary/12 transition-colors">
                  <Camera className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-sans-heading text-sm">{t("menuBuilder.scanDish")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.sections.entryScanSub")}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Popular Items */}
      {activation.allComplete && !session && <div>
        <h2 className="text-lg font-sans-heading mb-5">{t("dashboard.stats.popularItems")}</h2>
        {isLoading ? null : stats.popularItems === 0 ? (
          <EmptyState
            icon={Star}
            title={t("dashboard.sections.popularItemsEmpty")}
            description={t("dashboard.sections.popularItemsEmptyDesc")}
            action={{ label: t("dashboard.sections.openMenuBuilder"), icon: UtensilsCrossed, onClick: () => navigate("/menu") }}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {menuItems.filter((i) => i.isPopular).slice(0, 6).map((item) => {
              const cat = categories.find((c) => c.id === item.categoryId);
              return (
                <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/menu")}>
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-sans-heading">{item.name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{item.description}</p>
                      </div>
                      <Badge variant="secondary" className="ml-2 shrink-0 rounded-full">{formatPrice(item.price, restaurant?.currency)}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      {cat && <Badge variant="outline" className="text-xs rounded-full">{cat.name}</Badge>}
                      <Star className="h-3 w-3 text-primary fill-primary" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>}
    </PageWrapper>
  );
}
