import Fastify from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { createLegacyAssetProxy } from "./legacyAssetProxy.mjs";
import { bootstrapContent } from "./bootstrapContent.mjs";
import bcrypt from "bcryptjs";
import pg from "pg";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, unlink } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { BcryptPasswordHasher } from "./auth/passwordHasher.mjs";
import { Permissions, RolePolicy, Roles } from "./auth/rolePolicy.mjs";
import { databaseConfigFromEnv } from "./database/config.mjs";
import { PgInquiryRepository } from "./inquiries/inquiryRepository.mjs";
import { InquiryService } from "./inquiries/inquiryService.mjs";
import { PgAdminUserRepository } from "./users/adminUserRepository.mjs";
import { AdminUserService } from "./users/adminUserService.mjs";
import { createLegacyNewsSync } from "./legacyNewsSync.mjs";

const { Pool } = pg;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === "production";
const cookieSecure = process.env.COOKIE_SECURE === "true";
const databaseConfig = databaseConfigFromEnv(process.env);
const uploadsRoot = resolve(process.env.UPLOAD_DIR || join(root, "uploads"));
const contentTypes = new Set([
  "news", "publication", "vacancy", "document", "visual_block",
  "research", "certificate", "department",
]);
const statuses = new Set(["draft", "published"]);
const allowedExtensions = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg", ".webp"]);
const cookieName = "ipi_admin_session";
const sessionDays = 7;
const loginWindows = new Map();
const inquiryWindows = new Map();

const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 2 * 1024 * 1024 });
const pool = new Pool({ ...databaseConfig, max: 10 });
const rolePolicy = new RolePolicy();
const passwordHasher = new BcryptPasswordHasher(bcrypt);
const userService = new AdminUserService({
  repository: new PgAdminUserRepository(pool),
  passwordHasher,
  rolePolicy,
});
const inquiryService = new InquiryService(new PgInquiryRepository(pool));
let legacyNewsSync;

await app.register(cookie);
await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024, files: 1 } });

app.addHook("onSend", async (_request, reply, payload) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return payload;
});

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function publicItem(row) {
  return { ...row, published_at: row.published_at?.toISOString?.() ?? row.published_at };
}

function contentPayload(body = {}) {
  if (!contentTypes.has(body.type)) throw Object.assign(new Error("Неизвестный тип материала"), { statusCode: 400 });
  if (!statuses.has(body.status)) throw Object.assign(new Error("Неизвестный статус"), { statusCode: 400 });
  const title = String(body.title ?? "").trim().slice(0, 500);
  const slug = String(body.slug ?? "").trim().slice(0, 500);
  if (!slug) throw Object.assign(new Error("Не заполнен адрес материала"), { statusCode: 400 });
  const publishedAt = new Date(body.published_at || Date.now());
  if (Number.isNaN(publishedAt.getTime())) throw Object.assign(new Error("Некорректная дата публикации"), { statusCode: 400 });
  const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {};
  return {
    type: body.type,
    title,
    slug,
    summary: String(body.summary ?? "").slice(0, 100_000),
    body: String(body.body ?? "").slice(0, 1_000_000),
    category: String(body.category ?? "").slice(0, 500),
    publishedAt: publishedAt.toISOString(),
    status: body.status,
    imageUrl: String(body.image_url ?? "").slice(0, 2_000),
    fileUrl: String(body.file_url ?? "").slice(0, 2_000),
    metadata,
  };
}

async function migrate() {
  await pool.query(await readFile(join(root, "server", "schema.sql"), "utf8"));
}

async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    app.log.warn("ADMIN_EMAIL/ADMIN_PASSWORD are not set; admin login is disabled");
    return;
  }
  if (password.length < 12) throw new Error("ADMIN_PASSWORD должен содержать не менее 12 символов");
  const existing = await pool.query("SELECT id FROM admin_users WHERE email = $1", [email]);
  if (existing.rowCount === 0) {
    const passwordHash = await passwordHasher.hash(password);
    await pool.query(
      "INSERT INTO admin_users (email, password_hash, role, must_change_password) VALUES ($1, $2, $3, false)",
      [email, passwordHash, Roles.SUPERADMIN],
    );
    app.log.info("Initial administrator created");
  }
}

async function requireAdmin(request, reply) {
  const token = request.cookies[cookieName];
  if (!token) return reply.code(401).send({ error: "Требуется вход в админ-панель" });
  const result = await pool.query(
    `SELECT u.id, u.email, u.role, u.must_change_password FROM admin_sessions s
     JOIN admin_users u ON u.id = s.admin_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active = true`,
    [hashToken(token)],
  );
  if (result.rowCount === 0) {
    reply.clearCookie(cookieName, { path: "/" });
    return reply.code(401).send({ error: "Сессия истекла" });
  }
  request.admin = result.rows[0];
}

