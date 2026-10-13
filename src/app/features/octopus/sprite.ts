/**
 * Пиксельный осьминог: тело 14x10 клеток и шесть щупалец.
 * Кадры генерируются кодом, а не рисуются вручную.
 *
 * Позы:
 * - walk   — щупальца веером, по каждому бежит волна от основания к кончику;
 * - scared — то же, но глаза круглые и щупальца растопырены;
 * - tucked — щупальца прижаты к телу и сведены в пучок, как хвост кометы.
 *   В ней осьминог висит в руке и летит после броска.
 *
 * Зрачки в обычной позе смотрят в одну из четырёх сторон: gaze = gx + gy * 2.
 */

export const GRID_W = 38;
export const GRID_H = 27;
export const FRAMES = 10;
export const GAZES = 4;
export const UNFOLD_STEPS = 6;
/** Сколько кадров у поворота крышки щупальцами — от крайнего левого до правого. */
export const GRIP_STEPS = 7;
/** Кадров на полный оборот сидящего на крышке осьминога вокруг своей оси. */
export const SPIN_STEPS = 12;

const BODY_X = 12;
const BODY_Y = 2;

export const PALETTE: Record<number, string> = {
  1: "#3B7DD8", // тело
  2: "#8DBBF2", // блик
  3: "#2A5FA8", // тень, дальние щупальца
  4: "#FFFFFF", // белок
  5: "#13213F", // зрачок, рот, кончики крайних щупалец
  6: "#F29BB5", // румянец
  7: "#2F6CC4", // средние щупальца
  9: "#A9CBF7", // присоски
};

const CODE: Record<string, number> = { X: 1, H: 2, S: 3, W: 4, P: 5, C: 6, M: 5 };

// E — глаз 2x2, зрачок расставляется по направлению взгляда.
const BODY = [
  "....XXXXXX....",
  "..XXXXXXXXXX..",
  ".XXHHXXXXXXXX.",
  ".XHHXXXXXXXXX.",
  "XXXXXXXXXXXXXX",
  "XXEEXXXXXXEEXX",
  "XXEEXXXXXXEEXX",
  "XCXXXMXXMXXXCX",
  "XXXXXXMMXXXXXX",
  ".SSSSSSSSSSSS.",
];

/** Испуг: круглые глаза и рот буквой «о». */
const SCARED_ROWS: Record<number, string> = {
  5: "XWWWXXXXXXWWWX",
  6: "XWPWXXXXXXWPWX",
  7: "XCXXXXMMXXXXCX",
  8: "XXXXXXMMXXXXXX",
};

type Mode = "walk" | "scared" | "tucked" | "reachL" | "reachR" | "grip" | "gripStrain";

/**
 * Хват крышки. sweep — насколько щупальца провернули крышку (-1…1);
 * open — перехват: щупальца разжаты и приподняты.
 */
type Grip = { sweep: number; open: boolean };

/**
 * unfold — насколько щупальца раскрыты из пучка кометы в веер (0…1).
 * Промежуточные значения дают кадры перехода, чтобы осьминог после полёта
 * распускал щупальца постепенно, а не перескакивал из одной позы в другую.
 */
