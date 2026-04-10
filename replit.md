# Dain Menu — Operating Instructions

> ⚠️ **SPRINT AKTIV — April 2026 · Pricing v4 · Alle Business-Entscheidungen final**
> Technische Architektur (Sections 7+) ist aktuell und korrekt.
> Business/Billing-Sections (1-6) wurden auf Pricing v4 aktualisiert.

This file is the authoritative operating guide for Replit Agent on this project.
Read it before making changes. Follow it during implementation. Update it after significant architectural changes.

> **Primäres Coding-Tool ist Claude Code CLI (nicht Replit Agent).**
> Diese Datei bleibt als Referenz für Replit Deploy und technische Architektur.

---

## 1. Product Identity

**Dain Menu** is a premium AI-powered B2B SaaS for restaurant operators worldwide.
Domain: dainmenu.com · Repo: github.com/23Almir23/DAIN-MENU

Core surfaces:
- **Multilingual guest-facing digital menus** — delivered via QR code, rendered in the guest's language
- **AI-assisted menu creation** — descriptions, translations, allergens, calorie estimates
- **Scan Dish** — photograph a dish; AI parses it into a structured menu entry
- **Menu import** — paste or upload existing menus; AI extracts and enhances
- **Operator workflows** — fast, intentional, high-value; not a spreadsheet or CMS
- **Copilot Kai** — contextual assistant that observes menu health and routes operators to the right action
- **Photo Enhancement** — AI enhances dish photos (ab Launch als Pro-Feature, Cloudinary + Imagen)
- **Design Templates** — Premium-Vorlagen (Sprint Phase 1)
- **Print Export PDF** — druckfertige Speisekarte (Sprint Phase 1)

This is not a generic CMS. Not an AI playground. Not an internal admin tool.
Every change strengthens: guest-facing quality, operator speed, multilingual usefulness, operational trust, premium feel.

---

## 2. Operating Priority

### Baseline (all normal work)

1. UX clarity and premium feel
2. Operator workflow quality
3. Guest experience quality
4. Operational integrity
5. Platform / system-level features

---

## 3. What "Premium" Means Operationally

Premium is a set of concrete behaviors, not a feeling:

- Visually clean and intentional: no visual noise, no misaligned elements, no jarring transitions
- Coherent multilingual behavior: language switching works, displayed text matches the selected language
- Believable restaurant data: real dish names, real price ranges, real allergens, real descriptions
- Fast and obvious user payoff: the user understands what just happened and what to do next
- No placeholder feel: no lorem ipsum, no "Coming Soon" in critical paths
- No deceptive states: do not fake uploads, fake processing, or claim capabilities that do not exist
- No awkward dead ends: every screen has a next action

---

## 4. Sprint Reality — April 2026

> **Pricing v4 ist final entschieden. Der Sprint baut es jetzt.**

**Was im Sprint gebaut wird (Tag 1-10):**
- Stripe + Annual-First Billing
- Plan Gates für v4 Tiers (Essential / Pro / Business)
- Credit-System → Unlimited AI Migration
- Design Templates (alle in Essential+)
- Print Export PDF (Essential+)
- Photo Enhancement PoC (Pro+)
- Onboarding 3-Step < 5 Min
- Copilot Kai Charakter

**Was NICHT mehr gilt (veraltet):**
- ~~"Do not build billing infrastructure until confirmed"~~ → **Sprint baut Stripe jetzt**
- ~~"Credit-transaction table not yet"~~ → **wird im Sprint migriert**
- ~~Free / Starter / Pro~~ → **Free / Essential / Pro / Business**

---

## 5. Autonomy — Claude Code 24/7

Claude Code hat vollständiges Vertrauen und läuft autonom.
Tests sind der einzige Quality Gate. Commit = Tests grün. Rollback = Tests rot.
Lalo entscheidet keine offenen Punkte mehr — alle Entscheidungen sind final.

---

## 6. Billing und Plan Reality — v4 FINAL

> **Pricing Modell v4 ist entschieden. Nicht mehr ändern ohne explizite Anweisung.**

### Aktuelle Plan-Struktur im Code (noch alt — Sprint migriert das):
- `restaurants.plan` — text field; values: `"free"`, `"starter"`, `"pro"`
- `restaurants.credits` — integer (wird im Sprint deprecated)
- `restaurants.credit_history` — JSON text (wird im Sprint deprecated)

