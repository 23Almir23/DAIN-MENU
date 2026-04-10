# MenuAI — Product and Architecture Decisions

## 1. Purpose of This File

This file documents intentional product and architecture decisions that could otherwise appear to be bugs, inconsistencies, or technical debt to a future agent or developer. Its purpose is to prevent well-intentioned cleanup or refactoring from breaking things that are deliberately provisional, simplified, or architecturally constrained for reasons documented here.

---

## 2. How to Use This File

Before refactoring, "fixing," or "improving" any system described in this file, read the relevant entry. If the rationale still applies, do not change it without explicit intent. If the conditions for revisiting have been met, note that and proceed — but update this file after.

---

## 3. Decision Entries

---

### D01 — `restaurants.user_id` is nullable

**Decision:** The `user_id` column on the `restaurants` table has no `NOT NULL` constraint and no FK constraint.

**Current rationale:** Existing rows (seed data, pre-auth data) were created before strict ownership was enforced. Adding `NOT NULL` to a column with existing null rows requires a data migration — cleaning all null rows and then altering the column. This has not been done.

**What must not be changed casually:** Do not add `NOT NULL` or a FK constraint without first auditing and cleaning all existing null-`user_id` rows. A migration that fails on existing data will corrupt the database.

**What would need to be true before revisiting:** All existing null-`user_id` rows must be resolved (assigned to an owner or deleted). Only then can the column be hardened. This is a pre-condition, not a roadmap item.

---

### D02 — Schema defaults `free`/`50`; `POST /api/restaurant` overrides to `starter`/`200`

**Decision:** The `restaurants` table schema defines `plan` default as `"free"` and `credits` default as `50`. The `POST /api/restaurant` route explicitly overrides both at insert time: `plan = "starter"`, `credits = 200`.

**Current rationale:** The business default for new users (Starter/200) differs from the schema-level fallback (Free/50). Rather than change the schema default (which would require a migration), the route override was introduced as an explicit, reviewable business rule. The schema fallback exists as a DB-level safety net if the route override is ever accidentally removed.

**What must not be changed casually:** The explicit override in `POST /api/restaurant` must be preserved. If the route is refactored and the override is dropped, new users silently revert to Free/50 credits — no TypeScript error, no test, no visible warning.

> ⚠️ **REVISIT PENDING — Sprint Tag 2-3 (April 2026)**
> Pricing Modell v4 ändert die Plan-Struktur grundlegend:
> - Alt: `"free"` / `"starter"` / `"pro"` + Credits
> - Neu: `"free"` / `"essential"` / `"pro"` / `"business"` + Unlimited AI
>
> **Sprint-Aufgaben für D02:**
> 1. Schema-Migration: neue Plan-Werte als Enum oder Check-Constraint
> 2. Route `POST /api/restaurant` → Override auf `plan = "essential"`, Credits entfernen
> 3. Alle Plan-Gate-Checks im Code von `"starter"`/`"pro"` auf `"essential"`/`"pro"`/`"business"` updaten
> 4. `restaurants.credits` Spalte deprecaten (nach Credit-System-Migration)
> 5. Jest-Test für neues Plan-Override updaten
>
> **Bis zur Migration:** D02 bleibt wie dokumentiert. Nicht ohne diese Migration refactoren.

---

### D03 — `supported_languages` array can differ from actual `item_translations` coverage

**Decision:** A restaurant's `supported_languages` array (operator-declared intent) and the actual `item_translations` rows (real coverage) are independent and can diverge.

**Current rationale:** These serve different purposes. `supported_languages` records which languages the operator intends to support — used for UI configuration and AI Studio target selection. `item_translations` rows are the real content. A restaurant can declare intent for a language before running translation. A restaurant can also have `supported_languages` entries for languages with no translations yet.

**What must not be changed casually:** Do not "fix" this divergence by enforcing that `supported_languages` only contains languages with full coverage. That would break the workflow where an operator declares a language and then runs translation. Do not auto-populate `item_translations` stubs from `supported_languages` — this creates false data.

**What would need to be true before revisiting:** No change needed. This is a permanent design distinction, not a provisional decision. The guest preview language switcher is already data-driven by actual `item_translations` coverage, which is the correct behavior.

---

### D04 — `resolveTranslation()` takes explicit `baseLang`

**Decision:** The `resolveTranslation(original, translations, langCode, baseLang)` function in `src/lib/i18n-utils.ts` requires `baseLang` as an explicit parameter. It does not default to English.

**Current rationale:** MenuAI supports restaurants with non-English base languages (e.g., a German-base restaurant). When `langCode === baseLang`, the function correctly returns original content without a translation lookup. If `baseLang` defaulted to `"en"`, a German-base restaurant displaying German content would incorrectly attempt a translation lookup for the base language, creating spurious fallback states.

**What must not be changed casually:** Do not add a default value of `"en"` for the `baseLang` parameter. Do not call `resolveTranslation` with only 3 arguments at any call site. Every call site must pass the restaurant's actual `baseLanguage` field.

**What would need to be true before revisiting:** This decision should not be revisited. It reflects correct multilingual architecture, not a provisional simplification.

---

### D05 — `creditHistory` is JSON text, not a transaction table

**Decision:** Credit history is stored as a JSON column (text) on the `restaurants` table, not in a normalized transaction table.

