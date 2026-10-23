/** Image rows use a small, sanitized HTML vocabulary shared by the editor and article view. */
export function imageBlocks(editor: HTMLElement): HTMLElement[] {
  return [...editor.querySelectorAll<HTMLElement>('figure[data-image-block="true"]')];
}

export function createImageBlock(document: Document) {
  const block = document.createElement("figure");
  block.setAttribute("data-image-block", "true");
  return block;
}

export function insertImageRow(editor: HTMLElement, range: Range, block = createImageBlock(editor.ownerDocument)) {
  const doc = editor.ownerDocument;
  const row = doc.createElement("div");
  row.setAttribute("data-gallery", "1");
  row.append(block);
  let element = range.startContainer.nodeType === 1 ? range.startContainer as Element : range.startContainer.parentElement;
  while (element && element.parentElement !== editor) element = element.parentElement;
  if (range.startContainer === editor) {
    editor.insertBefore(row, editor.childNodes[range.startOffset] ?? null);
  } else if (element?.parentElement === editor && /^(P|H2|H3|H4|BLOCKQUOTE)$/.test(element.tagName)) {
    const tailRange = range.cloneRange();
    tailRange.setEnd(element, element.childNodes.length);
    const tail = doc.createElement("p");
    tail.append(tailRange.extractContents());
    element.after(row);
    if (tail.textContent || tail.querySelector("img")) row.after(tail);
    if (!element.textContent && !element.querySelector("img")) element.remove();
  } else if (element?.parentElement === editor) {
    element.after(row);
  } else {
    editor.append(row);
  }
  const after = doc.createElement("p"); after.append(doc.createElement("br"));
  if (!row.nextSibling) row.after(after);
  return block;
}

export function ensureImageBlock(editor: HTMLElement, image: HTMLImageElement) {
  let block = image.closest("figure") as HTMLElement | null;
  if (!block) {
    const range = editor.ownerDocument.createRange(); range.setStartBefore(image); range.collapse(true);
    block = insertImageRow(editor, range);
    block.append(image);
  } else {
    block.setAttribute("data-image-block", "true");
    if (!block.parentElement?.hasAttribute("data-gallery")) {
      const row = editor.ownerDocument.createElement("div"); row.setAttribute("data-gallery", "1");
      block.before(row); row.append(block);
    }
  }
  return block;
}

export function addBeside(block: HTMLElement) {
  const next = createImageBlock(block.ownerDocument);
  block.after(next);
  const row = block.parentElement!;
  row.setAttribute("data-gallery", String(Math.min(3, row.querySelectorAll(":scope > figure").length)));
  return next;
}

export function removeImageBlock(block: HTMLElement) {
  const row = block.parentElement;
  block.remove();
  if (row?.hasAttribute("data-gallery") && !row.querySelector("figure")) row.remove();
}

export function separateImageRow(block: HTMLElement) {
  const previous = block.parentElement!;
  const row = block.ownerDocument.createElement("div"); row.setAttribute("data-gallery", "1");
  previous.after(row); row.append(block);
  if (!previous.querySelector("figure")) previous.remove();
}
