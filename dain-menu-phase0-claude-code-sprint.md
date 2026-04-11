# DAIN MENU — Phase 0: 3-Tage Launch-Sprint
> Für Claude Code · Eindeutig · Keine Interpretation nötig
> Jede Aufgabe hat: WAS · WO · WIE · ERFOLGSKRITERIUM
> Bei Unklarheit: STOPP und Lalo fragen. Nichts erfinden.

---

## Regeln für diesen Sprint

- **Drizzle ORM only** — kein Raw SQL
- **toDb() / toClient()** auf jeder Route
- **resolveTranslation()** immer mit baseLang — nie "en" hardcoden
- **Migration**: `npx drizzle-kit generate` → `npx drizzle-kit push` — nie `npm run db:push`
- **Stripe**: Key-unabhängig bauen. Server darf ohne `STRIPE_SECRET_KEY` nicht crashen.
- **plan**: Neuer Default ist `"free"` — nicht mehr `"starter"`
- **credits**: Spalte NICHT anfassen — wird separat migriert
- **Vor jeder Migration**: Schema zeigen, auf Bestätigung warten

---

## TAG 1 — P0-Blocker + Compliance

### T1-A: Vitest-Test für plan="free" Override
**Was:** Test der sicherstellt dass `POST /api/restaurant` `plan="free"` und `credits=200` setzt
**Wo:** `server/__tests__/restaurant.test.ts` (neu anlegen falls nicht vorhanden)
**Wie:**
```typescript
// Test muss prüfen:
// 1. POST /api/restaurant erstellt Restaurant mit plan="free"
// 2. POST /api/restaurant erstellt Restaurant mit credits=200
// 3. Schema-Default (falls Route-Override fehlt) würde "free"/50 setzen
```
**Erfolgskriterium:** `npx vitest run` grün ✅

---

### T1-B: POST /api/restaurant — plan auf "free" ändern
**Was:** Route-Override ändern von `plan="starter"` auf `plan="free"`
**Wo:** `server/routes.ts` — Funktion `POST /api/restaurant`
**Wie:** Nur diese eine Zeile ändern: `plan: "starter"` → `plan: "free"`
**credits=200** bleibt unverändert
**Erfolgskriterium:** Test T1-A grün. Kein anderer Test bricht.

---

### T1-C: AVV-Checkbox im Onboarding
**Was:** Rechtlich verpflichtende AVV-Akzeptanz vor Account-Erstellung
**Wo:** `src/components/setup/` — Step 1 (Name-Step oder erster sichtbarer Step)
**Wie:**
- Checkbox mit Text: "Ich akzeptiere die [Datenschutzerklärung](#) und [AGB/AVV](#)"
- Checkbox muss aktiviert sein bevor "Weiter" klickbar ist
- Button bleibt `disabled` solange Checkbox nicht aktiviert
- Keine Daten werden gespeichert bevor Checkbox aktiviert
- Links können vorerst auf `/datenschutz` und `/agb` zeigen (Seiten können leer sein)
**Erfolgskriterium:** Onboarding-Flow kann ohne Checkbox-Aktivierung nicht fortgesetzt werden

---

### T1-D: CJK/Arabic aus Landing-Marquee
**Was:** Chinesisch, Japanisch, Koreanisch, Arabisch aus Sprach-Marquee entfernen ODER mit "Beta"-Label versehen
**Wo:** `src/components/Landing.tsx` oder wo der Sprach-Marquee definiert ist
**Wie Option A (empfohlen):** Sprachen aus Marquee-Array entfernen: `zh`, `ja`, `ko`, `ar`
**Wie Option B:** Badge "Beta" neben den 4 Sprachen in der Anzeige
**Erfolgskriterium:** Landing Page zeigt keine nicht-validierten Sprachen ohne Kennzeichnung

---

### T1-E: Copilot → Kai umbenennen
**Was:** Alle UI-Texte "Copilot" durch "Kai" ersetzen
**Wo:** Alle `.tsx`-Dateien im `src/`-Verzeichnis
**Wie:** `grep -r "Copilot\|copilot" src/` ausführen, dann alle UI-Strings ersetzen
**NICHT ändern:** interne Variablennamen, Hook-Namen, API-Routes (nur UI-Text)
**Erfolgskriterium:** Kein sichtbarer "Copilot"-Text mehr im UI. Code-Variablen bleiben unverändert.

---

