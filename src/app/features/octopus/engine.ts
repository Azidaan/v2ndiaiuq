import { FRAMES, buildSprites, type SpriteSet } from "./sprite";

/**
 * Осьминоги-питомцы поверх страницы. Один прозрачный canvas на весь экран,
 * pointer-events: none — клики проходят сквозь него к сайту.
 *
 * Движение построено на силах, а не на маршрутах: у осьминога есть скорость,
 * и на неё каждый кадр действуют ускорения. Курсор отталкивает тем сильнее, чем
 * ближе; текст и кнопки выталкивают; соседи расходятся; трение гасит скорость.
 * Из-за этого разгон, торможение и повороты получаются плавными, без рывков.
 */

const BUSY_SELECTOR = [
  "header", "footer", "nav",
  "main :is(h1,h2,h3,h4,h5,p,li,dt,dd,a,button,img,video,iframe,input,textarea,select,label,table,blockquote,figure,form,pre)",
  "main [role=img]",
  "[data-octopus-toggle]",
  "[role=dialog]",
].join(",");

const SCALE = 0.7;               // осьминоги на 30% меньше исходного эскиза
const BUSY_REFRESH_MS = 250;
const PAD = 6;                   // зазор до контента

// Силы и скорости, px/с и px/с²
const WANDER_PULL = 220;         // тяга к выбранной точке
const WANDER_CAP = 46;
const FLEE_PUSH = 1400;          // отталкивание от курсора
const FLEE_CAP = 280;
// Отталкивание — пружина: сила растёт с глубиной захода, а не включается
// сразу на полную. Иначе у края текста осьминог дрожал, то влетая, то выскакивая.
const CONTENT_SPRING = 45;       // px/с² на пиксель захода
const CONTENT_MAX = 700;
const NEIGHBOR_PUSH = 200;
const NEIGHBOR_GAP = 90;
const EDGE_SPRING = 30;

// Сглаживание, 1/с: насколько быстро новое значение догоняет требуемое.
const STEER_SMOOTH = 4;          // ускорение — плавные повороты
const CAP_SMOOTH = 1.6;          // предел скорости — плавное торможение после испуга
const DRAG_SMOOTH = 2;
const ANIM_MAX_SPEED = 160;      // выше этой скорости щупальца быстрее не перебирают
const DRAG_CALM = 3;             // трение в покое: быстро останавливается
const DRAG_SCARED = 0.6;         // трение при испуге: долго катится по инерции
const WANDER_RANGE = 320;

// Пузырьки — след от бега: всплывают, покачиваясь, подрастают и лопаются.
const BUBBLE_MIN_SPEED = 90;     // медленнее этого пузырьков нет
const BUBBLE_RATE = 16;          // штук в секунду на полной скорости бегства
const BUBBLE_LIMIT = 70;

type Bubble = { x: number; y: number; vx: number; vy: number; age: number; life: number; seed: number; size: number };
type Rect = { x: number; y: number; w: number; h: number };
type Pet = {
  x: number; y: number; vx: number; vy: number;
  ax: number; ay: number;        // сглаженное ускорение
  cap: number; drag: number;     // сглаженные предел скорости и трение
  tx: number; ty: number;
  idle: number;
  scaredUntil: number;
  phase: number;
  alpha: number;
};

