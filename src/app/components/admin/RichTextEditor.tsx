import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bold, Crop, ImagePlus, Italic, List, ListOrdered, RotateCcw, Strikethrough, Trash2, Underline } from "lucide-react";
import { fileStorage } from "../../lib/fileStorage";
import { parseInlineFocus, sanitizeHtml } from "../../lib/sanitize";
import { imageBlocks, insertImageRow, ensureImageBlock, addBeside, removeImageBlock, separateImageRow } from "../../lib/imageBlocks";
import InlineImageCropper from "../ui/InlineImageCropper";
import InlinePhotoFocusPanel from "./InlinePhotoFocusPanel";
import { applyInlinePhotoPresentation, observeInlinePhotoPresentation, photoFit, photoZoom, type PhotoFit } from "../../lib/inlinePhotoPresentation";

export default function RichTextEditor({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const photoToolbarRef = useRef<HTMLDivElement>(null);
  const [photoToolbarPosition, setPhotoToolbarPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const editingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Позиция курсора на момент нажатия кнопки: загрузка файла асинхронная,
  // и к её концу выделение в редакторе уже потеряно.
  const savedRangeRef = useRef<Range | null>(null);
  // Держим не сам узел, а его номер: onBlur пересобирает innerHTML, и прямая
  // ссылка после этого указывает на отсоединённый элемент.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const selectedBlockRef = useRef<number | null>(null);
  const pendingBlockIndex = useRef<number | null>(null);
  const [revision, refresh] = useState(0);
  const [cropping, setCropping] = useState(false);
  const [uploading, setUploading] = useState(false);

  function rememberSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    savedRangeRef.current = range.cloneRange();
  }

  /** Возвращает диапазон вставки: сохранённый курсор либо конец текста. */
  function insertionRange(editor: HTMLDivElement) {
    const saved = savedRangeRef.current;
    if (saved && editor.contains(saved.commonAncestorContainer)) return saved;
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    return range;
  }

  useEffect(() => {
    if (
      editorRef.current &&
      !editingRef.current &&
      editorRef.current.innerHTML !== value
    ) {
      editorRef.current.innerHTML = sanitizeHtml(value);
      refresh((n) => n + 1);
    }
  }, [value]);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    applyInlinePhotoPresentation(editor);
    return observeInlinePhotoPresentation(editor);
  });

  // Reserve space in this photo's row, and place React controls outside the editable HTML.
  useLayoutEffect(() => {
    const block = currentBlock();
    const row = block?.parentElement;
    const toolbar = photoToolbarRef.current;
    const wrapper = wrapperRef.current;
    if (!row || !toolbar || !wrapper) { setPhotoToolbarPosition(null); return; }
    function position() {
      if (!row || !toolbar || !wrapper) return;
      row.style.paddingTop = `${toolbar.offsetHeight + 8}px`;
      const bounds = row.getBoundingClientRect();
      const origin = wrapper.getBoundingClientRect();
      const next = { top: bounds.top - origin.top - wrapper.clientTop, left: bounds.left - origin.left - wrapper.clientLeft, width: bounds.width };
      setPhotoToolbarPosition((previous) => previous && previous.top === next.top && previous.left === next.left && previous.width === next.width ? previous : next);
    }
    position();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(position);
    observer?.observe(toolbar); observer?.observe(wrapper);
    return () => { observer?.disconnect(); row.style.removeProperty("padding-top"); };
  }, [selectedBlockIndex, selectedIndex, cropping, value, revision]);

  function emit() {
    onChange(sanitizeHtml(editorRef.current?.innerHTML ?? ""));
    refresh((n) => n + 1);
  }

  function format(command: string) {
    editorRef.current?.focus();
    document.execCommand(command);
    emit();
  }

  function selectBlock(block: HTMLElement) {
    const editor = editorRef.current!;
    selectedBlockRef.current = imageBlocks(editor).indexOf(block);
    setSelectedBlockIndex(selectedBlockRef.current);
    const image = block.querySelector("img");
    setSelectedIndex(image ? [...editor.querySelectorAll("img")].indexOf(image) : null);
    setCropping(false);
  }
  function currentBlock() {
    return editorRef.current && selectedBlockRef.current !== null ? imageBlocks(editorRef.current)[selectedBlockRef.current] : null;
  }
  function addBlock(beside = currentBlock()) {
    const editor = editorRef.current;
    if (!editor) return null;
    const block = beside ? addBeside(beside) : insertImageRow(editor, insertionRange(editor));
    selectBlock(block); emit(); return block;
  }
  function chooseFile(block: HTMLElement) {
    pendingBlockIndex.current = imageBlocks(editorRef.current!).indexOf(block);
    fileInputRef.current?.click();
  }
  async function insertImage(file: File, targetBlock?: HTMLElement | null) {
    if (!file.type.startsWith("image/")) return;
    const editor = editorRef.current;
    if (!editor) return;
    let block = targetBlock;
    if (!block) {
      const selected = currentBlock();
      block = selected && !selected.querySelector("img") ? selected : addBlock(selected);
    }
    if (!block) return;
    const blockIndex = imageBlocks(editor).indexOf(block);
    setUploading(true);
    try {
      const url = await fileStorage.upload("inline", file);
      const liveBlock = imageBlocks(editor)[blockIndex];
      if (!liveBlock) return;
      const image = document.createElement("img"); image.src = url; image.alt = "";
      image.setAttribute("data-focus", "50 50"); image.setAttribute("data-original", url);
      liveBlock.querySelector("img")?.remove(); liveBlock.prepend(image);
      selectBlock(liveBlock); emit();
    } catch (reason) {
      alert(`Не удалось загрузить картинку: ${reason instanceof Error ? reason.message : "неизвестная ошибка"}`);
    } finally { setUploading(false); }
  }
  function rangeAtPoint(x: number, y: number) {
    const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
    const range = doc.caretRangeFromPoint?.(x, y);
    if (range && editorRef.current?.contains(range.commonAncestorContainer)) savedRangeRef.current = range;
  }
  async function dropBlock(event: React.DragEvent<HTMLDivElement>) {
    const files = [...event.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
    const marker = event.dataTransfer.getData("application/x-ipii-image-block");
    if (!files.length && !marker) return;
    event.preventDefault();
    if (uploading) return;
    const editor = editorRef.current!;
    rangeAtPoint(event.clientX, event.clientY);
    const element = event.target as HTMLElement;
    let target = element.closest<HTMLElement>('figure[data-image-block="true"]');
    if (!target && element instanceof HTMLImageElement) target = ensureImageBlock(editor, element);
    if (marker && marker !== "new") {
      const moving = imageBlocks(editor)[Number(marker)];
      if (!moving || moving === target) return;
      const oldRow = moving.parentElement;
      if (target) {
        const left = event.clientX < target.getBoundingClientRect().left + target.getBoundingClientRect().width / 2;
        if (left) target.before(moving); else target.after(moving);
        target.parentElement!.setAttribute("data-gallery", String(Math.min(3, target.parentElement!.children.length)));
      } else insertImageRow(editor, insertionRange(editor), moving);
      if (oldRow?.hasAttribute("data-gallery") && !oldRow.querySelector("figure")) oldRow.remove();
      selectBlock(moving); emit(); return;
    }
    let block = target && !target.querySelector("img") ? target : addBlock(target);
    if (!files.length) return;
    for (const file of files) {
      if (!block) break;
      await insertImage(file, block);
      block = file !== files[files.length - 1] ? addBlock(currentBlock()) : null;
    }
  }

  /** Находит выбранную картинку в живом DOM по её номеру. */
  function selectedNode(): HTMLImageElement | null {
    const editor = editorRef.current;
    if (!editor || selectedIndex === null) return null;
    return editor.querySelectorAll("img")[selectedIndex] ?? null;
  }

  function updatePhotoFocus(index: number, x: number, y: number) {
    const image = editorRef.current?.querySelectorAll("img")[index];
    if (!image) return;
    const point = { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
    image.setAttribute("data-focus", `${point.x} ${point.y}`);
    image.style.objectPosition = `${point.x}% ${point.y}%`;
    emit();
  }

  function updatePhotoSize(index: number, fit: PhotoFit, zoom: number) {
    const image = editorRef.current?.querySelectorAll("img")[index];
    if (!image) return;
    if (fit === "original") { image.removeAttribute("data-fit"); image.removeAttribute("data-zoom"); }
    else { image.setAttribute("data-fit", fit); image.setAttribute("data-zoom", String(zoom)); }
    applyInlinePhotoPresentation(editorRef.current!);
    emit();
  }

  function restorePhoto(index: number) {
    const image = editorRef.current?.querySelectorAll("img")[index];
    const original = image?.getAttribute("data-original");
    if (!image || !original) return;
    image.src = original;
    updatePhotoSize(index, "contain", 100);
  }

  function resetPhoto(index: number) {
    const image = editorRef.current?.querySelectorAll("img")[index];
    if (!image) return;
    image.setAttribute("data-focus", "50 50");
    image.removeAttribute("data-fit"); image.removeAttribute("data-zoom");
    applyInlinePhotoPresentation(editorRef.current!);
    emit();
  }

  /** Загружает обрезанную копию и подменяет адрес. Оригинал на диске остаётся. */
  async function applyCrop(blob: Blob) {
    const image = selectedNode();
    if (!image) return;
    setUploading(true);
    try {
      const file = new File([blob], `crop-${Date.now()}.jpg`, { type: "image/jpeg" });
      const original = image.getAttribute("data-original") || image.getAttribute("src") || "";
      image.src = await fileStorage.upload("inline", file);
      if (original) image.setAttribute("data-original", original);
      setCropping(false);
      emit();
    } catch (reason) {
      alert(`Не удалось сохранить обрезку: ${reason instanceof Error ? reason.message : "неизвестная ошибка"}`);
    } finally {
      setUploading(false);
    }
  }

  const controls = [
    { command: "bold", label: "Жирный", Icon: Bold },
    { command: "italic", label: "Курсив", Icon: Italic },
    { command: "underline", label: "Подчеркнуть", Icon: Underline },
    { command: "strikeThrough", label: "Зачеркнуть", Icon: Strikethrough },
    { command: "insertUnorderedList", label: "Маркированный список", Icon: List },
    { command: "insertOrderedList", label: "Нумерованный список", Icon: ListOrdered },
  ];

  const selectedImage = selectedNode();
  const selectedBlock = currentBlock();
  const photos = [...(editorRef.current?.querySelectorAll("img") ?? [])].map((image) => ({
    src: image.getAttribute("src") ?? "",
    ...(parseInlineFocus(image.getAttribute("data-focus")) ?? { x: 50, y: 50 }),
    caption: image.closest("figure")?.querySelector("figcaption")?.textContent ?? image.getAttribute("alt") ?? "",
    fit: photoFit(image), zoom: photoZoom(image),
    naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
    cropped: !!image.getAttribute("data-original") && image.getAttribute("data-original") !== image.getAttribute("src"),
  }));

  return (
    <div ref={wrapperRef} className="admin-editor">
      <div
        className="admin-editor-toolbar"
        role="toolbar"
        aria-label="Форматирование текста"
      >
        {controls.map(({ command, label, Icon }) => (
          <button
            key={command}
            type="button"
            title={label}
            aria-label={label}
            onMouseDown={(event) => {
              event.preventDefault();
              format(command);
            }}
          >
            <Icon size={16} />
          </button>
        ))}
        <button
          type="button"
          title={uploading ? "Загружаем..." : "Добавить блок картинки или перетащить его в текст"}
          aria-label="Добавить блок картинки"
          draggable={!uploading}
          onDragStart={(event) => { rememberSelection(); event.dataTransfer.setData("application/x-ipii-image-block", "new"); event.dataTransfer.effectAllowed = "copy"; }}
          style={{ width: "auto", padding: "0 0.6rem", gap: "0.35rem" }}
          disabled={uploading}
          // preventDefault не даёт редактору потерять фокус, поэтому курсор
          // остаётся там, куда пользователь его поставил.
          onMouseDown={(event) => {
            event.preventDefault();
            rememberSelection();
          }}
          onClick={() => addBlock()}
        >
          <ImagePlus size={16} /> Картинка
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={async (event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            let block = pendingBlockIndex.current !== null ? imageBlocks(editorRef.current!)[pendingBlockIndex.current] : null;
            pendingBlockIndex.current = null;
            for (const file of files) {
              await insertImage(file, block);
              if (file !== files[files.length - 1]) block = addBlock(currentBlock());
            }
          }}
        />
      </div>

      {!compact && <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">Перетащите «Картинка» в текст или нажмите кнопку. Фото можно загрузить в блок с компьютера; чтобы разместить ещё одно рядом, выберите блок и нажмите «Добавить справа».</p>}
      {selectedBlock && <div ref={photoToolbarRef} aria-label="Редактирование выбранного фото" className="absolute z-20 rounded border border-accent bg-card shadow-sm"
        style={photoToolbarPosition ? { ...photoToolbarPosition } : { visibility: "hidden", width: "calc(100% - 2rem)" }}>
      {selectedBlock && !cropping && (
        <div className="border-b border-border bg-secondary/40 p-3 flex flex-wrap items-center gap-2 text-xs">
          <button type="button" disabled={uploading} className="rounded border border-border px-2 py-1" onClick={() => chooseFile(selectedBlock)}>{selectedBlock.querySelector("img") ? "Заменить фото" : "Загрузить фото"}</button>
          <button type="button" disabled={uploading} className="rounded border border-border px-2 py-1" onClick={() => addBlock(selectedBlock)}>Добавить справа</button>
          <label className="flex items-center gap-1">Фото в ряду:
            <select aria-label="Фото в ряду" value={selectedBlock.parentElement?.getAttribute("data-gallery") ?? "1"} onChange={(e) => { selectedBlock.parentElement?.setAttribute("data-gallery", e.target.value); emit(); }} className="rounded border border-border p-1">
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button type="button" disabled={uploading} className="rounded border border-border px-2 py-1" onClick={() => { const before = selectedBlock.previousElementSibling; if (before) { before.before(selectedBlock); selectBlock(selectedBlock); emit(); } }}>← Левее</button>
          <button type="button" disabled={uploading} className="rounded border border-border px-2 py-1" onClick={() => { const after = selectedBlock.nextElementSibling; if (after) { after.after(selectedBlock); selectBlock(selectedBlock); emit(); } }}>Правее →</button>
          <button type="button" disabled={uploading} className="rounded border border-border px-2 py-1" onClick={() => { separateImageRow(selectedBlock); selectBlock(selectedBlock); emit(); }}>С новой строки</button>
          <button type="button" disabled={uploading} className="rounded border border-border px-2 py-1 text-red-600" onClick={() => { removeImageBlock(selectedBlock); setSelectedBlockIndex(null); selectedBlockRef.current = null; setSelectedIndex(null); emit(); }}>Удалить блок</button>
          <label className="basis-full flex items-center gap-2">Подпись:
            <input aria-label="Подпись к фотографии" className="min-w-0 flex-1 rounded border border-border bg-card p-1.5" value={selectedBlock.querySelector("figcaption")?.textContent ?? ""} onChange={(e) => { let caption = selectedBlock.querySelector("figcaption"); if (!caption) { caption = document.createElement("figcaption"); selectedBlock.append(caption); } caption.textContent = e.target.value; emit(); }} />
          </label>
        </div>
      )}
      {selectedImage && cropping && (
        <InlineImageCropper
          src={selectedImage.getAttribute("data-original") || selectedImage.src}
          busy={uploading}
          onCancel={() => setCropping(false)}
          onApply={(blob) => void applyCrop(blob)}
        />
      )}

      {selectedImage && !cropping && (
        <div
          // Без этого клик по панели уводит фокус, срабатывает onBlur и
          // пересобирает содержимое — выбранная картинка становится чужим узлом.
          onMouseDown={(event) => event.preventDefault()}
          className="flex flex-wrap items-start gap-3 border-b border-border bg-secondary/40 p-3"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground">Выбрано фото {(selectedIndex ?? 0) + 1}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Точка фокуса настраивается отдельно для каждой фотографии под полем текста.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => setCropping(true)}
                className="inline-flex items-center gap-1 rounded border border-accent px-2 py-1 text-[11px] text-accent hover:bg-accent hover:text-accent-foreground"
              >
                <Crop size={12} aria-hidden="true" /> Обрезать
              </button>
              {selectedImage.getAttribute("data-original") &&
                selectedImage.getAttribute("data-original") !== selectedImage.getAttribute("src") && (
                <button
                  type="button"
                  onClick={() => {
                    const image = selectedNode();
                    const original = image?.getAttribute("data-original");
                    if (!image || !original) return;
                    image.src = original;
                    emit();
                  }}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-accent"
                >
                  <RotateCcw size={12} aria-hidden="true" /> Вернуть оригинал
                </button>
              )}
              <button
                type="button"
                onClick={() => { selectedImage.remove(); setSelectedIndex(null); emit(); }}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-red-600 hover:border-red-400"
              >
                <Trash2 size={12} aria-hidden="true" /> Удалить картинку
              </button>
              <button
                type="button"
                onClick={() => selectedIndex !== null && resetPhoto(selectedIndex)}
                className="rounded border border-border px-2 py-1 text-[11px] text-accent"
              >Сбросить настройки фото</button>
              <button
                type="button"
                onClick={() => { setSelectedIndex(null); setSelectedBlockIndex(null); selectedBlockRef.current = null; }}
                className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-accent"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
      </div>}

      <div
        ref={editorRef}
        contentEditable={!uploading}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        tabIndex={0}
        spellCheck
        onFocus={() => { editingRef.current = true; }}
        onLoadCapture={() => refresh((n) => n + 1)}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onClick={(event) => {
          rememberSelection();
          const target = event.target as HTMLElement;
          if (!editorRef.current) return;
          const block = target instanceof HTMLImageElement ? ensureImageBlock(editorRef.current, target) : target.closest<HTMLElement>('figure[data-image-block="true"]');
          if (block) { selectBlock(block); if (!block.querySelector("img")) chooseFile(block); }
          else { setSelectedIndex(null); setSelectedBlockIndex(null); selectedBlockRef.current = null; setCropping(false); }
        }}
        onDragStart={(event) => {
          if (!(event.target instanceof HTMLImageElement)) return;
          const block = ensureImageBlock(editorRef.current!, event.target);
          event.dataTransfer.setData("application/x-ipii-image-block", String(imageBlocks(editorRef.current!).indexOf(block)));
          event.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(event) => { if (event.dataTransfer.types.includes("Files") || event.dataTransfer.types.includes("application/x-ipii-image-block")) event.preventDefault(); }}
        onDrop={(event) => void dropBlock(event)}
        onPaste={(event) => {
          rememberSelection();
          // Скриншот из буфера иначе попал бы в базу строкой base64 на мегабайты.
          const file = [...event.clipboardData.items]
            .find((entry) => entry.kind === "file" && entry.type.startsWith("image/"))
            ?.getAsFile();
          if (!file) return;
          event.preventDefault();
          void insertImage(file);
        }}
        onBlur={(event) => {
          editingRef.current = false;
          const normalized = sanitizeHtml(event.currentTarget.innerHTML);
          if (event.currentTarget.innerHTML !== normalized) event.currentTarget.innerHTML = normalized;
          onChange(normalized);
        }}
        onInput={(event) => onChange(sanitizeHtml(event.currentTarget.innerHTML))}
        data-placeholder="Введите текст..."
        className={`admin-editor-content ${compact ? "min-h-[150px]" : "min-h-[320px]"}`}
      />
      <InlinePhotoFocusPanel photos={photos} disabled={uploading} onChange={updatePhotoFocus} onSizeChange={updatePhotoSize} onRestore={restorePhoto} onReset={resetPhoto} />
    </div>
  );
}