### T1-F: ESLint-Regel für toDb()/toClient()
**Was:** ESLint-Kommentar-Regel die warnt wenn eine Route kein toDb()/toClient() hat
**Wo:** `.eslintrc` oder `eslint.config.js` + `server/routes.ts`
**Wie:** Custom ESLint-Rule oder Kommentar-Konvention dokumentieren
**Minimalversion akzeptabel:** Kommentar `// @requires-toDb-toClient` über jede Route + ESLint no-warning-comments Regel
**Erfolgskriterium:** Dokumentiert und funktioniert — kein Build-Break

---

## TAG 2 — Stripe + Subscription-System

### Vor Tag 2: Sicherstellen
- `STRIPE_SECRET_KEY` ist in Replit Secrets als Platzhalter eingetragen: `sk_test_PLACEHOLDER`
- `STRIPE_WEBHOOK_SECRET` ist in Replit Secrets: `whsec_PLACEHOLDER`

---

### T2-A: Drizzle Schema — subscriptions Tabelle
**Was:** Neue Tabelle `subscriptions` anlegen
**Wo:** `db/schema.ts` (oder wo das Drizzle-Schema liegt)
**Schema exakt so:**
```typescript
export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  restaurantId: text("restaurant_id").references(() => restaurants.id),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan", { enum: ["free", "essential", "pro", "business"] })
    .notNull()
    .default("free"),
  billingPeriod: text("billing_period", { enum: ["monthly", "annual"] })
    .notNull()
    .default("annual"),
  status: text("status", {
    enum: ["active", "trialing", "past_due", "canceled"],
  })
    .notNull()
    .default("active"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```
**STOPP vor Migration:** Schema zeigen. Auf Bestätigung von Lalo warten.
**Migration ausführen:** `npx drizzle-kit generate` → `npx drizzle-kit push`
**Erfolgskriterium:** Migration ohne Fehler. Tabelle in DB sichtbar.

---

### T2-B: Stripe Client — server/stripe.ts
**Was:** Stripe-Client der ohne Key nicht crasht
**Wo:** `server/stripe.ts` (neu anlegen)
**Exakter Code:**
```typescript
import Stripe from "stripe";
import type { Response } from "express";

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-04-10",
    })
  : null;

export function requireStripe(res: Response): stripe is Stripe {
  if (!stripe) {
    res.status(503).json({
      error: "Billing not configured yet",
      message: "Stripe is not set up on this server",
    });
    return false;
  }
  return true;
}
```
**Erfolgskriterium:** Server startet ohne `STRIPE_SECRET_KEY` ohne Crash.

---

### T2-C: Plan-Gate Helper — server/lib/plan-gates.ts
**Was:** Tier-Vergleichslogik für Plan-Gates
**Wo:** `server/lib/plan-gates.ts` (neu anlegen)
**Exakter Code:**
```typescript
export type Plan = "free" | "essential" | "pro" | "business";

const TIER: Record<Plan, number> = {
  free: 0,
  essential: 1,
  pro: 2,
  business: 3,
};

export function getPlanTier(plan: Plan): number {
  return TIER[plan] ?? 0;
}

export function requiresPlan(restaurantPlan: Plan, requiredPlan: Plan): boolean {
  return getPlanTier(restaurantPlan) >= getPlanTier(requiredPlan);
}

// Convenience checks
export const isEssentialOrAbove = (plan: Plan) => requiresPlan(plan, "essential");
export const isProOrAbove = (plan: Plan) => requiresPlan(plan, "pro");
export const isBusinessOrAbove = (plan: Plan) => requiresPlan(plan, "business");
```
**Erfolgskriterium:** TypeScript kompiliert ohne Fehler.

---

### T2-D: Checkout Route — POST /api/billing/checkout
**Was:** Stripe Checkout Session erstellen
**Wo:** `server/routes.ts` — neue Route hinzufügen
**Wie:**
- `isAuthenticated` Middleware + owner-scoped
- Guard: `if (!requireStripe(res)) return;`
- Body: `{ plan: "essential"|"pro"|"business", period: "monthly"|"annual" }`
- `success_url`: `${process.env.APP_URL}/dashboard?upgraded=1`
- `cancel_url`: `${process.env.APP_URL}/pricing`
- Preise (hardcoded für jetzt, später aus DB/Config):

