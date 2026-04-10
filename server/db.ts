/**
 * Database connection.
 * Uses Replit's built-in PostgreSQL via DATABASE_URL.
 * Drizzle wraps the pg Pool for query building and type safety.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Ensure the Replit PostgreSQL database is provisioned.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool, { schema });
export { pool };
