/**
 * Gemini menu parser + AI Studio actions.
 *
 * parseMenuContent() accepts raw menu text OR a base64-encoded file (image/PDF)
 * and returns a structured draft with categories, items, and per-item
 * confidence signals. All responses are intended for human review before
 * any data is saved.
 *
 * rewriteDescriptions() — improves item descriptions via Gemini
 * translateItems()       — translates name + description to a target language
 * estimateCalories()     — estimates calorie counts per dish
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

// ─── Output schema (menu parse) ───────────────────────────────────────────────

const ParsedItemSchema = z.object({
  name: z.string(),
  description: z.string().default(""),
  price: z.number().default(0),
  categoryName: z.string(),
  confidence: z.enum(["high", "medium", "low"]).default("high"),
  warnings: z.array(z.string()).default([]),
});

const ParsedMenuSchema = z.object({
  categories: z.array(z.object({ name: z.string() })),
  items: z.array(ParsedItemSchema),
  warnings: z.array(z.string()).default([]),
  partial: z.boolean().default(false),
});

export type ParsedMenu = z.infer<typeof ParsedMenuSchema>;
export type ParsedItem = z.infer<typeof ParsedItemSchema>;

// ─── AI Studio types ──────────────────────────────────────────────────────────

export interface AiItem { id: string; name: string; description: string; }
export interface RewriteResult { id: string; description: string; }
export interface TranslateResult { id: string; name: string; description: string; }
export interface CalorieResult { id: string; calories: number | null; }

// ─── Input ────────────────────────────────────────────────────────────────────

export interface ParseMenuInput {
  text?: string;
  base64?: string;
  mimeType?: string;
  /** ISO 639-1 code for the language the menu document is written in. Used as a parsing hint. */
  baseLang?: string;
}

// ─── Error class ─────────────────────────────────────────────────────────────

export class GeminiError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "GeminiError";
    this.code = code;
  }
}

// ─── Language label map (for prompts) ────────────────────────────────────────

const LANG_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  zh: "Chinese (Simplified)",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
};

export function getLangLabel(code: string): string {
  return LANG_LABELS[code] ?? code;
}

// ─── Model ────────────────────────────────────────────────────────────────────
// Single constant used by both getModel() and parseMenuContent() so a model
// change only needs to happen here.
const GEMINI_MODEL = "gemini-2.5-flash";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function extractJson(text: string): unknown {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return null;
}

/**
 * Extract a JSON array from a Gemini response, with best-effort partial salvage.
 * Tries: full parse → array regex → individual object extraction.
 */
function extractJsonArray(text: string): unknown[] {
  // 1. Try full parse — handles well-formed JSON mode responses
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    // Single object returned instead of array — wrap it
    if (parsed && typeof parsed === "object") return [parsed];
  } catch {}

  // 2. Try isolating the array bracket region
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  // 3. Partial salvage — extract individual top-level objects from the text
  const salvaged: unknown[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        try { salvaged.push(JSON.parse(text.slice(start, i + 1))); } catch {}
        start = -1;
      }
    }
  }
  if (salvaged.length > 0) {
    console.warn(`extractJsonArray: salvaged ${salvaged.length} object(s) from malformed response`);
    return salvaged;
  }

  return [];
}

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError(
      "AI features are not configured. Please add your Gemini API key in settings.",
      "NO_KEY"
    );
  }
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: GEMINI_MODEL });
}

async function callGemini(prompt: string): Promise<unknown> {
  const model = getModel();
  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    return extractJson(result.response.text());
  } catch (err: unknown) {
    console.error("[Gemini] callGemini raw error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("API_KEY_INVALID") || msg.toLowerCase().includes("api key not valid")) {
      throw new GeminiError("Gemini API key is invalid. Check your GEMINI_API_KEY setting.", "INVALID_KEY");
    }
    if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      throw new GeminiError("Gemini quota exceeded. Try again in a few minutes.", "QUOTA");
    }
    throw new GeminiError("AI request failed. Please try again.", "REQUEST_FAILED");
  }
}

