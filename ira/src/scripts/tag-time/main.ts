/**
 * Tag Time! — boot, game flow (mode + character picks), camera and loop.
 * Engine lives in engine.ts; this wires it to the page.
 */
import { levels as LEVELS } from "../../data/levels.json";
import type { LevelData } from "./render";
import { drawBackground, drawWorld } from "./render";
import { CHARACTERS, drawCharacter, type CharacterDef, type Pose } from "./characters";
import { sounds, unlockAudio, startMusic, setMusic, musicPref, isMusicOn } from "./sounds";
import { initInput, setPlayerCount } from "./input";
import { buildPicker, type PickerHandle } from "./picker";
import { initUI, showOverlay } from "./ui";
import { buildShop, selectedOutfit, selectedDance, type ShopHandle } from "./shop";
import * as E from "./engine";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("canvas 2d not available");

const W = E.W;
const H = E.H;
const TOTAL = (LEVELS as LevelData[]).length;

/* ---------- persistence for characters + mode ---------- */
const LS_CHAR = "tagTime:char";
const LS_CHAR2 = "tagTime:char2";

function charDefFor(slot: number): CharacterDef {
  const id = slot === 0 ? E.charIds[0] : E.charIds[1];
  const found = id ? CHARACTERS.find((c) => c.id === id) : undefined;
  return found ?? CHARACTERS[0];
}

/* ---------- flow: mode → pick → go! → play ---------- */

let picker: PickerHandle | null = null;
let shop: ShopHandle | null = null;
let pickingPlayer = 0; // 0 = P1, 1 = P2

/** First user gesture: unlock audio + start music if enabled. */
function firstGesture(): void {
  unlockAudio();
  if (musicPref()) startMusic();
}

function syncMusicButton(): void {
  const btn = document.getElementById("btnMusic");
  if (btn) btn.textContent = isMusicOn() ? "🔊" : "🔇";
}

function showModeSelect(): void {
  document.getElementById("modeSection")?.classList.remove("hidden");
  document.getElementById("goSection")?.classList.add("hidden");
  showOverlay("mode");
}

function beginPicks(): void {
  pickingPlayer = 0;
  E.charIds[0] = null;
  E.charIds[1] = null;
  picker?.enableAll();
  picker?.setPrompt("Player 1 — pick your character!");
  picker?.highlight(localStorage.getItem(LS_CHAR));
  showOverlay("picker");
}

function onPick(def: CharacterDef): void {
  firstGesture();
  E.charIds[pickingPlayer] = def.id;
  if (pickingPlayer === 0) {
    localStorage.setItem(LS_CHAR, def.id);
    if (E.playerCount === 2) {
      pickingPlayer = 1;
      picker?.exclude(def.id);
      picker?.setPrompt("Player 2 — pick your character!");
      picker?.highlight(localStorage.getItem(LS_CHAR2));
      return;
    }
  } else {
    localStorage.setItem(LS_CHAR2, def.id);
  }
  showStart();
}

function showStart(): void {
  document.getElementById("modeSection")?.classList.add("hidden");
  document.getElementById("goSection")?.classList.remove("hidden");
  const title = document.getElementById("startTitle");
  const nxt = E.savedLevel();
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
      E.saveLevel(1);
      showStart();
    };
  }
  showOverlay("start");
}

function syncTouchClusters(): void {
  // in duo mode show the second button cluster, and move P1's cluster apart
  const duo = E.playerCount === 2;
  document.getElementById("touchClusterP2")?.classList.toggle("hidden", !duo);
  const jump1 = document.getElementById("btnJump1");
  if (jump1) {
    // solo: P1 cluster keeps left+right+JUMP side by side.
    // duo: JUMP1 stays with the left cluster; JUMP2 cluster appears right.
    jump1.style.marginRight = duo ? "18px" : "0";
  }
}

function setupFlow(): void {
  picker = buildPicker(onPick);
  picker.highlight(localStorage.getItem(LS_CHAR));

  shop = buildShop(
    () => E.totalCoins,
    (n) => E.spendCoins(n),
    () => {
      // selection changed — nothing else needed live; render picks it up next frame
    },
  );

  // shop entries (from the mode screen and the go! screen)
  for (const id of ["btnShopMode", "btnShopGo"]) {
    document.getElementById(id)?.addEventListener("click", () => {
      firstGesture();
      shop?.open();
    });
  }
  document.getElementById("shopBack")?.addEventListener("click", () => {
    shop?.close();
  });

  // music toggle
  const mbtn = document.getElementById("btnMusic");
  mbtn?.addEventListener("click", () => {
    const nowOn = !isMusicOn();
    setMusic(nowOn);
    if (nowOn) unlockAudio();
    syncMusicButton();
  });
  syncMusicButton();

  document.getElementById("btn1P")?.addEventListener("click", () => {
    firstGesture();
    E.setPlayerCount(1);
    setPlayerCount(1);
    syncTouchClusters();
    beginPicks();
  });
  document.getElementById("btn2P")?.addEventListener("click", () => {
    firstGesture();
    E.setPlayerCount(2);
    setPlayerCount(2);
    syncTouchClusters();
    beginPicks();
  });

  document.getElementById("goBtn")?.addEventListener("click", () => {
    firstGesture();
    E.startLevel(E.savedLevel() - 1);
  });
  document.getElementById("startOverlay")?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.id === "startOverlay" || target.id === "goSection") {
      firstGesture();
      E.startLevel(E.savedLevel() - 1);
    }
  });

  document.getElementById("nextBtn")?.addEventListener("click", () => {
    if (E.levelIndex + 1 >= TOTAL) {
      E.setPhase("gameDone");
      const winStats = document.getElementById("winStats");
      if (winStats) winStats.textContent = `you collected ${E.totalCoins} coins!`;
      sounds.win();
      showOverlay("win");
    } else {
      E.startLevel(E.levelIndex + 1);
    }
  });

  document.getElementById("againBtn")?.addEventListener("click", () => {
    E.saveLevel(1);
    E.totalCoins = 0;
    showModeSelect();
  });

  showModeSelect();
}