function buildGrid(frame: number, mode: Mode, gaze: number, unfold = 1, grip?: Grip): Uint8Array {
  // Тянется щупальцем: обычный веер, но крайнее щупальце со стороны цели
  // вытянуто почти горизонтально и кончиком «щупает» воздух.
  const reach = mode === "reachL" ? -1 : mode === "reachR" ? 1 : 0;
  if (reach) mode = "walk";
  const grid = new Uint8Array(GRID_W * GRID_H);
  const put = (x: number, y: number, color: number) => {
    const cx = Math.round(x);
    const cy = Math.round(y);
    if (cx >= 0 && cy >= 0 && cx < GRID_W && cy < GRID_H) grid[cy * GRID_W + cx] = color;
  };
  const phase = (frame / FRAMES) * Math.PI * 2;
  const baseY = BODY_Y + BODY.length - 0.5;

  if (mode === "tucked") {
    // Пучок: основания по ширине тела, кончики сходятся к оси под телом.
    // Лёгкая рябь вдоль пучка — щупальца «полощутся» в потоке.
    const count = 6;
    const length = 9;
    const axis = BODY_X + 6.5;
    for (const i of [0, 5, 1, 4, 2, 3]) {
      const k = i - (count - 1) / 2;
      const color = Math.abs(k) > 2 ? 3 : Math.abs(k) > 1 ? 7 : 1;
      for (let s = 0; s < length; s++) {
        const t = s / (length - 1);
        const ripple = Math.sin(phase * 2 - s * 0.9 + i) * 0.6 * t;
        const x = axis + k * 2 * (1 - t * 0.8) + ripple;
        const y = baseY + 0.5 + s;
        if (s < 3) { put(x, y, color); put(x + 1, y, color); }
        else put(x, y, s >= length - 2 ? 3 : color);
        if (s === 1) put(x + (k < 0 ? 1 : 0), y, 9);
      }
    }
  } else {
    // Веер. Рисуем от дальних к ближним: крайние темнее и уходят почти
    // горизонтально, внутренние светлее и смотрят вниз — так они не сливаются.
    const count = 6;
    const length = 10;
    const scared = mode === "scared";
    const axis = BODY_X + 6.5;
    for (const i of [0, 5, 1, 4, 2, 3]) {
      const k = i - (count - 1) / 2;
      const spread = Math.abs(k) / 2.5;
      // Щекотка: четыре щупальца вытянуты вперёд к цели узким веером,
      // кончики наперебой дёргаются вверх-вниз, как пальцы, которые щекочут.
      // Два дальних щупальца с другой стороны остаются опорой.
      const ahead = k * reach;                     // 2.5 — крайнее к цели, -0.5 — ближнее внутреннее
      const reaching = reach !== 0 && ahead > -1;
      const fan = reaching ? (2.5 - ahead) * 0.22 - 0.1 : 0;   // от чуть вверх до наискось вниз
      let angle = reaching
        ? (reach < 0 ? Math.PI - fan : fan)
        : Math.PI / 2 - k * (scared ? 0.66 : 0.56);
      let curl = reaching ? 0 : (k < 0 ? 1 : -1) * spread * 1.7;
      let len = reaching ? Math.round(10 + ahead) : length;
      const side = Math.sign(k);
      if (grip?.open) {
        // Перехват: щупальца разжаты, приподняты и разведены.
        angle = Math.PI / 2 - k * 0.38 - grip.sweep * 0.3;
        curl = -side * 0.7;
        len = Math.round(7 + spread * 3);
      } else if (grip) {
        // Хват: щупальца сходятся вниз к краям крышки, кончики подгибаются
        // под неё. Все вместе проворачиваются вслед за крышкой.
        angle = Math.PI / 2 - k * 0.2 + grip.sweep * 0.42;
        curl = side * (0.6 + 1.6 * spread);
        len = Math.round(9 + spread * 3);
      }
      const color = spread > 0.9 ? 3 : spread > 0.5 ? 7 : 1;
      const tip = spread > 0.9 ? 5 : 3;
      let x = BODY_X + 6.5 + k * 2.1;
      let y = baseY;
      for (let s = 0; s < len; s++) {
        const t = s / (len - 1);
        const wave = grip
          ? Math.sin(phase * 3 - s + i * 2.1) * (mode === "gripStrain" ? 0.16 : 0.06) * t   // дрожат от усилия
          : reaching
            ? Math.sin(phase * 3 - s * 0.9 + ahead * 1.9) * 0.7 * t * t
            : Math.sin(phase - s * 0.8 + i * 1.7) * 0.5 * t;
        const a = angle + curl * t * t + wave;
        x += Math.cos(a) * 0.95;
        y += Math.sin(a) * 0.95;
        // Переход: точка веера тянется к своей точке в пучке кометы.
        const px = x, py = y;
        if (unfold < 1) {
          const ripple = Math.sin(phase * 2 - s * 0.9 + i) * 0.6 * t;
          x = axis + k * 2 * (1 - t * 0.8) + ripple + (x - axis - k * 2 * (1 - t * 0.8) - ripple) * unfold;
          y = baseY + 0.5 + t * 8 + (y - baseY - 0.5 - t * 8) * unfold;
        }
        if (s < 5) {
          put(x, y, color); put(x + 1, y, color); put(x, y + 1, color); put(x + 1, y + 1, color);
          if (s === 2 || s === 4) put(x + (k < 0 ? 1 : 0), y + 1, 9);
        } else if (s < 7) {
          put(x, y, color); put(x + 1, y, color);
        } else {
          put(x, y, s >= len - 2 ? tip : color);
        }
        x = px; y = py;
      }
    }
  }

  // В руке, в полёте и от натуги глаза круглые; спокойный хват — с обычным взглядом.
  const round = mode !== "walk" && mode !== "grip";
  const gx = gaze % 2, gy = Math.floor(gaze / 2);
  BODY.forEach((row, r) => {
    const line = round && SCARED_ROWS[r] ? SCARED_ROWS[r] : row;
    [...line].forEach((ch, c) => {
      if (ch === "E") {
        const eyeLeft = c < 7 ? 2 : 10;
        const pupil = c === eyeLeft + gx && r === 5 + gy;
        put(BODY_X + c, BODY_Y + r, pupil ? 5 : 4);
      } else if (CODE[ch]) {
        put(BODY_X + c, BODY_Y + r, CODE[ch]);
      }
    });
  });
  return grid;
}

