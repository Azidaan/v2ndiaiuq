/** Convert the legacy hover cards to portable image rows, including already sanitized imports. */
export function migrateGalleries(container) {
  const doc = container.ownerDocument;
  const cards = [...container.querySelectorAll("div")].filter((el) => {
    const heading = el.querySelector(":scope > h4");
    if (!heading || el.querySelectorAll("img").length !== 1) return false;
    const copy = el.cloneNode(true); copy.querySelector("h4")?.remove();
    return !copy.textContent.trim();
  });
  for (const card of cards) {
    const figure = doc.createElement("figure");
    figure.setAttribute("data-image-block", "true");
    figure.append(card.querySelector("img"));
    let previous = card.previousSibling;
    while (previous && ((previous.nodeType === 3 && !previous.textContent.trim()) ||
      (previous.nodeType === 1 && /^(BR|A|P)$/.test(previous.nodeName) && !previous.textContent.trim() && !previous.querySelector("img")))) {
      const before = previous.previousSibling; previous.remove(); previous = before;
    }
    let row = previous?.nodeType === 1 && previous.hasAttribute("data-gallery") ? previous : null;
    if (!row) { row = doc.createElement("div"); row.setAttribute("data-gallery", "3"); card.before(row); }
    row.append(figure); card.remove();
  }
  for (const row of container.querySelectorAll("[data-gallery]")) {
    row.setAttribute("data-gallery", String(Math.min(3, row.querySelectorAll(":scope > figure").length) || 1));
  }
  return cards.length;
}
