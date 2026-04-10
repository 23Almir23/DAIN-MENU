/**
 * WorkspaceEnhanceSection — Collapsible inline AI actions panel for the workspace.
 */

import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBilling } from "@/hooks/use-billing";
import { useMenu } from "@/hooks/use-menu";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useCopilotContext } from "@/hooks/use-copilot";
import { useAIActions, type AIActionId } from "@/hooks/use-ai-actions";
import {
  ChevronDown, ChevronUp, Sparkles, PenLine, Languages, ShieldCheck, Flame,
  Loader2, Check, ArrowRight, CheckCircle2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AI_CREDIT_COSTS } from "@/services/menu-service";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, getLanguage, getTranslationCoverage } from "@/lib/i18n-utils";
import { detectAllergens } from "@/data/allergens";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";

const TRANSLATE_LANGUAGES = SUPPORTED_LANGUAGES.filter((l) => l.code !== DEFAULT_LANGUAGE);

interface WorkspaceEnhanceSectionProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAIRunComplete: () => void;
  onImproveModeChange?: (active: boolean) => void;
  intent?: string | null;
  initialLang?: string | null;
}

export function WorkspaceEnhanceSection({ open, onOpenChange, onAIRunComplete, onImproveModeChange, intent, initialLang }: WorkspaceEnhanceSectionProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { menuItems, categories } = useMenu();
  const { restaurant } = useRestaurant();
  const { credits, useCredits: spendCredits } = useBilling();

  const baseLangCode = restaurant?.baseLanguage ?? "en";
  const availableTargetLangs = TRANSLATE_LANGUAGES.filter((l) => l.code !== baseLangCode);

  const [translateLang, setTranslateLang] = useState<string>(
    () => availableTargetLangs[0]?.code ?? "fr"
  );
  const [showTranslatePicker, setShowTranslatePicker] = useState(false);
  const [activeAction, setActiveAction] = useState<AIActionId | null>(null);

  const [scope, setScope] = useState<"all" | "category">("all");
  const [selectedScopeCategory, setSelectedScopeCategory] = useState<string>("");

  useEffect(() => {
    if (categories.length > 0 && !selectedScopeCategory) {
      setSelectedScopeCategory(categories[0].id);
    }
  }, [categories, selectedScopeCategory]);

  const { data: copilotCtx } = useCopilotContext({ staleTime: 30_000 });

  useEffect(() => {
    onImproveModeChange?.(open && activeAction !== null);
  }, [open, activeAction, onImproveModeChange]);

  const { processing, completed, improvementMsg, setImprovementMsg, runAction } = useAIActions({
    credits,
    spendCredits,
    categories,
    onComplete: () => {
      onAIRunComplete();
      setScope("all");
    },
  });

  useEffect(() => {
    if (!intent) return;
    const valid: AIActionId[] = ["rewrite", "translate", "allergens", "calories"];
    const actionIntent = valid.find((a) => a === intent);
    if (!actionIntent) return;
    setActiveAction(actionIntent);
    setScope("all");
    if (intent === "translate") {
      setShowTranslatePicker(true);
      if (initialLang) {
        const exists = availableTargetLangs.some((l) => l.code === initialLang);
        if (exists) setTranslateLang(initialLang);
      }
    }
  }, [intent, initialLang]);

  const safeTranslateLang = availableTargetLangs.some((l) => l.code === translateLang)
    ? translateLang
    : (availableTargetLangs[0]?.code ?? "fr");

  const scopedItems = useMemo(() => {
    if (scope === "all") return menuItems;
    if (scope === "category" && selectedScopeCategory) {
      return menuItems.filter((i) => i.categoryId === selectedScopeCategory);
    }
    return menuItems;
  }, [scope, selectedScopeCategory, menuItems]);

  const translationCoverage = useMemo(
    () => getTranslationCoverage(scopedItems, safeTranslateLang),
    [scopedItems, safeTranslateLang]
  );

  const eligibleCounts = useMemo(() => ({
    rewrite: scopedItems.filter((i) => !i.description || i.description.length < 20).length,
    translate: scopedItems.filter((i) => !i.translations[safeTranslateLang]?.name).length,
    allergens: scopedItems.filter((i) => {
      const detected = detectAllergens(i.description);
      return detected.some((d) => !i.allergens.includes(d));
    }).length,
    calories: scopedItems.filter((i) => !i.calories).length,
  }), [scopedItems, safeTranslateLang]);

  const creditCosts = useMemo(() => ({
    rewrite: AI_CREDIT_COSTS.rewrite * eligibleCounts.rewrite,
    translate: AI_CREDIT_COSTS.translate * eligibleCounts.translate,
    allergens: AI_CREDIT_COSTS.allergens * eligibleCounts.allergens,
    calories: AI_CREDIT_COSTS.calories * eligibleCounts.calories,
  }), [eligibleCounts]);

  if (menuItems.length === 0) return null;

  const selectedLangName = getLanguage(safeTranslateLang)?.label ?? safeTranslateLang.toUpperCase();
  const translateCoverage = Math.round(translationCoverage.percentage);

  // Dynamic subtitle — computed from copilot signals (not translated as these are AI-driven insights)
  const collapsedSubtitle = (() => {
    if (!copilotCtx) return t("enhance.subtitles.improve");
    if (copilotCtx.missingDescriptions > 0) {
      return t("enhance.subtitles.missingDesc", { count: copilotCtx.missingDescriptions });
    }
    const lowestTrans = copilotCtx.translationCoverage
      .filter((tr) => tr.pct > 0 && tr.pct < 100)
      .sort((a, b) => a.pct - b.pct)[0];
    if (lowestTrans) {
      const langName = getLanguage(lowestTrans.langCode)?.label ?? lowestTrans.langCode.toUpperCase();
      return t("enhance.subtitles.translateIncomplete", { lang: langName, pct: lowestTrans.pct });
    }
    if (eligibleCounts.allergens > 0) {
      return t("enhance.subtitles.missingAllergens", { count: eligibleCounts.allergens });
    }
    if (eligibleCounts.calories > 0) {
      return t("enhance.subtitles.missingCalories", { count: eligibleCounts.calories });
    }
    return t("enhance.subtitles.improve");
  })();

  const expandedSubtitle = activeAction === "rewrite" ? t("enhance.subtitles.improve")
    : activeAction === "translate" ? t("enhance.subtitles.translateIncomplete", { lang: selectedLangName, pct: translateCoverage })
    : activeAction === "allergens" ? t("enhance.subtitles.missingAllergens", { count: eligibleCounts.allergens })
    : activeAction === "calories" ? t("enhance.subtitles.missingCalories", { count: eligibleCounts.calories })
    : t("enhance.subtitles.improve");

  const dockSubtitle = open ? expandedSubtitle : collapsedSubtitle;

  const handleToggle = () => {
    const opening = !open;
    if (opening && copilotCtx) {
      if (copilotCtx.missingDescriptions > 0) {
        setActiveAction("rewrite");
      } else {
        const lowestTrans = copilotCtx.translationCoverage
          .filter((tr) => tr.pct < 100)
          .sort((a, b) => a.pct - b.pct)[0];
        if (lowestTrans) {
          setActiveAction("translate");
          const exists = availableTargetLangs.some((l) => l.code === lowestTrans.langCode);
          if (exists) setTranslateLang(lowestTrans.langCode);
          setShowTranslatePicker(true);
        } else if (eligibleCounts.allergens > 0) {
          setActiveAction("allergens");
        } else if (eligibleCounts.calories > 0) {
          setActiveAction("calories");
        }
      }
    }
    onOpenChange(opening);
    if (!opening) setShowTranslatePicker(false);
  };

  const isImproveMode = open && activeAction !== null;
  const scopeCategoryName = categories.find((c) => c.id === selectedScopeCategory)?.name ?? "";
  const scopeLabel = scope === "category" ? scopeCategoryName : undefined;

  return (
    <div
      className={`rounded-lg border bg-card transition-colors ${isImproveMode ? "border-primary/40 shadow-sm" : ""}`}
      data-testid="workspace-enhance-section"
    >
      <button
        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${isImproveMode ? "bg-primary/[0.03] rounded-t-lg" : ""}`}
        onClick={handleToggle}
        data-testid="workspace-enhance-toggle"
      >
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{t("enhance.title")}</span>
          <p className={`text-xs leading-tight mt-0.5 truncate ${isImproveMode ? "text-primary/70" : "text-muted-foreground"}`}>
            {dockSubtitle}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal shrink-0">
          {t("aiStudio.credits", { count: credits })}
        </Badge>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          {categories.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap" data-testid="scope-selector">
              <button
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                  scope === "all" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setScope("all")}
                data-testid="scope-btn-all"
              >
                {t("enhance.allItems")}
              </button>
              <button
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                  scope === "category" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setScope("category")}
                data-testid="scope-btn-category"
              >
                {t("enhance.byCategory")}
              </button>
              {scope === "category" && (
                <Select value={selectedScopeCategory} onValueChange={setSelectedScopeCategory}>
                  <SelectTrigger className="h-7 text-xs w-auto min-w-[7rem] max-w-[10rem]" data-testid="scope-category-select">
                    <SelectValue placeholder={t("enhance.chooseCategory")}>
                      {scopeCategoryName}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ActionChip
              id="rewrite"
              icon={PenLine}
              label={t("enhance.rewriteDescriptions")}
              eligibleCount={eligibleCounts.rewrite}
              creditCost={creditCosts.rewrite}
              credits={credits}
              processing={processing}
              completed={completed}
              isActive={activeAction === "rewrite"}
              isSecondary={isImproveMode && activeAction !== "rewrite"}
              scopeLabel={scopeLabel}
              runLabel={t("enhance.runCredits", { cost: creditCosts.rewrite })}
              onRun={() => {
                setActiveAction("rewrite");
                const its = scopedItems.filter((i) => !i.description || i.description.length < 20);
                runAction("rewrite", its, creditCosts.rewrite, t("aiStudio.rewriteDesc"));
              }}
            />
            <ActionChip
              id="allergens"
              icon={ShieldCheck}
              label={t("enhance.detectAllergens")}
              eligibleCount={eligibleCounts.allergens}
              creditCost={creditCosts.allergens}
              credits={credits}
              processing={processing}
              completed={completed}
              isActive={activeAction === "allergens"}
              isSecondary={isImproveMode && activeAction !== "allergens"}
              scopeLabel={scopeLabel}
              runLabel={t("enhance.runCredits", { cost: creditCosts.allergens })}
              onRun={() => {
                setActiveAction("allergens");
                runAction("allergens", scopedItems, creditCosts.allergens, t("aiStudio.flagAllergens"));
              }}
            />
            <ActionChip
              id="calories"
              icon={Flame}
              label={t("enhance.estimateCalories")}
              eligibleCount={eligibleCounts.calories}
              creditCost={creditCosts.calories}
              credits={credits}
              processing={processing}
              completed={completed}
              isActive={activeAction === "calories"}
              isSecondary={isImproveMode && activeAction !== "calories"}
              scopeLabel={scopeLabel}
              runLabel={t("enhance.runCredits", { cost: creditCosts.calories })}
              onRun={() => {
                setActiveAction("calories");
                runAction("calories", scopedItems, creditCosts.calories, t("aiStudio.estimateCalories"));
              }}
            />
            <div className="space-y-2">
              <ActionChip
                id="translate"
                icon={Languages}
                label={t("enhance.translateTo", { lang: selectedLangName })}
                scopeLabel={scopeLabel}
                eligibleCount={eligibleCounts.translate}
                creditCost={creditCosts.translate}
                credits={credits}
                processing={processing}
                completed={completed}
                isActive={activeAction === "translate"}
                isSecondary={isImproveMode && activeAction !== "translate"}
                onRun={() => {
                  setActiveAction("translate");
                  if (showTranslatePicker) {
                    runAction("translate", scopedItems, creditCosts.translate, t("aiStudio.translateMenu"), { translateLang: safeTranslateLang });
                  } else {
                    setShowTranslatePicker(true);
                  }
                }}
                runLabel={showTranslatePicker ? t("enhance.runCredits", { cost: creditCosts.translate }) : undefined}
              />
              {(showTranslatePicker || activeAction === "translate") && processing !== "translate" && !completed.includes("translate") && (
                <div className="space-y-2 pl-1">
                  <div className="rounded-md border bg-muted/40 px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t("enhance.coverage", { lang: selectedLangName })}</span>
                      <span className="font-medium tabular-nums">
                        {t("enhance.coverageDetail", {
                          translated: translationCoverage.translated,
                          total: translationCoverage.total,
                          pct: translateCoverage,
                        })}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div className="bg-primary h-1.5 rounded-full transition-all duration-300" style={{ width: `${translateCoverage}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={safeTranslateLang} onValueChange={(v) => setTranslateLang(v)}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTargetLangs.map((l) => (
                          <SelectItem key={l.code} value={l.code}>
                            {l.flag} {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-muted-foreground"
                      onClick={() => { setShowTranslatePicker(false); setActiveAction(null); }}
                    >
                      {t("enhance.cancel")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              {t("enhance.reviewApprove")}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground gap-1 shrink-0 ml-2"
              onClick={() => navigate(
                showTranslatePicker
                  ? `/ai-studio?task=translate&lang=${safeTranslateLang}`
                  : "/ai-studio"
              )}
              data-testid="workspace-enhance-full-studio"
            >
              {t("enhance.fullAiStudio")}
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {improvementMsg && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 bg-green-50 dark:bg-green-950/30 border-t border-green-200 dark:border-green-900 text-sm text-green-800 dark:text-green-300"
          data-testid="workspace-improvement-banner"
        >
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
          <span className="flex-1">{improvementMsg}</span>
          <button
            onClick={() => navigate("/menu?filter=needsReview")}
            className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100 shrink-0 transition-colors"
            data-testid="workspace-improvement-review-link"
          >
            {t("enhance.reviewChanges")}
            <ArrowRight className="h-3 w-3" />
          </button>
          <button
            onClick={() => setImprovementMsg(null)}
            className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 shrink-0"
            aria-label={t("common.dismiss")}
            data-testid="button-dismiss-improvement-banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function ActionChip({
  id, icon: Icon, label, eligibleCount, creditCost, credits, processing, completed, onRun, runLabel, isActive, isSecondary, scopeLabel,
}: {
  id: AIActionId;
  icon: React.ElementType;
  label: string;
  eligibleCount: number;
  creditCost: number;
  credits: number;
  processing: AIActionId | null;
  completed: AIActionId[];
  onRun: () => void;
  runLabel?: string;
  isActive?: boolean;
  isSecondary?: boolean;
  scopeLabel?: string;
}) {
  const { t } = useTranslation();
  const isProcessing = processing === id;
  const isDone = completed.includes(id);
  const canRun = credits >= creditCost && eligibleCount > 0;
  const shortfall = creditCost - credits;

  const button = (
    <button
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all text-sm
        ${isSecondary && !isDone && !isProcessing ? "opacity-50" : ""}
        ${isDone
          ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
          : isProcessing
          ? "border-primary/30 bg-primary/5 cursor-wait"
          : isActive && canRun
          ? "border-primary/60 bg-primary/10 shadow-sm cursor-pointer ring-1 ring-primary/20"
          : canRun
          ? "border-border hover:border-primary/40 hover:bg-muted/60 cursor-pointer"
          : "border-border bg-muted/30 opacity-60 cursor-not-allowed"
        }`}
      onClick={canRun && !isDone && !isProcessing ? onRun : undefined}
      disabled={!canRun || isDone || isProcessing}
      data-testid={`enhance-chip-${id}`}
    >
      <div className="shrink-0">
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : isDone ? (
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
        ) : (
          <Icon className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isDone
            ? t("aiStudio.completed")
            : isProcessing
            ? t("aiStudio.processing")
            : eligibleCount === 0
            ? "—"
            : isActive && runLabel
            ? runLabel
            : scopeLabel
            ? t("aiStudio.chipScopedCost", { count: eligibleCount, scope: scopeLabel, cost: creditCost })
            : t("aiStudio.chipAllCost", { count: eligibleCount, cost: creditCost })}
        </p>
      </div>
    </button>
  );

  if (!canRun && !isDone && !isProcessing && credits < creditCost && eligibleCount > 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[200px]">
          {t("aiStudio.lowCredits", { count: shortfall })} — {t("aiStudio.viewPlans")}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
