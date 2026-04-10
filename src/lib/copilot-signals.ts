/**
 * copilot-signals — shared Copilot priority resolver.
 *
 * Canonical priority order:
 *   1. missingPrices       — launch blocker, guests see $0
 *   2. needsReview         — trust blocker, AI edits await approval
 *   3. missingDescriptions — content quality gap
 *   4. lowestTranslation   — lowest-pct incomplete language first
 *   5. soldOut             — operational
 *   6. specials            — operational
 *   7. service             — operational (suppressed when totalItems === 0)
 *   8. credits             — resource warning
 *
 * Both CopilotStrip and CopilotPanel import this. Strip picks [0];
 * Panel renders all in this order so both surfaces agree on priority.
 */

import type { CopilotContext } from "@/hooks/use-copilot";
import { getLanguage } from "@/lib/i18n-utils";

export type SignalIconKey =
  | "AlertCircle"
  | "Sparkles"
  | "PenLine"
  | "Globe"
  | "Ban"
  | "Star"
  | "PlayCircle"
  | "CreditCard";

export type SignalSeverity = "error" | "warning" | "info";

export interface CopilotSignalDescriptor {
  key: string;
  severity: SignalSeverity;
  iconKey: SignalIconKey;
  /** Strip text (single line, action-oriented) */
  stripText: string;
  stripActionLabel: string;
  /**
   * Route to navigate to. The special value "__enhance__" tells the strip to
   * call its onExpandEnhance callback rather than navigate.
   */
  navigateTo: string;
  /** Panel card label */
  panelLabel: string;
  /** Panel card detail sentence */
  panelDetail: string;
  panelActionLabel: string;
  panelBadgeText?: string;
  panelBadgeVariant?: "destructive" | "warning" | "secondary" | "default";
}

