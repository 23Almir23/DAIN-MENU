/**
 * Copilot intent router — pure deterministic function.
 *
 * Maps typed operator input to a fixed set of navigation actions.
 * No AI, no network calls.
 */

export interface NavigateAction {
  type: "navigate";
  to: string;
  label: string;
}

export interface UnknownAction {
  type: "unknown";
}

export type IntentAction = NavigateAction | UnknownAction;

interface IntentRule {
  keywords: string[];
  action: NavigateAction;
}

const INTENT_RULES: IntentRule[] = [
  {
    keywords: ["rewrite", "improve description", "better description", "description"],
    action: { type: "navigate", to: "/ai-studio", label: "Open AI Studio to rewrite descriptions" },
  },
  {
    keywords: ["translate", "translation", "language", "spanish", "french", "german", "italian", "portuguese", "chinese", "japanese", "korean", "arabic"],
    action: { type: "navigate", to: "/ai-studio", label: "Open AI Studio to translate menu" },
  },
  {
    keywords: ["calorie", "calories", "nutrition", "kcal"],
    action: { type: "navigate", to: "/ai-studio", label: "Open AI Studio to estimate calories" },
  },
  {
    keywords: ["start service", "open service", "begin service"],
    action: { type: "navigate", to: "/dashboard?focus=service", label: "Go to Dashboard to start service" },
  },
  {
    keywords: ["end service", "stop service", "close service", "finish service"],
    action: { type: "navigate", to: "/dashboard?focus=service", label: "Go to Dashboard to end service" },
  },
  {
    keywords: ["sold out", "soldout", "sell out", "clear sold"],
    action: { type: "navigate", to: "/dashboard?focus=service", label: "Go to Dashboard → service controls" },
  },
  {
    keywords: ["service", "session"],
    action: { type: "navigate", to: "/dashboard?focus=service", label: "Go to Dashboard → service controls" },
  },
  {
    keywords: ["special", "specials"],
    action: { type: "navigate", to: "/dashboard?focus=service", label: "Go to Dashboard → specials" },
  },
  {
    keywords: ["review", "needs review", "needsreview", "to review"],
    action: { type: "navigate", to: "/menu?filter=needsReview", label: "Open Menu Builder to review items" },
  },
  {
    keywords: ["qr", "qr code", "qr codes", "share", "sharing"],
    action: { type: "navigate", to: "/qr-codes", label: "Go to QR & Sharing" },
  },
  {
    keywords: ["billing", "credits", "credit", "plan", "upgrade"],
    action: { type: "navigate", to: "/billing", label: "Go to Plan & Credits" },
  },
  {
    keywords: ["settings", "profile", "contact", "hours"],
    action: { type: "navigate", to: "/settings", label: "Go to Settings" },
  },
  {
    keywords: ["preview", "guest", "view menu"],
    action: { type: "navigate", to: "/preview", label: "Open Guest Preview" },
  },
  {
    keywords: ["menu", "builder", "items", "dishes"],
    action: { type: "navigate", to: "/menu", label: "Open Menu Builder" },
  },
  {
    keywords: ["dashboard", "home", "overview"],
    action: { type: "navigate", to: "/dashboard", label: "Go to Dashboard" },
  },
];

export const INTENT_HINTS = [
  "rewrite descriptions",
  "translate to Spanish",
  "estimate calories",
  "start service",
  "end service",
  "clear sold out",
  "needs review",
  "qr codes",
];

export function resolveIntent(input: string): IntentAction {
  const normalized = input.toLowerCase().trim();
  if (!normalized) return { type: "unknown" };

  for (const rule of INTENT_RULES) {
    if (rule.keywords.some((kw) => normalized.includes(kw))) {
      return rule.action;
    }
  }
  return { type: "unknown" };
}
