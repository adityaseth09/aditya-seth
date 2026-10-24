/**
 * Tag Time! — a lava obstacle course game designed by Ira (age 8).
 * Jump over lava, find key 1 and key 2, push the lever,
 * then walk through BOTH doors to finish the level.
 */
import { levels as LEVELS } from "../../data/levels.json";
import type { LevelData, WorldState } from "./render";
import { drawBackground, drawWorld } from "./render";
import { CHARACTERS, drawCharacter, type CharacterDef, type Pose } from "./characters";
import { sounds, unlockAudio } from "./sounds";
import { input, initInput } from "./input";
import { buildPicker, type PickerHandle } from "./picker";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("canvas 2d not available");

const W = 960;
const H = 540;

/* ---------- player ---------- */
const PW = 24;
const PH = 36;
const GRAVITY = 2200;
const MOVE = 280;
const JUMP_V = -700;

const player = {
  x: 0, y: 0, vx: 0, vy: 0,
  onGround: false,
  facing: 1,
  coyote: 0,
  jumpBuffer: 0,
};

let charDef: CharacterDef = CHARACTERS[0];

/* ---------- state ---------- */
type Phase = "picker" | "start" | "playing" | "dead" | "levelDone" | "gameDone";
let phase: Phase = "picker";
let levelIndex = 0;
let totalCoins = 0;
let attemptCoins = 0;
let deathTimer = 0;
let time = 0;
let picker: PickerHandle | null = null;

let st: WorldState = makeState(0);

function makeState(i: number): WorldState {
  return {
    level: (LEVELS as LevelData[])[i],
    levelIndex: i,
    keysTaken: new Set(),
    coinsTaken: new Set(),
    leverPulled: false,
    openDoors: new Set(),
    time: 0,
    hint: "",
    hintT: 0,
  };
}

function respawn(): void {
  const s = st.level.spawn;
  player.x = s.x;
  player.y = s.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.facing = 1;
  attemptCoins = 0;
}

/* ---------- persistence ---------- */
const LS_LEVEL = "tagTime:level";
const LS_CHAR = "tagTime:char";

function savedLevel(): number {
  const n = parseInt(localStorage.getItem(LS_LEVEL) || "1", 10);
  if (Number.isNaN(n) || n < 1 || n > LEVELS.length) return 1;
  return n;
}

function saveLevel(n: number): void {
  localStorage.setItem(LS_LEVEL, String(Math.min(n, LEVELS.length)));
}

/* ---------- overlays / HUD ---------- */
const overlays = {
  picker: document.getElementById("pickerOverlay"),
  start: document.getElementById("startOverlay"),
  death: document.getElementById("deathOverlay"),
  level: document.getElementById("levelOverlay"),
  win: document.getElementById("winOverlay"),
};

function showOverlay(id: keyof typeof overlays | null): void {
  for (const [k, el] of Object.entries(overlays)) {
    el?.classList.toggle("hidden", k !== id);
  }
}

const hud = {
  level: document.getElementById("hudLevel"),
  coins: document.getElementById("hudCoins"),
  key1: document.getElementById("hudKey1"),
  key2: document.getElementById("hudKey2"),
};

function updateHUD(): void {
  if (hud.level) hud.level.textContent = `Level ${levelIndex + 1}: ${st.level.name}`;
  if (hud.coins) hud.coins.textContent = `coins: ${totalCoins}`;
  hud.key1?.classList.toggle("opacity-30", !st.keysTaken.has(1));
  hud.key1?.classList.toggle("grayscale", !st.keysTaken.has(1));
  hud.key2?.classList.toggle("opacity-30", !st.keysTaken.has(2));
  hud.key2?.classList.toggle("grayscale", !st.keysTaken.has(2));
}

function say(text: string): void {
  st.hint = text;
  st.hintT = 2.2;
}

/* ---------- solids & physics ---------- */
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

