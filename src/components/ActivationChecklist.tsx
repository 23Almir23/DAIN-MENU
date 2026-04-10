/**
 * ActivationChecklist — three-milestone progress card shown on the Dashboard
 * until the operator reaches "first real value."
 */

import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ChefHat, UtensilsCrossed, Eye, ArrowRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ActivationChecklistProps {
  nameSet: boolean;
  hasItems: boolean;
  hasOpenedPreview: boolean;
  hasRunAI: boolean;
}

export function ActivationChecklist({ nameSet, hasItems, hasOpenedPreview, hasRunAI }: ActivationChecklistProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const milestones = [
    {
      done: nameSet,
      icon: ChefHat,
      label: t("activation.steps.setName.title"),
      sub: t("activation.steps.setName.sub"),
      action: "/settings",
      actionLabel: t("activation.steps.setName.action"),
      testId: "milestone-name",
    },
    {
      done: hasItems,
      icon: UtensilsCrossed,
      label: t("activation.steps.addDish.title"),
      sub: t("activation.steps.addDish.sub"),
      action: hasItems ? "/menu" : "/setup",
      actionLabel: t("activation.steps.addDish.action"),
      testId: "milestone-items",
    },
    {
      done: hasOpenedPreview,
      icon: Eye,
      label: t("activation.steps.preview.title"),
      sub: t("activation.steps.preview.sub"),
      action: "/preview",
      actionLabel: t("activation.steps.preview.action"),
      testId: "milestone-preview",
    },
  ];

  const done = milestones.filter((m) => m.done).length;
  const percent = Math.round((done / milestones.length) * 100);
  const nextStep = milestones.find((m) => !m.done);

  return (
    <Card className="border-primary/20 bg-primary/[0.02] overflow-hidden" data-testid="activation-checklist">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-sans-heading text-sm">{t("activation.title", { done, total: milestones.length })}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("activation.subtitle")}</p>
          </div>
          <span className="text-sm font-semibold text-primary shrink-0">{percent}%</span>
        </div>

        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="space-y-2">
          {milestones.map((m) => (
            <button
              key={m.testId}
              data-testid={m.testId}
              onClick={() => !m.done && navigate(m.action)}
              disabled={m.done}
              className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                m.done
                  ? "text-muted-foreground cursor-default"
                  : "hover:bg-primary/5 cursor-pointer text-foreground"
              }`}
            >
              {m.done ? (
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className={m.done ? "line-through" : ""}>{m.label}</span>
                {!m.done && <p className="text-[11px] text-muted-foreground mt-0.5">{m.sub}</p>}
              </div>
              {!m.done && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            </button>
          ))}
        </div>

        {nextStep && (
          <div className="pt-1 flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => navigate(nextStep.action)}
              className="w-full sm:w-auto shadow-sm shadow-primary/15 h-11 sm:h-9"
              data-testid="activation-next-action"
            >
              <nextStep.icon className="h-4 w-4 mr-1.5" />
              {nextStep.actionLabel}
            </Button>
            {hasItems && !hasRunAI && (
              <Button variant="outline" onClick={() => navigate("/ai-studio")} className="w-full sm:w-auto h-11 sm:h-9">
                <Sparkles className="h-4 w-4 mr-1.5" />
                {t("activation.steps.translate.action")}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
