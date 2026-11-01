/**
 * Level data types + crayon rendering of the whole game world.
 */
import { sketchRect, sketchCircle, sketchLine, crayonText, boil, hash, INK } from "./draw";

export interface Rect { x: number; y: number; w: number; h: number }
export interface KeyItem { id: number; x: number; y: number }
export interface CoinItem { x: number; y: number }
export interface BridgeItem extends Rect { id: string }
export interface DoorItem extends Rect { id: number }
export interface LeverItem { x: number; y: number; links: string[] }
/** A big pumpkin you walk into. (x, y) is its center; (tx, ty) is where the player appears. */
export interface PumpkinPortal { x: number; y: number; tx: number; ty: number }
export type EnemyKind = "beast" | "bird" | "wind" | "rain" | "fire" | "bat" | "spider" | "monster";
export interface EnemyItem {
  type: EnemyKind;
  x: number; y: number;
  min: number; max: number;
  speed: number;
  amp?: number;
}
/** Live enemy state: x = current center, cy = current draw y (feet for beasts, center for birds). */
export interface EnemyRuntime extends EnemyItem {
  dir: number;
  cy: number;
  /** rain clouds: countdown until the next droplet */
  dropT?: number;
}

/** A falling raindrop spat out by a rain cloud. */
export interface DropRuntime {
  x: number; y: number; vy: number;
}

/** Which planet the level lives on — changes the notebook doodle background. */
export type Theme = "home" | "wind" | "rain" | "fire" | "storm" | "volcano" | "halloween";

export interface LevelData {
  name: string;
  theme?: Theme;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  platforms: Rect[];
  lava: Rect[];
  spikes: Rect[];
  keys: KeyItem[];
  coins: CoinItem[];
  lever: LeverItem;
  bridges: BridgeItem[];
  doors: DoorItem[];
  enemies: EnemyItem[];
  /** walk-in pumpkins that pop you up to a sky path. Halloween levels 63–70. */
  pumpkins?: PumpkinPortal[];
  exit: Rect;
}

export interface WorldState {
  level: LevelData;
  levelIndex: number;
  keysTaken: Set<number>;
  coinsTaken: Set<number>;
  leverPulled: boolean;
  openDoors: Set<number>;
  enemies: EnemyRuntime[];
  deadEnemies: Set<number>;
  /** live raindrops falling from rain clouds */
  drops: DropRuntime[];
  time: number;
  /** small hint text + timer, e.g. "find key 1!" */
  hint: string;
  hintT: number;
}

const PLATFORM_FILL = "#efe6c2";
const LAVA = "#e04f4f";
const LAVA_DEEP = "#c23a3a";

/* ---------- background: notebook paper with planet doodles ---------- */

const THEMES: Record<Theme, { paper: string; line: string }> = {
  home: { paper: "#fdf9ef", line: "rgba(74,144,217,0.18)" },
  wind: { paper: "#edf7f0", line: "rgba(90,170,110,0.16)" },
  rain: { paper: "#e9f0f7", line: "rgba(74,144,217,0.20)" },
  fire: { paper: "#fdf0e0", line: "rgba(224,120,60,0.16)" },
  storm: { paper: "#e4e8f0", line: "rgba(90,110,160,0.20)" },
  volcano: { paper: "#f6e6da", line: "rgba(210,100,60,0.18)" },
  halloween: { paper: "#f3e8fb", line: "rgba(239,143,74,0.28)" },
};

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  camX: number,
  levelW: number,
  t: number,
  theme: Theme = "home",
): void {
  const th = THEMES[theme];
  const f = boil(t);

  // paper + ruled lines (Ira's notebook on every planet)
  ctx.fillStyle = th.paper;
  ctx.fillRect(0, 0, 960, 540);
  ctx.strokeStyle = th.line;
  ctx.lineWidth = 2;
  for (let y = 32; y < 540; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(960, y);
    ctx.stroke();
  }

  if (theme === "wind") {
    drawWindSky(ctx, camX, levelW, t, f);
  } else if (theme === "rain" || theme === "storm") {
    drawRainSky(ctx, camX, levelW, t, f, theme === "storm");
  } else if (theme === "fire" || theme === "volcano") {
    drawFireSky(ctx, camX, levelW, t, f, theme === "volcano");
  } else if (theme === "halloween") {
    drawHalloweenSky(ctx, camX, levelW, t, f);
  } else {
    // home: wobbly sun doodle (parallax with camera)
    const sunX = 140 - (camX * 0.2) % 960;
    sketchCircle(ctx, sunX < -80 ? sunX + 1040 : sunX, 70, 26, "#f2c14e", 3, f, 2);
    drawCloudRow(ctx, camX, levelW, t, "#ffffff");
  }
}

function drawCloudRow(
  ctx: CanvasRenderingContext2D, camX: number, levelW: number, t: number, fill: string,
): void {
  const f = boil(t);
  const clouds: Array<[number, number, number]> = [
    [300, 80, 1], [700, 60, 1.3], [1150, 90, 0.8], [1600, 70, 1.1], [2100, 85, 0.9],
  ];
  for (const [cx, cy, sc] of clouds) {
    const px = ((cx - camX * 0.4) % (levelW + 400) + levelW + 400) % (levelW + 400) - 200;
    if (px > -80 && px < 1040) {
      sketchCircle(ctx, px, cy, 18 * sc, fill, cx, f, 2);
      sketchCircle(ctx, px + 20 * sc, cy + 4 * sc, 14 * sc, fill, cx + 1, f, 2);
      sketchCircle(ctx, px - 18 * sc, cy + 5 * sc, 13 * sc, fill, cx + 2, f, 2);
    }
  }
}

