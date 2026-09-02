import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Bold,
  FileUp,
  Italic,
  List,
  ListOrdered,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  Save,
  Star,
  Strikethrough,
  Trash2,
  Underline,
  Users,
  X,
} from "lucide-react";
import {
  EMPTY_CONTENT,
  slugify,
  type ContentType,
  type ManagedContent,
} from "../lib/content";
import { authService, can, type AdminSession } from "../lib/authService";
import { contentRepository } from "../lib/contentRepository";
import { fileStorage } from "../lib/fileStorage";
import { sanitizeHtml } from "../lib/sanitize";
import AdminVisualEditor from "./AdminVisualEditor";
import AdminUsersPanel from "./AdminUsersPanel";
import AdminInquiriesPanel from "./AdminInquiriesPanel";
import {
  ADMIN_CONTENT_TYPES,
  CATEGORY_LABELS,
  SCIENCE_METADATA_FIELDS,
  getSeedRows,
} from "../features/admin/contentConfig";

export default function AdminPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    function applySession(next: AdminSession | null) {
      if (!active) return;
      setSession(next);
      setChecking(false);
    }
    void authService.getSession().then(applySession).catch(() => setChecking(false));
    const unsubscribe = authService.onChange(applySession);
    return () => { active = false; unsubscribe(); };
  }, []);

  if (checking) return <Centered text="Проверяем доступ..." />;
  if (!session) return <Login />;
  if (session.user.must_change_password) return <ChangePassword email={session.user.email} />;
  return <Dashboard user={session.user} />;
}

function Centered({
  text,
  children,
}: {
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded p-7 text-center">
        {children ?? <p>{text}</p>}
      </div>
    </main>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await authService.signIn(email, password);
    } catch {
      setError("Не удалось войти. Проверьте почту и пароль.");
    }
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-card border border-border rounded p-6"
      >
        <p className="text-xs font-bold uppercase text-accent mb-2">ИПИИ</p>
        <h1 className="text-xl font-bold text-primary mb-5">
          Вход в админ-панель
        </h1>
        <Field label="Электронная почта">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="admin-input"
          />
        </Field>
        <Field label="Пароль">
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="admin-input"
          />
        </Field>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button
          disabled={busy}
          className="w-full bg-primary text-primary-foreground rounded px-4 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Входим..." : "Войти"}
        </button>
      </form>
    </main>
  );
}

function ChangePassword({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) return setError("Новые пароли не совпадают.");
    setBusy(true);
    setError("");
    try {
      await authService.changePassword(currentPassword, newPassword);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить пароль");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-card border border-border rounded p-6">
        <p className="text-xs text-muted-foreground mb-1">{email}</p>
        <h1 className="text-xl font-bold text-primary mb-2">Установите собственный пароль</h1>
        <p className="text-sm text-muted-foreground mb-5">Временный пароль необходимо заменить перед началом работы.</p>
        <Field label="Текущий временный пароль"><input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="admin-input" /></Field>
        <Field label="Новый пароль (от 12 символов)"><input required minLength={12} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="admin-input" /></Field>
        <Field label="Повторите новый пароль"><input required minLength={12} type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="admin-input" /></Field>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button disabled={busy} className="w-full bg-primary text-primary-foreground rounded px-4 py-2.5 text-sm font-medium disabled:opacity-50">{busy ? "Сохраняем..." : "Изменить пароль"}</button>
        <button type="button" onClick={() => void authService.signOut()} className="w-full mt-2 text-sm text-muted-foreground py-2">Выйти</button>
      </form>
    </main>
  );
}

type DashboardSection = "visual" | "content" | "inquiries" | "users";

const roleLabels = {
  superadmin: "Главный администратор",
  admin: "Администратор",
  editor: "Редактор",
  viewer: "Наблюдатель",
} as const;

