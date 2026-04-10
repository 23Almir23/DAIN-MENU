/**
 * API routes — Phase 1.
 *
 * Restaurant:
 *   POST   /api/restaurant           — create (first-time setup)
 *   GET    /api/restaurant           — fetch
 *   PATCH  /api/restaurant           — update
 *
 * Menu (categories + items together):
 *   GET    /api/menu                 — categories + items for the user's restaurant
 *
 * Categories (ownership: category.restaurantId === userRestaurant.id):
 *   POST   /api/categories           — create
 *   PATCH  /api/categories/:id       — rename / reorder
 *   DELETE /api/categories/:id       — delete (CASCADE removes items via FK)
 *
 * Items (ownership: item.restaurantId === userRestaurant.id):
 *   POST   /api/items                — create
 *   POST   /api/items/:id/duplicate  — clone
 *   PATCH  /api/items/:id            — partial update
 *   DELETE /api/items/:id            — delete
 *
 * Boundary helpers:
 *   toDb() / toClient()    — restaurant socialLinks serialisation
 *   catToClient()          — strips internal fields, adds translations: {}
 *   itemToClient()         — coerces price string → number, adds translations: {}
 *
 * Ownership model:
 *   All mutations resolve the restaurant via restaurants.userId = session sub.
 *   Never accept restaurantId or userId from the request body.
 */

import type { Express } from "express";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  restaurants,
  insertRestaurantSchema,
  categories,
  insertCategorySchema,
  categoryTranslations,
  menuItems as menuItemsTable,
  insertMenuItemSchema,
  itemTranslations,
  insertItemTranslationSchema,
  serviceSessions,
} from "./schema";
import { isAuthenticated } from "./replit_integrations/auth";
import {
  parseMenuContent, GeminiError,
  rewriteDescriptions, translateItems, estimateCalories,
  parseDishPhoto,
  type AiItem,
} from "./gemini";
import { z } from "zod";
import multer from "multer";

// ── Multer — in-memory multipart handler (no disk writes) ─────────────────────

const UPLOAD_ACCEPTED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** 20 MB in-memory upload instance. Shared across file-upload routes. */
const menuUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB hard limit (multer enforces before handler)
});

/**
 * Content-signature (magic-byte) validation.
 * Guards against client-provided MIME type spoofing by inspecting actual file bytes.
 */
function hasMagicBytes(buffer: Buffer, mimetype: string): boolean {
  if (buffer.length < 12) return false;
  switch (mimetype) {
    case "application/pdf":
      // %PDF
      return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
    case "image/jpeg":
      // FF D8 FF
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/png":
      // 89 50 4E 47 0D 0A 1A 0A
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    case "image/webp":
      // RIFF????WEBP
      return (
        buffer.slice(0, 4).toString("ascii") === "RIFF" &&
        buffer.slice(8, 12).toString("ascii") === "WEBP"
      );
    default:
      return false;
  }
}

// ── Shared helper ────────────────────────────────────────────────────────────

/** Look up the restaurant owned by this user, including operational fields needed by AI routes. */
async function getUserRestaurant(userId: string) {
  const [r] = await db
    .select({ id: restaurants.id, baseLanguage: restaurants.baseLanguage })
    .from(restaurants)
    .where(eq(restaurants.userId, userId))
    .limit(1);
  return r ?? null;
}

// ── Restaurant boundary helpers ──────────────────────────────────────────────

function toDb(data: Record<string, unknown>) {
  const out = { ...data };
  if (Array.isArray(out.socialLinks)) out.socialLinks = JSON.stringify(out.socialLinks);
  return out;
}

function toClient(row: Record<string, unknown>) {
  const out = { ...row };
  if (typeof out.socialLinks === "string" && out.socialLinks) {
    try { out.socialLinks = JSON.parse(out.socialLinks as string); }
    catch { out.socialLinks = []; }
  } else if (!out.socialLinks) {
    out.socialLinks = [];
  }
  return out;
}

// ── Category boundary helper ─────────────────────────────────────────────────

function catToClient(
  c: typeof categories.$inferSelect,
  catTransMap: Record<string, { name: string }> = {}
) {
  return {
    id: c.id,
    name: c.name,
    order: c.order,
    translations: catTransMap,
  };
}

// ── Item boundary helper ─────────────────────────────────────────────────────