function die(): void {
  if (phase !== "playing") return;
  phase = "dead";
  deathTimer = 1.3;
  totalCoins = Math.max(0, totalCoins - attemptCoins);
  attemptCoins = 0;
  sounds.death();
  showOverlay("death");
}

function physics(dt: number): void {
  // horizontal
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  player.vx = dir * MOVE;
  if (dir !== 0) player.facing = dir;

  // jump: coyote time + a small buffer so it feels fair for kids
  if (input.jumpQueued) {
    player.jumpBuffer = 0.14;
    input.jumpQueued = false;
  }
  player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
  player.coyote = Math.max(0, player.coyote - dt);
  if (player.jumpBuffer > 0 && (player.onGround || player.coyote > 0)) {
    player.vy = JUMP_V;
    player.onGround = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    sounds.jump();
  }

  player.vy += GRAVITY * dt;
  if (player.vy > 1100) player.vy = 1100;

  const solidsNow = solids();

  // move + resolve X
  player.x += player.vx * dt;
  for (const s of solidsNow) {
    if (overlap(rectOf(player.x, player.y, PW, PH), s, 0)) {
      if (player.vx > 0) player.x = s.x - PW;
      else if (player.vx < 0) player.x = s.x + s.w;
    }
  }
  if (player.x < 0) player.x = 0;
  if (player.x + PW > st.level.width) player.x = st.level.width - PW;

  // move + resolve Y
  player.onGround = false;
  player.y += player.vy * dt;
  for (const s of solidsNow) {
    if (overlap(rectOf(player.x, player.y, PW, PH), s, 0)) {
      if (player.vy > 0) {
        player.y = s.y - PH;
        player.onGround = true;
        player.vy = 0;
      } else if (player.vy < 0) {
        player.y = s.y + s.h;
        player.vy = 0;
      }
    }
  }
  if (player.onGround) player.coyote = 0.09;

  // lava & spikes & falling out of the world
  const body = rectOf(player.x + 3, player.y + 3, PW - 6, PH - 3);
  for (const l of st.level.lava) {
    if (overlap(body, l, 2)) return die();
  }
  for (const s of st.level.spikes) {
    if (overlap(body, s, 4)) return die();
  }
  if (player.y > H + 120) return die();

  // coins
  for (let i = 0; i < st.level.coins.length; i++) {
    if (st.coinsTaken.has(i)) continue;
    const c = st.level.coins[i];
    if (overlap(body, rectOf(c.x - 9, c.y - 9, 18, 18), 0)) {
      st.coinsTaken.add(i);
      totalCoins++;
      attemptCoins++;
      sounds.coin();
      updateHUD();
    }
  }

  // keys
  for (const k of st.level.keys) {
    if (st.keysTaken.has(k.id)) continue;
    if (overlap(body, rectOf(k.x - 10, k.y - 10, 26, 20), 0)) {
      st.keysTaken.add(k.id);
      sounds.key();
      say(`you found key ${k.id}!`);
      updateHUD();
    }
  }

  // lever
  const lv = st.level.lever;
  if (!st.leverPulled && overlap(body, rectOf(lv.x - 26, lv.y - 30, 52, 40), 0)) {
    st.leverPulled = true;
    sounds.lever();
    say("you pushed it! a bridge appeared!");
  }

  // doors
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

  // exit: needs BOTH doors open (Ira's rule!)
  if (overlap(body, st.level.exit, 0)) {
    if (st.openDoors.size >= 2) {
      levelComplete();
    } else if (st.hintT <= 0) {
      say("you need both keys to go through!");
    }
  }
}

function levelComplete(): void {
  phase = "levelDone";
  sounds.level();
  saveLevel(Math.min(LEVELS.length, levelIndex + 2));
  const stats = document.getElementById("levelStats");
  if (stats) stats.textContent = `coins: ${totalCoins}  •  keys: 2`;
  showOverlay("level");
  updateHUD();
}

function startLevel(i: number): void {
  levelIndex = i;
  st = makeState(i);
  respawn();
  phase = "playing";
  showOverlay(null);
  updateHUD();
}

/* ---------- rendering ---------- */