/** Wind Planet: spiralling gusts + a kite doodle. */
function drawWindSky(
  ctx: CanvasRenderingContext2D, camX: number, levelW: number, t: number, f: number,
): void {
  // swirls (spiral strokes that drift with the camera)
  const swirls: Array<[number, number, number]> = [
    [150, 120, 1], [500, 90, 0.8], [850, 130, 1.2], [1200, 80, 0.9], [1700, 110, 1.1],
  ];
  for (const [sx, sy, sc] of swirls) {
    const px = ((sx - camX * 0.3) % (levelW + 400) + levelW + 400) % (levelW + 400) - 200;
    if (px < -100 || px > 1060) continue;
    const spin = t * 2 + sx;
    ctx.strokeStyle = "rgba(90,150,170,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 26; i++) {
      const a = spin + (i / 26) * Math.PI * 3;
      const r = 4 + i * 1.1 * sc;
      const wx = px + Math.cos(a) * r * 1.4;
      const wy = sy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
    }
    ctx.stroke();
  }
  // kite with a wavy tail
  const kx = ((700 - camX * 0.45) % (levelW + 400) + levelW + 400) % (levelW + 400) - 200;
  if (kx > -60 && kx < 1020) {
    const ky = 90 + Math.sin(t * 1.5) * 10;
    const bob2 = boil(t);
    ctx.beginPath();
    ctx.moveTo(kx, ky - 22); ctx.lineTo(kx + 20, ky); ctx.lineTo(kx, ky + 22); ctx.lineTo(kx - 20, ky);
    ctx.closePath();
    ctx.fillStyle = "#ef8f4a";
    ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    sketchLine(ctx, kx, ky + 22, kx + 6, ky + 70, 55, bob2, 1, "#9a6fd0", 2);
    sketchLine(ctx, kx + 6, ky + 70, kx - 4, ky + 110, 56, bob2, 1, "#9a6fd0", 2);
    sketchLine(ctx, kx - 4, ky + 110, kx + 8, ky + 150, 57, bob2, 1, "#9a6fd0", 2);
  }
  drawCloudRow(ctx, camX, levelW, t, "#ffffff");
}