### Ziel-Plan-Struktur nach Sprint-Migration:
- `restaurants.plan` — values: `"free"`, `"essential"`, `"pro"`, `"business"`
- Kein `credits` mehr — Unlimited AI, €2.50 flat COGS/Kd
- Stripe subscriptions Tabelle live

### Neues Pricing Modell v4:
| Tier | Annual/Mo | Monatlich | Sprachen | Photo Enh. | Templates | Print PDF |
|------|-----------|-----------|----------|------------|-----------|-----------|
| Free | — | — | 1 / 20 Items | ❌ | 1 Basic | ❌ |
| Essential | €29 | €44 | 3 / ∞ | ❌ | ✅ Alle | ✅ |
| Pro | €55 | €83 | 10 / ∞ | ✅ 100/Mo | ✅ Alle | ✅ |
| Business | €89 | €134 | 10 / ∞ | ✅ 300/Mo | ✅ Alle | ✅ |

**Annual-First:** Annual ist der Standard (−38% vs. Monatlich). Cash-Flow-Priorität.
**Copilot Kai:** ab Essential. Free hat keinen Copilot.
**POS Add-on:** €25/Mo · Phase 3 · Pro/Business only.

### Stripe Konfiguration:
- Fees: ~3.9% + €0.30 (EU-International inkl. Stripe Tax)
- Prorata bei Mid-Month Upgrades (Stripe Default)
- Webhooks: payment_intent.succeeded, customer.subscription.updated,
  customer.subscription.deleted, invoice.payment_failed

### Migration-Reihenfolge im Sprint:
1. Stripe Setup + neue Tiers anlegen
2. Plan Gates auf v4 Basis (nicht Credits)
3. Credit-Deduktion aus allen AI-Routen entfernen
4. `restaurants.credits` deprecaten nach Migration
5. Schema-Migration: neue Plan-Werte

---

## 7. Multilingual Rules

Multilingual is one of the strongest product differentiators. Treat it accordingly.

- Do not hardcode English as the base language anywhere
- Language resolution must respect `restaurants.base_language`
- Guest language switching must visibly work — switching languages must render the correct translated content immediately
- If a language tab or selector is shown in UI, the content behind it must be credible
- Copy, language counts, and language tabs must match actual data, not marketing claims
- `item_translations` and `category_translations` are the source of truth for translated content
- AI translation routes must use `restaurants.base_language` as the source language, never default to English

---

## 8. Scan Dish

Scan Dish is a flagship differentiator. Treat it as such.

The feature: a camera/file input button in the Menu Builder "Add Item" dialog sends an image to `POST /api/items/parse-photo`, which calls Gemini to extract dish name, description, and allergens. The result auto-fills the item form.

- It must feel fast, mobile-native, and obviously useful
- It must be lower-friction than manual entry
- Do not remove the camera input or the `parse-photo` route without explicit instruction
- Do not regress it during unrelated refactors

---

## 9. Copilot

Copilot is a contextual assistant layer — not a chatbot and not a feature executor.

Its role: observe menu health, surface signals, and route operators to the correct existing tool.
Its architecture: `GET /api/copilot/context` is a pure DB aggregation endpoint — zero AI cost. All health signals are computed server-side from DB counts.

- Copilot must not duplicate execution logic that exists elsewhere in the product
- Copilot actions should navigate (deep-link) into existing tools, not re-implement them
- The command bar intent router (`src/lib/copilot-intents.ts`) is deterministic keyword matching — keep it that way unless AI intent routing is explicitly requested
- Do not turn Copilot into a generic chatbot

---

## 10. Architecture Guardrails

### Ownership and Auth

**All routes require authentication and owner scoping unless explicitly in the public exception list.**

Public exceptions (no auth, no owner scoping):
- `GET /api/health`
- `GET /api/guest` (scoped by `?r=` query param, no auth)
- `GET /api/login`
- `GET /api/callback`
- `GET /api/logout`
- Frontend routes: `/`, `/pricing`, `/guest`

