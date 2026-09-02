import { useEffect, useState, type FormEvent } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { adminUserService, type AdminUser } from "../lib/adminUserService";
import type { AdminRole } from "../lib/authService";

const roles: { value: AdminRole; label: string; description: string }[] = [
  { value: "superadmin", label: "Главный администратор", description: "Пользователи и весь контент" },
  { value: "admin", label: "Администратор", description: "Создание, изменение и удаление контента" },
  { value: "editor", label: "Редактор", description: "Создание и изменение без удаления" },
  { value: "viewer", label: "Наблюдатель", description: "Только просмотр CMS" },
];

export default function AdminUsersPanel({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setUsers(await adminUserService.list());
    } catch (reason) {
      setMessage(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Пользователи</h1>
          <p className="text-xs text-muted-foreground mt-1">Роли и доступ к административной панели</p>
        </div>
        <button onClick={() => setCreating((value) => !value)} className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded text-sm">
          <Plus size={16} /> Добавить
        </button>
      </div>
      {message && <p className="rounded border border-border bg-card px-4 py-3 text-sm">{message}</p>}
      {creating && <CreateUser onCancel={() => setCreating(false)} onCreated={async () => { setCreating(false); setMessage("Пользователь создан. Передайте временный пароль безопасным способом."); await load(); }} />}
      {loading ? <p className="text-sm text-muted-foreground py-8">Загрузка...</p> : (
        <div className="space-y-3">
          {users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              isCurrent={user.id === currentUserId}
              onChanged={async (text) => { setMessage(text); await load(); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateUser({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminUserService.create({ email, password, role });
      onCreated();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-card border border-border rounded p-5">
      <h2 className="font-semibold text-primary mb-4">Новый пользователь</h2>
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Электронная почта"><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="admin-input" /></Field>
        <Field label="Временный пароль (от 12 символов)"><input required minLength={12} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="admin-input" /></Field>
        <Field label="Роль"><RoleSelect value={role} onChange={setRole} /></Field>
      </div>
      <p className="text-xs text-muted-foreground mb-4">После первого входа пользователь будет обязан установить собственный пароль.</p>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="bg-primary text-primary-foreground rounded px-4 py-2 text-sm disabled:opacity-50">Создать</button>
        <button type="button" onClick={onCancel} className="border border-border rounded px-4 py-2 text-sm">Отмена</button>
      </div>
    </form>
  );
}

function UserCard({ user, isCurrent, onChanged }: { user: AdminUser; isCurrent: boolean; onChanged: (message: string) => void }) {
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.is_active);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function action(callback: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    try {
      await callback();
      setPassword("");
      onChanged(success);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded p-4">
      <div className="grid lg:grid-cols-[minmax(180px,1fr)_230px_150px_auto] gap-3 items-end">
        <div className="min-w-0 self-center">
          <p className="font-medium truncate">{user.email} {isCurrent && <span className="text-xs text-accent">(вы)</span>}</p>
          <p className="text-xs text-muted-foreground mt-1">Создан {new Date(user.created_at).toLocaleDateString("ru-RU")}{user.must_change_password ? " · ожидается смена пароля" : ""}</p>
        </div>
        <Field label="Роль"><RoleSelect value={role} onChange={setRole} /></Field>
        <label className="flex items-center gap-2 h-10 text-sm"><input type="checkbox" checked={isActive} disabled={isCurrent} onChange={(event) => setIsActive(event.target.checked)} /> Активен</label>
        <div className="flex gap-1 pb-4">
          <button disabled={busy} title="Сохранить роль и статус" onClick={() => void action(() => adminUserService.update(user.id, { role, is_active: isActive }), "Права пользователя обновлены")} className="p-2 text-accent disabled:opacity-50"><Save size={18} /></button>
          {!isCurrent && <button disabled={busy} title="Удалить пользователя" onClick={() => confirm(`Удалить пользователя ${user.email}?`) && void action(() => adminUserService.remove(user.id), "Пользователь удалён")} className="p-2 text-red-600 disabled:opacity-50"><Trash2 size={18} /></button>}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center border-t border-border pt-3">
        <input type="password" minLength={12} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Новый временный пароль" className="admin-input max-w-sm" />
        <button disabled={busy || password.length < 12} onClick={() => void action(() => adminUserService.resetPassword(user.id, password), "Пароль сброшен; остальные сессии пользователя завершены")} className="border border-primary text-primary rounded px-3 py-2 text-sm disabled:opacity-50">Сбросить пароль</button>
      </div>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}

function RoleSelect({ value, onChange }: { value: AdminRole; onChange: (role: AdminRole) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as AdminRole)} className="admin-input">
      {roles.map((role) => <option key={role.value} value={role.value}>{role.label} — {role.description}</option>)}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block mb-4"><span className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</span>{children}</label>;
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Операция не выполнена";
}
