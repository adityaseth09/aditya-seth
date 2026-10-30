/**
 * Food Run! — level types + crayon rendering of the food worlds,
 * the foods, power-ups (Energy Bar + Sack of Sugar), hazards and
 * the Best Food in the World pedestal.
 */
import { sketchRect, sketchCircle, sketchLine, crayonText, boil, INK } from "../tag-time/draw";

export interface Rect { x: number; y: number; w: number; h: number }
export type WorldId = "picnic" | "pizza" | "candy" | "icecream";
export type FoodKind =
  | "apple" | "strawberry" | "sandwich" | "watermelon"
  | "pizza" | "taco" | "pancake"
  | "donut" | "cupcake" | "lollipop"
  | "icecream" | "sushi";
export type BestKind = "burger" | "pizza" | "cake" | "sundae" | "feast";
export type EnemyKind = "rotten" | "chili" | "monster";

export interface FoodItem { x: number; y: number; kind: FoodKind }
export interface PowerItem { x: number; y: number }
export interface EnemyItem {
  type: EnemyKind;
  x: number; y: number;
  min: number; max: number;
  speed: number;
}
export interface EnemyRuntime extends EnemyItem {
  dir: number;
  /** current feet y (chilis hop) */
  cy: number;
}

export interface LevelData {
  name: string;
  world: WorldId;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  platforms: Rect[];
  pits: Rect[];
  syrup: Rect[];
  foods: FoodItem[];
  energy: PowerItem[];
  sugar: PowerItem[];
  enemies: EnemyItem[];
  best: { x: number; y: number; kind: BestKind; name: string };
}

export interface WorldState {
  level: LevelData;
  foodsTaken: Set<number>;
  energyTaken: Set<number>;
  sugarTaken: Set<number>;
  enemies: EnemyRuntime[];
  deadEnemies: Set<number>;
  time: number;
  hint: string;
  hintT: number;
  /** little "+1" / "yum!" popups where food was eaten */
  pops: { x: number; y: number; t: number; text: string }[];
}

export const WORLD_INFO: Record<WorldId, { name: string; emoji: string; pitName: string }> = {
  picnic: { name: "Picnic Park", emoji: "🧺", pitName: "juice" },
  pizza: { name: "Pizza Palace", emoji: "🍕", pitName: "tomato sauce" },
  candy: { name: "Candy Kingdom", emoji: "🍭", pitName: "chocolate river" },
  icecream: { name: "Ice Cream Island", emoji: "🍦", pitName: "melted milkshake" },
};

const THEMES: Record<WorldId, {
  paper: string; line: string; plat: string; top: string; pit: string; pitDeep: string;
}> = {
  picnic: { paper: "#f1f8ea", line: "rgba(90,170,110,0.16)", plat: "#efe6c2", top: "#5eaa61", pit: "#f5a43a", pitDeep: "#e08a1e" },
  pizza: { paper: "#fdf1e2", line: "rgba(224,120,60,0.15)", plat: "#ecc98a", top: "#e04f4f", pit: "#d9423a", pitDeep: "#b02e28" },
  candy: { paper: "#fcebf4", line: "rgba(224,127,176,0.20)", plat: "#f7c6dc", top: "#ffffff", pit: "#7a4a2a", pitDeep: "#5c3519" },
  icecream: { paper: "#e9f5fb", line: "rgba(74,144,217,0.18)", plat: "#e8c48c", top: "#fdf3f7", pit: "#f4b6c8", pitDeep: "#e48aa6" },
};

/* ---------------- backgrounds ---------------- */

function wrapX(x: number, camX: number, par: number, levelW: number): number {
  const span = levelW + 400;
  return ((x - camX * par) % span + span) % span - 200;
}

