import { useEffect, useRef, type HTMLAttributes } from "react";
import { parseInlineFocus, sanitizeHtml } from "../lib/sanitize";

/**
 * Вывод размеченного текста. Картинки внутри текста могут нести data-focus:
 * атрибут стилями не применить, поэтому object-position проставляется после
 * вставки разметки. Через sanitizeHtml проходит всё, включая эти картинки.
 */
export default function SafeHtml({ html, ...props }: HTMLAttributes<HTMLDivElement> & { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    for (const image of root.querySelectorAll("img[data-focus]")) {
      const focus = parseInlineFocus(image.getAttribute("data-focus"));
      if (!(image instanceof HTMLImageElement) || !focus) continue;
      image.style.objectPosition = `${focus.x}% ${focus.y}%`;
    }
  }, [html]);

  return <div ref={ref} {...props} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}
