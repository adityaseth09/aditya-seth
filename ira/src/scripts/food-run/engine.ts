/**
 * Food Run! game engine — Ira's rules (from her sketch + chat):
 *  - pick a player, collect LOTS of food, then the Best Food in the World
 *    (it only unlocks once every food in the level is collected)
 *  - Energy Bar: go fast, but only for 10 seconds
 *  - Whole Sack of Sugar: a "you want suger? yes / no" box with 10 seconds
 *    to choose. Yes = go fast… then slow down (sugar crash)!
 *    Robo is allergic to sugar: X_X eyes and he freezes dizzy for a bit.
 *  - watch out for moldy food, hot chili peppers, hungry food-monsters
 *    and sticky syrup puddles!
 *  - 1 player or 2 players as a team (both reach the Best Food to win)
 */
import { levels as LEVELS } from "../../data/food-run-levels.json";
import type { LevelData, WorldState, EnemyRuntime, Rect } from "./render";
import { sounds } from "../tag-time/sounds";
import { inputs } from "../tag-time/input";

export const W = 960;
export const H = 540;
export const PW = 24;
export const PH = 36;
const GRAVITY = 2200;
const MOVE = 280;
const JUMP_V = -700;

export const ENERGY_TIME = 10;
export const RUSH_TIME = 5;
export const CRASH_TIME = 3;
export const DIZZY_TIME = 3.5;
export const SUGAR_CHOICE_TIME = 10;

export const ALL_LEVELS = LEVELS as unknown as LevelData[];
export const TOTAL = ALL_LEVELS.length;

export type Phase = "menu" | "playing" | "sugar" | "dead" | "levelDone" | "gameDone";
export type DeathCause = "pit" | "rotten" | "chili" | "monster" | "fall";

export interface Player {
  x: number; y: number; vx: number; vy: number;
  onGround: boolean;
  facing: number;
  coyote: number;
  jumpBuffer: number;
  /** Energy Bar speed boost (seconds left) */
  energyT: number;
  /** Sugar Rush (seconds left) */
  rushT: number;
  /** Sugar Crash (seconds left) */
  crashT: number;
  /** Robo's sugar allergy freeze (seconds left) */
  dizzyT: number;
  inSyrup: boolean;
}

function makePlayer(): Player {
  return {
    x: 0, y: 0, vx: 0, vy: 0, onGround: false, facing: 1, coyote: 0, jumpBuffer: 0,
    energyT: 0, rushT: 0, crashT: 0, dizzyT: 0, inSyrup: false,
  };
}

export const players: Player[] = [makePlayer(), makePlayer()];
export const charIds: (string | null)[] = [null, null];

export let phase: Phase = "menu";
export let levelIndex = 0;
export let playerCount = 1;
export let totalCoins = 0;
export let st: WorldState = makeState(0);

/** checkpoint flags (x positions) + index of the furthest one reached */
export let checkpoints: number[] = [];
export let checkpointReached = -1;

/** sugar choice box state */
export let sugarPlayer = 0;
export let sugarTimer = 0;
let sugarIndex = -1;

let deathTimer = 0;

/* ---------- hooks: main.ts wires these to the DOM ---------- */
export const hooks = {
  hud: () => {},
  death: (_cause: DeathCause) => {},
  levelDone: () => {},
  sugarPrompt: (_player: number) => {},
  sugarClosed: () => {},
  respawned: () => {},
};

export function setPlayerCount(n: number): void {
  playerCount = n;
}

export function setPhase(p: Phase): void {
  phase = p;
}

function makeState(i: number): WorldState {
  const level = ALL_LEVELS[i];
  return {
    level,
    foodsTaken: new Set(),
    energyTaken: new Set(),
    sugarTaken: new Set(),
    enemies: level.enemies.map((e) => ({ ...e, dir: 1, cy: e.y })) as EnemyRuntime[],
    deadEnemies: new Set(),
    time: 0,
    hint: "",
    hintT: 0,
    pops: [],
  };
}

