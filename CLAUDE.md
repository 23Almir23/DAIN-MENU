# CLAUDE.md — DAIN MENU · Operative Anleitung für Claude Code
> Version: April 2026 · Phase 0 Sprint aktiv
> Dieses File ist die primäre Autorität für Claude Code.
> Bei Konflikten mit anderen Dateien: CLAUDE.md gewinnt immer.

---

## 1. Produkt-Identität

**Produkt:** DAIN MENU — AI-getriebener Restaurantmanager
**Domain:** dainmenu.com
**Repo:** https://github.com/23Almir23/DAIN-MENU
**Status:** Pre-Pilot → Invite-only Launch in ~10 Tagen

**One-Liner:**
> "Ihre Speisekarte ändert sich ständig. Das Neuschreiben sollte es nicht."

---

## 2. Tech Stack

```
Frontend:   React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
Backend:    Express + PostgreSQL + Drizzle ORM
AI:         Gemini AI (Text + Vision)
Auth:       Replit OIDC (bleibt für Pilot)
Deploy:     Replit (jetzt) → Hetzner VPS (nach Pilot)
Payment:    Stripe (wird in Phase 0 gebaut)
Monitoring: Sentry
```

---

## 3. Kritische Regeln — NIEMALS brechen

```
1. Drizzle ORM only — kein Raw SQL, kein db.execute() für Schema-Änderungen
2. toDb() / toClient() auf JEDER Route — fehlt es, entsteht ein stiller Mapping-Bug
3. resolveTranslation() immer mit explizitem baseLang — nie "en" hardcoden
4. needsReview = true auf jedem AI-Output
5. /guest?r={restaurantId} ist permanent — nie ändern
6. Migration: npx drizzle-kit generate → npx drizzle-kit push — nie npm run db:push
7. 1 User = 1 Restaurant — kein Multi-Tenant, keine Invite-Links
8. Englisch ist NICHT die Default-Sprache — restaurant.baseLanguage ist die Quelle
9. Vor jeder DB-Migration: Schema zeigen, auf Bestätigung warten
10. Bei Unklarheit: STOPP und Lalo fragen — nie raten oder erfinden
```

---

## 4. Pricing-Modell v4 (FINAL)

| Tier | Annual/Mo | Jährlich | Monatlich |
|---|---|---|---|
| Free | — | — | — |
| Essential | €29 | €348/yr | €44/mo |
| Pro | €55 | €660/yr | €83/mo |
| Business | €89 | €1.068/yr | €134/mo |

**Billing:** Annual-First (Default). -38% vs. Monatlich.
**AI:** Unlimited — kein Credit-System (wird migriert, noch nicht gelöscht)

---

## 5. Plan-Gates (was tatsächlich im Code erzwungen wird)

| Feature | Gate | Aktuell implementiert |
|---|---|---|
| Custom Theme | Essential+ | ✅ (war: Free-Gate — jetzt Essential+) |
| Photo Enhancement | Essential+ | ❌ Phase 0 Tag 3 |
| Print PDF | Alle, Badge bei Free | ❌ Phase 0 Tag 3 |
| Dain-Badge entfernen | Alle Tiers (Branding-Option) | ❌ Phase 0 Tag 3 |
| Analytics | Pro+ | ❌ Phase 2 |
| WhatsApp | Business | ❌ Phase 2 |

**Kai übernimmt Upgrade-Kommunikation** — kein anonymes Modal.
Kai-Text Vorlage: *"Dieses Feature ist ab [Tier] verfügbar. Ich führe dich durch den Upgrade-Prozess."*

---

## 6. Schema-Defaults vs. Route-Override

| Feld | Schema-Default | Route-Override (POST /api/restaurant) |
|---|---|---|
| plan | "free" | "free" ✅ (war: "starter" — wurde geändert) |
| credits | 50 | 200 (bleibt bis Credit-Migration) |

**credits-Spalte:** NICHT löschen. NICHT anfassen. Wird separat migriert.

---

## 7. Kai — Das AI-Brain

Kai ist nicht ein Feature — Kai ist DAIN MENU.
- Verfügbar für **alle Tiers** — kein Gate
- Übernimmt alle Upgrade-Kommunikation
- Übernimmt Retention bei past_due / Ablauf
- Zeigt beim Login sofort 1 konkreten Tipp
- Erinnert proaktiv: "X Items ohne Übersetzung"
- Sendet wöchentliche E-Mail Top-3-Tipps (Phase 2)
- Ersetzt AI Studio langfristig (Phase 2 — noch nicht implementiert)

**UI-Name:** Kai (nicht "Copilot" — alle UI-Strings wurden geändert)
**Code-Variablen:** interne Namen (copilot*) bleiben bis Refactor

---

## 8. Multilingual-Regeln

```typescript
// IMMER so aufrufen:
resolveTranslation(original, translations, langCode, restaurant.baseLanguage)

// NIE so:
resolveTranslation(original, translations, langCode) // kein Default!
resolveTranslation(original, translations, langCode, "en") // hardcoded verboten!
```

