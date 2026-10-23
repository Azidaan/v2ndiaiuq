/** One-shot command; --watch runs independently every 30 minutes with the same database lock. */
import pg from "pg";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLegacyNewsSync } from "./legacyNewsSync.mjs";
import { databaseConfigFromEnv } from "./database/config.mjs";
const watch = process.argv.includes("--watch");
const pool = new pg.Pool(databaseConfigFromEnv(process.env));
const sync = await createLegacyNewsSync({ pool, root: resolve(dirname(fileURLToPath(import.meta.url)), ".."), enabled: watch, unrefTimers: !watch });
await sync.start("command");
async function close() { await sync.close(); await pool.end(); }
if (watch) {
  process.once("SIGTERM", () => void close()); process.once("SIGINT", () => void close());
} else {
  await sync.close(); const status = await sync.status(); console.log(JSON.stringify(status)); await pool.end();
  if (status.status === "error") process.exitCode = 1;
}