function requirePermission(permission) {
  return async function permissionGuard(request, reply) {
    if (request.admin?.must_change_password) {
      return reply.code(403).send({ error: "Сначала измените временный пароль" });
    }
    if (!rolePolicy.can(request.admin?.role, permission)) {
      return reply.code(403).send({ error: "Недостаточно прав для этого действия" });
    }
  };
}

app.setErrorHandler((error, _request, reply) => {
  if (error.code === "23505") return reply.code(409).send({ error: "Материал с таким адресом уже существует" });
  if (error.statusCode && error.statusCode < 500) return reply.code(error.statusCode).send({ error: error.message });
  app.log.error(error);
  return reply.code(500).send({ error: "Внутренняя ошибка сервера" });
});

app.get("/api/health", async () => {
  await pool.query("SELECT 1");
  return { status: "ok" };
});

app.get("/api/admin/legacy-news-sync", { preHandler: [requireAdmin, requirePermission(Permissions.CONTENT_READ)] }, async () => legacyNewsSync.status());
app.post("/api/admin/legacy-news-sync", { preHandler: [requireAdmin, requirePermission(Permissions.CONTENT_WRITE)] }, async (_request, reply) => {
  const result = await legacyNewsSync.start("manual");
  return reply.code(result.started ? 202 : 409).send(result.started ? result : { error: "Перенос уже выполняется" });
});

app.get("/api/content", async (request) => {
  const type = request.query?.type;
  if (type && !contentTypes.has(type)) throw Object.assign(new Error("Неизвестный тип материала"), { statusCode: 400 });
  const result = type
    ? await pool.query("SELECT * FROM content_items WHERE status = 'published' AND type = $1 ORDER BY published_at DESC", [type])
    : await pool.query("SELECT * FROM content_items WHERE status = 'published' AND type <> 'visual_block' ORDER BY published_at DESC");
  return result.rows.map(publicItem);
});

app.post("/api/inquiries", async (request, reply) => {
  if (String(request.body?.website ?? "").trim()) {
    return reply.code(201).send({ ok: true });
  }
  const now = Date.now();
  if (inquiryWindows.size > 10_000) {
    for (const [ip, window] of inquiryWindows) if (window.resetAt <= now) inquiryWindows.delete(ip);
  }
  const previous = inquiryWindows.get(request.ip);
  const window = !previous || previous.resetAt <= now
    ? { count: 0, resetAt: now + 60 * 60_000 }
    : previous;
  window.count += 1;
  inquiryWindows.set(request.ip, window);
  if (window.count > 5) {
    reply.header("Retry-After", String(Math.ceil((window.resetAt - now) / 1000)));
    return reply.code(429).send({ error: "Слишком много обращений. Повторите отправку позже" });
  }
  await inquiryService.create(request.body ?? {});
  return reply.code(201).send({ ok: true });
});

app.post("/api/auth/login", async (request, reply) => {
  const now = Date.now();
  if (loginWindows.size > 10_000) {
    for (const [ip, window] of loginWindows) if (window.resetAt <= now) loginWindows.delete(ip);
  }
  const previous = loginWindows.get(request.ip);
  const attempts = !previous || previous.resetAt <= now ? { count: 0, resetAt: now + 15 * 60_000 } : previous;
  attempts.count += 1;
  loginWindows.set(request.ip, attempts);
  if (attempts.count > 10) {
    reply.header("Retry-After", String(Math.ceil((attempts.resetAt - now) / 1000)));
    return reply.code(429).send({ error: "Слишком много попыток входа. Повторите позже" });
  }
  const email = String(request.body?.email ?? "").trim().toLowerCase();
  const password = String(request.body?.password ?? "");
  const result = await pool.query(
    "SELECT id, email, password_hash, role, is_active, must_change_password FROM admin_users WHERE email = $1",
    [email],
  );
  const user = result.rows[0];
  if (!user || !user.is_active || !(await passwordHasher.verify(password, user.password_hash))) {
    return reply.code(401).send({ error: "Неверная почта или пароль" });
  }
  loginWindows.delete(request.ip);
  const token = randomBytes(32).toString("base64url");
  await pool.query("DELETE FROM admin_sessions WHERE expires_at <= now()");
  await pool.query(
    "INSERT INTO admin_sessions (admin_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)",
    [user.id, hashToken(token), String(sessionDays)],
  );
  reply.setCookie(cookieName, token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "strict",
    path: "/",
    maxAge: sessionDays * 24 * 60 * 60,
  });
  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      must_change_password: user.must_change_password,
    },
  };
});

app.get("/api/auth/session", { preHandler: requireAdmin }, async (request) => ({ user: request.admin }));

app.post("/api/auth/logout", async (request, reply) => {
  const token = request.cookies[cookieName];
  if (token) await pool.query("DELETE FROM admin_sessions WHERE token_hash = $1", [hashToken(token)]);
  reply.clearCookie(cookieName, { path: "/" });
  return { ok: true };
});

