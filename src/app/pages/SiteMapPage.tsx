import { Link } from "react-router";
import Breadcrumbs from "../components/layout/Breadcrumbs";
import { NAV } from "../data";

export default function SiteMapPage() {
  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      <Breadcrumbs crumbs={[{ label: "Карта сайта" }]} />
      <main className="max-w-[960px] mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-primary mb-6" style={{ fontFamily: "var(--font-display)" }}>Карта сайта</h1>
        <ul className="grid gap-3 sm:grid-cols-2">
          {NAV.map((item) => (
            <li key={item.path} className="bg-card border border-border rounded p-4">
              <Link to={item.path} className="font-semibold text-primary hover:text-accent">{item.label}</Link>
              {item.children && (
                <ul className="mt-3 space-y-2 border-l border-border pl-3">
                  {item.children.map((child) => (
                    <li key={child.path}><Link to={child.path} className="text-sm text-foreground hover:text-accent">{child.label}</Link></li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