Every other route — including all `/api/ai/*`, `/api/import/*`, `/api/service/*`, `/api/restaurant`, `/api/menu`, `/api/categories`, `/api/items`, `/api/billing`, `/api/copilot` — requires `isAuthenticated` middleware and must filter by `req.user.claims.sub` (the user's restaurant only). Never accept `userId` from the request body.

**Canonical file for auth redirect logic:** `src/components/ProtectedRoute.tsx` — handles the unauthenticated → `/api/login` redirect and the no-restaurant → `/setup` redirect. Edit this file for changes to redirect behavior; do not re-implement the logic elsewhere.

### What Not to Change Without Explicit Instruction

- **Auth ownership model:** `restaurants.user_id` scopes all data. One user → one restaurant.
- **Guest URL structure:** `/guest?r={restaurantId}` — do not restructure without auditing all QR-generated URLs.
- **AI credit semantics:** Credits are deducted server-side by AI routes. Do not implement client-side credit deduction.
- **`needsReview` gate:** AI-generated allergens and descriptions always set `needsReview = true`. Operators clear this per-item or in bulk. Do not skip this gate.

Do not casually introduce: team access, invite links, shared workspaces, role systems, or multi-restaurant support. These are explicit future features, not current architecture.

### Migration Safety — First-Class Rule

**Always:** `npx drizzle-kit generate` then `npx drizzle-kit push`

**Never:**
- `npm run db:push` (not a valid command in this project)
- Manually written SQL migration files
- Changing primary key column types — this generates destructive `ALTER TABLE` statements that break existing data

Migration files live in `migrations/` and are auto-generated. Do not edit them by hand.

---

## 11. External Tester Rules

For external testers, prefer independent testing over collaboration features:

- Do not introduce invite-link or team-access systems for testing purposes
- All "Get Started" / "Start free" CTAs on marketing pages route to `/api/login`, not `/setup` directly
- After OAuth, new users: `/dashboard` → `ProtectedRoute` detects no restaurant → `/setup`
- New restaurants are created with `plan = "starter"` and `credits = 200` — enough to test the full product end-to-end without hitting Free-plan friction

---

## 12. UX Standards

- Premium, not utilitarian
- Mobile matters heavily — guest preview and Scan Dish are mobile-primary experiences
- Empty states must be useful: show what to do next, not just "nothing here yet"
- Fewer, stronger interactions: do not add dropdowns, modals, or options that are not earned by real use cases
- Avoid anything that feels test-like, spreadsheet-like, generic SaaS, or placeholder-driven
- Every screen has a next action

---

## Product and Frontend System Rules

For all product, UI, UX, frontend architecture, and performance decisions, follow these custom skills:
- `product-ui-ux-guided-operator-workflows`
- `vercel-react-frontend-performance-architecture`

MenuAI must behave like a guided AI menu operating system for restaurant operators:
- one clear next step
- trust before cleverness
- awareness with action
- visible before/after value
- no decorative drift
- no fake commercial framing

Frontend decisions must prioritize:
- correctness
- rendering stability
- predictable state flow
- maintainable architecture
- operator-facing responsiveness
- production readiness

---

## 13. Scope Discipline

Before implementing, classify the work:
- **UX repair** — fixing broken or confusing behavior
- **Bounded feature work** — a self-contained feature addition
- **Architectural change** — schema, auth, ownership, routing
- **Platform work** — billing infrastructure, object storage, multi-tenancy

Keep scope to the classification. Do not sneak in unrelated refactors.

**Standard work pattern:**
1. Inspect current implementation — read the relevant files before writing
2. Identify the real bottleneck — not the assumed one
3. Propose smallest high-leverage fix
4. Implement tightly within the identified scope
5. Run TypeScript checks
6. Summarize exactly what changed

---

## 14. Cost / Credit Discipline

- Prefer small, high-leverage changes over broad implementation passes
- Inspect first, then change — never write code speculatively without reading the current state
- Avoid unnecessary refactors, abstraction layers, or file splits unless quality would materially suffer
- Do not run broad implementation passes when a plan-mode audit or a single-file fix is sufficient
- Preserve working code and data whenever possible instead of rebuilding
- When multiple implementation paths exist, prefer the one that uses fewer Replit credits unless quality would materially suffer

---

## 15. Quality Gates After Changes

After any implementation, run:

```bash
npx tsc --noEmit                         # root config check
npx tsc --noEmit -p tsconfig.app.json    # frontend
npx tsc --noEmit -p tsconfig.server.json # backend
```

All three must pass. Do not leave TypeScript errors behind.

Manually validate after changes to:
- Auth flow (login → dashboard → setup → first use)
- Guest preview (language switching, unauthenticated access)
- Plan-related UI (credit display, plan badge, feature gating)
- Multilingual behavior (base language, translation coverage, Translate AI action)
- QR codes (scannable output, correct guest URL)

---

## 16. Output Format After Changes

When summarizing completed work, use this structure:

- **Mode used**
- **Exact files changed**
- **Exact behavior changed**
- **Anything intentionally preserved unchanged**
- **What still remains unresolved**
- **What should be manually verified next**

---

## 17. Architecture Reference

### Dev Server

Single process on port 5000. Express serves the API; Vite runs as middleware.

```
browser → Express :5000
               ├── /api/*       → route handlers (server/routes.ts)
               └── /*           → Vite middleware → React SPA (src/)
```

### Directory Structure

```
src/
  ├── pages/           Route-level components
  ├── components/      Shared UI + shadcn primitives
  ├── hooks/           TanStack Query wrappers and derived state
  ├── data/            Allergen data, guest theme config
  ├── lib/             Pure utils (menu helpers, copilot intents, query client)
  └── types/           Shared TS domain types (menu.ts)

server/
  ├── index.ts         Entry point — Express app, port 5000
  ├── db.ts            Drizzle + pg Pool → Replit PostgreSQL
  ├── schema.ts        Drizzle schema (restaurants, categories, category_translations,
  │                    menu_items, item_translations, service_sessions, users, sessions)
  ├── routes.ts        All API routes
  ├── gemini.ts        Gemini AI: rewrite, translate, allergens, calories, parseDishPhoto, import
  └── vite.ts          Vite middleware integration

migrations/            Auto-generated SQL files (drizzle-kit) — do not edit manually
```

### Database Tables

| Table | Purpose |
|-------|---------|
| `restaurants` | Restaurant profile, settings, plan, credits, base_language |
| `categories` | Menu categories, ordered per restaurant |
| `category_translations` | i18n names per (category, lang_code) |
| `menu_items` | Items: price, allergens, calories, availability, needsReview |
| `item_translations` | i18n name + description per (item, lang_code) |
| `service_sessions` | Service period tracking (start/end, cleared-items snapshot) |
| `users` | Replit OIDC user records |
| `sessions` | express-session PostgreSQL store |

### Key API Routes

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/health` | Public — DB connection check |
| POST | `/api/restaurant` | Creates with `plan="starter"`, `credits=200` |
| GET/PATCH | `/api/restaurant` | Owner-scoped |
| GET | `/api/menu` | Categories + items, single fetch |
| POST/PATCH/DELETE | `/api/categories/:id` | Full category CRUD |
| POST/PATCH/DELETE | `/api/items/:id` | Full item CRUD |
| POST | `/api/items/parse-photo` | Scan Dish — multipart image → Gemini → DishDraft |
| PUT | `/api/items/:id/translations/:lang` | Upsert translation |
| GET | `/api/billing` | credits + plan + creditHistory |
| POST | `/api/billing/use-credits` | Deduct credits + append history |
| POST | `/api/billing/set-plan` | Change plan |
| POST | `/api/ai/rewrite` | Enhance descriptions → writes to DB, sets needsReview |
| POST | `/api/ai/translate` | Translate items → writes item_translations, sets needsReview |
| POST | `/api/ai/allergens` | Detect allergens → writes to DB, sets needsReview |
| POST | `/api/ai/calories` | Estimate calories → writes to DB, sets needsReview |
| POST | `/api/import/parse` | Parse menu text/file → Gemini → draft items |
| POST | `/api/import/confirm` | Confirm import → creates items with needsReview=true |
| GET | `/api/copilot/context` | Menu health snapshot — pure DB aggregation, zero AI cost |
| GET | `/api/service/current` | Current open service session or null |
| POST | `/api/service/start` | Open service session |
| POST | `/api/service/end` | Close service session |
| GET | `/api/guest` | Public guest menu — no auth, scoped by `?r=` |
| GET | `/api/login` | Replit OIDC entry |
| GET | `/api/callback` | OIDC callback → session → redirect to `/dashboard` |
| GET | `/api/logout` | Session destroy + Replit end-session |

### Auth Flow

1. Unauthenticated user clicks any marketing CTA → `window.location.href = "/api/login"`
2. Replit OIDC → `GET /api/callback` → session created → redirect to `/dashboard`
3. `ProtectedRoute` (`src/components/ProtectedRoute.tsx`) detects no restaurant → redirect to `/setup`
4. `POST /api/restaurant` creates restaurant with `plan="starter"`, `credits=200`
5. Onboarding completes → `/dashboard`

### Restaurant Ownership

- `restaurants.user_id` (text) — links to Replit user ID (`req.user.claims.sub`)
- One user → one restaurant (current architecture)
- `userId` is never accepted from request body
- All queries filter by `userId` server-side

### Frontend Hooks

| Hook | Data source |
|------|------------|
| `use-restaurant.ts` | `GET /api/restaurant` |
| `use-menu.ts` | `GET /api/menu` — categories + items, shared cache |
| `use-billing.ts` | `GET /api/billing` — credits, plan, history |
| `use-menu-stats.ts` | Derived from `useMenu()` — no extra fetch |
| `use-selectors.ts` | Derived selectors (readiness, language coverage) |
| `use-service-session.ts` | `GET /api/service/current` |
| `use-copilot.ts` | `GET /api/copilot/context` |

### Wave 2 Phase 1 — Unified Workspace (W1 + W7 + W2A + W3)

**W1 — Workspace intent routing:** `MenuBuilder.tsx` now reads `?intent=rewrite|translate|allergens|calories` and `?lang={code}` URL params. When present, the AI Dock opens automatically and the correct action is pre-configured. Handled in the same `useEffect` that reads `?filter` and `?action`. New state: `enhanceIntent`, `enhanceLang`. Props passed to `WorkspaceEnhanceSection`: `intent`, `initialLang`.

**W7 — Signal/Dashboard handoff update:** `copilot-signals.ts` now routes missingDescriptions to `/menu?intent=rewrite` (was `__enhance__`) and translation signals to `/menu?intent=translate&lang={code}` (was `/ai-studio?task=translate&lang={code}`). Dashboard C5 AI-task CTAs route to `/menu?intent=...` (was `/ai-studio?task=...`). Dashboard buddy signal action simplified to `navigate(s.navigateTo)` — no more `__enhance__` special case. Bottom workspace "AI Enhance" quicklink now expands the dock inline. Item dialog "AI Studio" tip link now opens the dock inline.

**W2A — AI Dock promotion:** `WorkspaceEnhanceSection` gains `intent` + `initialLang` props. New `activeAction` state tracks which AI action is foregrounded. Intent arrival sets `activeAction`, pre-selects language for translate. Active chip gets primary border/shadow visual treatment. Translate panel shows full coverage bar (progress bar + `X/N items (Y%)`) when active or when language picker is open. Toggle header subtitle is intent-aware ("Rewrite descriptions ready to run" etc).

**W3 — Review mode elevation:** The subtle inline blue bar is replaced with a prominent review mode header (`data-testid="review-mode-header"`) that only appears when `filterNeedsReview === true`. Header shows item count, context text "Guest preview updates live on the right", "Exit review" ghost button, and prominent "Approve all" button. ItemCard receives `reviewMode` prop: in review mode, items with `needsReview=true` get a blue left-border accent (`border-l-4`) and an inline "Approve" button (`data-testid="button-approve-{id}"`). Auto-exit: `useEffect` clears `filterNeedsReview` when `stats.needsReviewItems` drops to 0.

### New Task — 4-Block Product Update (completed)

**Block A — Dashboard command center:** NBA card + menu readiness card replaced by a single dominant `dashboardCommandState` block. State derivation priority: `needs-review` (needsReviewItems > 0) → `missing-descriptions` (copilotCtx.missingDescriptions > 0) → `incomplete-translation` (partial translation pct 0–100) → `activation-incomplete` (!activation.allComplete) → `qr-ready`. Each state drives headline/body/CTA/card color. In-service banner updated to "Service is live" / "Focus on live operations · started HH:MM". `needsReviewItems` derived locally from `menuItems.filter(i => i.needsReview)` (not in MenuStats).

**Block B — AI Dock improve mode visual:** `isImproveMode = open && activeAction !== null`. Container gets `border-primary/40 shadow-sm` and header gets `bg-primary/[0.03]` when in improve mode. Subtitle text turns `text-primary/70`. Non-active chips get `opacity-50` via new `isSecondary` prop on `ActionChip`. Action-specific outcome subtitles replace generic "ready to run" copy. Toggle click handler extended to pre-activate allergens/calories when descriptions and translation are clean.

**Block C — Extended collapsed guidance:** `collapsedSubtitle` in `WorkspaceEnhanceSection` now covers allergens (`eligibleCounts.allergens > 0`) and calories (`eligibleCounts.calories > 0`) in addition to missingDescriptions and lowestTranslation.

**Block D — Review/Approve/Preview loop:** Review mode body copy updated. `reviewCompleteMsg` state (4s auto-clear) shows "All AI changes approved" banner after final approval. `MenuPreviewPanel` gains `filterNeedsReview` prop; shows "Showing current state" badge in panel header. Prop threaded from MenuBuilder.

### Task #33 — DE/EN Operator UI Localization (completed)

**i18n infrastructure:** `react-i18next` integrated in `src/i18n/index.ts`. German (DE) is the primary/default language; English (EN) is the secondary. Language selection persisted in `localStorage` via key `dainmenu_ui_lang`. `LanguageSwitcher.tsx` renders a DE/EN toggle in `AppSidebar`.

**Translation files:** `src/i18n/locales/de.json` and `src/i18n/locales/en.json` — both fully populated with all operator-facing strings. German quotation marks (`„"`) encoded as Unicode escapes (`\u201E...\u201C`) to maintain valid JSON.

**Components translated (complete list):** `MarketingHeader`, `MarketingFooter`, `AppSidebar`, `NotFound`, `ActivationChecklist`, `ReviewStage`, `WorkspaceEnhanceSection`, `CopilotPanel`, `Landing`, `Dashboard`, `CopilotStrip`, `Pricing`, `QRCodes`, `Billing`, `Settings`, `AIStudio`, `MenuBuilder` (including `ItemCard`, `CategoryDialog`, `QuickConfirmDialog` sub-components), `Onboarding` (including `NameStage`, `ChooseStage`, `ParsingOverlay`, `ImportStage`, `DoneStage` sub-components).

**NOT translated (by design):** `GuestPreview.tsx` (has its own multilingual system), dynamic API-driven text, shadcn UI primitives, server code, localStorage keys (`menuai_*`), QR filenames.

### Guest View Redesign + 4 Design Templates + Print Export (completed)

**Schema additions:** `restaurants.template text NOT NULL DEFAULT 'noir'` and `restaurants.coverImage text` added to `server/schema.ts`; migrated via `drizzle-kit push`.

**`src/lib/themes.ts`** — 4 template definitions (`noir`, `classic`, `warm`, `minimal`) with CSS variable maps (`--bg`, `--bg-card`, `--text-primary`, `--text-secondary`, `--accent`, `--border`, `--price-color`). `getTemplateVars(id?)` returns a `CSSProperties` spread; `TEMPLATE_LIST` for iteration. Templates drive the guest view at runtime via CSS custom properties.

**`src/pages/GuestPreview.tsx` redesign:**
- Cover photo header (200 px h) — shows `coverImage` or tinted fallback
- Language pill switcher overlaid top-right on the cover photo
- Info card overlapping photo by −20 px (−mt-5), shows name, cuisine, MapPin + Phone + Wifi contact rows
- Category tabs redesigned as rounded pills (full border, accent bg when active)
- Items split into two components: `GuestItemCard` (item has `.image` → 16:9 ratio card) and `GuestItemRow` (text-only with divider)
- All inline colours replaced with CSS variables from `templateVars`; `ThemedMenuItem` kept for backward compat but no longer used by new render path

**`src/components/PrintMenuView.tsx`** — new printable PDF-ready view. Pure inline-styled React, no Tailwind. Renders categories/items with allergens and sold-out decoration. Footer: "Powered by Dain Menu".

**Settings.tsx template picker:** A second 4-up grid added in the Design section, below the guest theme picker. Uses `TEMPLATE_LIST` from `themes.ts`; colour swatches mirror the actual CSS vars. Calls `u("template", id)` which persists via the restaurant PATCH endpoint.

**`src/types/menu.ts`:** `template?: string` added to `Restaurant` interface.

**Public API (`/api/public/restaurant/:id`):** Extended `.select()` to expose `template`, `description`, `address`, `phone`, `coverImage`, `guestContactInfo`, `city`. All consumed by `use-public-restaurant.ts` hook.

### Task #29 — Core Surface Redesign (completed)

**AI Studio redirect:** `/ai-studio` route now serves `AIStudioRedirect.tsx` (not `AIStudio.tsx`). The redirect reads `?task=` and maps to `?intent=` on `/menu`, preserving `?lang=` for translate. AIStudio.tsx is kept as a legacy file but is not the default render target.

**AppSidebar:** "AI Studio" removed from `mainItems`. Credits badge moved from AI Studio entry to Menu Builder entry (shown only when `needsReviewCount === 0`; amber review badge takes precedence when there are items to review).

**Menu Builder mode separation:** `CopilotStrip` is now suppressed in two new cases: (1) improve mode (`enhanceOpen && activeAction !== null`) — the dock is already guiding the operator; (2) review mode (`filterNeedsReview`) — the blue review header is the mode indicator. After a successful AI run, `MenuPreviewPanel` shows "Preview updated" for 8 seconds. `WorkspaceEnhanceSection` exposes `onImproveModeChange` callback.

**Dashboard work-queue restructure:** Empty operators see only the import hero. NBA card is now topmost for activating operators (above stats). Stats grid moved below NBA card. Activation checklist auto-hides when `activation.allComplete`. Quick Actions grid removed entirely. Entry paths section suppressed when no items.

### v1.5 Workspace Redesign (completed)

`MenuBuilder.tsx` now renders a split-panel workspace shell instead of a centered single-column layout:

- **Left column (`flex-1`)** — CopilotStrip (ambient signal) + editing area (header, stats, inline AI chips, search, DnD category list)
- **Right column (`w-[380px] sticky`, `hidden xl:flex`)** — `MenuPreviewPanel`: live guest menu view that updates as the operator edits; Share CTA (Copy guest link + Get QR code) pins to bottom
- **`CopilotStrip`** (`src/components/CopilotStrip.tsx`) — single highest-priority Copilot signal strip, 6-tier priority model, sessionStorage dismiss, `onExpandEnhance` callback
- **`WorkspaceEnhanceSection`** (`src/components/WorkspaceEnhanceSection.tsx`) — collapsible inline AI chip panel (rewrite/translate/allergens/calories) that runs AI actions directly without navigating to AI Studio
- **`MenuPreviewPanel`** (`src/components/MenuPreviewPanel.tsx`) — live mobile-frameless guest preview with own language/category state, mirrors GuestPreview's theme system; lifted state pattern for preview-only interactions

Empty state now shows 3 entry cards: Create first dish → category dialog, Import existing menu → `/setup?stage=choose`, Scan a dish → photo input.
The first-item-prompt banner was removed (the live right panel replaces it). The Preview and QR Code header buttons were removed (the right panel's Share CTA covers both).

### Key Technical Decisions

- **`price` stored as `numeric(10,2)`** — matches frontend `number` type; no cents conversion required
- **`social_links` stored as JSON text** on `restaurants` — proper join table is a future concern
- **`opening_hours` stored as free text** — structured hours (day/time pairs) is a future concern
- **Vite as Express middleware** — single port, no CORS, HMR works in dev
- **`ON DELETE CASCADE`** on category/item FK from restaurant — deleting a restaurant cleans up children
- **`ON DELETE RESTRICT`** on `menu_items.category_id` — prevents silent orphaning; caller must move or delete items first
- **No AppContext** — all state is TanStack Query from the API; only `QueryClientProvider` + `TooltipProvider` wrap the tree
- **camelCase ↔ snake_case conversion:** All route handlers use `toDb()` to convert incoming camelCase request bodies to snake_case before DB writes, and `toClient()` to convert DB snake_case rows back to camelCase before sending responses. Every new route and every new field added to an existing route must follow this pattern. Missing `toDb()` on write or `toClient()` on read creates silent field-mapping bugs.

### Environment Variables

Set automatically by Replit PostgreSQL provisioning:
- `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

Set manually in Replit Secrets:
- `GEMINI_API_KEY` — required for all AI features (rewrite, translate, allergens, calories, scan dish, import)

### Public Guest Route (must remain unauthenticated)

- `/guest?r={restaurantId}` — real restaurant guest preview

Do not gate this behind `isAuthenticated`.
