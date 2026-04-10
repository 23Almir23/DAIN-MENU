# MenuAI — Current State

> ⚠️ **SPRINT-ÄNDERUNGEN AUSSTEHEND — April 2026**
> Die folgenden Entscheidungen sind getroffen aber noch NICHT im Code implementiert.
> Claude Code darf diese nicht als bereits vorhanden behandeln.
>
> | Entscheidung | Aktuell im Code | Ziel nach Sprint |
> |---|---|---|
> | Pricing Modell | Free / Starter €29 / Pro €79 | Free / Essential €29 / Pro €55 / Business €89 |
> | AI-Kosten | Credit-System (deduct per action) | Unlimited AI · €2.50 flat COGS/Kd |
> | Billing | Kein Stripe, kein Checkout | Stripe + Annual-First |
> | Plan Gates | Nur Custom Theme (Free) | Vollständige Gates pro Tier v4 |
> | Photo Enhancement | Phase 2 geplant | Ab Launch als Pro-Feature |
> | Design Templates | Nicht implementiert | Sprint Phase 1 |
> | Print Export PDF | Nicht implementiert | Sprint Phase 1 |
> | Credit-Spalten | `restaurants.credits` aktiv | Deprecated nach Migration |
>
> **Bis zur Migration:** Credit-System im Code belassen. Keine Credit-Spalten löschen.

---

## 1. Purpose of This File

This file captures the real current state of the MenuAI product. It is not a roadmap, a wish list, or a pitch document. It exists to prevent false assumptions and agent drift across sessions. Update it when reality changes materially.

---

## 2. Product Status

MenuAI is a strong MVP with real end-to-end value across its core flows: import, AI enhancement, translation, guest preview, and QR delivery. It is not a final product. Plan structure, credit defaults, onboarding, and feature gating are all expected to evolve before broader launch. Nothing in this file should be treated as permanent unless explicitly stated.

---

## 3. Product Surfaces

### Landing Page

Real and functional. Hero headline and subhead are strong and specific. Primary CTAs ("Start free", "Set up your restaurant") route to `/api/login` — correct for unauthenticated visitors. Two secondary feature-section cards still call `navigate("/setup")` directly — a minor inconsistency; unauthenticated visitors clicking those cards hit an auth wall without explanation. The language marquee lists 9 languages including Arabic and CJK — these appear in `SUPPORTED_LANGUAGES` but have not been validated at production quality. This is a soft marketing overpromise on unvalidated capabilities.

### Onboarding (`/setup`)

Five-stage flow: name → choose → import → review → done. File upload accepts PDF, JPG, PNG, WEBP up to 18 MB; HEIC/HEIF yields a human-readable error message. Text paste also available. Gemini parses the import server-side; operator reviews a structured draft before `POST /api/import/confirm`. Manual path (skip import, add items manually) is available. New restaurants created here receive `plan = "starter"` and `credits = 200` via an explicit route-level override (see Section 6). The flow is end-to-end functional and has been validated.

### Dashboard

Fully functional. Stats derived from `useMenu()` cache — no extra fetch. Displays: item counts, language coverage, credit balance, plan. Service session controls: "Ready for service?" card (appears when soldOut or specials exist and no session is active); dismissible per browser session via `sessionStorage`. "In service since [time]" banner when session is open. One-click mutations: clear sold-out, clear specials. Activation checklist driven by `useActivation()`. Empty state adapts correctly: shows "Import Menu" quick action (not "AI Studio") when no items exist.

### Menu Builder

Full CRUD for categories and items. The `needsReview` flag surfaces AI-updated items with an amber "AI updated" badge; bulk and per-item "Mark reviewed" actions exist. The `?needsReview=1` URL parameter activates the needs-review filter on mount. Scan Dish is a real, live feature: camera/file input button in the Add Item dialog sends an image to `POST /api/items/parse-photo`, which calls Gemini for visual recognition, returns `{ name, description, confidence }`, and opens a Quick Confirm dialog with those fields pre-filled. Price is intentionally blank (cannot be inferred from a photo). Low-confidence responses trigger a warning toast. Requires `GEMINI_API_KEY` — fails gracefully with a user-facing message if unavailable. Largest file in the project at ~1537 lines; functional, no quality issues.

### AI Studio

Four action cards: Enhance Descriptions, Translate Menu, Detect Allergens, Estimate Calories. All four call real Gemini endpoints server-side. Uses `restaurant.baseLanguage` for both rewrite direction (descriptions written in base language) and translate source (translates from base language → selected target). The `safeTranslateLang` guard prevents accidentally translating to the same language as the base. Item picker supports all-items or a selected subset. Credit costs are shown per action. `isLowCredits` and `isOutOfCredits` states are computed and displayed. Gemini-specific error messages distinguish key errors, quota exhaustion, and network failures. All AI actions set `needsReview = true` on affected items. Requires `GEMINI_API_KEY`.

### Guest Preview

