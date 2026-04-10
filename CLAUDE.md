# CLAUDE.md — Dain Menu Autonomous Build Operating Manual

> This file is the authoritative operating guide for Claude Code on this project.
> Read it before every session. Follow it during every implementation.
> Update it after significant architectural decisions.

---

## 1. Product Identity

**Dain Menu** is a premium AI-powered B2B SaaS for restaurant operators worldwide.
The long-term vision: the first product proving a solo founder with an AI team can build and scale a global AI/SaaS product — and position it for exit or partial exit to a strategic acquirer.

**Every decision must be made with acquisition-readiness in mind:**
- Clean, documented architecture
- No unexplained vendor lock-in
- Strong unit economics
- Scalable infrastructure
- Clear IP ownership

**Stack:** React + Vite + TypeScript + Express + PostgreSQL + Drizzle ORM + Gemini AI
**Auth:** Replit OIDC
**Deploy:** Replit (bleibt bis nach Pilot → dann Migration zu Hetzner VPS)
**Payment:** Stripe + Stripe Tax (entschieden ✓)
**AI Image:** Google Imagen 4 ($0.04/image, Phase 2)
**Image Storage:** Cloudinary (Phase 2)
**Analytics:** Plausible + PostHog (Phase 2)
**Error Monitoring:** Sentry

---

## 2. Autonomy Framework — 100% Vertrauen · 24/7

**Claude Code läuft autonom, 24/7, ohne Approval-Zyklen.**
Lalo hat Claude vollständiges Vertrauen gegeben. Tests sind der einzige Quality Gate.
Commit = Tests grün. Rollback = Tests rot. Kein Warten auf manuelles Review.

**Lalo entscheidet nur noch 2 offene Punkte:**

### Claude decides autonomously:
- All implementation details, component architecture, file structure
- Database schema specifics (within Drizzle + non-negotiable rules below)
- Error handling strategies and fallback logic
- Test structure, coverage levels, and testing approach
- Performance optimizations
- Refactoring and cleanup
- Bug fixes
- UI/UX details within defined brand direction
- Which NPM packages to use (within security reason)
- API endpoint design (within REST conventions)
- Code organization and module structure
- Credit overage handling (default: hard block with upgrade prompt)
- Menu template approach (AI-detected categories preferred over static templates)
- Large menu handling (pagination + virtual scrolling above 100 items)
- isFallback UX (show original with visual indicator, never hide content)
- Mid-month upgrade billing (Stripe prorata default)
- Referral program conditions (1 free month for referrer + referee, simple)
- Test types and coverage (default: Vitest unit + Playwright E2E for critical flows)

### Claude must document in CLAUDE.md (Decision Log section):
Any decision that:
- Changes a database schema
- Adds a new external dependency
- Changes the auth flow
- Affects billing or credits
- Deviates from the roadmap

### Lalo decides (5% — trigger a Lalo alert):
- Pricing changes (any number change to €29/€55/€89/€44/€83/€134)
- New external API integrations not already in the approved list
- Sharing user data with third parties
- Legal/compliance decisions
- Partnerships or external deals
- Any feature not in the current phase roadmap
- Branding identity changes (colors, fonts, naming)

**Alert format when Lalo decision needed:**
```
🔔 CLAUDE DECISION ALERT
Needs: [Lalo decision]
Context: [1 sentence why]
Recommendation: [Claude's suggestion]
Options: A) [option] B) [option]
Impact if delayed: [what breaks or blocks]
```

---

## 3. Non-Negotiable Architecture Rules

These rules NEVER change. Violating them silently breaks production.

### R01 — toDb() / toClient() on every route
```typescript
// ALWAYS convert before DB write:
const dbData = toDb(requestBody)
// ALWAYS convert before response:
return res.json(toClient(dbRow))
```
Missing this creates silent field-mapping bugs. New fields in existing routes = update conversion in both directions.

### R02 — resolveTranslation() always with explicit baseLang
```typescript
// CORRECT:
resolveTranslation(original, translations, langCode, restaurant.baseLanguage)
// WRONG — never do this:
resolveTranslation(original, translations, langCode) // missing baseLang
resolveTranslation(original, translations, langCode, "en") // hardcoded English
```
Dain Menu supports non-English base languages. German restaurants have baseLang="de".

