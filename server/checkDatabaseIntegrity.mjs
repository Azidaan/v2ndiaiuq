import pg from "pg";
import { databaseConfigFromEnv } from "./database/config.mjs";

const pool = new pg.Pool({ ...databaseConfigFromEnv(process.env), max: 1 });

try {
  const checks = await pool.query(
    "SELECT check_name, violations FROM database_integrity_violations ORDER BY check_name",
  );
  const failures = checks.rows.filter((row) => Number(row.violations) > 0);
  const counts = await pool.query(
    `SELECT 'admin_users' entity, count(*)::int records FROM admin_users
     UNION ALL SELECT 'admin_sessions', count(*)::int FROM admin_sessions
     UNION ALL SELECT 'content_items', count(*)::int FROM content_items
     UNION ALL SELECT 'inquiries', count(*)::int FROM inquiries
     ORDER BY entity`,
  );
  console.log(JSON.stringify({ status: failures.length === 0 ? "ok" : "failed", entities: counts.rows, checks: checks.rows }, null, 2));
  if (failures.length > 0) process.exitCode = 1;
} finally {
  await pool.end();
}