/** callGemini variant that uses JSON response mode and returns an array. */
async function callGeminiArray(prompt: string): Promise<unknown[]> {
  const model = getModel();
  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    });
    return extractJsonArray(result.response.text());
  } catch (err: unknown) {
    console.error("[Gemini] callGeminiArray raw error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("API_KEY_INVALID") || msg.toLowerCase().includes("api key not valid")) {
      throw new GeminiError("Gemini API key is invalid. Check your GEMINI_API_KEY setting.", "INVALID_KEY");
    }
    if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      throw new GeminiError("Gemini quota exceeded. Try again in a few minutes.", "QUOTA");
    }
    throw new GeminiError("AI request failed. Please try again.", "REQUEST_FAILED");
  }
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT_BASE = `You are a restaurant menu parser. Your job is to read a restaurant menu and extract structured data.

Return ONLY a valid JSON object — no markdown, no code blocks, no explanation. Just raw JSON.

Required format:
{
  "categories": [
    { "name": "Category name" }
  ],
  "items": [
    {
      "name": "Item name",
      "description": "Item description, or empty string if not shown on the menu",
      "price": 12.50,
      "categoryName": "Must match a category name exactly",
      "confidence": "high",
      "warnings": []
    }
  ],
  "warnings": [],
  "partial": false
}

Rules:
- confidence: "high" = all fields clearly readable. "medium" = price missing or ambiguous. "low" = item name unclear.
- price: Use 0 if the price is not shown. Add "price not shown" to that item's warnings array.
- description: Use empty string if not present in the menu. Do NOT invent descriptions.
- categoryName: Must exactly match one of the names in the categories array.
- warnings per item: list specific issues (e.g. "price unclear", "category ambiguous").
- partial: set true only if you could not read the complete menu.
- Never invent, guess, or hallucinate any data that is not present in the menu.
- Preserve the original language of all dish names, descriptions, and categories exactly as they appear in the menu. Do NOT translate anything.`;

function buildSystemPrompt(baseLang?: string): string {
  if (!baseLang || baseLang === "en") return SYSTEM_PROMPT_BASE;
  const langLabel = getLangLabel(baseLang);
  return `${SYSTEM_PROMPT_BASE}\n- This menu is written in ${langLabel}. Extract all text faithfully in ${langLabel} without translating.`;
}

// ─── parseMenuContent ─────────────────────────────────────────────────────────

export async function parseMenuContent(input: ParseMenuInput): Promise<ParsedMenu> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError(
      "Menu parsing is not configured. Please add your Gemini API key in settings.",
      "NO_KEY"
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const systemPrompt = buildSystemPrompt(input.baseLang);

  type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
  let parts: Part[];

  if (input.base64 && input.mimeType) {
    parts = [
      { text: systemPrompt },
      { inlineData: { mimeType: input.mimeType, data: input.base64 } },
    ];
  } else if (input.text) {
    parts = [{ text: `${systemPrompt}\n\nMenu content:\n\n${input.text}` }];
  } else {
    throw new GeminiError("No menu content provided.", "NO_INPUT");
  }

  let responseText: string;
  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
    });
    responseText = result.response.text();
  } catch (err: unknown) {
    console.error("[Gemini] parseMenuContent raw error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("API_KEY_INVALID") || msg.toLowerCase().includes("api key not valid")) {
      throw new GeminiError("Gemini API key is invalid. Check your GEMINI_API_KEY setting.", "INVALID_KEY");
    }
    if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      throw new GeminiError("Gemini quota exceeded. Try again in a few minutes.", "QUOTA");
    }
    throw new GeminiError("Menu parsing request failed. Please try again.", "REQUEST_FAILED");
  }

  const raw = extractJson(responseText);
  if (!raw) {
    return {
      categories: [],
      items: [],
      warnings: ["Could not read the menu structure. Try pasting the text directly, or add items manually."],
      partial: true,
    };
  }

  const validated = ParsedMenuSchema.safeParse(raw);
  if (!validated.success) {
    // Schema invalid — try to salvage whatever is parseable so operators see
    // partial data rather than an empty result.
    const partial = raw as Record<string, unknown>;

    const partialCategories: { name: string }[] = Array.isArray(partial.categories)
      ? (partial.categories as Record<string, unknown>[])
          .filter((c) => typeof c.name === "string" && (c.name as string).trim())
          .map((c) => ({ name: (c.name as string).trim() }))
      : [];

    const partialItems: ParsedMenu["items"] = Array.isArray(partial.items)
      ? (partial.items as Record<string, unknown>[])
          .filter((i) => typeof i.name === "string" && (i.name as string).trim())
          .map((i) => ({
            name: (i.name as string).trim(),
            description: typeof i.description === "string" ? i.description : "",
            price: typeof i.price === "number" ? i.price : 0,
            categoryName: typeof i.categoryName === "string" ? i.categoryName : "",
            confidence: (["high", "medium", "low"] as const).includes(i.confidence as "high" | "medium" | "low")
              ? (i.confidence as "high" | "medium" | "low")
              : "low",
            warnings: Array.isArray(i.warnings)
              ? (i.warnings as unknown[]).filter((w) => typeof w === "string") as string[]
              : ["Could not fully validate this item"],
          }))
      : [];

    return {
      categories: partialCategories,
      items: partialItems,
      warnings: ["Menu was partially read. Please review everything carefully and add any missing items in the Menu Builder."],
      partial: true,
    };
  }

  return validated.data;
}

