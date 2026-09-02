import { useState, useRef, useEffect, useCallback, useLayoutEffect, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router";
import { Search, ChevronDown, ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { NAV, type NavItem } from "../../data";
import ipiiLogo from "../../../imports/ipii-logo.png";

const PANEL_WIDTH = 220;

function DropdownMenu({ item, scrollRef }: { item: NavItem; scrollRef: RefObject<HTMLDivElement | null> }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isActive = location.pathname.startsWith(item.path) && item.path !== "/";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      // Панель живёт в портале, поэтому проверяем оба поддерева.
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Строка навигации прокручивается по горизонтали, а overflow-x: auto не
  // позволяет overflow-y остаться visible — вложенная панель была бы обрезана.
  // Поэтому панель рендерится в портале с координатами от кнопки.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8)),
        top: rect.bottom,
      });
    }
    place();
    const scroller = scrollRef.current;
    scroller?.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    return () => {
      scroller?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
    };
  }, [open, scrollRef]);

  if (!item.children) {
    return (
      <Link
        to={item.path}
        className={`flex shrink-0 items-center px-4 py-3 text-sm whitespace-nowrap transition-colors hover:bg-[#2a4d7e] ${
          isActive ? "border-b-2 border-white font-semibold" : ""
        }`}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div ref={triggerRef} className="shrink-0">
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
      {open && position && createPortal(
        <div
          ref={panelRef}
          className="fixed z-50 min-w-[220px] bg-white border border-border shadow-lg rounded-b-sm py-1"
          style={{ left: position.left, top: position.top }}
        >
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
        </div>,
        document.body,
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

  // Прокрутка строки навигации: стрелки показываются только когда есть куда ехать.
  const navScrollRef = useRef<HTMLDivElement>(null);
  const [navOverflow, setNavOverflow] = useState({ left: false, right: false });

  const measureNavOverflow = useCallback(() => {
    const el = navScrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setNavOverflow({ left: el.scrollLeft > 1, right: el.scrollLeft < max - 1 });
  }, []);

  useEffect(() => {
    measureNavOverflow();
    const el = navScrollRef.current;
    el?.addEventListener("scroll", measureNavOverflow, { passive: true });
    window.addEventListener("resize", measureNavOverflow);
    return () => {
      el?.removeEventListener("scroll", measureNavOverflow);
      window.removeEventListener("resize", measureNavOverflow);
    };
  }, [measureNavOverflow]);

  function scrollNav(direction: -1 | 1) {
    const el = navScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.6), behavior: "smooth" });
  }

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

          {/* Controls — только мобильные: строка поиска скрыта ниже md, вместо неё лупа */}
          <div className="flex items-center gap-2 shrink-0 ml-auto md:hidden">
            <Link
              to="/search"
              aria-label="Поиск по сайту"
              className="flex items-center border border-primary text-primary p-2 rounded hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <Search size={16} aria-hidden="true" />
            </Link>
            <button
              className="p-2 rounded hover:bg-secondary transition-colors"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} className="text-primary" /> : <Menu size={20} className="text-primary" />}
            </button>
          </div>
        </div>

        {/* Nav bar — desktop. Ряд прокручивается по горизонтали, поэтому не
            расширяет страницу на промежуточных ширинах (768–829 px). */}
        <nav
          className="bg-primary text-primary-foreground hidden md:block"
          aria-label="Основная навигация"
        >
          <div className="max-w-[1280px] mx-auto px-4 relative">
            <div
              ref={navScrollRef}
              className="flex items-center overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {NAV.map((item) => (
                <DropdownMenu key={item.path} item={item} scrollRef={navScrollRef} />
              ))}
            </div>
            {navOverflow.left && (
              <>
                <button
                  type="button"
                  onClick={() => scrollNav(-1)}
                  aria-label="Прокрутить меню влево"
                  className="absolute inset-y-0 left-0 z-10 flex w-9 items-center justify-center bg-primary transition-colors hover:bg-[#2a4d7e]"
                >
                  <ChevronLeft size={17} aria-hidden="true" />
                </button>
                <div className="pointer-events-none absolute inset-y-0 left-9 w-6 bg-gradient-to-r from-primary to-transparent" />
              </>
            )}
            {navOverflow.right && (
              <>
                <button
                  type="button"
                  onClick={() => scrollNav(1)}
                  aria-label="Прокрутить меню вправо"
                  className="absolute inset-y-0 right-0 z-10 flex w-9 items-center justify-center bg-primary transition-colors hover:bg-[#2a4d7e]"
                >
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
                <div className="pointer-events-none absolute inset-y-0 right-9 w-6 bg-gradient-to-l from-primary to-transparent" />
              </>
            )}
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