| Plan | Monthly | Annual |
|---|---|---|
| essential | 4400 (€44) | 34800 (€348) |
| pro | 8300 (€83) | 66000 (€660) |
| business | 13400 (€134) | 106800 (€1.068) |

- `toClient()` auf Response
- Gibt `{ url: string }` zurück
**Erfolgskriterium ohne Key:** Route gibt `503` zurück. Kein Crash.

---

### T2-E: Webhook Route — POST /api/billing/webhook
**Was:** Stripe Webhook Events verarbeiten
**Wo:** `server/routes.ts` — neue Route
**Wichtig:** Route muss `express.raw()` als Body-Parser nutzen (nicht `express.json()`)
**Events behandeln:**
- `checkout.session.completed` → subscription in DB anlegen/updaten
- `customer.subscription.updated` → plan, status, period_end updaten
- `customer.subscription.deleted` → status = "canceled"
**Alle DB-Writes:** `toDb()` verwenden
**Erfolgskriterium ohne Key:** Route gibt `503` zurück. Kein Crash.

---

### T2-F: npm install stripe
**Was:** Stripe npm package installieren
**Wo:** Terminal / Replit Shell
**Befehl:** `npm install stripe`
**Erfolgskriterium:** `package.json` enthält `"stripe"`. Kein TypeScript-Fehler.

---

## TAG 3 — Plan-Gates UI + Mobile + Gast-Features

### T3-A: Plan-Gates im Frontend
**Was:** Feature-Gates für Essential / Pro / Business implementieren
**Wo:** Relevante Komponenten in `src/`
**Gate-Tabelle:**

| Feature | Gate | Verhalten wenn gesperrt |
|---|---|---|
| Custom Theme | Essential+ | Kai spricht an, erklärt Upgrade |
| Photo Enhancement | Essential+ | Kai spricht an, erklärt Upgrade |
| Print PDF | Alle Tiers | Free: mit Dain-Badge |
| Dain-Badge entfernen | Alle Tiers | Branding-Option in Settings |
| Analytics | Pro+ | Kai spricht an (Phase 2) |
| WhatsApp | Business | Kai spricht an (Phase 2) |

**Kai-Upgrade-Text (Vorlage):**
```
"Dieses Feature ist ab [Tier] verfügbar. Ich führe dich durch den Upgrade-Prozess — 
du bist in wenigen Minuten dabei. Soll ich das jetzt für dich erledigen?"
```
**NICHT:** Anonymes Modal. **JA:** Kai spricht direkt.

---

### T3-B: Mobile Audit 375px
**Was:** Alle Dashboard-Seiten auf 375px Breite testen und reparieren
**Wo:** Alle Seiten in `src/pages/`
**Fokus:**
- Menu Builder: Item-Karten, Edit-Dialogs
- Dashboard: Stats, Kai-Panel
- AI Studio (solange noch vorhanden)
- Onboarding: alle 5 Steps
**Erfolgskriterium:** Kein horizontales Scrolling. Alle Buttons tippbar (min 44px).

---

### T3-C: Gast-Vorschau — Allergen-Icons
**Was:** Allergen-Icons direkt am Item in der Gast-Vorschau anzeigen
**Wo:** `src/pages/Guest.tsx` oder Gast-Preview-Komponente
**Wie:**
- Icons (Emoji oder SVG) für die 14 EU-Hauptallergene
- Nur anzeigen wenn Allergen am Item vorhanden
- Tooltip oder Label beim Hover/Tap
**Erfolgskriterium:** Allergene sichtbar in Gast-Vorschau wenn vorhanden.

---

### T3-D: Gast-Vorschau — Veg/Vegan-Filter
**Was:** Filter-Button in Gast-Vorschau für Vegetarisch / Vegan
**Wo:** `src/pages/Guest.tsx`
**Wie:**
- Toggle-Buttons: "Alle" | "Vegetarisch" | "Vegan"
- Filtert Items basierend auf vorhandenem Tag/Flag am Item
- State ist ephemer (kein DB-Speichern)
**Voraussetzung:** Items müssen ein `vegetarian` und `vegan` Boolean-Feld haben — prüfen ob vorhanden, sonst in Schema ergänzen (STOPP + Bestätigung)
**Erfolgskriterium:** Filter funktioniert in Gast-Vorschau.

---

