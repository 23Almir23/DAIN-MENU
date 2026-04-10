import { useState, useMemo } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBilling } from "@/hooks/use-billing";
import { useMenuStats } from "@/hooks/use-menu-stats";
import { useMenu } from "@/hooks/use-menu";
import { useAIActions } from "@/hooks/use-ai-actions";
import type { MenuItem } from "@/types/menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sparkles, Languages, AlertTriangle, Flame, Loader2, Check, CreditCard,
  UtensilsCrossed, PenLine, ShieldCheck, Globe, ArrowRight, Eye, FileText,
  AlertCircle, ChevronDown, ChevronUp, Upload, CheckCircle2, X,
} from "lucide-react";
import { PageWrapper } from "@/components/PageWrapper";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { formatPrice } from "@/lib/menu-utils";
import { AI_CREDIT_COSTS } from "@/services/menu-service";
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  getTranslationCoverage,
  getAvailableLanguages,
  getLanguage,
} from "@/lib/i18n-utils";
import { useRestaurant } from "@/hooks/use-restaurant";

const TRANSLATE_LANGUAGES = SUPPORTED_LANGUAGES.filter((l) => l.code !== DEFAULT_LANGUAGE);

export default function AIStudio() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { categories, menuItems } = useMenu();
  const { credits, isLowCredits, isOutOfCredits, useCredits: spendCredits } = useBilling();
  const stats = useMenuStats();
  const { restaurant } = useRestaurant();
  const baseLangCode = restaurant?.baseLanguage ?? "en";
  const baseLang = getLanguage(baseLangCode);
  const [translateLang, setTranslateLang] = useState(() => {
    const p = new URLSearchParams(location.search);
    const task = p.get("task");
    const l = p.get("lang");
    return (task === "translate" && l) ? l : "es";
  });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [entryTask, setEntryTask] = useState<"translate" | "rewrite" | null>(() => {
    const p = new URLSearchParams(location.search);
    const task = p.get("task");
    return (task === "translate" || task === "rewrite") ? task : null;
  });

  const { processing, completed, improvementMsg, setImprovementMsg, runAction } = useAIActions({
    credits,
    spendCredits,
    categories,
  });

  const availableTargetLangs = TRANSLATE_LANGUAGES.filter((l) => l.code !== baseLangCode);
  const safeTranslateLang = availableTargetLangs.some((l) => l.code === translateLang)
    ? translateLang
    : (availableTargetLangs[0]?.code ?? "fr");

  const targetItems = selectedItems.length > 0
    ? menuItems.filter((i) => selectedItems.includes(i.id))
    : menuItems;

  const toggleItem = (id: string) =>
    setSelectedItems((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAll = () =>
    setSelectedItems((prev) => prev.length === menuItems.length ? [] : menuItems.map((i) => i.id));

  const diagnostics = useMemo(() => {
    const items = menuItems;
    const missingDesc = items.filter((i) => !i.description || i.description.length < 20);
    const missingAllergens = items.filter((i) => i.allergens.length === 0);
    const missingCalories = items.filter((i) => !i.calories);
    const availableLangs = getAvailableLanguages(items, categories);
    const shortDescs = items.filter((i) => i.description && i.description.length < 60 && i.description.length >= 20);

    return { missingDesc, missingAllergens, missingCalories, availableLangs, shortDescs };
  }, [menuItems, categories]);

  const translationCoverage = useMemo(
    () => getTranslationCoverage(menuItems, safeTranslateLang),
    [menuItems, safeTranslateLang]
  );

  const lowestTranslation = useMemo(() => {
    return availableTargetLangs
      .map((lang) => {
        const cov = getTranslationCoverage(menuItems, lang.code);
        return { code: lang.code, label: lang.label, pct: cov.percentage, translated: cov.translated, remaining: cov.total - cov.translated };
      })
      .filter((l) => l.translated > 0 && l.remaining > 0)
      .sort((a, b) => a.pct - b.pct)[0] ?? null;
  }, [menuItems, availableTargetLangs]);

  const creditColor = isOutOfCredits
    ? "text-destructive"
    : isLowCredits
    ? "text-amber-600 dark:text-amber-400"
    : "text-primary";

  const showEntryBanner = entryTask !== null && !completed.includes(entryTask);

  if (menuItems.length === 0) {
    return (
      <PageWrapper maxWidth="md">
        <PageHeader title={t("aiStudio.title")} icon={Sparkles} description={t("aiStudio.creditsInfo")} />
        <EmptyState
          icon={UtensilsCrossed}
          title={t("menuBuilder.empty.noItems")}
          description={t("aiStudio.emptyDescription")}
          action={{ label: t("aiStudio.emptyImportAction"), icon: Upload, onClick: () => navigate("/setup?stage=choose") }}
          secondaryAction={{ label: t("aiStudio.emptyAddAction"), icon: UtensilsCrossed, onClick: () => navigate("/menu") }}
        />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper maxWidth="lg">
      <PageHeader title={t("aiStudio.title")} icon={Sparkles} description={t("aiStudio.pageDescription")}>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/preview")}>
            <Eye className="h-4 w-4 mr-1" /> {t("aiStudio.preview")}
          </Button>
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <CreditCard className={`h-4 w-4 ${creditColor}`} />
              <span className={`font-bold ${creditColor}`}>{credits}</span>
              <span className="text-sm text-muted-foreground">{t("aiStudio.creditsInfo")}</span>
            </div>
          </Card>
        </div>
      </PageHeader>

      {/* Credit warning banners */}
      {isOutOfCredits && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">{t("aiStudio.noCredits")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("aiStudio.noCreditsBody")}{" "}
              <button onClick={() => navigate("/billing")} className="text-primary underline underline-offset-2 font-medium hover:no-underline">
                {t("aiStudio.viewPlans")}
              </button>
            </p>
          </div>
        </div>
      )}

      {isLowCredits && !isOutOfCredits && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {t("aiStudio.lowCredits", { count: credits })}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("aiStudio.lowCreditsBody")}{" "}
              <button onClick={() => navigate("/billing")} className="text-primary underline underline-offset-2 font-medium hover:no-underline">
                {t("aiStudio.viewPlans")}
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Post-run improvement banner */}
      {improvementMsg && (
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 text-sm"
          data-testid="ai-studio-improvement-banner"
        >
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
          <span className="flex-1 text-green-800 dark:text-green-300">{improvementMsg}</span>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-7 border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-400 gap-1"
            onClick={() => navigate("/menu?filter=needsReview")}
            data-testid="ai-studio-banner-review"
          >
            <FileText className="h-3.5 w-3.5" />
            {t("aiStudio.reviewChanges")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-7 border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-400 gap-1"
            onClick={() => navigate("/preview")}
            data-testid="ai-studio-banner-preview"
          >
            <Eye className="h-3.5 w-3.5" />
            {t("aiStudio.preview")}
          </Button>
          <button
            onClick={() => setImprovementMsg(null)}
            className="shrink-0 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
            aria-label={t("common.dismiss")}
            data-testid="ai-studio-banner-dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Entry banner — dynamic text stays in English (diagnostic/API-driven content) */}
      {!improvementMsg && showEntryBanner && (() => {
        const entryLangMeta = entryTask === "translate" ? getLanguage(safeTranslateLang) : null;
        const entryLangName = entryLangMeta?.label ?? safeTranslateLang.toUpperCase();
        const remaining = translationCoverage.total - translationCoverage.translated;
        const pct = translationCoverage.percentage;

        const headline = entryTask === "translate"
          ? t("aiStudio.entryBanner.finishTranslation", { lang: entryLangName, pct, remaining })
          : t("aiStudio.entryBanner.writeDescriptions", { count: diagnostics.missingDesc.length });

        return (
          <div
            className="flex items-start gap-3 px-4 py-3 rounded-xl border border-primary/25 bg-primary/[0.05] text-sm"
            data-testid="ai-studio-entry-banner"
          >
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="flex-1 leading-snug text-foreground">{headline}</p>
            <button
              onClick={() => setEntryTask(null)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t("common.dismiss")}
              data-testid="ai-studio-entry-banner-dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })()}

      {/* StudioBuddy — dynamic diagnostic text stays in English */}
      {!improvementMsg && !showEntryBanner && (
        <StudioBuddy
          diagnostics={diagnostics}
          totalItems={stats.totalItems}
          lowestTranslation={lowestTranslation}
          onSelect={(ids) => { setSelectedItems(ids); setShowItemPicker(true); }}
        />
      )}

      {/* Menu Health Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {t("aiStudio.menuHealth")}
          </CardTitle>
          <CardDescription>{t("aiStudio.menuHealthDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <HealthStat
              label={t("aiStudio.missingDesc")}
              count={diagnostics.missingDesc.length}
              total={stats.totalItems}
              warn={diagnostics.missingDesc.length > 0}
              onSelect={diagnostics.missingDesc.length > 0 ? () => { setSelectedItems(diagnostics.missingDesc.map((i) => i.id)); setShowItemPicker(true); } : undefined}
            />
            <HealthStat
              label={t("aiStudio.noAllergensTagged")}
              count={diagnostics.missingAllergens.length}
              total={stats.totalItems}
              warn={diagnostics.missingAllergens.length > 2}
              onSelect={diagnostics.missingAllergens.length > 0 ? () => { setSelectedItems(diagnostics.missingAllergens.map((i) => i.id)); setShowItemPicker(true); } : undefined}
            />
            <HealthStat
              label={t("aiStudio.noCalorieInfo")}
              count={diagnostics.missingCalories.length}
              total={stats.totalItems}
              warn={false}
              onSelect={diagnostics.missingCalories.length > 0 ? () => { setSelectedItems(diagnostics.missingCalories.map((i) => i.id)); setShowItemPicker(true); } : undefined}
            />
            <HealthStat
              label={t("aiStudio.availableLanguages")}
              count={diagnostics.availableLangs.length}
              total={TRANSLATE_LANGUAGES.length}
              warn={false}
              invert
            />
          </div>
          {diagnostics.shortDescs.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {t("aiStudio.shortDescriptions", { count: diagnostics.shortDescs.length })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Item Selection */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{t("aiStudio.itemsToProcess")}</CardTitle>
              <CardDescription>{t("aiStudio.itemSelectionDesc")}</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowItemPicker(!showItemPicker)}
              className="gap-1"
            >
              {showItemPicker ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showItemPicker ? t("common.close") : t("aiStudio.chooseItems")}
            </Button>
          </div>
        </CardHeader>
        {showItemPicker && (
          <CardContent className="pt-0">
            <div className="flex items-center justify-between mb-2">
              <button onClick={toggleAll} className="text-xs text-primary hover:underline">
                {selectedItems.length === menuItems.length ? t("aiStudio.deselectAll") : t("aiStudio.selectAll")}
              </button>
              {selectedItems.length > 0 && (
                <button onClick={() => setSelectedItems([])} className="text-xs text-muted-foreground hover:underline">
                  {t("common.cancel")}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
              {menuItems.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={selectedItems.includes(item.id)}
                    onCheckedChange={() => toggleItem(item.id)}
                  />
                  <span className="truncate">{item.name}</span>
                  <span className="text-muted-foreground text-xs ml-auto">{formatPrice(item.price, restaurant?.currency)}</span>
                </label>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* AI Actions */}
      <div className="space-y-2">
        <h2 className="text-xs font-sans-heading text-muted-foreground uppercase tracking-widest">{t("aiStudio.aiActions")}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <ActionCard
            id="rewrite"
            icon={PenLine}
            title={t("aiStudio.rewriteDesc")}
            description={t("aiStudio.rewriteCardDesc", { lang: baseLang?.nativeLabel ?? "English" })}
            cost={AI_CREDIT_COSTS.rewrite}
            itemCount={targetItems.length}
            credits={credits}
            processing={processing}
            completed={completed}
            onRun={() => runAction("rewrite", targetItems, AI_CREDIT_COSTS.rewrite * targetItems.length, t("aiStudio.rewriteDesc"))}
            hint={diagnostics.shortDescs.length > 0 ? t("aiStudio.rewriteHint", { count: diagnostics.shortDescs.length }) : undefined}
            t={t}
          />

          <ActionCard
            id="allergens"
            icon={AlertTriangle}
            title={t("aiStudio.flagAllergens")}
            description={t("aiStudio.allergensCardDesc")}
            cost={AI_CREDIT_COSTS.allergens}
            itemCount={targetItems.length}
            credits={credits}
            processing={processing}
            completed={completed}
            onRun={() => runAction("allergens", targetItems, AI_CREDIT_COSTS.allergens * targetItems.length, t("aiStudio.flagAllergens"))}
            t={t}
          />

          <ActionCard
            id="calories"
            icon={Flame}
            title={t("aiStudio.estimateCalories")}
            description={t("aiStudio.caloriesCardDesc")}
            cost={AI_CREDIT_COSTS.calories}
            itemCount={targetItems.length}
            credits={credits}
            processing={processing}
            completed={completed}
            onRun={() => runAction("calories", targetItems, AI_CREDIT_COSTS.calories * targetItems.length, t("aiStudio.estimateCalories"))}
            t={t}
          />

          <TranslateCard
            credits={credits}
            processing={processing}
            completed={completed}
            targetItems={targetItems}
            translateLang={safeTranslateLang}
            setTranslateLang={setTranslateLang}
            translationCoverage={translationCoverage}
            baseLangCode={baseLangCode}
            baseLang={baseLang}
            onRun={() => runAction("translate", targetItems, AI_CREDIT_COSTS.translate * targetItems.length, t("aiStudio.translateMenu"), { translateLang: safeTranslateLang })}
            t={t}
          />
        </div>
      </div>

      {/* Bottom nav */}
      <Separator />
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          {t("aiStudio.bottomNavText")}{" "}
          <button onClick={() => navigate("/preview")} className="text-primary hover:underline">{t("sidebar.guestPreview")}</button>
          {" "}{t("common.or")}{" "}
          <button onClick={() => navigate("/menu")} className="text-primary hover:underline">{t("sidebar.menuBuilder")}</button>.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate("/billing")} className="gap-1">
          <CreditCard className="h-4 w-4" /> {t("billing.title")} <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </PageWrapper>
  );
}

// --- Sub-components ---

function HealthStat({ label, count, total, warn, invert, onSelect }: {
  label: string; count: number; total: number; warn: boolean; invert?: boolean; onSelect?: () => void;
}) {
  const { t } = useTranslation();
  const display = invert ? `${count}` : `${count}/${total}`;
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${warn ? "border-destructive/30 bg-destructive/5" : "bg-muted/50"}`}>
      <div className={`text-lg font-bold ${warn ? "text-destructive" : ""}`}>{display}</div>
      <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
      {onSelect && count > 0 && (
        <button
          onClick={onSelect}
          className="mt-1.5 text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
          data-testid={`health-stat-select-${label.replace(/\s+/g, "-").toLowerCase()}`}
        >
          {t("aiStudio.selectThese")} <ArrowRight className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

function StudioBuddy({
  diagnostics,
  totalItems,
  lowestTranslation,
  onSelect,
}: {
  diagnostics: { missingDesc: { id: string }[]; missingAllergens: { id: string }[]; missingCalories: { id: string }[] };
  totalItems: number;
  lowestTranslation: { code: string; label: string; pct: number; remaining: number } | null;
  onSelect: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const { missingDesc, missingAllergens, missingCalories } = diagnostics;

  type Rec = { issue: string; guestImpact: string; action: string; actionId: string; ids: string[] };
  let rec: Rec | null = null;

  if (missingDesc.length > 0) {
    const n = missingDesc.length;
    rec = {
      issue: t("aiStudio.buddy.missingDescIssue", { count: n }),
      guestImpact: t("aiStudio.buddy.missingDescImpact"),
      action: t("aiStudio.buddy.missingDescAction"),
      actionId: "rewrite",
      ids: missingDesc.map((i) => i.id),
    };
  } else if (missingAllergens.length > 0) {
    const n = missingAllergens.length;
    rec = {
      issue: t("aiStudio.buddy.missingAllergensIssue", { count: n }),
      guestImpact: t("aiStudio.buddy.missingAllergensImpact"),
      action: t("aiStudio.buddy.missingAllergensAction"),
      actionId: "allergens",
      ids: missingAllergens.map((i) => i.id),
    };
  } else if (lowestTranslation) {
    const { label, pct, remaining } = lowestTranslation;
    rec = {
      issue: t("aiStudio.buddy.lowTranslationIssue", { lang: label, pct, remaining }),
      guestImpact: t("aiStudio.buddy.lowTranslationImpact", { lang: label }),
      action: t("aiStudio.buddy.lowTranslationAction", { lang: label }),
      actionId: "translate",
      ids: [],
    };
  } else if (totalItems > 0 && missingCalories.length === totalItems) {
    const n = missingCalories.length;
    rec = {
      issue: t("aiStudio.buddy.missingCaloriesIssue", { count: n }),
      guestImpact: t("aiStudio.buddy.missingCaloriesImpact"),
      action: t("aiStudio.buddy.missingCaloriesAction"),
      actionId: "calories",
      ids: missingCalories.map((i) => i.id),
    };
  }

  if (!rec) {
    return (
      <p className="text-xs text-muted-foreground px-0.5" data-testid="studio-buddy-clear">
        {t("aiStudio.buddyClearMsg")}
      </p>
    );
  }

  return (
    <div
      className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-3"
      data-testid="studio-buddy-block"
    >
      <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium leading-snug">
          {rec.issue}{" "}
          <span className="font-normal text-muted-foreground">{rec.guestImpact}</span>
        </p>
        <p className="text-xs text-muted-foreground">{rec.action}</p>
        {rec.ids.length > 0 && (
          <button
            onClick={() => onSelect(rec!.ids)}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5 font-medium"
            data-testid={`studio-buddy-select-${rec.actionId}`}
          >
            {t("aiStudio.selectThese")} <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function ActionCard({ id, icon: Icon, title, description, cost, itemCount, credits, processing, completed, onRun, hint, t }: {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  cost: number;
  itemCount: number;
  credits: number;
  processing: string | null;
  completed: string[];
  onRun: () => void;
  hint?: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const totalCost = cost * itemCount;
  const isProcessing = processing === id;
  const isDone = completed.includes(id);
  const canRun = credits >= totalCost;
  const shortfall = totalCost - credits;

  return (
    <Card className={`transition-all ${isProcessing ? "ring-2 ring-primary" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2 bg-muted text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {hint && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-3 w-3 shrink-0" /> {hint}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-sm text-muted-foreground">{t("aiStudio.actionCostLine", { cost: totalCost, count: itemCount })}</span>
            {!canRun && !isProcessing && (
              <p className="text-xs text-destructive mt-0.5">
                {t("aiStudio.needMoreCredits", { count: shortfall })}
              </p>
            )}
          </div>
          <Button size="sm" disabled={isProcessing || !canRun} onClick={onRun} className="shrink-0">
            {isProcessing ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {t("aiStudio.processing")}</>
            ) : isDone ? (
              <><Check className="h-4 w-4 mr-1" /> {t("aiStudio.completed")}</>
            ) : (
              t("aiStudio.runAction")
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TranslateCard({ credits, processing, completed, targetItems, translateLang, setTranslateLang, translationCoverage, baseLangCode, baseLang, onRun, t }: {
  credits: number;
  processing: string | null;
  completed: string[];
  targetItems: MenuItem[];
  translateLang: string;
  setTranslateLang: (v: string) => void;
  translationCoverage: { translated: number; total: number; percentage: number };
  baseLangCode: string;
  baseLang: { code: string; label: string; nativeLabel: string; flag: string } | undefined;
  onRun: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const totalCost = AI_CREDIT_COSTS.translate * targetItems.length;
  const canRun = credits >= totalCost;
  const shortfall = totalCost - credits;
  const targetLangMeta = SUPPORTED_LANGUAGES.find((l) => l.code === translateLang);
  const sourceFlagLabel = baseLang
    ? `${baseLang.flag} ${baseLang.nativeLabel}`
    : `🇺🇸 English`;
  const directionLabel = `${sourceFlagLabel} → ${targetLangMeta?.flag ?? ""} ${targetLangMeta?.nativeLabel ?? translateLang}`;

  return (
    <Card className={`transition-all ${processing === "translate" ? "ring-2 ring-primary" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2 bg-muted text-primary">
            <Globe className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">{t("aiStudio.translateMenu")}</CardTitle>
            <CardDescription className="text-xs">
              {t("aiStudio.translateCardDesc")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Select value={translateLang} onValueChange={setTranslateLang}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSLATE_LANGUAGES.filter((l) => l.code !== baseLangCode).map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.flag} {l.label} ({l.nativeLabel})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            {t("aiStudio.configureInSettings")}{" "}
            <Link to="/settings" className="underline underline-offset-2 hover:text-foreground transition-colors">
              {t("sidebar.settings")} →
            </Link>
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Languages className="h-3 w-3 shrink-0" />
            {directionLabel}
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("aiStudio.translateCoverage", { translated: translationCoverage.translated, total: translationCoverage.total })}</span>
              <span>{translationCoverage.percentage}%</span>
            </div>
            <Progress value={translationCoverage.percentage} className="h-1.5" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-sm text-muted-foreground">
              {t("aiStudio.actionCostLine", { cost: totalCost, count: targetItems.length })}
            </span>
            {!canRun && processing !== "translate" && (
              <p className="text-xs text-destructive mt-0.5">
                {t("aiStudio.needMoreCredits", { count: shortfall })}
              </p>
            )}
          </div>
          <Button
            size="sm"
            disabled={processing === "translate" || !canRun}
            onClick={onRun}
            className="shrink-0"
          >
            {processing === "translate" ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {t("aiStudio.processing")}</>
            ) : completed.includes("translate") ? (
              <><Check className="h-4 w-4 mr-1" /> {t("aiStudio.completed")}</>
            ) : (
              t("aiStudio.translateMenu")
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