const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function startOctopusPets(): () => void {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.octopusCanvas = "";
  Object.assign(canvas.style, {
    position: "fixed", inset: "0", width: "100vw", height: "100vh",
    pointerEvents: "none", zIndex: "35",
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return () => undefined; }

  let vw = 0, vh = 0, dpr = 1;
  let sprites: SpriteSet | null = null;
  const fit = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth; vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const cell = (vw < 760 ? 2 : 3) * SCALE;
    if (!sprites || sprites.cell !== cell) sprites = buildSprites(cell);
  };
  fit();
  const sp = () => sprites!;

  const count = vw < 760 ? 1 : vw < 1200 ? 2 : 3;
  const touch = matchMedia("(pointer: coarse)").matches;
  const fleeRadius = touch ? 110 : 150;

  /** Занятая рисунком область в координатах окна. */
  const boxAt = (x: number, y: number): Rect => {
    const { box, cell } = sp();
    return { x: x + box.x * cell, y: y + box.y * cell, w: box.w * cell, h: box.h * cell };
  };

  // ---- где на экране занято ----
  let busy: Rect[] = [];
  const range = document.createRange();
  const measure = () => {
    const next: Rect[] = [];
    const add = (r: DOMRect) => {
      if (r.width === 0 || r.height === 0) return;
      if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return;
      next.push({ x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 });
    };
    for (const el of document.querySelectorAll(BUSY_SELECTOR)) add(el.getBoundingClientRect());
    // Текст ищем по самим текстовым узлам: анонсы и подписи выводятся в div и
    // span, и список тегов их пропускал. Range даёт границы строк, а не блока.
    const main = document.querySelector("main");
    if (main) {
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => (node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
      });
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const top = node.parentElement?.getBoundingClientRect();
        if (!top || top.bottom < 0 || top.top > vh) continue;
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) add(r);
      }
    }
    busy = next;
  };

  const pets: Pet[] = [];
  const isFree = (x: number, y: number, self?: Pet) => {
    const b = boxAt(x, y);
    if (b.x < 8 || b.y < 80 || b.x + b.w > vw - 8 || b.y + b.h > vh - 8) return false;
    for (const r of busy) if (intersects(b, r)) return false;
    for (const o of pets) if (o !== self && intersects(b, boxAt(o.x, o.y))) return false;
    return true;
  };
  /** Свободная точка поблизости; если не нашлась — остаёмся на месте. */
  const chooseSpot = (pet: Pet | null) => {
    for (let tries = 0; tries < 60; tries++) {
      const x = pet ? pet.x + rand(-WANDER_RANGE, WANDER_RANGE) : rand(0, vw);
      const y = pet ? pet.y + rand(-WANDER_RANGE * 0.6, WANDER_RANGE * 0.6) : rand(80, vh);
      if (isFree(x, y, pet ?? undefined)) return { x, y };
    }
    return pet ? { x: pet.x, y: pet.y } : { x: rand(0, vw - 100), y: rand(100, vh - 100) };
  };

  measure();
  for (let i = 0; i < count; i++) {
    const spot = chooseSpot(null);
    pets.push({ x: spot.x, y: spot.y, vx: 0, vy: 0, ax: 0, ay: 0, cap: WANDER_CAP, drag: DRAG_CALM, tx: spot.x, ty: spot.y,
      idle: rand(0.5, 2.5), scaredUntil: 0, phase: rand(0, FRAMES), alpha: 0 });
  }

  // ---- курсор ----
  let pointer = { x: -9999, y: -9999, at: 0 };
  const onPointer = (e: PointerEvent) => { pointer = { x: e.clientX, y: e.clientY, at: performance.now() }; };
  const onLeave = () => { pointer.at = 0; };
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("pointerdown", onPointer, { passive: true });
  document.addEventListener("pointerleave", onLeave);
  const onResize = () => { fit(); measure(); };
  window.addEventListener("resize", onResize);
  const onScroll = () => measure();
  window.addEventListener("scroll", onScroll, { passive: true });
  const timer = window.setInterval(measure, BUSY_REFRESH_MS);

  // ---- пузырьки ----
  const bubbles: Bubble[] = [];
  const BUBBLE_EDGE = "#7FB2F0";
  const BUBBLE_FILL = "rgba(191, 220, 250, 0.35)";

  /** Пиксельный пузырёк: кольцо без углов и белый блик. size 1–3 клетки радиуса. */
  const drawBubble = (x: number, y: number, size: number, cell: number) => {
    const c = Math.max(1, Math.round(cell));
    const ox = Math.round(x), oy = Math.round(y);
    const dot = (i: number, j: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(ox + i * c, oy + j * c, c, c); };
    if (size <= 1) { dot(0, 0, BUBBLE_EDGE); return; }
    const n = size + 1;                                   // сторона кольца в клетках
    for (let i = 1; i < n; i++) for (let j = 1; j < n; j++) dot(i, j, BUBBLE_FILL);
    for (let i = 1; i < n; i++) { dot(i, 0, BUBBLE_EDGE); dot(i, n, BUBBLE_EDGE); dot(0, i, BUBBLE_EDGE); dot(n, i, BUBBLE_EDGE); }
    dot(1, 1, "#FFFFFF");                                 // блик
  };

  const emitBubbles = (pet: Pet, b: Rect, dt: number) => {
    const speed = Math.hypot(pet.vx, pet.vy);
    if (speed < BUBBLE_MIN_SPEED || bubbles.length >= BUBBLE_LIMIT) return;
    const rate = BUBBLE_RATE * Math.min(1, (speed - BUBBLE_MIN_SPEED) / (FLEE_CAP - BUBBLE_MIN_SPEED));
    if (Math.random() > rate * dt) return;
    // Позади осьминога, у основания щупалец: против направления движения.
    const nx = pet.vx / speed, ny = pet.vy / speed;
    bubbles.push({
      x: b.x + b.w / 2 - nx * b.w * 0.45 + rand(-6, 6),
      y: b.y + b.h * 0.55 - ny * b.h * 0.3 + rand(-4, 4),
      vx: -pet.vx * 0.12 + rand(-10, 10),
      vy: -rand(30, 60),                                  // всплывают
      age: 0, life: rand(0.8, 1.6), seed: rand(0, Math.PI * 2),
      size: Math.random() < 0.5 ? 1 : Math.random() < 0.6 ? 2 : 3,
    });
  };

  const updateBubbles = (dt: number, cell: number) => {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const p = bubbles[i];
      p.age += dt;
      if (p.age >= p.life) { bubbles.splice(i, 1); continue; }
      p.vx -= p.vx * 2 * dt;
      p.x += (p.vx + Math.sin(p.age * 7 + p.seed) * 14) * dt;   // покачивание
      p.y += p.vy * dt;
      const t = p.age / p.life;
      const grown = Math.min(3, p.size + (t > 0.6 ? 1 : 0));   // подрастает перед тем, как лопнуть
      ctx.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
      drawBubble(p.x, p.y, grown, cell);
    }
    ctx.globalAlpha = 1;
  };

  // ---- главный цикл ----
  let last = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, vw, vh);
    const s = sp();
    const pointerLive = now - pointer.at < 2000;
    // Пузырьки рисуем первыми — они остаются позади осьминогов.
    updateBubbles(dt, s.cell);

    for (const pet of pets) {
      const b = boxAt(pet.x, pet.y);
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const md = pointerLive ? Math.hypot(pointer.x - cx, pointer.y - cy) || 1 : Infinity;
      let ax = 0, ay = 0, cap = WANDER_CAP;
      const scared = md < fleeRadius;

      if (scared) {
        // Чем ближе курсор, тем сильнее толчок от него.
        const k = (fleeRadius - md) / fleeRadius;
        ax += ((cx - pointer.x) / md) * FLEE_PUSH * (0.4 + k);
        ay += ((cy - pointer.y) / md) * FLEE_PUSH * (0.4 + k);
        cap = FLEE_CAP;
        pet.scaredUntil = now + 700;
        pet.idle = rand(0.8, 1.6);            // после испуга постоит, а не сразу пойдёт
        pet.tx = pet.x; pet.ty = pet.y;
      } else {
        pet.idle -= dt;
        const d = Math.hypot(pet.tx - pet.x, pet.ty - pet.y);
        if (d < 6) {
          if (pet.idle < 0) { const spot = chooseSpot(pet); pet.tx = spot.x; pet.ty = spot.y; pet.idle = rand(1.5, 5); }
        } else if (pet.idle < 0) {
          ax += ((pet.tx - pet.x) / d) * WANDER_PULL;
          ay += ((pet.ty - pet.y) / d) * WANDER_PULL;
        }
      }

      for (const o of pets) {                   // не слипаются
        if (o === pet) continue;
        const dx = pet.x - o.x, dy = pet.y - o.y, d = Math.hypot(dx, dy) || 1;
        if (d < NEIGHBOR_GAP) { ax += (dx / d) * NEIGHBOR_PUSH; ay += (dy / d) * NEIGHBOR_PUSH; }
      }

      for (const r of busy) {                   // выталкиваются из-под контента
        if (!intersects(b, r)) continue;
        const left = b.x + b.w - r.x, right = r.x + r.w - b.x;
        const up = b.y + b.h - r.y, down = r.y + r.h - b.y;
        const m = Math.min(left, right, up, down);
        const push = Math.min(CONTENT_MAX, m * CONTENT_SPRING);
        if (m === left) ax -= push;
        else if (m === right) ax += push;
        else if (m === up) ay -= push;
        else ay += push;
        if (!scared && Math.random() < dt * 0.5) { const spot = chooseSpot(pet); pet.tx = spot.x; pet.ty = spot.y; }
      }

      if (b.x < 8) ax += (8 - b.x) * EDGE_SPRING;
      if (b.x + b.w > vw - 8) ax -= (b.x + b.w - vw + 8) * EDGE_SPRING;
      if (b.y < 80) ay += (80 - b.y) * EDGE_SPRING;            // под шапкой не ходят
      if (b.y + b.h > vh - 8) ay -= (b.y + b.h - vh + 8) * EDGE_SPRING;

      // Ускорение, предел скорости и трение догоняют требуемые значения
      // постепенно — отсюда плавные повороты и мягкое торможение после испуга.
      // На испуг реагируем быстрее, чтобы не выглядело заторможенно.
      const steer = Math.min(1, dt * (scared ? STEER_SMOOTH * 2.5 : STEER_SMOOTH));
      pet.ax += (ax - pet.ax) * steer;
      pet.ay += (ay - pet.ay) * steer;
      pet.cap += (cap - pet.cap) * Math.min(1, dt * (cap > pet.cap ? 8 : CAP_SMOOTH));
      pet.drag += ((scared ? DRAG_SCARED : DRAG_CALM) - pet.drag) * Math.min(1, dt * DRAG_SMOOTH);

      pet.vx += pet.ax * dt; pet.vy += pet.ay * dt;
      const speed = Math.hypot(pet.vx, pet.vy);
      if (speed > pet.cap) { pet.vx *= pet.cap / speed; pet.vy *= pet.cap / speed; }
      pet.vx -= pet.vx * pet.drag * dt; pet.vy -= pet.vy * pet.drag * dt;
      pet.x += pet.vx * dt; pet.y += pet.vy * dt;
      emitBubbles(pet, b, dt);

      // Щупальца перебирают быстрее на ходу, но с потолком — иначе на бегу мелькали.
      pet.phase += dt * (1.6 + Math.min(ANIM_MAX_SPEED, Math.hypot(pet.vx, pet.vy)) * 0.045);
      pet.alpha += (1 - pet.alpha) * Math.min(1, dt * 4);

      const afraid = now < pet.scaredUntil;
      const frame = Math.floor(pet.phase % FRAMES);
      ctx.globalAlpha = pet.alpha;
      ctx.drawImage((afraid ? s.scared : s.walk)[frame], Math.round(pet.x), Math.round(pet.y));
      if (afraid) {
        const c = Math.max(2, Math.round(s.cell));
        const ex = Math.round(cx - c / 2), ey = Math.round(b.y - c * 5);
        ctx.fillStyle = "#E8473D";
        ctx.fillRect(ex, ey, c, c * 2.5);
        ctx.fillRect(ex, ey + c * 3, c, c);
      }
      ctx.globalAlpha = 1;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.clearInterval(timer);
    window.removeEventListener("pointermove", onPointer);
    window.removeEventListener("pointerdown", onPointer);
    document.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("scroll", onScroll);
    canvas.remove();
  };
}
