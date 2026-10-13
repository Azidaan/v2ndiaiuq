import { FRAMES, type SpriteSet } from "./sprite";
import type { NewParticle, Pet } from "./engine";

/**
 * Сценка «банка». Один осьминог уплывает за край экрана, возвращается с банкой
 * в щупальцах и крышкой на голове вместо шляпы, ловит другого в банку и
 * закручивает крышку. Пленник откручивает её изнутри, выбирается и выкидывает
 * банку за экран всеми щупальцами.
 *
 * Пока идёт сценка, оба осьминога в режиме "scripted": физика движка их не
 * трогает, двигает и рисует их этот сценарий. Банка и крышка — пиксельные,
 * рисуются клетками того же размера, что и осьминоги.
 */

export type JarEnv = {
  ctx: CanvasRenderingContext2D;
  pets: Pet[];
  sprites: () => SpriteSet;
  view: () => { w: number; h: number };
  centerOf: (pet: Pet) => { x: number; y: number };
  drawAt: (pet: Pet, image: HTMLCanvasElement) => void;
  foldImage: (pet: Pet, frame: number, open: HTMLCanvasElement) => HTMLCanvasElement;
  addParticle: (p: NewParticle) => void;
  emitTrail: (pet: Pet, dt: number) => void;
  /** Забирает осьминога у физики: выходит из игры, переходит в "scripted". */
  take: (pet: Pet) => void;
  /** Возвращает осьминога физике. */
  release: (pet: Pet) => void;
  /** Гость для экрана с одним осьминогом: появляется центром в (x, y). */
  spawn: (x: number, y: number) => Pet;
  remove: (pet: Pet) => void;
};

type Phase =
  | "exit" | "away" | "return" | "scoop" | "lid" | "toTop" | "screw" | "gloat"
  | "struggle" | "flip" | "unscrew" | "climb" | "lift" | "throw" | "leave";
type Pose = "walk" | "reach" | "scared";

/** Длительность фаз, с. Фазы без числа заканчиваются по событию. */
const DURATION: Partial<Record<Phase, number>> = {
  away: 0.8, scoop: 0.6, lid: 0.7, toTop: 0.5, screw: 1.5, gloat: 1.1,
  struggle: 1.1, flip: 0.5, unscrew: 1.7, climb: 0.7, lift: 0.8,
};

