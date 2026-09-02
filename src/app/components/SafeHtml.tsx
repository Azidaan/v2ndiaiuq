import type { HTMLAttributes } from "react";
import { sanitizeHtml } from "../lib/sanitize";

export default function SafeHtml({ html, ...props }: HTMLAttributes<HTMLDivElement> & { html: string }) {
  return <div {...props} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}