### R03 — needsReview = true on ALL AI outputs
```typescript
// Every AI action must set this:
await db.update(menuItems).set({ needsReview: true, ...aiContent })
```
Applies to: text enhancement, translation, allergen detection, calorie estimation,
photo enhancement, dynamic pricing suggestions. No exceptions.

### R04 — /guest?r={restaurantId} URL structure is permanent
Do NOT change this route. Thousands of printed QR codes worldwide point here.
If routing logic changes, the parameter name and structure must remain identical.

### R05 — 1 User = 1 Restaurant
Do NOT add: multi-restaurant dashboards, team invites, shared access, role systems.
This is D08 — a named future feature for Phase 3. Do not implement it prematurely.

### R06 — English is NOT the default language
```typescript
// DEFAULT_LANGUAGE is a UI fallback constant only.
// restaurant.baseLanguage is the real language for all content operations.
// Never use DEFAULT_LANGUAGE as baseLang in restaurant-specific contexts.
```

### R07 — Database migrations: drizzle-kit only
```bash
# ALWAYS:
npx drizzle-kit generate
npx drizzle-kit push

# NEVER:
npm run db:push       # not a valid command
# Manual SQL files    # never write raw migration SQL
# Editing migration files in /migrations/  # generated only
```

### R08 — Credit-System Migration (Sprint Tag 2-3)
Das aktuelle Code-Credit-System (`restaurants.credits`, `POST /api/billing/use-credits`,
`credit_history`) wird im Sprint auf **Unlimited AI (€2.50 flat COGS)** migriert.

**Bis zur Migration gilt:**
- Credit-Spalten und Endpoints existieren noch im Code — NICHT löschen ohne explizite Migration
- Keine neuen Credit-Logik hinzufügen

**Nach der Migration gilt:**
- Kein `use-credits` Endpoint mehr
- Keine Credit-Deduktion in AI-Routen
- `restaurants.credits` Spalte wird deprecated → entfernt nach Migration
- Alle AI-Aktionen sind im Plan-Tier enthalten (Unlimited)

**Migration-Reihenfolge im Sprint:**
1. Stripe + neue Tiers (Essential/Pro/Business) aufbauen
2. Neue Plan Gates auf Tier-Basis (nicht Credits)
3. Credit-Deduktion aus allen AI-Routen entfernen
4. `restaurants.credits` Schema-Spalte deprecaten

---

## 4. Current Phase Context

### Phase 0 (Do this first, before anything else):
- [ ] Fix Landing Page CTAs: navigate("/setup") → window.location.href = "/api/login"
- [ ] Add Jest test for plan=starter override in POST /api/restaurant
- [ ] Set up Sentry (DSN in env, ErrorBoundary in React, source maps)
- [ ] Add ESLint rule enforcing toDb()/toClient() pattern on new route files
- [ ] Remove CJK/Arabic languages from landing page marquee (or mark as "Beta")
- [x] Copilot name decision: **Kai ✓ — entschieden April 2026**
- [ ] **Custom Domain:** dainmenu.com in Replit Settings verknüpfen (vor Pilot-Gesprächen nächste Woche)
- [ ] **Invite-only Signup-Flow:** Pilot-Restaurants kommen via direktem Link rein → Replit OIDC Login

### Phase 1 Sprint (10 days):
See full task breakdown in dain_menu_SSOT.html Sprint tab.
Priority order: P0 fixes → Stripe → Annual-Billing → Plan Gates (v4) → Design Templates → Print Export → Onboarding → Confidence Score → Badge → Copilot Kai → Landing → Tests → Launch

### What is OUT OF SCOPE right now (do not build):
- Photo Enhancement (needs Cloudinary PoC first)
- PWA Offline Mode
- Social Sharing / Guest Rating
- Replit Migration
- CJK/Arabic validation
- Multi-Restaurant / Team Access
- Native App
- POS Integration
- Dynamic Pricing
- Table Ordering
- Dietary Filters in Guest View (Phase 2)
- Referral Program (Phase 2)
- Demo/Product Tour (Phase 2)

---

## 5. Testing Strategy

