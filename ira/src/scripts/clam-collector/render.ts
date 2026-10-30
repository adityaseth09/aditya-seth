/**
 * Crayon sea for Clam Collector: octopus, keys, coral, animals, clam + pearl.
 */
import { boil, crayonText, hash, sketchCircle, sketchLine, sketchRect, INK } from "../tag-time/draw";
import { findCharacter } from "../tag-time/characters";
import {
  H,
  W,
  animals,
  clamOpen,
  currentLevel,
  hint,
  hintT,
  keysTaken,
  players,
  time,
  type AnimalRt,
  type Swimmer,
  type Zone,
} from "./engine";

const ZONE_WATER: Record<Zone, [string, string, string]> = {
  bay: ["#d7f6ff", "#8fd4ee", "#f3e2b8"],
  reef: ["#b7e7f2", "#3aa0c8", "#e7c99a"],
  deep: ["#1b4468", "#0c243c", "#243646"],
};

export function drawWorld(ctx: CanvasRenderingContext2D, camX: number, camY: number, zoom: number): void {
  const lv = currentLevel();
  const frame = boil(time);
  const [top, mid, sand] = ZONE_WATER[lv.zone];
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(0.72, mid);
  g.addColorStop(1, sand);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-camX, -camY);

  drawSeaweed(ctx, lv.width, frame, lv.zone);
  for (const rock of lv.rocks) drawRock(ctx, rock[0], rock[1], rock[2], rock[3], frame);
  for (const c of lv.coral) drawCoral(ctx, c[0], c[1], c[2], c[3], frame);
  lv.keys.forEach(([x, y], i) => {
    if (!keysTaken[i]) drawKey(ctx, x, y, frame, i);
  });
  for (const a of animals) drawAnimal(ctx, a, frame);
  drawClam(ctx, lv.clam[0], lv.clam[1], frame, clamOpen());
  for (const p of players) drawOctopus(ctx, p, frame);

  ctx.restore();

  if (hint && hintT > 0) {
    crayonText(ctx, hint, W / 2, 78, 22, lv.zone === "deep" ? "#f2c14e" : INK, frame, 3);
  }
  drawKeyArrow(ctx, camX, zoom);
}

function drawSeaweed(ctx: CanvasRenderingContext2D, width: number, frame: number, zone: Zone): void {
  const ink = zone === "deep" ? "#7ec8a3" : "#2f8f4e";
  for (let x = 40; x < width; x += 90) {
    const h = 50 + hash(x, 1) * 70;
    const sway = Math.sin(time * 1.5 + x) * 10;
    sketchLine(ctx, x, H - 28, x + sway, H - 28 - h, x, frame, 2, ink, 3);
  }
  sketchRect(ctx, 0, H - 36, width, 40, ZONE_WATER[zone][2], 4, frame, 1.2);
}

function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frame: number): void {
  sketchRect(ctx, x, y, w, h, "#8d8a84", x + y, frame, 1.5);
}

function drawCoral(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frame: number): void {
  const color = hash(x, y) > 0.5 ? "#e07fb0" : "#ef8f4a";
  const baseY = y + h;
  for (let i = 0; i < 4; i++) {
    const px = x + (w * (i + 0.5)) / 4;
    const top = y + hash(x, i) * h * 0.35;
    sketchLine(ctx, px, baseY, px + Math.sin(time + i) * 6, top, x + i, frame, 1.4, color, 4);
    sketchCircle(ctx, px + Math.sin(time + i) * 6, top, 7, color, x + i, frame, 1);
  }
}

function drawKey(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, i: number): void {
  const bob = Math.sin(time * 3 + i) * 4;
  sketchCircle(ctx, x, y + bob, 8, "#f2c14e", i + 2, frame, 1);
  sketchLine(ctx, x + 8, y + bob, x + 22, y + bob, i, frame, 0.8, INK, 3);
  sketchLine(ctx, x + 16, y + bob, x + 16, y + bob + 6, i, frame, 0.6, INK, 3);
}

