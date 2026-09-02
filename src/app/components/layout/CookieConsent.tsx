import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button } from "../ui/button";

const COOKIE_CONSENT_KEY = "cookie-consent-accepted";

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const accepted = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!accepted) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, "true");
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded border border-border bg-card p-4 shadow-lg">
      <p className="text-sm font-semibold text-foreground">Файлы cookie</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Продолжая использовать сайт, вы соглашаетесь с использованием файлов cookie для корректной работы сервиса.
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Button type="button" variant="link" size="sm" asChild className="h-auto px-0 text-sm">
          <Link to="/documents/privacy">Подробнее</Link>
        </Button>
        <Button type="button" size="sm" onClick={handleAccept}>
          Принять
        </Button>
      </div>
    </div>
  );
}
