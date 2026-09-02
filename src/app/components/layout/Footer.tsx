import { Link } from "react-router";
import { MapPin, Phone, Mail } from "lucide-react";

const COL1 = [
  { label: "Об институте", path: "/institute" },
  { label: "История и миссия", path: "/institute/history" },
  { label: "Научные отделы", path: "/institute/departments" },
];
const COL2 = [
  { label: "Исследования и разработки", path: "/science/research" },
  { label: "Свидетельства для ЭВМ", path: "/science/rid" },
];
const COL3 = [
  { label: "Аспирантура", path: "/education" },
  { label: "Библиотека", path: "/education/library" },
  { label: "Вступительные испытания", path: "/education/exams" },
  { label: "Стоимость обучения", path: "/education/fees" },
];
const COL4 = [
  { label: "Учредительные документы", path: "/documents/charter" },
  { label: "Нормативные документы", path: "/documents/normative" },
  { label: "Отчёты", path: "/documents/reports" },
  { label: "Антикоррупция", path: "/documents/anticorruption" },
  { label: "Политика обработки данных", path: "/documents/privacy" },
];

export default function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground" style={{ fontFamily: "var(--font-body)" }}>
      <div className="max-w-[1280px] mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
          {/* About */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="text-xs font-bold uppercase tracking-widest mb-3 opacity-60">О институте</h3>
            <ul className="space-y-1.5">
              {COL1.map((l) => (
                <li key={l.path}>
                  <Link to={l.path} className="text-xs text-blue-200 hover:text-white transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Science */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-3 opacity-60">Наука</h3>
            <ul className="space-y-1.5">
              {COL2.map((l) => (
                <li key={l.path}>
                  <Link to={l.path} className="text-xs text-blue-200 hover:text-white transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Education */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-3 opacity-60">Образование</h3>
            <ul className="space-y-1.5">
              {COL3.map((l) => (
                <li key={l.path}>
                  <Link to={l.path} className="text-xs text-blue-200 hover:text-white transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Documents */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-3 opacity-60">Документы</h3>
            <ul className="space-y-1.5">
              {COL4.map((l) => (
                <li key={l.path}>
                  <Link to={l.path} className="text-xs text-blue-200 hover:text-white transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacts */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-3 opacity-60">Контакты</h3>
            <ul className="space-y-2 text-xs text-blue-200">
              <li className="flex items-start gap-2">
                <MapPin size={12} className="shrink-0 mt-0.5 opacity-70" aria-hidden="true" />
                <span>283048, г. Донецк, ул. Артёма, д. 118 б</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={12} className="opacity-70" aria-hidden="true" />
                <a href="tel:+78563113424" className="hover:text-white transition-colors">+7 (856) 311-34-24</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={12} className="opacity-70" aria-hidden="true" />
                <a href="mailto:gu_ipii@mail.ru" className="hover:text-white transition-colors">gu_ipii@mail.ru</a>
              </li>
              <li className="flex gap-2 mt-3 flex-wrap">
                {[
                  { key: "VK", label: "ВКонтакте", href: "https://vk.com/guiaidn" },
                  { key: "ОК", label: "Одноклассники", href: "https://ok.ru/group/70000005592948" },
                ].map((s) => (
                  <a
                    key={s.key}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-[9px] font-bold transition-colors"
                  >
                    {s.key}
                  </a>
                ))}
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/15 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-blue-300">
          <span>© 2026 ФГБНУ «Институт проблем искусственного интеллекта»</span>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/site-map" className="hover:text-white transition-colors">Карта сайта</Link>
            <Link to="/documents/privacy" className="hover:text-white transition-colors">Политика конфиденциальности</Link>
            <Link to="/documents/anticorruption" className="hover:text-white transition-colors">Противодействие коррупции</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
