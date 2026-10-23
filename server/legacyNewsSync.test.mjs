import { describe, it, expect } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createLegacyNewsSync } from "./legacyNewsSync.mjs";
function database() {
  let state = {}, locked = false;
  const client = { release() {}, async query(sql) {
    if (sql.includes("pg_try_advisory_lock")) { const result = !locked; locked = true; return { rows: [{ locked: result }] }; }
    if (sql.includes("pg_advisory_unlock")) { locked = false; return { rows: [] }; }
    return { rows: [] };
  }};
  return { async connect() { return client; }, async query(sql, values) {
    if (sql.includes("INSERT INTO legacy_news_sync_state")) state = values[0];
    return { rows: [{ state }] };
  }};
}
const logger = { info() {}, error() {} };
describe("scheduled legacy news synchronization", () => {
  it("prevents concurrent runs, imports in insert mode and persists results", async () => {
    const pool = database(), calls = [];
    let finish; const gate = new Promise((resolve) => { finish = resolve; });
    const sync = await createLegacyNewsSync({ pool, root: process.cwd(), enabled: false, logger, command: async (args, { env }) => {
      calls.push(args);
      if (args.includes("--current")) {
        await gate;
        await writeFile(join(env.LEGACY_NEWS_WORK_DIR, "news-current.json"), JSON.stringify({ items: [{}], skipped: [] }));
        return "";
      }
      return JSON.stringify({ inserted: 1, kept: 0, failed: 0 });
    }});
    expect(await sync.start()).toEqual({ started: true });
    expect(await sync.start()).toEqual({ started: false });
    expect((await sync.status()).running).toBe(true);
    finish(); await sync.close();
    expect((await sync.status()).inserted).toBe(1);
    expect(calls.flat()).not.toContain("--update");
    expect((await sync.status()).running).toBe(false);
  });
  it("records failure and releases the database lock for a retry", async () => {
    const pool = database();
    const sync = await createLegacyNewsSync({ pool, root: process.cwd(), enabled: false, logger, command: async () => { throw new Error("Старый сайт недоступен"); } });
    await sync.start();
    // close waits for the failed run and its finally block.
    await sync.close();
    expect(await sync.status()).toMatchObject({ status: "error", running: false, error: "Старый сайт недоступен" });
    const again = await createLegacyNewsSync({ pool, root: process.cwd(), enabled: false, logger, command: async () => { throw new Error("offline"); } });
    expect(await again.start()).toEqual({ started: true }); await again.close();
  });
});
