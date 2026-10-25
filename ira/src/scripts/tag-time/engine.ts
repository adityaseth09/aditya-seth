/**
 * Tag Time! game engine: one or two players through the same levels.
 * Ira's rules: fall in lava → restart from the top; you BOTH win when
 * BOTH players walk through the doors; one dies → both restart.
 */
import { levels as LEVELS } from "../../data/levels.json";
import type { LevelData, WorldState, EnemyRuntime } from "./render";
import { sounds } from "./sounds";
import { showOverlay, updateHUD, setDeathMessage } from "./ui";
import { inputs } from "./input";

export const W = 960;
export const H = 540;
export const PW = 24;
export const PH = 36;
const GRAVITY = 2200;
const MOVE = 280;
const JUMP_V = -700;

export type Phase = "picker" | "start" | "playing" | "dead" | "levelDone" | "gameDone";

export interface Player {
  x: number; y: number; vx: number; vy: number;
  onGround: boolean;
  facing: number;
  coyote: number;
  jumpBuffer: number;
}

export const players: Player[] = [makePlayer(), makePlayer()];

function makePlayer(): Player {
  return {
    x: 0, y: 0, vx: 0, vy: 0,
    onGround: false, facing: 1, coyote: 0, jumpBuffer: 0,
  };
}

/** Character definitions for players 1 and 2 (set by the picker flow). */
export const charIds: (string | null)[] = [null, null];

export let phase: Phase = "picker";
export let levelIndex = 0;
export let totalCoins = 0;
export let attemptCoins = 0;
export let st: WorldState = makeState(0);
export let playerCount = 1;

export function setPlayerCount(n: number): void {
  playerCount = n;
}

function makeState(i: number): WorldState {
  return {
    level: (LEVELS as LevelData[])[i],
    levelIndex: i,
    keysTaken: new Set(),
    coinsTaken: new Set(),
    leverPulled: false,
    openDoors: new Set(),
    enemies: ((LEVELS as LevelData[])[i].enemies ?? []).map((e) => ({
      ...e,
      dir: 1,
      cy: e.y,
    })) as EnemyRuntime[],
    deadEnemies: new Set(),
    time: 0,
    hint: "",
    hintT: 0,
  };
}

function respawn(): void {
  const s = st.level.spawn;
  for (let p = 0; p < playerCount; p++) {
    const pl = players[p];
    pl.x = s.x + (p === 1 ? 40 : 0); // P2 spawns a bit right of P1
    pl.y = s.y;
    pl.vx = 0;
    pl.vy = 0;
    pl.onGround = true;
    pl.facing = 1;
    pl.coyote = 0;
    pl.jumpBuffer = 0;
  }
  attemptCoins = 0;
}

/* ---------- persistence ---------- */
const LS_LEVEL = "tagTime:level";

export function savedLevel(): number {
  const n = parseInt(localStorage.getItem(LS_LEVEL) || "1", 10);
  if (Number.isNaN(n) || n < 1 || n > LEVELS.length) return 1;
  return n;
}

export function saveLevel(n: number): void {
  localStorage.setItem(LS_LEVEL, String(Math.min(n, LEVELS.length)));
}

export function say(text: string): void {
  st.hint = text;
  st.hintT = 2.2;
}

function hudSync(): void {
  updateHUD({
    levelNo: levelIndex + 1,
    levelName: st.level.name,
    coins: totalCoins,
    keys: [...st.keysTaken],
  });
}

/* ---------- collision helpers ---------- */
interface Rect { x: number; y: number; w: number; h: number }

function solids(): Rect[] {
  const list: Rect[] = [...st.level.platforms];
  for (const d of st.level.doors) {
    if (!st.openDoors.has(d.id)) list.push(d);
  }
  if (st.leverPulled) list.push(...st.level.bridges);
  return list;
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

/* ---------- death & progress ---------- */

function die(cause: "lava" | "spikes" | "fall" | "beast" | "bird"): void {
  if (phase !== "playing") return;
  phase = "dead";
  deathTimer = 1.3;
  totalCoins = Math.max(0, totalCoins - attemptCoins);
  attemptCoins = 0;
  sounds.death();
  setDeathMessage(cause);
  showOverlay("death");
}

let deathTimer = 0;

function levelComplete(): void {
  phase = "levelDone";
  sounds.level();
  saveLevel(Math.min(LEVELS.length, levelIndex + 2));
  const stats = document.getElementById("levelStats");
  if (stats) stats.textContent = `coins: ${totalCoins}  •  keys: 2`;
  showOverlay("level");
  hudSync();
}

export function startLevel(i: number): void {
  levelIndex = i;
  st = makeState(i);
  respawn();
  phase = "playing";
  showOverlay(null);
  hudSync();
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
    e.cy = e.type === "bird" ? e.y + Math.sin(st.time * 3 + e.min * 0.05) * (e.amp ?? 30) : e.y;
  }
}

