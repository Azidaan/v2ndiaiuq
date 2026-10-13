import { useEffect, useState } from "react";
import { startOctopusPets } from "./engine";

const STORAGE_KEY = "ipii-octopus-off";

const readOff = () => {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
};
const writeOff = (value: boolean) => {
  try { localStorage.setItem(STORAGE_KEY, value ? "1" : "0"); } catch { /* приватный режим */ }
};

/**
 * Осьминоги-питомцы и кнопка, которая их убирает. Выбор запоминается в браузере.
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
    // Маленькая круглая кнопка: полноразмерная надпись перекрывала кнопки сайта
    // в левом нижнем углу. Пояснение — во всплывающей подсказке и для скринридера.
    <button
      type="button"
      data-octopus-toggle=""
      aria-pressed={!off}
      aria-label={off ? "Вернуть осьминогов" : "Убрать осьминогов"}
      title={off ? "Вернуть осьминогов" : "Убрать осьминогов"}
      onClick={() => { const next = !off; writeOff(next); setOff(next); }}
      className={`fixed bottom-3 left-3 z-40 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/90 text-base shadow-sm backdrop-blur transition hover:border-accent ${off ? "opacity-50 grayscale" : ""}`}
    >
      <span aria-hidden="true">🐙</span>
    </button>
  );
}
