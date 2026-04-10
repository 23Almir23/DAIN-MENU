/**
 * CopilotPanel — contextual menu health assistant.
 */

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  AlertCircle, Sparkles, PenLine, Globe, Ban, Star, PlayCircle, CreditCard,
  RefreshCw, ArrowRight, CheckCircle2,
  Loader2, CornerDownLeft,
} from "lucide-react";
import { useCopilotContext, countOpenSignals } from "@/hooks/use-copilot";
import { resolveCopilotSignals } from "@/lib/copilot-signals";
import type { SignalIconKey } from "@/lib/copilot-signals";
import { resolveIntent, INTENT_HINTS } from "@/lib/copilot-intents";
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ICON_MAP: Record<SignalIconKey, React.ElementType> = {
  AlertCircle, Sparkles, PenLine, Globe, Ban, Star, PlayCircle, CreditCard,
};

interface SignalCardProps {
  icon: React.ReactNode;
  label: string;
  detail: string;
  badge?: { text: string; variant: "destructive" | "warning" | "secondary" | "default" };
  actionLabel: string;
  onAction: () => void;
  testId: string;
}

function SignalCard({ icon, label, detail, badge, actionLabel, onAction, testId }: SignalCardProps) {
  return (
    <div className="rounded-xl border bg-card p-3.5 flex items-start gap-3" data-testid={testId}>
      <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium leading-tight">{label}</p>
          {badge && (
            <Badge
              variant={badge.variant === "warning" ? "outline" : badge.variant}
              className={
                badge.variant === "warning"
                  ? "text-[10px] px-1.5 py-0 border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/30"
                  : "text-[10px] px-1.5 py-0"
              }
            >
              {badge.text}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="shrink-0 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={onAction}
        data-testid={`${testId}-action`}
      >
        {actionLabel}
        <ArrowRight className="h-3 w-3 ml-1" />
      </Button>
    </div>
  );
}

function AllClear() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
      <CheckCircle2 className="h-8 w-8 text-green-500" />
      <p className="text-sm font-medium text-foreground">{t("copilot.menuLooksGreat")}</p>
      <p className="text-xs max-w-48">{t("copilot.noIssues")}</p>
    </div>
  );
}

export function CopilotPanel({ open, onClose }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { data: ctx, isLoading, isError, refetch } = useCopilotContext({ enabled: open, staleTime: 0 });

  const [command, setCommand] = useState("");
  const [commandResult, setCommandResult] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCommand("");
      setCommandResult(null);
    }
  }, [open]);

  function go(to: string) {
    onClose();
    navigate(to);
  }

  function handleCommand(e: React.FormEvent) {
    e.preventDefault();
    const action = resolveIntent(command);
    if (action.type === "navigate") {
      setCommandResult(null);
      go(action.to);
    } else {
      setCommandResult(t("copilot.helpHint", { hints: INTENT_HINTS.slice(0, 4).join(", ") }));
    }
  }

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ["/api/copilot/context"] });
    refetch();
  }

  const issueCount = ctx ? countOpenSignals(ctx) : 0;
  const hasAnyIssue = issueCount > 0;
  const signals = ctx ? resolveCopilotSignals(ctx) : [];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0"
        data-testid="copilot-panel"
      >
        <SheetHeader className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-semibold leading-none">{t("copilot.title")}</SheetTitle>
              <SheetDescription className="text-xs mt-0.5 leading-none">
                {isLoading
                  ? t("copilot.loading")
                  : isError
                  ? t("copilot.errorLoad")
                  : hasAnyIssue
                  ? t("copilot.signals", { count: issueCount })
                  : t("copilot.allClear")}
              </SheetDescription>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              onClick={handleRefresh}
              disabled={isLoading}
              data-testid="copilot-refresh"
              aria-label={t("copilot.refresh")}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </SheetHeader>

        <Separator />

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t("copilot.checking")}</span>
            </div>
          )}

          {isError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive text-center">
              {t("copilot.loadError")}
            </div>
          )}

          {ctx && (
            <>
              {signals.map((s) => {
                const IconComp = ICON_MAP[s.iconKey];
                const iconColorClass =
                  s.severity === "error"
                    ? "text-destructive"
                    : s.severity === "warning"
                    ? "text-amber-500"
                    : s.iconKey === "Globe"
                    ? "text-blue-500"
                    : s.iconKey === "Ban"
                    ? "text-orange-500"
                    : s.iconKey === "Star"
                    ? "text-yellow-500"
                    : s.iconKey === "CreditCard"
                    ? "text-destructive"
                    : "text-muted-foreground";

                return (
                  <SignalCard
                    key={s.key}
                    testId={`signal-${s.key}`}
                    icon={<IconComp className={`h-4 w-4 ${iconColorClass}`} />}
                    label={s.panelLabel}
                    detail={s.panelDetail}
                    badge={
                      s.panelBadgeText
                        ? { text: s.panelBadgeText, variant: s.panelBadgeVariant ?? "secondary" }
                        : undefined
                    }
                    actionLabel={s.panelActionLabel}
                    onAction={() => go(s.navigateTo === "__enhance__" ? "/ai-studio" : s.navigateTo)}
                  />
                );
              })}
              {!hasAnyIssue && !isLoading && <AllClear />}
            </>
          )}
        </div>

        <Separator />

        <div className="px-4 py-3 shrink-0 space-y-2">
          <form onSubmit={handleCommand} className="flex gap-2" data-testid="copilot-command-form">
            <Input
              ref={inputRef}
              value={command}
              onChange={(e) => {
                setCommand(e.target.value);
                setCommandResult(null);
              }}
              onFocus={() => setShowHints(true)}
              onBlur={() => setTimeout(() => setShowHints(false), 150)}
              placeholder={t("copilot.placeholder")}
              className="flex-1 h-9 text-sm"
              data-testid="copilot-command-input"
              autoComplete="off"
            />
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={!command.trim()}
              data-testid="copilot-command-submit"
              aria-label={t("copilot.runCommand")}
            >
              <CornerDownLeft className="h-4 w-4" />
            </Button>
          </form>

          {commandResult && (
            <p className="text-xs text-muted-foreground px-1" data-testid="copilot-command-result">
              {commandResult}
            </p>
          )}

          {showHints && !command && (
            <div className="flex flex-wrap gap-1.5">
              {INTENT_HINTS.map((hint) => (
                <button
                  key={hint}
                  type="button"
                  className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
                  onMouseDown={() => {
                    setCommand(hint);
                    inputRef.current?.focus();
                  }}
                  data-testid={`copilot-hint-${hint.replace(/\s+/g, "-")}`}
                >
                  {hint}
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