/**
 * Сидит на крышке, повернувшись вокруг своей оси на yaw (0 — лицом к зрителю).
 * Объём изображается так: глаза, рот и румянец лежат на окружности тела и при
 * повороте съезжают к краю и прячутся за ним, со спины лица нет. Шесть щупалец
 * лежат кольцом на крышке и загибаются за её край; задние темнее и закрыты
 * телом, передние ниже и светлее.
 */
function buildSpinGrid(yaw: number, strain: boolean, frame: number): Uint8Array {
  const grid = new Uint8Array(GRID_W * GRID_H);
  const put = (x: number, y: number, color: number) => {
    const cx = Math.round(x), cy = Math.round(y);
    if (cx >= 0 && cy >= 0 && cx < GRID_W && cy < GRID_H) grid[cy * GRID_W + cx] = color;
  };
  const cx = BODY_X + 7;                         // ось тела
  const R = 6.3;                                 // радиус «цилиндра» тела
  const baseY = BODY_Y + BODY.length - 0.5;
  const phase = (frame / FRAMES) * Math.PI * 2;

  const legs = Array.from({ length: 6 }, (_, i) => {
    const a = ((i + 0.5) / 6) * Math.PI * 2 - yaw;
    return { i, sin: Math.sin(a), depth: Math.cos(a) };
  }).sort((p, q) => p.depth - q.depth);
  const drawLeg = ({ i, sin, depth }: { i: number; sin: number; depth: number }) => {
    const color = depth < -0.3 ? 3 : depth < 0.4 ? 7 : 1;
    const steps = 11;
    for (let s = 0; s < steps; s++) {
      const t = s / (steps - 1);
      let r: number, y: number;
      if (t < 0.7) {
        // По крышке от тела к краю. Дальний край крышки выше, ближний ниже.
        const u = t / 0.7;
        r = 4.2 + u * 4.6;
        y = baseY + 0.6 + depth * r * 0.36 + Math.sin(phase * 2 + i * 1.3) * 0.2 * u;
      } else {
        // За краем загибается вниз и чуть внутрь.
        const u = (t - 0.7) / 0.3;
        r = 8.8 - u * 0.8;
        y = baseY + 0.6 + depth * 8.8 * 0.36 + u * 4;
      }
      const x = cx + sin * r - 0.5;
      const tip = s >= steps - 2;
      put(x, y, tip ? (depth > -0.3 ? 5 : 3) : color);
      if (s < 5) { put(x + 1, y, color); put(x, y + 1, color); }
      else if (t >= 0.7) put(x, y + 0.5, color);           // загиб за край без просветов
      if (s === 2 && depth > 0.3) put(x, y + 1, 9);
    }
  };
  for (const leg of legs) if (leg.depth < 0) drawLeg(leg);

  // Тело без лица — лицо рисуется отдельно, с учётом поворота.
  BODY.forEach((row, r) => [...row].forEach((ch, c) => {
    const code = ch === "E" || ch === "C" || ch === "M" ? 1 : CODE[ch];
    if (code) put(BODY_X + c, BODY_Y + r, code);
  }));
  /** Точка лица на угле φ от середины; вернёт x или null, если она за краем. */
  const face = (phi: number, minVis = 0.15) => {
    const d = phi - yaw;
    return Math.cos(d) > minVis ? { x: cx + Math.sin(d) * R, vis: Math.cos(d) } : null;
  };
  for (const phi of [-0.72, 0.72]) {
    const e = face(phi, 0.2);
    if (!e) continue;
    const w = strain ? (e.vis > 0.75 ? 3 : e.vis > 0.45 ? 2 : 1) : (e.vis > 0.6 ? 2 : 1);
    const x0 = Math.round(e.x - w / 2);
    for (let k = 0; k < w; k++) {
      put(x0 + k, BODY_Y + 5, 4);
      const pupil = strain ? k === Math.floor(w / 2) : k === w - 1;
      put(x0 + k, BODY_Y + 6, pupil ? 5 : 4);
    }
  }
  for (const phi of [-0.98, 0.98]) { const b = face(phi, 0.2); if (b) put(b.x - 0.5, BODY_Y + 7, 6); }
  const mouth = (o: number, row: number) => { const m = face(Math.asin(o / R)); if (m) put(m.x - 0.5, BODY_Y + row, 5); };
  if (strain) { for (const o of [-0.5, 0.5]) { mouth(o, 7); mouth(o, 8); } }
  else { mouth(-1.5, 7); mouth(1.5, 7); mouth(-0.5, 8); mouth(0.5, 8); }

  for (const leg of legs) if (leg.depth >= 0) drawLeg(leg);
  return grid;
}

