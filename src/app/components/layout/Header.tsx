import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Search, Mail, ChevronDown, Menu, X } from "lucide-react";
import { NAV, type NavItem } from "../../data";
import ipiiLogo from "../../../imports/ipii-logo.png";

function DropdownMenu({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isActive = location.pathname.startsWith(item.path) && item.path !== "/";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!item.children) {
    return (
      <Link
        to={item.path}
        className={`flex items-center px-4 py-3 text-sm whitespace-nowrap transition-colors hover:bg-[#2a4d7e] ${
          isActive ? "border-b-2 border-white font-semibold" : ""
        }`}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 px-4 py-3 text-sm whitespace-nowrap transition-colors hover:bg-[#2a4d7e] ${
          isActive ? "border-b-2 border-white font-semibold" : ""
        }`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {item.label}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 min-w-[220px] bg-white border border-border shadow-lg rounded-b-sm py-1">
          {item.children.map((child) => (
            <Link
              key={child.path}
              to={child.path}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-foreground hover:bg-secondary hover:text-primary transition-colors"
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileNavItem({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isActive = location.pathname.startsWith(item.path) && item.path !== "/";

  if (!item.children) {
    return (
      <Link
        to={item.path}
        onClick={onClose}
        className={`block px-3 py-3 text-sm rounded transition-colors hover:bg-[#2a4d7e] ${isActive ? "font-semibold bg-[#2a4d7e]" : ""}`}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-3 py-3 text-sm rounded transition-colors hover:bg-[#2a4d7e] ${isActive ? "font-semibold" : ""}`}
        aria-expanded={open}
      >
        <span>{item.label}</span>
        <ChevronDown size={13} className={`transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="ml-3 mb-1 border-l border-white/20 pl-3 flex flex-col">
          {item.children.map((child) => (
            <Link
              key={child.path}
              to={child.path}
              onClick={onClose}
              className="block px-2 py-2.5 text-sm text-blue-100 hover:text-white hover:bg-[#2a4d7e] rounded transition-colors"
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    function measure() {
      if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // close mobile menu on route change
  const location = useLocation();
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <>
      <header ref={headerRef} className="sticky top-0 z-40 bg-white shadow-sm" style={{ fontFamily: "var(--font-body)" }}>
        {/* Top bar */}
        <div className="max-w-[1280px] mx-auto px-4 py-2.5 flex items-center gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 shrink-0 group" aria-label="На главную">
            <img src={ipiiLogo} alt="" width="64" height="64" className="size-16 object-contain" aria-hidden="true" />
            <div className="text-[11px] leading-tight text-gray-600 max-w-[200px] hidden sm:block">
              <div>Федеральное государственное бюджетное научное учреждение</div>
              <div className="font-bold text-[12px] text-primary mt-0.5">«Институт проблем искусственного интеллекта»</div>
            </div>
          </Link>

          {/* Search */}
          <form
            role="search"
            className="flex-1 max-w-xs ml-auto hidden md:flex items-center border border-border rounded bg-input-background px-3 py-1.5 gap-2 focus-within:border-accent transition-colors"
            onSubmit={(e) => {
              e.preventDefault();
              const query = search.trim();
              if (query) navigate(`/search?q=${encodeURIComponent(query)}`);
            }}
          >
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по сайту"
              aria-label="Поиск по сайту"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
            <button type="submit" aria-label="Найти" className="text-muted-foreground hover:text-primary transition-colors">
              <Search size={15} />
            </button>
          </form>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <a
              href="mailto:gu_ipii@mail.ru"
              className="flex items-center gap-1.5 border border-primary text-primary text-xs px-3 py-1.5 rounded hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <Mail size={13} aria-hidden="true" />
              <span className="hidden sm:inline">Написать нам</span>
            </a>
            <button
              className="md:hidden p-2 rounded hover:bg-secondary transition-colors"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} className="text-primary" /> : <Menu size={20} className="text-primary" />}
            </button>
          </div>
        </div>

        {/* Nav bar — desktop */}
        <nav
          className="bg-primary text-primary-foreground hidden md:block overflow-visible"
          aria-label="Основная навигация"
        >
          <div className="max-w-[1280px] mx-auto px-4 flex items-center">
            {NAV.map((item) => (
              <DropdownMenu key={item.path} item={item} />
            ))}
          </div>
        </nav>
      </header>

      {/* Mobile nav — fixed overlay below header, full scrollable height */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            style={{ top: headerHeight }}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <nav
            className="fixed left-0 right-0 z-30 md:hidden bg-primary text-primary-foreground overflow-y-auto"
            style={{ top: headerHeight, maxHeight: `calc(100dvh - ${headerHeight}px)` }}
            aria-label="Мобильная навигация"
          >
            <div className="px-4 py-3 flex flex-col gap-0.5">
              {NAV.map((item) => (
                <MobileNavItem key={item.path} item={item} onClose={() => setMobileOpen(false)} />
              ))}
            </div>
          </nav>
        </>
      )}
    </>
  );
}