export function resolveCopilotSignals(ctx: CopilotContext): CopilotSignalDescriptor[] {
  const signals: CopilotSignalDescriptor[] = [];

  // 1. missingPrices
  if (ctx.missingPrices > 0) {
    const n = ctx.missingPrices;
    signals.push({
      key: "missingPrices",
      severity: "error",
      iconKey: "AlertCircle",
      stripText: `${n} item${n !== 1 ? "s" : ""} ${n !== 1 ? "have" : "has"} no price — guests will see $0.00`,
      stripActionLabel: "Find items",
      navigateTo: "/menu",
      panelLabel: "Items with no price",
      panelDetail: `${n} item${n !== 1 ? "s are" : " is"} priced at $0. Update them in the builder.`,
      panelActionLabel: "Fix",
      panelBadgeText: `${n}`,
      panelBadgeVariant: "destructive",
    });
  }

  // 2. needsReview
  if (ctx.needsReview > 0) {
    const n = ctx.needsReview;
    signals.push({
      key: "needsReview",
      severity: "warning",
      iconKey: "Sparkles",
      stripText: `${n} item${n !== 1 ? "s" : ""} ${n !== 1 ? "need" : "needs"} your review — approve before sharing`,
      stripActionLabel: "Review now",
      navigateTo: "/menu?filter=needsReview",
      panelLabel: "Items need review",
      panelDetail: `${n} item${n !== 1 ? "s were" : " was"} updated by AI and await your approval.`,
      panelActionLabel: "Review",
      panelBadgeText: `${n}`,
      panelBadgeVariant: "warning",
    });
  }

  // 3. missingDescriptions
  if (ctx.missingDescriptions > 0) {
    const n = ctx.missingDescriptions;
    const isStartingPoint = ctx.totalItems > 0 && n === ctx.totalItems;
    signals.push({
      key: "missingDescriptions",
      severity: "warning",
      iconKey: "PenLine",
      stripText: isStartingPoint
        ? `Your menu has ${n} dish${n !== 1 ? "es" : ""} but no descriptions yet — this is your starting point.`
        : `${n} item${n !== 1 ? "s have" : " has"} no description — add them to help guests choose`,
      stripActionLabel: "Enhance",
      navigateTo: "/menu?intent=rewrite",
      panelLabel: isStartingPoint ? "Menu needs descriptions" : "Items need descriptions",
      panelDetail: isStartingPoint
        ? `Guests currently see plain dish names only. AI can write compelling descriptions in one click.`
        : `${n} item${n !== 1 ? "s are" : " is"} missing or have very short descriptions. AI can write them.`,
      panelActionLabel: "Rewrite",
      panelBadgeText: `${n}`,
      panelBadgeVariant: "warning",
    });
  }

  // 4. lowestTranslation — sort ascending by pct so lowest comes first
  const incompleteTranslations = ctx.translationCoverage
    .filter((t) => t.pct < 100)
    .sort((a, b) => a.pct - b.pct);

  for (const t of incompleteTranslations) {
    const langName = getLanguage(t.langCode)?.label ?? t.langCode.toUpperCase();
    signals.push({
      key: `translation_${t.langCode}`,
      severity: "info",
      iconKey: "Globe",
      stripText: `${langName} is ${t.pct}% translated — complete it for international guests`,
      stripActionLabel: "Translate",
      navigateTo: `/menu?intent=translate&lang=${t.langCode}`,
      panelLabel: `${langName} translations`,
      panelDetail: `${t.translated} of ${t.total} items translated (${t.pct}% complete).`,
      panelActionLabel: "Translate",
      panelBadgeText: `${t.pct}%`,
      panelBadgeVariant: "secondary",
    });
  }

  // 5. soldOut
  if (ctx.soldOut > 0) {
    const n = ctx.soldOut;
    signals.push({
      key: "soldOut",
      severity: "info",
      iconKey: "Ban",
      stripText: `${n} item${n !== 1 ? "s" : ""} sold out — update when restocked`,
      stripActionLabel: "Manage",
      navigateTo: "/dashboard?focus=service",
      panelLabel: "Sold-out items",
      panelDetail: `${n} item${n !== 1 ? "s are" : " is"} marked sold out. Clear them when restocked.`,
      panelActionLabel: "Manage",
      panelBadgeText: `${n}`,
      panelBadgeVariant: "secondary",
    });
  }

  // 6. specials
  if (ctx.specials > 0) {
    const n = ctx.specials;
    signals.push({
      key: "specials",
      severity: "info",
      iconKey: "Star",
      stripText: `${n} special${n !== 1 ? "s" : ""} active — clear when service ends`,
      stripActionLabel: "Dashboard",
      navigateTo: "/dashboard?focus=service",
      panelLabel: "Today's specials",
      panelDetail: `${n} item${n !== 1 ? "s are" : " is"} marked as a special.`,
      panelActionLabel: "Manage",
    });
  }

  // 7. service — suppressed when totalItems === 0 (noise reduction for empty menus)
  if (!ctx.serviceOpen && ctx.totalItems > 0) {
    signals.push({
      key: "service",
      severity: "info",
      iconKey: "PlayCircle",
      stripText: "Service mode not active — start it before opening",
      stripActionLabel: "Start",
      navigateTo: "/dashboard?focus=service",
      panelLabel: "Service mode",
      panelDetail: "Service is not active. Start it before opening so guests can order.",
      panelActionLabel: "Start",
    });
  }

  // 8. credits
  if (ctx.credits <= 10) {
    signals.push({
      key: "credits",
      severity: "info",
      iconKey: "CreditCard",
      stripText: `Only ${ctx.credits} credit${ctx.credits !== 1 ? "s" : ""} remaining — use them on highest-priority actions`,
      stripActionLabel: "View",
      navigateTo: "/billing",
      panelLabel: "AI credits low",
      panelDetail: `${ctx.credits} credits remaining on your ${ctx.plan} plan. Top up to keep AI features running.`,
      panelActionLabel: "Top up",
      panelBadgeText: "Low",
      panelBadgeVariant: "destructive",
    });
  }

  return signals;
}
