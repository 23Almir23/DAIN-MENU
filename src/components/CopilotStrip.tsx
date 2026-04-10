/**
 * CopilotStrip — Ambient single-signal strip for the workspace.
 *
 * Shows the single highest-priority Copilot signal at the top of the left
 * working area. The strip is hidden when all signals are clear, so its absence
 * itself signals a healthy menu.
 *
 * Priority order is defined by resolveCopilotSignals() in copilot-signals.ts
 * (same resolver used by CopilotPanel, ensuring both surfaces agree on priority).
 *
 * Dismissed signals are stored in sessionStorage so they re-appear on the
 * next page load if the underlying condition is still true.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X, ArrowRight, AlertCircle, Sparkles, PenLine, Globe, Ban, Star, PlayCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopilotContext } from "@/hooks/use-copilot";
import { resolveCopilotSignals } from "@/lib/copilot-signals";
import type { SignalIconKey, SignalSeverity } from "@/lib/copilot-signals";

const ICON_MAP: Record<SignalIconKey, React.ElementType> = {
  AlertCircle,
  Sparkles,
  PenLine,
  Globe,
  Ban,
  Star,
  PlayCircle,
  CreditCard,
};

const COLOR_MAP: Record<SignalSeverity, string> = {
  error: "bg-destructive/8 border-destructive/25 text-destructive",
  warning: "bg-amber-50 border-amber-200/70 text-amber-900 dark:bg-amber-950/20 dark:border-amber-800/50 dark:text-amber-200",
  info: "bg-blue-50 border-blue-200/70 text-blue-900 dark:bg-blue-950/20 dark:border-blue-800/50 dark:text-blue-200",
};

const ICON_COLOR_MAP: Record<SignalSeverity, string> = {
  error: "text-destructive",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-blue-600 dark:text-blue-400",
};

interface CopilotStripProps {
  onExpandEnhance: () => void;
  onAllDismissed?: () => void;
}

export function CopilotStrip({ onExpandEnhance, onAllDismissed }: CopilotStripProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem("copilot_strip_dismissed");
      return stored ? new Set<string>(JSON.parse(stored) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const { data: ctx } = useCopilotContext({ staleTime: 30_000 });

  const dismiss = (key: string) => {
    const nextDismissed = new Set(dismissed);
    nextDismissed.add(key);
    setDismissed(nextDismissed);
    try {
      sessionStorage.setItem("copilot_strip_dismissed", JSON.stringify([...nextDismissed]));
    } catch {
      // sessionStorage unavailable — dismiss in memory only
    }
    // Notify parent if this dismissal clears the last visible signal
    if (ctx) {
      const remaining = resolveCopilotSignals(ctx).filter((s) => !nextDismissed.has(s.key));
      if (remaining.length === 0) {
        onAllDismissed?.();
      }
    }
  };

  if (!ctx) return null;

  const signals = resolveCopilotSignals(ctx);
  const descriptor = signals.find((s) => !dismissed.has(s.key));
  if (!descriptor) return null;

  const Icon = ICON_MAP[descriptor.iconKey];
  const onAction =
    descriptor.navigateTo === "__enhance__"
      ? onExpandEnhance
      : () => navigate(descriptor.navigateTo);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 border-b text-sm ${COLOR_MAP[descriptor.severity]}`}
      data-testid="copilot-strip"
    >
      <Icon className={`h-4 w-4 shrink-0 ${ICON_COLOR_MAP[descriptor.severity]}`} />
      <p className="flex-1 min-w-0 truncate">{descriptor.stripText}</p>
      <Button
        size="sm"
        variant="ghost"
        className="shrink-0 h-7 px-2 text-xs font-medium gap-1 hover:bg-black/5 dark:hover:bg-white/10"
        onClick={onAction}
        data-testid="copilot-strip-action"
      >
        {descriptor.stripActionLabel}
        <ArrowRight className="h-3 w-3" />
      </Button>
      <button
        onClick={() => dismiss(descriptor.key)}
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
        aria-label={t("common.dismiss")}
        data-testid="copilot-strip-dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