/** Rain Planet / Storm Planet: dark clouds + falling rain streaks (+ lightning on storms). */
function drawRainSky(
  ctx: CanvasRenderingContext2D, camX: number, levelW: number, t: number, f: number, storm: boolean,
): void {
  const cloudFill = storm ? "#b6bfd0" : "#cdd6e2";
  drawCloudRow(ctx, camX, levelW, t, cloudFill);
  // rain streaks
  ctx.strokeStyle = storm ? "rgba(90,120,180,0.55)" : "rgba(100,150,210,0.5)";
  ctx.lineWidth = 2;
  const phase = (t * (storm ? 340 : 220)) % 90;
  for (let i = 0; i < 26; i++) {
    const rx = ((i * 97 + 40 - camX * 0.25) % 1040 + 1040) % 1040;
    const ry = ((i * 53) % 90 + phase) % 640;
    if (ry > 560) continue;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - 6, ry + 16);
    ctx.stroke();
  }
  if (storm) {
    // wobbly lightning bolts that flash
    const flash = Math.sin(t * 2.3) > 0.55;
    if (flash) {
      for (const bx of [240, 640]) {
        sketchLine(ctx, bx, 40, bx - 14, 110, bx, f, 2, "#f2c14e", 4);
        sketchLine(ctx, bx - 14, 110, bx + 10, 150, bx + 1, f, 2, "#f2c14e", 4);
        sketchLine(ctx, bx + 10, 150, bx - 4, 210, bx + 2, f, 2, "#f2c14e", 4);
      }
    }
  } else {
    // puddle doodles at the bottom
    for (let i = 0; i < 7; i++) {
      const px = ((i * 173 + 90 - camX * 0.12) % 1100 + 1100) % 1100 - 70;
      ctx.beginPath();
      ctx.ellipse(px, 516, 26, 5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(74,144,217,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

/** Fire Planet / Volcano Planet: hot sun, embers floating up + a volcano doodle. */
function drawFireSky(
  ctx: CanvasRenderingContext2D, camX: number, levelW: number, t: number, f: number, volcano: boolean,
): void {
  // big red-orange sun
  const sunX = 140 - (camX * 0.2) % 960;
  sketchCircle(ctx, sunX < -80 ? sunX + 1040 : sunX, 70, 30, volcano ? "#e04f4f" : "#ef8f4a", 3, f, 2);
  // embers floating up (deterministic wobble)
  ctx.fillStyle = volcano ? "rgba(224,79,79,0.55)" : "rgba(239,143,74,0.5)";
  for (let i = 0; i < 18; i++) {
    const ex = ((i * 137 + 30 - camX * 0.18) % 1100 + 1100) % 1100 - 70;
    const ey = 540 - (((i * 71) % 90) + (t * (30 + (i % 5) * 12)) % 560);
    ctx.beginPath();
    ctx.arc(ex, ey, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // volcano silhouette doodles
  const vs: Array<[number, number]> = volcano ? [[220, 1.1], [760, 0.8]] : [[520, 0.7]];
  for (const [vx, sc] of vs) {
    const px = ((vx - camX * 0.15) % (levelW + 400) + levelW + 400) % (levelW + 400) - 200;
    if (px < -180 || px > 1140) continue;
    const base = 540;
    const top = base - 190 * sc;
    ctx.beginPath();
    ctx.moveTo(px - 130 * sc, base);
    ctx.lineTo(px - 26 * sc, top);
    ctx.lineTo(px + 26 * sc, top);
    ctx.lineTo(px + 130 * sc, base);
    ctx.closePath();
    ctx.fillStyle = volcano ? "#d9a184" : "#e8c4a4";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    // little smoke puffs from the crater
    for (let i = 0; i < 3; i++) {
      const puf = (t * 0.5 + i * 0.33) % 1;
      sketchCircle(ctx, px + Math.sin(t + i * 2) * 8, top - 10 - puf * 60, 7 + puf * 6, "#d8d2c4", vx + i, f, 1.4);
    }
  }
  drawCloudRow(ctx, camX, levelW, t, "#f3ded0");
}

/** Halloween: a moon, pumpkin doodles, and tiny bats in the notebook sky. */
function drawHalloweenSky(
  ctx: CanvasRenderingContext2D, camX: number, levelW: number, t: number, f: number,
): void {
  const moonX = 160 - (camX * 0.15) % 960;
  const mx = moonX < -80 ? moonX + 1040 : moonX;
  sketchCircle(ctx, mx, 68, 28, "#f6e7a8", 3, f, 1.6);
  sketchCircle(ctx, mx - 8, 60, 5, "rgba(232,210,140,0.9)", 4, f, 0.6);
  sketchCircle(ctx, mx + 10, 74, 4, "rgba(232,210,140,0.9)", 5, f, 0.5);

  // little stars
  for (let i = 0; i < 10; i++) {
    const sx = ((i * 113 + 40 - camX * 0.08) % 1040 + 1040) % 1040;
    const sy = 28 + (i * 37) % 90;
    sketchLine(ctx, sx - 4, sy, sx + 4, sy, 80 + i, f, 0.4, "#f2c14e", 2);
    sketchLine(ctx, sx, sy - 4, sx, sy + 4, 90 + i, f, 0.4, "#f2c14e", 2);
  }

  // decorative bats, much smaller than the ones you can stomp
  for (let i = 0; i < 5; i++) {
    const bx = ((i * 210 + 80 - camX * 0.35 + t * 18) % (levelW + 300) + levelW + 300) % (levelW + 300) - 150;
    if (bx < -30 || bx > 990) continue;
    const by = 48 + (i % 3) * 22;
    const flap = Math.sin(t * 10 + i) * 6;
    ctx.strokeStyle = "#4c3f72";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - 8, by + flap);
    ctx.quadraticCurveTo(bx - 4, by - 6, bx, by);
    ctx.quadraticCurveTo(bx + 4, by - 6, bx + 8, by + flap);
    ctx.stroke();
  }
}

/* ---------- world ---------- */

export function drawWorld(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const { level, time: t } = st;
  const f = boil(t);

  // bridges (only once the lever is pulled)
  if (st.leverPulled) {
    for (const b of level.bridges) {
      sketchRect(ctx, b.x, b.y, b.w, b.h, "#d9b98a", 40, f, 1.5);
      // planks
      for (let px = b.x + 10; px < b.x + b.w; px += 24) {
        sketchLine(ctx, px, b.y + 2, px - 3, b.y + b.h - 2, 41, f, 0.8, INK, 1.5);
      }
    }
  }

  // platforms
  for (const p of level.platforms) {
    sketchRect(ctx, p.x, p.y, p.w, p.h, PLATFORM_FILL, p.x + p.y, f, 2);
    // pencil hatching
    for (let hx = p.x + 8; hx < p.x + p.w - 6; hx += 34) {
      sketchLine(ctx, hx, p.y + p.h - 6, hx + 12, p.y + p.h - 12, hx, f, 0.6, "rgba(65,64,60,0.25)", 2);
    }
    // grass tufts on tops
    for (let gx = p.x + 6; gx < p.x + p.w - 4; gx += 42) {
      sketchLine(ctx, gx, p.y, gx - 2, p.y - 6, gx + 1, f, 0.8, "#5eaa61", 3);
      sketchLine(ctx, gx + 4, p.y, gx + 5, p.y - 7, gx + 2, f, 0.8, "#5eaa61", 3);
    }
  }

  // lava
  for (const l of level.lava) {
    ctx.fillStyle = LAVA;
    ctx.fillRect(l.x, l.y + 3, l.w, l.h);
    // wavy top
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const px = l.x + (l.w * i) / 10;
      const py = l.y + 3 + Math.sin(t * 4 + i * 1.3 + l.x) * 3;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    // squiggly heat lines (like Ira's drawing)
    for (let sx = l.x + 10; sx < l.x + l.w - 6; sx += 22) {
      const wob = Math.sin(t * 6 + sx * 0.35) * 3;
      sketchLine(ctx, sx, l.y + 10 + wob, sx + 3, l.y + l.h - 4, sx + l.x, f, 1, LAVA_DEEP, 2);
    }
    // bubbles
    for (let bi = 0; bi < 3; bi++) {
      const bt = (t * 0.6 + bi * 0.33 + l.x * 0.01) % 1;
      const bx = l.x + 14 + bi * (l.w - 28) / 2 + Math.sin(bi * 9 + t) * 6;
      const by = l.y + l.h - 6 - bt * (l.h - 12);
      sketchCircle(ctx, bx, by, 2.4, "#ffd0a0", sxb(bi, l.x), f, 0.5, "rgba(255,255,255,0.7)");
    }
  }

  // spikes (triangles from Ira's drawing)
  for (const s of level.spikes) {
    const n = Math.max(2, Math.floor(s.w / 18));
    for (let i = 0; i < n; i++) {
      const sx = s.x + (s.w / n) * i;
      const sw = s.w / n;
      ctx.beginPath();
      ctx.moveTo(sx, s.y + s.h);
      ctx.lineTo(sx + sw / 2, s.y + Math.sin(i * 7 + f) * 2);
      ctx.lineTo(sx + sw, s.y + s.h);
      ctx.closePath();
      ctx.fillStyle = "#c9c4b5";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  // coins (circle with a dot, exactly like the sketch)
  for (let i = 0; i < level.coins.length; i++) {
    if (st.coinsTaken.has(i)) continue;
    const c = level.coins[i];
    const bob = Math.sin(t * 3 + c.x) * 3;
    sketchCircle(ctx, c.x, c.y + bob, 8, "#f2c14e", c.x, f, 1);
    sketchCircle(ctx, c.x, c.y + bob, 3, null, c.x + 1, f, 0.6);
  }

  // keys (little circle with a stem — a skeleton key like the sketch)
  for (const k of level.keys) {
    if (st.keysTaken.has(k.id)) continue;
    const bob = Math.sin(t * 2.5 + k.x) * 4;
    const color = k.id === 1 ? "#ef8f4a" : "#9a6fd0";
    sketchCircle(ctx, k.x, k.y + bob, 6, color, k.x, f, 1);
    sketchLine(ctx, k.x + 5, k.y + bob, k.x + 16, k.y + bob, k.x + 2, f, 0.8, color, 3);
    sketchLine(ctx, k.x + 13, k.y + bob, k.x + 13, k.y + bob + 5, k.x + 3, f, 0.5, color, 3);
    crayonText(ctx, String(k.id), k.x - 1, k.y + bob, 9, "#fff", f, k.id);
  }

  // lever ("Push this")
  const lv = level.lever;
  sketchRect(ctx, lv.x - 12, lv.y - 6, 24, 10, "#c9c4b5", 60, f, 1);
  const stickAng = st.leverPulled ? 0.6 : -0.6;
  const tipX = lv.x + Math.sin(stickAng) * 22;
  const tipY = lv.y - 6 - Math.cos(stickAng) * 22;
  sketchLine(ctx, lv.x, lv.y - 6, tipX, tipY, 61, f, 1, "#e04f4f", 4);
  sketchCircle(ctx, tipX, tipY, 4, "#e04f4f", 62, f, 0.8);
  if (!st.leverPulled) {
    crayonText(ctx, "push this!", lv.x, lv.y - 46, 15, INK, f, 63);
  }

  for (const pk of level.pumpkins ?? []) drawPumpkinPortal(ctx, pk, t, f);

  // doors (two stacked blocks like the sketch: door 1 top, door 2 bottom)
  for (const d of level.doors) {
    const open = st.openDoors.has(d.id);
    const color = d.id === 1 ? "#e04f4f" : "#4a90d9";
    if (open) {
      // swung open: draw a thin sliver at the hinge
      ctx.save();
      ctx.translate(d.x, d.y + d.h);
      ctx.rotate(-1.1);
      sketchRect(ctx, 0, -d.h, 8, d.h, color, 70 + d.id, f, 1);
      ctx.restore();
    } else {
      sketchRect(ctx, d.x, d.y, d.w, d.h, color, 70 + d.id, f, 2);
      // knob
      sketchCircle(ctx, d.x + d.w - 7, d.y + d.h / 2, 3, "#f2c14e", 71 + d.id, f, 0.5);
    }
    crayonText(ctx, String(d.id), d.x - 12, d.y + d.h / 2, 18, color, f, 72 + d.id);
  }

  // exit sign + star
  const ex = level.exit;
  crayonText(ctx, "finish!", ex.x + ex.w / 2, ex.y + 8, 20, "#5eaa61", f, 80);
  const starSpin = t * 1.5;
  ctx.save();
  ctx.translate(ex.x + ex.w / 2, ex.y + 44);
  ctx.rotate(Math.sin(starSpin) * 0.25);
  drawStar(ctx, 14, "#f2c14e", f);
  ctx.restore();

  // enemies: beasts, birds and planet villains ("they can kill!" — Ira, v2)
  for (let i = 0; i < st.enemies.length; i++) {
    if (st.deadEnemies.has(i)) continue;
    const e = st.enemies[i];
    if (e.type === "beast") drawBeast(ctx, e, t, f);
    else if (e.type === "bird") drawBird(ctx, e, t, f);
    else if (e.type === "wind") drawWindVillain(ctx, e, t, f);
    else if (e.type === "rain") drawRainVillain(ctx, e, t, f);
    else if (e.type === "fire") drawFireVillain(ctx, e, t, f);
    else if (e.type === "bat") drawBat(ctx, e, t, f);
    else if (e.type === "spider") drawSpider(ctx, e, t, f);
    else drawMonster(ctx, e, t, f);
  }

  // raindrops spat by rain clouds
  for (const d of st.drops) {
    ctx.beginPath();
    ctx.moveTo(d.x, d.y - 7);
    ctx.quadraticCurveTo(d.x + 4, d.y, d.x, d.y + 3);
    ctx.quadraticCurveTo(d.x - 4, d.y, d.x, d.y - 7);
    ctx.fillStyle = "#4a90d9";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // hint bubble (e.g. "find key 1!")
  if (st.hintT > 0) {
    const hx = 480;
    ctx.save();
    ctx.globalAlpha = Math.min(1, st.hintT);
    ctx.font = 'bold 26px "Chalkboard SE", "Comic Sans MS", cursive';
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(253,249,239,0.9)";
    const w = ctx.measureText(st.hint).width + 40;
    sketchRect(ctx, hx - w / 2, 60, w, 44, "rgba(253,249,239,0.95)", 90, f, 2);
    ctx.fillStyle = INK;
    ctx.fillText(st.hint, hx, 88);
    ctx.restore();
  }
}

function drawStar(ctx: CanvasRenderingContext2D, r: number, fill: string, f: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const wob = (hash(i, f) - 0.5) * 2;
    const px = Math.cos(a) * (rr + wob);
    const py = Math.sin(a) * (rr + wob);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

/** A big pumpkin gate. Walk in, pop up to the sky path. */
function drawPumpkinPortal(
  ctx: CanvasRenderingContext2D, pk: PumpkinPortal, t: number, f: number,
): void {
  const bob = Math.sin(t * 3 + pk.x) * 2;
  const cy = pk.y + bob;
  const seed = 900 + Math.round(pk.x);

  sketchCircle(ctx, pk.x, cy, 20, "#ef8f4a", seed, f, 1.6);
  sketchLine(ctx, pk.x, cy - 18, pk.x + 3, cy - 30, seed + 1, f, 0.5, "#5eaa61", 4);
  sketchLine(ctx, pk.x - 7, cy - 2, pk.x - 2, cy + 3, seed + 2, f, 0.3, INK, 2);
  sketchLine(ctx, pk.x + 7, cy - 2, pk.x + 2, cy + 3, seed + 3, f, 0.3, INK, 2);
  sketchLine(ctx, pk.x - 6, cy + 8, pk.x + 6, cy + 7, seed + 4, f, 0.4, INK, 2);
  crayonText(ctx, "up!", pk.x, cy - 40, 16, "#e04f4f", f, seed + 5);

  // a little landing mark on the sky platform
  const pulse = 8 + Math.sin(t * 5) * 2;
  sketchCircle(ctx, pk.tx + 12, pk.ty + 28, pulse, "rgba(239,143,74,0.35)", seed + 6, f, 0.8);
}

function sxb(bi: number, lx: number): number {
  return 100 + bi * 7 + (lx % 97);
}

/* ---------- enemies (crayon beasts, per Ira's v2 request) ---------- */

const BEAST_BODY = "#9a6fd0";
const BEAST_DARK = "#7a4ab0";
const BIRD_BODY = "#4a90d9";
const BIRD_DARK = "#2d6cb0";

/** A spiky purple beast that stomps along the ground. (cx, feetY) = center-bottom. */
function drawBeast(ctx: CanvasRenderingContext2D, e: EnemyRuntime, t: number, f: number): void {
  const cx = e.x;
  const feet = e.cy;
  const seed = 200 + Math.round(e.min);
  const bob = Math.abs(Math.sin(t * e.speed * 0.02)) * 2;

  // legs (stomping)
  const swing = Math.sin(t * e.speed * 0.04) * 3;
  sketchLine(ctx, cx - 6, feet - 10, cx - 8 + swing, feet, seed + 1, f, 1, INK, 3);
  sketchLine(ctx, cx + 6, feet - 10, cx + 8 - swing, feet, seed + 2, f, 1, INK, 3);

  // spiky body
  const by = feet - 16 - bob;
  sketchCircle(ctx, cx, by, 12, BEAST_BODY, seed + 3, f, 1.5);
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8 + 0.3;
    const sx = cx + Math.cos(a) * 12;
    const sy = by + Math.sin(a) * 12;
    const tx = cx + Math.cos(a) * 19;
    const ty = by + Math.sin(a) * 19;
    sketchLine(ctx, sx, sy, tx, ty, seed + 4 + i, f, 0.8, BEAST_DARK, 3);
  }

  // angry eyes + fangs
  sketchCircle(ctx, cx - 5 + e.dir * 2, by - 3, 3, "#fff", seed + 12, f, 0.5);
  sketchCircle(ctx, cx + 5 + e.dir * 2, by - 3, 3, "#fff", seed + 13, f, 0.5);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx - 5 + e.dir * 3, by - 3, 1.3, 0, Math.PI * 2);
  ctx.arc(cx + 5 + e.dir * 3, by - 3, 1.3, 0, Math.PI * 2);
  ctx.fill();
  sketchLine(ctx, cx - 9, by - 8, cx - 2, by - 6, seed + 14, f, 0.5, INK, 2);
  sketchLine(ctx, cx + 9, by - 8, cx + 2, by - 6, seed + 15, f, 0.5, INK, 2);
  // fangs
  ctx.beginPath();
  ctx.moveTo(cx - 4, by + 5);
  ctx.lineTo(cx - 2, by + 9);
  ctx.lineTo(cx, by + 5);
  ctx.lineTo(cx + 2, by + 9);
  ctx.lineTo(cx + 4, by + 5);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** An angry blue bird that swoops through the air. (x, cy) = center. */
function drawBird(ctx: CanvasRenderingContext2D, e: EnemyRuntime, t: number, f: number): void {
  const cx = e.x;
  const cy = e.cy;
  const seed = 300 + Math.round(e.min);
  const flap = Math.sin(t * 11) * 0.9;

  // tail feathers
  sketchLine(ctx, cx - 10 * -e.dir, cy + 1, cx - 18 * -e.dir, cy - 3, seed + 1, f, 0.8, BIRD_DARK, 3);
  sketchLine(ctx, cx - 11 * -e.dir, cy + 3, cx - 19 * -e.dir, cy + 2, seed + 2, f, 0.8, BIRD_DARK, 3);

  // body
  sketchCircle(ctx, cx, cy + 2, 9, BIRD_BODY, seed + 3, f, 1.2);

  // flapping wings (both, rotated by flap)
  const wingY = cy - 3;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(cx, wingY);
    ctx.rotate(flap * s * 0.5);
    sketchLine(ctx, 0, 0, -12 * s - e.dir * 4, -10 * Math.cos(flap) - 2, seed + 4 + s, f, 0.8, BIRD_DARK, 4);
    sketchLine(ctx, -6 * s, -4, -14 * s, -8, seed + 5 + s, f, 0.6, BIRD_DARK, 3);
    ctx.restore();
  }

  // head + angry eyes + beak
  sketchCircle(ctx, cx + e.dir * 7, cy - 5, 5, BIRD_BODY, seed + 6, f, 1);
  sketchCircle(ctx, cx + e.dir * 6, cy - 6, 1.6, INK, seed + 7, f, 0.3);
  sketchLine(ctx, cx + e.dir * 4, cy - 9, cx + e.dir * 8, cy - 7, seed + 8, f, 0.4, INK, 2);
  ctx.beginPath();
  ctx.moveTo(cx + e.dir * 11, cy - 5);
  ctx.lineTo(cx + e.dir * 16, cy - 3);
  ctx.lineTo(cx + e.dir * 10, cy - 1);
  ctx.closePath();
  ctx.fillStyle = "#ef8f4a";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
}

const BAT_BODY = "#4c3f72";
const BAT_WING = "#3a3158";
const SPIDER_BODY = "#2e2a36";
const MONSTER_BODY = "#7dbe5a";
const MONSTER_DARK = "#5e9a42";

/** A flappy purple bat. (x, cy) = center, same as a bird. */
function drawBat(ctx: CanvasRenderingContext2D, e: EnemyRuntime, t: number, f: number): void {
  const cx = e.x;
  const cy = e.cy;
  const seed = 600 + Math.round(e.min);
  const flap = Math.sin(t * 12);

  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(cx, cy - 1);
    ctx.rotate(flap * s * 0.45);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 6, -2);
    ctx.lineTo(s * 16, -9);
    ctx.lineTo(s * 18, 1);
    ctx.lineTo(s * 7, 3);
    ctx.closePath();
    ctx.fillStyle = BAT_WING;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  sketchCircle(ctx, cx, cy + 1, 7, BAT_BODY, seed, f, 1);
  // pointy ears
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy - 4);
  ctx.lineTo(cx - 7, cy - 14);
  ctx.lineTo(cx - 1, cy - 5);
  ctx.lineTo(cx + 1, cy - 5);
  ctx.lineTo(cx + 7, cy - 14);
  ctx.lineTo(cx + 4, cy - 4);
  ctx.closePath();
  ctx.fillStyle = BAT_BODY;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();

  sketchCircle(ctx, cx - 2 + e.dir, cy - 1, 1.5, "#fff", seed + 2, f, 0.3);
  sketchCircle(ctx, cx + 3 + e.dir, cy - 1, 1.5, "#fff", seed + 3, f, 0.3);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx - 2 + e.dir * 1.4, cy - 1, 0.7, 0, Math.PI * 2);
  ctx.arc(cx + 3 + e.dir * 1.4, cy - 1, 0.7, 0, Math.PI * 2);
  ctx.fill();
  // little fangs
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy + 4);
  ctx.lineTo(cx - 1, cy + 7);
  ctx.moveTo(cx + 2, cy + 4);
  ctx.lineTo(cx + 1, cy + 7);
  ctx.stroke();
}

/** A round spider that walks on the ground. (cx, feetY) = center-bottom. */
function drawSpider(ctx: CanvasRenderingContext2D, e: EnemyRuntime, t: number, f: number): void {
  const cx = e.x;
  const feet = e.cy;
  const seed = 700 + Math.round(e.min);
  const by = feet - 11;
  const swing = Math.sin(t * Math.max(2, e.speed * 0.04));

  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    const lift = swing * (k % 2 === 0 ? 1 : -1) * 3;
    const hipX = cx + side * 3;
    const hipY = by + (k - 1.5) * 2;
    const kneeX = cx + side * (9 + k * 3);
    const kneeY = by - 7 + lift + k;
    const toeX = cx + side * (13 + k * 4);
    const toeY = feet - (k === 0 || k === 3 ? 1 : 0);
    sketchLine(ctx, hipX, hipY, kneeX, kneeY, seed + i, f, 0.5, SPIDER_BODY, 2.5);
    sketchLine(ctx, kneeX, kneeY, toeX, toeY, seed + 10 + i, f, 0.5, SPIDER_BODY, 2.5);
  }

  sketchCircle(ctx, cx - e.dir * 3, by + 1, 7, SPIDER_BODY, seed + 20, f, 1);
  sketchCircle(ctx, cx + e.dir * 4, by - 1, 5, "#3d3848", seed + 21, f, 0.8);
  sketchCircle(ctx, cx + e.dir * 6, by - 3, 1.2, "#f2c14e", seed + 22, f, 0.2);
  sketchCircle(ctx, cx + e.dir * 6, by + 1, 1.2, "#f2c14e", seed + 23, f, 0.2);
}

/** A lumpy green monster with horns. (cx, feetY) = center-bottom. */
function drawMonster(ctx: CanvasRenderingContext2D, e: EnemyRuntime, t: number, f: number): void {
  const cx = e.x;
  const feet = e.cy;
  const seed = 800 + Math.round(e.min);
  const bob = Math.abs(Math.sin(t * e.speed * 0.02)) * 2;
  const swing = Math.sin(t * e.speed * 0.04) * 4;
  const by = feet - 16 - bob;

  sketchLine(ctx, cx - 6, feet - 10, cx - 8 + swing, feet, seed + 1, f, 1, INK, 3);
  sketchLine(ctx, cx + 6, feet - 10, cx + 8 - swing, feet, seed + 2, f, 1, INK, 3);

  sketchCircle(ctx, cx, by, 13, MONSTER_BODY, seed + 3, f, 1.5);
  sketchCircle(ctx, cx - 7, by + 3, 7, MONSTER_DARK, seed + 4, f, 1);
  sketchLine(ctx, cx - 8, by - 10, cx - 14, by - 22, seed + 5, f, 0.6, "#ef8f4a", 3);
  sketchLine(ctx, cx + 8, by - 10, cx + 14, by - 22, seed + 6, f, 0.6, "#ef8f4a", 3);

  sketchCircle(ctx, cx - 5 + e.dir * 2, by - 2, 3.2, "#fff", seed + 7, f, 0.4);
  sketchCircle(ctx, cx + 5 + e.dir * 2, by - 2, 3.2, "#fff", seed + 8, f, 0.4);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx - 5 + e.dir * 3, by - 2, 1.4, 0, Math.PI * 2);
  ctx.arc(cx + 5 + e.dir * 3, by - 2, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 4, by + 6);
  ctx.lineTo(cx - 2, by + 11);
  ctx.lineTo(cx, by + 6);
  ctx.lineTo(cx + 2, by + 11);
  ctx.lineTo(cx + 4, by + 6);
  ctx.stroke();
}

/* ---------- planet villains (wind, rain, fire — Ira's worlds) ---------- */

const WIND_BODY = "#bfe3f2";
const WIND_DARK = "#7db6cf";
const RAIN_BODY = "#9db3c9";
const RAIN_DARK = "#6e89a8";
const FIRE_BODY = "#ef8f4a";
const FIRE_DARK = "#e04f4f";
const FIRE_CORE = "#f2c14e";

/**
 * Windy the gust cloud: a puffy cloud with blown-up cheeks that puffs
 * swirl lines in the direction it moves. (x, cy) = center.
 */
function drawWindVillain(ctx: CanvasRenderingContext2D, e: EnemyRuntime, t: number, f: number): void {
  const cx = e.x;
  const cy = e.cy;
  const seed = 400 + Math.round(e.min);
  const puff = 1 + Math.sin(t * 5) * 0.08;

  // gust lines puffing ahead of it
  const gustX = cx + e.dir * 26;
  for (let i = 0; i < 3; i++) {
    const gy = cy - 6 + i * 6;
    const wob = Math.sin(t * 7 + i * 2) * 4;
    sketchLine(ctx, gustX, gy, gustX + e.dir * (18 + i * 6), gy + wob, seed + 40 + i, f, 1.4, WIND_DARK, 2.5);
  }

  // puffy cloud body
  sketchCircle(ctx, cx - 14, cy + 3, 9 * puff, WIND_BODY, seed + 1, f, 1.4);
  sketchCircle(ctx, cx, cy - 4, 12 * puff, WIND_BODY, seed + 2, f, 1.4);
  sketchCircle(ctx, cx + 14, cy + 3, 9 * puff, WIND_BODY, seed + 3, f, 1.4);

  // angry eyes + puffed cheeks
  sketchCircle(ctx, cx - 5, cy - 5, 3, "#fff", seed + 4, f, 0.5);
  sketchCircle(ctx, cx + 5, cy - 5, 3, "#fff", seed + 5, f, 0.5);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx - 5 + e.dir, cy - 5, 1.3, 0, Math.PI * 2);
  ctx.arc(cx + 5 + e.dir, cy - 5, 1.3, 0, Math.PI * 2);
  ctx.fill();
  sketchLine(ctx, cx - 9, cy - 10, cx - 2, cy - 8, seed + 6, f, 0.5, INK, 2);
  sketchLine(ctx, cx + 9, cy - 10, cx + 2, cy - 8, seed + 7, f, 0.5, INK, 2);
  // cheeks bulging in the travel direction
  sketchCircle(ctx, cx + e.dir * 15, cy + 2, 4, null, seed + 8, f, 0.8, WIND_DARK);
}