function itemToClient(
  i: typeof menuItemsTable.$inferSelect,
  transMap: Record<string, { name: string; description: string }> = {}
) {
  return {
    id: i.id,
    name: i.name,
    description: i.description ?? "",
    // numeric(10,2) is returned as a string by the pg driver — coerce to number
    price: parseFloat(String(i.price)),
    categoryId: i.categoryId,
    allergens: i.allergens ?? [],
    calories: i.calories ?? undefined,
    isAvailable: i.isAvailable,
    isPopular: i.isPopular,
    isSpecial: i.isSpecial,
    soldOut: i.soldOut,
    needsReview: i.needsReview,
    image: i.image ?? undefined,
    translations: transMap,
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

export function registerRoutes(app: Express) {

  // ── Health check (public) ─────────────────────────────────────────────────
  app.get("/api/health", async (_req, res) => {
    try {
      await db.execute("SELECT 1");
      res.json({ status: "ok", database: "connected" });
    } catch (err) {
      res.status(500).json({ status: "error", database: "unreachable", detail: String(err) });
    }
  });

  // ── Public guest endpoints (no auth required) ─────────────────────────────

  app.get("/api/public/restaurant/:restaurantId", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const [r] = await db
        .select({
          name: restaurants.name,
          cuisine: restaurants.cuisine,
          guestTheme: restaurants.guestTheme,
          template: restaurants.template,
          baseLanguage: restaurants.baseLanguage,
          currency: restaurants.currency,
          defaultLocale: restaurants.defaultLocale,
          description: restaurants.description,
          address: restaurants.address,
          phone: restaurants.phone,
          coverImage: restaurants.coverImage,
          guestContactInfo: restaurants.guestContactInfo,
          city: restaurants.city,
        })
        .from(restaurants)
        .where(eq(restaurants.id, restaurantId))
        .limit(1);
      if (!r) return res.status(404).json({ message: "Restaurant not found." });
      res.json(r);
    } catch (err) {
      console.error("GET /api/public/restaurant/:restaurantId:", err);
      res.status(500).json({ message: "Failed to load restaurant." });
    }
  });

  app.get("/api/public/menu/:restaurantId", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const [r] = await db
        .select({ id: restaurants.id })
        .from(restaurants)
        .where(eq(restaurants.id, restaurantId))
        .limit(1);
      if (!r) return res.status(404).json({ message: "Restaurant not found." });

      const [cats, items, transRows, catTransRows] = await Promise.all([
        db.select().from(categories).where(eq(categories.restaurantId, restaurantId)),
        db.select().from(menuItemsTable).where(
          and(eq(menuItemsTable.restaurantId, restaurantId), eq(menuItemsTable.isAvailable, true))
        ),
        db.select({
          itemId: itemTranslations.itemId,
          langCode: itemTranslations.langCode,
          name: itemTranslations.name,
          description: itemTranslations.description,
        }).from(itemTranslations)
          .innerJoin(menuItemsTable, eq(itemTranslations.itemId, menuItemsTable.id))
          .where(and(eq(menuItemsTable.restaurantId, restaurantId), eq(menuItemsTable.isAvailable, true))),
        db.select({
          categoryId: categoryTranslations.categoryId,
          langCode: categoryTranslations.langCode,
          name: categoryTranslations.name,
        }).from(categoryTranslations)
          .innerJoin(categories, eq(categoryTranslations.categoryId, categories.id))
          .where(eq(categories.restaurantId, restaurantId)),
      ]);

      cats.sort((a, b) => a.order - b.order);

      const transMap: Record<string, Record<string, { name: string; description: string }>> = {};
      for (const row of transRows) {
        if (!transMap[row.itemId]) transMap[row.itemId] = {};
        transMap[row.itemId][row.langCode] = { name: row.name, description: row.description ?? "" };
      }

      const catTransMap: Record<string, Record<string, { name: string }>> = {};
      for (const row of catTransRows) {
        if (!catTransMap[row.categoryId]) catTransMap[row.categoryId] = {};
        catTransMap[row.categoryId][row.langCode] = { name: row.name };
      }

      res.json({
        categories: cats.map((c) => catToClient(c, catTransMap[c.id] ?? {})),
        menuItems: items.map((i) => itemToClient(i, transMap[i.id] ?? {})),
      });
    } catch (err) {
      console.error("GET /api/public/menu/:restaurantId:", err);
      res.status(500).json({ message: "Failed to load menu." });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // RESTAURANT
  // ════════════════════════════════════════════════════════════════════════════

  app.post("/api/restaurant", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const [existing] = await db.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.userId, userId)).limit(1);
      if (existing) return res.status(409).json({ message: "Restaurant already exists. Use PATCH to update." });

      const body = toDb({ ...req.body });
      delete (body as any).id;
      const parsed = insertRestaurantSchema.safeParse({ ...body, userId });
      if (!parsed.success) return res.status(400).json({ message: "Invalid data.", errors: parsed.error.flatten() });

      const [created] = await db.insert(restaurants).values({ ...parsed.data, plan: "starter", credits: 200 } as any).returning();
      res.status(201).json(toClient(created as any));
    } catch (err) {
      console.error("POST /api/restaurant:", err);
      res.status(500).json({ message: "Failed to create restaurant." });
    }
  });

  app.get("/api/restaurant", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.userId, userId)).limit(1);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found. Complete onboarding first." });
      res.json(toClient(restaurant as any));
    } catch (err) {
      console.error("GET /api/restaurant:", err);
      res.status(500).json({ message: "Failed to load restaurant." });
    }
  });

  app.patch("/api/restaurant", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const rawBody = toDb({ ...req.body });
      delete (rawBody as any).userId;
      delete (rawBody as any).user_id;
      delete (rawBody as any).id;

      const parsed = insertRestaurantSchema.partial().safeParse(rawBody);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data.", errors: parsed.error.flatten() });

      const [updated] = await db.update(restaurants).set({ ...(parsed.data as any), updatedAt: new Date() }).where(eq(restaurants.userId, userId)).returning();
      if (!updated) return res.status(404).json({ message: "No restaurant found to update." });
      res.json(toClient(updated as any));
    } catch (err) {
      console.error("PATCH /api/restaurant:", err);
      res.status(500).json({ message: "Failed to update restaurant." });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // MENU (categories + items in one fetch — shared query key /api/menu)
  // ════════════════════════════════════════════════════════════════════════════

  app.get("/api/menu", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });

      const [cats, items, transRows, catTransRows] = await Promise.all([
        db.select().from(categories).where(eq(categories.restaurantId, restaurant.id)),
        db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, restaurant.id)),
        db.select({
          itemId: itemTranslations.itemId,
          langCode: itemTranslations.langCode,
          name: itemTranslations.name,
          description: itemTranslations.description,
        }).from(itemTranslations)
          .innerJoin(menuItemsTable, eq(itemTranslations.itemId, menuItemsTable.id))
          .where(eq(menuItemsTable.restaurantId, restaurant.id)),
        db.select({
          categoryId: categoryTranslations.categoryId,
          langCode: categoryTranslations.langCode,
          name: categoryTranslations.name,
        }).from(categoryTranslations)
          .innerJoin(categories, eq(categoryTranslations.categoryId, categories.id))
          .where(eq(categories.restaurantId, restaurant.id)),
      ]);

      // Group item translations by itemId → { langCode → { name, description } }
      const transMap: Record<string, Record<string, { name: string; description: string }>> = {};
      for (const row of transRows) {
        if (!transMap[row.itemId]) transMap[row.itemId] = {};
        transMap[row.itemId][row.langCode] = { name: row.name, description: row.description ?? "" };
      }

      // Group category translations by categoryId → { langCode → { name } }
      const catTransMap: Record<string, Record<string, { name: string }>> = {};
      for (const row of catTransRows) {
        if (!catTransMap[row.categoryId]) catTransMap[row.categoryId] = {};
        catTransMap[row.categoryId][row.langCode] = { name: row.name };
      }

      // Sort categories by order, then by creation (stable)
      cats.sort((a, b) => a.order - b.order);

      res.json({
        categories: cats.map((c) => catToClient(c, catTransMap[c.id] ?? {})),
        menuItems: items.map((i) => itemToClient(i, transMap[i.id] ?? {})),
      });
    } catch (err) {
      console.error("GET /api/menu:", err);
      res.status(500).json({ message: "Failed to load menu." });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // CATEGORIES
  // ════════════════════════════════════════════════════════════════════════════

  app.post("/api/categories", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });

      // Compute the next order value
      const existing = await db.select({ order: categories.order }).from(categories).where(eq(categories.restaurantId, restaurant.id));
      const nextOrder = existing.length > 0 ? Math.max(...existing.map((c) => c.order)) + 1 : 0;

      const parsed = insertCategorySchema.safeParse({
        name: req.body.name,
        restaurantId: restaurant.id,
        order: nextOrder,
      });
      if (!parsed.success) return res.status(400).json({ message: "Invalid data.", errors: parsed.error.flatten() });

      const [created] = await db.insert(categories).values(parsed.data as any).returning();
      res.status(201).json(catToClient(created));
    } catch (err) {
      console.error("POST /api/categories:", err);
      res.status(500).json({ message: "Failed to create category." });
    }
  });

  app.patch("/api/categories/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });

      // Verify ownership
      const [cat] = await db.select().from(categories).where(
        and(eq(categories.id, req.params.id), eq(categories.restaurantId, restaurant.id))
      ).limit(1);
      if (!cat) return res.status(404).json({ message: "Category not found." });

      const updates: Record<string, unknown> = {};
      if (typeof req.body.name === "string") updates.name = req.body.name.trim();
      if (typeof req.body.order === "number") updates.order = req.body.order;

      const [updated] = await db.update(categories).set(updates).where(eq(categories.id, cat.id)).returning();
      res.json(catToClient(updated));
    } catch (err) {
      console.error("PATCH /api/categories/:id:", err);
      res.status(500).json({ message: "Failed to update category." });
    }
  });

  app.delete("/api/categories/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });

      const [cat] = await db.select({ id: categories.id }).from(categories).where(
        and(eq(categories.id, req.params.id), eq(categories.restaurantId, restaurant.id))
      ).limit(1);
      if (!cat) return res.status(404).json({ message: "Category not found." });

      // Cascade delete is handled by the FK constraint (onDelete: "cascade")
      // But menu_items→categories uses RESTRICT — delete items first
      await db.delete(menuItemsTable).where(eq(menuItemsTable.categoryId, cat.id));
      await db.delete(categories).where(eq(categories.id, cat.id));

      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /api/categories/:id:", err);
      res.status(500).json({ message: "Failed to delete category." });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // MENU ITEMS
  // ════════════════════════════════════════════════════════════════════════════

  app.post("/api/items", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });

      // Verify the target category belongs to this restaurant
      const [cat] = await db.select({ id: categories.id }).from(categories).where(
        and(eq(categories.id, req.body.categoryId), eq(categories.restaurantId, restaurant.id))
      ).limit(1);
      if (!cat) return res.status(400).json({ message: "Category not found or not owned by this restaurant." });

      const rawBody = { ...req.body };
      delete rawBody.id;
      // Strip server-controlled fields — client must never set these
      delete rawBody.needsReview;
      // Coerce price to string for Zod (numeric column)
      if (typeof rawBody.price === "number") rawBody.price = String(rawBody.price);

      const parsed = insertMenuItemSchema.safeParse({ ...rawBody, restaurantId: restaurant.id });
      if (!parsed.success) return res.status(400).json({ message: "Invalid data.", errors: parsed.error.flatten() });

      // Always create with needsReview=false; only AI/import routes set it to true
      const [created] = await db.insert(menuItemsTable).values({ ...parsed.data as any, needsReview: false }).returning();
      res.status(201).json(itemToClient(created));
    } catch (err) {
      console.error("POST /api/items:", err);
      res.status(500).json({ message: "Failed to create item." });
    }
  });

  app.post("/api/items/:id/duplicate", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });

      const [item] = await db.select().from(menuItemsTable).where(
        and(eq(menuItemsTable.id, req.params.id), eq(menuItemsTable.restaurantId, restaurant.id))
      ).limit(1);
      if (!item) return res.status(404).json({ message: "Item not found." });

      const [created] = await db.insert(menuItemsTable).values({
        restaurantId: restaurant.id,
        categoryId: item.categoryId,
        name: `${item.name} (copy)`,
        description: item.description,
        price: item.price,
        allergens: item.allergens,
        calories: item.calories,
        isAvailable: item.isAvailable,
        isPopular: false,
        image: item.image,
      } as any).returning();

      res.status(201).json(itemToClient(created));
    } catch (err) {
      console.error("POST /api/items/:id/duplicate:", err);
      res.status(500).json({ message: "Failed to duplicate item." });
    }
  });

  app.patch("/api/items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });

      const [item] = await db.select({ id: menuItemsTable.id }).from(menuItemsTable).where(
        and(eq(menuItemsTable.id, req.params.id), eq(menuItemsTable.restaurantId, restaurant.id))
      ).limit(1);
      if (!item) return res.status(404).json({ message: "Item not found." });

      const rawBody = { ...req.body };
      delete rawBody.id;
      delete rawBody.restaurantId;
      delete rawBody.needsReview;
      if (typeof rawBody.price === "number") rawBody.price = String(rawBody.price);

      // If categoryId is being changed, verify the new category is owned by this restaurant
      if (rawBody.categoryId) {
        const [cat] = await db.select({ id: categories.id }).from(categories).where(
          and(eq(categories.id, rawBody.categoryId), eq(categories.restaurantId, restaurant.id))
        ).limit(1);
        if (!cat) return res.status(400).json({ message: "Target category not owned by this restaurant." });
      }

      const parsed = insertMenuItemSchema.partial().safeParse(rawBody);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data.", errors: parsed.error.flatten() });

      const [updated] = await db.update(menuItemsTable)
        .set({ ...(parsed.data as any), updatedAt: new Date() })
        .where(eq(menuItemsTable.id, item.id))
        .returning();

      res.json(itemToClient(updated));
    } catch (err) {
      console.error("PATCH /api/items/:id:", err);
      res.status(500).json({ message: "Failed to update item." });
    }
  });

  app.delete("/api/items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });

      const [item] = await db.select({ id: menuItemsTable.id }).from(menuItemsTable).where(
        and(eq(menuItemsTable.id, req.params.id), eq(menuItemsTable.restaurantId, restaurant.id))
      ).limit(1);
      if (!item) return res.status(404).json({ message: "Item not found." });

      await db.delete(menuItemsTable).where(eq(menuItemsTable.id, item.id));
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /api/items/:id:", err);
      res.status(500).json({ message: "Failed to delete item." });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // BILLING
  // ════════════════════════════════════════════════════════════════════════════

  app.get("/api/billing", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const [r] = await db
        .select({ credits: restaurants.credits, plan: restaurants.plan, creditHistory: restaurants.creditHistory })
        .from(restaurants)
        .where(eq(restaurants.userId, userId))
        .limit(1);
      if (!r) return res.status(404).json({ message: "No restaurant found." });
      let creditHistory: object[] = [];
      try { creditHistory = JSON.parse(r.creditHistory ?? "[]"); } catch {}
      res.json({ credits: r.credits ?? 50, plan: r.plan ?? "free", creditHistory });
    } catch (err) {
      console.error("GET /api/billing:", err);
      res.status(500).json({ message: "Failed to fetch billing." });
    }
  });

  app.post("/api/billing/use-credits", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const { amount, action, itemName } = req.body;
      if (typeof amount !== "number" || amount <= 0) return res.status(400).json({ message: "Invalid amount." });
      const [r] = await db
        .select({ credits: restaurants.credits, creditHistory: restaurants.creditHistory })
        .from(restaurants)
        .where(eq(restaurants.userId, userId))
        .limit(1);
      if (!r) return res.status(404).json({ message: "No restaurant found." });
      const newCredits = Math.max(0, (r.credits ?? 50) - amount);
      let history: object[] = [];
      try { history = JSON.parse(r.creditHistory ?? "[]"); } catch {}
      const tx = { id: `tx-${Date.now()}`, action, amount: -amount, date: new Date().toISOString(), ...(itemName ? { itemName } : {}) };
      history = [tx, ...history].slice(0, 100);
      await db.update(restaurants)
        .set({ credits: newCredits, creditHistory: JSON.stringify(history) })
        .where(eq(restaurants.userId, userId));
      res.json({ credits: newCredits, creditHistory: history });
    } catch (err) {
      console.error("POST /api/billing/use-credits:", err);
      res.status(500).json({ message: "Failed to deduct credits." });
    }
  });

  app.post("/api/billing/set-plan", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const { planId } = req.body;
      if (!["free", "starter", "pro"].includes(planId)) return res.status(400).json({ message: "Invalid plan." });
      const [updated] = await db
        .update(restaurants)
        .set({ plan: planId })
        .where(eq(restaurants.userId, userId))
        .returning({ plan: restaurants.plan });
      if (!updated) return res.status(404).json({ message: "No restaurant found." });
      res.json({ plan: updated.plan });
    } catch (err) {
      console.error("POST /api/billing/set-plan:", err);
      res.status(500).json({ message: "Failed to update plan." });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // IMPORT — Gemini-backed menu parsing + batch confirm
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/import/menu-upload
   * Accepts a multipart/form-data upload with a single "file" field.
   * Validated in-memory: PDF, JPG, PNG, WEBP; max 20 MB.
   * Converts buffer → base64 → parseMenuContent → returns ParsedMenu draft.
   * Auth required. Does NOT save anything — data is for review only.
   * All error responses include fallback: true so the UI can offer "add manually".
   */
  app.post(
    "/api/import/menu-upload",
    isAuthenticated,
    // Wrap multer so we can return typed errors instead of Express's default handling
    (req, res, next) => {
      menuUpload.single("file")(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({
              message: "File is too large. Maximum allowed size is 20 MB.",
              fallback: true,
            });
          }
          return res.status(400).json({
            message: `Upload error: ${err.message}`,
            fallback: true,
          });
        }
        if (err) return next(err);
        next();
      });
    },
    async (req: any, res) => {
      try {
        const file = req.file as Express.Multer.File | undefined;
        if (!file) {
          return res.status(400).json({
            message: "No file received. Please attach a PDF or image (PDF, JPG, PNG, WEBP).",
            fallback: true,
          });
        }

        if (!UPLOAD_ACCEPTED_TYPES.has(file.mimetype)) {
          return res.status(400).json({
            message: `Unsupported file type "${file.mimetype}". Please upload a PDF, JPG, PNG, or WEBP file.`,
            fallback: true,
          });
        }

        // Content-signature check — validate actual file bytes match the declared MIME type
        // to guard against spoofed Content-Type headers.
        if (!hasMagicBytes(file.buffer, file.mimetype)) {
          return res.status(400).json({
            message: "The file content does not match its declared type. Please upload a valid PDF, JPG, PNG, or WEBP file.",
            fallback: true,
          });
        }

        const base64 = file.buffer.toString("base64");
        const userId: string = req.user.claims.sub;
        const restaurantForLang = await getUserRestaurant(userId);
        const result = await parseMenuContent({ base64, mimeType: file.mimetype, baseLang: restaurantForLang?.baseLanguage });
        res.json(result);
      } catch (err) {
        if (err instanceof GeminiError) {
          const status = (err.code === "NO_KEY" || err.code === "INVALID_KEY") ? 503 : 422;
          return res.status(status).json({
            message: err.message,
            code: err.code,
            fallback: true,
          });
        }
        console.error("POST /api/import/menu-upload:", err);
        res.status(500).json({
          message: "Menu parsing failed. Please try again or add items manually.",
          fallback: true,
        });
      }
    }
  );

  /**
   * POST /api/import/menu-text
   * Text-only import endpoint: accepts { text: string } and returns a ParsedMenu draft.
   * Auth required. Does NOT save anything — data is for review only.
   */
  app.post("/api/import/menu-text", isAuthenticated, async (req: any, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ message: "text is required and must be a non-empty string." });
      }
      if (text.length > 100_000) {
        return res.status(400).json({ message: "Text is too long. Maximum 100,000 characters." });
      }
      const userId: string = req.user.claims.sub;
      const restaurantForLang = await getUserRestaurant(userId);
      const result = await parseMenuContent({ text, baseLang: restaurantForLang?.baseLanguage });
      res.json(result);
    } catch (err) {
      if (err instanceof GeminiError) {
        const status = (err.code === "NO_KEY" || err.code === "INVALID_KEY") ? 503 : 422;
        return res.status(status).json({ message: err.message, code: err.code });
      }
      console.error("POST /api/import/menu-text:", err);
      res.status(500).json({ message: "Menu parsing failed. Please try again or add items manually." });
    }
  });

  /**
   * POST /api/items/parse-photo
   * Single-dish photo scanning. Accepts multipart/form-data with a "file" field.
   * Uses a dedicated visual-recognition prompt — NOT the menu-import parser.
   * Returns a DishDraft: { name, description, confidence }.
   * Auth required. Does NOT save anything — data is for operator review only.
   * Errors include fallback: true so the client can offer "add manually".
   */
  app.post(
    "/api/items/parse-photo",
    isAuthenticated,
    (req, res, next) => {
      menuUpload.single("file")(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({
              message: "File is too large. Maximum allowed size is 20 MB.",
              fallback: true,
            });
          }
          return res.status(400).json({
            message: `Upload error: ${err.message}`,
            fallback: true,
          });
        }
        if (err) return next(err);
        next();
      });
    },
    async (req: any, res) => {
      try {
        const file = req.file as Express.Multer.File | undefined;
        if (!file) {
          return res.status(400).json({
            message: "No file received. Please attach an image (JPG, PNG, or WEBP).",
            fallback: true,
          });
        }
        if (!UPLOAD_ACCEPTED_TYPES.has(file.mimetype)) {
          return res.status(400).json({
            message: `Unsupported file type "${file.mimetype}". Please upload a JPG, PNG, or WEBP.`,
            fallback: true,
          });
        }
        if (!hasMagicBytes(file.buffer, file.mimetype)) {
          return res.status(400).json({
            message: "The file content does not match its declared type. Please upload a valid JPG, PNG, or WEBP.",
            fallback: true,
          });
        }
        const base64 = file.buffer.toString("base64");
        const draft = await parseDishPhoto(base64, file.mimetype);
        res.json(draft);
      } catch (err) {
        if (err instanceof GeminiError) {
          const status = (err.code === "NO_KEY" || err.code === "INVALID_KEY") ? 503 : 422;
          return res.status(status).json({
            message: err.message,
            code: err.code,
            fallback: true,
          });
        }
        console.error("POST /api/items/parse-photo:", err);
        res.status(500).json({
          message: "Dish scanning failed. Please try again or fill in manually.",
          fallback: true,
        });
      }
    }
  );

  /**
   * POST /api/import/menu-parse
   * Accepts { text } or { base64, mimeType } and returns a ParsedMenu draft.
   * Auth required. Does NOT save anything — data is for review only.
   */
  app.post("/api/import/menu-parse", isAuthenticated, async (req: any, res) => {
    try {
      const { text, base64, mimeType } = req.body;

      if (!text && !base64) {
        return res.status(400).json({ message: "Provide either text or base64 file content." });
      }
      if (text && typeof text === "string" && text.length > 100_000) {
        return res.status(400).json({ message: "Text is too long. Maximum 100,000 characters." });
      }

      if (base64 && !mimeType) {
        return res.status(400).json({
          message: "mimeType is required when uploading a base64-encoded file (e.g. 'application/pdf', 'image/jpeg').",
        });
      }

      const userId: string = req.user.claims.sub;
      const restaurantForLang = await getUserRestaurant(userId);
      const result = await parseMenuContent({ text, base64, mimeType, baseLang: restaurantForLang?.baseLanguage });
      res.json(result);
    } catch (err) {
      if (err instanceof GeminiError) {
        const status = (err.code === "NO_KEY" || err.code === "INVALID_KEY") ? 503 : 422;
        return res.status(status).json({ message: err.message, code: err.code });
      }
      console.error("POST /api/import/menu-parse:", err);
      res.status(500).json({ message: "Menu parsing failed. Please try again or add items manually." });
    }
  });

  // Zod schemas for the import confirm payload
  const ConfirmCategorySchema = z.object({ name: z.string().min(1) });
  const ConfirmItemSchema = z.object({
    name: z.string().min(1),
    description: z.string().default(""),
    price: z.number().default(0),
    categoryName: z.string(),
    confidence: z.enum(["high", "medium", "low"]).optional(),
    warnings: z.array(z.string()).optional(),
  });
  const ConfirmPayloadSchema = z.object({
    categories: z.array(ConfirmCategorySchema),
    items: z.array(ConfirmItemSchema).min(1, "At least one item is required."),
  });

  /**
   * POST /api/import/confirm
   * Accepts reviewed { categories, items } and bulk-inserts into the DB in a
   * single transaction: categories first (building name→id map), then items.
   * Auth required. Returns { categoriesCreated, itemsCreated }.
   */
  app.post("/api/import/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) {
        return res.status(404).json({
          message: "No restaurant found. Complete onboarding first.",
          fallback: true,
        });
      }

      const parsed = ConfirmPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.errors[0]?.message ?? "Invalid import payload.",
          fallback: true,
        });
      }
      const { categories: importedCategories, items: importedItems } = parsed.data;

      // Wrap all inserts in a single transaction so a partial failure rolls back fully.
      const result = await db.transaction(async (tx) => {
        // Determine starting order offset to avoid colliding with existing categories.
        const existingCats = await tx
          .select({ order: categories.order })
          .from(categories)
          .where(eq(categories.restaurantId, restaurant.id));
        const startOrder =
          existingCats.length > 0
            ? Math.max(...existingCats.map((c) => c.order)) + 1
            : 0;

        // Insert categories; build name → id map for item FK resolution.
        const catNameToId: Record<string, string> = {};
        for (let i = 0; i < importedCategories.length; i++) {
          const catName = importedCategories[i].name.trim();
          if (!catName) continue;
          const [created] = await tx
            .insert(categories)
            .values({ restaurantId: restaurant.id, name: catName, order: startOrder + i })
            .returning({ id: categories.id });
          catNameToId[catName] = created.id;
        }

        // Integrity guard: if any item's categoryName is not in the map, create a
        // guaranteed "Uncategorized" fallback category rather than silently dropping
        // those items. The fallback is only inserted when actually needed, and only
        // once — if "Uncategorized" was already sent in importedCategories it is
        // already in catNameToId and no extra insert happens.
        const needsFallback = importedItems.some(
          (item) => !catNameToId[item.categoryName.trim()]
        );
        if (needsFallback && !catNameToId["Uncategorized"]) {
          const nextOrder = startOrder + importedCategories.length;
          const [fallback] = await tx
            .insert(categories)
            .values({ restaurantId: restaurant.id, name: "Uncategorized", order: nextOrder })
            .returning({ id: categories.id });
          catNameToId["Uncategorized"] = fallback.id;
        }

        // Insert items — values are inlined so drizzle infers the type from
        // the table schema without an explicit InsertMenuItem cast.
        // Any item whose categoryName still does not resolve falls back to
        // "Uncategorized" (guaranteed to exist above if needsFallback).
        let itemsCreated = 0;
        for (const item of importedItems) {
          const catId = catNameToId[item.categoryName.trim()] ?? catNameToId["Uncategorized"];
          if (!catId) continue; // unreachable — kept as a safety net
          await tx.insert(menuItemsTable).values({
            restaurantId: restaurant.id,
            categoryId: catId,
            name: item.name.trim(),
            description: item.description,
            price: String(item.price),
            isAvailable: true,
            isPopular: false,
            allergens: [] as string[],
            needsReview: true,
          });
          itemsCreated++;
        }

        return { categoriesCreated: Object.keys(catNameToId).length, itemsCreated };
      });

      res.json(result);
    } catch (err) {
      console.error("POST /api/import/confirm:", err);
      res.status(500).json({
        message: "Failed to save the imported menu. Please try again.",
        fallback: true,
      });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ITEM TRANSLATIONS
  // ════════════════════════════════════════════════════════════════════════════

  app.put("/api/items/:id/translations/:lang", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });

      const [item] = await db.select({ id: menuItemsTable.id }).from(menuItemsTable).where(
        and(eq(menuItemsTable.id, req.params.id), eq(menuItemsTable.restaurantId, restaurant.id))
      ).limit(1);
      if (!item) return res.status(404).json({ message: "Item not found." });

      const bodySchema = insertItemTranslationSchema.pick({ name: true, description: true });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data.", errors: parsed.error.flatten() });

      const [upserted] = await db.insert(itemTranslations)
        .values({ itemId: item.id, langCode: req.params.lang, name: parsed.data.name, description: parsed.data.description })
        .onConflictDoUpdate({
          target: [itemTranslations.itemId, itemTranslations.langCode],
          set: { name: parsed.data.name, description: parsed.data.description },
        })
        .returning();

      res.json({ itemId: upserted.itemId, langCode: upserted.langCode, name: upserted.name, description: upserted.description });
    } catch (err) {
      console.error("PUT /api/items/:id/translations/:lang:", err);
      res.status(500).json({ message: "Failed to upsert translation." });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // AI STUDIO ACTIONS
  // ════════════════════════════════════════════════════════════════════════════

  const SUPPORTED_LANG_CODES = new Set(["en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko", "ar"]);

  const AiItemSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().default(""),
  });

  /**
   * POST /api/ai/rewrite
   * Rewrites item descriptions using Gemini.
   * Body: { items: [{ id, name, description }] }
   * Returns: [{ id, description }]
   */
  app.post("/api/ai/rewrite", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = z.object({ items: z.array(AiItemSchema).min(1) }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "items is required." });
      }
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });
      const baseLang = restaurant.baseLanguage ?? "en";
      const results = await rewriteDescriptions(parsed.data.items as AiItem[], baseLang);

      // Apply DB writes server-side — set description + needsReview = true on changed items
      const changed: string[] = [];
      await Promise.all(
        results.map(async (r) => {
          const original = parsed.data.items.find((i) => i.id === r.id);
          if (!original || r.description === original.description) return;
          await db.update(menuItemsTable)
            .set({ description: r.description, needsReview: true, updatedAt: new Date() })
            .where(and(eq(menuItemsTable.id, r.id), eq(menuItemsTable.restaurantId, restaurant.id)));
          changed.push(r.id);
        })
      );

      res.json({ changed: changed.length, itemIds: changed });
    } catch (err) {
      if (err instanceof GeminiError) {
        const status = (err.code === "NO_KEY" || err.code === "INVALID_KEY") ? 503 : 422;
        return res.status(status).json({ message: err.message, code: err.code });
      }
      console.error("POST /api/ai/rewrite:", err);
      res.status(500).json({ message: "Description rewrite failed. Please try again." });
    }
  });

  /**
   * POST /api/ai/translate
   * Translates item names and descriptions using Gemini.
   * Body: { items: [{ id, name, description }], targetLang: string }
   * Returns: [{ id, name, description }]
   */
  app.post("/api/ai/translate", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = z.object({
        items: z.array(AiItemSchema).min(1),
        targetLang: z.string().refine((l) => SUPPORTED_LANG_CODES.has(l), {
          message: "Unsupported language code.",
        }),
        categories: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
      }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "items and targetLang are required." });
      }
      const { items, targetLang, categories: catInputs } = parsed.data;

      const userId2: string = req.user.claims.sub;
      const restaurant2 = await getUserRestaurant(userId2);
      if (!restaurant2) return res.status(404).json({ message: "No restaurant found." });
      const sourceLang = restaurant2.baseLanguage ?? "en";

      // ── Ownership check: resolve which submitted item IDs actually belong
      //    to this restaurant before any writes. Unknown IDs are silently
      //    skipped so we never touch another restaurant's data.
      const submittedItemIds = items.map((i) => i.id);
      const ownedRows = await db
        .select({ id: menuItemsTable.id })
        .from(menuItemsTable)
        .where(
          and(
            inArray(menuItemsTable.id, submittedItemIds),
            eq(menuItemsTable.restaurantId, restaurant2.id)
          )
        );
      const ownedItemIds = new Set(ownedRows.map((r) => r.id));
      const authorizedItems = items.filter((i) => ownedItemIds.has(i.id));

      // Translate items — apply DB writes server-side
      const results = await translateItems(authorizedItems as AiItem[], targetLang, sourceLang);

      const changedItemIds: string[] = [];
      await Promise.all(
        results.filter((r) => r.name?.trim()).map(async (r) => {
          await db.insert(itemTranslations)
            .values({ itemId: r.id, langCode: targetLang, name: r.name, description: r.description ?? "" })
            .onConflictDoUpdate({
              target: [itemTranslations.itemId, itemTranslations.langCode],
              set: { name: r.name, description: r.description ?? "" },
            });
          // Mark base row as needsReview = true (ownership already confirmed above)
          await db.update(menuItemsTable)
            .set({ needsReview: true, updatedAt: new Date() })
            .where(eq(menuItemsTable.id, r.id));
          changedItemIds.push(r.id);
        })
      );

      // Translate category names and upsert — ownership-scoped side effect
      if (catInputs && catInputs.length > 0) {
        // Verify categories belong to this restaurant before writing
        const submittedCatIds = catInputs.map((c) => c.id);
        const ownedCatRows = await db
          .select({ id: categories.id })
          .from(categories)
          .where(
            and(
              inArray(categories.id, submittedCatIds),
              eq(categories.restaurantId, restaurant2.id)
            )
          );
        const ownedCatIds = new Set(ownedCatRows.map((r) => r.id));
        const authorizedCats = catInputs.filter((c) => ownedCatIds.has(c.id));

        if (authorizedCats.length > 0) {
          const catItems = authorizedCats.map((c) => ({ id: c.id, name: c.name, description: "" }));
          const catResults = await translateItems(catItems, targetLang, sourceLang);
          if (catResults.length > 0) {
            await Promise.all(
              catResults.map((r) =>
                db.insert(categoryTranslations)
                  .values({ categoryId: r.id, langCode: targetLang, name: r.name })
                  .onConflictDoUpdate({
                    target: [categoryTranslations.categoryId, categoryTranslations.langCode],
                    set: { name: r.name },
                  })
              )
            );
          }
        }
      }

      res.json({ changed: changedItemIds.length, itemIds: changedItemIds });
    } catch (err) {
      if (err instanceof GeminiError) {
        const status = (err.code === "NO_KEY" || err.code === "INVALID_KEY") ? 503 : 422;
        return res.status(status).json({ message: err.message, code: err.code });
      }
      console.error("POST /api/ai/translate:", err);
      res.status(500).json({ message: "Translation failed. Please try again." });
    }
  });

  /**
   * POST /api/ai/calories
   * Estimates calorie counts for items using Gemini.
   * Body: { items: [{ id, name, description }] }
   * Returns: [{ id, calories: number | null }]
   */
  app.post("/api/ai/calories", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = z.object({ items: z.array(AiItemSchema).min(1) }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "items is required." });
      }
      const results = await estimateCalories(parsed.data.items as AiItem[]);
      res.json(results);
    } catch (err) {
      if (err instanceof GeminiError) {
        const status = (err.code === "NO_KEY" || err.code === "INVALID_KEY") ? 503 : 422;
        return res.status(status).json({ message: err.message, code: err.code });
      }
      console.error("POST /api/ai/calories:", err);
      res.status(500).json({ message: "Calorie estimation failed. Please try again." });
    }
  });

  // ── Standalone bulk-clear routes (no session side-effect) ──────────────────

  /**
   * POST /api/items/clear-sold-out
   * Sets soldOut = false on all currently sold-out items for this restaurant.
   * Does NOT create or affect service sessions.
   */
  app.post("/api/items/clear-sold-out", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });

      const affected = await db.update(menuItemsTable)
        .set({ soldOut: false, updatedAt: new Date() })
        .where(and(eq(menuItemsTable.restaurantId, restaurant.id), eq(menuItemsTable.soldOut, true)))
        .returning({ id: menuItemsTable.id });

      res.json({ cleared: affected.length });
    } catch (err) {
      console.error("POST /api/items/clear-sold-out:", err);
      res.status(500).json({ message: "Failed to clear sold-out items." });
    }
  });

  /**
   * POST /api/items/clear-specials
   * Sets isSpecial = false on all currently special items for this restaurant.
   * Does NOT create or affect service sessions.
   */
  app.post("/api/items/clear-specials", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });

      const affected = await db.update(menuItemsTable)
        .set({ isSpecial: false, updatedAt: new Date() })
        .where(and(eq(menuItemsTable.restaurantId, restaurant.id), eq(menuItemsTable.isSpecial, true)))
        .returning({ id: menuItemsTable.id });

      res.json({ cleared: affected.length });
    } catch (err) {
      console.error("POST /api/items/clear-specials:", err);
      res.status(500).json({ message: "Failed to clear special items." });
    }
  });

  // ── Review-clearing routes ─────────────────────────────────────────────────
  // IMPORTANT: bulk route must be registered before the :id route so Express
  // doesn't match "reviewed" as an item ID.

  /**
   * POST /api/items/reviewed
   * Clears needsReview on all items for the authenticated restaurant (bulk).
   */
  app.post("/api/items/reviewed", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });

      await db.update(menuItemsTable)
        .set({ needsReview: false, updatedAt: new Date() })
        .where(eq(menuItemsTable.restaurantId, restaurant.id));

      res.json({ ok: true });
    } catch (err) {
      console.error("POST /api/items/reviewed:", err);
      res.status(500).json({ message: "Failed to mark all items as reviewed." });
    }
  });

  /**
   * POST /api/items/:id/reviewed
   * Clears needsReview on a single item (ownership-scoped).
   */
  app.post("/api/items/:id/reviewed", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });

      const [item] = await db.select({ id: menuItemsTable.id }).from(menuItemsTable).where(
        and(eq(menuItemsTable.id, req.params.id), eq(menuItemsTable.restaurantId, restaurant.id))
      ).limit(1);
      if (!item) return res.status(404).json({ message: "Item not found." });

      await db.update(menuItemsTable)
        .set({ needsReview: false, updatedAt: new Date() })
        .where(eq(menuItemsTable.id, item.id));

      res.json({ ok: true });
    } catch (err) {
      console.error("POST /api/items/:id/reviewed:", err);
      res.status(500).json({ message: "Failed to mark item as reviewed." });
    }
  });

  // ── Service session routes ─────────────────────────────────────────────────

  /**
   * GET /api/service/current
   * Returns the open service session for the restaurant, or null.
   */
  app.get("/api/service/current", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });

      const [session] = await db.select().from(serviceSessions).where(
        and(eq(serviceSessions.restaurantId, restaurant.id), isNull(serviceSessions.endedAt))
      ).limit(1);

      res.json(session ?? null);
    } catch (err) {
      console.error("GET /api/service/current:", err);
      res.status(500).json({ message: "Failed to load service session." });
    }
  });

  /**
   * POST /api/service/start
   * Opens a new service session.
   * Body: { soldOutItemIds?: string[], specialItemIds?: string[] }
   * Clears only the explicitly provided item IDs (ownership-verified).
   */
  app.post("/api/service/start", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });

      // Guard: only one open session allowed per restaurant
      const [existing] = await db
        .select({ id: serviceSessions.id })
        .from(serviceSessions)
        .where(and(eq(serviceSessions.restaurantId, restaurant.id), isNull(serviceSessions.endedAt)))
        .limit(1);
      if (existing) {
        return res.status(409).json({ message: "A service session is already open.", sessionId: existing.id });
      }

      const parsed = z.object({
        soldOutItemIds: z.array(z.string()).optional().default([]),
        specialItemIds: z.array(z.string()).optional().default([]),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid request." });
      const { soldOutItemIds, specialItemIds } = parsed.data;

      const snapshot: Record<string, unknown> = {};

      // Clear soldOut only on the specified items (ownership-verified via restaurantId join)
      if (soldOutItemIds.length > 0) {
        const affected = await db.update(menuItemsTable)
          .set({ soldOut: false, updatedAt: new Date() })
          .where(and(
            inArray(menuItemsTable.id, soldOutItemIds),
            eq(menuItemsTable.restaurantId, restaurant.id)
          ))
          .returning({ id: menuItemsTable.id });
        snapshot.clearedSoldOut = affected.map((r) => r.id);
      }

      // Clear isSpecial only on the specified items (ownership-verified)
      if (specialItemIds.length > 0) {
        const affected = await db.update(menuItemsTable)
          .set({ isSpecial: false, updatedAt: new Date() })
          .where(and(
            inArray(menuItemsTable.id, specialItemIds),
            eq(menuItemsTable.restaurantId, restaurant.id)
          ))
          .returning({ id: menuItemsTable.id });
        snapshot.clearedSpecials = affected.map((r) => r.id);
      }

      const [session] = await db.insert(serviceSessions).values({
        restaurantId: restaurant.id,
        clearedItemsSnapshot: JSON.stringify(snapshot),
      }).returning();

      res.json(session);
    } catch (err) {
      console.error("POST /api/service/start:", err);
      res.status(500).json({ message: "Failed to start service session." });
    }
  });

  /**
   * GET /api/copilot/context
   * Read-only menu health snapshot for the Copilot panel.
   * Pure DB aggregation — no AI calls, no writes.
   */
  app.get("/api/copilot/context", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;

      const [restaurant] = await db
        .select({
          id: restaurants.id,
          credits: restaurants.credits,
          plan: restaurants.plan,
          supportedLanguages: restaurants.supportedLanguages,
          baseLanguage: restaurants.baseLanguage,
        })
        .from(restaurants)
        .where(eq(restaurants.userId, userId))
        .limit(1);

      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });

      // Fetch item flags (no translations yet)
      const items = await db
        .select({
          id: menuItemsTable.id,
          description: menuItemsTable.description,
          price: menuItemsTable.price,
          needsReview: menuItemsTable.needsReview,
          soldOut: menuItemsTable.soldOut,
          isSpecial: menuItemsTable.isSpecial,
        })
        .from(menuItemsTable)
        .where(eq(menuItemsTable.restaurantId, restaurant.id));

      const totalItems = items.length;
      const missingDescriptions = items.filter(
        (i) => !i.description || i.description.trim().length < 10
      ).length;
      const missingPrices = items.filter(
        (i) => parseFloat(String(i.price)) === 0
      ).length;
      const needsReviewCount = items.filter((i) => i.needsReview).length;
      const soldOutCount = items.filter((i) => i.soldOut).length;
      const specialsCount = items.filter((i) => i.isSpecial).length;

      // Translation coverage per supported language (excluding base language)
      const supportedLangs = (restaurant.supportedLanguages ?? ["en"]).filter(
        (l) => l !== restaurant.baseLanguage
      );
      let translationCoverage: Array<{ langCode: string; translated: number; total: number; pct: number }> = [];

      if (totalItems > 0 && supportedLangs.length > 0) {
        const itemIds = items.map((i) => i.id);
        const translations = await db
          .select({ itemId: itemTranslations.itemId, langCode: itemTranslations.langCode })
          .from(itemTranslations)
          .where(inArray(itemTranslations.itemId, itemIds));

        translationCoverage = supportedLangs.map((langCode) => {
          const translated = translations.filter((t) => t.langCode === langCode).length;
          return {
            langCode,
            translated,
            total: totalItems,
            pct: Math.round((translated / totalItems) * 100),
          };
        });
      } else {
        translationCoverage = supportedLangs.map((langCode) => ({
          langCode, translated: 0, total: 0, pct: 0,
        }));
      }

      // Open service session?
      const [session] = await db
        .select({ id: serviceSessions.id })
        .from(serviceSessions)
        .where(and(eq(serviceSessions.restaurantId, restaurant.id), isNull(serviceSessions.endedAt)))
        .limit(1);

      res.json({
        totalItems,
        missingDescriptions,
        missingPrices,
        needsReview: needsReviewCount,
        soldOut: soldOutCount,
        specials: specialsCount,
        translationCoverage,
        serviceOpen: !!session,
        credits: restaurant.credits,
        plan: restaurant.plan,
      });
    } catch (err) {
      console.error("GET /api/copilot/context:", err);
      res.status(500).json({ message: "Failed to load copilot context." });
    }
  });

  /**
   * POST /api/service/end
   * Closes the open service session.
   * Body: { soldOutItemIds?: string[], specialItemIds?: string[] }
   * Clears only the explicitly provided item IDs (ownership-verified).
   */
  app.post("/api/service/end", isAuthenticated, async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;
      const restaurant = await getUserRestaurant(userId);
      if (!restaurant) return res.status(404).json({ message: "No restaurant found." });

      const [session] = await db.select({ id: serviceSessions.id }).from(serviceSessions).where(
        and(eq(serviceSessions.restaurantId, restaurant.id), isNull(serviceSessions.endedAt))
      ).limit(1);

      if (!session) return res.status(404).json({ message: "No open session found." });

      const parsed = z.object({
        soldOutItemIds: z.array(z.string()).optional().default([]),
        specialItemIds: z.array(z.string()).optional().default([]),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid request." });
      const { soldOutItemIds, specialItemIds } = parsed.data;

      if (soldOutItemIds.length > 0) {
        await db.update(menuItemsTable)
          .set({ soldOut: false, updatedAt: new Date() })
          .where(and(
            inArray(menuItemsTable.id, soldOutItemIds),
            eq(menuItemsTable.restaurantId, restaurant.id)
          ));
      }

      if (specialItemIds.length > 0) {
        await db.update(menuItemsTable)
          .set({ isSpecial: false, updatedAt: new Date() })
          .where(and(
            inArray(menuItemsTable.id, specialItemIds),
            eq(menuItemsTable.restaurantId, restaurant.id)
          ));
      }

      const [ended] = await db.update(serviceSessions)
        .set({ endedAt: new Date() })
        .where(eq(serviceSessions.id, session.id))
        .returning();

      res.json(ended);
    } catch (err) {
      console.error("POST /api/service/end:", err);
      res.status(500).json({ message: "Failed to end service session." });
    }
  });

  // ONE-SHOT ADMIN ENDPOINT: delete specific restaurants by ID.
  // Protected by ADMIN_CLEANUP_TOKEN env var. Runs in a single transaction.
  app.post("/api/admin/delete-restaurants", async (req, res) => {
    const token = process.env.ADMIN_CLEANUP_TOKEN;
    const authHeader = req.headers["authorization"] ?? "";
    if (!token || authHeader !== `Bearer ${token}`) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids array required" });
    }
    try {
      const counts = await db.transaction(async (tx) => {
        const r1 = await tx.delete(itemTranslations)
          .where(inArray(itemTranslations.itemId,
            tx.select({ id: menuItemsTable.id })
              .from(menuItemsTable)
              .where(inArray(menuItemsTable.restaurantId, ids)) as any
          ));
        const r2 = await tx.delete(categoryTranslations)
          .where(inArray(categoryTranslations.categoryId,
            tx.select({ id: categories.id })
              .from(categories)
              .where(inArray(categories.restaurantId, ids)) as any
          ));
        const r3 = await tx.delete(menuItemsTable).where(inArray(menuItemsTable.restaurantId, ids));
        const r4 = await tx.delete(categories).where(inArray(categories.restaurantId, ids));
        const r5 = await tx.delete(serviceSessions).where(inArray(serviceSessions.restaurantId, ids));
        const r6 = await tx.delete(restaurants).where(inArray(restaurants.id, ids));
        return { item_translations: r1.rowCount, category_translations: r2.rowCount, menu_items: r3.rowCount, categories: r4.rowCount, service_sessions: r5.rowCount, restaurants: r6.rowCount };
      });
      console.log("[AdminCleanup] Deleted:", counts);
      res.json({ success: true, counts });
    } catch (err) {
      console.error("[AdminCleanup] Error:", err);
      res.status(500).json({ message: "Deletion failed", error: String(err) });
    }
  });
}
