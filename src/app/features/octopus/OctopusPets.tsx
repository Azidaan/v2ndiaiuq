import { useEffect, useState } from "react";
import { JAR_EVENT, startOctopusPets } from "./engine";

const STORAGE_KEY = "ipii-octopus-off";

const readOff = () => {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
};
const writeOff = (value: boolean) => {
  try { localStorage.setItem(STORAGE_KEY, value ? "1" : "0"); } catch { /* приватный режим */ }
};

const ROUND_BUTTON = "fixed bottom-3 z-40 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/90 text-base shadow-sm backdrop-blur transition hover:border-accent";

/**
 * Осьминоги-питомцы, кнопка, которая их убирает, и кнопка сценки с банкой. Выбор запоминается в браузере.
 * При системной настройке «уменьшить движение» не появляются ни осьминоги, ни кнопка.
 */
export default function OctopusPets() {
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [off, setOff] = useState(readOff);

  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced || off) return;
    return startOctopusPets();
  }, [reduced, off]);

  if (reduced) return null;

  return (
    // Маленькие круглые кнопки: полноразмерная надпись перекрывала кнопки сайта
    // в левом нижнем углу. Пояснение — во всплывающей подсказке и для скринридера.
    <>
      <button
        type="button"
        data-octopus-toggle=""
        aria-pressed={!off}
        aria-label={off ? "Вернуть осьминогов" : "Убрать осьминогов"}
        title={off ? "Вернуть осьминогов" : "Убрать осьминогов"}
        onClick={() => { const next = !off; writeOff(next); setOff(next); }}
        className={`${ROUND_BUTTON} left-3 ${off ? "opacity-50 grayscale" : ""}`}
      >
        <span aria-hidden="true">🐙</span>
      </button>
      {!off && (
        <button
          type="button"
          data-octopus-jar=""
          aria-label="Осьминоги: поймать в банку"
          title="Поймать в банку"
          onClick={() => window.dispatchEvent(new Event(JAR_EVENT))}
          className={`${ROUND_BUTTON} left-12`}
        >
          <span aria-hidden="true">🫙</span>
        </button>
      )}
    </>
  );
}