/**
 * Drizzle the rain cloud: a grumpy grey cloud that drips raindrops.
 * (x, cy) = center. The actual deadly drops live in st.drops.
 */
function drawRainVillain(ctx: CanvasRenderingContext2D, e: EnemyRuntime, t: number, f: number): void {
  const cx = e.x;
  const cy = e.cy;
  const seed = 500 + Math.round(e.min);
  const drip = Math.sin(t * 6);

  // grumpy cloud body
  sketchCircle(ctx, cx - 16, cy + 4, 10, RAIN_BODY, seed + 1, f, 1.4);
  sketchCircle(ctx, cx, cy - 4, 13, RAIN_BODY, seed + 2, f, 1.4);
  sketchCircle(ctx, cx + 16, cy + 4, 10, RAIN_BODY, seed + 3, f, 1.4);
  sketchRect(ctx, cx - 16, cy + 6, 32, 8, RAIN_BODY, seed + 4, f, 1.2);

  // angry eyes + a frown
  sketchCircle(ctx, cx - 5, cy - 4, 3, "#fff", seed + 5, f, 0.5);
  sketchCircle(ctx, cx + 5, cy - 4, 3, "#fff", seed + 6, f, 0.5);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx - 5 + e.dir, cy - 4, 1.3, 0, Math.PI * 2);
  ctx.arc(cx + 5 + e.dir, cy - 4, 1.3, 0, Math.PI * 2);
  ctx.fill();
  sketchLine(ctx, cx - 9, cy - 10, cx - 2, cy - 7, seed + 7, f, 0.5, INK, 2);
  sketchLine(ctx, cx + 9, cy - 10, cx + 2, cy - 7, seed + 8, f, 0.5, INK, 2);
  ctx.beginPath();
  ctx.arc(cx, cy + 4, 4, Math.PI * 1.15, Math.PI * 1.85);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();

  // little drip about to fall (the real drops fly from st.drops)
  if (drip > 0.3) {
    sketchCircle(ctx, cx, cy + 14 + drip * 4, 3, "#4a90d9", seed + 9, f, 0.6);
  }
}