### T3-E: Menu Builder — Bulk-Preis-Aktion
**Was:** Alle Preise um X% erhöhen / senken in einem Klick
**Wo:** `src/pages/MenuBuilder.tsx` — Toolbar oder Context-Menü
**Wie:**
- Button "Preise anpassen" → Dialog mit Eingabe: `+/- X%` oder `+/- €X`
- Vorschau der neuen Preise vor Bestätigung
- Bulk-Update via `PATCH /api/items/bulk-price` (neue Route)
- `toDb()` / `toClient()` auf Route
**Erfolgskriterium:** Alle Preise werden korrekt angepasst. Bestätigung required vor Ausführung.

---

### T3-F: Menu Builder — Duplikat-Funktion
**Was:** Item kopieren und direkt bearbeiten
**Wo:** `src/pages/MenuBuilder.tsx` — Item-Kontextmenü (3-Punkte-Menü)
**Wie:**
- "Duplizieren" Option im Item-Menü
- Kopiert alle Felder des Items (außer `id`)
- Neuer Name: `[Original-Name] (Kopie)`
- Öffnet direkt den Edit-Dialog für das kopierte Item
- `POST /api/items` mit kopierten Daten
**Erfolgskriterium:** Duplikat wird erstellt und Edit-Dialog öffnet sich.

---

### T3-G: /admin Route (Basis)
**Was:** Einfache Admin-Übersicht für Lalo
**Wo:** `server/routes.ts` (neue Route) + `src/pages/Admin.tsx` (neue Seite)
**Zugang:** Nur für spezifische User-ID (Lalos Replit-User-ID) — hardcoded für Pilot
**Anzeige:**
- User-Liste: E-Mail, Plan, credits, letzter Login, Erstellt-am
- Gesamt-Statistik: Total Users, Paid Users, MRR-Schätzung
**Erfolgskriterium:** `/admin` zeigt User-Liste. Unbefugte sehen 403.

---

## Phase 0 — Abschluss-Checkliste

Bevor Deploy: Alle Punkte müssen ✅ sein.

```
□ T1-A: Vitest grün — plan="free" Override getestet
□ T1-B: POST /api/restaurant → plan="free"
□ T1-C: AVV-Checkbox im Onboarding — Pflicht-Checkbox aktiv
□ T1-D: CJK/Arabic aus Marquee entfernt oder "Beta" gelabelt
□ T1-E: Alle UI-Texte "Copilot" → "Kai"
□ T1-F: ESLint-Regel dokumentiert
□ T2-A: subscriptions Tabelle migriert (nach Bestätigung)
□ T2-B: server/stripe.ts — startet ohne Key ohne Crash
□ T2-C: plan-gates.ts — TypeScript kompiliert
□ T2-D: POST /api/billing/checkout — gibt 503 ohne Key
□ T2-E: POST /api/billing/webhook — gibt 503 ohne Key
□ T2-F: stripe npm installiert
□ T3-A: Plan-Gates im Frontend mit Kai-Upgrade-Text
□ T3-B: Mobile 375px — kein horizontales Scrolling
□ T3-C: Allergen-Icons in Gast-Vorschau
□ T3-D: Veg/Vegan-Filter in Gast-Vorschau
□ T3-E: Bulk-Preis-Aktion im Menu Builder
□ T3-F: Duplikat-Funktion im Menu Builder
□ T3-G: /admin Route funktioniert für Lalos User-ID
□ TypeScript Build: 0 Fehler
□ Server startet: kein Crash
□ Sentry: kein unerwarteter Error auf /dashboard
```

---

## Was NICHT in Phase 0 gehört

- Keine Kassensysteme-Integration
- Keine Analytics-Dashboard
- Kein Multi-Karten-Feature (Mittag/Abend/Spezial)
- Kein Gäste-Referral-System
- Kein Social Media Integration
- Kein iFrame-Embedding
- Kein Kai Weekly-Email (Phase 2)
- Kein Kellner-Zugang (Phase 2)
- Keine Credit-Deprecation (separater Sprint)

---

## Reihenfolge für Claude Code

```
Tag 1: T1-A → T1-B → T1-C → T1-D → T1-E → T1-F
Tag 2: T2-F → T2-B → T2-C → T2-A (STOPP + Bestätigung) → T2-D → T2-E
Tag 3: T3-A → T3-B → T3-C → T3-D (STOPP wenn Schema-Änderung) → T3-E → T3-F → T3-G
```

**Bei jedem STOPP:** Claude Code schreibt was es gefunden hat und wartet auf Bestätigung von Lalo. Nie autonom weiter wenn unklar.