function pose(): Pose {
  if (phase === "levelDone" || phase === "gameDone") return "cheer";
  if (!player.onGround) return player.vy < 0 ? "jump" : "fall";
  if (Math.abs(player.vx) > 10) return "run";
  return "idle";
}

function render(): void {
  if (!ctx) return;
  const camX = Math.max(0, Math.min(player.x - W * 0.45, st.level.width - W));

  drawBackground(ctx, camX, st.level.width, time);

  ctx.save();
  ctx.translate(-Math.round(camX), 0);
  drawWorld(ctx, st);
  drawCharacter(ctx, charDef, player.x + PW / 2, player.y + PH, pose(), player.facing, time, 1.15);
  ctx.restore();
}

/* ---------- boot ---------- */

function showStart(): void {
  const title = document.getElementById("startTitle");
  const nxt = savedLevel();
  if (title) {
    title.textContent =
      nxt > 1
        ? `Level ${nxt}: ${(LEVELS as LevelData[])[nxt - 1].name}`
        : `Level 1: ${(LEVELS as LevelData[])[0].name}`;
  }
  const reset = document.getElementById("resetProgress");
  reset?.classList.toggle("hidden", nxt <= 1);
  if (reset) {
    reset.onclick = () => {
      saveLevel(1);
      showStart();
    };
  }
  showOverlay("start");
}

function setupFlow(): void {
  // picker → start → play
  picker = buildPicker((def) => {
    charDef = def;
    localStorage.setItem(LS_CHAR, def.id);
    showStart();
  });
  const savedChar = localStorage.getItem(LS_CHAR);
  if (savedChar) {
    const found = CHARACTERS.find((c) => c.id === savedChar);
    if (found) {
      charDef = found;
      picker.select(found.id);
    }
  }

  document.getElementById("goBtn")?.addEventListener("click", () => {
    unlockAudio();
    startLevel(savedLevel() - 1);
  });
  document.getElementById("startOverlay")?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.id === "startOverlay" || target.id === "startTitle") {
      unlockAudio();
      startLevel(savedLevel() - 1);
    }
  });

  document.getElementById("nextBtn")?.addEventListener("click", () => {
    if (levelIndex + 1 >= LEVELS.length) {
      phase = "gameDone";
      const winStats = document.getElementById("winStats");
      if (winStats) winStats.textContent = `you collected ${totalCoins} coins!`;
      sounds.win();
      showOverlay("win");
    } else {
      startLevel(levelIndex + 1);
    }
  });

  document.getElementById("againBtn")?.addEventListener("click", () => {
    saveLevel(1);
    totalCoins = 0;
    showStart();
  });

  showOverlay("picker");
}

/* ---------- main loop ---------- */

let last = performance.now();

function loop(now: number): void {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  time += dt;
  st.time = time;
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
      updateHUD();
    }
  }

  if (phase === "picker" && picker) picker.tick(time);
  render();
  requestAnimationFrame(loop);
}

initInput(unlockAudio, () => phase === "playing");
setupFlow();
updateHUD();
requestAnimationFrame(loop);

// debug helpers (used for testing; harmless in production)
declare global {
  interface Window {
    __tagtime?: {
      setLevel: (n: number) => void;
      info: () => { phase: string; level: number; coins: number; keys: number[]; doors: number[]; lever: boolean };
      warp: (x: number, y: number) => void;
    };
  }
}
window.__tagtime = {
  setLevel: (n: number) => {
    startLevel(Math.max(0, Math.min(LEVELS.length - 1, n - 1)));
  },
  info: () => ({
    phase,
    level: levelIndex + 1,
    coins: totalCoins,
    keys: [...st.keysTaken],
    doors: [...st.openDoors],
    lever: st.leverPulled,
    x: Math.round(player.x),
    y: Math.round(player.y),
    onGround: player.onGround,
  }),
  warp: (x: number, y: number) => {
    player.x = x;
    player.y = y;
    player.vx = 0;
    player.vy = 0;
  },
};