**Current rationale:** Phase 1 simplicity. No payment flow exists. Credits are static (no purchase, no auto-reset, no complex ledger). A full transaction table would add schema complexity, migrations, and query overhead for a feature that currently serves only basic credit display in the UI.

**What must not be changed casually:** Do not introduce a `credit_transactions` table or normalize this field without a clear product requirement. Schema migrations for active data must be managed carefully.

**What would need to be true before revisiting:** When credit purchase, auto-reset, refunds, audit trails, or per-action credit ledgering are introduced — any of these creates a real requirement for a transaction table. Until then, leave it as JSON.

---

### D06 — `opening_hours` and `social_links` are simplified text-like structures

**Decision:** `opening_hours` and `social_links` are stored in simplified form (JSON text columns or loosely structured fields) rather than normalized relational structures.

**Current rationale:** Phase 1 scope. These fields exist for restaurant profile completeness, not for complex querying or business logic. Normalizing them early adds migrations, schema complexity, and validation logic for features that are not yet driving product value.

**What must not be changed casually:** Do not create separate `opening_hours_slots` or `social_links` tables. Do not add complex validation schemas for these fields in Phase 1.

**What would need to be true before revisiting:** When a UI feature requires structured queries on these fields (e.g., "show restaurants open on Sundays," or social link validation with per-platform logic), normalization becomes justified.

---

### D07 — `ON DELETE RESTRICT` on `menu_items.category_id`

**Decision:** The FK from `menu_items.category_id` to `categories.id` uses `ON DELETE RESTRICT`, not `ON DELETE CASCADE`.

**Current rationale:** Cascading deletion of menu items when a category is deleted is a destructive operation that is difficult to undo. RESTRICT forces the application layer to handle this explicitly — the UI must move or delete items before allowing category deletion. This prevents accidental bulk data loss.

**What must not be changed casually:** Do not change this to `CASCADE`. A careless schema change would mean deleting a category silently deletes all its items — with no UI warning, no confirm dialog, and no recovery path.

**What would need to be true before revisiting:** If a "delete category and all its items" UX is intentionally designed with explicit user confirmation and a clear recovery path, CASCADE could be reconsidered. Until then, RESTRICT is correct.

---

### D08 — One restaurant per user (Phase 1 architecture)

**Decision:** The current architecture supports exactly one restaurant per authenticated user. There is no team access, no invite links, no memberships, and no multi-restaurant dashboard.

**Current rationale:** Phase 1 scope. The ownership model (`restaurants.user_id`) is a simple 1:1 relationship. Multi-restaurant and team-access architectures require additional schema (membership tables, role columns, invite tokens), auth middleware changes, and significant UI surface. Introducing these prematurely adds complexity before the core value is validated.

**What must not be changed casually:** Do not add invite-link logic. Do not add a `restaurant_members` or `team_invites` table. Do not modify `ProtectedRoute.tsx` to support multi-restaurant selection without explicit intent and scope agreement.

**What would need to be true before revisiting:** Clear product requirement for multi-restaurant or team access, with defined scope for the membership model. This is a named future feature, not an oversight.

---

### D09 — `DEFAULT_LANGUAGE` constant vs. per-restaurant `baseLang`

**Decision:** `DEFAULT_LANGUAGE` is a code-level constant used as a fallback when no restaurant-specific base language is known. Per-restaurant `baseLanguage` (from `restaurants.base_language`) is the real language setting for all restaurant-specific operations.

**Current rationale:** These are different concepts. `DEFAULT_LANGUAGE` is a UI/system fallback — used, for example, when rendering an unattached component or before a restaurant is loaded. `baseLanguage` is the restaurant's actual content language, which may be German, Spanish, French, or any supported language.

**What must not be changed casually:** Do not use `DEFAULT_LANGUAGE` as the `baseLang` argument to `resolveTranslation()` in restaurant-specific contexts. Do not assume `DEFAULT_LANGUAGE = "en"` means all restaurants are English-base. These are semantically different values that must not be conflated.

**What would need to be true before revisiting:** This distinction is permanent, not provisional. No conditions for collapsing them.

---

### D10 — Plan model is provisional

**Decision:** The current Free / Starter / Pro plan structure is an early commercial model. Only one functional gate is enforced in code: custom theme is locked when `plan === "free"`. All other plan distinctions are positioning only.

**Current rationale:** The plan structure is being validated with early testers before hardening into enforced feature gates. Premature gating creates friction before product-market fit is established and creates technical debt if the plan names or entitlements change.

**What must not be changed casually:** Do not add new plan-gated code paths without explicit intent. Do not treat the pricing page as a specification for what is enforced — it is marketing positioning. Do not introduce Stripe or a subscription table without a full scope decision.

**What would need to be true before revisiting:** When plan entitlements are finalized and agreed, enforce them with a clear gate system. At that point, introduce proper subscription infrastructure. Until then, keep enforcement minimal.

---

## 4. When to Update This File

Update this file when:
- An intentional decision changes (a provisional simplification is resolved, a phase changes)
- A new decision is made that future agents might otherwise "fix"
- The conditions for revisiting a decision are met and the decision is actually revised

Do not update this file for general product changes, bug fixes, or new features that don't affect the decisions documented here.
