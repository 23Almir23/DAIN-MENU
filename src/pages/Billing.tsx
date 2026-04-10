import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useBilling } from "@/hooks/use-billing";
import { useMenuStats } from "@/hooks/use-menu-stats";
import { useMenu } from "@/hooks/use-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Check, Sparkles, Globe, PenLine, ShieldCheck, ArrowRight,
  CreditCard, Flame, Eye, AlertCircle,
  Clock, RefreshCw, Info, Gift,
} from "lucide-react";
import { toast } from "sonner";
import { PageWrapper } from "@/components/PageWrapper";
import { PageHeader } from "@/components/PageHeader";
import { useNavigate } from "react-router-dom";
import { getAvailableLanguages } from "@/lib/i18n-utils";
import { AI_CREDIT_COSTS } from "@/services/menu-service";

const PLAN_DEFS = [
  { id: "free" as const, price: 0, credits: 50, languages: 0 },
  { id: "starter" as const, price: 19, credits: 200, languages: 3 },
  { id: "pro" as const, price: 49, credits: 1000, languages: 10 },
];

const CREDIT_ACTIONS = [
  { action: "rewrite", cost: AI_CREDIT_COSTS.rewrite, icon: PenLine },
  { action: "translate", cost: AI_CREDIT_COSTS.translate, icon: Globe },
  { action: "allergen", cost: AI_CREDIT_COSTS.allergens, icon: ShieldCheck },
  { action: "calorie", cost: AI_CREDIT_COSTS.calories, icon: Flame },
];

