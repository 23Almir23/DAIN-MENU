/**
 * Critical invariant: POST /api/restaurant must insert plan="starter" and credits=200.
 *
 * Context (CLAUDE.md §3 / menuai-product-decisions.md D02):
 *   The Drizzle schema defaults are plan="free" and credits=50.
 *   The route overrides those values on every insert.
 *   If the override is accidentally removed during a refactor, new users silently
 *   land on the wrong plan — no TypeScript error catches this.
 *
 * Strategy: inspect the route source for the specific db.insert().values() call that
 * creates a restaurant, and assert the override values are present. This is a
 * lightweight "code-contract" guard that catches the documented failure mode without
 * requiring a live database or HTTP server.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { describe, it, expect } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the routes source once for all assertions.
const routesSource = readFileSync(
  join(__dirname, "../../server/routes.ts"),
  "utf-8"
);

// Isolate the db.insert(restaurants).values({…}) call.
// The object is a single flat literal ({ ...parsed.data, plan: "…", credits: N }),
// so [^}]+ reliably captures everything up to the first closing brace.
const insertValuesSnippet = routesSource.match(
  /db\.insert\(restaurants\)\.values\(\{[^}]+\}/
)?.[0];

describe("POST /api/restaurant — plan/credits override invariant", () => {
  it("contains a db.insert(restaurants).values() call", () => {
    expect(
      insertValuesSnippet,
      "Could not locate db.insert(restaurants).values({…}) in server/routes.ts — " +
        "the route may have been restructured; verify the plan/credits override still exists."
    ).toBeTruthy();
  });

  it('sets plan="starter", NOT the schema default of "free"', () => {
    expect(insertValuesSnippet).toContain('plan: "starter"');
    expect(insertValuesSnippet).not.toContain('plan: "free"');
  });

  it("sets credits=200, NOT the schema default of 50", () => {
    expect(insertValuesSnippet).toContain("credits: 200");
    expect(insertValuesSnippet).not.toContain("credits: 50");
  });
});
