/**
 * Clam Collector — swim, grab every key, open the clam, take the pearl.
 * Coral and sea animals send you back to the start of the level.
 */
import levelsFile from "../../data/clam-collector-levels.json";
import { sounds } from "../tag-time/sounds";

export const W = 960;
export const H = 540;
export const PR = 20;

export type Zone = "bay" | "reef" | "deep";
export type AnimalType = "fish" | "jelly" | "eel";
export type Phase = "menu" | "playing" | "dead" | "levelDone" | "gameDone";
export type DeathCause = "coral" | "fish" | "jelly" | "eel";

export interface LevelData {
  name: string;
  zone: Zone;
  width: number;
  spawn: [number, number];
  keys: [number, number][];
  coral: [number, number, number, number][];
  rocks: [number, number, number, number][];
  animals: { type: AnimalType; x: number; y: number; min: number; max: number; axis: "x" | "y"; speed: number }[];
  clam: [number, number];
}

export interface AnimalRt {
  type: AnimalType;
  x: number;
  y: number;
  min: number;
  max: number;
  axis: "x" | "y";
  speed: number;
  dir: number;
}

export interface Swimmer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  charId: string;
  atPearl: boolean;
}

export interface Dir {
  x: number;
  y: number;
}

export const ALL_LEVELS = levelsFile.levels as LevelData[];
export const TOTAL = ALL_LEVELS.length;

const LS_LEVEL = "clamCollector:level";
const LS_COINS = "tagTime:coins";
const ACCEL = 980;
const MAX_V = 230;
const DRAG = 3.2;

export let phase: Phase = "menu";
export let levelIndex = 0;
export let playerCount = 1;
export let totalCoins = 0;
export let players: Swimmer[] = [];
export let charIds: (string | null)[] = [null, null];
export let keysTaken: boolean[] = [];
export let animals: AnimalRt[] = [];
export let time = 0;
export let hint = "";
export let hintT = 0;
export let deathCause: DeathCause = "coral";
export let levelTime = 0;

export const hooks: {
  hud?: () => void;
  death?: () => void;
  levelDone?: () => void;
  gameDone?: () => void;
} = {};

export function setPhase(p: Phase): void {
  phase = p;
}

export function setPlayerCount(n: number): void {
  playerCount = n === 2 ? 2 : 1;
}

export function savedLevel(): number {
  const n = parseInt(localStorage.getItem(LS_LEVEL) || "1", 10);
  return Number.isFinite(n) ? Math.min(Math.max(1, n), TOTAL) : 1;
}

export function saveLevel(n: number): void {
  localStorage.setItem(LS_LEVEL, String(Math.min(Math.max(1, n), TOTAL)));
}

export function loadWallet(): void {
  totalCoins = parseInt(localStorage.getItem(LS_COINS) || "0", 10) || 0;
}

function saveWallet(): void {
  localStorage.setItem(LS_COINS, String(totalCoins));
}

export function spendCoins(n: number): boolean {
  if (totalCoins < n) return false;
  totalCoins -= n;
  saveWallet();
  return true;
}

export function currentLevel(): LevelData {
  return ALL_LEVELS[levelIndex];
}

export function keysLeft(): number {
  return keysTaken.filter((t) => !t).length;
}

export function clamOpen(): boolean {
  return keysLeft() === 0;
}

function say(text: string): void {
  hint = text;
  hintT = 2.4;
}

function makeSwimmer(id: string, ox: number): Swimmer {
  const [sx, sy] = currentLevel().spawn;
  return { x: sx + ox, y: sy, vx: 0, vy: 0, facing: 1, charId: id, atPearl: false };
}

export function startLevel(i: number): void {
  levelIndex = Math.max(0, Math.min(TOTAL - 1, i));
  const lv = currentLevel();
  const id0 = charIds[0] ?? "mia";
  const id1 = charIds[1] ?? "ziggy";
  players = [makeSwimmer(id0, 0)];
  if (playerCount === 2) players.push(makeSwimmer(id1, 46));
  keysTaken = lv.keys.map(() => false);
  animals = lv.animals.map((a) => ({ ...a, dir: 1 }));
  time = 0;
  levelTime = 0;
  hint = "";
  hintT = 0;
  phase = "playing";
  hooks.hud?.();
}

function circleHitsRect(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number): boolean {
  const px = Math.max(x, Math.min(cx, x + w));
  const py = Math.max(y, Math.min(cy, y + h));
  const dx = cx - px;
  const dy = cy - py;
  return dx * dx + dy * dy < r * r;
}

