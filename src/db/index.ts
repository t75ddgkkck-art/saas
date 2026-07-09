import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDrizzle?: NodePgDatabase;
};

// Lazy initialisation : la connexion n'est créée qu'au premier accès réel
// (à l'exécution), jamais pendant le build. Cela évite l'erreur
// "DATABASE_URL is required" quand la variable n'est pas présente au build.
function getPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  if (!globalForDb.__arenaNextJsPostgresqlPool) {
    globalForDb.__arenaNextJsPostgresqlPool = new Pool({
      connectionString: databaseUrl,
    });
  }
  return globalForDb.__arenaNextJsPostgresqlPool;
}

function getDb(): NodePgDatabase {
  if (!globalForDb.__arenaNextJsDrizzle) {
    globalForDb.__arenaNextJsDrizzle = drizzle(getPool());
  }
  return globalForDb.__arenaNextJsDrizzle;
}

// Proxy : les méthodes de `db` ne déclenchent la connexion qu'à l'appel réel.
export const db = new Proxy({} as NodePgDatabase, {
  get(_target, prop) {
    const realDb = getDb();
    const value = (realDb as any)[prop];
    return typeof value === "function" ? value.bind(realDb) : value;
  },
});

export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const realPool = getPool();
    const value = (realPool as any)[prop];
    return typeof value === "function" ? value.bind(realPool) : value;
  },
});
