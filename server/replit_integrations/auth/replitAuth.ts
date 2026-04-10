import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { eq } from "drizzle-orm";
import { authStorage } from "./storage";
import { db } from "../../db";
import { restaurants } from "../../schema";

// ── Session type augmentation ─────────────────────────────────────────────────
// Adds inviteToken to the typed session so the invite flow is type-safe.
declare module "express-session" {
  interface SessionData {
    inviteToken?: string;
  }
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // ── /api/login ──────────────────────────────────────────────────────────────
  // Captures ?invite=TOKEN from the link and stores it in the session
  // BEFORE the OIDC redirect so it survives the round-trip.
  //
  // Invite link format: dainmenu.com/api/login?invite=TOKEN
  app.get("/api/login", (req, res, next) => {
    const token = req.query.invite;
    if (typeof token === "string" && token.length > 0) {
      req.session.inviteToken = token;
    }
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  // ── /api/callback ───────────────────────────────────────────────────────────
  // Uses a custom callback so we can run the invite check between authentication
  // and the final redirect, without a separate middleware.
  //
  // Routing matrix after successful auth:
  //   INVITE_ENABLED=false          → /dashboard  (open signup, skip check)
  //   existing restaurant           → /dashboard  (returning user, never blocked)
  //   new user + valid invite token → /dashboard  (token consumed from session)
  //   new user + no / bad token     → /invite-only
  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);

    passport.authenticate(
      `replitauth:${req.hostname}`,
      async (err: Error | null, user: Express.User | false) => {
        if (err) return next(err);
        if (!user) return res.redirect("/api/login");

        req.login(user, async (loginErr) => {
          if (loginErr) return next(loginErr);

          // Skip invite check when INVITE_ENABLED is explicitly "false"
          const inviteEnabled = process.env.INVITE_ENABLED !== "false";
          if (!inviteEnabled) {
            return res.redirect("/dashboard");
          }

          const userId = (user as any)?.claims?.sub as string | undefined;
          if (!userId) return res.redirect("/invite-only");

          try {
            // Existing users (have a restaurant) are never blocked —
            // invite-only only applies to brand-new signups.
            const [existing] = await db
              .select({ id: restaurants.id })
              .from(restaurants)
              .where(eq(restaurants.userId, userId))
              .limit(1);

            if (existing) {
              return res.redirect("/dashboard");
            }

            // New user — validate the invite token stored in the session
            // before the OIDC redirect happened.
            const validTokens = (process.env.INVITE_TOKENS ?? "")
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);

            const sessionToken = req.session.inviteToken;

            if (
              validTokens.length > 0 &&
              sessionToken &&
              validTokens.includes(sessionToken)
            ) {
              // Token valid — clear it so it cannot be reused in this session
              delete req.session.inviteToken;
              return res.redirect("/dashboard");
            }

            // No restaurant + no valid token → invite-only wall
            return res.redirect("/invite-only");
          } catch (dbErr) {
            console.error("[auth/callback] DB error during invite check:", dbErr);
            return next(dbErr);
          }
        });
      }
    )(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