// ─── parseDishPhoto ───────────────────────────────────────────────────────────
// Completely separate from parseMenuContent.
// Task: visual recognition + appetizing description of ONE plated dish.
// Price, allergens, and category are intentionally excluded — they cannot be
// reliably inferred from a dish photo. The existing menu-import prompt and
// endpoint are not touched.

const DISH_PHOTO_PROMPT = `You are a culinary AI. Look at this photo of a plated dish and identify what it is.

Return ONLY a valid JSON object — no markdown, no code blocks, no explanation. Just raw JSON.

Required format:
{
  "name": "Dish name",
  "description": "1-2 sentence appetizing description based on what you can see",
  "confidence": "high"
}

Rules:
- name: Most likely dish name based on visual appearance. If a food name is readable in the image (on a label, chalkboard, or signage), prefer that. Otherwise infer from appearance.
- description: 15–60 words. Write an appetizing, sensory description of what you can see — colour, texture, visible ingredients. Do NOT mention prices, quantities, or restaurant names.
- confidence: "high" = dish clearly identifiable. "medium" = recognisable but some uncertainty. "low" = difficult to identify confidently.
- Even at low confidence, return your best guess. NEVER return an empty name — if completely unrecognisable, use "Unknown dish".
- If the photo does not appear to contain food, return name "Not a food item", description "", confidence "low".`;

export interface DishDraft {
  name: string;
  description: string;
  confidence: "high" | "medium" | "low";
}

const DishDraftSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

export async function parseDishPhoto(base64: string, mimeType: string): Promise<DishDraft> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError(
      "Dish scanning is not configured. Please add your Gemini API key.",
      "NO_KEY"
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  let responseText: string;
  try {
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { text: DISH_PHOTO_PROMPT },
          { inlineData: { mimeType, data: base64 } },
        ],
      }],
    });
    responseText = result.response.text();
  } catch (err: unknown) {
    console.error("[Gemini] parseDishPhoto raw error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("API_KEY_INVALID") || msg.toLowerCase().includes("api key not valid")) {
      throw new GeminiError("Gemini API key is invalid. Check your GEMINI_API_KEY setting.", "INVALID_KEY");
    }
    if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      throw new GeminiError("Gemini quota exceeded. Try again in a few minutes.", "QUOTA");
    }
    throw new GeminiError("Dish scanning request failed. Please try again.", "REQUEST_FAILED");
  }

  const raw = extractJson(responseText);
  if (!raw) {
    throw new GeminiError(
      "Could not read the dish from that photo. Please try again or fill in manually.",
      "PARSE_FAILED"
    );
  }

  const validated = DishDraftSchema.safeParse(raw);
  if (!validated.success || !validated.data.name.trim()) {
    throw new GeminiError(
      "Could not identify a dish in that photo. Please try again or fill in manually.",
      "PARSE_FAILED"
    );
  }

  return validated.data as DishDraft;
}

// ─── Rewrite threshold ────────────────────────────────────────────────────────
// Items whose descriptions already meet or exceed this length are considered
// sufficiently detailed and are skipped to avoid unnecessary Gemini calls.
const REWRITE_THRESHOLD = 80;

