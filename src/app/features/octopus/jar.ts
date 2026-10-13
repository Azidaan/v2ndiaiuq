import { FRAMES, GRIP_STEPS, SPIN_STEPS, type SpriteSet } from "./sprite";
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
  /** sx, sy — сплющивание вдоль осей самого осьминога (1 — без искажения). */
  drawAt: (pet: Pet, image: HTMLCanvasElement, sx?: number, sy?: number) => void;
  foldImage: (pet: Pet, frame: number, open: HTMLCanvasElement) => HTMLCanvasElement;
  addParticle: (p: NewParticle) => void;
  emitTrail: (pet: Pet, dt: number) => void;
  /** Забирает осьминога у физики: выходит из игры, переходит в "scripted". */
  take: (pet: Pet) => void;
  /** Возвращает осьминога физике. */
  release: (pet: Pet) => void;
  /** Отдаёт осьминога физике уже летящей кометой. */
  launch: (pet: Pet, vx: number, vy: number) => void;
  /** Гость для экрана с одним осьминогом: появляется центром в (x, y). */
  spawn: (x: number, y: number) => Pet;
  remove: (pet: Pet) => void;
};

type Phase =
  | "exit" | "away" | "return" | "scoop" | "lid" | "toTop" | "screw" | "gloat"
  | "struggle" | "flip" | "unscrew" | "climb" | "lift" | "throw" | "leave";
type Pose = "walk" | "reach" | "scared";

/** Длительность фаз, с. Фазы без числа заканчиваются по событию. */
// Закручивание и откручивание идут рывками: поворот — перехват — поворот.
const TURN = 0.5;                // с на один оборот с перехватом
const SCREW_TURNS = 4;
const TIGHT = 0.8;               // последний тугой оборот
const PAT = 0.7;                 // два хлопка по закрученной крышке
// Открутка: первая попытка, передышка, вторая попытка с треском, пауза,
// обороты, последний рывок — хлопок.
const U_PUSH1 = 1.0, U_REST = 1.5, U_CRACK = 2.1, U_SIT = 2.6;
const U_TURNS = U_SIT + 4 * TURN, U_POP = U_TURNS + 0.5;

const DURATION: Partial<Record<Phase, number>> = {
  away: 0.8, scoop: 0.6, lid: 0.7, toTop: 0.5, screw: SCREW_TURNS * TURN + TIGHT + PAT, gloat: 1.1,
  struggle: 1.1, flip: 0.5, unscrew: U_POP, climb: 0.7, lift: 0.8,
};

