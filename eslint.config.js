import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// ── Custom inline plugin ──────────────────────────────────────────────────────
//
// Rule: server route files must call toDb() before DB writes and toClient()
// before API responses, to prevent the silent camelCase/snake_case mapping
// bugs documented in CLAUDE.md §1.
//
// Applies only to files in server/ that:
//   1. Register Express routes (app.get/post/patch/put/delete)
//   2. AND perform DB writes (db.insert / db.update) or reads (db.select)
//
// Excluded: server/replit_integrations/** — auth storage layer,
//           uses authStorage not raw toDb/toClient helpers.
const localPlugin = {
  rules: {
    "require-route-mapping-helpers": {
      meta: {
        type: "suggestion",
        docs: {
          description:
            "Express route files must call toDb() on req.body before DB " +
            "writes and toClient() on DB rows before res.json() responses " +
            "(CLAUDE.md §1 — silent mapping bug prevention).",
        },
      },
      create(context) {
        const filename = context.filename;
        // Scope: server/ files only, excluding the auth integration layer
        if (
          !filename.includes("/server/") ||
          filename.includes("/replit_integrations/")
        ) {
          return {};
        }

        let hasExpressRoute = false;
        let hasDbWrite = false; // db.insert / db.update
        let hasDbRead = false;  // db.select
        let hasToDb = false;
        let hasToClient = false;

        return {
          CallExpression(node) {
            const { callee } = node;

            // Bare identifier calls: toDb(...) / toClient(...)
            if (callee.type === "Identifier") {
              if (callee.name === "toDb") hasToDb = true;
              if (callee.name === "toClient") hasToClient = true;
              return;
            }

            if (callee.type !== "MemberExpression") return;
            const prop = callee.property?.name;

            // Express route registration: app.get / app.post / …
            if (["get", "post", "put", "patch", "delete"].includes(prop)) {
              hasExpressRoute = true;
            }
            // DB mutations
            if (["insert", "update"].includes(prop)) hasDbWrite = true;
            // DB reads
            if (prop === "select") hasDbRead = true;
          },

          "Program:exit"(programNode) {
            if (!hasExpressRoute) return; // Not a route file — skip

            if (hasDbWrite && !hasToDb) {
              context.report({
                node: programNode,
                message:
                  "Route file calls db.insert/update but never calls toDb(). " +
                  "Wrap req.body with toDb() before DB writes to map " +
                  "camelCase → snake_case (CLAUDE.md §1).",
              });
            }

            if (hasDbRead && !hasToClient) {
              context.report({
                node: programNode,
                message:
                  "Route file calls db.select but never calls toClient(). " +
                  "Wrap DB rows with toClient() before res.json() to map " +
                  "snake_case → camelCase (CLAUDE.md §1).",
              });
            }
          },
        };
      },
    },
  },
};

export default tseslint.config(
  { ignores: ["dist"] },

  // ── All TS/TSX files ────────────────────────────────────────────────────────
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // ── Pragmatic suppressions for patterns used intentionally throughout ──
      //
      // no-unused-vars / @typescript-eslint/no-unused-vars:
      //   Many intentional underscore-prefixed params in callbacks.
      "@typescript-eslint/no-unused-vars": "off",
      //
      // @typescript-eslint/no-explicit-any:
      //   Express req/res generics, Passport user payloads, Drizzle insert
      //   overrides, and DnD kit event handlers all require `any` in practice.
      "@typescript-eslint/no-explicit-any": "off",
      //
      // @typescript-eslint/no-empty-object-type:
      //   shadcn/ui component variants extend base interfaces with no extra
      //   members — the empty interface is the intentional pattern they use.
      "@typescript-eslint/no-empty-object-type": "off",
      //
      // no-empty:
      //   Empty catch blocks in gemini.ts / MenuBuilder.tsx are intentional
      //   (swallow partial-parse errors without crashing the pipeline).
      "no-empty": "off",
      //
      // @typescript-eslint/no-require-imports:
      //   tailwind.config.ts uses require() for the typography plugin, which
      //   is the documented pattern for that plugin.
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // ── Server TS files — route-mapping guard ──────────────────────────────────
  {
    files: ["server/**/*.ts"],
    plugins: { local: localPlugin },
    rules: {
      "local/require-route-mapping-helpers": "warn",
    },
  },
);
