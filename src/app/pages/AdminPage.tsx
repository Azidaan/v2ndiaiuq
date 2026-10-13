import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Bold,
  Crop,
  ExternalLink,
  FileUp,
  History,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  RotateCcw,
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
  type ContentMetadata,
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
import ImageFocusPicker from "../components/ui/ImageFocusPicker";
import InlineImageCropper from "../components/ui/InlineImageCropper";
import { parseFocus } from "../components/ui/SafeImage";

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
  // Перенесённые со старого сайта новости, которые ещё никто не проверил.
  const [onlyReview, setOnlyReview] = useState(false);
  const reviewCount = useMemo(() => items.filter(needsReview).length, [items]);
  const visibleItems = useMemo(() => (onlyReview ? items.filter(needsReview) : items), [items, onlyReview]);
  // После закрытия редактора список возвращается к той же прокрутке, а не в начало.
  const listScroll = useRef<number | null>(null);
  const openEditor = (item: ManagedContent) => { listScroll.current = window.scrollY; setEditing(item); };
  useEffect(() => {
    if (editing || loading || listScroll.current === null) return;
    const y = listScroll.current;
    listScroll.current = null;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, [editing, loading]);

  /** Отметка «Проверено» прямо из списка, без открытия редактора. */
  async function setReviewed(item: ManagedContent, reviewed: boolean) {
    const { reviewed: _old, ...rest } = item.metadata;
    const next = { ...item, metadata: reviewed ? { ...rest, reviewed: true } : rest };
    setItems((current) => current.map((entry) => (entry.id === item.id ? next : entry)));
    try {
      await contentRepository.save(next);
    } catch (reason) {
      setItems((current) => current.map((entry) => (entry.id === item.id ? item : entry)));
      alert(`Не удалось сохранить отметку: ${reason instanceof Error ? reason.message : "неизвестная ошибка"}`);
    }
  }
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
    setOnlyReview(false);
    void load();
  }, [type]);
  // Проверили последнюю — фильтр больше не нужен.
  useEffect(() => { if (reviewCount === 0) setOnlyReview(false); }, [reviewCount]);

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
            <AdminVisualEditor
              onManageNews={() => { setSection("content"); setType("news"); setEditing(null); }}
              onManageDocuments={() => { setSection("content"); setType("document"); setEditing(null); }}
            />
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
                  {reviewCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setOnlyReview((value) => !value)}
                      aria-pressed={onlyReview}
                      className={`mt-2 inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-semibold ${onlyReview ? "border-amber-500 bg-amber-100 text-amber-800" : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
                    >
                      <History size={12} aria-hidden="true" />
                      {onlyReview ? "Показать все" : `Требуют проверки: ${reviewCount}`}
                    </button>
                  )}
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
                  {visibleItems.map((item) => (
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
                          <LegacyMarks metadata={item.metadata} />
                        </p>
                      </div>
                      {item.metadata.importedFrom === "guiaidn.ru" && (
                        <label
                          title="Текст, картинки и дата перенесённой новости проверены"
                          className={`shrink-0 inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-semibold ${item.metadata.reviewed ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}`}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(item.metadata.reviewed)}
                            disabled={!canWrite}
                            onChange={(e) => void setReviewed(item, e.target.checked)}
                            className="h-3.5 w-3.5 accent-[var(--primary)]"
                          />
                          {item.metadata.reviewed ? "Проверено" : "Проверить"}
                        </label>
                      )}
                      {type === "news" && (
                        <SliderBadge
                          position={sliderPositions.get(item.id)}
                          featured={Boolean(item.metadata.featured)}
                          draft={item.status !== "published"}
                          automatic={!hasFeatured}
                        />
                      )}
                      {canWrite && <button
                        onClick={() => openEditor(item)}
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

/** Перенесена со старого сайта и ещё не отмечена как проверенная. */
const needsReview = (item: ManagedContent) => item.metadata.importedFrom === "guiaidn.ru" && !item.metadata.reviewed;

/** Пометки у новостей, перенесённых со старого сайта guiaidn.ru. */
function LegacyMarks({ metadata }: { metadata: ContentMetadata }) {
  if (metadata.importedFrom !== "guiaidn.ru") return null;
  return (
    <>
      {" "}· <span title="Перенесено со старого сайта guiaidn.ru">со старого сайта</span>
      {Boolean(metadata.dateApprox) && (
        <span title="Точной даты на старом сайте не было — стоит первое число месяца из адреса страницы">
          {" "}· дата приблизительная
        </span>
      )}
    </>
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
      {form.metadata.importedFrom === "guiaidn.ru" && (
        <div className={`mb-4 rounded border px-4 py-3 text-sm ${form.metadata.reviewed ? "border-border bg-secondary/50" : "border-amber-300 bg-amber-50"}`}>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <History size={15} aria-hidden="true" className="text-muted-foreground" />
            Перенесено со старого сайта.
            {typeof form.metadata.sourceUrl === "string" && (
              <a href={form.metadata.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent underline">
                Открыть оригинал <ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
            {form.id && form.slug && (
              <a href={`/news/${form.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent underline">
                Открыть на новом сайте <ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
          </p>
          {Boolean(form.metadata.dateApprox) && (
            <p className="mt-1 text-xs text-amber-800">
              Точной даты на старом сайте не было: стоит первое число месяца из адреса страницы. Уточните дату — пометка снимется.
            </p>
          )}
          <label className="mt-2 flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={Boolean(form.metadata.reviewed)}
              onChange={(e) => {
                const checked = e.target.checked;
                setForm((current) => {
                  const { reviewed: _reviewed, ...metadata } = current.metadata;
                  return { ...current, metadata: checked ? { ...metadata, reviewed: true } : metadata };
                });
              }}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Проверено: текст, картинки и дата в порядке
          </label>
        </div>
      )}
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
            onChange={(e) =>
              setForm((current) => {
                // Дату поправили вручную — пометка «приблизительная» больше не нужна.
                const { dateApprox: _approx, ...metadata } = current.metadata;
                return { ...current, published_at: e.target.value, metadata };
              })
            }
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
              placeholder="Определится при загрузке файла"
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
          label="Изображение новости"
          value={form.image_url}
          accept="image/*"
          onUrl={(v) => update("image_url", v)}
          onFile={(f) => upload(f, "image_url")}
        />
        <AttachmentsField
          items={parseAttachments(form.metadata.attachments, form.file_url)}
          onChange={(items) => {
            const first = items[0];
            setForm((current) => {
              const metadata: ContentMetadata = { ...current.metadata, attachments: items };
              // Размер и формат берём из самого файла: вручную их набирали с
              // ошибками, а браузер знает точные значения при загрузке.
              if (current.type === "document" && first?.size) {
                metadata.size = formatFileSize(first.size);
                const source = first.name || first.url;
                const extension = (source.split(".").pop() ?? "").toUpperCase();
                if (extension && extension !== source.toUpperCase()) metadata.ext = extension;
              }
              // Первое вложение дублируем в file_url: на нём держатся страницы
              // документов и свидетельств, которые про список ничего не знают.
              return { ...current, metadata, file_url: first?.url ?? "" };
            });
          }}
        />
      </div>
      {form.image_url && (
        <ImageFocusPicker
          src={form.image_url}
          focus={parseFocus(form.metadata.focus)}
          onChange={(focus) => updateMetadata("focus", focus)}
        />
      )}
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
/** Размер файла в привычном виде: 340 КБ, 1,4 МБ. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded).replace(".", ",")} ${units[unit]}`;
}

/** Вложения материала. Хранятся в metadata.attachments, первое дублируется в file_url. */
type Attachment = { url: string; name: string; size?: number };

