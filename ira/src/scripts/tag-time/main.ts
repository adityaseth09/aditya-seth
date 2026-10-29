/**
 * Tag Time! — boot, game flow (mode + character picks), camera and loop.
 * Engine lives in engine.ts; this wires it to the page.
 */
import { levels as LEVELS } from "../../data/levels.json";
import type { LevelData } from "./render";
import { drawBackground, drawWorld } from "./render";
import { CHARACTERS, drawCharacter, drawPet, type CharacterDef, type Pose } from "./characters";
import { sounds, unlockAudio, startMusic, setMusic, musicPref, isMusicOn, currentSongId } from "./sounds";
import { initInput, setPlayerCount } from "./input";
import { buildPicker, type PickerHandle } from "./picker";
import { initUI, showOverlay } from "./ui";
import { buildShop, selectedOutfit, selectedDance, selectedPet, type ShopHandle } from "./shop";
import * as E from "./engine";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("canvas 2d not available");

// dancers are drawn HERE (above the white win overlays) so they stay visible
const danceCanvas = document.getElementById("danceCanvas") as HTMLCanvasElement;
const dctx = danceCanvas?.getContext("2d");

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
    E.resetWallet();
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

/* ---------- pet sidekick: follows player 1 everywhere ---------- */
let petX = 0;
let petY = 0;
let petSeen = false;

function drawPetInWorld(time: number): void {
  if (!ctx) return;
  const petId = selectedPet();
  if (!petId) return;
  const pl = E.players[0];
  // trail a little behind the player, on their back side
  const tx = pl.x + E.PW / 2 - pl.facing * 44;
  const ty = pl.y + E.PH;
  if (!petSeen || Math.hypot(tx - petX, ty - petY) > 260) {
    petX = tx;
    petY = ty;
    petSeen = true;
  }
  petX += (tx - petX) * 0.12;
  petY += (ty - petY) * 0.16;
  drawPet(ctx, petId, petX, petY, time, 0.9);
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

  drawBackground(ctx, camX, level.width, time, level.theme);

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
    drawPetInWorld(time);
  }
  ctx.restore();

  if (celebrating) {
    // celebration: dancers are drawn on the fixed full-viewport canvas,
    // OUTSIDE the foggy game frame — on the white page beside/below it.
    if (dctx) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (danceCanvas.width !== vw || danceCanvas.height !== vh) {
        danceCanvas.width = vw;
        danceCanvas.height = vh;
      }
      dctx.clearRect(0, 0, vw, vh);
      const charOpts = { outfit: selectedOutfit(), dance: selectedDance() };
      const big = 2.3;
      const rect = canvas.getBoundingClientRect();
      const leftRoom = rect.left;
      const rightRoom = vw - rect.right;
      // returns [x, footY] outside the foggy frame; falls back to inside if
      // the window is too small for the page margins
      const spot = (side: "left" | "right"): [number, number] => {
        const room = side === "left" ? leftRoom : rightRoom;
        if (room > 100) {
          const x = side === "left" ? rect.left / 2 : rect.right + room / 2;
          return [x, rect.bottom - 34];
        }
        // below the game (over the white page under the instructions)
        const belowY = rect.bottom + 150;
        if (belowY < vh - 20) {
          const cx = rect.left + rect.width / 2;
          return [cx + (side === "left" ? -140 : 140), belowY];
        }
        // last resort: inside the frame (viewport coords, bottom corners)
        return [side === "left" ? rect.left + 120 : rect.right - 120, rect.bottom - 54];
      };
      if (E.playerCount === 2) {
        const [lx, ly] = spot("left");
        const [rx, ry] = spot("right");
        drawCharacter(dctx, charDefFor(0), lx, ly, "cheer", 1, time, big, charOpts);
        drawCharacter(dctx, charDefFor(1), rx, ry, "cheer", -1, time, big, charOpts);
        const petId = selectedPet();
        if (petId) drawPet(dctx, petId, lx + 90, ly, time, 1.6);
      } else {
        const [x, y] = spot("right");
        drawCharacter(dctx, charDefFor(0), x, y, "cheer", -1, time, big, charOpts);
        const petId = selectedPet();
        if (petId) drawPet(dctx, petId, x + 100, y, time, 1.6);
      }
    }
  } else if (dctx) {
    dctx.clearRect(0, 0, danceCanvas.width, danceCanvas.height);
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

/** Homepage planet jump links use /games/tag-time/?level=N */
function applyLevelQuery(): void {
  const raw = new URLSearchParams(location.search).get("level");
  if (!raw) return;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1 || n > TOTAL) return;
  E.saveLevel(n);
}

initUI();
E.loadWallet();
applyLevelQuery();
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
    song: currentSongId(),
    outfit: selectedOutfit(),
    dance: selectedDance(),
    pet: selectedPet(),
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
