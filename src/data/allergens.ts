/** Canonical allergen list used across the app */
export const ALLERGEN_OPTIONS = [
  "gluten",
  "dairy",
  "eggs",
  "seafood",
  "nuts",
  "soy",
  "peanuts",
  "shellfish",
] as const;

export type Allergen = (typeof ALLERGEN_OPTIONS)[number];

/** Emoji icons for each allergen */
export const ALLERGEN_ICONS: Record<string, string> = {
  gluten: "🌾",
  dairy: "🥛",
  eggs: "🥚",
  seafood: "🐟",
  nuts: "🥜",
  soy: "🫘",
  peanuts: "🥜",
  shellfish: "🦐",
};

/** Keyword → allergen mapping for simulated AI detection */
const KEYWORD_ALLERGENS: Record<string, Allergen[]> = {
  pasta: ["gluten"],
  spaghetti: ["gluten", "eggs"],
  bread: ["gluten"],
  sourdough: ["gluten"],
  ladyfinger: ["gluten"],
  cheese: ["dairy"],
  cream: ["dairy"],
  butter: ["dairy"],
  burrata: ["dairy"],
  mascarpone: ["dairy"],
  parmesan: ["dairy"],
  parmigiano: ["dairy"],
  pecorino: ["dairy"],
  egg: ["eggs"],
  squid: ["seafood"],
  calamari: ["seafood"],
  fish: ["seafood"],
  "sea bass": ["seafood"],
  branzino: ["seafood"],
};

/** Detect allergens from a text description (simulated AI) */
export function detectAllergens(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  Object.entries(KEYWORD_ALLERGENS).forEach(([keyword, allergens]) => {
    if (lower.includes(keyword)) allergens.forEach((a) => found.add(a));
  });
  return Array.from(found);
}
