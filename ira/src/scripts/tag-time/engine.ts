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
      dropT: e.type === "rain" ? 0.5 : undefined,
    })) as EnemyRuntime[],
    deadEnemies: new Set(),
    drops: [],
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
const LS_COINS = "tagTime:coins";

export function savedLevel(): number {
  const n = parseInt(localStorage.getItem(LS_LEVEL) || "1", 10);
  if (Number.isNaN(n) || n < 1 || n > LEVELS.length) return 1;
  return n;
}

export function saveLevel(n: number): void {
  localStorage.setItem(LS_LEVEL, String(Math.min(n, LEVELS.length)));
}

/** Wallet: coins persist between visits so Ira can shop later. */
export function loadWallet(): void {
  totalCoins = parseInt(localStorage.getItem(LS_COINS) || "0", 10) || 0;
}

function saveWallet(): void {
  localStorage.setItem(LS_COINS, String(totalCoins));
}

/** Try to spend coins in the shop. Returns false if not enough coins. */
export function spendCoins(n: number): boolean {
  if (totalCoins < n) return false;
  totalCoins -= n;
  saveWallet();
  return true;
}

/** "Play again": wipe the wallet and the saved level. */
export function resetWallet(): void {
  totalCoins = 0;
  saveWallet();
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

function die(cause: "lava" | "spikes" | "fall" | "beast" | "bird" | "wind" | "rain" | "fire"): void {
  if (phase !== "playing") return;
  phase = "dead";
  deathTimer = 1.3;
  totalCoins = Math.max(0, totalCoins - attemptCoins);
  attemptCoins = 0;
  saveWallet();
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
    // flyers (bird, wind, rain) bob around y; ground villains (beast, fire) sit on it
    const flies = e.type === "bird" || e.type === "wind" || e.type === "rain";
    e.cy = flies ? e.y + Math.sin(st.time * 3 + e.min * 0.05) * (e.amp ?? 30) : e.y;

    // rain clouds keep spitting droplets
    if (e.type === "rain") {
      e.dropT = (e.dropT ?? 0.5) - dt;
      if (e.dropT <= 0) {
        e.dropT = 0.55;
        st.drops.push({ x: e.x + (Math.sin(st.time * 9) * 10), y: e.cy + 12, vy: 60 });
      }
    }
  }
}

function updateDrops(dt: number): void {
  for (let i = st.drops.length - 1; i >= 0; i--) {
    const d = st.drops[i];
    const prevY = d.y;
    d.vy += 900 * dt;
    d.y += d.vy * dt;
    // splash out when a drop lands on a platform or falls off the world
    let gone = d.y > 560;
    if (!gone) {
      for (const p of st.level.platforms) {
        if (d.x > p.x && d.x < p.x + p.w && prevY <= p.y + 4 && d.y >= p.y) {
          gone = true;
          break;
        }
      }
    }
    if (gone) st.drops.splice(i, 1);
  }
}

function enemyBox(e: EnemyRuntime): Rect {
  switch (e.type) {
    case "beast":
      return { x: e.x - 14, y: e.cy - 30, w: 28, h: 30 };
    case "bird":
      return { x: e.x - 12, y: e.cy - 12, w: 24, h: 22 };
    case "wind":
      return { x: e.x - 17, y: e.cy - 14, w: 34, h: 26 };
    case "rain":
      return { x: e.x - 19, y: e.cy - 14, w: 38, h: 28 };
    case "fire":
      return { x: e.x - 11, y: e.cy - 32, w: 22, h: 32 };
  }
}

const STOMP_MSG: Record<EnemyRuntime["type"], string> = {
  beast: "squashed it!",
  bird: "bonked the bird!",
  wind: "puffed the gust away!",
  rain: "splashed the rain cloud!",
  fire: "put out the fire!",
};

function enemyCollisions(pl: Player): void {
  for (let i = 0; i < st.enemies.length; i++) {
    if (st.deadEnemies.has(i)) continue;
    const e = st.enemies[i];
    const box = enemyBox(e);
    if (!overlap(rectOf(pl.x + 2, pl.y + 2, PW - 4, PH - 2), box, 2)) continue;

    const stomping = pl.vy > 120 && pl.y + PH < box.y + box.h * 0.55;
    if (stomping) {
      st.deadEnemies.add(i);
      // popping a rain cloud clears its falling drops too
      if (e.type === "rain") st.drops.length = 0;
      pl.vy = -420;
      sounds.stomp();
      say(STOMP_MSG[e.type]);
    } else {
      die(e.type);
      return;
    }
  }
}

/** Wind villains gently shove you along when you get close (they can't be "dodged" — just avoid the gust zone). */
function windPush(pl: Player, dt: number): void {
  for (let i = 0; i < st.enemies.length; i++) {
    if (st.deadEnemies.has(i)) continue;
    const e = st.enemies[i];
    if (e.type !== "wind") continue;
    const dx = Math.abs(e.x - (pl.x + PW / 2));
    const dy = Math.abs(e.cy - (pl.y + PH / 2));
    if (dx < 110 && dy < 70) {
      pl.x += e.dir * 55 * dt;
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
  // raindrops from Drizzle clouds
  for (const d of st.drops) {
    if (overlap(body, rectOf(d.x - 4, d.y - 8, 8, 12), 2)) return die("rain");
  }
  if (pl.y > H + 120) return die("fall");

  windPush(pl, dt);
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
      saveWallet();
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
  updateDrops(dt);
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