/* ---------- rendering: zoom-to-fit camera keeps BOTH players on screen ---------- */

function poseOf(p: number): Pose {
  const pl = E.players[p];
  if (E.phase === "levelDone" || E.phase === "gameDone") return "cheer";
  if (!pl.onGround) return pl.vy < 0 ? "jump" : "fall";
  if (Math.abs(pl.vx) > 10) return "run";
  return "idle";
}

function render(time: number): void {
  if (!ctx) return;
  const level = E.st.level;
  let scale = 1;
  let camX = E.players[0].x - W * 0.45;

  if (E.playerCount === 2) {
    const a = E.players[0];
    const b = E.players[1];
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x + E.PW, b.x + E.PW);
    const span = Math.max(420, maxX - minX + 320);
    scale = Math.max(0.55, Math.min(1, W / span));
    const viewW = W / scale;
    const mid = (minX + maxX) / 2;
    camX = mid - viewW / 2;
    if (camX < 0) camX = 0;
    if (camX > level.width - viewW) camX = Math.max(0, level.width - viewW);
  } else {
    camX = Math.max(0, Math.min(camX, level.width - W));
  }

  drawBackground(ctx, camX, level.width, time);

  ctx.save();
  ctx.scale(scale, scale);
  const camY = H / scale - H;
  ctx.translate(-Math.round(camX), -Math.round(camY));
  drawWorld(ctx, E.st);
  const celebrating = E.phase === "levelDone" || E.phase === "gameDone";
  if (!celebrating) {
    // normal play: characters in the world
    const charOpts = { outfit: selectedOutfit(), dance: selectedDance() };
    for (let p = 0; p < E.playerCount; p++) {
      const pl = E.players[p];
      drawCharacter(ctx, charDefFor(p), pl.x + E.PW / 2, pl.y + E.PH, poseOf(p), pl.facing, time, 1.15, charOpts);
    }
  }
  ctx.restore();

  if (celebrating) {
    // celebration: dancers jump to fixed spots beside the "You win!" panel.
    // 1 player dances on the right; 2 players dance together — one each side.
    const charOpts = { outfit: selectedOutfit(), dance: selectedDance() };
    const footY = H - 84;
    const big = 2.3;
    if (E.playerCount === 2) {
      drawCharacter(ctx, charDefFor(0), 120, footY, "cheer", 1, time, big, charOpts);
      drawCharacter(ctx, charDefFor(1), W - 120, footY, "cheer", -1, time, big, charOpts);
    } else {
      drawCharacter(ctx, charDefFor(0), W - 120, footY, "cheer", -1, time, big, charOpts);
    }
  }
}

/* ---------- main loop ---------- */

let last = performance.now();

function loop(now: number): void {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  E.tick(dt);
  if (E.phase === "picker" && picker) picker.tick(now / 1000);
  render(now / 1000);
  requestAnimationFrame(loop);
}

/* ---------- boot ---------- */

initUI();
E.loadWallet();
initInput(firstGesture, () => E.phase === "playing");
setupFlow();
requestAnimationFrame(loop);

/* ---------- debug helpers (harmless in production) ---------- */
declare global {
  interface Window {
    __tagtime?: {
      setLevel: (n: number) => void;
      setMode: (n: number) => void;
      warp: (player: number, x: number, y: number) => void;
      info: () => unknown;
    };
  }
}
window.__tagtime = {
  setLevel: (n: number) => E.startLevel(Math.max(0, Math.min(TOTAL - 1, n - 1))),
  setMode: (n: number) => {
    E.setPlayerCount(n);
    setPlayerCount(n);
    syncTouchClusters();
  },
  warp: (p: number, x: number, y: number) => {
    const pl = E.players[p];
    pl.x = x;
    pl.y = y;
    pl.vx = 0;
    pl.vy = 0;
  },
  info: () => ({
    phase: E.phase,
    mode: E.playerCount,
    level: E.levelIndex + 1,
    coins: E.totalCoins,
    music: isMusicOn(),
    outfit: selectedOutfit(),
    dance: selectedDance(),
    keys: [...E.st.keysTaken],
    doors: [...E.st.openDoors],
    lever: E.st.leverPulled,
    players: E.players.slice(0, E.playerCount).map((pl) => ({
      x: Math.round(pl.x),
      y: Math.round(pl.y),
      onGround: pl.onGround,
    })),
    enemies: E.st.enemies.map((e) => ({ type: e.type, x: Math.round(e.x), cy: Math.round(e.cy) })),
    deadEnemies: [...E.st.deadEnemies],
  }),
};
