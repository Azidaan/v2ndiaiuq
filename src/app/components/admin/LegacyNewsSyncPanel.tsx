import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiRequest } from "../../lib/apiClient";
type SyncState = {
  running?: boolean; enabled: boolean; intervalMinutes: number; nextRunAt?: string;
  status?: "success" | "warning" | "error"; startedAt?: string; finishedAt?: string;
  inserted?: number; kept?: number; error?: string;
  failedAssets?: { path: string; url: string }[]; pageFailures?: { page: string; why: string }[];
};
const time = (value?: string) => value ? new Date(value).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", dateStyle: "short", timeStyle: "short" }) : "—";
export default function LegacyNewsSyncPanel({ canWrite, onCompleted }: { canWrite: boolean; onCompleted: () => void }) {
  const [state, setState] = useState<SyncState | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const completed = useRef<string>();
  const initialized = useRef(false);
  const callback = useRef(onCompleted); callback.current = onCompleted;
  useEffect(() => {
    let alive = true, timer: ReturnType<typeof setTimeout>;
    async function poll() {
      let delay = 30000;
      try {
        const next = await apiRequest<SyncState>("/api/admin/legacy-news-sync");
        if (!alive) return;
        setState(next); setError(""); delay = next.running ? 3000 : 30000;
        if (initialized.current && next.finishedAt && next.finishedAt !== completed.current) callback.current();
        completed.current = next.finishedAt; initialized.current = true;
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : "Не удалось получить состояние переноса"); }
      if (alive) timer = setTimeout(poll, delay);
    }
    void poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [state?.running]);
  async function start() {
    setStarting(true); setError("");
    try {
      await apiRequest("/api/admin/legacy-news-sync", { method: "POST" });
      setState(await apiRequest<SyncState>("/api/admin/legacy-news-sync"));
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось запустить перенос"); }
    finally { setStarting(false); }
  }
  return <div className="mb-5 rounded border border-border bg-card p-4 text-sm" aria-label="Перенос новостей со старого сайта">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold text-primary">Новости со старого сайта</h2>
        <p className="mt-1 text-xs text-muted-foreground">{state?.enabled ? `Автоматическая проверка каждые ${state.intervalMinutes} минут` : "Автоматическая проверка выключена"}. Ручные правки сохраняются.</p></div>
      {canWrite && <button type="button" onClick={() => void start()} disabled={starting || !state || state.running} className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50">
        <RefreshCw size={14} className={starting || state?.running ? "animate-spin" : ""} />{starting || state?.running ? "Переносим…" : "Перенести сейчас"}
      </button>}
    </div>
    <div className="mt-3 text-xs" role="status" aria-live="polite">
      {state?.running ? `Проверяем архив и загружаем новые новости. Начало: ${time(state.startedAt)}.` : state?.finishedAt ? <>
        Последний запуск: {time(state.finishedAt)}. {state.status === "error" ? "Перенос завершился ошибкой." : `Добавлено: ${state.inserted ?? 0}. Уже существовали: ${state.kept ?? 0}.`}
      </> : "Перенос ещё не запускался."}
      {state?.enabled && <span className="ml-2 text-muted-foreground">Следующая проверка: {time(state.nextRunAt)} (МСК).</span>}
    </div>
    {(error || state?.error) && <p className="mt-2 text-xs text-red-700">{error || state?.error}</p>}
    {!!(state?.failedAssets?.length || state?.pageFailures?.length) && <details className="mt-2 text-xs text-amber-800"><summary className="cursor-pointer">Есть недоступные материалы старого сайта</summary>
      <ul className="mt-2 space-y-1">{state.failedAssets?.map((a) => <li key={a.path}><a href={a.url} target="_blank" rel="noopener noreferrer" className="underline">{a.url}</a></li>)}{state.pageFailures?.map((p) => <li key={p.page}>{p.page}: {p.why}</li>)}</ul>
    </details>}
  </div>;
}
