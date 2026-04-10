import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useBilling } from "@/hooks/use-billing";
import { useAuth } from "@/hooks/use-auth";
import {
  Check, ArrowRight, Sparkles, Globe, ShieldCheck, Flame, PenLine, ChefHat, Zap,
} from "lucide-react";

const PLAN_IDS = ["free", "starter", "pro"] as const;
type PlanId = typeof PLAN_IDS[number];

const PLAN_META: Record<PlanId, { price: number; credits: number; languages: number; ctaVariant: "outline" | "default" | "secondary" }> = {
  free:    { price: 0,  credits: 50,   languages: 0,  ctaVariant: "outline" },
  starter: { price: 19, credits: 200,  languages: 3,  ctaVariant: "default" },
  pro:     { price: 49, credits: 1000, languages: 10, ctaVariant: "secondary" },
};

const CREDIT_ICONS: Record<string, React.ElementType> = {
  rewrite: PenLine,
  translate: Globe,
  allergen: ShieldCheck,
  calorie: Flame,
};

export default function Pricing() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { plan: currentPlan } = useBilling(isAuthenticated);

  const handleCta = (_planId: string) => {
    window.location.href = "/api/login";
  };

  const creditCallouts = [
    { stat: t("billing.statFreeCredits"), label: t("pricing.plans.free.highlights.0") ?? "rewrites 25 dish descriptions", icon: PenLine },
    { stat: t("billing.statStarterCredits"), label: t("pricing.plans.starter.highlights.0") ?? "full refresh for a 30-item menu monthly", icon: Sparkles },
    { stat: t("billing.stat1Credit"), label: t("pricing.creditUsage.perItem"), icon: Zap },
  ];

  const creditActions = (["rewrite", "translate", "allergen", "calorie"] as const).map((key) => ({
    key,
    action: t(`pricing.creditUsage.${key}`),
    cost: key === "rewrite" ? 2 : 1,
    icon: CREDIT_ICONS[key],
  }));

  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      {/* Header */}
      <div className="text-center mb-14">
        <Badge variant="outline" className="mb-6 text-xs px-4 py-1.5 border-primary/20 bg-primary/5 text-primary rounded-full">
          <ChefHat className="h-3 w-3 mr-1.5" /> {t("pricing.subtitle")}
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-serif tracking-tight">
          {t("pricing.title")}
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {t("pricing.noBilling")}
        </p>
      </div>

      {/* Credit callout bar */}
      <div className="grid sm:grid-cols-3 gap-3 mb-12 max-w-3xl mx-auto">
        {creditCallouts.map((c) => (
          <div key={c.stat} className="flex items-center gap-3 border rounded-xl px-4 py-3 bg-muted/30">
            <c.icon className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold">{c.stat}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-6 mb-16">
        {PLAN_IDS.map((planId) => {
          const meta = PLAN_META[planId];
          const isCurrent = isAuthenticated && currentPlan === planId;
          const highlights = t(`pricing.plans.${planId}.highlights`, { returnObjects: true }) as string[];
          const tagline = t(`pricing.plans.${planId}.tagline`);
          const billing = t(`pricing.plans.${planId}.billing`);
          const cta = t(`pricing.plans.${planId}.cta`);
          const name = t(`pricing.plans.${planId}.name`);

          return (
            <Card
              key={planId}
              className={`relative flex flex-col ${isCurrent ? "ring-2 ring-primary shadow-lg" : ""}`}
            >
              {isCurrent && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <Badge variant="secondary" className="px-3 py-0.5 text-xs shadow-sm">
                    {t("pricing.currentPlan")}
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-serif">{name}</CardTitle>
                <CardDescription className="text-xs leading-relaxed">{tagline}</CardDescription>
                <div className="pt-2">
                  <span className="text-4xl font-serif">${meta.price}</span>
                  <span className="text-sm text-muted-foreground ml-1.5">{billing}</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-5">
                <ul className="space-y-2.5">
                  {Array.isArray(highlights) ? highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2.5 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </li>
                  )) : null}
                </ul>
                <div className="mt-auto">
                  {isCurrent ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => navigate("/billing")}
                      data-testid={`plan-cta-${planId}`}
                    >
                      {t("pricing.managePlan")}
                    </Button>
                  ) : (
                    <>
                      <Button
                        className="w-full"
                        variant={meta.ctaVariant}
                        onClick={() => handleCta(planId)}
                        data-testid={`plan-cta-${planId}`}
                      >
                        {cta} <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                      {meta.price > 0 && (
                        <p className="text-center text-[11px] text-muted-foreground mt-2">
                          {t("pricing.freeAccess")}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Credit cost table */}
      <div className="mb-16">
        <h2 className="text-2xl font-serif tracking-tight text-center mb-2">{t("pricing.howCredits")}</h2>
        <p className="text-center text-muted-foreground mb-8">
          {t("pricing.noCard")}
        </p>
        <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
          {creditActions.map((item) => (
            <div key={item.key} className="flex items-center gap-4 border rounded-xl p-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{item.action}</p>
                <p className="text-xs text-muted-foreground">{t(`pricing.creditUsage.perItem`)}</p>
              </div>
              <Badge variant="secondary" className="text-xs font-semibold shrink-0">
                {item.cost} {item.cost !== 1 ? "credits" : "credit"}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto mb-16">
        <h2 className="text-2xl font-serif tracking-tight text-center mb-8">{t("pricing.faq")}</h2>
        <div className="space-y-5">
          {(["whatIsCredit", "rollover", "contract"] as const).map((key) => (
            <div key={key} className="border rounded-xl p-5">
              <p className="font-medium mb-2">{t(`pricing.faqItems.${key}.q`)}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{t(`pricing.faqItems.${key}.a`)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="text-center border rounded-2xl bg-muted/30 p-10">
        <h2 className="text-2xl font-serif tracking-tight mb-3">{t("landing.terminalCta.title")}</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          {t("landing.pricingEntry.text")}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button size="lg" className="px-8 shadow-sm shadow-primary/15" onClick={() => { window.location.href = "/api/login"; }}>
            {t("pricing.startFree")} <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