Claude Code decides test coverage level. Default protocol:

### Unit Tests (Vitest)
- All utility functions: resolveTranslation, toDb, toClient, credit calculations
- All business logic: plan gate checks, credit deduction
- Run on every commit

### E2E Tests (Playwright) — Critical Flows Only
These 5 flows MUST pass before any deploy:
1. **Auth Flow**: Unauthenticated → /api/login → callback → /dashboard → /setup
2. **Import + QR**: Upload file → AI parse → confirm → QR code generated
3. **Stripe Billing**: Plan upgrade (Essential/Pro/Business) → Stripe checkout → webhook → plan updated
4. **Plan Gates**: Free plan cannot access Pro features (test each gate)
5. **Guest Preview**: /guest?r={id} loads, language auto-selects, isFallback works

### Failed Tests Protocol
```
Test fails → Auto-fix attempt (no limit on attempts)
If fix introduces new failures → Revert to last passing state → Log in Decision Log
If stuck after significant attempts → CLAUDE DECISION ALERT to Lalo
```

### Pre-Launch Final Checklist (Claude runs autonomously):
```bash
# 1. Full test suite
npx vitest run
npx playwright test

# 2. TypeScript compilation
npx tsc --noEmit

# 3. Build check
npm run build

# 4. Lint check
npm run lint

# 5. Performance audit (Lighthouse CLI)
npx lighthouse [url] --only-categories=performance,accessibility --output=json

# 6. Security basics
npm audit --audit-level=moderate
```

---

## 6. Deployment Protocol

### Standard Deploy (after passing all tests):
```bash
# Replit deploys automatically from the main branch
# Trigger redeploy via Replit CLI:
replit deploy
# Or push to main and Replit auto-deploys
```

### Deployment Decision Rules:
- GREEN tests on all 5 critical E2E flows → deploy
- Any RED on critical flows → do NOT deploy, fix first
- Performance regression >20% on LCP → investigate before deploy
- New env variable required → add to Replit Secrets, document in this file

### Environment Variables (required):
```
GEMINI_API_KEY          — Google Gemini API (text + vision)
STRIPE_SECRET_KEY       — Stripe API key
STRIPE_WEBHOOK_SECRET   — Stripe webhook signing secret
STRIPE_TAX_RATE_ID      — Stripe Tax rate for EU VAT
SENTRY_DSN              — Error monitoring
PLAUSIBLE_DOMAIN        — Analytics domain
REPLIT_DB_URL           — Auto-set by Replit
SESSION_SECRET          — Auth session secret
REPLIT_DOMAINS          — Auto-set by Replit
REPLIT_DEPLOYMENT_ID    — Auto-set by Replit
```
Phase 2 additions: CLOUDINARY_URL, IMAGEN_API_KEY, POSTHOG_KEY

---

## 7. Code Quality Standards

### TypeScript
- Strict mode enabled — no `any` types without explicit justification
- All API responses typed with shared types from `/shared/schema.ts`
- No implicit `undefined` — handle all nullable fields explicitly

### React
- No class components — functional only
- Custom hooks for all data fetching (useMenu, useRestaurant, etc.)
- No prop drilling beyond 2 levels — use context or zustand
- All forms use react-hook-form

### Express Routes
- All routes: isAuthenticated middleware first
- All routes: userId owner scoping (req.user.claims.sub)
- All routes: toDb() on input, toClient() on output
- Error responses: consistent { error: string } shape
- Public routes only: /api/health, /api/guest, /api/login, /api/callback, /api/logout

### Database
- Drizzle ORM only — no raw SQL queries
- Transactions for multi-step operations
- No N+1 queries — use joins or batch operations

### File Size Limits
- Components: target <400 lines, refactor if >600
- Route files: target <300 lines per file, split if larger
- No single file should exceed 800 lines

---

## 8. Business Logic Reference

<<<<<<< HEAD
> **Pricing Modell v4 — entschieden April 2026. Ersetzt alle vorherigen Tier-/Credit-Referenzen.**

### AI-Kosten Modell (P03 — entschieden):
**Unlimited AI — €2.50 flat COGS pro Kunde/Mo.** Kein Credit-System. Alle AI-Aktionen
(Enhance, Translate, Allergens, Calories, Scan Dish, Photo Enhancement) sind im Tier enthalten.
Kein Credit-Tracking, kein Credit-Overage, kein Upgrade-Block durch Credits.