const CARRY = 17;                // клеток от центра ловца до центра банки
const ABOVE_LID = 27;            // клеток от центра банки до ловца, крутящего крышку
const SIT = 9;                   // клеток от крышки до сидящего на ней ловца
// Сидящий на крышке ловец крутится с ней, как на вертушке: за оборот крышки
// поворачивается вокруг своей оси на такую долю круга.
const SPIN_PER_TURN = 1;
const GRIP = 23;                 // клеток от центра банки до осьминога, держащего её за горлышко

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => { t = clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/**
 * Оборот с перехватом: 65% времени — поворот, остальное — перехват.
 * progress — сколько оборотов сделано, с дробной частью.
 */
const ratchet = (t: number) => {
  const i = Math.floor(t / TURN), u = (t % TURN) / TURN;
  const twisting = u < 0.65;
  const g = twisting ? ease(u / 0.65) : ease((u - 0.65) / 0.35);
  return { twisting, g, progress: i + (twisting ? g : 1) };
};

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
    throwSide: number;
    cSquash: { x: number; y: number }; vSquash: { x: number; y: number };
    vJump: number;               // подскок пленника от щелчка крышки, клетки
    kick: number;                // встряска банки от щелчка
    glint: number;               // блик, бегущий по крышке, клетка; < -1 — нет
    lidWobble: number;
    wasTwisting: boolean; beat: number;   // для щелчков и разовых событий фазы
    cGone: boolean;              // ловца сдуло хлопком — им снова управляет физика
    cImg: HTMLCanvasElement | null; vImg: HTMLCanvasElement | null;   // кадр вместо позы — хват крышки
    cBump: number;               // ловца на крышке подбрасывает щелчком, клетки
    cSpin: number;               // поворот сидящего ловца вокруг своей оси, радианы
    /** Пузырьки внутри банки, в клетках банки: поднимаются и лопаются под крышкой. */
    inner: { x: number; y: number; vy: number; wob: number; age: number; size: number }[];
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
  // Посаженная крышка закрывает ободок горлышка; lift < 0 — приподнята на резьбе.
  const lidSeat = () => jarPoint(0, -13 + scene!.lid.lift);
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

  const go = (phase: Phase) => {
    const sc = scene!;
    sc.phase = phase; sc.t = 0; sc.beat = 0; sc.wasTwisting = false;
    sc.cSquash = { x: 1, y: 1 }; sc.vSquash = { x: 1, y: 1 };
    sc.cImg = null; sc.vImg = null;
  };

  /** Кадр хвата: sweep от -1 (крышка провёрнута влево) до 1. */
  const gripFrame = (strain: boolean, open: boolean, sweep: number) =>
    env.sprites().grip[strain ? 1 : 0][open ? 1 : 0][Math.round((clamp(sweep, -1, 1) + 1) / 2 * (GRIP_STEPS - 1))];
  /** Сидит на крышке, повёрнутый вокруг своей оси на yaw радиан. */
  const sitFrame = (strain: boolean, yaw = 0) => {
    const i = Math.round((yaw / (Math.PI * 2)) * SPIN_STEPS);
    return env.sprites().spin[strain ? 1 : 0][((i % SPIN_STEPS) + SPIN_STEPS) % SPIN_STEPS];
  };
  /** Пузырёк внутри банки; координаты — клетки банки (0…20 по ширине, 0…24 по высоте). */
  const innerBubble = (x: number, y: number) => {
    scene!.inner.push({ x, y, vy: -rand(4, 9), wob: rand(0, 6), age: 0, size: Math.random() < 0.55 ? 1 : 2 });
  };
  /** Ловец сидит на крышке: держится за края, подпрыгивает от щелчков. */
  const sitOnLid = (C: Pet, bob = 0) => {
    const seat = lidSeat();
    place(C, seat.x, seat.y - (SIT + scene!.cBump * 2 + bob) * cell());
  };

  /** Пот: капли слетают с макушки в стороны. */
  const sweat = (pet: Pet) => {
    const p = center(pet), c = cell(), a = pet.angle;
    const side = Math.random() < 0.5 ? -1 : 1;
    env.addParticle({ kind: "drop", x: p.x + 5 * c * Math.sin(a) + side * 4 * c, y: p.y - 5 * c * Math.cos(a),
      vx: side * rand(40, 90), vy: -rand(50, 110), life: rand(0.45, 0.7), size: 1 });
  };
  /** Щелчок резьбы: искры по краям крышки, банка вздрагивает, пленник подскакивает. */
  const click = (big = false) => {
    const sc = scene!;
    for (const x of [-8, 8]) { const p = jarPoint(x, -13 + sc.lid.lift); sparks(p.x, p.y, big ? 7 : 3, big ? 200 : 110); }
    sc.vJump = 1; sc.kick = big ? 1.4 : 0.7;
  };

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
      throwSide: 1,
      cSquash: { x: 1, y: 1 }, vSquash: { x: 1, y: 1 }, vJump: 0, kick: 0, glint: -9, lidWobble: 0,
      wasTwisting: false, beat: 0, cGone: false, cImg: null, vImg: null, cBump: 0,
      cSpin: 0, inner: [],
    };
    return true;
  };

  const finish = () => {
    const sc = scene!;
    if (sc.victim) env.release(sc.victim);
    if (sc.cGone && !sc.guest) { scene = null; return; }   // ловец давно сам по себе
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
        if (sc.beat === 0 && into > 0.6) { sc.beat = 1; for (let i = 0; i < 7; i++) innerBubble(rand(4, 15), rand(10, 20)); }   // бульк
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
        // Закручивает рывками. Каждый оборот щёлкает, крышка опускается по резьбе,
        // пленник подпрыгивает. Последний оборот тугой — ловец пыжится и потеет.
        // Потом два довольных хлопка по крышке, и по ней пробегает блик.
        foldTo(C, 0, dt, 3);
        sc.cPose = "walk"; sc.cLook = { x: 0, y: 1 };
        let rise = 0;
        const tight = SCREW_TURNS * TURN, pat = tight + TIGHT;
        if (sc.t < tight) {
          const r = ratchet(sc.t);
          sc.lid.twist = r.progress * 3;
          sc.lid.lift = lerp(-2.5, -0.6, r.progress / SCREW_TURNS);
          if (r.twisting) {
            // Щупальца обхватили крышку и проворачивают её.
            sc.cImg = gripFrame(false, false, lerp(-1, 1, r.g));
            C.angle = lerp(-0.12, 0.12, r.g);
            const p = Math.sin(r.g * Math.PI);
            sc.cSquash = { x: 1 + 0.06 * p, y: 1 - 0.1 * p };
          } else {
            // Перехват: разжимает щупальца и заносит их обратно.
            sc.cImg = gripFrame(false, true, lerp(1, -1, r.g));
            C.angle = lerp(0.12, -0.12, r.g);
            rise = Math.sin(r.g * Math.PI) * 2;          // приподнимается, перехватывая
            sc.cSquash = { x: 1, y: 1 };
          }
          if (sc.wasTwisting && !r.twisting) click();
          sc.wasTwisting = r.twisting;
        } else if (sc.t < pat) {
          const v = (sc.t - tight) / TIGHT;
          C.angle = Math.sin(sc.t * 60) * 0.05;
          sc.cImg = gripFrame(true, false, 0.4 + v * 0.6 + Math.sin(sc.t * 45) * 0.25);
          sc.cSquash = { x: 1.1 + Math.sin(sc.t * 30) * 0.03, y: 0.86 };
          sc.lid.twist = SCREW_TURNS * 3 + v * 1.5 + Math.sin(sc.t * 60) * 0.3;
          sc.lid.lift = lerp(-0.6, 0, v);
          if (Math.random() < dt * 10) sweat(C);
          sc.wasTwisting = true;
        } else {
          if (sc.wasTwisting) { sc.wasTwisting = false; click(true); }
          sc.cImg = null;
          const v = (sc.t - pat) / PAT;
          C.angle = lerpAngle(C.angle, 0, Math.min(1, dt * 10));
          rise = Math.abs(Math.sin(v * Math.PI * 2)) * 2.5;
          sc.glint = lerp(-2, 18, v);
          if (v >= (sc.beat + 1) * 0.5) {                  // хлоп!
            sc.beat++;
            const p = jarPoint(0, -15);
            sparks(p.x, p.y, 5, 120);
            sc.kick = 0.5;
          }
        }
        place(C, sc.jar.x, sc.jar.y + (-ABOVE_LID + sc.lid.lift - rise) * c);
        if (V) {
          sc.vLook = { x: 0, y: -1 };
          V.angle = Math.sin(sc.t * 9) * 0.08;
          const p = jarPoint(0, -sc.vJump * 1.6);
          place(V, p.x, p.y);
        }
        if (done) {
          sc.glint = -9;
          go("gloat");
        }
        break;
      }
      case "gloat": {
        // Довольный ловец усаживается на закрученную крышку и пританцовывает на ней.
        C.angle = lerpAngle(C.angle, 0, Math.min(1, dt * 8));
        foldTo(C, 0, dt, 2.5);
        const seat = lidSeat();
        const sitY = seat.y - SIT * c - Math.abs(Math.sin(sc.t * 7)) * 1.5 * c * ease(k * 3);
        place(C, seat.x, lerp(seat.y - ABOVE_LID * c + 13 * c, sitY, ease(k * 2.5)));
        sc.cImg = sitFrame(false);
        if (done) go("struggle");
        break;
      }
      case "struggle": {
        // Пленник бьётся о стенки: банка дрожит, изнутри поднимаются пузырьки.
        // Ловец сидит сверху и покачивается вместе с банкой.
        sc.jar.shake = Math.round(Math.sin(sc.t * 42) * c * 0.6);
        sitOnLid(C);
        sc.cImg = sitFrame(false);
        if (V) {
          V.angle = Math.sin(sc.t * 25) * 0.22;
          if (Math.random() < dt * 8) innerBubble(rand(6, 13), rand(12, 17));
        }
        if (done) { sc.jar.shake = 0; sc.from.angle = V?.angle ?? 0; go("flip"); }
        break;
      }
      case "flip": {
        // Переворачивается вниз головой и упирается в крышку раскрытыми щупальцами.
        sitOnLid(C);
        sc.cImg = sitFrame(false);
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
        if (!V) break;
        // Откручивает изнутри, вниз головой. Сначала не выходит: тужится,
        // сползает передохнуть. Со второй попытки крышка с треском поддаётся.
        // Сидящий на крышке ловец крутится вместе с ней, как на вертушке,
        // а на хлопке его сдувает кометой.
        foldTo(V, 0, dt, 2.5);
        sc.vPose = "walk"; sc.vLook = { x: 0, y: 1 };
        let depth = 0.6, ang = Math.PI;
        const t = sc.t;
        if (t < U_PUSH1) {
          ang += Math.sin(t * 45) * 0.05;
          sc.vImg = gripFrame(true, false, Math.sin(t * 30) * 0.25);   // вцепился и тужится
          sc.vSquash = { x: 0.92, y: 1.12 + Math.sin(t * 30) * 0.03 };
        } else if (t < U_REST) {
          depth = lerp(0.6, 2.5, ease((t - U_PUSH1) * 4));
          sc.vImg = null;
          sc.vSquash = { x: 1.06, y: 0.92 };
          if (sc.beat === 0) { sc.beat = 1; for (let i = 0; i < 4; i++) innerBubble(rand(8, 12), rand(14, 18)); }   // уф
        } else if (t < U_CRACK) {
          depth = lerp(2.5, 0.4, ease((t - U_REST) * 5));
          ang += Math.sin(t * 55) * 0.07;
          sc.vImg = gripFrame(true, false, -0.3 + Math.sin(t * 40) * 0.3);
          sc.vSquash = { x: 0.88, y: 1.16 };
          if (t > U_CRACK - 0.2 && sc.beat === 1) {      // крак!
            sc.beat = 2;
            sc.lid.twist -= 1.5; sc.lid.lift = -0.4;
            click(true);
            sc.cBump = 1.4;                                  // ловец подпрыгивает от треска
          }
        } else if (t < U_SIT) {
          depth = 0.8;
          sc.vImg = gripFrame(false, false, -1);            // перехватился для первого оборота
        } else if (t < U_TURNS) {
          const r = ratchet(t - U_SIT);
          sc.lid.twist = -1.5 - r.progress * 3;
          sc.lid.lift = lerp(-0.4, -3.5, r.progress / 4);
          // Щупальца проворачивают крышку, на перехвате разжимаются и заносятся обратно.
          sc.vImg = r.twisting ? gripFrame(true, false, lerp(-1, 1, r.g)) : gripFrame(false, true, lerp(1, -1, r.g));
          ang += r.twisting ? lerp(0.1, -0.1, r.g) : lerp(-0.1, 0.1, r.g);
          sc.vSquash = r.twisting ? { x: 0.95, y: 1.08 } : { x: 1, y: 1 };
          depth = 0.8 - sc.lid.lift * 0.4;
          if (r.twisting && Math.random() < dt * 12) innerBubble(rand(5, 14), rand(8, 14));   // пленник пыхтит
          if (sc.wasTwisting && !r.twisting) { click(); sc.cBump = 0.6; }
          sc.wasTwisting = r.twisting;
        } else {
          sc.vImg = gripFrame(true, false, Math.sin(t * 40) * 0.5);
          // Последний рывок: крышка ходит ходуном, пленник сжимается для толчка.
          const v = (t - U_TURNS) / (U_POP - U_TURNS);
          sc.lidWobble = Math.sin(t * 50) * 0.1 * v;
          sc.kick = Math.max(sc.kick, 0.4 * v);
          depth = lerp(2.2, 2.6, v);
          sc.vSquash = { x: 1.1, y: 0.82 };
        }
        V.angle = ang;
        const p = jarPoint(0, depth);
        place(V, p.x, p.y);

        // Ловец сидит на крышке. Пока пленник тужится — сидит спокойно, от треска
        // подпрыгивает, а потом крышка начинает вращаться и крутит его вокруг
        // своей оси: лицо уезжает вбок и за спину, щупальца кольцом идут следом.
        sitOnLid(C);
        const startled = t > U_CRACK - 0.2;
        if (t >= U_SIT && t < U_TURNS) {
          sc.cSpin = ratchet(t - U_SIT).progress * SPIN_PER_TURN * Math.PI;
        } else if (t >= U_TURNS) {
          sc.cSpin += dt * 3;                               // крышку трясёт — его тоже
          C.angle = Math.sin(t * 50) * 0.08;
        }
        sc.cImg = sitFrame(startled, sc.cSpin);

        if (done) {
          // Хлопок: крышка улетает вверх, ловца сдувает кометой.
          const seat = lidSeat();
          sc.lidWobble = 0;
          sc.lid.state = "flying"; sc.lid.x = seat.x; sc.lid.y = seat.y;
          sc.lid.vx = rand(-90, 90); sc.lid.vy = -560; sc.lid.spin = rand(8, 13) * (Math.random() < 0.5 ? -1 : 1);
          const mouth = jarPoint(0, -12);
          sparks(mouth.x, mouth.y, 16, 240);
          sc.cGone = true;
          C.angle = 0;
          env.launch(C, rand(-260, 260), -760);
          sc.from = { ...center(V), angle: V.angle };
          go("climb");                                      // go() сбрасывает кадры хвата
          sc.vSquash = { x: 0.85, y: 1.25 };
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
          // Вытягивается из горлышка, к концу снова обычной формы.
          sc.vSquash = { x: lerp(0.85, 1, ease(k)), y: lerp(1.25, 1, ease(k)) };
        }
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
        const gone = sc.jar.x < -40 * c || sc.jar.x > w + 40 * c || sc.jar.y > h + 40 * c;
        if (gone) sc.jar.shown = false;
        if (gone && sc.lid.state === "gone" && sc.t > 0.6) finish();
        break;
      }
      case "leave": {
        // Сдутый хлопком гость сначала приземляется, потом уплывает.
        if (C.mode !== "scripted") {
          if (C.mode !== "free") break;
          env.take(C);
          sc.cGone = false;
        }
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
      l.x = seat.x; l.y = seat.y; l.angle = j.angle + sc.lidWobble;
    }
    // Банка вздрагивает от щелчков; в «бьётся о стенки» трясёт сама фаза.
    if (sc.phase !== "struggle") {
      sc.kick = Math.max(0, sc.kick - dt * 4);
      j.shake = Math.round(Math.sin(sc.t * 70) * sc.kick * c * 0.6);
    }
    sc.vJump = Math.max(0, sc.vJump - dt * 6);
    // Внутренние пузырьки поднимаются, покачиваясь, и лопаются под крышкой или у горлышка.
    for (let i = sc.inner.length - 1; i >= 0; i--) {
      const b = sc.inner[i];
      b.age += dt; b.y += b.vy * dt; b.x += Math.sin(b.age * 6 + b.wob) * dt * 2;
      if (b.y < 3 || b.age > 3 || !sc.jar.shown) sc.inner.splice(i, 1);
    }
    sc.cBump = Math.max(0, sc.cBump - dt * 6);

    if (!sc.cGone) C.phase += dt * (3 + Math.min(160, Math.hypot(C.vx, C.vy)) * 0.03);
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
    for (const x of [4, 7, 10, 13]) { cells(x, 1, 1, 1, "#7FB2DE"); cells(x + 1, 2, 1, 1, "#7FB2DE"); }   // резьба
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
    const g = Math.floor(scene!.glint);
    if (g > -2 && g < 17) {                               // блик пробегает по крышке
      if (g >= 0 && g < 16) cells(g, 0, 1, 3, "rgba(255, 255, 255, 0.85)");
      if (g + 1 >= 0 && g + 1 < 16) cells(g + 1, 0, 1, 2, "rgba(255, 255, 255, 0.45)");
    }
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
    // Внутренность стекла построчно — и в горлышке, и в плечиках банки. Нижняя
    // строка — само дно, в неё не заходим; от стенок отступаем на полпикселя,
    // иначе на плотных экранах кончики щупалец проступают из-под стекла.
    JAR_ROWS.slice(0, -1).forEach(([a, b], y) =>
      ctx.rect((a + 1) * c + 0.5, y * c, (b - a - 1) * c - 1, y === JAR_H - 2 ? c - 0.5 : c + 0.5));
    // За горлышком виден, только пока банка открыта: залезает или вылезает.
    if (scene!.lid.state !== "on") ctx.rect(-400 * c, -800 * c, 800 * c, 800 * c);
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
      env.drawAt(V, sc.vImg ?? image(V, sc.vPose, sc.vLook), sc.vSquash.x, sc.vSquash.y);
      ctx.restore();
    }
    if (sc.jar.shown && sc.inner.length) withJar(() => {
      for (const b of sc.inner) {
        if (b.size > 1) { cells(b.x, b.y, 2, 2, "rgba(191, 220, 250, 0.55)"); cells(b.x, b.y, 1, 1, "#FFFFFF"); }
        else cells(b.x, b.y, 1, 1, "#BFDCFA");
      }
    });
    if (sc.jar.shown) drawJarFront();
    if (sc.lid.state === "on" || sc.lid.state === "arc" || sc.lid.state === "flying") drawLid();
    if (!sc.cGone) env.drawAt(C, sc.cImg ?? image(C, sc.cPose, sc.cLook), sc.cSquash.x, sc.cSquash.y);
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
          if (sc.guest) env.remove(sc.catcher); else if (!sc.cGone) env.release(sc.catcher);
        }
      }
    },
    get active() { return scene !== null; },
  };
}