export default function Billing() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { credits, plan: currentPlanId, planCredits, isLowCredits, isOutOfCredits, creditHistory: history, setPlan, isSettingPlan, isLoading: isBillingLoading } = useBilling();
  const stats = useMenuStats();
  const { categories, menuItems, isLoading: isMenuLoading } = useMenu();
  const availableLangs = getAvailableLanguages(menuItems, categories);

  const PLANS = PLAN_DEFS.map((p) => ({
    ...p,
    name: t(`pricing.plans.${p.id}.name`),
    tagline: t(`pricing.plans.${p.id}.tagline`),
    highlights: t(`pricing.plans.${p.id}.highlights`, { returnObjects: true }) as string[],
  }));
  const currentPlan = PLANS.find((p) => p.id === currentPlanId) || PLANS[0];
  const creditsUsed = Math.max(0, planCredits - credits);
  const creditUsagePercent = planCredits > 0
    ? Math.min(100, Math.round((creditsUsed / planCredits) * 100))
    : 0;

  const n = stats.totalItems;
  const fullRewriteCost = n * AI_CREDIT_COSTS.rewrite;
  const fullAllergenCost = n * AI_CREDIT_COSTS.allergens;
  const oneLanguageCost = n * AI_CREDIT_COSTS.translate;
  const fullRefreshCost = fullRewriteCost + fullAllergenCost;

  const selectPlan = (planId: typeof PLAN_DEFS[number]["id"]) => {
    const plan = PLANS.find((p) => p.id === planId);
    setPlan(planId);
    toast.success(t("billing.tryPlan", { plan: plan?.name ?? planId }), {
      description: t("billing.noPayment"),
    });
  };

  const creditStatusColor = isOutOfCredits
    ? "text-destructive"
    : isLowCredits
    ? "text-amber-600 dark:text-amber-400"
    : "text-foreground";

  return (
    <PageWrapper maxWidth="lg">
      <PageHeader
        title={t("billing.title")}
        icon={CreditCard}
        description={t("dashboard.stats.aiCredits")}
      />

      {/* Early-access notice */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-3">
        <Gift className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">{t("billing.freeAccess")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("billing.noPayment")}
          </p>
        </div>
      </div>

      {/* Credit warning banners */}
      {isOutOfCredits && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">{t("aiStudio.noCredits")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("billing.freeAccess")}
            </p>
          </div>
        </div>
      )}

      {isLowCredits && !isOutOfCredits && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {t("aiStudio.lowCredits", { count: credits })}
          </p>
        </div>
      )}

      {/* ── Credit Balance + Menu Context ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className={isOutOfCredits ? "bg-destructive/5 border-destructive/20" : isLowCredits ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900" : "bg-primary/5 border-primary/20"}>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t("billing.creditsRemaining")}</p>
                <p className={`text-4xl font-bold font-serif ${creditStatusColor}`}>{isBillingLoading ? "—" : credits}</p>
              </div>
              <div className={`rounded-full p-3 ${isOutOfCredits ? "bg-destructive/10" : isLowCredits ? "bg-amber-100 dark:bg-amber-900/30" : "bg-primary/10"}`}>
                <Sparkles className={`h-6 w-6 ${isOutOfCredits ? "text-destructive" : isLowCredits ? "text-amber-600 dark:text-amber-400" : "text-primary"}`} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{isBillingLoading ? "—" : creditsUsed} {t("billing.creditsUsed")}</span>
                <span>{planCredits} {t("billing.creditsTotal")}</span>
              </div>
              <Progress
                value={isBillingLoading ? 0 : creditUsagePercent}
                className="h-1.5"
              />
            </div>
            {isOutOfCredits && (
              <p className="text-xs flex items-center gap-1 text-destructive font-medium">
                <AlertCircle className="h-3 w-3" />
                {t("aiStudio.noCredits")}
              </p>
            )}
            {isLowCredits && !isOutOfCredits && (
              <p className="text-xs flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-3 w-3" />
                {t("aiStudio.lowCredits", { count: credits })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-3">
            <p className="text-sm font-medium">{t("billing.menuSnapshot")}</p>
            <div className="grid grid-cols-2 gap-3">
              <Stat label={t("dashboard.stats.menuItems")} value={isMenuLoading ? "—" : n} />
              <Stat label={t("menuBuilder.stats.total")} value={isMenuLoading ? "—" : stats.totalCategories} />
              <Stat label={t("dashboard.stats.guestLanguages")} value={isMenuLoading ? "—" : (availableLangs.length > 0 ? `EN +${availableLangs.length}` : "EN only")} />
              <Stat label={t("aiStudio.noAllergensTagged")} value={isMenuLoading ? "—" : stats.withAllergens} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="flex-1 text-xs text-muted-foreground" onClick={() => navigate("/ai-studio")}>
                {t("sidebar.workspace")} <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
              <Button size="sm" variant="ghost" className="flex-1 text-xs text-muted-foreground" onClick={() => navigate("/preview")}>
                {t("sidebar.guestPreview")} <Eye className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Credit Costs ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> {t("billing.creditCost")}
          </CardTitle>
          <CardDescription>
            {n > 0 ? t("billing.creditCostDescMenu", { n }) : t("billing.creditCostDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CREDIT_ACTIONS.map((c) => (
              <div key={c.action} className="rounded-xl border px-3 py-3 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <c.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                  <p className="text-xs font-medium leading-tight">{t(`pricing.creditUsage.${c.action}`)}</p>
                </div>
                <p className="text-lg font-bold">{c.cost}<span className="text-xs font-normal text-muted-foreground"> {t("pricing.creditUsage.perItem")}</span></p>
                <p className="text-[10px] text-muted-foreground leading-snug">{t(`billing.perItemExample_${c.action}`)}</p>
                {n > 0 && (
                  <p className="text-[10px] text-muted-foreground border-t pt-1">
                    {t("billing.fullMenuCost")} <span className="font-semibold text-foreground">{c.cost * n}</span> {t("billing.creditsTotal")}
                  </p>
                )}
              </div>
            ))}
          </div>

          {n > 0 && (
            <>
              <Separator />
              <div className="rounded-xl bg-muted/50 p-4">
                <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3 text-primary" /> {t("billing.typicalScenarios", { n })}
                </p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Scenario label={t("billing.scenarioQuickLabel")} detail={t("billing.scenarioQuickDetail")} credits={fullRefreshCost} time={t("billing.scenarioQuickTime")} />
                  <Scenario label={t("billing.scenarioLangLabel")} detail={t("billing.scenarioLangDetail")} credits={oneLanguageCost} time={t("billing.scenarioLangTime")} />
                  <Scenario label={t("billing.scenarioFullLabel")} detail={t("billing.scenarioFullDetail")} credits={fullRefreshCost + oneLanguageCost} time={t("billing.scenarioFullTime")} />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Plans ── */}
      <div id="plan-section">
        <h2 className="text-lg font-sans-heading mb-1">{t("billing.upcomingPlans")}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("billing.upcomingPlansDesc")}
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = currentPlanId === plan.id;
            const fullRewrites = n > 0 ? Math.floor(plan.credits / (n * AI_CREDIT_COSTS.rewrite)) : 0;
            const fullRefreshes = n > 0 ? Math.floor(plan.credits / Math.max(1, fullRefreshCost)) : 0;

            return (
              <Card key={plan.id} className={`relative flex flex-col ${isCurrent ? "ring-2 ring-primary" : ""} ${(plan as any).popular && !isCurrent ? "border-primary/40" : ""}`}>
                {isCurrent && <Badge className="absolute -top-2 left-4">{t("billing.currentPlan")}</Badge>}
                {(plan as any).popular && !isCurrent && (
                  <Badge variant="secondary" className="absolute -top-2 right-4 text-[10px]">{t("billing.mostChosen")}</Badge>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-sans-heading">{plan.name}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">{plan.tagline}</CardDescription>
                  <div className="pt-2">
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{t("billing.freeAccess")}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  {n > 0 && (
                    <div className="rounded-xl bg-muted/50 px-3 py-2 mb-3 space-y-0.5">
                      <p className="text-xs">
                        <span className="font-semibold text-foreground">{plan.credits}</span>
                        <span className="text-muted-foreground"> {t("billing.creditsIncluded")}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("billing.fullRefreshes", { count: fullRefreshes })} {t("billing.rewritePasses", { count: fullRewrites })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {plan.languages === 0
                          ? t("billing.englishOnly")
                          : t("billing.upToLanguages", { count: plan.languages })}
                      </p>
                    </div>
                  )}
                  <ul className="space-y-2 flex-1">
                    {plan.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    disabled={isCurrent || isSettingPlan}
                    onClick={() => selectPlan(plan.id)}
                    data-testid={`plan-select-${plan.id}`}
                  >
                    {isCurrent ? t("billing.currentPlan") : t("billing.tryPlan", { plan: plan.name })}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-3">
          <Info className="h-3 w-3 shrink-0" />
          {t("billing.paidPlansComingSoon")}
        </p>
      </div>

      {/* ── Payment Notice ── */}
      <Card className="border-dashed">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg p-2 bg-muted shrink-0">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium mb-1">{t("billing.paymentTitle")}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("billing.paymentDesc")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Credit History ── */}
      <div>
        <h2 className="text-lg font-sans-heading mb-1">{t("billing.creditHistory")}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t("billing.creditHistoryDesc")}</p>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {history.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-muted-foreground text-sm">{t("billing.noCreditsHistory")}</p>
                  <Button variant="link" size="sm" onClick={() => navigate("/ai-studio")} className="mt-1">
                    {t("sidebar.workspace")} <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              ) : (
                history.slice(0, 15).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{tx.action}</p>
                      {tx.itemName && <p className="text-xs text-muted-foreground truncate">{tx.itemName}</p>}
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className={`font-semibold text-sm ${tx.amount > 0 ? "text-primary" : "text-destructive"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{new Date(tx.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Scenario({ label, detail, credits, time }: { label: string; detail: string; credits: number; time: string }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5 space-y-0.5">
      <p className="text-xs font-medium">{label}</p>
      <p className="text-[10px] text-muted-foreground">{detail}</p>
      <div className="flex items-center justify-between pt-1 border-t mt-1.5">
        <span className="text-xs font-semibold">{t("billing.scenarioCredits", { credits })}</span>
        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
          <Clock className="h-2.5 w-2.5" /> {time}
        </span>
      </div>
    </div>
  );
}