/* ---------- persistence (coins are shared with Tag Time!) ---------- */
const LS_LEVEL = "foodRun:level";
const LS_COINS = "tagTime:coins";

export function savedLevel(): number {
  const n = parseInt(localStorage.getItem(LS_LEVEL) || "1", 10);
  if (Number.isNaN(n) || n < 1 || n > TOTAL) return 1;
  return n;
}

export function saveLevel(n: number): void {
  localStorage.setItem(LS_LEVEL, String(Math.max(1, Math.min(n, TOTAL))));
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

/* ---------- helpers ---------- */

export function say(text: string, secs = 2.2): void {
  st.hint = text;
  st.hintT = secs;
}

function overlap(a: Rect, b: Rect, inset = 0): boolean {
  return (
    a.x + inset < b.x + b.w - inset &&
    a.x + a.w - inset > b.x + inset &&
    a.y + inset < b.y + b.h - inset &&
    a.y + a.h - inset > b.y + inset
  );
}

function rectOf(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

export function foodsLeft(): number {
  return st.level.foods.length - st.foodsTaken.size;
}

export function allFoodCollected(): boolean {
  return foodsLeft() === 0;
}

/** Place checkpoint flags every ~1500px on safe flat ground. */
function computeCheckpoints(level: LevelData): number[] {
  const out: number[] = [];
  const safe = (x: number): boolean => {
    const onGround = level.platforms.some((p) => p.y === 480 && x - 30 >= p.x && x + 50 <= p.x + p.w);
    if (!onGround) return false;
    const near = (r: Rect) => x + 60 > r.x - 40 && x - 40 < r.x + r.w + 40;
    if (level.pits.some(near) || level.syrup.some(near)) return false;
    if (level.enemies.some((e) => x + 60 > e.min - 40 && x - 40 < e.max + 40)) return false;
    return true;
  };
  for (let target = 1500; target < level.best.x - 600; target += 1500) {
    for (let x = target; x < target + 700; x += 20) {
      if (safe(x)) {
        out.push(x);
        break;
      }
    }
  }
  return out;
}

function placePlayers(): void {
  const spawnX = checkpointReached >= 0 ? checkpoints[checkpointReached] : st.level.spawn.x;
  const spawnY = st.level.spawn.y;
  for (let p = 0; p < playerCount; p++) {
    const pl = players[p];
    pl.x = spawnX + (p === 1 ? 40 : 0);
    pl.y = spawnY;
    pl.vx = 0;
    pl.vy = 0;
    pl.onGround = true;
    pl.facing = 1;
    pl.coyote = 0;
    pl.jumpBuffer = 0;
    pl.energyT = 0;
    pl.rushT = 0;
    pl.crashT = 0;
    pl.dizzyT = 0;
    pl.inSyrup = false;
  }
}

export function startLevel(i: number): void {
  levelIndex = i;
  st = makeState(i);
  checkpoints = computeCheckpoints(st.level);
  checkpointReached = -1;
  placePlayers();
  phase = "playing";
  hooks.hud();
}

/* ---------- death & progress ---------- */

function die(cause: DeathCause): void {
  if (phase !== "playing") return;
  phase = "dead";
  deathTimer = 1.4;
  sounds.death();
  hooks.death(cause);
}

function respawn(): void {
  // gentle for kids: foods you already ate stay eaten, and you go back
  // to the last flag. Power-ups come back so you can try them again.
  st.energyTaken.clear();
  st.sugarTaken.clear();
  placePlayers();
  phase = "playing";
  hooks.respawned();
  hooks.hud();
}

function levelComplete(): void {
  phase = "levelDone";
  sounds.level();
  saveLevel(Math.min(TOTAL, levelIndex + 2));
  // step beside the pedestal so everyone can see the Best Food + the dance
  const bx = st.level.best.x;
  for (let p = 0; p < playerCount; p++) {
    const pl = players[p];
    pl.x = p === 0 ? bx - 90 - PW : bx + 70;
    pl.y = st.level.best.y - PH;
    pl.vx = 0;
    pl.vy = 0;
    pl.onGround = true;
    pl.facing = p === 0 ? 1 : -1;
  }
  hooks.levelDone();
  hooks.hud();
}

/* ---------- sugar choice ("you want suger? yes or no") ---------- */

function openSugarPrompt(p: number, idx: number): void {
  phase = "sugar";
  sugarPlayer = p;
  sugarIndex = idx;
  sugarTimer = SUGAR_CHOICE_TIME;
  for (const inp of inputs) {
    inp.left = false;
    inp.right = false;
    inp.jumpQueued = false;
  }
  sounds.sugarPrompt();
  hooks.sugarPrompt(p);
}

/** Called by the yes/no buttons (or the 10-second timeout → no). */
export function answerSugar(yes: boolean): void {
  if (phase !== "sugar") return;
  st.sugarTaken.add(sugarIndex);
  const pl = players[sugarPlayer];
  const who = playerCount === 2 ? `P${sugarPlayer + 1}: ` : "";
  if (!yes) {
    say(`${who}no thank you! 🙂`);
  } else if (charIds[sugarPlayer] === "robo") {
    // "Robo is allergic to suger" — Ira
    pl.dizzyT = DIZZY_TIME;
    pl.rushT = 0;
    pl.crashT = 0;
    sounds.allergy();
    say(`${who}BZZT! Robo is allergic to sugar! X_X`, 3);
  } else {
    pl.rushT = RUSH_TIME;
    pl.crashT = 0;
    sounds.sugarRush();
    say(`${who}SUGAR RUSH! zoom zoom! 🍬`);
  }
  phase = "playing";
  hooks.sugarClosed();
  hooks.hud();
}

/* ---------- enemies ---------- */

function updateEnemies(dt: number): void {
  for (let i = 0; i < st.enemies.length; i++) {
    if (st.deadEnemies.has(i)) continue;
    const e = st.enemies[i];
    e.x += e.dir * e.speed * dt;
    if (e.x <= e.min) {
      e.x = e.min;
      e.dir = 1;
    } else if (e.x >= e.max) {
      e.x = e.max;
      e.dir = -1;
    }
    // chili peppers hop along; the others walk
    e.cy = e.type === "chili" ? e.y - Math.abs(Math.sin(st.time * 4 + e.min)) * 34 : e.y;
  }
}

function enemyBox(e: EnemyRuntime): Rect {
  switch (e.type) {
    case "rotten":
      return { x: e.x - 16, y: e.cy - 26, w: 32, h: 26 };
    case "chili":
      return { x: e.x - 10, y: e.cy - 32, w: 20, h: 32 };
    case "monster":
      return { x: e.x - 16, y: e.cy - 40, w: 32, h: 40 };
  }
}

const STOMP_MSG: Record<EnemyRuntime["type"], string> = {
  rotten: "squished the yucky food!",
  chili: "cooled off the chili!",
  monster: "bonked the hungry monster!",
};

function enemyCollisions(pl: Player): void {
  for (let i = 0; i < st.enemies.length; i++) {
    if (st.deadEnemies.has(i)) continue;
    const e = st.enemies[i];
    const box = enemyBox(e);
    if (!overlap(rectOf(pl.x + 2, pl.y + 2, PW - 4, PH - 2), box, 2)) continue;
    const stomping = pl.vy > 120 && pl.y + PH < box.y + box.h * 0.6;
    if (stomping) {
      st.deadEnemies.add(i);
      pl.vy = -460;
      sounds.stomp();
      say(STOMP_MSG[e.type]);
    } else {
      die(e.type);
      return;
    }
  }
}

/* ---------- per-player physics ---------- */

export function speedFactor(pl: Player): number {
  let k = 1;
  if (pl.rushT > 0) k = 1.8;
  else if (pl.energyT > 0) k = 1.6;
  if (pl.crashT > 0) k *= 0.5;
  if (pl.inSyrup) k *= 0.45;
  return k;
}

function jumpFactor(pl: Player): number {
  let k = 1;
  if (pl.rushT > 0) k = 1.12;
  if (pl.inSyrup) k *= 0.8;
  return k;
}

function tickEffects(p: number, dt: number): void {
  const pl = players[p];
  const who = playerCount === 2 ? `P${p + 1}: ` : "";
  if (pl.energyT > 0) {
    pl.energyT = Math.max(0, pl.energyT - dt);
    if (pl.energyT === 0) say(`${who}energy all used up!`);
  }
  if (pl.rushT > 0) {
    pl.rushT = Math.max(0, pl.rushT - dt);
    if (pl.rushT === 0) {
      // "you will go fast and slow down" — Ira
      pl.crashT = CRASH_TIME;
      sounds.sugarCrash();
      say(`${who}uh oh… sugar crash! so slooow… 😴`, 2.6);
    }
  }
  if (pl.crashT > 0) pl.crashT = Math.max(0, pl.crashT - dt);
  if (pl.dizzyT > 0) {
    pl.dizzyT = Math.max(0, pl.dizzyT - dt);
    if (pl.dizzyT === 0) say(`${who}Robo feels better now! beep boop!`);
  }
}

function stepPlayer(p: number, dt: number): void {
  const pl = players[p];
  const inp = inputs[p];
  tickEffects(p, dt);

  const frozen = pl.dizzyT > 0;
  const dir = frozen ? 0 : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  pl.vx = dir * MOVE * speedFactor(pl);
  if (dir !== 0) pl.facing = dir;

  if (inp.jumpQueued) {
    pl.jumpBuffer = 0.14;
    inp.jumpQueued = false;
  }
  pl.jumpBuffer = Math.max(0, pl.jumpBuffer - dt);
  pl.coyote = Math.max(0, pl.coyote - dt);
  if (!frozen && pl.jumpBuffer > 0 && (pl.onGround || pl.coyote > 0)) {
    pl.vy = JUMP_V * jumpFactor(pl);
    pl.onGround = false;
    pl.coyote = 0;
    pl.jumpBuffer = 0;
    sounds.jump();
  }

  pl.vy += GRAVITY * dt;
  if (pl.vy > 1100) pl.vy = 1100;

  const solids = st.level.platforms;
  pl.x += pl.vx * dt;
  for (const s of solids) {
    if (overlap(rectOf(pl.x, pl.y, PW, PH), s, 0)) {
      if (pl.vx > 0) pl.x = s.x - PW;
      else if (pl.vx < 0) pl.x = s.x + s.w;
    }
  }
  if (pl.x < 0) pl.x = 0;
  if (pl.x + PW > st.level.width) pl.x = st.level.width - PW;

  pl.onGround = false;
  pl.y += pl.vy * dt;
  for (const s of solids) {
    if (overlap(rectOf(pl.x, pl.y, PW, PH), s, 0)) {
      if (pl.vy > 0) {
        pl.y = s.y - PH;
        pl.onGround = true;
        pl.vy = 0;
      } else if (pl.vy < 0) {
        pl.y = s.y + s.h;
        pl.vy = 0;
      }
    }
  }
  if (pl.onGround) pl.coyote = 0.09;

  const body = rectOf(pl.x + 3, pl.y + 3, PW - 6, PH - 3);
  const feet = rectOf(pl.x + 4, pl.y + PH - 6, PW - 8, 8);

  // sticky syrup
  const wasSticky = pl.inSyrup;
  pl.inSyrup = pl.onGround && st.level.syrup.some((s) => overlap(feet, s, 0));
  if (pl.inSyrup && !wasSticky && st.hintT <= 0) say("sticky syrup! sooo slow…", 1.4);

  // hazards
  for (const pit of st.level.pits) {
    if (overlap(body, pit, 2)) return die("pit");
  }
  if (pl.y > H + 120) return die("fall");
  enemyCollisions(pl);
  if (phase !== "playing") return;

  // foods
  for (let i = 0; i < st.level.foods.length; i++) {
    if (st.foodsTaken.has(i)) continue;
    const fd = st.level.foods[i];
    if (overlap(body, rectOf(fd.x - 13, fd.y - 13, 26, 26), 0)) {
      st.foodsTaken.add(i);
      totalCoins++;
      saveWallet();
      sounds.munch();
      st.pops.push({ x: fd.x, y: fd.y - 10, t: 0, text: "yum! +1" });
      if (allFoodCollected()) {
        sounds.bestFood();
        say("ALL the food! now get the BEST food! ⭐", 3);
      }
      hooks.hud();
    }
  }

  // energy bars
  st.level.energy.forEach((e, i) => {
    if (st.energyTaken.has(i)) return;
    if (overlap(body, rectOf(e.x - 28, e.y - 14, 56, 28), 0)) {
      st.energyTaken.add(i);
      pl.energyT = ENERGY_TIME;
      sounds.energy();
      say(`${playerCount === 2 ? `P${p + 1}: ` : ""}ENERGY! super fast for 10 seconds! ⚡`);
      hooks.hud();
    }
  });

  // sack of sugar → the yes/no choice box
  for (let i = 0; i < st.level.sugar.length; i++) {
    if (st.sugarTaken.has(i)) continue;
    const s = st.level.sugar[i];
    if (overlap(body, rectOf(s.x - 20, s.y - 30, 40, 44), 0)) {
      openSugarPrompt(p, i);
      return;
    }
  }

  // checkpoint flags
  for (let c = checkpointReached + 1; c < checkpoints.length; c++) {
    if (pl.x >= checkpoints[c]) {
      checkpointReached = c;
      sounds.key();
      say("checkpoint flag! 🚩");
    }
  }
}

function physics(dt: number): void {
  updateEnemies(dt);
  for (let p = 0; p < playerCount; p++) {
    if (phase !== "playing") return;
    stepPlayer(p, dt);
  }
  if (phase !== "playing") return;

  // finish: everyone at the Best Food in the World ("you both win!")
  const b = st.level.best;
  const zone = rectOf(b.x - 60, b.y - 160, 120, 160);
  let anyAt = false;
  let allAt = true;
  for (let p = 0; p < playerCount; p++) {
    const pl = players[p];
    const at = overlap(rectOf(pl.x, pl.y, PW, PH), zone, 0);
    anyAt ||= at;
    allAt &&= at;
  }
  if (!anyAt) return;
  if (!allFoodCollected()) {
    if (st.hintT <= 0) {
      const n = foodsLeft();
      sounds.locked();
      say(`locked! find ${n} more food${n === 1 ? "" : "s"}! 🔒`);
    }
  } else if (allAt) {
    levelComplete();
  } else if (st.hintT <= 0) {
    say("wait for your teammate! 🤝");
  }
}

/* ---------- frame tick ---------- */

export function tick(dt: number): void {
  st.time += dt;
  st.hintT = Math.max(0, st.hintT - dt);
  for (let i = st.pops.length - 1; i >= 0; i--) {
    st.pops[i].t += dt;
    if (st.pops[i].t > 0.9) st.pops.splice(i, 1);
  }

  if (phase === "playing") {
    physics(dt);
  } else if (phase === "sugar") {
    sugarTimer = Math.max(0, sugarTimer - dt);
    if (sugarTimer === 0) answerSugar(false);
  } else if (phase === "dead") {
    deathTimer -= dt;
    if (deathTimer <= 0) respawn();
  } else if (phase === "levelDone" || phase === "gameDone") {
    updateEnemies(dt);
  }
}