function pushOutOfRocks(p: Swimmer, rocks: LevelData["rocks"]): void {
  for (let n = 0; n < 3; n++) {
    for (const [x, y, w, h] of rocks) {
      if (!circleHitsRect(p.x, p.y, PR, x, y, w, h)) continue;
      const cx = Math.max(x, Math.min(p.x, x + w));
      const cy = Math.max(y, Math.min(p.y, y + h));
      let dx = p.x - cx;
      let dy = p.y - cy;
      const dist = Math.hypot(dx, dy) || 0.001;
      if (dist < 0.01) {
        dx = 0;
        dy = -1;
      }
      const push = PR - dist + 0.5;
      p.x += (dx / dist) * push;
      p.y += (dy / dist) * push;
      p.vx *= 0.4;
      p.vy *= 0.4;
    }
  }
}

function kill(cause: DeathCause): void {
  deathCause = cause;
  phase = "dead";
  sounds.death();
  say(
    cause === "coral"
      ? "the coral stuck on! back to the start…"
      : cause === "jelly"
        ? "the jelly stung you!"
        : cause === "eel"
          ? "the eel got you!"
          : "a fish bumped you!",
  );
  hooks.death?.();
}

function finishLevel(): void {
  const bonus = currentLevel().keys.length + 2;
  totalCoins += bonus;
  saveWallet();
  sounds.coin();
  sounds.level();
  const next = levelIndex + 2;
  if (next > savedLevel()) saveLevel(next);
  if (levelIndex + 1 >= TOTAL) {
    phase = "gameDone";
    sounds.win();
    hooks.gameDone?.();
  } else {
    phase = "levelDone";
    hooks.levelDone?.();
  }
  hooks.hud?.();
}

export function tick(dt: number, dirs: Dir[]): void {
  if (phase !== "playing") return;
  const step = Math.min(dt, 0.033);
  time += step;
  levelTime += step;
  if (hintT > 0) hintT -= step;

  const lv = currentLevel();
  const surface = 48;
  const floor = H - 36;

  for (const a of animals) {
    if (a.axis === "x") {
      a.x += a.dir * a.speed * step;
      if (a.x < a.min || a.x > a.max) a.dir *= -1;
    } else {
      a.y += a.dir * a.speed * step;
      if (a.y < a.min || a.y > a.max) a.dir *= -1;
    }
  }

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const d = dirs[i] ?? { x: 0, y: 0 };
    p.vx += d.x * ACCEL * step;
    p.vy += d.y * ACCEL * step;
    const drag = Math.exp(-DRAG * step);
    p.vx *= drag;
    p.vy *= drag;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > MAX_V) {
      p.vx = (p.vx / sp) * MAX_V;
      p.vy = (p.vy / sp) * MAX_V;
    }
    p.x += p.vx * step;
    p.y += p.vy * step;
    if (d.x !== 0) p.facing = d.x > 0 ? 1 : -1;
    p.x = Math.max(PR + 8, Math.min(lv.width - PR - 8, p.x));
    p.y = Math.max(surface + PR, Math.min(floor - PR, p.y));
    pushOutOfRocks(p, lv.rocks);

    for (const [x, y, w, h] of lv.coral) {
      if (circleHitsRect(p.x, p.y, PR - 2, x, y, w, h)) {
        kill("coral");
        return;
      }
    }
    if (phase !== "playing") return;
    for (const a of animals) {
      const ar = a.type === "jelly" ? 18 : a.type === "eel" ? 16 : 16;
      if (Math.hypot(p.x - a.x, p.y - a.y) < PR + ar - 4) {
        kill(a.type);
        return;
      }
    }
    if (phase !== "playing") return;

    lv.keys.forEach(([kx, ky], ki) => {
      if (keysTaken[ki]) return;
      if (Math.hypot(p.x - kx, p.y - ky) < PR + 14) {
        keysTaken[ki] = true;
        sounds.key();
        const left = keysLeft();
        say(left === 0 ? "all the keys! the clam can open! 🐚" : `${left} more key${left === 1 ? "" : "s"}!`);
        hooks.hud?.();
      }
    });

    const [cx, cy] = lv.clam;
    const near = Math.hypot(p.x - cx, p.y - cy) < 48;
    if (near && !clamOpen() && hintT <= 0) {
      say(`locked! find ${keysLeft()} more key${keysLeft() === 1 ? "" : "s"}! 🔒`);
      sounds.locked();
    }
    p.atPearl = near && clamOpen();
  }

  if (phase !== "playing") return;
  const ready = players.length > 0 && players.every((p) => p.atPearl);
  if (ready) finishLevel();
  else if (playerCount === 2 && players.some((p) => p.atPearl) && hintT <= 0) say("wait for your teammate! 🤝");
}
