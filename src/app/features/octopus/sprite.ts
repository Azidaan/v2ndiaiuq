/**
 * Пиксельный осьминог: тело 14x10 клеток и шесть щупалец веером.
 * Кадры генерируются кодом, а не рисуются вручную: по каждому щупальцу бежит
 * волна от основания к кончику, у каждого со своим сдвигом фазы.
 */

export const GRID_W = 38;
export const GRID_H = 27;
export const FRAMES = 10;

const BODY_X = 12;
const BODY_Y = 2;

const PALETTE: Record<number, string> = {
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

const BODY = [
  "....XXXXXX....",
  "..XXXXXXXXXX..",
  ".XXHHXXXXXXXX.",
  ".XHHXXXXXXXXX.",
  "XXXXXXXXXXXXXX",
  "XXWWXXXXXXWWXX",
  "XXWPXXXXXXWPXX",
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

function buildGrid(frame: number, scared: boolean): Uint8Array {
  const grid = new Uint8Array(GRID_W * GRID_H);
  const put = (x: number, y: number, color: number) => {
    const cx = Math.round(x);
    const cy = Math.round(y);
    if (cx >= 0 && cy >= 0 && cx < GRID_W && cy < GRID_H) grid[cy * GRID_W + cx] = color;
  };
  const phase = (frame / FRAMES) * Math.PI * 2;
  // Тело не подпрыгивает: скачок на целую клетку при таком размере читался как дрожь.
  // Движение передают щупальца.
  const bob = 0;
  const baseY = BODY_Y + bob + BODY.length - 0.5;

  // Рисуем от дальних к ближним: крайние темнее и уходят почти горизонтально,
  // внутренние светлее и смотрят вниз — так щупальца не сливаются в комок.
  const count = 6;
  const length = 10;
  for (const i of [0, 5, 1, 4, 2, 3]) {
    const k = i - (count - 1) / 2;
    const spread = Math.abs(k) / 2.5;
    const angle = Math.PI / 2 - k * (scared ? 0.66 : 0.56);
    const curl = (k < 0 ? 1 : -1) * spread * 1.7;
    const color = spread > 0.9 ? 3 : spread > 0.5 ? 7 : 1;
    const tip = spread > 0.9 ? 5 : 3;
    let x = BODY_X + 6.5 + k * 2.1;
    let y = baseY;
    for (let s = 0; s < length; s++) {
      const t = s / (length - 1);
      const wave = Math.sin(phase - s * 0.8 + i * 1.7) * 0.5 * t;
      const a = angle + curl * t * t + wave;
      x += Math.cos(a) * 0.95;
      y += Math.sin(a) * 0.95;
      if (s < 5) {
        put(x, y, color); put(x + 1, y, color); put(x, y + 1, color); put(x + 1, y + 1, color);
        if (s === 2 || s === 4) put(x + (k < 0 ? 1 : 0), y + 1, 9);
      } else if (s < 7) {
        put(x, y, color); put(x + 1, y, color);
      } else {
        put(x, y, s >= length - 2 ? tip : color);
      }
    }
  }

  BODY.forEach((row, r) => {
    const line = scared && SCARED_ROWS[r] ? SCARED_ROWS[r] : row;
    [...line].forEach((ch, c) => {
      if (CODE[ch]) put(BODY_X + c, BODY_Y + bob + r, CODE[ch]);
    });
  });
  return grid;
}

export type SpriteSet = {
  walk: HTMLCanvasElement[];
  scared: HTMLCanvasElement[];
  /** Занятая рисунком область в клетках: по ней считаются столкновения. */
  box: { x: number; y: number; w: number; h: number };
  cell: number;
};

/** Растеризует кадры в отдельные холсты нужного масштаба один раз. */
export function buildSprites(cell: number): SpriteSet {
  let minX = GRID_W, minY = GRID_H, maxX = 0, maxY = 0;
  const render = (grid: Uint8Array) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(GRID_W * cell);
    canvas.height = Math.ceil(GRID_H * cell);
    // Масштаб бывает дробным (2,1 px на клетку): границы клеток округляем,
    // чтобы пиксели оставались чёткими, без размытых швов.
    const edge = (v: number) => Math.round(v * cell);
    const ctx = canvas.getContext("2d")!;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const color = grid[y * GRID_W + x];
        if (!color) continue;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        ctx.fillStyle = PALETTE[color];
        ctx.fillRect(edge(x), edge(y), edge(x + 1) - edge(x), edge(y + 1) - edge(y));
      }
    }
    return canvas;
  };
  const walk = Array.from({ length: FRAMES }, (_, f) => render(buildGrid(f, false)));
  const scared = Array.from({ length: FRAMES }, (_, f) => render(buildGrid(f, true)));
  return { walk, scared, cell, box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } };
}
