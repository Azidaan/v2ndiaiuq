import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <div className="max-w-[1280px] mx-auto px-4 py-20 text-center" style={{ fontFamily: "var(--font-body)" }}>
      <p className="text-7xl font-bold text-primary opacity-20 mb-4" style={{ fontFamily: "var(--font-display)" }}>404</p>
      <h1 className="text-2xl font-bold text-foreground mb-3" style={{ fontFamily: "var(--font-display)" }}>
        Страница не найдена
      </h1>
      <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
        Запрашиваемая страница не существует или была перемещена.
      </p>
      <div className="flex gap-3 justify-center flex-wrap">
        <Link to="/" className="bg-primary text-primary-foreground text-sm px-5 py-2.5 rounded hover:bg-accent transition-colors">
          На главную
        </Link>
        <Link to="/news" className="border border-border text-foreground text-sm px-5 py-2.5 rounded hover:border-accent transition-colors">
          Новости
        </Link>
      </div>
    </div>
  );
}
