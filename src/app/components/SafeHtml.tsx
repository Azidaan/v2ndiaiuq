import { useEffect, useRef, type HTMLAttributes } from "react";
import { sanitizeHtml } from "../lib/sanitize";
import { applyInlinePhotoPresentation, observeInlinePhotoPresentation } from "../lib/inlinePhotoPresentation";

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
    applyInlinePhotoPresentation(root);
    return observeInlinePhotoPresentation(root);
  }, [html]);

  return <div ref={ref} {...props} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}
