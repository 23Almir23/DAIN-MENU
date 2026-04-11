# DAIN MENU — Product and Architecture Decisions
> Letzte Aktualisierung: April 2026 · Phase 0 Sprint aktiv

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

### D02 — Schema defaults `free`/`50`; `POST /api/restaurant` overrides to `free`/`200`

**Decision:** The `restaurants` table schema defines `plan` default as `"free"` and `credits` default as `50`. The `POST /api/restaurant` route explicitly overrides both at insert time: `plan = "free"`, `credits = 200`.

**Current rationale:** The business default for new users (Free/200 credits) differs from the schema-level fallback (Free/50). The explicit route override ensures new users get 200 credits regardless of the schema default. The schema fallback exists as a DB-level safety net if the route override is ever accidentally removed.

**What must not be changed casually:** The explicit override in `POST /api/restaurant` must be preserved. If the route is refactored and the override is dropped, new users silently revert to Free/50 credits — no TypeScript error, no test, no visible warning. Vitest-Test T1-A schützt dagegen.

> ✅ **TEILWEISE UMGESETZT — Phase 0 Tag 1 (April 2026)**
> - `plan = "starter"` → `plan = "free"` ✅ (T1-B)
> - Vitest-Test für Override hinzugefügt ✅ (T1-A)
>
> **Noch ausstehend:**
> - Schema-Migration: Plan-Werte als Enum/Check-Constraint (`free`, `essential`, `pro`, `business`)
> - `restaurants.credits` Spalte deprecaten (nach Credit-System-Migration)
> - Alle Plan-Gate-Checks von `"starter"`/`"pro"` auf `"essential"`/`"pro"`/`"business"` updaten
>
> **Bis zur vollständigen Migration:** credits-Spalte bleibt aktiv. Nicht löschen.

---

### D03 — `supported_languages` array can differ from actual `item_translations` coverage

**Decision:** A restaurant's `supported_languages` array (operator-declared intent) and the actual `item_translations` rows (real coverage) are independent and can diverge.

**Current rationale:** These serve different purposes. `supported_languages` records which languages the operator intends to support. `item_translations` rows are the real content. A restaurant can declare intent for a language before running translation.

**What must not be changed casually:** Do not "fix" this divergence by enforcing that `supported_languages` only contains languages with full coverage. Do not auto-populate `item_translations` stubs from `supported_languages` — this creates false data.

**What would need to be true before revisiting:** This is a permanent design distinction, not a provisional decision.

---

### D04 — `resolveTranslation()` takes explicit `baseLang`

**Decision:** The `resolveTranslation(original, translations, langCode, baseLang)` function requires `baseLang` as an explicit parameter. It does not default to English.

**Current rationale:** DAIN MENU supports restaurants with non-English base languages. When `langCode === baseLang`, the function correctly returns original content without a translation lookup. Defaulting to `"en"` would break German-base restaurants.

**What must not be changed casually:** Do not add a default value of `"en"` for `baseLang`. Do not call `resolveTranslation` with only 3 arguments. Every call site must pass the restaurant's actual `baseLanguage` field.

**What would need to be true before revisiting:** Never. This reflects correct multilingual architecture.

---

### D05 — `creditHistory` is JSON text, not a transaction table

**Decision:** Credit history is stored as a JSON column (text) on the `restaurants` table, not in a normalized transaction table.

**Current rationale:** Phase 1 simplicity. No payment flow exists. Credits are static (no purchase, no auto-reset, no complex ledger).

**What must not be changed casually:** Do not introduce a `credit_transactions` table without a clear product requirement.

**What would need to be true before revisiting:** When credit purchase, auto-reset, refunds, or audit trails are introduced. Until then, leave it as JSON.

> **Note:** Mit Einführung von Unlimited AI (Phase 0 Billing) werden Credits obsolet. creditHistory bleibt bis zur vollständigen Credit-Migration unverändert.

---

### D06 — `opening_hours` and `social_links` are simplified text-like structures

**Decision:** `opening_hours` and `social_links` are stored in simplified form rather than normalized relational structures.

**Current rationale:** Phase 1 scope. These fields exist for profile completeness, not for complex querying.

**What must not be changed casually:** Do not create separate normalized tables for these fields in Phase 1/2.

**What would need to be true before revisiting:** When a UI feature requires structured queries on these fields.

---

### D07 — `ON DELETE RESTRICT` on `menu_items.category_id`

**Decision:** The FK from `menu_items.category_id` to `categories.id` uses `ON DELETE RESTRICT`, not `ON DELETE CASCADE`.

**Current rationale:** Cascading deletion of menu items when a category is deleted is destructive and difficult to undo. RESTRICT forces the application layer to handle this explicitly.

**What must not be changed casually:** Do not change this to `CASCADE`. Deleting a category would silently delete all its items with no UI warning and no recovery path.

**What would need to be true before revisiting:** If a "delete category and all its items" UX is intentionally designed with explicit user confirmation and a clear recovery path.

---

### D08 — One restaurant per user (Phase 1 architecture)