function parseAttachments(raw: unknown, legacyUrl: string): Attachment[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
      .map((entry) => ({
        url: String(entry.url ?? ""),
        name: String(entry.name ?? ""),
        size: typeof entry.size === "number" ? entry.size : undefined,
      }))
      .filter((entry) => entry.url);
  }
  // Материал сохранён до появления списка: показываем единственный старый файл.
  return legacyUrl ? [{ url: legacyUrl, name: legacyUrl.split("/").pop() ?? legacyUrl }] : [];
}

function AttachmentsField({
  items,
  onChange,
}: {
  items: Attachment[];
  onChange: (items: Attachment[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Материалы, сохранённые до появления списка, знают только адрес файла.
  // Размер спрашиваем у сервера, иначе поле «Размер файла» останется прежним.
  const probedRef = useRef(new Set<string>());

  useEffect(() => {
    const pending = items.filter((item) => item.url && item.size === undefined && !probedRef.current.has(item.url));
    if (pending.length === 0) return;
    let cancelled = false;
    void (async () => {
      const sizes = new Map<string, number>();
      for (const item of pending) {
        probedRef.current.add(item.url);
        try {
          const response = await fetch(item.url, { method: "HEAD" });
          const length = Number(response.headers.get("content-length"));
          if (response.ok && Number.isFinite(length) && length > 0) sizes.set(item.url, length);
        } catch {
          // Размер останется неизвестным: поле можно заполнить вручную.
        }
      }
      if (cancelled || sizes.size === 0) return;
      onChange(items.map((item) => (sizes.has(item.url) ? { ...item, size: sizes.get(item.url) } : item)));
    })();
    return () => { cancelled = true; };
  }, [items, onChange]);

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setError("");
    const added: Attachment[] = [];
    try {
      for (const file of files) {
        const url = await fileStorage.upload("attachments", file);
        added.push({ url, name: file.name, size: file.size });
      }
      onChange([...items, ...added]);
    } catch (reason) {
      if (added.length > 0) onChange([...items, ...added]);
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить часть файлов");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label="Документы и вложения">
      <div className="rounded border border-border bg-card">
        {items.length > 0 && (
          <ul className="max-h-[168px] divide-y divide-border overflow-y-auto">
            {items.map((item, index) => (
              <li key={`${item.url}-${index}`} className="flex items-center gap-2 px-3 py-2">
                <FileUp size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-xs text-foreground hover:text-accent"
                  title={item.name || item.url}
                >
                  {item.name || item.url}
                </a>
                {item.size ? (
                  <span className="shrink-0 text-[10px] text-muted-foreground">{formatFileSize(item.size)}</span>
                ) : null}
                <button
                  type="button"
                  title="Убрать"
                  onClick={() => onChange(items.filter((_, position) => position !== index))}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-red-600"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="flex cursor-pointer items-center justify-center gap-2 border-t border-border px-3 py-2.5 text-xs text-accent hover:bg-secondary first:border-t-0">
          <Plus size={14} aria-hidden="true" />
          {busy ? "Загружаем..." : items.length > 0 ? "Добавить ещё файлы" : "Выбрать файлы"}
          <input
            type="file"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = "";
              void addFiles(files);
            }}
          />
        </label>
      </div>
      {items.length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">Файлов: {items.length}</p>
      )}
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </Field>
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Позиция курсора на момент нажатия кнопки: загрузка файла асинхронная,
  // и к её концу выделение в редакторе уже потеряно.
  const savedRangeRef = useRef<Range | null>(null);
  // Держим не сам узел, а его номер: onBlur пересобирает innerHTML, и прямая
  // ссылка после этого указывает на отсоединённый элемент.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [cropping, setCropping] = useState(false);
  const [uploading, setUploading] = useState(false);

  function rememberSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    savedRangeRef.current = range.cloneRange();
  }

  /** Возвращает диапазон вставки: сохранённый курсор либо конец текста. */
  function insertionRange(editor: HTMLDivElement) {
    const saved = savedRangeRef.current;
    if (saved && editor.contains(saved.commonAncestorContainer)) return saved;
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    return range;
  }

  useEffect(() => {
    if (
      editorRef.current &&
      !editingRef.current &&
      editorRef.current.innerHTML !== value
    ) {
      editorRef.current.innerHTML = sanitizeHtml(value);
    }
  }, [value]);

  function emit() {
    onChange(sanitizeHtml(editorRef.current?.innerHTML ?? ""));
  }

  function format(command: string) {
    editorRef.current?.focus();
    document.execCommand(command);
    emit();
  }

  /** Загружает файл и вставляет картинку в место курсора. */
  async function insertImage(file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const url = await fileStorage.upload("inline", file);
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      const image = document.createElement("img");
      image.src = url;
      image.alt = "";
      // data-focus задаёт видимую часть, если картинка не влезает в кадр.
      image.setAttribute("data-focus", "50 50");
      // Оригинал запоминаем сразу: обрезка подменяет src, и без этой ссылки
      // повторная обрезка резала бы уже урезанную копию.
      image.setAttribute("data-original", url);

      const range = insertionRange(editor);
      range.deleteContents();
      range.insertNode(image);

      // Курсор ставим за картинкой, чтобы можно было продолжать печатать.
      const after = document.createRange();
      after.setStartAfter(image);
      after.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(after);
      savedRangeRef.current = after.cloneRange();
      emit();
    } catch (reason) {
      alert(`Не удалось загрузить картинку: ${reason instanceof Error ? reason.message : "неизвестная ошибка"}`);
    } finally {
      setUploading(false);
    }
  }

  /** Находит выбранную картинку в живом DOM по её номеру. */
  function selectedNode(): HTMLImageElement | null {
    const editor = editorRef.current;
    if (!editor || selectedIndex === null) return null;
    return editor.querySelectorAll("img")[selectedIndex] ?? null;
  }

  function applyFocus(event: React.MouseEvent<HTMLDivElement>) {
    const image = selectedNode();
    if (!image) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)));
    image.setAttribute("data-focus", `${x} ${y}`);
    image.style.objectPosition = `${x}% ${y}%`;
    setSelectedIndex(selectedIndex);
    emit();
  }

  /** Загружает обрезанную копию и подменяет адрес. Оригинал на диске остаётся. */
  async function applyCrop(blob: Blob) {
    const image = selectedNode();
    if (!image) return;
    setUploading(true);
    try {
      const file = new File([blob], `crop-${Date.now()}.jpg`, { type: "image/jpeg" });
      const original = image.getAttribute("data-original") || image.getAttribute("src") || "";
      image.src = await fileStorage.upload("inline", file);
      if (original) image.setAttribute("data-original", original);
      setCropping(false);
      emit();
    } catch (reason) {
      alert(`Не удалось сохранить обрезку: ${reason instanceof Error ? reason.message : "неизвестная ошибка"}`);
    } finally {
      setUploading(false);
    }
  }

  const controls = [
    { command: "bold", label: "Жирный", Icon: Bold },
    { command: "italic", label: "Курсив", Icon: Italic },
    { command: "underline", label: "Подчеркнуть", Icon: Underline },
    { command: "strikeThrough", label: "Зачеркнуть", Icon: Strikethrough },
    { command: "insertUnorderedList", label: "Маркированный список", Icon: List },
    { command: "insertOrderedList", label: "Нумерованный список", Icon: ListOrdered },
  ];

  const selectedImage = selectedNode();
  const focusValue = selectedImage?.getAttribute("data-focus")?.split(/\s+/).map(Number) ?? [50, 50];

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
        <button
          type="button"
          title={uploading ? "Загружаем..." : "Вставить изображение"}
          aria-label="Вставить изображение"
          disabled={uploading}
          // preventDefault не даёт редактору потерять фокус, поэтому курсор
          // остаётся там, куда пользователь его поставил.
          onMouseDown={(event) => {
            event.preventDefault();
            rememberSelection();
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus size={16} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={async (event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            for (const file of files) await insertImage(file);
          }}
        />
      </div>

      {selectedImage && cropping && (
        <InlineImageCropper
          src={selectedImage.getAttribute("data-original") || selectedImage.src}
          busy={uploading}
          onCancel={() => setCropping(false)}
          onApply={(blob) => void applyCrop(blob)}
        />
      )}

      {selectedImage && !cropping && (
        <div
          // Без этого клик по панели уводит фокус, срабатывает onBlur и
          // пересобирает содержимое — выбранная картинка становится чужим узлом.
          onMouseDown={(event) => event.preventDefault()}
          className="flex flex-wrap items-start gap-3 border-b border-border bg-secondary/40 p-3"
        >
          <div
            onClick={applyFocus}
            role="application"
            aria-label={`Точка фокуса выбранной картинки: ${focusValue[0]}% на ${focusValue[1]}%`}
            className="relative w-[150px] shrink-0 cursor-crosshair overflow-hidden rounded border border-border bg-card"
          >
            <img src={selectedImage.src} alt="" className="block max-h-[110px] w-full object-contain" />
            <span
              aria-hidden="true"
              style={{ left: `${focusValue[0]}%`, top: `${focusValue[1]}%` }}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent/70 p-1.5 shadow-[0_0_0_1px_rgba(0,0,0,.45)]"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground">Картинка в тексте</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Нажмите на важное место — оно останется видимым, если картинка не помещается целиком.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCropping(true)}
                className="inline-flex items-center gap-1 rounded border border-accent px-2 py-1 text-[11px] text-accent hover:bg-accent hover:text-accent-foreground"
              >
                <Crop size={12} aria-hidden="true" /> Обрезать
              </button>
              {selectedImage.getAttribute("data-original") &&
                selectedImage.getAttribute("data-original") !== selectedImage.getAttribute("src") && (
                <button
                  type="button"
                  onClick={() => {
                    const image = selectedNode();
                    const original = image?.getAttribute("data-original");
                    if (!image || !original) return;
                    image.src = original;
                    emit();
                  }}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-accent"
                >
                  <RotateCcw size={12} aria-hidden="true" /> Вернуть оригинал
                </button>
              )}
              <button
                type="button"
                onClick={() => { selectedImage.remove(); setSelectedIndex(null); emit(); }}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-red-600 hover:border-red-400"
              >
                <Trash2 size={12} aria-hidden="true" /> Удалить картинку
              </button>
              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-accent"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        tabIndex={0}
        spellCheck
        onFocus={() => { editingRef.current = true; }}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onClick={(event) => {
          rememberSelection();
          const target = event.target as HTMLElement;
          if (!(target instanceof HTMLImageElement) || !editorRef.current) {
            setSelectedIndex(null);
            setCropping(false);
            return;
          }
          setSelectedIndex([...editorRef.current.querySelectorAll("img")].indexOf(target));
          setCropping(false);
        }}
        onPaste={(event) => {
          rememberSelection();
          // Скриншот из буфера иначе попал бы в базу строкой base64 на мегабайты.
          const file = [...event.clipboardData.items]
            .find((entry) => entry.kind === "file" && entry.type.startsWith("image/"))
            ?.getAsFile();
          if (!file) return;
          event.preventDefault();
          void insertImage(file);
        }}
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