### Plan Tiers v4:
| Plan | Annual/Mo | Jährlich | Monatlich | Sprachen | Items | Photo Enh. | Templates | Print PDF | Analytics | CI/Brand | Standorte | Badge |
|------|-----------|----------|-----------|----------|-------|------------|-----------|-----------|-----------|----------|-----------|-------|
| Free | — | — | — | 1 | 20 | ❌ | 1 Basic | ❌ | ❌ | ❌ | 1 | Prominent |
| Essential | €29 | €348/yr | €44 | 3 | ∞ | ❌ | ✅ Alle | ✅ | Basis | ❌ | 1 | Subtil |
| Pro | €55 | €660/yr | €83 | 10 | ∞ | ✅ 100/Mo | ✅ Alle | ✅ | ✅ Voll | ✅ | 1 | Optional |
| Business | €89 | €1.068/yr | €134 | 10 | ∞ | ✅ 300/Mo | ✅ Alle | ✅ | ✅ Multi | ✅ | 3 | White Label |

### POS Integration (Phase 3 — einziges separates Add-on):
- €25/Mo · buchbar auf Pro und Business
- Erst nach 100+ stabilen Kunden evaluieren
- Jede Kasse (orderbird, Lightspeed, SumUp, Gastrofix) = separate Integration → hohe Buildkosten
- NICHT früher bauen — Marktvalidierung zuerst

### Annual-First Billing (Cashflow-Priorität):
- Annual-Rabatt: −38% vs. Monatlich (Essential: €29 statt €44)
- Annual immer als Default auf Pricing Page zeigen
- Stripe Prorata bei Mid-Month Upgrades (Default)
- Webhook events: payment_intent.succeeded, customer.subscription.updated,
  customer.subscription.deleted, invoice.payment_failed
- Stripe Fees: ~3.9% + €0.30 (EU-International inkl. Stripe Tax)

### Plan Gates (was gated ist):
- Free → max. 20 Items, 1 Sprache, 1 Basic Template, kein Print, kein Photo Enhancement
- Essential → max. 3 Sprachen, kein Photo Enhancement, keine CI/Branding
- Pro/Business → alle Features entsprechend Tabelle oben
- Copilot Kai → ab Essential (Free hat keinen Copilot)
- "Powered by Dain" Badge → Free: prominent · Essential: subtil · Pro: optional · Business: weg

### Copilot:
- Name: **Kai** (entschieden)
- Tonalität: warm, präzise, proaktiv — kein Hype, kein Startup-Jargon
- Proaktive Alerts: fehlende Beschreibungen, Übersetzungslücken, Service-Status, niedrige Completion
- Erscheint nach Onboarding mit: "[Name], deine Karte ist live! Hier sind die 3 Dinge die noch fehlen."

### COGS Kalkulation:
| Kostenart | Betrag | Skalierung |
|-----------|--------|-----------|
| Gemini API (flat) | €2.50/Kd/Mo | Unlimited AI Modell |
| Stripe Fees | ~3.9% + €0.30 | Per Transaktion |
| Replit Deploy | €20–60/Mo | Fix, skaliert ab Mo.7 |
| Claude API (Agents) | €50–150/Mo | SDR/BDR/Support/Billing |

---

## 9. Brand & UX Constants

### Colors (Terracotta accent):
```css
--accent: #c9703a;
--accent-light: #e8c9a0;
```

### Typography:
- Headlines: DM Sans 500 (loaded from Google Fonts)
- Body: DM Sans 400
- Monospace: DM Mono (for prices, codes, badges)

### Language Auto-Detection (Dashboard):
Browser language → strip to base code → check if supported → use restaurant.baseLanguage if not supported
```javascript
const lang = navigator.language.split('-')[0]
const dashboardLang = DASHBOARD_SUPPORTED.includes(lang) ? lang : restaurant.baseLanguage
```
**Important:** No hardcoded 'en' fallback. German restaurants (baseLang="de") must default to German.