export type SpriteSet = {
  /** walk[gaze][frame] */
  walk: HTMLCanvasElement[][];
  scared: HTMLCanvasElement[];
  tucked: HTMLCanvasElement[];
  /** unfold[step][frame] — кадры перехода от пучка (шаг 0) к вееру. */
  unfold: HTMLCanvasElement[][];
  /**
   * grip[strain][open][step] — поворот крышки щупальцами: step от GRIP_STEPS кадров
   * провёрнуто влево до вправо; strain — натужное лицо; open — перехват.
   */
  grip: HTMLCanvasElement[][][];
  /** spin[strain][step] — сидит на крышке, повёрнут на step / SPIN_STEPS оборота. */
  spin: HTMLCanvasElement[][];
  /** reach[0] тянется влево, reach[1] вправо; reach[side][gaze][frame] */
  reach: HTMLCanvasElement[][][];
  /** Занятая рисунком область в клетках (по обычной позе): по ней считаются столкновения. */
  box: { x: number; y: number; w: number; h: number };
  cell: number;
  width: number;
  height: number;
};

/** Растеризует все кадры в отдельные холсты нужного масштаба один раз. */
export function buildSprites(cell: number): SpriteSet {
  let minX = GRID_W, minY = GRID_H, maxX = 0, maxY = 0;
  const width = Math.ceil(GRID_W * cell);
  const height = Math.ceil(GRID_H * cell);
  // Масштаб бывает дробным (2,1 px на клетку): границы клеток округляем,
  // чтобы пиксели оставались чёткими, без размытых швов.
  const edge = (v: number) => Math.round(v * cell);
  const render = (grid: Uint8Array, measure: boolean) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const color = grid[y * GRID_W + x];
        if (!color) continue;
        if (measure) {
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
        ctx.fillStyle = PALETTE[color];
        ctx.fillRect(edge(x), edge(y), edge(x + 1) - edge(x), edge(y + 1) - edge(y));
      }
    }
    return canvas;
  };
  const frames = (mode: Mode, gaze: number, measure: boolean, unfold = 1) =>
    Array.from({ length: FRAMES }, (_, f) => render(buildGrid(f, mode, gaze, unfold), measure));
  const walk = Array.from({ length: GAZES }, (_, g) => frames("walk", g, true));
  const scared = frames("scared", 3, true);
  const tucked = frames("tucked", 3, false);
  const unfold = Array.from({ length: UNFOLD_STEPS }, (_, k) => frames("scared", 3, false, (k + 1) / (UNFOLD_STEPS + 1)));
  // Тянущаяся поза в рамку столкновений не входит: вытянутое щупальце
  // не должно отталкивать осьминога от текста.
  const reach = (["reachL", "reachR"] as const).map((mode) =>
    Array.from({ length: GAZES }, (_, g) => frames(mode, g, false)));
  const grip = (["grip", "gripStrain"] as const).map((mode) => [false, true].map((open) =>
    Array.from({ length: GRIP_STEPS }, (_, k) => {
      const sweep = -1 + (2 * k) / (GRIP_STEPS - 1);
      // Взгляд за крышкой: провернул влево — смотрит влево вниз.
      return render(buildGrid(k, mode, sweep < 0 ? 2 : 3, 1, { sweep, open }), false);
    })));
  const spin = [false, true].map((strain) => Array.from({ length: SPIN_STEPS }, (_, k) =>
    render(buildSpinGrid((k / SPIN_STEPS) * Math.PI * 2, strain, k % FRAMES), false)));
  return {
    walk, scared, tucked, unfold, reach, grip, spin, cell, width, height,
    box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
  };
}

/** Центр тела в клетках — вокруг него крутится осьминог в полёте. */
export const BODY_CENTER = { x: BODY_X + 7, y: BODY_Y + 5 };
