import { BODY_CENTER, FRAMES, UNFOLD_STEPS, buildSprites, type SpriteSet } from "./sprite";

/**
 * Осьминоги-питомцы поверх страницы. Один прозрачный canvas на весь экран,
 * pointer-events: none — клики проходят сквозь него к сайту.
 *
 * Движение построено на силах, а не на маршрутах: у осьминога есть скорость,
 * и на неё каждый кадр действуют ускорения. Курсор отталкивает тем сильнее, чем
 * ближе; текст и кнопки выталкивают; соседи расходятся; трение гасит скорость.
 *
 * Осьминога можно схватить мышью или пальцем. В руке он поджимает щупальца и
 * висит, покачиваясь; после броска летит кометой — головой вперёд, щупальца
 * пучком назад, за ним тянется хвост из искр и пузырьков. От краёв экрана
 * отскакивает; если ударился сильно или его долго трясли — выпускает чернила.
 * Глаза следят за курсором.
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
const WANDER_PULL = 220;
const WANDER_CAP = 46;
const FLEE_PUSH = 1400;
const FLEE_CAP = 280;
// Отталкивание — пружина: сила растёт с глубиной захода, а не включается
// сразу на полную. Иначе у края текста осьминог дрожал.
const CONTENT_SPRING = 45;
const CONTENT_MAX = 700;
const NEIGHBOR_PUSH = 200;
const NEIGHBOR_GAP = 90;
const EDGE_SPRING = 30;

// Сглаживание, 1/с: насколько быстро новое значение догоняет требуемое.
const STEER_SMOOTH = 4;
const CAP_SMOOTH = 1.6;
const DRAG_SMOOTH = 2;
const ANIM_MAX_SPEED = 160;
const DRAG_CALM = 3;
const DRAG_SCARED = 0.6;
const WANDER_RANGE = 320;

// Хватание и полёт
const THROW_MAX = 2400;          // предел скорости броска
const THROW_MIN = 140;           // медленнее — просто отпустили, без полёта
const FLY_DRAG = 0.9;            // в воде комета гаснет плавно
const LAND_SPEED = 70;           // ниже этой скорости комета снова становится осьминогом
const BOUNCE = 0.55;             // доля скорости после отскока от края
const INK_IMPACT = 950;          // удар сильнее — выпускает чернила
const FOLD_SPEED = 7;            // 1/с, поджимает щупальца, когда схватили (~0,15 с)
const UNFOLD_SPEED = 1.8;        // 1/с, распускает после полёта (~0,55 с)
const SHAKE_FLIPS = 5;           // столько разворотов за секунду в руке — тоже чернила

// Догонялки: время от времени двое затевают игру. Один убегает, второй догоняет
// и, подобравшись близко, тянет к нему щупальце. Коснулся — роли меняются.
const GAME_GAP = [7, 14];        // с, пауза между играми
const GAME_LENGTH = [7, 11];     // с, сколько длится игра
const CHASE_PULL = 650;
const CHASE_CAP = 135;           // догоняющий чуть медленнее — погоня не кончается за секунду
const RUN_PUSH = 700;
const RUN_CAP = 160;
const RUN_CALM_DIST = 260;       // дальше этого убегающий не спешит
const REACH_DIST = 95;           // ближе — тянет щупальце
const TAG_DIST = 34;             // ближе — осалил
const TAG_HEAD_START = 0.9;      // с форы убегающему после смены ролей

// Пузырьки и искры
const BUBBLE_MIN_SPEED = 90;
const BUBBLE_RATE = 16;
const PARTICLE_LIMIT = 160;

type Rect = { x: number; y: number; w: number; h: number };
type Particle = {
  kind: "bubble" | "spark" | "ink";
  x: number; y: number; vx: number; vy: number;
  age: number; life: number; seed: number; size: number;
};
type Pet = {
  x: number; y: number; vx: number; vy: number;
  ax: number; ay: number;
  cap: number; drag: number;
  tx: number; ty: number;
  idle: number;
  scaredUntil: number;
  phase: number;
  alpha: number;
  mode: "free" | "held" | "flying";
  angle: number;                 // поворот спрайта в полёте и в руке
  gaze: number;
  inkCooldown: number;
  dizzyUntil: number;
  fold: number;                  // 1 — щупальца собраны в пучок кометы, 0 — веером            // оглушён ударом — над головой кружат звёздочки
  play: { role: "chase" | "run"; partner: Pet; until: number; readyAt: number } | null;
};

const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

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

  const boxAt = (x: number, y: number): Rect => {
    const { box, cell } = sp();
    return { x: x + box.x * cell, y: y + box.y * cell, w: box.w * cell, h: box.h * cell };
  };
  /** Центр тела в координатах окна — точка вращения и захвата. */
  const centerOf = (pet: Pet) => ({ x: pet.x + BODY_CENTER.x * sp().cell, y: pet.y + BODY_CENTER.y * sp().cell });

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
    pets.push({
      x: spot.x, y: spot.y, vx: 0, vy: 0, ax: 0, ay: 0, cap: WANDER_CAP, drag: DRAG_CALM,
      tx: spot.x, ty: spot.y, idle: rand(0.5, 2.5), scaredUntil: 0, phase: rand(0, FRAMES),
      alpha: 0, mode: "free", angle: 0, gaze: 3, inkCooldown: 0, dizzyUntil: 0, fold: 0, play: null,
    });
  }

  // ---- частицы: пузырьки, искры кометы, чернила ----
  const particles: Particle[] = [];
  const addParticle = (p: Omit<Particle, "age" | "seed">) => {
    if (particles.length < PARTICLE_LIMIT) particles.push({ ...p, age: 0, seed: rand(0, Math.PI * 2) });
  };

  const BUBBLE_EDGE = "#7FB2F0";
  const BUBBLE_FILL = "rgba(191, 220, 250, 0.35)";
  const drawBubble = (x: number, y: number, size: number, cell: number) => {
    const c = Math.max(1, Math.round(cell));
    const ox = Math.round(x), oy = Math.round(y);
    const dot = (i: number, j: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(ox + i * c, oy + j * c, c, c); };
    if (size <= 1) { dot(0, 0, BUBBLE_EDGE); return; }
    const n = size + 1;
    for (let i = 1; i < n; i++) for (let j = 1; j < n; j++) dot(i, j, BUBBLE_FILL);
    for (let i = 1; i < n; i++) { dot(i, 0, BUBBLE_EDGE); dot(i, n, BUBBLE_EDGE); dot(0, i, BUBBLE_EDGE); dot(n, i, BUBBLE_EDGE); }
    dot(1, 1, "#FFFFFF");
  };

  /** Чернила: пиксельный «клубок», который расплывается и тает. */
  const drawInk = (x: number, y: number, radius: number, cell: number, seed: number) => {
    const c = Math.max(2, Math.round(cell));
    const r = Math.max(1, Math.round(radius / c));
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        const d = Math.hypot(i, j) / r;
        if (d > 1) continue;
        // рваный край: часть крайних клеток пропускаем
        if (d > 0.7 && Math.sin(i * 12.9 + j * 78.2 + seed * 10) > 0.2) continue;
        ctx.fillStyle = d < 0.5 ? "#141B33" : "#26304F";
        ctx.fillRect(Math.round(x + i * c), Math.round(y + j * c), c, c);
      }
    }
  };

  /**
   * Чернила выбрасываются веером примерно на 120° в сторону direction (радианы).
   * Клубы в середине веера летят дальше, по краям — ближе: облако выходит
   * широким, а не круглым пятном.
   */
  const releaseInk = (x: number, y: number, direction: number) => {
    for (let i = 0; i < 22; i++) {
      const offset = rand(-1, 1);
      const a = direction + offset * 1.05;
      const s = rand(70, 250) * (1 - Math.abs(offset) * 0.35);
      addParticle({ kind: "ink", x: x + rand(-6, 6), y: y + rand(-4, 4), vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(1.8, 3), size: rand(5, 12) });
    }
  };

  const updateParticles = (dt: number, cell: number, kind: Particle["kind"]) => {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.kind !== kind) continue;
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      const t = p.age / p.life;
      if (p.kind === "bubble") {
        p.vx -= p.vx * 2 * dt;
        p.x += (p.vx + Math.sin(p.age * 7 + p.seed) * 14) * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
        drawBubble(p.x, p.y, Math.min(3, p.size + (t > 0.6 ? 1 : 0)), cell);
      } else if (p.kind === "spark") {
        p.vx -= p.vx * 3 * dt; p.vy -= p.vy * 3 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = t < 0.35 ? "#FFFFFF" : "#BFDCFA";
        const c = Math.max(1, Math.round(cell * p.size));
        ctx.fillRect(Math.round(p.x), Math.round(p.y), c, c);
      } else {
        // Тормозят мягче пузырьков — веер успевает широко раскрыться.
        p.vx -= p.vx * 1.6 * dt; p.vy -= p.vy * 1.6 * dt;
        p.x += p.vx * dt; p.y += (p.vy - 6) * dt;
        ctx.globalAlpha = (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85) * 0.85;
        drawInk(p.x, p.y, p.size * (0.6 + t * 0.9), cell, p.seed);
      }
    }
    ctx.globalAlpha = 1;
  };

  /** Хвост: пузырьки при беге, а у кометы ещё и искры. */
  const emitTrail = (pet: Pet, dt: number) => {
    const speed = Math.hypot(pet.vx, pet.vy);
    if (speed < BUBBLE_MIN_SPEED) return;
    const nx = pet.vx / speed, ny = pet.vy / speed;
    const c = centerOf(pet);
    const back = { x: c.x - nx * 14, y: c.y - ny * 14 };
    const comet = pet.mode === "flying";
    const rate = comet ? 70 : BUBBLE_RATE * Math.min(1, (speed - BUBBLE_MIN_SPEED) / (FLEE_CAP - BUBBLE_MIN_SPEED));
    let n = rate * dt;
    while (n > 0) {
      if (Math.random() < n) {
        if (comet && Math.random() < 0.7) {
          addParticle({ kind: "spark", x: back.x + rand(-5, 5), y: back.y + rand(-5, 5),
            vx: -pet.vx * 0.15 + rand(-25, 25), vy: -pet.vy * 0.15 + rand(-25, 25), life: rand(0.25, 0.6), size: Math.random() < 0.3 ? 2 : 1 });
        } else {
          addParticle({ kind: "bubble", x: back.x + rand(-6, 6), y: back.y + rand(-4, 4),
            vx: -pet.vx * 0.12 + rand(-10, 10), vy: -rand(30, 60), life: rand(0.8, 1.6),
            size: Math.random() < 0.5 ? 1 : Math.random() < 0.6 ? 2 : 3 });
        }
      }
      n -= 1;
    }
  };

  // ---- указатель, хватание ----
  const pointer = { x: -9999, y: -9999, at: 0, vx: 0, vy: 0, lastT: 0 };
  let held: { pet: Pet; dx: number; dy: number; flips: number[]; lastSign: number } | null = null;
  let suppressClickUntil = 0;
  let cursorSet = false;

  const hitPet = (x: number, y: number) => {
    for (let i = pets.length - 1; i >= 0; i--) {
      const pet = pets[i];
      if (pet.alpha < 0.5) continue;
      const b = boxAt(pet.x, pet.y);
      if (x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4) return pet;
    }
    return null;
  };

  const setCursor = (value: string | null) => {
    const want = value !== null;
    if (want === cursorSet && !(want && document.documentElement.style.cursor !== value)) return;
    document.documentElement.style.cursor = value ?? "";
    cursorSet = want;
  };

  const onMove = (e: PointerEvent) => {
    const now = performance.now();
    const dt = Math.max(0.008, (now - pointer.lastT) / 1000);
    if (pointer.lastT) {
      // Скорость указателя сглажена: по ней считается сила броска.
      pointer.vx = pointer.vx * 0.35 + ((e.clientX - pointer.x) / dt) * 0.65;
      pointer.vy = pointer.vy * 0.35 + ((e.clientY - pointer.y) / dt) * 0.65;
    }
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.at = now; pointer.lastT = now;
    if (held) {
      // Тряска: считаем развороты по горизонтали.
      const sign = Math.sign(pointer.vx);
      if (Math.abs(pointer.vx) > 250 && sign !== 0 && sign !== held.lastSign) {
        held.flips.push(now);
        held.lastSign = sign;
      }
      held.flips = held.flips.filter((t) => now - t < 1000);
      return;
    }
    if (!touch) setCursor(hitPet(e.clientX, e.clientY) ? "grab" : null);
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const pet = hitPet(e.clientX, e.clientY);
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.at = performance.now();
    pointer.lastT = pointer.at; pointer.vx = 0; pointer.vy = 0;
    if (!pet) return;
    // Хватание не должно нажать ссылку или выделить текст под осьминогом.
    e.preventDefault();
    e.stopPropagation();
    const c = centerOf(pet);
    held = { pet, dx: c.x - e.clientX, dy: c.y - e.clientY, flips: [], lastSign: 0 };
    pet.mode = "held";
    pet.vx = pet.vy = 0;
    document.body.style.userSelect = "none";
    setCursor("grabbing");
  };

  const onUp = (e: PointerEvent) => {
    if (!held) return;
    const pet = held.pet;
    held = null;
    document.body.style.userSelect = "";
    suppressClickUntil = performance.now() + 350;
    setCursor(touch ? null : "grab");
    const vx = clamp(pointer.vx, -THROW_MAX, THROW_MAX);
    const vy = clamp(pointer.vy, -THROW_MAX, THROW_MAX);
    if (Math.hypot(vx, vy) < THROW_MIN || e.type === "pointercancel") {
      pet.mode = "free"; pet.vx = vx * 0.2; pet.vy = vy * 0.2;
      pet.scaredUntil = performance.now() + 600;
    } else {
      pet.mode = "flying"; pet.vx = vx; pet.vy = vy;
    }
    pet.tx = pet.x; pet.ty = pet.y; pet.idle = rand(1, 2);
  };

  const onClick = (e: MouseEvent) => {
    if (performance.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); }
  };
  // Пока осьминог в руке, страница на телефоне не должна прокручиваться пальцем.
  const onTouchMove = (e: TouchEvent) => { if (held) e.preventDefault(); };
  const onLeave = () => { pointer.at = 0; };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { capture: true });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  window.addEventListener("click", onClick, { capture: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  document.addEventListener("pointerleave", onLeave);
  const onResize = () => { fit(); measure(); };
  window.addEventListener("resize", onResize);
  const onScroll = () => measure();
  window.addEventListener("scroll", onScroll, { passive: true });
  const timer = window.setInterval(measure, BUSY_REFRESH_MS);

  // ---- рисование осьминога ----
  const drawAt = (pet: Pet, image: HTMLCanvasElement, shift: number) => {
    const c = centerOf(pet);
    ctx.save();
    ctx.globalAlpha = pet.alpha;
    if (pet.angle) {
      ctx.translate(Math.round(c.x + shift), Math.round(c.y));
      ctx.rotate(pet.angle);
      ctx.drawImage(image, Math.round(pet.x - c.x), Math.round(pet.y - c.y));
    } else {
      ctx.drawImage(image, Math.round(pet.x + shift), Math.round(pet.y));
    }
    ctx.restore();
  };
  /**
   * Боковые края сквозные: пока осьминог пересекает край, он виден сразу
   * с двух сторон — уходящая часть слева, появляющаяся справа, без исчезновения.
   */
  const drawPet = (pet: Pet, image: HTMLCanvasElement) => {
    drawAt(pet, image, 0);
    if (pet.mode === "held") return;
    const b = boxAt(pet.x, pet.y);
    if (b.x < 0) drawAt(pet, image, vw);
    if (b.x + b.w > vw) drawAt(pet, image, -vw);
  };
  /** Центр тела перешёл край — переносим осьминога на противоположную сторону. */
  const wrap = (pet: Pet) => {
    const b = boxAt(pet.x, pet.y);
    const mid = b.x + b.w / 2;
    let shift = 0;
    if (mid < 0) shift = vw;
    else if (mid > vw) shift = -vw;
    if (!shift) return;
    pet.x += shift;
    // Старая цель осталась по ту сторону края — забываем её, иначе осьминог
    // развернулся бы и ушёл обратно в край, бегая по кругу.
    pet.tx = pet.x; pet.ty = pet.y;
  };

  /** Взгляд: зрачки поворачиваются в сторону курсора, без курсора — по ходу движения. */
  const gazeFor = (pet: Pet, pointerLive: boolean) => {
    const c = centerOf(pet);
    let dx = pet.vx, dy = pet.vy;
    if (pointerLive) { dx = pointer.x - c.x; dy = pointer.y - c.y; }
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return pet.gaze;
    return (dx > 0 ? 1 : 0) + (dy > 0 ? 2 : 0);
  };

/** Кадр между пучком и веером по тому, насколько осьминог сейчас сложен. */
  const foldImage = (pet: Pet, frame: number, open: HTMLCanvasElement) => {
    const k = Math.round((1 - pet.fold) * (UNFOLD_STEPS + 1)) - 1;
    if (k < 0) return sp().tucked[frame];
    if (k >= UNFOLD_STEPS) return open;
    return sp().unfold[k][frame];
  };

  // ---- столкновения: брошенный сшибает остальных ----
  const COLLIDE_DIST_CELLS = 13;   // ширина тела в клетках, чуть меньше рисунка
  const RESTITUTION = 0.85;        // доля энергии, остающаяся после удара
  const KNOCK_FLY = 170;           // задет сильнее — сам становится кометой

  /** Отправляет осьминога в полёт: из руки, после броска или от удара. */
  const launch = (pet: Pet) => {
    if (pet.play) endGame(pet);
    pet.mode = "flying";
  };

  /**
   * Упругий удар двух осьминогов одинаковой массы. Скорость передаётся вдоль
   * линии центров, как у бильярдных шаров. Сильно задетый сам летит кометой —
   * отсюда цепные столкновения; слабо задетого просто отталкивает.
   */
  const collide = (a: Pet, b: Pet) => {
    const ca = centerOf(a), cb = centerOf(b);
    const dx = cb.x - ca.x, dy = cb.y - ca.y;
    const d = Math.hypot(dx, dy);
    const min = COLLIDE_DIST_CELLS * sp().cell;
    if (d === 0 || d >= min) return;
    const nx = dx / d, ny = dy / d;
    // Расталкиваем, чтобы не застряли друг в друге.
    const overlap = (min - d) / 2;
    a.x -= nx * overlap; a.y -= ny * overlap;
    b.x += nx * overlap; b.y += ny * overlap;
    const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (approach <= 0) return;                      // уже разлетаются
    const j = approach * (1 + RESTITUTION) / 2;
    a.vx -= j * nx; a.vy -= j * ny;
    b.vx += j * nx; b.vy += j * ny;

    const mx = ca.x + nx * min / 2, my = ca.y + ny * min / 2;
    const sparks = Math.min(16, 4 + Math.round(j / 60));
    for (let i = 0; i < sparks; i++) {
      const ang = Math.atan2(ny, nx) + rand(-1.6, 1.6), s = rand(60, 200);
      addParticle({ kind: "spark", x: mx, y: my, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, life: rand(0.25, 0.55), size: Math.random() < 0.4 ? 2 : 1 });
    }
    for (let i = 0; i < 3; i++) addParticle({ kind: "bubble", x: mx + rand(-6, 6), y: my, vx: rand(-40, 40), vy: -rand(40, 90), life: rand(0.7, 1.2), size: 2 });

    const now = performance.now();
    for (const pet of [a, b]) {
      if (pet.mode === "held") continue;
      const speed = Math.hypot(pet.vx, pet.vy);
      if (speed > KNOCK_FLY) { launch(pet); pet.dizzyUntil = Infinity; }   // звёздочки — после приземления
      else if (pet.mode === "free") {
        // Не обрезаем полученную скорость до прогулочной — пусть проскользит.
        pet.cap = Math.max(pet.cap, speed);
        pet.scaredUntil = now + 900;
        pet.dizzyUntil = now + 2200;
        if (pet.play) endGame(pet);
      }
    }
  };

  // ---- догонялки ----
  let nextGameAt = performance.now() + rand(4, 8) * 1000;

  /** Кратчайший сдвиг до партнёра с учётом сквозных боковых краёв. */
  const toward = (from: Pet, to: Pet) => {
    const a = centerOf(from), b = centerOf(to);
    let dx = b.x - a.x;
    if (dx > vw / 2) dx -= vw;
    if (dx < -vw / 2) dx += vw;
    const dy = b.y - a.y;
    return { dx, dy, d: Math.hypot(dx, dy) || 1 };
  };

  const endGame = (pet: Pet) => {
    const partner = pet.play?.partner;
    pet.play = null;
    if (partner?.play) partner.play = null;
  };

  const maybeStartGame = (now: number, pointerLive: boolean) => {
    if (now < nextGameAt) return;
    nextGameAt = now + rand(GAME_GAP[0], GAME_GAP[1]) * 1000;
    const ready = pets.filter((p) => p.mode === "free" && !p.play && now > p.scaredUntil);
    if (ready.length < 2) return;
    // Курсор совсем рядом — играть некогда, все и так настороже.
    if (pointerLive && ready.some((p) => Math.hypot(pointer.x - centerOf(p).x, pointer.y - centerOf(p).y) < fleeRadius * 1.5)) return;
    const a = ready[Math.floor(Math.random() * ready.length)];
    const b = ready.filter((p) => p !== a).sort((p, q) => toward(a, p).d - toward(a, q).d)[0];
    const until = now + rand(GAME_LENGTH[0], GAME_LENGTH[1]) * 1000;
    a.play = { role: "chase", partner: b, until, readyAt: now + 400 };
    b.play = { role: "run", partner: a, until, readyAt: now };
  };

  /** Осалил: вспышка искр в точке касания, роли меняются, у нового убегающего фора. */
  const tag = (chaser: Pet, runner: Pet, now: number) => {
    const a = centerOf(chaser), { dx, dy } = toward(chaser, runner);
    const mx = a.x + dx / 2, my = a.y + dy / 2;
    for (let i = 0; i < 14; i++) {
      const ang = rand(0, Math.PI * 2), s = rand(60, 180);
      addParticle({ kind: "spark", x: mx, y: my, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, life: rand(0.3, 0.7), size: Math.random() < 0.4 ? 2 : 1 });
    }
    for (let i = 0; i < 4; i++) addParticle({ kind: "bubble", x: mx + rand(-6, 6), y: my, vx: rand(-30, 30), vy: -rand(40, 80), life: rand(0.8, 1.4), size: 2 });
    const until = chaser.play!.until;
    chaser.play = { role: "run", partner: runner, until, readyAt: now };
    runner.play = { role: "chase", partner: chaser, until, readyAt: now + TAG_HEAD_START * 1000 };
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

    // Чернила снизу, затем пузырьки и искры — всё это позади осьминогов.
    updateParticles(dt, s.cell, "ink");
    updateParticles(dt, s.cell, "bubble");
    updateParticles(dt, s.cell, "spark");
    maybeStartGame(now, pointerLive);

    // Удары считаем, только если в паре есть летящий: гуляющих и так
    // мягко расталкивает соседская пружина.
    for (let i = 0; i < pets.length; i++) for (let j = i + 1; j < pets.length; j++) {
      const a = pets[i], b = pets[j];
      if (a.mode === "held" || b.mode === "held") continue;
      if (a.mode === "flying" || b.mode === "flying") collide(a, b);
    }

    for (const pet of pets) {
      pet.inkCooldown = Math.max(0, pet.inkCooldown - dt);
      if (pet.play && (pet.mode !== "free" || pet.play.partner.mode !== "free" || now > pet.play.until)) endGame(pet);

      // ---------- в руке ----------
      if (pet.mode === "held" && held?.pet === pet) {
        const c = centerOf(pet);
        const tx = pointer.x + held.dx, ty = pointer.y + held.dy;
        // Тянется за рукой с лёгкой задержкой и раскачивается от её скорости.
        const k = Math.min(1, dt * 22);
        const nx = c.x + (tx - c.x) * k, ny = c.y + (ty - c.y) * k;
        pet.vx = (nx - c.x) / Math.max(dt, 0.001); pet.vy = (ny - c.y) / Math.max(dt, 0.001);
        pet.x += nx - c.x; pet.y += ny - c.y;
        pet.angle += (clamp(-pointer.vx / 1400, -0.7, 0.7) - pet.angle) * Math.min(1, dt * 8);
        pet.phase += dt * 6;
        if (held.flips.length >= SHAKE_FLIPS && pet.inkCooldown === 0) {
          releaseInk(c.x, c.y + 10, Math.PI / 2);   // из руки — веером вниз
          pet.inkCooldown = 2.5;
          held.flips = [];
        }
        pet.fold = Math.min(1, pet.fold + dt * FOLD_SPEED);
        drawPet(pet, foldImage(pet, Math.floor(pet.phase % FRAMES), s.scared[Math.floor(pet.phase % FRAMES)]));
        continue;
      }

      // ---------- комета ----------
      if (pet.mode === "flying") {
        pet.vx -= pet.vx * FLY_DRAG * dt; pet.vy -= pet.vy * FLY_DRAG * dt;
        pet.x += pet.vx * dt; pet.y += pet.vy * dt;
        const b = boxAt(pet.x, pet.y);
        const c = centerOf(pet);
        // Отскок от краёв экрана. Удар сильнее порога — облако чернил.
        const bounce = (impact: number, away: number) => {
          for (let i = 0; i < 6; i++) addParticle({ kind: "bubble", x: c.x + rand(-10, 10), y: c.y + rand(-10, 10),
            vx: rand(-60, 60), vy: -rand(30, 90), life: rand(0.6, 1.2), size: Math.random() < 0.5 ? 2 : 3 });
          if (impact > INK_IMPACT && pet.inkCooldown === 0) { releaseInk(c.x, c.y, away); pet.inkCooldown = 2.5; }
        };
        // Брошенный рикошетит от всех четырёх краёв — так он долетает до соседей
        // и сшибает их. Сквозь боковые края проходят только гуляющие.
        if (b.x < 0) { pet.x -= b.x; bounce(Math.abs(pet.vx), 0); pet.vx = Math.abs(pet.vx) * BOUNCE; }
        if (b.x + b.w > vw) { pet.x -= b.x + b.w - vw; bounce(Math.abs(pet.vx), Math.PI); pet.vx = -Math.abs(pet.vx) * BOUNCE; }
        if (b.y < 60) { pet.y += 60 - b.y; bounce(Math.abs(pet.vy), Math.PI / 2); pet.vy = Math.abs(pet.vy) * BOUNCE; }
        if (b.y + b.h > vh) { pet.y -= b.y + b.h - vh; bounce(Math.abs(pet.vy), -Math.PI / 2); pet.vy = -Math.abs(pet.vy) * BOUNCE; }

        // Голова смотрит по ходу полёта, щупальца пучком тянутся назад.
        const speed = Math.hypot(pet.vx, pet.vy);
        const target = Math.atan2(pet.vy, pet.vx) + Math.PI / 2;
        let diff = target - pet.angle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        pet.angle += diff * Math.min(1, dt * 12);
        pet.phase += dt * 8;
        emitTrail(pet, dt);
        if (speed < LAND_SPEED) {
          // Приводнился: распускает щупальца, ещё секунду удивлён.
          pet.mode = "free";
          pet.scaredUntil = now + 900;
          pet.ax = pet.ay = 0;
          pet.cap = Math.max(WANDER_CAP, speed);   // скорость гасится плавно, без рывка
          if (pet.dizzyUntil === Infinity) pet.dizzyUntil = now + 2200;   // сбит ударом
          pet.tx = pet.x; pet.ty = pet.y; pet.idle = rand(1.2, 2.4);
        }
        pet.fold = Math.min(1, pet.fold + dt * FOLD_SPEED);
        drawPet(pet, foldImage(pet, Math.floor(pet.phase % FRAMES), s.scared[Math.floor(pet.phase % FRAMES)]));
        continue;
      }

      // ---------- обычная жизнь ----------
      // Сбит ударом и уже на ногах (приземлился или его поймали и отпустили).
      if (pet.dizzyUntil === Infinity) pet.dizzyUntil = now + 2200;
      // Выправляемся после полёта или руки плавно, а не щелчком.
      pet.angle += (0 - pet.angle) * Math.min(1, dt * 6);
      if (Math.abs(pet.angle) < 0.01) pet.angle = 0;

      const b = boxAt(pet.x, pet.y);
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const md = pointerLive && !held ? Math.hypot(pointer.x - cx, pointer.y - cy) || 1 : Infinity;
      let ax = 0, ay = 0, cap = WANDER_CAP;
      const scared = md < fleeRadius;

      if (scared && pet.play) endGame(pet);      // курсор важнее игры
      const play = pet.play;
      const link = play ? toward(pet, play.partner) : null;

      if (scared) {
        const k = (fleeRadius - md) / fleeRadius;
        ax += ((cx - pointer.x) / md) * FLEE_PUSH * (0.4 + k);
        ay += ((cy - pointer.y) / md) * FLEE_PUSH * (0.4 + k);
        cap = FLEE_CAP;
        pet.scaredUntil = now + 700;
        pet.idle = rand(0.8, 1.6);
        pet.tx = pet.x; pet.ty = pet.y;
      } else if (play && link) {
        if (play.role === "chase") {
          if (now >= play.readyAt) {
            ax += (link.dx / link.d) * CHASE_PULL;
            ay += (link.dy / link.d) * CHASE_PULL;
            if (link.d < TAG_DIST) tag(pet, play.partner, now);
          }
          cap = CHASE_CAP;
        } else if (link.d < RUN_CALM_DIST) {
          const k = 1 - link.d / RUN_CALM_DIST;
          ax -= (link.dx / link.d) * RUN_PUSH * (0.35 + k);
          ay -= (link.dy / link.d) * RUN_PUSH * (0.35 + k);
          cap = RUN_CAP;
        }
        pet.tx = pet.x; pet.ty = pet.y; pet.idle = rand(1, 2);
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

      for (const o of pets) {
        if (o === pet || o.mode !== "free" || pet.play?.partner === o) continue;
        const dx = pet.x - o.x, dy = pet.y - o.y, d = Math.hypot(dx, dy) || 1;
        if (d < NEIGHBOR_GAP) { ax += (dx / d) * NEIGHBOR_PUSH; ay += (dy / d) * NEIGHBOR_PUSH; }
      }

      for (const r of busy) {
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

      // Боковые края не держат: уйдя за край, осьминог появится с другой стороны.
      if (b.y < 80) ay += (80 - b.y) * EDGE_SPRING;
      if (b.y + b.h > vh - 8) ay -= (b.y + b.h - vh + 8) * EDGE_SPRING;

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
      wrap(pet);
      emitTrail(pet, dt);

      const playLink = pet.play ? toward(pet, pet.play.partner) : null;
      const reaching = pet.play?.role === "chase" && playLink && playLink.d < REACH_DIST && now >= pet.play.readyAt;
      // Щекочущий частит щупальцами, как пальцами, а убегающий хихикает и ёжится.
      const tickled = pet.play?.role === "run" && playLink && playLink.d < REACH_DIST;
      pet.phase += dt * (reaching ? 9 : 1.6 + Math.min(ANIM_MAX_SPEED, Math.hypot(pet.vx, pet.vy)) * 0.045);
      pet.alpha += (1 - pet.alpha) * Math.min(1, dt * 4);
      pet.gaze = playLink
        ? (playLink.dx > 0 ? 1 : 0) + (playLink.dy > 0 ? 2 : 0)   // в игре смотрит на партнёра
        : gazeFor(pet, pointerLive);

      const afraid = now < pet.scaredUntil;
      const frame = Math.floor(pet.phase % FRAMES);
      // После полёта щупальца распускаются из пучка постепенно.
      pet.fold = Math.max(0, pet.fold - dt * UNFOLD_SPEED);
      const open = afraid
        ? s.scared[frame]
        : reaching ? s.reach[playLink!.dx < 0 ? 0 : 1][pet.gaze][frame] : s.walk[pet.gaze][frame];
      const image = pet.fold > 0 ? foldImage(pet, frame, open) : open;
      if (tickled) {
        // Ёжится от щекотки: мелкая дрожь и смешинки-пузырьки.
        const jx = Math.round(Math.sin(now / 35) * s.cell * 0.6);
        pet.x += jx; drawPet(pet, image); pet.x -= jx;
        if (Math.random() < dt * 6) addParticle({ kind: "bubble", x: cx + rand(-12, 12), y: b.y + 4,
          vx: rand(-30, 30), vy: -rand(50, 90), life: rand(0.5, 0.9), size: 2 });
      } else drawPet(pet, image);
      if (now < pet.dizzyUntil && pet.fold === 0) {
        // Оглушён: три пиксельные звёздочки кружат над головой по эллипсу.
        // Задние (верхняя половина круга) тусклее — так видна глубина.
        const c = Math.max(2, Math.round(s.cell));
        const left = (pet.dizzyUntil - now) / 2200;
        for (let i = 0; i < 3; i++) {
          const a = now / 260 + (i * Math.PI * 2) / 3;
          const sx = Math.round(cx + Math.cos(a) * c * 7), sy = Math.round(b.y - c * 3 + Math.sin(a) * c * 1.6);
          ctx.globalAlpha = Math.min(1, left * 3) * (Math.sin(a) > 0 ? 1 : 0.55);
          ctx.fillStyle = i === 1 ? "#FFFFFF" : "#FFD23F";
          ctx.fillRect(sx - c, sy, c * 3, c);
          ctx.fillRect(sx, sy - c, c, c * 3);
        }
        ctx.globalAlpha = 1;
      } else if (afraid && !pet.angle) {
        const c = Math.max(2, Math.round(s.cell));
        const ex = Math.round(cx - c / 2), ey = Math.round(b.y - c * 5);
        ctx.fillStyle = "#E8473D";
        ctx.fillRect(ex, ey, c, c * 2.5);
        ctx.fillRect(ex, ey + c * 3, c, c);
      }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.clearInterval(timer);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown, { capture: true });
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    window.removeEventListener("click", onClick, { capture: true });
    window.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("scroll", onScroll);
    document.body.style.userSelect = "";
    document.documentElement.style.cursor = "";
    canvas.remove();
  };
}