**Decision:** The current architecture supports exactly one restaurant per authenticated user. No team access, no invite links, no memberships, no multi-restaurant dashboard.

**Current rationale:** Phase 1 scope. Multi-restaurant and team-access architectures require additional schema (membership tables, role columns, invite tokens), auth middleware changes, and significant UI surface.

**What must not be changed casually:** Do not add invite-link logic. Do not add a `restaurant_members` or `team_invites` table. Do not modify `ProtectedRoute.tsx` to support multi-restaurant selection without explicit intent.

**What would need to be true before revisiting:** Phase 3 — nach 100+ Kunden. Ist ein named future feature, kein Oversight.

---

### D09 — `DEFAULT_LANGUAGE` constant vs. per-restaurant `baseLang`

**Decision:** `DEFAULT_LANGUAGE` is a code-level constant used as a fallback when no restaurant-specific base language is known. Per-restaurant `baseLanguage` is the real language setting for all restaurant-specific operations.

**Current rationale:** These are different concepts. `DEFAULT_LANGUAGE` is a UI/system fallback. `baseLanguage` is the restaurant's actual content language.

**What must not be changed casually:** Do not use `DEFAULT_LANGUAGE` as the `baseLang` argument to `resolveTranslation()` in restaurant-specific contexts. Do not assume `DEFAULT_LANGUAGE = "en"` means all restaurants are English-base.

**What would need to be true before revisiting:** Never. This distinction is permanent.

---

### D10 — Plan model — Phase 0 Gates

**Decision:** Plan-Gates werden in Phase 0 (T3-A) eingeführt. Bis dahin ist Custom Theme (Essential+) der einzige funktionale Gate.

**Aktuelle Plan-Struktur (v4 — final):** `free` / `essential` / `pro` / `business`

**Implementierte Gates nach Phase 0:**
- Custom Theme: Essential+
- Photo Enhancement: Essential+
- Print PDF: alle Tiers (Badge bei Free)
- Dain-Badge entfernen: alle Tiers (Branding-Option)

**Noch nicht implementierte Gates (Phase 2):**
- Analytics: Pro+
- WhatsApp: Business
- Kassensysteme: Business/Pro (Phase 3)
- Sprachgrenzen per Tier: Logik noch nicht definiert

**Kai übernimmt Upgrade-Kommunikation** — kein anonymes Modal. Kai spricht User direkt an wenn gegatetes Feature aufgerufen wird.

**What must not be changed casually:** Do not add new plan-gated code paths ohne expliziten Eintrag hier. Do not treat the pricing page as a specification for what is enforced.

---

### D11 — Stripe ist Key-unabhängig gebaut (NEU — Phase 0)

**Decision:** Der Stripe-Client und alle Billing-Routes sind so gebaut, dass der Server ohne `STRIPE_SECRET_KEY` startet und läuft. Fehlender Key gibt 503 zurück — kein Crash.

**Rationale:** Stripe-Account und Keys sind noch nicht verfügbar bei Sprint-Start. Das System muss vollständig baubar sein bevor der Key existiert.

**Was nicht geändert werden darf:** Kein Stripe-Code darf beim Server-Start crashen wenn `STRIPE_SECRET_KEY` fehlt. Immer `requireStripe(res)` Guard verwenden.

**Revisit:** Wenn echter Stripe-Key eingetragen wird — kein Code-Change nötig, nur Env-Variable setzen.

---

### D12 — AVV-Checkbox ist Pflicht im Onboarding (NEU — Phase 0)

**Decision:** Eine AVV/AGB-Checkbox wird in Onboarding Step 1 eingefügt. Der "Weiter"-Button bleibt disabled bis die Checkbox aktiviert ist.

**Rationale:** EU-Recht erfordert explizite Zustimmung zu AGB und Datenschutzerklärung vor Account-Erstellung. Implizite Akzeptanz (nur Footer-Link) reicht nicht aus.

**Was nicht geändert werden darf:** Die Checkbox darf nicht optional gemacht werden. Account-Erstellung ohne Checkbox-Aktivierung ist nicht erlaubt.

**Revisit:** Wenn ein Anwalt die Formulierung oder Platzierung anpassen will.

---

### D13 — Kai ist für alle Tiers verfügbar — kein Gate (NEU — Phase 0)

**Decision:** Kai (der AI-Begleiter) ist für alle Tiers zugänglich — Free, Essential, Pro, Business. Kai hat kein Plan-Gate.

**Rationale:** Kai ist nicht ein Feature — Kai ist das Produkt-Gehirn. Kai übernimmt Upgrade-Kommunikation, Retention, Onboarding-Begleitung und proaktive Empfehlungen. Ein Gate auf Kai würde das primäre Differenzierungsmerkmal von DAIN MENU zerstören.

**Was nicht geändert werden darf:** Kai darf nicht hinter einen Plan-Gate gestellt werden. Kai-Funktionalitäten dürfen nicht auf bestimmte Tiers beschränkt werden.

**Revisit:** Nie. Kai ist das Produkt.