/**
 * Ember the flame sprite: a running teardrop flame with an angry face.
 * (cx, feetY) = center-bottom, patrols the ground like a beast.
 */
function drawFireVillain(ctx: CanvasRenderingContext2D, e: EnemyRuntime, t: number, f: number): void {
  const cx = e.x;
  const feet = e.cy;
  const seed = 600 + Math.round(e.min);
  const flick = Math.sin(t * 12) * 3;
  const bob = Math.abs(Math.sin(t * e.speed * 0.03)) * 3;

  // little flame feet (scampering)
  const swing = Math.sin(t * e.speed * 0.06) * 4;
  sketchLine(ctx, cx - 4, feet - 8, cx - 7 + swing, feet, seed + 1, f, 1, FIRE_DARK, 3);
  sketchLine(ctx, cx + 4, feet - 8, cx + 7 - swing, feet, seed + 2, f, 1, FIRE_DARK, 3);

  // flame body: wobbly teardrop, taller when flicking up
  const topY = feet - 34 - flick - bob;
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.quadraticCurveTo(cx + 14, feet - 20, cx + 11, feet - 8);
  ctx.lineTo(cx - 11, feet - 8);
  ctx.quadraticCurveTo(cx - 14, feet - 20, cx, topY);
  ctx.closePath();
  ctx.fillStyle = FIRE_BODY;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // inner core flame
  ctx.beginPath();
  ctx.moveTo(cx, feet - 26 - flick * 0.5);
  ctx.quadraticCurveTo(cx + 7, feet - 16, cx + 5, feet - 9);
  ctx.lineTo(cx - 5, feet - 9);
  ctx.quadraticCurveTo(cx - 7, feet - 16, cx, feet - 26 - flick * 0.5);
  ctx.closePath();
  ctx.fillStyle = FIRE_CORE;
  ctx.fill();

  // angry eyes + frown on the flame
  sketchCircle(ctx, cx - 4, feet - 18, 2.6, "#fff", seed + 3, f, 0.4);
  sketchCircle(ctx, cx + 4, feet - 18, 2.6, "#fff", seed + 4, f, 0.4);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx - 4 + e.dir, feet - 18, 1.1, 0, Math.PI * 2);
  ctx.arc(cx + 4 + e.dir, feet - 18, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, feet - 12, 3.4, Math.PI * 1.15, Math.PI * 1.85);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // sparks trailing behind
  for (let i = 0; i < 3; i++) {
    const sp = (t * 3 + i * 0.33) % 1;
    sketchCircle(ctx, cx - e.dir * (8 + sp * 16), feet - 12 - sp * 14, 2 - sp, FIRE_CORE, seed + 5 + i, f, 0.5);
  }
}