Dual-mode: standalone (unauthenticated, public, `?r=` param) and admin preview (authenticated, operator's own restaurant). Language switcher is data-driven: shows only languages with actual `item_translations` rows. Language auto-select: tries `navigator.language` (stripped to base code), checks if it's in `availableLangs`, falls back to `restaurant.baseLanguage`. Falls back to original (base-language) content with `isFallback: true` when a translation is missing — no error state. Active category tab auto-selects the first category with available items (prevents empty-tab state). OG meta tags (`title`, `description`, `og:*`) injected on mount for real standalone pages. Custom theme gated: `plan === "free"` → custom theme locked. Public hooks: `usePublicMenu(restaurantId)` and `usePublicRestaurant(restaurantId)` for unauthenticated standalone access.

### QR Flow (`/qr-codes`)

QR URL: `${window.location.origin}/guest?r=${restaurant.id}` — real and always correct. PNG download via canvas; SVG download via blob. Copy-to-clipboard with graceful fallback message. Readiness check: `availableItems >= 3 && totalCategories >= 1`. No QR config persistence — URL structure is real and permanent; print appearance settings are ephemeral (no DB column).

### Copilot

Right-side Sheet drawer. Health signals fetched from `GET /api/copilot/context` — pure DB aggregation, zero AI cost, no Gemini calls. Signals: `missingDescriptions`, `missingPrices`, `needsReview`, `soldOut`, `specials`, `translationCoverage[]` per language, `serviceOpen`, `credits`, `plan`. Command bar: deterministic keyword intent routing via `src/lib/copilot-intents.ts` — no AI, no network. Actions: deep-link navigation into existing tools only — no execution logic duplication. Sidebar badge: client-computed signal count (`needsReview + missingDescriptions`), no extra fetch.

---

## 4. Billing / Plan Reality

### Schema defaults (DB level)
- `restaurants.plan` — default: `"free"`
- `restaurants.credits` — default: `50`

### Actual new-restaurant behavior (route level)
- `POST /api/restaurant` explicitly overrides at insert time: `plan = "starter"`, `credits = 200`
- This override is in `server/routes.ts` — not in the schema
- New external testers start with Starter / 200 credits immediately

### Enforced plan gates (what the code actually checks)
- Custom theme: locked when `plan === "free"`
- **No other functional plan gates exist in the current codebase**

### What is not implemented
- No Stripe integration
- No subscription table
- No payment or checkout flow
- No credit purchase flow
- No credit auto-reset of any kind
- No plan upgrade flow (pricing page shows comparison copy; no checkout is wired)

### Pricing page
The pricing page exists but is marketing positioning only. It is not a reliable specification for what is actually enforced. Do not treat it as a feature gate reference.

---

## 5. Multilingual Reality

### Language support in code
`SUPPORTED_LANGUAGES` contains 10 codes: `en`, `es`, `fr`, `de`, `it`, `pt`, `zh`, `ja`, `ko`, `ar`

### Production-validated languages
`en`, `es`, `fr`, `de`, `it`, `pt` — Romance and Germanic families, meaningfully tested via Gemini translation

### Unvalidated languages
`zh`, `ja`, `ko`, `ar` — present in `SUPPORTED_LANGUAGES` and displayed in the landing page language marquee; not systematically tested for Gemini translation quality at production scale

### `supported_languages` array vs. actual coverage
These are different things and intentionally diverge. `supported_languages` on `restaurants` is operator-declared intent. `item_translations` rows are actual content. The guest preview language switcher is driven by `item_translations` coverage — not by the `supported_languages` array.

### `resolveTranslation()` behavior
Defined in `src/lib/i18n-utils.ts`. Signature: `resolveTranslation(original, translations, langCode, baseLang)`. When `langCode === baseLang`, returns original content (no translation lookup). When a translation exists with a non-empty `name`, returns the translation. Otherwise returns original with `isFallback: true`. **The `baseLang` parameter must always be passed at call sites — do not default it to `"en"` in calling code.**

### Guest language auto-select
On standalone mount: reads `navigator.language`, strips to base code (e.g. "en-US" → "en"), checks if that code is in `availableLangs`. If yes, selects it. Otherwise selects `restaurant.baseLanguage`. Fires once per mount.

---

## 6. Architecture Reality

### Auth flow (canonical)
1. Unauthenticated visitor clicks any marketing CTA → `window.location.href = "/api/login"`
2. Replit OIDC → `GET /api/callback` → session created → redirect to `/dashboard`
3. `ProtectedRoute.tsx` detects no restaurant → `navigate("/setup", { replace: true })`
4. `POST /api/restaurant` creates restaurant with `plan="starter"`, `credits=200`
5. Onboarding completes → `/dashboard`

**Canonical file for redirect logic:** `src/components/ProtectedRoute.tsx`. Do not re-implement redirect behavior elsewhere.

### Restaurant ownership model
- `restaurants.user_id` — nullable text (not a FK, no NOT NULL constraint)
- Nullability is intentional: existing rows and pre-auth data pre-date strict ownership enforcement
- API-level enforcement: all authenticated routes scope by `req.user.claims.sub`
- One user → one restaurant (current architecture); multi-tenancy is a named future feature

### Route ownership rule
All routes require `isAuthenticated` middleware and `userId` owner scoping **except:**
- `GET /api/health`
- `GET /api/guest`
- `GET /api/login`, `GET /api/callback`, `GET /api/logout`
- Frontend routes: `/`, `/pricing`, `/guest`

### `toDb()` / `toClient()` conversion pattern
All route handlers use `toDb()` to convert incoming camelCase request bodies to snake_case before DB writes, and `toClient()` to convert DB snake_case rows to camelCase before responses. Every new route and every new field added to an existing route must follow this pattern. Missing conversion creates silent field-mapping bugs.

### Schema default vs. route override mismatch
`restaurants.plan` defaults to `"free"` and `credits` to `50` at the schema level. The `POST /api/restaurant` route overrides these to `"starter"` / `200` explicitly. This is intentional (avoids a migration for a temporary business default). The schema defaults are the DB fallback if the route override is ever removed — they are not the intended default for new users.

---

## 7. Strongest Current Realities

- **Auth flow end-to-end** — unauthenticated → login → dashboard → setup → first value is clean and correct
- **Onboarding** — file/text import, Gemini parse, review, confirm — works end-to-end
- **Guest preview** — language resolution, auto-select, isFallback handling, OG tags — solid
- **Scan Dish** — live, mobile-native, Gemini-backed, graceful error handling — a genuine differentiator
- **Copilot** — zero-AI-cost, observer-and-router architecture — clean and correct
- **`resolveTranslation()`** — correctly respects `baseLang`; no hardcoded English
- **New user experience** — Starter / 200 credits immediately; all features accessible; custom theme unlocked

---

## 8. Provisional / Evolving Realities

| Area | Current state | Expected to change |
|------|--------------|-------------------|
| Free / Starter / Pro plan names and entitlements | Early commercial model | Before broader launch |
| Credit amounts and default allocation | 200 for new users | May change with pricing feedback |
| Custom theme as the only enforced plan gate | Intentionally minimal enforcement | More gates expected when plan structure firms |
| Credit model (finite, no purchase, no reset) | Field-based only | Needs transaction table and payment infrastructure |
| `supported_languages` vs. actual translation coverage | Can diverge intentionally | Not to be "fixed" — both serve different purposes |
| Schema defaults (`free`/`50`) vs. route override (`starter`/`200`) | Intentional mismatch | Route override is the business default; schema is the DB fallback |
| CJK + Arabic translation quality | Unvalidated | May be validated or explicitly scoped before global push |
| `opening_hours`, `social_links`, `credit_history` as text/JSON | Phase 1 simplicity | Structured fields planned |
| QR config persistence | Ephemeral | DB persistence planned |
| Category drag-to-reorder persistence | Status unclear | Needs verification |

---

## 9. Weak / Risky Realities

**Schema/route default mismatch (medium risk)**
If `POST /api/restaurant` is refactored without preserving the explicit `plan="starter"`, `credits=200` override, new users silently revert to Free / 50 credits. No TypeScript error, no test, no visible warning catches this.

**`restaurants.user_id` nullable (low risk, real)**
No DB-level constraint prevents a restaurant row from being created without an owner. API routes enforce ownership correctly, but a direct DB insert or future background job could create an unowned row invisible to any user.

**CJK/Arabic marketing overpromise (reputational, pre-launch)**
The landing page language marquee shows 9 languages. Arabic and CJK have no systematic production validation for translation quality. If a tester attempts these languages and quality is poor, it damages credibility before the product is positioned as a global solution.

**Secondary landing cards still route to `/setup` (minor)**
Two feature-section cards in `Landing.tsx` call `navigate("/setup")` directly. Unauthenticated visitors clicking those cards hit an auth redirect without context. Low urgency; not on the primary conversion path.

---

## 10. What Must Not Be Assumed

- **The pricing page is not a gate spec.** Only one plan gate is enforced in code (custom theme on Free).
- **`supported_languages` does not guarantee translations exist.** The array and `item_translations` rows are independent.
- **The schema defaults are not the business defaults.** `free`/`50` in the schema; `starter`/`200` in the route.
- **Replit Auth is not optional.** Every operator-facing route requires `isAuthenticated` + owner scoping.
- **`resolveTranslation()` must receive `baseLang` explicitly.** Do not call it with only 3 arguments and assume English as the base.
- **One user = one restaurant.** No team access, no invite links, no multi-restaurant support exists.
- **`toDb()` / `toClient()` must be applied on every route.** Missing it on a new field creates a silent mapping bug.
- **Migration path:** `npx drizzle-kit generate` then `npx drizzle-kit push`. Never `npm run db:push`. Never manual SQL.

---

## 11. How to Use This File

Update this file when:
- Real product behavior changes materially (new feature shipped, behavior corrected)
- Billing/plan model changes (new gates added, defaults changed, Stripe added)
- Architecture changes (auth model, ownership model, new canonical files)

Do not update this file for cosmetic changes, minor bug fixes, or content edits that don't affect behavior. This file tracks reality, not activity.
