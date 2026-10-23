import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOCK = 92548117;
export function runNode(args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let output = "", errors = "";
    child.stdout.on("data", (data) => { output = (output + data).slice(-200000); });
    child.stderr.on("data", (data) => { errors = (errors + data).slice(-5000); });
    const timeout = setTimeout(() => child.kill("SIGKILL"), 10 * 60_000);
    child.once("error", (error) => { clearTimeout(timeout); reject(error); });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(errors || `Процесс переноса завершился с кодом ${code}`));
      resolve(output);
    });
  });
}

/** Database lock covers all app instances; only insert mode is available to the scheduler. */
export async function createLegacyNewsSync({ pool, root, logger = console, enabled = true, intervalMs = 30 * 60_000, command = runNode, unrefTimers = true }) {
  await pool.query(`CREATE TABLE IF NOT EXISTS legacy_news_sync_state (
    id boolean PRIMARY KEY DEFAULT true CHECK (id), state jsonb NOT NULL DEFAULT '{}'::jsonb
  )`);
  let active = false, activeJob = null, timer, initialTimer, stopped = false;
  let nextRunAt = enabled ? new Date(Date.now() + 30_000).toISOString() : null;
  const save = (state) => pool.query(`INSERT INTO legacy_news_sync_state(id,state) VALUES(true,$1)
    ON CONFLICT(id) DO UPDATE SET state=EXCLUDED.state`, [state]);

  async function status() {
    const { rows } = await pool.query("SELECT state FROM legacy_news_sync_state WHERE id=true");
    return { ...rows[0]?.state, enabled, intervalMinutes: intervalMs / 60_000, nextRunAt, running: active || rows[0]?.state?.running === true };
  }
  async function start(trigger = "manual") {
    if (active || stopped) return { started: false };
    active = true;
    let client;
    try {
      client = await pool.connect();
      const lock = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [LOCK]);
      if (!lock.rows[0].locked) { client.release(); active = false; return { started: false }; }
    } catch (error) { client?.release(); active = false; throw error; }
    const startedAt = new Date().toISOString();
    try { await save({ running: true, trigger, startedAt }); }
    catch (error) { await client.query("SELECT pg_advisory_unlock($1)", [LOCK]); client.release(); active = false; throw error; }
    activeJob = (async () => {
      let work;
      try {
        work = await mkdtemp(join(tmpdir(), "ipi-legacy-news-"));
        const { rows } = await client.query("SELECT slug,metadata->>'legacyPage' AS \"legacyPage\" FROM content_items WHERE metadata->>'importedFrom'='guiaidn.ru'");
        const known = join(work, "known.json"); await writeFile(known, JSON.stringify(rows));
        const env = { ...process.env, LEGACY_NEWS_WORK_DIR: work, LEGACY_NEWS_KNOWN_PAGES: known };
        await command([join(root, "scripts/legacy-news/crawl.mjs"), "--current"], { cwd: root, env });
        const seedPath = join(work, "news-current.json");
        const seed = JSON.parse(await readFile(seedPath, "utf8"));
        const output = await command([join(root, "server/importLegacyNews.mjs"), seedPath], { cwd: root, env });
        const result = JSON.parse(output.trim().split("\n").at(-1));
        const pageFailures = seed.skipped.filter((s) => /не открылась|нет блока/.test(s.why));
        const alreadyKnown = new Set(seed.skipped.filter((s) => /уже перенесено/.test(s.why)).map((s) => s.page)).size;
        const state = { running: false, status: result.failed || pageFailures.length ? "warning" : "success", trigger, startedAt,
          finishedAt: new Date().toISOString(), inserted: result.inserted, kept: result.kept + alreadyKnown,
          found: seed.items.length, skipped: seed.skipped.length, failedAssets: result.failedAssets ?? [], pageFailures };
        await save(state); logger.info({ inserted: result.inserted, failed: result.failed }, "Legacy news synchronization finished");
      } catch (error) {
        await save({ running: false, status: "error", trigger, startedAt, finishedAt: new Date().toISOString(), error: error.message.slice(0, 2000) });
        logger.error(error, "Legacy news synchronization failed");
      } finally {
        try { if (work) await rm(work, { recursive: true, force: true }); }
        finally { try { await client.query("SELECT pg_advisory_unlock($1)", [LOCK]); } finally { client.release(); active = false; } }
      }
    })();
    activeJob.catch((error) => logger.error(error, "Could not persist synchronization result"));
    return { started: true };
  }
  function scheduled() {
    nextRunAt = new Date(Date.now() + intervalMs).toISOString();
    void start("schedule").catch((error) => logger.error(error));
  }
  if (enabled) {
    initialTimer = setTimeout(() => { scheduled(); timer = setInterval(scheduled, intervalMs); if (unrefTimers) timer.unref?.(); }, 30_000);
    if (unrefTimers) initialTimer.unref?.();
  }
  async function close() {
    stopped = true; clearTimeout(initialTimer); clearInterval(timer);
    if (activeJob) await activeJob;
  }
  return { start, status, close };
}
