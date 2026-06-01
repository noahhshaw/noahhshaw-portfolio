import { neon } from "@neondatabase/serverless";
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _db: NeonHttpDatabase<typeof schema> | null = null;
let _shopLensDb: NeonHttpDatabase<typeof schema> | null = null;

export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL;
}

export function getShopLensDatabaseUrl(): string | undefined {
  return process.env.SHOP_LENS_DATABASE_URL || process.env.DATABASE_URL;
}

function makeDb(databaseUrl: string): NeonHttpDatabase<typeof schema> {
  const sql = neon(databaseUrl, {
    fetchOptions: { cache: "no-store" },
  });
  return drizzle(sql, { schema });
}

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!_db) {
    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) {
      throw new Error("No database connection string was provided.");
    }
    _db = makeDb(databaseUrl);
  }
  return _db;
}

export function getShopLensDb(): NeonHttpDatabase<typeof schema> {
  if (!_shopLensDb) {
    const databaseUrl = getShopLensDatabaseUrl();
    if (!databaseUrl) {
      throw new Error("No Shop Lens database connection string was provided.");
    }
    _shopLensDb = makeDb(databaseUrl);
  }
  return _shopLensDb;
}

// Proxy that lazily initializes the DB on first use,
// avoiding errors during Next.js build when DATABASE_URL is absent.
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const realDb = getDb();
    const value = Reflect.get(realDb, prop, receiver);
    if (typeof value === "function") {
      return value.bind(realDb);
    }
    return value;
  },
});

export const shopLensDb = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const realDb = getShopLensDb();
    const value = Reflect.get(realDb, prop, receiver);
    if (typeof value === "function") {
      return value.bind(realDb);
    }
    return value;
  },
});