export function drawBackground(
  ctx: CanvasRenderingContext2D, camX: number, levelW: number, t: number, world: WorldId,
): void {
  const th = THEMES[world];
  const f = boil(t);
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

  if (world === "picnic") {
    const sunX = wrapX(140, camX, 0.1, levelW);
    sketchCircle(ctx, sunX, 70, 26, "#f2c14e", 3, f, 2);
    cloudRow(ctx, camX, levelW, f, "#ffffff");
    // trees in the park
    for (const tx of [260, 900, 1500, 2300, 3100]) {
      const px = wrapX(tx, camX, 0.3, levelW);
      if (px < -80 || px > 1040) continue;
      sketchRect(ctx, px - 7, 330, 14, 150, "#b98a5a", tx, f, 1);
      sketchCircle(ctx, px, 310, 42, "#8ed16f", tx + 1, f, 2.4);
      sketchCircle(ctx, px - 14, 300, 6, "#e04f4f", tx + 2, f, 0.6);
      sketchCircle(ctx, px + 16, 320, 6, "#e04f4f", tx + 3, f, 0.6);
    }
  } else if (world === "pizza") {
    // checkered kitchen tiles along the top
    for (let i = 0; i < 26; i++) {
      const px = ((i * 40 - camX * 0.2) % 1040 + 1040) % 1040 - 40;
      ctx.fillStyle = i % 2 === 0 ? "rgba(224,79,79,0.22)" : "rgba(255,255,255,0.5)";
      ctx.fillRect(px, 0, 40, 26);
      ctx.fillStyle = i % 2 === 1 ? "rgba(224,79,79,0.22)" : "rgba(255,255,255,0.5)";
      ctx.fillRect(px, 26, 40, 26);
    }
    // a pizza-slice sun
    const sx = wrapX(160, camX, 0.1, levelW);
    ctx.beginPath();
    ctx.moveTo(sx, 140);
    ctx.lineTo(sx - 34, 76);
    ctx.quadraticCurveTo(sx, 60, sx + 34, 76);
    ctx.closePath();
    ctx.fillStyle = "#f2c14e";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    for (const [dx, dy] of [[-10, 86], [8, 94], [0, 112]]) sketchCircle(ctx, sx + dx, dy, 5, "#e04f4f", dx + 9, f, 0.5);
    // ovens in the back
    for (const ox of [500, 1400, 2400, 3400]) {
      const px = wrapX(ox, camX, 0.3, levelW);
      if (px < -100 || px > 1060) continue;
      sketchRect(ctx, px - 60, 320, 120, 160, "#d9c3a5", ox, f, 1.5);
      ctx.beginPath();
      ctx.arc(px, 410, 34, Math.PI, 0);
      ctx.lineTo(px + 34, 440);
      ctx.lineTo(px - 34, 440);
      ctx.closePath();
      ctx.fillStyle = "#41403c";
      ctx.fill();
      const flick = Math.sin(t * 8 + ox) * 3;
      sketchCircle(ctx, px - 10, 428 - flick, 7, "#ef8f4a", ox + 1, f, 1);
      sketchCircle(ctx, px + 10, 430 + flick, 6, "#f2c14e", ox + 2, f, 1);
    }
  } else if (world === "candy") {
    cloudRow(ctx, camX, levelW, f, "#f9d2e6");
    // lollipop trees
    for (const lx of [200, 700, 1300, 1900, 2600, 3300]) {
      const px = wrapX(lx, camX, 0.3, levelW);
      if (px < -80 || px > 1040) continue;
      sketchLine(ctx, px, 480, px, 330, lx, f, 0.6, "#ffffff", 6);
      sketchCircle(ctx, px, 310, 32, lx % 2 ? "#9a6fd0" : "#4ab0d9", lx + 1, f, 1.6);
      ctx.beginPath();
      for (let a = 0; a < 16; a += 0.3) {
        const r = 2 + a * 1.8;
        const xx = px + Math.cos(a) * r;
        const yy = 310 + Math.sin(a) * r;
        if (a === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  } else {
    // waffle-cone mountains + falling sprinkles
    for (const mx of [300, 1000, 1800, 2700, 3600]) {
      const px = wrapX(mx, camX, 0.15, levelW);
      if (px < -200 || px > 1160) continue;
      ctx.beginPath();
      ctx.moveTo(px - 140, 480);
      ctx.lineTo(px, 260);
      ctx.lineTo(px + 140, 480);
      ctx.closePath();
      ctx.fillStyle = "#e8c48c";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
      // scoop on the top
      sketchCircle(ctx, px, 262, 30, mx % 3 ? "#f4b6c8" : "#bfe3c8", mx + 3, f, 1.8);
    }
    const colors = ["#e04f4f", "#f2c14e", "#5eaa61", "#4a90d9", "#9a6fd0", "#e07fb0"];
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 113 + 20 - camX * 0.2) % 1040 + 1040) % 1040 - 40;
      const sy = ((i * 61) % 200 + t * (30 + (i % 4) * 10)) % 560 - 20;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(i + t);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(-5, -1.5, 10, 3);
      ctx.restore();
    }
  }
}