function Dashboard({ user }: { user: AdminSession["user"] }) {
  const canWrite = can(user.role, "content:write");
  const canDelete = can(user.role, "content:delete");
  const canManageUsers = can(user.role, "users:manage");
  const canReadInquiries = can(user.role, "inquiries:read");
  const canWriteInquiries = can(user.role, "inquiries:write");
  const canDeleteInquiries = can(user.role, "inquiries:delete");
  const [section, setSection] = useState<DashboardSection>(canWrite ? "visual" : "content");
  const [type, setType] = useState<ContentType>("news");
  const [items, setItems] = useState<ManagedContent[]>([]);
  const [editing, setEditing] = useState<ManagedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const label = useMemo(
    () => ADMIN_CONTENT_TYPES.find((entry) => entry.value === type)?.label,
    [type],
  );

  // Повторяет отбор слайдов в HeroSlider на главной: берутся отмеченные новости
  // по возрастанию порядка, а если отмеченных нет — три последние опубликованные.
  // Черновики на главную не попадают, поэтому в расчёт не идут.
  const sliderPositions = useMemo(() => {
    if (type !== "news") return new Map<string, number>();
    const published = items
      .filter((item) => item.status === "published")
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
    const featured = published
      .filter((item) => Boolean(item.metadata.featured))
      .sort((a, b) => (Number(a.metadata.featuredOrder) || 999) - (Number(b.metadata.featuredOrder) || 999));
    const slides = featured.length > 0 ? featured : published.slice(0, 3);
    return new Map(slides.map((item, index) => [item.id, index + 1]));
  }, [items, type]);

  const hasFeatured = useMemo(
    () => type === "news" && items.some((item) => item.status === "published" && Boolean(item.metadata.featured)),
    [items, type],
  );

  async function load() {
    setLoading(true);
    try {
      setItems(await contentRepository.list(type, false));
    } catch (reason) {
      alert(`Не удалось загрузить материалы: ${reason instanceof Error ? reason.message : "неизвестная ошибка"}`);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [type]);

  async function remove(item: ManagedContent) {
    if (!confirm(`Удалить «${item.title}»?`)) return;
    try {
      await contentRepository.remove(item.id);
      await load();
    } catch (reason) {
      alert(`Не удалось удалить материал: ${reason instanceof Error ? reason.message : "неизвестная ошибка"}`);
    }
  }

  async function importExisting() {
    setLoading(true);
    const rows = getSeedRows(type);
    if (rows.length > 0) {
      try {
        await contentRepository.upsert(rows);
      } catch (reason) {
        alert(`Импорт не выполнен: ${reason instanceof Error ? reason.message : "неизвестная ошибка"}`);
      }
    }
    await load();
  }

  return (
    <main
      className="min-h-screen bg-secondary"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-[1280px] mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <strong>Управление сайтом</strong>
            <span className="hidden sm:inline text-xs opacity-70 ml-3">
              {user.email} · {roleLabels[user.role]}
            </span>
          </div>
          <button
            onClick={() => void authService.signOut()}
            title="Выйти"
            className="p-2 rounded hover:bg-white/10"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <div className="max-w-[1280px] mx-auto p-4 lg:py-7 grid lg:grid-cols-[220px_1fr] gap-5">
        <nav
          className="bg-card border border-border rounded p-2 h-fit"
          aria-label="Типы материалов"
        >
          {canWrite && <button
            onClick={() => { setSection("visual"); setEditing(null); }}
            className={`w-full flex items-center gap-2 text-left px-3 py-2.5 rounded text-sm mb-2 ${section === "visual" ? "bg-accent text-accent-foreground" : "bg-secondary hover:bg-secondary/70"}`}
          >
            <LayoutDashboard size={16} /> Визуальный редактор
          </button>}
          <div className="h-px bg-border my-2" />
          {ADMIN_CONTENT_TYPES.map((entry) => (
            <button
              key={entry.value}
              onClick={() => {
                setSection("content");
                setType(entry.value);
                setEditing(null);
              }}
              className={`w-full text-left px-3 py-2.5 rounded text-sm ${section === "content" && type === entry.value ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              {entry.label}
            </button>
          ))}
          {canReadInquiries && <>
            <div className="h-px bg-border my-2" />
            <button onClick={() => { setSection("inquiries"); setEditing(null); }} className={`w-full flex items-center gap-2 text-left px-3 py-2.5 rounded text-sm ${section === "inquiries" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
              <MessageSquare size={16} /> Обращения
            </button>
          </>}
          {canManageUsers && <>
            <div className="h-px bg-border my-2" />
            <button onClick={() => { setSection("users"); setEditing(null); }} className={`w-full flex items-center gap-2 text-left px-3 py-2.5 rounded text-sm ${section === "users" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
              <Users size={16} /> Пользователи
            </button>
          </>}
        </nav>
        <section className="min-w-0">
          {section === "inquiries" && canReadInquiries ? (
            <AdminInquiriesPanel canWrite={canWriteInquiries} canDelete={canDeleteInquiries} />
          ) : section === "users" && canManageUsers ? (
            <AdminUsersPanel currentUserId={user.id} />
          ) : section === "visual" && canWrite ? (
            <AdminVisualEditor onManageNews={() => { setSection("content"); setType("news"); setEditing(null); }} />
          ) : editing ? (
            <Editor
              initial={editing}
              onCancel={() => setEditing(null)}
              onSaved={async () => {
                setEditing(null);
                await load();
              }}
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h1 className="text-xl font-bold text-primary">{label}</h1>
                  <p className="text-xs text-muted-foreground mt-1">
                    {items.length} материалов
                  </p>
                </div>
                {canWrite && <button
                  onClick={() =>
                    setEditing({
                      ...EMPTY_CONTENT,
                      type,
                    status: "published",
                    })
                  }
                  className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded text-sm"
                >
                  <Plus size={16} /> Добавить
                </button>}
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground py-10">
                  Загрузка...
                </p>
              ) : (
                <div className="bg-card border border-border rounded overflow-hidden">
                  {items.length === 0 && (
                    <div className="p-6 text-sm text-muted-foreground">
                      <p>Материалов в базе пока нет.</p>
                      {canWrite && <button
                        onClick={importExisting}
                        className="mt-3 border border-accent text-accent px-3 py-2 rounded text-sm hover:bg-secondary"
                      >
                        Импортировать текущие материалы сайта
                      </button>}
                    </div>
                  )}
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-4 border-b border-border last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(item.published_at).toLocaleDateString(
                            "ru-RU",
                          )}{" "}
                          ·{" "}
                          {item.status === "published"
                            ? "Опубликовано"
                            : "Черновик"}
                        </p>
                      </div>
                      {type === "news" && (
                        <SliderBadge
                          position={sliderPositions.get(item.id)}
                          featured={Boolean(item.metadata.featured)}
                          draft={item.status !== "published"}
                          automatic={!hasFeatured}
                        />
                      )}
                      {canWrite && <button
                        onClick={() => setEditing(item)}
                        title="Редактировать"
                        className="p-2 text-muted-foreground hover:text-accent"
                      >
                        <Pencil size={16} />
                      </button>}
                      {canDelete && <button
                        onClick={() => remove(item)}
                        title="Удалить"
                        className="p-2 text-muted-foreground hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function SliderBadge({
  position,
  featured,
  draft,
  automatic,
}: {
  position?: number;
  featured: boolean;
  draft: boolean;
  automatic: boolean;
}) {
  if (position) {
    return (
      <span
        title={
          automatic
            ? "Отмеченных новостей нет, поэтому слайдер заполняется тремя последними опубликованными"
            : "Новость отмечена для главного слайдера"
        }
        className="shrink-0 inline-flex items-center gap-1.5 rounded border border-accent/40 bg-accent/10 px-2 py-1 text-[11px] font-semibold text-accent"
      >
        <Star size={12} aria-hidden="true" />
        На слайдере №{position}
        {automatic && <span className="font-normal text-muted-foreground">авто</span>}
      </span>
    );
  }
  if (featured && draft) {
    return (
      <span
        title="Новость отмечена для слайдера, но остаётся черновиком и на главную не попадёт"
        className="shrink-0 inline-flex items-center gap-1.5 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700"
      >
        <Star size={12} aria-hidden="true" />
        Слайдер: нужна публикация
      </span>
    );
  }
  return null;
}

function Editor({
  initial,
  onCancel,
  onSaved,
}: {
  initial: ManagedContent;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const update = (key: keyof ManagedContent, value: unknown) =>
    setForm((current) => ({ ...current, [key]: value }));
  const updateMetadata = (key: string, value: unknown) =>
    setForm((current) => ({
      ...current,
      metadata: { ...current.metadata, [key]: value },
    }));

  async function upload(file: File, target: "image_url" | "file_url") {
    setBusy(true);
    setMessage("Загрузка файла...");
    try {
      update(target, await fileStorage.upload(form.type, file));
      setMessage("Файл загружен");
    } catch (reason) {
      setMessage(`Ошибка загрузки: ${reason instanceof Error ? reason.message : "неизвестная ошибка"}`);
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    let targetSlug = form.slug || slugify(form.title);
    if (!form.id) {
      if (await contentRepository.slugExists(targetSlug))
        targetSlug = `${targetSlug}-${Date.now().toString().slice(-6)}`;
    }
    if (!targetSlug) {
      setMessage("Укажите название или адрес страницы.");
      setBusy(false);
      return;
    }
    const payload: ManagedContent = {
      ...form,
      slug: targetSlug,
      summary: sanitizeHtml(form.summary),
      body: sanitizeHtml(form.body),
    };
    try {
      await contentRepository.save(payload);
    } catch (reason) {
      setMessage(`Не удалось сохранить: ${reason instanceof Error ? reason.message : "неизвестная ошибка"}`);
      setBusy(false);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={save} className="bg-card border border-border rounded p-5">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-primary">
          {form.id ? "Редактирование" : "Новый материал"}
        </h1>
        <button
          type="button"
          onClick={onCancel}
          title="Закрыть"
          className="p-2"
        >
          <X size={18} />
        </button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Название">
          <input
            required
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            className="admin-input"
          />
        </Field>
        <Field label="Адрес страницы (slug)">
          <input
            value={form.slug}
            onChange={(e) => update("slug", e.target.value)}
            placeholder="создастся автоматически"
            className="admin-input"
          />
        </Field>
        <Field label={CATEGORY_LABELS[form.type] ?? "Категория"}>
          <CategoryInput
            type={form.type}
            value={form.category}
            onChange={(value) => update("category", value)}
          />
        </Field>
        <Field label="Дата публикации">
          <input
            type="date"
            value={form.published_at.slice(0, 10)}
            onChange={(e) => update("published_at", e.target.value)}
            className="admin-input"
          />
        </Field>
        <Field label="Статус">
          <select
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
            className="admin-input"
          >
            <option value="draft">Черновик</option>
            <option value="published">Опубликовано</option>
          </select>
        </Field>
      </div>
      {form.type === "news" && (
        <div className="mb-4 flex flex-wrap items-center gap-5 rounded border border-border bg-secondary/50 px-4 py-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={Boolean(form.metadata.featured)}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  metadata: { ...current.metadata, featured: e.target.checked },
                }))
              }
              className="h-4 w-4 accent-[var(--primary)]"
            />{" "}
            Показывать в главном слайдере
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Порядок:</span>
            <input
              type="number"
              min="1"
              value={String(form.metadata.featuredOrder ?? "")}
              onChange={(e) => updateMetadata("featuredOrder", e.target.value)}
              className="admin-input w-20"
            />
          </label>
        </div>
      )}
      {form.type === "vacancy" && (
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Подразделение">
            <input
              value={String(form.metadata.department ?? "")}
              onChange={(e) => updateMetadata("department", e.target.value)}
              className="admin-input"
            />
          </Field>
          <Field label="Зарплата">
            <input
              value={String(form.metadata.salary ?? "")}
              onChange={(e) => updateMetadata("salary", e.target.value)}
              className="admin-input"
            />
          </Field>
          <Field label="Срок подачи">
            <input
              type="date"
              value={String(form.metadata.deadline ?? "")}
              onChange={(e) => updateMetadata("deadline", e.target.value)}
              className="admin-input"
            />
          </Field>
          <Field label="Тип">
            <select
              value={String(form.metadata.vacancyType ?? "contest")}
              onChange={(e) => updateMetadata("vacancyType", e.target.value)}
              className="admin-input"
            >
              <option value="contest">Конкурс</option>
              <option value="full">Полная занятость</option>
              <option value="part">Частичная занятость</option>
            </select>
          </Field>
        </div>
      )}
      {form.type === "document" && (
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Формат файла">
            <input
              value={String(form.metadata.ext ?? "PDF")}
              onChange={(e) =>
                updateMetadata("ext", e.target.value.toUpperCase())
              }
              className="admin-input"
            />
          </Field>
          <Field label="Размер файла">
            <input
              value={String(form.metadata.size ?? "")}
              onChange={(e) => updateMetadata("size", e.target.value)}
              placeholder="Например: 2,4 МБ"
              className="admin-input"
            />
          </Field>
        </div>
      )}
      <ScienceMetadataEditor
        type={form.type}
        metadata={form.metadata}
        onChange={updateMetadata}
      />
      <Field label="Краткое описание">
        <RichTextEditor
          value={form.summary}
          onChange={(value) => update("summary", value)}
          compact
        />
      </Field>
      <Field label="Основной текст">
        <RichTextEditor
          value={form.body}
          onChange={(value) => update("body", value)}
        />
      </Field>
      <div className="grid md:grid-cols-2 gap-4">
        <UploadField
          label="Изображение"
          value={form.image_url}
          accept="image/*"
          onUrl={(v) => update("image_url", v)}
          onFile={(f) => upload(f, "image_url")}
        />
        <UploadField
          label="Документ или вложение"
          value={form.file_url}
          onUrl={(v) => update("file_url", v)}
          onFile={(f) => upload(f, "file_url")}
        />
      </div>
      {message && (
        <p className="text-sm text-muted-foreground mt-3">{message}</p>
      )}
      <div className="flex gap-3 mt-5">
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          <Save size={16} /> Сохранить
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-border rounded text-sm"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

function ScienceMetadataEditor({
  type,
  metadata,
  onChange,
}: {
  type: ContentType;
  metadata: ManagedContent["metadata"];
  onChange: (key: string, value: unknown) => void;
}) {
  const fields = SCIENCE_METADATA_FIELDS[type];
  if (!fields?.length) return null;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {fields.map((field) => {
        const rawValue = metadata[field.key];
        const value = field.lines && Array.isArray(rawValue)
          ? rawValue.join("\n")
          : String(rawValue ?? "");
        const handleChange = (nextValue: string) => onChange(
          field.key,
          field.lines
            ? nextValue.split("\n").map((line) => line.trim()).filter(Boolean)
            : nextValue,
        );
        return (
          <Field key={field.key} label={field.label}>
            {field.kind === "textarea" ? (
              <textarea
                value={value}
                onChange={(event) => handleChange(event.target.value)}
                placeholder={field.placeholder}
                rows={field.lines ? 6 : 3}
                className="admin-input resize-y"
              />
            ) : (
              <input
                value={value}
                onChange={(event) => handleChange(event.target.value)}
                placeholder={field.placeholder}
                className="admin-input"
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="block min-w-0 border-0 p-0 m-0 mb-4">
      <legend className="block w-full text-xs font-semibold text-foreground mb-1.5">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}
function UploadField({
  label,
  value,
  accept,
  onUrl,
  onFile,
}: {
  label: string;
  value: string;
  accept?: string;
  onUrl: (v: string) => void;
  onFile: (f: File) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onUrl(e.target.value)}
          placeholder="Ссылка или загрузка файла"
          className="admin-input"
        />
        <label
          title="Загрузить"
          className="shrink-0 w-10 flex items-center justify-center border border-border rounded cursor-pointer hover:border-accent"
        >
          <FileUp size={17} />
          <input
            type="file"
            accept={accept}
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
      </div>
    </Field>
  );
}
function CategoryInput({
  type,
  value,
  onChange,
}: {
  type: ContentType;
  value: string;
  onChange: (value: string) => void;
}) {
  const options =
    type === "news"
      ? [
          ["institute", "Институт"],
          ["science", "Наука"],
          ["education", "Образование"],
          ["conference", "Конференции"],
        ]
      : type === "document"
        ? [
            ["charter", "Учредительные"],
            ["normative", "Нормативные"],
            ["report", "Отчёты"],
            ["anticorruption", "Антикоррупция"],
            ["privacy", "Обработка данных"],
          ]
        : null;
  if (!options)
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Произвольная категория"
        className="admin-input"
      />
    );
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="admin-input"
    >
      <option value="">Выберите категорию</option>
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}

function RichTextEditor({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const editingRef = useRef(false);

  useEffect(() => {
    if (
      editorRef.current &&
      !editingRef.current &&
      editorRef.current.innerHTML !== value
    ) {
      editorRef.current.innerHTML = sanitizeHtml(value);
    }
  }, [value]);

  function format(command: string) {
    editorRef.current?.focus();
    document.execCommand(command);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  const controls = [
    { command: "bold", label: "Жирный", Icon: Bold },
    { command: "italic", label: "Курсив", Icon: Italic },
    { command: "underline", label: "Подчеркнуть", Icon: Underline },
    { command: "strikeThrough", label: "Зачеркнуть", Icon: Strikethrough },
    {
      command: "insertUnorderedList",
      label: "Маркированный список",
      Icon: List,
    },
    {
      command: "insertOrderedList",
      label: "Нумерованный список",
      Icon: ListOrdered,
    },
  ];

  return (
    <div className="admin-editor">
      <div
        className="admin-editor-toolbar"
        role="toolbar"
        aria-label="Форматирование текста"
      >
        {controls.map(({ command, label, Icon }) => (
          <button
            key={command}
            type="button"
            title={label}
            aria-label={label}
            onMouseDown={(event) => {
              event.preventDefault();
              format(command);
            }}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        tabIndex={0}
        spellCheck
        onFocus={() => { editingRef.current = true; }}
        onBlur={(event) => {
          editingRef.current = false;
          const normalized = sanitizeHtml(event.currentTarget.innerHTML);
          if (event.currentTarget.innerHTML !== normalized) event.currentTarget.innerHTML = normalized;
          onChange(normalized);
        }}
        onInput={(event) => onChange(sanitizeHtml(event.currentTarget.innerHTML))}
        data-placeholder="Введите текст..."
        className={`admin-editor-content ${compact ? "min-h-[150px]" : "min-h-[320px]"}`}
      />
    </div>
  );
}
