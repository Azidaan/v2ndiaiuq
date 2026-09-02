import { useState } from "react";
import { MapPin, Phone, Mail, Clock, Send, CheckCircle } from "lucide-react";
import Breadcrumbs from "../components/layout/Breadcrumbs";
import { apiRequest } from "../lib/apiClient";

export default function ContactsPage() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiRequest<{ ok: true }>("/api/inquiries", {
        method: "POST",
        body: JSON.stringify({ ...form, website }),
      });
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить обращение");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      <Breadcrumbs crumbs={[{ label: "Контакты" }]} />
      <div className="max-w-[1280px] mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-primary mb-6" style={{ fontFamily: "var(--font-display)" }}>
          Контакты
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Contact info + map */}
          <div className="flex flex-col gap-5">

            {/* Main requisites */}
            <div className="bg-card border border-border rounded p-5">
              <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Реквизиты и адрес</h2>
              <div className="mb-4 pb-4 border-b border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Полное наименование</p>
                <p className="text-sm text-foreground leading-relaxed">
                  Федеральное государственное бюджетное научное учреждение «Институт проблем искусственного интеллекта»
                </p>
                <p className="text-xs text-muted-foreground mt-1">Сокращённое наименование: ФГБНУ «ИПИИ»</p>
              </div>
              <dl className="grid grid-cols-1 gap-3">
                {[
                  { icon: MapPin, label: "Адрес", value: "283048, г. Донецк, ул. Артёма, дом 118 б" },
                  { icon: Phone, label: "Телефон", value: "+7 (856) 311-34-24", href: "tel:+78563113424" },
                  { icon: Mail, label: "Электронная почта", value: "gu_ipii@mail.ru", href: "mailto:gu_ipii@mail.ru" },
                  { icon: Mail, label: "Аспирантура (e-mail)", value: "as16intellect@mail.ru", href: "mailto:as16intellect@mail.ru" },
                  { icon: Clock, label: "Режим работы", value: "Пн–Пт: 09:00–18:00" },
                ].map(({ icon: Icon, label, value, href }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="w-8 h-8 shrink-0 rounded bg-secondary flex items-center justify-center mt-0.5">
                      <Icon size={15} className="text-primary opacity-70" aria-hidden="true" />
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</dt>
                      <dd className="text-sm text-foreground mt-0.5">
                        {href ? (
                          <a href={href} className="text-accent hover:underline">{value}</a>
                        ) : value}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>

              {/* Social links */}
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Социальные сети</p>
                <div className="flex flex-col gap-2">
                  {[
                    { label: "ВКонтакте", href: "https://vk.com/guiaidn", short: "VK" },
                    { label: "Одноклассники", href: "https://ok.ru/group/70000005592948", short: "ОК" },
                  ].map((s) => (
                    <a
                      key={s.href}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-accent hover:underline"
                    >
                      <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                        {s.short}
                      </span>
                      {s.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Yandex Map */}
            <div className="border border-border rounded overflow-hidden" aria-label="Карта расположения института">
              <iframe
                src="https://yandex.ru/map-widget/v1/?ll=37.790690%2C48.027329&z=17&pt=37.790690%2C48.027329,pm2rdm"
                width="100%"
                height="320"
                style={{ border: 0, display: "block" }}
                title="Карта расположения ФГБНУ ИПИИ"
                loading="lazy"
                allowFullScreen
              />
              <div className="px-4 py-2 bg-secondary flex items-center justify-between">
                <span className="text-xs text-muted-foreground">г. Донецк, ул. Артёма, 118 б</span>
                <a
                  href="https://yandex.ru/maps/?text=Донецк+ул+Артёма+118б"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  Открыть на Яндекс.Картах ↗
                </a>
              </div>
            </div>
          </div>

          {/* Right: Contact form */}
          <div className="bg-card border border-border rounded p-6">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Форма обращения</h2>

            {sent ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                <CheckCircle size={40} className="text-green-500" aria-hidden="true" />
                <h3 className="text-lg font-semibold text-foreground">Сообщение отправлено!</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Ваше обращение принято. Мы ответим в течение 1–3 рабочих дней.
                </p>
                <button
                  onClick={() => { setSent(false); setError(""); setWebsite(""); setForm({ name: "", email: "", subject: "", message: "" }); }}
                  className="text-sm text-accent hover:underline"
                >
                  Отправить ещё одно сообщение
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="absolute -left-[10000px]" aria-hidden="true">
                  <label htmlFor="website">Сайт</label>
                  <input id="website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
                </div>
                {[
                  { id: "name", label: "Имя и фамилия *", type: "text", placeholder: "Иванов Иван Иванович", required: true },
                  { id: "email", label: "Электронная почта *", type: "email", placeholder: "email@example.com", required: true },
                  { id: "subject", label: "Тема обращения", type: "text", placeholder: "Тема вашего вопроса", required: false },
                ].map(({ id, label, type, placeholder, required }) => (
                  <div key={id}>
                    <label htmlFor={id} className="block text-xs font-medium text-foreground mb-1.5">{label}</label>
                    <input
                      id={id}
                      type={type}
                      required={required}
                      placeholder={placeholder}
                      value={form[id as keyof typeof form]}
                      onChange={(e) => setForm((f: typeof form) => ({ ...f, [id]: e.target.value }))}
                      className="w-full text-sm border border-border rounded px-3 py-2 bg-input-background text-foreground outline-none focus:border-accent transition-colors placeholder:text-muted-foreground"
                    />
                  </div>
                ))}

                <div>
                  <label htmlFor="message" className="block text-xs font-medium text-foreground mb-1.5">Сообщение *</label>
                  <textarea
                    id="message"
                    required
                    minLength={10}
                    rows={5}
                    placeholder="Текст вашего обращения..."
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    className="w-full text-sm border border-border rounded px-3 py-2 bg-input-background text-foreground outline-none focus:border-accent transition-colors placeholder:text-muted-foreground resize-none"
                  />
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Нажимая «Отправить», вы соглашаетесь с{" "}
                  <a href="/documents/privacy" className="text-accent hover:underline">политикой обработки персональных данных</a>.
                </p>

                {error && (
                  <p role="alert" className="text-sm text-red-600 rounded border border-red-200 bg-red-50 px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm px-5 py-2.5 rounded hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full sm:w-fit disabled:opacity-50"
                >
                  <Send size={14} aria-hidden="true" /> {busy ? "Отправляем..." : "Отправить обращение"}
                </button>
              </form>
            )}

            {/* Alternative contacts */}
            <div className="mt-6 pt-5 border-t border-border">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Или напишите напрямую</p>
              <div className="flex flex-col gap-2">
                <a href="mailto:gu_ipii@mail.ru" className="flex items-center gap-2 text-sm text-accent hover:underline">
                  <Mail size={14} className="shrink-0" aria-hidden="true" />
                  gu_ipii@mail.ru
                </a>
                <a href="mailto:as16intellect@mail.ru" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent transition-colors">
                  <Mail size={14} className="shrink-0" aria-hidden="true" />
                  as16intellect@mail.ru <span className="text-[11px]">(аспирантура)</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