### Low Confidence UX (Gemini):
Confidence < 50%: Red border + "Needs review" label + needsReview=true
Confidence 50-75%: Amber indicator + needsReview=true
Confidence > 75%: Green indicator + needsReview=true (always set)

### isFallback UX (Guest View):
Show original content + small translation icon with tooltip "Not yet translated"
Never hide content. Never show broken/empty state.

---

## 10. Decision Log

Format for every autonomous architectural decision:
```
## [DATE] — [DECISION TITLE]
**Context:** What problem needed solving
**Decision:** What was built/chosen
**Alternatives considered:** What else was evaluated
**Rationale:** Why this approach
**Impact:** What this affects
**Reversible:** Yes/No + how
```

### Active Decisions:
<!-- Claude adds entries here as decisions are made -->

---

## 11. Escalation Contacts

**Lalo (5% decisions):** Reviewed via direct message / WhatsApp
**Response expected:** Within 24h for normal decisions, 1h for blockers
**If no response after 24h:** Use Claude's recommendation and log in Decision Log

---

*Last updated: April 2026 — Pricing v4 · Alle Entscheidungen final*
*This file supersedes all previous operating instructions.*

---

## 12. Tool-Workflow & Zuständigkeiten

```
Claude.ai (dieses Chat)  → Architektur, Planung, Dokumente, Prompts, Reviews
Claude Code CLI          → ALLE Code-Änderungen direkt im Repo (primäres Coding-Tool)
Cowork                   → Datei- & Task-Automation, Skills/Agents
GitHub (DAIN-MENU)       → Single Source of Truth für Code
Replit                   → Build & Deploy only — kein direktes Coding hier
```

### Arbeitsflow:
```
1. Claude.ai → plant, entscheidet, schreibt Dokumente
2. Claude Code → implementiert (Mac Terminal lokal ODER Replit Shell — je nach Task)
3. GitHub → empfängt alle Commits (Source of Truth)
4. Replit → zieht von GitHub → baut → deployed automatisch
```

### Wer entscheidet was:
- **Claude entscheidet 95%** aller Implementierungsdetails autonom (siehe Abschnitt 2)
- **Lalo entscheidet 5%** — Pricing, neue externe APIs, Legal, Branding (→ CLAUDE DECISION ALERT)
- **Alle Entscheidungen getroffen.** Stripe ✓ · Kai ✓ · Pricing v4 ✓ · Annual-First ✓ · Unlimited AI €2.50 ✓ · DACH-Pilot ✓ · Free-Tier bleibt ✓ · Photo Enhancement ab Launch ✓

### Schritt-für-Schritt-Prinzip:
Alle Anleitungen für Lalo müssen nummerierte Schritte enthalten mit explizitem Hinweis WO die Aktion stattfindet (z.B. "Schritt 1 — in Replit: klicke auf..."). Lalo ist kein Terminal-Experte. Nie annehmen, dass ein Kommando oder eine UI bekannt ist.
=======
| Variable | Quelle | Zweck |
|----------|--------|-------|
| `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | Automatisch (Replit PostgreSQL) | DB-Verbindung |
| `GEMINI_API_KEY` | Manuell in Replit Secrets | Alle KI-Features |
| `INVITE_ENABLED` | `.env` / Replit Secrets | Invite-only gate (true/false) |
| `INVITE_TOKENS` | `.env` / Replit Secrets | Komma-getrennte gültige Invite-Tokens |
| `SENTRY_DSN_BACKEND` | Replit Secrets | Sentry Node.js error tracking |
| `VITE_SENTRY_DSN_FRONTEND` | Replit Secrets | Sentry React error tracking |

---

## Decision Log

### 2026-04-10 — `template` Column Migration (Replit only)

`restaurants.template` (`text`, default `"noir"`) wurde in `server/schema.ts` hinzugefügt.

**Die Migration kann nur auf Replit ausgeführt werden**, da `DATABASE_URL` lokal nicht verfügbar ist.

Nach jedem Deploy, der Schema-Änderungen enthält, im **Replit Shell** ausführen:

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

Niemals lokal ausführen — der Befehl schlägt still fehl oder trifft die falsche Datenbank.
>>>>>>> 39659bb (docs: add Decision Log + full env var table to CLAUDE.md)