function enemyCollisions(pl: Player): void {
  for (let i = 0; i < st.enemies.length; i++) {
    if (st.deadEnemies.has(i)) continue;
    const e = st.enemies[i];
    const box: Rect =
      e.type === "beast"
        ? { x: e.x - 14, y: e.cy - 30, w: 28, h: 30 }
        : { x: e.x - 12, y: e.cy - 12, w: 24, h: 22 };
    if (!overlap(rectOf(pl.x + 2, pl.y + 2, PW - 4, PH - 2), box, 2)) continue;

    const stomping = pl.vy > 120 && pl.y + PH < box.y + box.h * 0.55;
    if (stomping) {
      st.deadEnemies.add(i);
      pl.vy = -420;
      sounds.stomp();
      say(e.type === "beast" ? "squashed it!" : "bonked the bird!");
    } else {
      die(e.type);
      return;
    }
  }
}

/* ---------- per-player physics ---------- */

function stepPlayer(p: number, dt: number): void {
  const pl = players[p];
  const inp = inputs[p];

  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  pl.vx = dir * MOVE;
  if (dir !== 0) pl.facing = dir;

  if (inp.jumpQueued) {
    pl.jumpBuffer = 0.14;
    inp.jumpQueued = false;
  }
  pl.jumpBuffer = Math.max(0, pl.jumpBuffer - dt);
  pl.coyote = Math.max(0, pl.coyote - dt);
  if (pl.jumpBuffer > 0 && (pl.onGround || pl.coyote > 0)) {
    pl.vy = JUMP_V;
    pl.onGround = false;
    pl.coyote = 0;
    pl.jumpBuffer = 0;
    sounds.jump();
  }

  pl.vy += GRAVITY * dt;
  if (pl.vy > 1100) pl.vy = 1100;

  const solidsNow = solids();

  pl.x += pl.vx * dt;
  for (const s of solidsNow) {
    if (overlap(rectOf(pl.x, pl.y, PW, PH), s, 0)) {
      if (pl.vx > 0) pl.x = s.x - PW;
      else if (pl.vx < 0) pl.x = s.x + s.w;
    }
  }
  if (pl.x < 0) pl.x = 0;
  if (pl.x + PW > st.level.width) pl.x = st.level.width - PW;

  pl.onGround = false;
  pl.y += pl.vy * dt;
  for (const s of solidsNow) {
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

  // hazards
  const body = rectOf(pl.x + 3, pl.y + 3, PW - 6, PH - 3);
  for (const l of st.level.lava) {
    if (overlap(body, l, 2)) return die("lava");
  }
  for (const s of st.level.spikes) {
    if (overlap(body, s, 4)) return die("spikes");
  }
  if (pl.y > H + 120) return die("fall");

  enemyCollisions(pl);
  if (phase !== "playing") return;

  // pickups & interactives (any player can grab them)
  for (let i = 0; i < st.level.coins.length; i++) {
    if (st.coinsTaken.has(i)) continue;
    const c = st.level.coins[i];
    if (overlap(body, rectOf(c.x - 9, c.y - 9, 18, 18), 0)) {
      st.coinsTaken.add(i);
      totalCoins++;
      attemptCoins++;
      sounds.coin();
      hudSync();
    }
  }
  for (const k of st.level.keys) {
    if (st.keysTaken.has(k.id)) continue;
    if (overlap(body, rectOf(k.x - 10, k.y - 10, 26, 20), 0)) {
      st.keysTaken.add(k.id);
      sounds.key();
      say(`you found key ${k.id}!`);
      hudSync();
    }
  }
  const lv = st.level.lever;
  if (!st.leverPulled && overlap(body, rectOf(lv.x - 26, lv.y - 30, 52, 40), 0)) {
    st.leverPulled = true;
    sounds.lever();
    say("you pushed it! a bridge appeared!");
  }
  for (const d of st.level.doors) {
    if (st.openDoors.has(d.id)) continue;
    if (overlap(body, d, -4)) {
      if (st.keysTaken.has(d.id)) {
        st.openDoors.add(d.id);
        sounds.door();
        say(`door ${d.id} is open!`);
      } else if (st.hintT <= 0) {
        sounds.locked();
        say(`door ${d.id} is locked! find key ${d.id}!`);
      }
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

  // finish: ALL players must stand in the exit zone ("you both win!")
  const exit = st.level.exit;
  for (let p = 0; p < playerCount; p++) {
    const pl = players[p];
    if (!overlap(rectOf(pl.x + 3, pl.y + 3, PW - 6, PH - 3), exit, 0)) return;
  }
  if (st.openDoors.size >= 2) {
    levelComplete();
  } else if (st.hintT <= 0) {
    say("you need both keys to go through!");
  }
}

/* ---------- frame tick ---------- */

export function tick(dt: number): void {
  st.time += dt;
  st.hintT = Math.max(0, st.hintT - dt);

  if (phase === "playing") {
    physics(dt);
  } else if (phase === "dead") {
    deathTimer -= dt;
    if (deathTimer <= 0) {
      st = makeState(levelIndex);
      respawn();
      phase = "playing";
      showOverlay(null);
      hudSync();
    }
  }
}

/** Used by the win screen ("play again") */
export function setPhase(p: Phase): void {
  phase = p;
}
