import { Link } from "react-router";
import { ChevronRight, Home } from "lucide-react";

export interface Crumb {
  label: string;
  path?: string;
}

interface Props {
  crumbs: Crumb[];
}

export default function Breadcrumbs({ crumbs }: Props) {
  return (
    <nav aria-label="Хлебные крошки" className="bg-card border-b border-border">
      <div className="max-w-[1280px] mx-auto px-4">
        <ol className="flex items-center gap-1 py-2 text-xs text-muted-foreground flex-wrap">
          <li>
            <Link to="/" className="flex items-center gap-1 hover:text-primary transition-colors" aria-label="Главная">
              <Home size={12} aria-hidden="true" />
            </Link>
          </li>
          {crumbs.map((crumb, i) => (
            <li key={i} className="flex items-center gap-1">
              <ChevronRight size={11} aria-hidden="true" className="opacity-40" />
              {crumb.path && i < crumbs.length - 1 ? (
                <Link to={crumb.path} className="hover:text-primary transition-colors">{crumb.label}</Link>
              ) : (
                <span className="text-foreground font-medium">{crumb.label}</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
