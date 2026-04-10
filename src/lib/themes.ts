export type TemplateId = "noir" | "classic" | "warm" | "minimal";

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  tagline: string;
  vars: Record<string, string>;
}

export const TEMPLATES: Record<TemplateId, TemplateDefinition> = {
  noir: {
    id: "noir",
    name: "Noir",
    tagline: "Dark & moody",
    vars: {
      "--bg": "#1a1a1a",
      "--bg-card": "#242424",
      "--text-primary": "#f0f0f0",
      "--text-secondary": "#999999",
      "--accent": "#c9703a",
      "--border": "#333333",
      "--price-color": "#c9703a",
    },
  },
  classic: {
    id: "classic",
    name: "Classic",
    tagline: "Clean & professional",
    vars: {
      "--bg": "#F5F5F5",
      "--bg-card": "#ffffff",
      "--text-primary": "#111111",
      "--text-secondary": "#666666",
      "--accent": "#c9703a",
      "--border": "#e5e5e5",
      "--price-color": "#c9703a",
    },
  },
  warm: {
    id: "warm",
    name: "Warm",
    tagline: "Earthy & inviting",
    vars: {
      "--bg": "#fdf6ef",
      "--bg-card": "#fffcf7",
      "--text-primary": "#3d2b1f",
      "--text-secondary": "#8a7562",
      "--accent": "#b0703c",
      "--border": "#e8ddd0",
      "--price-color": "#b0703c",
    },
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    tagline: "Pure & understated",
    vars: {
      "--bg": "#ffffff",
      "--bg-card": "#fafafa",
      "--text-primary": "#0a0a0a",
      "--text-secondary": "#888888",
      "--accent": "#1a1a1a",
      "--border": "#eeeeee",
      "--price-color": "#1a1a1a",
    },
  },
};

export function getTemplateVars(templateId?: string | null): React.CSSProperties {
  const key = (templateId ?? "noir") as TemplateId;
  const def = TEMPLATES[key] ?? TEMPLATES.noir;
  return def.vars as React.CSSProperties;
}

export const TEMPLATE_LIST = Object.values(TEMPLATES);

import type React from "react";