const CARRY = 17;                // клеток от центра ловца до центра банки
const ABOVE_LID = 28;            // клеток от центра банки до ловца, крутящего крышку
const GRIP = 23;                 // клеток от центра банки до осьминога, держащего её за горлышко

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => { t = clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

// Банка 20x24 клетки: горлышко с ободком сверху, скруглённое дно.
// Для каждой строки — крайние клетки стекла [слева, справа].
const JAR_ROWS: [number, number][] = [
  [3, 16], [3, 16], [3, 16], [2, 17], [1, 18],
  ...Array.from({ length: 17 }, () => [0, 19] as [number, number]),
  [1, 18], [2, 17],
];
const JAR_W = 20, JAR_H = 24;

export function createJarScene(env: JarEnv) {
  const { ctx } = env;
  type Scene = {
    phase: Phase; t: number;
    catcher: Pet; victim: Pet | null; guest: boolean;
    side: number;                // за каким краем лежит банка: -1 слева, 1 справа
    cPose: Pose; vPose: Pose;
    cLook: { x: number; y: number }; vLook: { x: number; y: number };
    jar: { x: number; y: number; angle: number; vx: number; vy: number; spin: number; shake: number; shown: boolean; flying: boolean };
    lid: { x: number; y: number; angle: number; vx: number; vy: number; spin: number; twist: number; lift: number;
      state: "hat" | "arc" | "on" | "flying" | "gone"; fromX: number; fromY: number };
    from: { x: number; y: number; angle: number };
    jarFrom: { x: number; y: number }; jarTo: { x: number; y: number };
    throwSide: number; gloatSide: number;
  };
  let scene: Scene | null = null;

  const cell = () => env.sprites().cell;
  const center = (pet: Pet) => env.centerOf(pet);
  const place = (pet: Pet, x: number, y: number) => { const c = center(pet); pet.x += x - c.x; pet.y += y - c.y; };
  /** Плывёт к точке: скорость плавно догоняет нужную, у цели замедляется. */
  const move = (pet: Pet, tx: number, ty: number, speed: number, dt: number, k = 5) => {
    const c = center(pet);
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
    const v = Math.min(speed, d * 4);
    const wx = d ? (dx / d) * v : 0, wy = d ? (dy / d) * v : 0;
    const a = Math.min(1, dt * k);
    pet.vx += (wx - pet.vx) * a; pet.vy += (wy - pet.vy) * a;
    pet.x += pet.vx * dt; pet.y += pet.vy * dt;
    return d;
  };
  const foldTo = (pet: Pet, target: number, dt: number, speed: number) => {
    pet.fold = target > pet.fold ? Math.min(target, pet.fold + dt * speed) : Math.max(target, pet.fold - dt * speed);
  };
  /** Точка банки в мировых координатах: (lx, ly) в клетках от её центра. */
  const jarPoint = (lx: number, ly: number) => {
    const j = scene!.jar, c = cell(), cos = Math.cos(j.angle), sin = Math.sin(j.angle);
    return { x: j.x + j.shake + (lx * cos - ly * sin) * c, y: j.y + (lx * sin + ly * cos) * c };
  };
  const lidSeat = () => jarPoint(0, -14 + scene!.lid.lift);
  const hatSpot = (pet: Pet) => { const c = center(pet); return { x: c.x, y: c.y - 7 * cell() }; };

  const sparks = (x: number, y: number, n: number, speed = 160) => {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(speed * 0.4, speed);
      env.addParticle({ kind: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.6), size: Math.random() < 0.4 ? 2 : 1 });
    }
  };
  const bubbles = (x: number, y: number, n: number, spread = 8) => {
    for (let i = 0; i < n; i++) env.addParticle({ kind: "bubble", x: x + rand(-spread, spread), y: y + rand(-spread, spread),
      vx: rand(-30, 30), vy: -rand(40, 90), life: rand(0.6, 1.2), size: Math.random() < 0.5 ? 1 : 2 });
  };

  const go = (phase: Phase) => { scene!.phase = phase; scene!.t = 0; };

  /** Выбирает, кого ловить: свободного осьминога, ближайшего к ловцу. */
  const pickVictim = (catcher: Pet) => {
    const c = center(catcher);
    const free = env.pets.filter((p) => p !== catcher && p.mode === "free" && p.alpha > 0.5);
    free.sort((a, b) => Math.hypot(center(a).x - c.x, center(a).y - c.y) - Math.hypot(center(b).x - c.x, center(b).y - c.y));
    return free[0] ?? null;
  };

  const start = () => {
    if (scene) return false;
    const { w } = env.view();
    const free = env.pets.filter((p) => p.mode === "free" && p.alpha > 0.5);
    if (!free.length) return false;
    let catcher: Pet, guest = false, side: number, phase: Phase;
    if (free.length >= 2) {
      // Ловец — тот, кому ближе плыть за край.
      catcher = [...free].sort((a, b) => {
        const ca = center(a).x, cb = center(b).x;
        return Math.min(ca, w - ca) - Math.min(cb, w - cb);
      })[0];
      side = center(catcher).x < w / 2 ? -1 : 1;
      phase = "exit";
    } else {
      // На экране один осьминог: с банкой приплывает гость с дальней стороны.
      const cx = center(free[0]).x;
      side = cx < w / 2 ? 1 : -1;
      catcher = env.spawn(side < 0 ? -40 * cell() : w + 40 * cell(), center(free[0]).y);
      guest = true;
      phase = "away";
    }
    env.take(catcher);
    scene = {
      phase, t: 0, catcher, victim: null, guest, side,
      cPose: "walk", vPose: "scared", cLook: { x: side, y: 0 }, vLook: { x: 0, y: 1 },
      jar: { x: 0, y: 0, angle: 0, vx: 0, vy: 0, spin: 0, shake: 0, shown: false, flying: false },
      lid: { x: 0, y: 0, angle: 0, vx: 0, vy: 0, spin: 0, twist: 0, lift: 0, state: "hat", fromX: 0, fromY: 0 },
      from: { x: 0, y: 0, angle: 0 },
      jarFrom: { x: 0, y: 0 }, jarTo: { x: 0, y: 0 },
      throwSide: 1, gloatSide: 1,
    };
    return true;
  };

  const finish = () => {
    const sc = scene!;
    if (sc.victim) env.release(sc.victim);
    if (sc.guest) {
      // Гость уплывает обратно за край и исчезает.
      sc.victim = null;
      sc.jar.shown = false; sc.lid.state = "gone";
      go("leave");
      return;
    }
    env.release(sc.catcher);
    scene = null;
  };

  const update = (dt: number) => {
    const sc = scene;
    if (!sc) return;
    sc.t += dt;
    const { w, h } = env.view();
    const c = cell();
    const C = sc.catcher, V = sc.victim;
    const done = (DURATION[sc.phase] ?? Infinity) <= sc.t;
    const k = sc.t / (DURATION[sc.phase] ?? 1);

    switch (sc.phase) {
      case "exit": {
        // Ловец плывёт за край за банкой.
        const cc = center(C);
        sc.cPose = "walk"; sc.cLook = { x: sc.side, y: 0 };
        move(C, sc.side < 0 ? -30 * c : w + 30 * c, cc.y, 260, dt, 3);
        env.emitTrail(C, dt);
        if (sc.side < 0 ? center(C).x < -16 * c : center(C).x > w + 16 * c) go("away");
        break;
      }
      case "away": {
        // За краем что-то ищут: пузырьки у кромки экрана.
        const edge = sc.side < 0 ? 4 : w - 4;
        if (Math.random() < dt * 10) bubbles(edge, center(C).y + rand(-20, 20), 1, 4);
        if (!done) break;
        const victim = pickVictim(C);
        if (!victim) { sc.t = 0; break; }        // все заняты — ждём
        env.take(victim);
        sc.victim = victim;
        const vc = center(victim);
        place(C, sc.side < 0 ? -24 * c : w + 24 * c, clamp(vc.y, 110, h - 60));
        C.vx = -sc.side * 200; C.vy = 0;
        sc.jar.shown = true;
        sc.jar.angle = sc.side < 0 ? Math.PI / 2 : -Math.PI / 2;
        go("return");
        break;
      }
      case "return": {
        if (!V) break;
        const cc = center(C), vc = center(V);
        const dx = vc.x - cc.x, dy = vc.y - cc.y, d = Math.hypot(dx, dy) || 1;
        const nx = dx / d, ny = dy / d;
        // Банка в вытянутых щупальцах, горлышком к жертве.
        sc.jar.angle = lerpAngle(sc.jar.angle, Math.atan2(ny, nx) + Math.PI / 2, Math.min(1, dt * 6));
        move(C, vc.x - nx * CARRY * c, vc.y - ny * CARRY * c, 330, dt, 3);
        const cc2 = center(C);
        sc.jar.x = cc2.x + nx * CARRY * c; sc.jar.y = cc2.y + ny * CARRY * c;
        sc.cPose = "reach"; sc.cLook = { x: nx, y: ny };
        env.emitTrail(C, dt);
        // Жертва замечает ловца и пятится, но медленнее.
        const seen = cc2.x > 0 && cc2.x < w;
        sc.vPose = seen ? "scared" : "walk";
        sc.vLook = { x: -nx, y: -ny };
        if (seen) move(V, clamp(vc.x + nx * 60, 50, w - 50), clamp(vc.y + ny * 60, 110, h - 50), 95, dt, 3);
        if (Math.hypot(sc.jar.x - vc.x, sc.jar.y - vc.y) < 6 * c || sc.t > 7) {
          sc.from = { x: vc.x, y: vc.y, angle: sc.jar.angle };
          // Банку с добычей уносят от краёв: сверху нужно место для ловца с крышкой.
          sc.jarFrom = { x: sc.jar.x, y: sc.jar.y };
          sc.jarTo = {
            x: clamp(sc.jar.x, Math.min(w / 2, 70 * c), Math.max(w / 2, w - 70 * c)),
            y: clamp(sc.jar.y, Math.min(h / 2, 130 + (ABOVE_LID + 12) * c), Math.max(h / 2, h - 20 * c)),
          };
          bubbles(vc.x, vc.y, 8, 12);
          go("scoop");
        }
        break;
      }
      case "scoop": {
        if (!V) break;
        // Жертва втягивается в банку, банка встаёт горлышком вверх и отплывает от краёв.
        sc.jar.x = lerp(sc.jarFrom.x, sc.jarTo.x, ease(k));
        sc.jar.y = lerp(sc.jarFrom.y, sc.jarTo.y, ease(k));
        const hold = center(C).x < sc.jar.x ? -1 : 1;
        move(C, sc.jar.x + hold * CARRY * c, sc.jar.y, 500, dt, 8);
        sc.jar.angle = lerpAngle(sc.from.angle, 0, ease((sc.t - 0.2) / 0.4));
        const into = ease(k * 1.6);
        place(V, lerp(sc.from.x, sc.jar.x, into), lerp(sc.from.y, sc.jar.y, into));
        V.angle = lerpAngle(V.angle, sc.jar.angle, Math.min(1, dt * 10));
        foldTo(V, 1, dt, 6);
        sc.cPose = "reach";
        if (done) {
          const hat = hatSpot(C);
          sc.lid.state = "arc"; sc.lid.fromX = hat.x; sc.lid.fromY = hat.y;
          sc.cPose = "walk";
          go("lid");
        }
        break;
      }
      case "lid": {
        // Ловец снимает с головы крышку и бросает её на банку.
        const seat = lidSeat();
        const e = ease(k);
        sc.lid.x = lerp(sc.lid.fromX, seat.x, e);
        sc.lid.y = lerp(sc.lid.fromY, seat.y, e) - Math.sin(Math.min(1, k) * Math.PI) * 14 * c;
        sc.lid.angle = e * Math.PI * 2 * -sc.side;
        sc.cLook = { x: sc.jar.x - center(C).x, y: 1 };
        if (done) {
          sc.lid.state = "on"; sc.lid.angle = 0; sc.lid.lift = -1.5;
          sparks(seat.x, seat.y, 10);
          go("toTop");
        }
        break;
      }
      case "toTop": {
        // Подплывает сверху и накрывает крышку растопыренными щупальцами.
        move(C, sc.jar.x, sc.jar.y - ABOVE_LID * c, 300, dt, 6);
        foldTo(C, 0, dt, 3);
        sc.cPose = "walk"; sc.cLook = { x: 0, y: 1 };
        if (done) go("screw");
        break;
      }
      case "screw": {
        // Закручивает: крышка вращается и садится на резьбу, ловец вертится вместе с ней.
        foldTo(C, 0, dt, 3);
        place(C, sc.jar.x, sc.jar.y - ABOVE_LID * c - sc.lid.lift * c);
        C.angle = Math.sin(sc.t * 14) * 0.3;
        sc.lid.twist += dt * 7;
        sc.lid.lift = lerp(-1.5, 0, ease(k));
        if (Math.random() < dt * 5) { const p = jarPoint(Math.random() < 0.5 ? -8 : 8, -14); sparks(p.x, p.y, 2, 90); }
        if (V) { sc.vLook = { x: 0, y: -1 }; V.angle = Math.sin(sc.t * 9) * 0.08; }
        if (done) {
          sc.gloatSide = sc.jar.x < w / 2 ? 1 : -1;
          go("gloat");
        }
        break;
      }
      case "gloat": {
        // Довольный ловец отплывает в сторону и пританцовывает.
        C.angle = lerpAngle(C.angle, 0, Math.min(1, dt * 8));
        foldTo(C, 0, dt, 2.5);
        move(C, sc.jar.x + sc.gloatSide * 30 * c, sc.jar.y - 4 * c + Math.sin(sc.t * 9) * 3 * c, 220, dt, 5);
        sc.cPose = "walk"; sc.cLook = { x: -sc.gloatSide, y: 0 };
        if (done) go("struggle");
        break;
      }
      case "struggle": {
        // Пленник бьётся о стенки: банка дрожит, изнутри поднимаются пузырьки.
        move(C, sc.jar.x + sc.gloatSide * 30 * c, sc.jar.y - 4 * c, 220, dt, 5);
        sc.jar.shake = Math.round(Math.sin(sc.t * 42) * c * 0.6);
        if (V) {
          V.angle = Math.sin(sc.t * 25) * 0.22;
          if (Math.random() < dt * 8) { const v = center(V); bubbles(v.x, v.y - 4 * c, 1, 6); }
        }
        if (done) { sc.jar.shake = 0; sc.from.angle = V?.angle ?? 0; go("flip"); }
        break;
      }
      case "flip": {
        // Переворачивается вниз головой и упирается в крышку раскрытыми щупальцами.
        if (V) {
          foldTo(V, 0, dt, 2.5);
          sc.vPose = "walk"; sc.vLook = { x: 0, y: 1 };
          V.angle = lerp(sc.from.angle, Math.PI, ease(k));
          const p = jarPoint(0, lerp(0, 1, ease(k)));
          place(V, p.x, p.y);
        }
        if (done) go("unscrew");
        break;
      }
      case "unscrew": {
        // Откручивает изнутри: крышка вращается обратно и выползает с резьбы.
        sc.lid.twist -= dt * 7;
        sc.lid.lift = lerp(0, -3.5, ease(k));
        if (V) { foldTo(V, 0, dt, 2.5); V.angle = Math.PI + Math.sin(sc.t * 14) * 0.25; const p = jarPoint(0, 1 - k * 1.5); place(V, p.x, p.y); }
        sc.cPose = "scared";
        if (Math.random() < dt * 5) { const p = jarPoint(Math.random() < 0.5 ? -8 : 8, -14 + sc.lid.lift); sparks(p.x, p.y, 2, 90); }
        if (done) {
          // Крышка с хлопком улетает вверх.
          const seat = lidSeat();
          sc.lid.state = "flying"; sc.lid.x = seat.x; sc.lid.y = seat.y;
          sc.lid.vx = rand(-90, 90); sc.lid.vy = -520; sc.lid.spin = rand(8, 13) * (Math.random() < 0.5 ? -1 : 1);
          const mouth = jarPoint(0, -12);
          sparks(mouth.x, mouth.y, 14, 220);
          bubbles(mouth.x, mouth.y, 6, 10);
          if (V) sc.from = { ...center(V), angle: V.angle };
          go("climb");
        }
        break;
      }
      case "climb": {
        // Выбирается через горлышко, кувырком возвращаясь в нормальное положение,
        // и снова поджимает щупальца — сейчас ими обхватит банку.
        if (V) {
          foldTo(V, 1, dt, 3);
          const top = jarPoint(0, -GRIP);
          place(V, lerp(sc.from.x, top.x, ease(k)), lerp(sc.from.y, top.y, ease(k)));
          V.angle = lerp(sc.from.angle, Math.PI * 2, ease(k));
          sc.vLook = { x: 0, y: 1 };
        }
        sc.cPose = "scared";
        if (done) {
          if (V) V.angle = 0;
          sc.throwSide = sc.jar.x < w / 2 ? -1 : 1;
          sc.from = { x: sc.jar.x, y: sc.jar.y, angle: 0 };
          go("lift");
        }
        break;
      }
      case "lift": {
        // Обхватывает банку всеми щупальцами, поднимает и замахивается.
        const e = ease(k);
        sc.jar.x = sc.from.x - sc.throwSide * 18 * e;
        sc.jar.y = sc.from.y - 30 * e;
        sc.jar.angle = -sc.throwSide * 0.6 * e;
        if (V) { const top = jarPoint(0, -GRIP); place(V, top.x, top.y); V.angle = sc.jar.angle; }
        sc.cPose = "scared"; sc.cLook = { x: sc.jar.x - center(C).x, y: 0 };
        if (done) {
          // Бросок за ближний край.
          sc.jar.flying = true;
          sc.jar.vx = sc.throwSide * 980; sc.jar.vy = -380; sc.jar.spin = sc.throwSide * 10;
          if (V) { V.vx = sc.throwSide * 160; V.vy = -60; }
          sparks(sc.jar.x, sc.jar.y - 12 * c, 10, 200);
          go("throw");
        }
        break;
      }
      case "throw": {
        if (V) {
          V.vx *= 1 - Math.min(1, dt * 3); V.vy *= 1 - Math.min(1, dt * 3);
          V.x += V.vx * dt; V.y += V.vy * dt;
          V.angle = lerpAngle(V.angle, 0, Math.min(1, dt * 5));
          foldTo(V, 0, dt, 2);
          sc.vPose = "walk"; sc.vLook = { x: sc.throwSide, y: 0 };
        }
        sc.cPose = "walk"; sc.cLook = { x: sc.jar.x - center(C).x, y: 0 };
        const gone = sc.jar.x < -40 * c || sc.jar.x > w + 40 * c || sc.jar.y > h + 40 * c;
        if (gone) sc.jar.shown = false;
        if (gone && sc.lid.state === "gone" && sc.t > 0.6) finish();
        break;
      }
      case "leave": {
        const cc = center(C);
        sc.cPose = "walk"; sc.cLook = { x: sc.side, y: 0 };
        C.angle = 0; foldTo(C, 0, dt, 2);
        move(C, sc.side < 0 ? -30 * c : w + 30 * c, cc.y, 220, dt, 3);
        env.emitTrail(C, dt);
        if (sc.side < 0 ? center(C).x < -20 * c : center(C).x > w + 20 * c) { env.remove(C); scene = null; return; }
        break;
      }
    }

    // Полёт банки и крышки — простая баллистика.
    const j = sc.jar;
    if (j.flying && j.shown) {
      j.vy += 700 * dt; j.x += j.vx * dt; j.y += j.vy * dt; j.angle += j.spin * dt;
    }
    const l = sc.lid;
    if (l.state === "flying") {
      l.vy += 900 * dt; l.x += l.vx * dt; l.y += l.vy * dt; l.angle += l.spin * dt;
      if (l.y > h + 40 * c || l.x < -40 * c || l.x > w + 40 * c) l.state = "gone";
    } else if (l.state === "on") {
      const seat = lidSeat();
      l.x = seat.x; l.y = seat.y; l.angle = j.angle;
    }

    C.phase += dt * (3 + Math.min(160, Math.hypot(C.vx, C.vy)) * 0.03);
    if (V) V.phase += dt * (sc.phase === "unscrew" || sc.phase === "struggle" ? 9 : 4);
  };

  // ---- рисование ----
  /** Прямоугольник в клетках в повёрнутой системе координат. */
  const cells = (x: number, y: number, w: number, h: number, color: string) => {
    const c = cell();
    ctx.fillStyle = color;
    // Чуть внахлёст, чтобы при повороте не просвечивали швы между клетками.
    ctx.fillRect(x * c - 0.25, y * c - 0.25, w * c + 0.5, h * c + 0.5);
  };
  const withJar = (fn: () => void) => {
    const j = scene!.jar;
    ctx.save();
    ctx.translate(Math.round(j.x + j.shake), Math.round(j.y));
    ctx.rotate(j.angle);
    ctx.translate(-JAR_W / 2 * cell(), -JAR_H / 2 * cell());
    fn();
    ctx.restore();
  };
  const drawJarBack = () => withJar(() => {
    JAR_ROWS.forEach(([a, b], y) => cells(a + 1, y, b - a - 1, 1, "rgba(190, 225, 250, 0.3)"));
  });
  const drawJarFront = () => withJar(() => {
    JAR_ROWS.forEach(([a, b], y) => {
      cells(a + 1, y, b - a - 1, 1, "rgba(225, 242, 255, 0.14)");
      cells(a, y, 1, 1, "#8FC1EA");
      cells(b, y, 1, 1, "#8FC1EA");
    });
    cells(3, 0, 14, 1, "#D6ECFB");                     // ободок горлышка
    cells(3, 2, 14, 1, "#8FC1EA");
    cells(2, JAR_H - 1, 16, 1, "#7FB2DE");             // дно
    cells(2, 6, 1, 12, "rgba(255, 255, 255, 0.8)");    // блики
    cells(3, 7, 1, 4, "rgba(255, 255, 255, 0.5)");
    cells(16, 15, 1, 5, "rgba(255, 255, 255, 0.35)");
  });
  /** Крышка 16x4 клетки. Рёбра смещаются с поворотом — так видно, что её крутят. */
  const drawLid = () => {
    const l = scene!.lid;
    ctx.save();
    ctx.translate(Math.round(l.x), Math.round(l.y));
    ctx.rotate(l.angle);
    ctx.translate(-8 * cell(), -2 * cell());
    cells(0, 0, 16, 1, "#F6D77C");
    cells(0, 1, 16, 2, "#E2AE36");
    cells(0, 3, 16, 1, "#C8962A");
    const shift = ((Math.floor(l.twist) % 3) + 3) % 3;
    for (let x = shift; x < 16; x += 3) cells(x, 1, 1, 3, "#A97B16");
    ctx.restore();
  };

  /**
   * Пленник виден только внутри банки и за горлышком: щупальца не торчат
   * сквозь стекло, а при залезании и вылезании он «проходит» через горлышко.
   */
  const INSIDE: Phase[] = ["scoop", "lid", "toTop", "screw", "gloat", "struggle", "flip", "unscrew", "climb"];
  const clipToJar = () => {
    const j = scene!.jar, c = cell();
    const base = ctx.getTransform();
    ctx.translate(Math.round(j.x + j.shake), Math.round(j.y));
    ctx.rotate(j.angle);
    ctx.translate(-JAR_W / 2 * c, -JAR_H / 2 * c);
    ctx.beginPath();
    ctx.rect(c, c, (JAR_W - 2) * c, (JAR_H - 2) * c);      // внутри стекла
    ctx.rect(-400 * c, -800 * c, 800 * c, 801 * c);        // всё, что за горлышком
    ctx.clip();
    ctx.setTransform(base);                                // обрезка остаётся, координаты — прежние
  };

  const image = (pet: Pet, pose: Pose, look: { x: number; y: number }) => {
    const s = env.sprites();
    const f = Math.floor(((pet.phase % FRAMES) + FRAMES) % FRAMES);
    const g = (look.x > 0 ? 1 : 0) + (look.y > 0 ? 2 : 0);
    const open = (pose === "reach" ? s.reach[look.x < 0 ? 0 : 1][g]?.[f] : pose === "scared" ? s.scared[f] : s.walk[g]?.[f]) ?? s.walk[3][0];
    return (pet.fold > 0 ? env.foldImage(pet, f, open) : open) ?? open;
  };

  const draw = () => {
    const sc = scene;
    if (!sc) return;
    const C = sc.catcher, V = sc.victim;
    if (sc.jar.shown) drawJarBack();
    if (V) {
      ctx.save();
      if (sc.jar.shown && INSIDE.includes(sc.phase)) clipToJar();
      env.drawAt(V, image(V, sc.vPose, sc.vLook));
      ctx.restore();
    }
    if (sc.jar.shown) drawJarFront();
    if (sc.lid.state === "on" || sc.lid.state === "arc" || sc.lid.state === "flying") drawLid();
    env.drawAt(C, image(C, sc.cPose, sc.cLook));
    if (sc.lid.state === "hat" && sc.jar.shown) {
      // Крышка на голове ловца, как шляпа.
      const hat = hatSpot(C);
      sc.lid.x = hat.x; sc.lid.y = hat.y; sc.lid.angle = C.angle;
      drawLid();
    }
  };

  return {
    start,
    step: (dt: number) => {
      if (!scene) return;
      try {
        update(dt); draw();
      } catch (error) {
        // Сбой сценки не должен останавливать осьминогов: отпускаем всех и выходим.
        console.error("Сценка с банкой прервана", error);
        for (let i = 0; i < 4; i++) ctx.restore();       // снимаем обрезку, если сбой случился внутри неё
        const sc = scene;
        scene = null;
        if (sc) {
          if (sc.victim) env.release(sc.victim);
          if (sc.guest) env.remove(sc.catcher); else env.release(sc.catcher);
        }
      }
    },
    get active() { return scene !== null; },
  };
}