Guest-Sprach-Switcher: datengetrieben durch item_translations — nicht durch supported_languages.
supported_languages = Operator-Intent. item_translations = echte Abdeckung.

---

## 9. Route-Regeln

**Alle authentifizierten Routen:** isAuthenticated + userId owner-scoping

**Öffentliche Ausnahmen:**
- GET /api/health
- GET /api/guest
- GET /api/login, GET /api/callback, GET /api/logout
- Frontend: /, /pricing, /guest

**Jede neue Route muss:**
1. isAuthenticated (außer öffentliche Ausnahmen)
2. toDb() auf alle eingehenden Daten
3. toClient() auf alle ausgehenden Daten
4. Owner-Scoping via req.user.claims.sub

---

## 10. Stripe-Regeln (Phase 0)

```typescript
// server/stripe.ts — Server darf ohne Key nicht crashen
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" })
  : null;

// Alle Stripe-Routen mit Guard:
if (!requireStripe(res)) return; // gibt 503 zurück, kein Crash
```

**Env-Variablen (Replit Secrets):**
- STRIPE_SECRET_KEY (Testmodus: sk_test_...)
- STRIPE_WEBHOOK_SECRET (whsec_...)
- APP_URL (für success/cancel URLs)

**Webhook-Route:** Muss express.raw() als Body-Parser nutzen — nicht express.json()

---

## 11. Compliance

**AVV-Checkbox:** Im Onboarding Step 1 implementiert (Phase 0 T1-C)
- Pflicht-Checkbox vor Account-Erstellung
- Button disabled bis Checkbox aktiviert
- Links: /datenschutz und /agb

**DSGVO:** Kein Gäste-Tracking im QR-Code. Keine Gästedaten speichern.
**Allergene:** EU-Pflicht — im Produkt als Feature, nicht als optional

---

## 12. Aktueller Sprint — Phase 0

**Vollständiger Plan:** `dain-menu-phase0-claude-code-sprint.md`

**Kurzübersicht:**

### Tag 1 — P0-Blocker
- T1-A: Vitest-Test plan="free"
- T1-B: POST /api/restaurant → plan="free"
- T1-C: AVV-Checkbox im Onboarding
- T1-D: CJK/Arabic aus Marquee → "Beta"
- T1-E: UI "Copilot" → "Kai"
- T1-F: ESLint-Regel toDb()/toClient()

### Tag 2 — Stripe
- T2-A: subscriptions Tabelle (STOPP vor Migration)
- T2-B: server/stripe.ts (Key-unabhängig)
- T2-C: plan-gates.ts
- T2-D: POST /api/billing/checkout
- T2-E: POST /api/billing/webhook
- T2-F: npm install stripe

### Tag 3 — UI + Gates + Features
- T3-A: Plan-Gates im Frontend mit Kai-Text
- T3-B: Mobile Audit 375px
- T3-C: Allergen-Icons in Gast-Vorschau
- T3-D: Veg/Vegan-Filter (STOPP wenn Schema-Änderung nötig)
- T3-E: Bulk-Preis-Aktion im Menu Builder
- T3-F: Duplikat-Funktion im Menu Builder
- T3-G: /admin Route für Lalo

---

## 13. Was NICHT in Phase 0 gehört

```
❌ Kassensysteme-Integration
❌ Analytics-Dashboard für User
❌ Multi-Karten (Mittag/Abend/Spezial)
❌ Gäste-Referral-System
❌ iFrame-Embedding
❌ Kai Weekly-Email
❌ Kellner-Zugang
❌ Credit-Deprecation
❌ AI Studio → Kai Migration
❌ Sprachgrenzen-Gate (noch nicht definiert)
```

---

## 14. Was NIE vorgeschlagen werden soll

```
❌ Stack wechseln
❌ Credits / Overage-System (ersetzt durch Unlimited AI)
❌ Renaming — es ist DAIN MENU, Domain dainmenu.com
❌ Multi-Tenant vor Phase 3
❌ invite-link Logik
❌ restaurant_members Tabelle
❌ credit_transactions Tabelle (nicht nötig)
❌ Irgendwas als "quick fix" ohne toDb()/toClient()
```

---

## 15. Dateien-Referenz

| Datei | Inhalt |
|---|---|
| CLAUDE.md | Diese Datei — operative Anleitung |
| menuai-current-state.md | Technischer Ist-Stand |
| menuai-product-decisions.md | Architektur-Entscheidungslog |
| dain-menu-phase0-claude-code-sprint.md | Detaillierter Sprint-Plan Phase 0 |
| dain-menu-roadmap-finanzplan-v4-1.md | Roadmap + Finanzplan v4.1 |
| dain-menu-product-vision-gtm.md | Product Vision + GTM |

---

## 16. Bei Unklarheit

1. **STOPP**
2. Schreibe was du gefunden hast
3. Stelle eine konkrete Frage an Lalo
4. Warte auf Antwort
5. Nie raten, nie erfinden, nie "wahrscheinlich gemeint"

---

*April 2026 · Phase 0 aktiv · Alle Entscheidungen final*
