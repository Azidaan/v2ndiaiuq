import { useEffect, useState } from "react";
import { Mail, Save, Trash2 } from "lucide-react";
import { inquiryRepository, type Inquiry, type InquiryStatus } from "../lib/inquiryRepository";

const statusOptions: { value: InquiryStatus; label: string }[] = [
  { value: "new", label: "Новое" },
  { value: "in_progress", label: "В работе" },
  { value: "resolved", label: "Закрыто" },
];

const statusStyles: Record<InquiryStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  resolved: "bg-green-100 text-green-800",
};

export default function AdminInquiriesPanel({ canWrite, canDelete }: { canWrite: boolean; canDelete: boolean }) {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [filter, setFilter] = useState<InquiryStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      setItems(await inquiryRepository.list(filter || undefined));
    } catch (reason) {
      setMessage(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Обращения</h1>
          <p className="text-xs text-muted-foreground mt-1">Сообщения, отправленные через форму на странице контактов</p>
        </div>
        <label className="text-xs font-semibold text-muted-foreground">
          Статус
          <select value={filter} onChange={(event) => setFilter(event.target.value as InquiryStatus | "")} className="admin-input mt-1 min-w-44">
            <option value="">Все обращения</option>
            {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </label>
      </div>
      {message && <p role="status" className="rounded border border-border bg-card px-4 py-3 text-sm">{message}</p>}
      {loading ? <p className="text-sm text-muted-foreground py-8">Загрузка...</p> : items.length === 0 ? (
        <div className="bg-card border border-border rounded p-6 text-sm text-muted-foreground">Обращений с выбранным статусом пока нет.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <InquiryCard
              key={item.id}
              inquiry={item}
              canWrite={canWrite}
              canDelete={canDelete}
              onChanged={async (text) => { setMessage(text); await load(); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InquiryCard({ inquiry, canWrite, canDelete, onChanged }: { inquiry: Inquiry; canWrite: boolean; canDelete: boolean; onChanged: (message: string) => void }) {
  const [status, setStatus] = useState(inquiry.status);
  const [adminNote, setAdminNote] = useState(inquiry.admin_note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      await inquiryRepository.update(inquiry.id, { status, admin_note: adminNote });
      onChanged("Обращение обновлено");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Удалить обращение от ${inquiry.name}?`)) return;
    setBusy(true);
    setError("");
    try {
      await inquiryRepository.remove(inquiry.id);
      onChanged("Обращение удалено");
    } catch (reason) {
      setError(errorMessage(reason));
      setBusy(false);
    }
  }

  const statusLabel = statusOptions.find((option) => option.value === inquiry.status)?.label;
  return (
    <article className="bg-card border border-border rounded p-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-primary">{inquiry.subject || "Без темы"}</h2>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyles[inquiry.status]}`}>{statusLabel}</span>
          </div>
          <p className="text-sm mt-1">{inquiry.name}</p>
          <a href={`mailto:${inquiry.email}`} className="inline-flex items-center gap-1 text-sm text-accent hover:underline mt-1"><Mail size={13} />{inquiry.email}</a>
        </div>
        <time className="text-xs text-muted-foreground shrink-0" dateTime={inquiry.created_at}>
          {new Date(inquiry.created_at).toLocaleString("ru-RU")}
        </time>
      </div>
      <div className="whitespace-pre-wrap break-words rounded bg-secondary/60 px-4 py-3 text-sm leading-relaxed">{inquiry.message}</div>
      <div className="grid md:grid-cols-[220px_1fr] gap-4 mt-4">
        <label className="text-xs font-semibold text-muted-foreground">Статус
          <select disabled={!canWrite || busy} value={status} onChange={(event) => setStatus(event.target.value as InquiryStatus)} className="admin-input mt-1">
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">Внутренний комментарий
          <textarea disabled={!canWrite || busy} maxLength={10000} rows={3} value={adminNote} onChange={(event) => setAdminNote(event.target.value)} className="admin-input mt-1" placeholder="Виден только сотрудникам CMS" />
        </label>
      </div>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      {(canWrite || canDelete) && <div className="flex gap-2 mt-3">
        {canWrite && <button disabled={busy} onClick={() => void save()} className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded px-4 py-2 text-sm disabled:opacity-50"><Save size={15} />Сохранить</button>}
        {canDelete && <button disabled={busy} onClick={() => void remove()} className="inline-flex items-center gap-2 border border-red-300 text-red-700 rounded px-4 py-2 text-sm disabled:opacity-50"><Trash2 size={15} />Удалить</button>}
      </div>}
    </article>
  );
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Операция не выполнена";
}