function cloudRow(ctx: CanvasRenderingContext2D, camX: number, levelW: number, f: number, fill: string): void {
  const clouds: Array<[number, number, number]> = [[300, 80, 1], [700, 60, 1.3], [1150, 95, 0.8], [1600, 70, 1.1], [2100, 85, 0.9]];
  for (const [cx, cy, sc] of clouds) {
    const px = wrapX(cx, camX, 0.4, levelW);
    if (px < -80 || px > 1040) continue;
    sketchCircle(ctx, px, cy, 18 * sc, fill, cx, f, 2);
    sketchCircle(ctx, px + 20 * sc, cy + 4 * sc, 14 * sc, fill, cx + 1, f, 2);
    sketchCircle(ctx, px - 18 * sc, cy + 5 * sc, 13 * sc, fill, cx + 2, f, 2);
  }
}

/* ---------------- foods ---------------- */

/** Draw one everyday food centered at (x, y). Size ≈ 24px. */
export function drawFood(ctx: CanvasRenderingContext2D, kind: FoodKind, x: number, y: number, f: number, seed: number, s = 1): void {
  switch (kind) {
    case "apple":
      sketchCircle(ctx, x, y + 1 * s, 10 * s, "#e04f4f", seed, f, 0.8);
      sketchLine(ctx, x, y - 9 * s, x + 2 * s, y - 15 * s, seed + 1, f, 0.4, "#7a4a1f", 3);
      sketchCircle(ctx, x + 6 * s, y - 12 * s, 3 * s, "#5eaa61", seed + 2, f, 0.4);
      break;
    case "strawberry": {
      ctx.beginPath();
      ctx.moveTo(x - 10 * s, y - 5 * s);
      ctx.quadraticCurveTo(x, y - 10 * s, x + 10 * s, y - 5 * s);
      ctx.quadraticCurveTo(x + 6 * s, y + 10 * s, x, y + 12 * s);
      ctx.quadraticCurveTo(x - 6 * s, y + 10 * s, x - 10 * s, y - 5 * s);
      ctx.fillStyle = "#e04f4f";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = "#fdf3a0";
      for (const [dx, dy] of [[-4, 0], [3, -1], [0, 5], [-2, 8], [4, 5]]) ctx.fillRect(x + dx * s, y + dy * s, 2 * s, 2 * s);
      sketchLine(ctx, x - 6 * s, y - 8 * s, x + 6 * s, y - 8 * s, seed + 1, f, 0.6, "#5eaa61", 4);
      break;
    }
    case "sandwich":
      ctx.beginPath();
      ctx.moveTo(x - 12 * s, y + 8 * s);
      ctx.lineTo(x, y - 11 * s);
      ctx.lineTo(x + 12 * s, y + 8 * s);
      ctx.closePath();
      ctx.fillStyle = "#f3d9a4";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      sketchLine(ctx, x - 9 * s, y + 3 * s, x + 9 * s, y + 3 * s, seed, f, 0.6, "#5eaa61", 3);
      sketchLine(ctx, x - 7 * s, y - 1 * s, x + 7 * s, y - 1 * s, seed + 1, f, 0.6, "#e04f4f", 2.5);
      break;
    case "watermelon":
      ctx.beginPath();
      ctx.arc(x, y - 4 * s, 12 * s, 0, Math.PI);
      ctx.closePath();
      ctx.fillStyle = "#ef6f7a";
      ctx.fill();
      ctx.strokeStyle = "#5eaa61";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = INK;
      for (const dx of [-5, 0, 5]) ctx.fillRect(x + dx * s, y + 1 * s, 2 * s, 3 * s);
      break;
    case "pizza":
      ctx.beginPath();
      ctx.moveTo(x, y + 12 * s);
      ctx.lineTo(x - 11 * s, y - 9 * s);
      ctx.quadraticCurveTo(x, y - 14 * s, x + 11 * s, y - 9 * s);
      ctx.closePath();
      ctx.fillStyle = "#f2c14e";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      sketchLine(ctx, x - 10 * s, y - 9 * s, x + 10 * s, y - 9 * s, seed, f, 0.6, "#c98a3a", 4);
      sketchCircle(ctx, x - 3 * s, y - 3 * s, 2.5 * s, "#e04f4f", seed + 1, f, 0.3);
      sketchCircle(ctx, x + 3 * s, y + 2 * s, 2.5 * s, "#e04f4f", seed + 2, f, 0.3);
      break;
    case "taco":
      ctx.beginPath();
      ctx.arc(x, y + 6 * s, 12 * s, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = "#f2c14e";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      sketchLine(ctx, x - 8 * s, y - 2 * s, x + 8 * s, y - 2 * s, seed, f, 0.8, "#5eaa61", 3);
      sketchLine(ctx, x - 6 * s, y + 1 * s, x + 6 * s, y + 1 * s, seed + 1, f, 0.8, "#e04f4f", 3);
      break;
    case "pancake":
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(x, y + 7 * s - k * 6 * s, 12 * s, 4 * s, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#e3a75a";
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      sketchRect(ctx, x - 3 * s, y - 9 * s, 6 * s, 4 * s, "#fdf3a0", seed, f, 0.4);
      break;
    case "donut":
      sketchCircle(ctx, x, y, 11 * s, "#e07fb0", seed, f, 0.8);
      sketchCircle(ctx, x, y, 4 * s, "#fdf9ef", seed + 1, f, 0.4);
      ctx.fillStyle = "#ffffff";
      for (const [dx, dy] of [[-6, -4], [5, -6], [6, 4], [-5, 5]]) ctx.fillRect(x + dx * s, y + dy * s, 3 * s, 1.5 * s);
      break;
    case "cupcake":
      ctx.beginPath();
      ctx.moveTo(x - 9 * s, y);
      ctx.lineTo(x + 9 * s, y);
      ctx.lineTo(x + 6 * s, y + 11 * s);
      ctx.lineTo(x - 6 * s, y + 11 * s);
      ctx.closePath();
      ctx.fillStyle = "#4a90d9";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      sketchCircle(ctx, x, y - 4 * s, 9 * s, "#f7c6dc", seed, f, 0.8);
      sketchCircle(ctx, x, y - 14 * s, 3 * s, "#e04f4f", seed + 1, f, 0.3);
      break;
    case "lollipop":
      sketchLine(ctx, x, y, x, y + 14 * s, seed, f, 0.3, "#ffffff", 4);
      sketchCircle(ctx, x, y - 3 * s, 10 * s, "#9a6fd0", seed + 1, f, 0.8);
      ctx.beginPath();
      ctx.arc(x, y - 3 * s, 5 * s, 0, Math.PI * 1.5);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      break;
    case "icecream":
      ctx.beginPath();
      ctx.moveTo(x - 8 * s, y);
      ctx.lineTo(x + 8 * s, y);
      ctx.lineTo(x, y + 15 * s);
      ctx.closePath();
      ctx.fillStyle = "#e8c48c";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      sketchCircle(ctx, x, y - 5 * s, 9 * s, "#f4b6c8", seed, f, 0.8);
      break;
    case "sushi":
      sketchRect(ctx, x - 11 * s, y - 2 * s, 22 * s, 12 * s, "#ffffff", seed, f, 0.6);
      sketchRect(ctx, x - 12 * s, y - 8 * s, 24 * s, 7 * s, "#ef8f4a", seed + 1, f, 0.6);
      sketchRect(ctx, x - 3 * s, y - 8 * s, 6 * s, 18 * s, "#2f4a3a", seed + 2, f, 0.3);
      break;
  }
}

/** Energy Bar: a wrapped candy bar with "ENERGY" on it. */
export function drawEnergyBar(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, f: number): void {
  const bob = Math.sin(t * 3) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(-0.12);
  // glow
  ctx.beginPath();
  ctx.arc(0, 0, 26 + Math.sin(t * 6) * 2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(242,193,78,0.25)";
  ctx.fill();
  sketchRect(ctx, -22, -9, 44, 18, "#5eaa61", 900, f, 0.8);
  // wrapper ends
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 22, -9);
    ctx.lineTo(side * 30, -12);
    ctx.lineTo(side * 30, 12);
    ctx.lineTo(side * 22, 9);
    ctx.closePath();
    ctx.fillStyle = "#3f8a43";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  crayonText(ctx, "ENERGY", 0, 1, 11, "#ffffff", f, 901);
  ctx.restore();
  // little lightning bolt above
  sketchLine(ctx, x + 2, y - 30 + bob, x - 4, y - 21 + bob, 902, f, 0.4, "#f2c14e", 3);
  sketchLine(ctx, x - 4, y - 21 + bob, x + 4, y - 19 + bob, 903, f, 0.4, "#f2c14e", 3);
  sketchLine(ctx, x + 4, y - 19 + bob, x - 2, y - 10 + bob, 904, f, 0.4, "#f2c14e", 3);
}

/** Whole Sack of Sugar: a tied burlap sack labeled SUGAR. */
export function drawSugarSack(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, f: number): void {
  const wob = Math.sin(t * 2) * 0.05;
  ctx.save();
  ctx.translate(x, y + 10);
  ctx.rotate(wob);
  ctx.beginPath();
  ctx.moveTo(-10, -30);
  ctx.quadraticCurveTo(-24, -10, -20, 6);
  ctx.quadraticCurveTo(0, 14, 20, 6);
  ctx.quadraticCurveTo(24, -10, 10, -30);
  ctx.closePath();
  ctx.fillStyle = "#e3c99a";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  // tied top
  sketchLine(ctx, -10, -30, 10, -30, 910, f, 0.5, "#b98a5a", 4);
  sketchLine(ctx, -4, -30, -9, -40, 911, f, 0.5, "#b98a5a", 3);
  sketchLine(ctx, 4, -30, 9, -40, 912, f, 0.5, "#b98a5a", 3);
  crayonText(ctx, "SUGAR", 0, -9, 11, INK, f, 913);
  ctx.restore();
  // sparkly sugar grains
  for (let i = 0; i < 4; i++) {
    const a = t * 2 + i * 1.6;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + Math.cos(a) * 26 - 1.5, y - 14 + Math.sin(a * 1.3) * 12 - 1.5, 3, 3);
  }
}

/* ---------------- best food in the world ---------------- */

export function drawBestFood(
  ctx: CanvasRenderingContext2D, kind: BestKind, x: number, groundY: number, t: number, f: number, unlocked: boolean,
): void {
  // pedestal
  sketchRect(ctx, x - 46, groundY - 40, 92, 40, unlocked ? "#f2c14e" : "#c9c4b5", 950, f, 1.2);
  crayonText(ctx, "BEST", x, groundY - 20, 15, INK, f, 951);
  const topY = groundY - 40;

  ctx.save();
  if (!unlocked) ctx.globalAlpha = 0.55;
  if (unlocked) {
    // glowing rays
    for (let i = 0; i < 10; i++) {
      const a = t * 0.8 + (i * Math.PI * 2) / 10;
      sketchLine(ctx, x + Math.cos(a) * 46, topY - 40 + Math.sin(a) * 46, x + Math.cos(a) * 70, topY - 40 + Math.sin(a) * 70, 960 + i, f, 0.8, "#f2c14e", 3);
    }
  }
  const bob = unlocked ? Math.sin(t * 3) * 4 : 0;
  ctx.translate(0, bob);
  if (kind === "burger") drawBurger(ctx, x, topY, f);
  else if (kind === "pizza") drawBigPizza(ctx, x, topY, f);
  else if (kind === "cake") drawBigCake(ctx, x, topY, f);
  else if (kind === "sundae") drawBigSundae(ctx, x, topY, f);
  else {
    // The Grand Rainbow Feast: cake + sundae + pizza + donut all together!
    drawBigCake(ctx, x - 26, topY, f);
    drawBigSundae(ctx, x + 30, topY, f);
    drawFood(ctx, "pizza", x - 88, topY - 12, f, 980, 1.3);
    drawFood(ctx, "donut", x + 74, topY - 12, f, 981, 1.1);
  }
  ctx.restore();

  if (!unlocked) {
    // padlock
    sketchRect(ctx, x - 11, topY - 46, 22, 18, "#9a9486", 970, f, 0.6);
    ctx.beginPath();
    ctx.arc(x, topY - 46, 7, Math.PI, 0);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  crayonText(ctx, unlocked ? "the best food in the world!" : "collect all the food!", x, topY - 122, 17, unlocked ? "#e04f4f" : INK, f, 971);
}

function drawBurger(ctx: CanvasRenderingContext2D, x: number, base: number, f: number): void {
  const layers: Array<[number, number, string]> = [
    [base - 10, 10, "#e3a75a"], [base - 22, 10, "#7a4a2a"], [base - 30, 7, "#f2c14e"], [base - 37, 7, "#e04f4f"], [base - 43, 6, "#5eaa61"],
  ];
  for (const [y, h, c] of layers) sketchRect(ctx, x - 34, y, 68, h, c, y, f, 0.6);
  ctx.beginPath();
  ctx.arc(x, base - 43, 34, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = "#e3a75a";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#fdf3d0";
  for (const [dx, dy] of [[-16, -56], [0, -64], [14, -56], [-4, -52]]) ctx.fillRect(x + dx, base + dy, 5, 2.5);
}

function drawBigPizza(ctx: CanvasRenderingContext2D, x: number, base: number, f: number): void {
  ctx.beginPath();
  ctx.ellipse(x, base - 14, 44, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#c98a3a";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, base - 16, 37, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#f2c14e";
  ctx.fill();
  for (const [dx, dy] of [[-20, -18], [-4, -12], [14, -19], [24, -13], [4, -22]]) {
    ctx.beginPath();
    ctx.ellipse(x + dx, base + dy, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#e04f4f";
    ctx.fill();
  }
  // golden sparkle crown
  sketchCircle(ctx, x, base - 40, 8, "#f2c14e", 985, f, 1);
  crayonText(ctx, "★", x, base - 40, 12, "#ffffff", f, 986);
}

function drawBigCake(ctx: CanvasRenderingContext2D, x: number, base: number, f: number): void {
  const colors = ["#e04f4f", "#ef8f4a", "#f2c14e", "#5eaa61", "#4a90d9", "#9a6fd0"];
  let y = base;
  let w = 80;
  for (let i = 0; i < 3; i++) {
    const h = 22;
    sketchRect(ctx, x - w / 2, y - h, w, h, colors[i * 2], 990 + i, f, 0.8);
    sketchLine(ctx, x - w / 2 + 2, y - h + 6, x + w / 2 - 2, y - h + 6, 993 + i, f, 0.6, colors[i * 2 + 1], 4);
    y -= h;
    w -= 20;
  }
  // candle
  sketchRect(ctx, x - 3, y - 16, 6, 16, "#ffffff", 996, f, 0.4);
  sketchCircle(ctx, x, y - 21, 4, "#f2c14e", 997, f, 0.8);
}

function drawBigSundae(ctx: CanvasRenderingContext2D, x: number, base: number, f: number): void {
  // glass bowl
  ctx.beginPath();
  ctx.moveTo(x - 36, base - 40);
  ctx.quadraticCurveTo(x, base + 4, x + 36, base - 40);
  ctx.closePath();
  ctx.fillStyle = "rgba(191,227,242,0.8)";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  sketchCircle(ctx, x - 18, base - 48, 15, "#f4b6c8", 1001, f, 1);
  sketchCircle(ctx, x + 18, base - 48, 15, "#bfe3c8", 1002, f, 1);
  sketchCircle(ctx, x, base - 64, 16, "#f3e1b8", 1003, f, 1);
  // chocolate drip + cherry
  sketchLine(ctx, x - 12, base - 74, x + 12, base - 74, 1004, f, 1, "#7a4a2a", 5);
  sketchCircle(ctx, x, base - 84, 6, "#e04f4f", 1005, f, 0.6);
  sketchLine(ctx, x, base - 90, x + 5, base - 100, 1006, f, 0.4, "#5eaa61", 2);
}

/* ---------------- world ---------------- */

export function drawWorld(ctx: CanvasRenderingContext2D, st: WorldState, allFood: boolean): void {
  const { level, time: t } = st;
  const f = boil(t);
  const th = THEMES[level.world];

  // pits (juice / tomato sauce / chocolate / milkshake)
  for (const p of level.pits) {
    ctx.fillStyle = th.pit;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const px = p.x + (p.w * i) / 10;
      const py = p.y + Math.sin(t * 3 + i * 1.3 + p.x) * 3;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    for (let bi = 0; bi < 3; bi++) {
      const bt = (t * 0.6 + bi * 0.33 + p.x * 0.01) % 1;
      sketchCircle(ctx, p.x + 16 + bi * (p.w - 32) / 2, p.y + p.h - 4 - bt * (p.h - 8), 2.6, th.pitDeep, p.x + bi, f, 0.4, "rgba(255,255,255,0.7)");
    }
  }

  // platforms
  for (const p of level.platforms) {
    sketchRect(ctx, p.x, p.y, p.w, p.h, th.plat, p.x + p.y, f, 2);
    if (level.world === "picnic") {
      // gingham tablecloth checks + grass
      for (let gx = p.x + 6; gx < p.x + p.w - 4; gx += 42) {
        sketchLine(ctx, gx, p.y, gx - 2, p.y - 6, gx + 1, f, 0.8, th.top, 3);
        sketchLine(ctx, gx + 4, p.y, gx + 5, p.y - 7, gx + 2, f, 0.8, th.top, 3);
      }
      if (p.h > 30) {
        ctx.fillStyle = "rgba(224,79,79,0.16)";
        for (let cx = p.x + 4; cx < p.x + p.w - 14; cx += 28) ctx.fillRect(cx, p.y + 14, 14, 14);
      }
    } else if (level.world === "pizza") {
      // tomato sauce + cheese drips on crust
      sketchLine(ctx, p.x + 4, p.y + 4, p.x + p.w - 4, p.y + 4, p.x, f, 1, th.top, 4);
      for (let cx = p.x + 14; cx < p.x + p.w - 10; cx += 46) sketchCircle(ctx, cx, p.y + 13, 3, "#e04f4f", cx, f, 0.4);
    } else if (level.world === "candy") {
      // white frosting with drips
      sketchLine(ctx, p.x + 2, p.y + 3, p.x + p.w - 2, p.y + 3, p.x, f, 1, th.top, 6);
      for (let cx = p.x + 16; cx < p.x + p.w - 10; cx += 38) {
        ctx.beginPath();
        ctx.ellipse(cx, p.y + 9, 4, 7, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
    } else {
      // waffle lines + a scoop-colored top
      sketchLine(ctx, p.x + 2, p.y + 3, p.x + p.w - 2, p.y + 3, p.x, f, 1, th.top, 6);
      ctx.strokeStyle = "rgba(122,74,31,0.3)";
      ctx.lineWidth = 2;
      for (let cx = p.x + 10; cx < p.x + p.w; cx += 20) {
        ctx.beginPath();
        ctx.moveTo(cx, p.y + 6);
        ctx.lineTo(cx - 10, p.y + p.h);
        ctx.stroke();
      }
    }
  }

  // sticky syrup puddles
  for (const s of level.syrup) {
    ctx.beginPath();
    ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2 + 3, s.w / 2, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(196,120,40,0.85)";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const bx = s.x + 30 + i * (s.w - 60) / 2;
      sketchCircle(ctx, bx, s.y + 3 + Math.sin(t * 2 + i) * 1.5, 3, "rgba(255,220,150,0.9)", bx, f, 0.4);
    }
    crayonText(ctx, "sticky!", s.x + s.w / 2, s.y - 16, 13, "#a0601c", f, s.x);
  }

  // foods
  for (let i = 0; i < level.foods.length; i++) {
    if (st.foodsTaken.has(i)) continue;
    const fd = level.foods[i];
    const bob = Math.sin(t * 3 + fd.x) * 3;
    drawFood(ctx, fd.kind, fd.x, fd.y + bob, f, 500 + i);
  }

  // power-ups
  level.energy.forEach((e, i) => {
    if (!st.energyTaken.has(i)) drawEnergyBar(ctx, e.x, e.y, t, f);
  });
  level.sugar.forEach((s, i) => {
    if (!st.sugarTaken.has(i)) drawSugarSack(ctx, s.x, s.y, t, f);
  });

  // the Best Food in the World
  drawBestFood(ctx, level.best.kind, level.best.x, level.best.y, t, f, allFood);

  // enemies
  for (let i = 0; i < st.enemies.length; i++) {
    if (st.deadEnemies.has(i)) continue;
    const e = st.enemies[i];
    if (e.type === "rotten") drawRotten(ctx, e, t, f);
    else if (e.type === "chili") drawChili(ctx, e, t, f);
    else drawMonster(ctx, e, t, f);
  }

  // "+1" popups
  for (const p of st.pops) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - p.t / 0.9);
    crayonText(ctx, p.text, p.x, p.y - p.t * 50, 18, "#e04f4f", f, 999);
    ctx.restore();
  }
}

/** Hint bubble drawn in screen space (not affected by the camera). */
export function drawHint(ctx: CanvasRenderingContext2D, st: WorldState): void {
  if (st.hintT <= 0) return;
  const f = boil(st.time);
  ctx.save();
  ctx.globalAlpha = Math.min(1, st.hintT);
  ctx.font = 'bold 26px "Chalkboard SE", "Comic Sans MS", cursive';
  ctx.textAlign = "center";
  const w = ctx.measureText(st.hint).width + 40;
  sketchRect(ctx, 480 - w / 2, 60, w, 44, "rgba(253,249,239,0.95)", 90, f, 2);
  ctx.fillStyle = INK;
  ctx.fillText(st.hint, 480, 90);
  ctx.restore();
}

/** Arrow at the screen edge pointing to food the player skipped. */
export function drawFoodArrow(ctx: CanvasRenderingContext2D, side: -1 | 1, t: number): void {
  const f = boil(t);
  const x = side === -1 ? 36 : 924;
  const y = 290 + Math.sin(t * 4) * 6;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + side * 18, y);
  ctx.lineTo(x - side * 6, y - 18);
  ctx.lineTo(x - side * 6, y + 18);
  ctx.closePath();
  ctx.fillStyle = "#f2c14e";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  crayonText(ctx, "food!", x + (side === -1 ? 14 : -14), y + 34, 16, INK, f, 77);
  ctx.restore();
}

/* ---------------- enemies ---------------- */

/** Moldy rotten food: a green-spotted squishy blob with flies buzzing. */
function drawRotten(ctx: CanvasRenderingContext2D, e: EnemyRuntime, t: number, f: number): void {
  const cx = e.x;
  const feet = e.cy;
  const seed = 1200 + Math.round(e.min);
  const squish = 1 + Math.sin(t * 6) * 0.08;
  ctx.beginPath();
  ctx.ellipse(cx, feet - 13, 17 * squish, 13 / squish, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#9cb35a";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  for (const [dx, dy] of [[-8, -16], [6, -8], [9, -19]]) sketchCircle(ctx, cx + dx, feet + dy, 3, "#6d7f36", seed + dx, f, 0.4);
  // grumpy eyes
  sketchCircle(ctx, cx - 5 + e.dir * 2, feet - 15, 3, "#fff", seed + 1, f, 0.4);
  sketchCircle(ctx, cx + 5 + e.dir * 2, feet - 15, 3, "#fff", seed + 2, f, 0.4);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx - 5 + e.dir * 3, feet - 15, 1.3, 0, Math.PI * 2);
  ctx.arc(cx + 5 + e.dir * 3, feet - 15, 1.3, 0, Math.PI * 2);
  ctx.fill();
  // wavy yucky mouth
  sketchLine(ctx, cx - 6, feet - 7, cx + 6, feet - 7, seed + 3, f, 1.2, INK, 2);
  // stinky flies
  for (let i = 0; i < 2; i++) {
    const a = t * 7 + i * 3;
    sketchCircle(ctx, cx + Math.cos(a) * 18, feet - 34 + Math.sin(a * 1.4) * 6, 2, INK, seed + 4 + i, f, 0.3);
  }
}

/** Hot chili pepper: hops along with a spicy flame on its head. */
function drawChili(ctx: CanvasRenderingContext2D, e: EnemyRuntime, t: number, f: number): void {
  const cx = e.x;
  const feet = e.cy;
  const seed = 1300 + Math.round(e.min);
  ctx.save();
  ctx.translate(cx, feet - 16);
  ctx.rotate(e.dir * 0.3);
  ctx.beginPath();
  ctx.moveTo(-6, -14);
  ctx.quadraticCurveTo(12, -12, 8, 6);
  ctx.quadraticCurveTo(4, 16, -4, 16);
  ctx.quadraticCurveTo(-12, 0, -6, -14);
  ctx.closePath();
  ctx.fillStyle = "#e04f4f";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  sketchLine(ctx, -2, -14, 2, -22, seed, f, 0.4, "#5eaa61", 4);
  // angry eyes
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-3, -4, 2.6, 0, Math.PI * 2);
  ctx.arc(4, -4, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(-3 + e.dir, -4, 1.1, 0, Math.PI * 2);
  ctx.arc(4 + e.dir, -4, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // spicy steam
  const flick = Math.sin(t * 12) * 2;
  sketchCircle(ctx, cx - 8, feet - 40 - flick, 3, "#f2c14e", seed + 1, f, 0.6);
  sketchCircle(ctx, cx + 8, feet - 42 + flick, 3, "#ef8f4a", seed + 2, f, 0.6);
}

/** Hungry food-monster: a big purple mouth on legs that wants your snacks. */
function drawMonster(ctx: CanvasRenderingContext2D, e: EnemyRuntime, t: number, f: number): void {
  const cx = e.x;
  const feet = e.cy;
  const seed = 1400 + Math.round(e.min);
  const swing = Math.sin(t * e.speed * 0.05) * 4;
  sketchLine(ctx, cx - 8, feet - 10, cx - 10 + swing, feet, seed, f, 0.8, INK, 3);
  sketchLine(ctx, cx + 8, feet - 10, cx + 10 - swing, feet, seed + 1, f, 0.8, INK, 3);
  sketchCircle(ctx, cx, feet - 24, 17, "#9a6fd0", seed + 2, f, 1.4);
  // big chomping mouth
  const chomp = Math.abs(Math.sin(t * 6)) * 6;
  ctx.beginPath();
  ctx.ellipse(cx + e.dir * 3, feet - 18, 10, 2 + chomp, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#5c2c4a";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  for (const dx of [-6, -1, 4]) {
    ctx.beginPath();
    ctx.moveTo(cx + e.dir * 3 + dx, feet - 18 - chomp);
    ctx.lineTo(cx + e.dir * 3 + dx + 2.5, feet - 18 - chomp + 4);
    ctx.lineTo(cx + e.dir * 3 + dx + 5, feet - 18 - chomp);
    ctx.fill();
  }
  // one big eye
  sketchCircle(ctx, cx + e.dir * 3, feet - 33, 5, "#ffffff", seed + 3, f, 0.5);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx + e.dir * 5, feet - 33, 2, 0, Math.PI * 2);
  ctx.fill();
  if (Math.floor(t * 1.2) % 3 === 0) crayonText(ctx, "hungry!", cx, feet - 54, 12, "#9a6fd0", f, seed + 4);
}