// ─── rewriteDescriptions ──────────────────────────────────────────────────────

export async function rewriteDescriptions(items: AiItem[], baseLang?: string): Promise<RewriteResult[]> {
  // Skip items that already have a sufficiently detailed description.
  const needsRewrite = items.filter((i) => i.description.trim().length < REWRITE_THRESHOLD);
  if (needsRewrite.length === 0) return [];

  const results: RewriteResult[] = [];

  const langLabel = baseLang ? getLangLabel(baseLang) : "English";
  const langInstruction = baseLang && baseLang !== "en"
    ? ` Write every description in ${langLabel}. Do not translate — keep the same language as the input.`
    : "";

  for (const batch of chunk(needsRewrite, 20)) {
    const prompt = `You are a restaurant menu copywriter. For each dish, write a concise, appetizing 1–2 sentence description (20–80 words) that helps guests understand and want to order it. Use specific, sensory language. Do NOT invent ingredients not clearly implied by the dish name or existing description.${langInstruction}

Return ONLY a valid JSON array — no markdown, no code fences, no explanation:
[{ "id": "<id>", "description": "<improved description>" }]

Dishes:
${JSON.stringify(batch.map((i) => ({ id: i.id, name: i.name, description: i.description })))}`;

    const entries = await callGeminiArray(prompt);
    for (const raw_entry of entries) {
      const e = raw_entry as Record<string, unknown>;
      if (e && typeof e.id === "string" && typeof e.description === "string" && (e.description as string).trim()) {
        results.push({ id: e.id, description: (e.description as string).trim() });
      }
    }
  }

  return results;
}

// ─── translateItems ───────────────────────────────────────────────────────────

export async function translateItems(
  items: AiItem[],
  targetLang: string,
  sourceLang?: string
): Promise<TranslateResult[]> {
  const targetLabel = getLangLabel(targetLang);
  const sourceLabel = getLangLabel(sourceLang ?? "en");
  const sourceClause = `from ${sourceLabel} into ${targetLabel}`;
  const results: TranslateResult[] = [];

  for (const batch of chunk(items, 20)) {
    const prompt = `Translate the following restaurant menu items ${sourceClause}. Translate the "name" and "description" fields faithfully. Preserve the meaning and tone. If a description is an empty string, keep it as an empty string. Do not add or remove information.

Return ONLY a valid JSON array — no markdown, no code fences, no explanation:
[{ "id": "<id>", "name": "<translated name>", "description": "<translated description>" }]

Items:
${JSON.stringify(batch.map((i) => ({ id: i.id, name: i.name, description: i.description })))}`;

    const entries = await callGeminiArray(prompt);
    for (const raw_entry of entries) {
      const e = raw_entry as Record<string, unknown>;
      if (e && typeof e.id === "string" && typeof e.name === "string" && (e.name as string).trim()) {
        results.push({
          id: e.id,
          name: (e.name as string).trim(),
          description: typeof e.description === "string" ? (e.description as string).trim() : "",
        });
      }
    }
  }

  return results;
}

// ─── estimateCalories ─────────────────────────────────────────────────────────

export async function estimateCalories(items: AiItem[]): Promise<CalorieResult[]> {
  const results: CalorieResult[] = [];

  for (const batch of chunk(items, 20)) {
    const prompt = `Estimate the calorie content of each restaurant dish based on its name and description. Use typical restaurant portion sizes. Use integers only. Use null for dishes you genuinely cannot estimate.

Return ONLY a valid JSON array — no markdown, no code fences, no explanation:
[{ "id": "<id>", "calories": 450 }]

Dishes:
${JSON.stringify(batch.map((i) => ({ id: i.id, name: i.name, description: i.description })))}`;

    const entries = await callGeminiArray(prompt);
    for (const raw_entry of entries) {
      const e = raw_entry as Record<string, unknown>;
      if (e && typeof e.id === "string") {
        const raw_cal = e.calories;
        const calories =
          raw_cal === null || raw_cal === undefined
            ? null
            : typeof raw_cal === "number" && Number.isFinite(raw_cal) && raw_cal > 0
            ? Math.round(raw_cal)
            : null;
        results.push({ id: e.id, calories });
      }
    }
  }

  return results;
}