app.put("/api/auth/password", { preHandler: requireAdmin }, async (request) => {
  return userService.changeOwnPassword(
    request.admin.id,
    request.body?.current_password,
    request.body?.new_password,
    hashToken(request.cookies[cookieName]),
  );
});

app.get("/api/admin/content", { preHandler: [requireAdmin, requirePermission(Permissions.CONTENT_READ)] }, async (request) => {
  const type = request.query?.type;
  if (!contentTypes.has(type)) throw Object.assign(new Error("Неизвестный тип материала"), { statusCode: 400 });
  const result = await pool.query("SELECT * FROM content_items WHERE type = $1 ORDER BY published_at DESC", [type]);
  return result.rows.map(publicItem);
});

app.get("/api/admin/content/slug-exists", { preHandler: [requireAdmin, requirePermission(Permissions.CONTENT_WRITE)] }, async (request) => {
  const result = await pool.query("SELECT 1 FROM content_items WHERE slug = $1 LIMIT 1", [String(request.query?.slug ?? "")]);
  return { exists: result.rowCount > 0 };
});

app.post("/api/admin/content", { preHandler: [requireAdmin, requirePermission(Permissions.CONTENT_WRITE)] }, async (request, reply) => {
  const p = contentPayload(request.body);
  const result = await pool.query(
    `INSERT INTO content_items (type,title,slug,summary,body,category,published_at,status,image_url,file_url,metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [p.type,p.title,p.slug,p.summary,p.body,p.category,p.publishedAt,p.status,p.imageUrl,p.fileUrl,p.metadata],
  );
  return reply.code(201).send(publicItem(result.rows[0]));
});

app.put("/api/admin/content/:id", { preHandler: [requireAdmin, requirePermission(Permissions.CONTENT_WRITE)] }, async (request, reply) => {
  const p = contentPayload(request.body);
  const result = await pool.query(
    `UPDATE content_items SET type=$1,title=$2,slug=$3,summary=$4,body=$5,category=$6,published_at=$7,status=$8,image_url=$9,file_url=$10,metadata=$11,updated_at=now()
     WHERE id=$12 RETURNING *`,
    [p.type,p.title,p.slug,p.summary,p.body,p.category,p.publishedAt,p.status,p.imageUrl,p.fileUrl,p.metadata,request.params.id],
  );
  if (result.rowCount === 0) return reply.code(404).send({ error: "Материал не найден" });
  return publicItem(result.rows[0]);
});

app.patch("/api/admin/content/:id/review", { preHandler: [requireAdmin, requirePermission(Permissions.CONTENT_WRITE)] }, async (request, reply) => {
  if (typeof request.body?.reviewed !== "boolean") return reply.code(400).send({ error: "Укажите отметку проверки" });
  const result = await pool.query(`UPDATE content_items SET
    metadata = CASE WHEN $2 THEN jsonb_set(metadata, '{reviewed}', 'true'::jsonb) ELSE metadata - 'reviewed' END,
    updated_at=now() WHERE id=$1 AND type='news' AND metadata->>'importedFrom'='guiaidn.ru' RETURNING *`,
  [request.params.id, request.body.reviewed]);
  if (!result.rowCount) return reply.code(404).send({ error: "Перенесённая новость не найдена" });
  return publicItem(result.rows[0]);
});

app.post("/api/admin/content/upsert", { preHandler: [requireAdmin, requirePermission(Permissions.CONTENT_WRITE)] }, async (request) => {
  if (!Array.isArray(request.body) || request.body.length > 500) throw Object.assign(new Error("Некорректный пакет материалов"), { statusCode: 400 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const item of request.body) {
      const p = contentPayload(item);
      await client.query(
        `INSERT INTO content_items (type,title,slug,summary,body,category,published_at,status,image_url,file_url,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (slug) DO UPDATE SET type=EXCLUDED.type,title=EXCLUDED.title,summary=EXCLUDED.summary,body=EXCLUDED.body,category=EXCLUDED.category,published_at=EXCLUDED.published_at,status=EXCLUDED.status,image_url=EXCLUDED.image_url,file_url=EXCLUDED.file_url,metadata=EXCLUDED.metadata,updated_at=now()`,
        [p.type,p.title,p.slug,p.summary,p.body,p.category,p.publishedAt,p.status,p.imageUrl,p.fileUrl,p.metadata],
      );
    }
    await client.query("COMMIT");
    return { ok: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

app.delete("/api/admin/content/:id", { preHandler: [requireAdmin, requirePermission(Permissions.CONTENT_DELETE)] }, async (request, reply) => {
  const result = await pool.query("DELETE FROM content_items WHERE id = $1 RETURNING id", [request.params.id]);
  if (result.rowCount === 0) return reply.code(404).send({ error: "Материал не найден" });
  return { ok: true };
});

app.get("/api/admin/inquiries", { preHandler: [requireAdmin, requirePermission(Permissions.INQUIRIES_READ)] }, async (request) => {
  return inquiryService.list(request.query?.status);
});

app.patch("/api/admin/inquiries/:id", { preHandler: [requireAdmin, requirePermission(Permissions.INQUIRIES_WRITE)] }, async (request) => {
  return inquiryService.update(request.params.id, request.body ?? {});
});

app.delete("/api/admin/inquiries/:id", { preHandler: [requireAdmin, requirePermission(Permissions.INQUIRIES_DELETE)] }, async (request) => {
  return inquiryService.remove(request.params.id);
});

app.post("/api/admin/uploads", { preHandler: [requireAdmin, requirePermission(Permissions.CONTENT_WRITE)] }, async (request, reply) => {
  const part = await request.file();
  if (!part) return reply.code(400).send({ error: "Файл не передан" });
  const extension = extname(part.filename).toLowerCase();
  if (!allowedExtensions.has(extension)) return reply.code(415).send({ error: "Этот тип файла не поддерживается" });
  const folder = String(part.fields?.folder?.value ?? "content").replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "content";
  const directory = join(uploadsRoot, folder);
  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  const destination = join(directory, filename);
  await mkdir(directory, { recursive: true });
  try {
    await pipeline(part.file, createWriteStream(destination, { flags: "wx" }));
  } catch (error) {
    await unlink(destination).catch(() => undefined);
    throw error;
  }
  return reply.code(201).send({ url: `/uploads/${folder}/${filename}` });
});

const manageUsers = [requireAdmin, requirePermission(Permissions.USERS_MANAGE)];

app.get("/api/admin/users", { preHandler: manageUsers }, async () => userService.list());

app.post("/api/admin/users", { preHandler: manageUsers }, async (request, reply) => {
  return reply.code(201).send(await userService.create(request.body ?? {}));
});

app.put("/api/admin/users/:id", { preHandler: manageUsers }, async (request) => {
  return userService.update(request.params.id, request.body ?? {}, request.admin.id);
});

app.put("/api/admin/users/:id/password", { preHandler: manageUsers }, async (request) => {
  return userService.resetPassword(request.params.id, request.body?.password, request.admin.id);
});

app.delete("/api/admin/users/:id", { preHandler: manageUsers }, async (request) => {
  return userService.remove(request.params.id, request.admin.id);
});

await mkdir(uploadsRoot, { recursive: true });
await app.register(fastifyStatic, { root: uploadsRoot, prefix: "/uploads/", decorateReply: false });

// Бесплатный хостинг без постоянного диска: файлы перенесённых новостей подтягиваются
// со старого сайта по требованию (см. legacyAssetProxy.mjs).
const serveLegacyAsset = process.env.LEGACY_ASSET_PROXY === "true"
  ? await createLegacyAssetProxy({ seedsDir: join(root, "server", "seeds", "legacy-news"), uploadsRoot, logger: app.log })
  : null;

const dist = join(root, "dist");
if (isProduction && existsSync(dist)) {
  await app.register(fastifyStatic, { root: dist, prefix: "/" });
  app.setNotFoundHandler(async (request, reply) => {
    const url = request.raw.url ?? "/";
    if (serveLegacyAsset && url.startsWith("/uploads/legacy-news/") && (await serveLegacyAsset(request, reply))) return reply;
    if (url.startsWith("/api/")) return reply.code(404).send({ error: "Маршрут не найден" });
    // Отдавать index.html вместо отсутствующего файла нельзя: браузер получит
    // HTML вместо модуля и упадёт с невнятной ошибкой импорта вместо честного 404.
    // Так бывает у вкладки, открытой до пересборки: имена бандлов меняются.
    const path = url.split("?")[0];
    const isAsset = path.startsWith("/assets/") || path.startsWith("/uploads/");
    const looksLikeFile = /\.[a-z0-9]{2,5}$/i.test(path.split("/").pop() ?? "");
    if (isAsset || looksLikeFile) return reply.code(404).send({ error: "Файл не найден" });
    return reply.type("text/html").send(createReadStream(join(dist, "index.html")));
  });
}

await migrate();
await ensureAdmin();
await bootstrapContent({ pool, root, logger: app.log, enabled: process.env.BOOTSTRAP_CONTENT === "true" });
legacyNewsSync = await createLegacyNewsSync({ pool, root, logger: app.log, enabled: process.env.LEGACY_NEWS_SYNC_ENABLED !== "false" });
await app.listen({ host: "0.0.0.0", port });

async function shutdown(signal) {
  app.log.info({ signal }, "Shutting down");
  await app.close();
  await legacyNewsSync.close();
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