function drawAnimal(ctx: CanvasRenderingContext2D, a: AnimalRt, frame: number): void {
  if (a.type === "fish") {
    const dir = a.dir >= 0 ? 1 : -1;
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.scale(dir, 1);
    sketchCircle(ctx, 0, 0, 14, "#ef8f4a", a.x, frame, 1.2);
    sketchLine(ctx, -14, 0, -24, -8, a.x, frame, 1, INK, 3);
    sketchLine(ctx, -14, 0, -24, 8, a.x, frame, 1, INK, 3);
    sketchCircle(ctx, 6, -3, 2, INK, a.x, frame, 0.4);
    ctx.restore();
    return;
  }
  if (a.type === "jelly") {
    sketchCircle(ctx, a.x, a.y, 16, "#e7b6f2", a.x, frame, 1.3);
    for (let i = -1; i <= 1; i++) {
      const sway = Math.sin(time * 4 + i) * 4;
      sketchLine(ctx, a.x + i * 7, a.y + 10, a.x + i * 7 + sway, a.y + 32, a.x + i, frame, 1, "#9a6fd0", 2);
    }
    return;
  }
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.scale(a.dir >= 0 ? 1 : -1, 1);
  sketchLine(ctx, -22, Math.sin(time * 6) * 4, 18, 0, a.x, frame, 1.5, "#5eaa61", 6);
  sketchCircle(ctx, 16, 0, 8, "#5eaa61", a.x, frame, 1);
  ctx.restore();
}

function drawClam(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, open: boolean): void {
  const gap = open ? 16 : 2;
  sketchCircle(ctx, x - 6, y + gap, 26, "#f7f1e4", x, frame, 1.4);
  sketchCircle(ctx, x - 6, y - gap, 26, "#efe6d4", x + 1, frame, 1.4);
  if (open) {
    const bob = Math.sin(time * 4) * 3;
    sketchCircle(ctx, x, y + bob, 8, "#f7f7ff", x + 3, frame, 0.8, "#9a6fd0");
    crayonText(ctx, "pearl!", x, y - 40, 16, "#9a6fd0", frame, 9);
  } else {
    crayonText(ctx, "🔒", x, y - 36, 18, INK, frame, 8);
  }
}

function drawOctopus(ctx: CanvasRenderingContext2D, p: Swimmer, frame: number): void {
  const def = findCharacter(p.charId);
  const wob = Math.sin(time * 6) * 3;
  ctx.save();
  ctx.translate(p.x, p.y + wob);
  ctx.scale(p.facing, 1);
  sketchCircle(ctx, 0, 0, 18, def.clothes, p.x, frame, 1.3);
  for (let i = 0; i < 6; i++) {
    const a = 0.4 + (i / 5) * 2.2;
    const len = 16 + (i % 2) * 6;
    const tx = Math.cos(a) * len + Math.sin(time * 5 + i) * 4;
    const ty = Math.sin(a) * len;
    sketchLine(ctx, Math.cos(a) * 10, Math.sin(a) * 10, tx, ty, p.x + i, frame, 1.2, def.clothes, 4);
  }
  sketchCircle(ctx, 6, -4, 4, "#fff", p.x, frame, 0.5);
  sketchCircle(ctx, 14, -4, 4, "#fff", p.x, frame, 0.5);
  if (def.kind === "robot") {
    sketchLine(ctx, 3, -4, 9, -4, p.x, frame, 0.4, INK, 2);
    sketchLine(ctx, 11, -4, 17, -4, p.x, frame, 0.4, INK, 2);
  } else {
    sketchCircle(ctx, 7, -3, 1.6, INK, p.x, frame, 0.2);
    sketchCircle(ctx, 15, -3, 1.6, INK, p.x, frame, 0.2);
  }
  if (def.kind === "dog") {
    sketchCircle(ctx, -4, -16, 6, def.hair, p.x, frame, 0.8);
    sketchCircle(ctx, 8, -18, 6, def.hair, p.x, frame, 0.8);
  } else if (def.kind !== "robot") {
    sketchCircle(ctx, 2, -16, 7, def.hair, p.x, frame, 1);
  }
  ctx.restore();
  crayonText(ctx, def.name, p.x, p.y - 32, 13, INK, frame, p.x);
}

function drawKeyArrow(ctx: CanvasRenderingContext2D, camX: number, zoom: number): void {
  const lv = currentLevel();
  const me = players[0];
  if (!me) return;
  let target: [number, number] | null = null;
  lv.keys.forEach(([x, y], i) => {
    if (!keysTaken[i] && !target) target = [x, y];
  });
  if (!target) target = lv.clam;
  const [tx] = target;
  const screenX = W / 2 + (tx - camX) * zoom;
  if (screenX > 40 && screenX < W - 40) return;
  const left = screenX < 40;
  crayonText(ctx, left ? "◀ key" : "key ▶", left ? 70 : W - 70, H / 2, 18, "#f2c14e", boil(time), 11);
}
