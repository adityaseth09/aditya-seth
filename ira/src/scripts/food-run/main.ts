/**
 * Food Run! — boot, game flow (mode → pick → go!), the sugar yes/no box,
 * HUD, camera and the main loop. Physics/rules live in engine.ts.
 */
import { drawBackground, drawWorld, drawHint, drawFoodArrow, WORLD_INFO, type LevelData } from "./render";
import { findCharacter, drawCharacter, drawPet, type CharacterDef, type Pose } from "../tag-time/characters";
import { sketchLine, sketchRect, boil, INK } from "../tag-time/draw";
import { sounds, unlockAudio, startMusic, setMusic, musicPref, isMusicOn } from "../tag-time/sounds";
import { initInput, setPlayerCount } from "../tag-time/input";
import { buildPicker, type PickerHandle } from "../tag-time/picker";
import { buildShop, selectedOutfit, selectedDance, selectedPet, type ShopHandle } from "../tag-time/shop";
import * as E from "./engine";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("canvas 2d not available");

const W = E.W;
const H = E.H;
const LS_CHAR = "foodRun:char";
const LS_CHAR2 = "foodRun:char2";

const $ = (id: string) => document.getElementById(id);

/* ---------- overlays ---------- */
type OverlayId = "start" | "picker" | "death" | "level" | "win" | "sugar";
const OVERLAY_IDS: Record<OverlayId, string> = {
  start: "startOverlay",
  picker: "pickerOverlay",
  death: "deathOverlay",
  level: "levelOverlay",
  win: "winOverlay",
  sugar: "sugarOverlay",
};
let pickerVisible = false;

function showOverlay(id: OverlayId | null): void {
  for (const [k, elId] of Object.entries(OVERLAY_IDS)) {
    $(elId)?.classList.toggle("hidden", k !== id);
  }
  pickerVisible = id === "picker";
  // touch buttons only while playing, so they never cover menus or the sugar box
  const touch = $("touchControls");
  if (touch) touch.style.visibility = id === null || id === "death" ? "visible" : "hidden";
}

/* ---------- HUD ---------- */
let lastStatus = "";

function hudSync(): void {
  const lv = E.st.level;
  const hudLevel = $("hudLevel");
  if (hudLevel) hudLevel.textContent = `${WORLD_INFO[lv.world].emoji} Level ${E.levelIndex + 1}: ${lv.name}`;
  const hudFood = $("hudFood");
  if (hudFood) hudFood.textContent = `🍎 ${E.st.foodsTaken.size}/${lv.foods.length}`;
  const hudCoins = $("hudCoins");
  if (hudCoins) hudCoins.textContent = `🪙 ${E.totalCoins}`;
}

function statusOf(p: number): string {
  const pl = E.players[p];
  if (pl.dizzyT > 0) return `X_X ${Math.ceil(pl.dizzyT)}`;
  if (pl.rushT > 0) return `🍬 ${Math.ceil(pl.rushT)}`;
  if (pl.crashT > 0) return `😴 ${Math.ceil(pl.crashT)}`;
  if (pl.energyT > 0) return `⚡ ${Math.ceil(pl.energyT)}`;
  return "";
}

function statusSync(): void {
  const parts: string[] = [];
  for (let p = 0; p < E.playerCount; p++) {
    const s = statusOf(p);
    if (s) parts.push(E.playerCount === 2 ? `P${p + 1} ${s}` : s);
  }
  const text = parts.join(" · ");
  if (text !== lastStatus) {
    lastStatus = text;
    const el = $("hudStatus");
    if (el) el.textContent = text;
  }
}

const DEATH_MSG: Record<E.DeathCause, string> = {
  pit: "",
  rotten: "Yuck! Moldy food got you! 🤢",
  chili: "Too spicy! The chili got you! 🌶️",
  monster: "The hungry monster got you! 👾",
  fall: "Whoops, you fell! 😵",
};

/* ---------- engine hooks ---------- */
E.hooks.hud = hudSync;
E.hooks.death = (cause) => {
  const msg = $("deathMsg");
  if (msg) msg.textContent = cause === "pit" ? `You fell in the ${WORLD_INFO[E.st.level.world].pitName}! 💦` : DEATH_MSG[cause];
  const sub = $("deathSub");
  if (sub) sub.textContent = E.checkpointReached >= 0 ? "back to the flag… (your food is safe!)" : "back to the start… (your food is safe!)";
  showOverlay("death");
};
E.hooks.respawned = () => showOverlay(null);
E.hooks.levelDone = () => {
  const stats = $("levelStats");
  if (stats) stats.textContent = `you got the ${E.st.level.best.name}! · food: ${E.st.foodsTaken.size} · coins: ${E.totalCoins}`;
  showOverlay("level");
};

let sugarTicker: number | null = null;
E.hooks.sugarPrompt = (p) => {
  const who = $("sugarWho");
  if (who) who.textContent = E.playerCount === 2 ? `Player ${p + 1} found a whole sack of sugar!` : "you found a whole sack of sugar!";
  $("sugarRoboNote")?.classList.toggle("hidden", E.charIds[p] !== "robo");
  const cd = $("sugarCountdown");
  if (cd) cd.textContent = String(E.SUGAR_CHOICE_TIME);
  showOverlay("sugar");
  if (sugarTicker !== null) window.clearInterval(sugarTicker);
  sugarTicker = window.setInterval(() => {
    if (cd) cd.textContent = String(Math.ceil(E.sugarTimer));
  }, 100);
};
E.hooks.sugarClosed = () => {
  if (sugarTicker !== null) window.clearInterval(sugarTicker);
  sugarTicker = null;
  showOverlay(null);
};

/* ---------- flow: mode → pick → go! → play ---------- */
let picker: PickerHandle | null = null;
let shop: ShopHandle | null = null;
let pickingPlayer = 0;

function firstGesture(): void {
  unlockAudio();
  if (musicPref()) startMusic();
}

function syncMusicButton(): void {
  const btn = $("btnMusic");
  if (btn) btn.textContent = isMusicOn() ? "🔊" : "🔇";
}

/** show/hide a flex-column section (Tailwind "hidden" ↔ "flex") */
function toggleFlex(id: string, on: boolean): void {
  const el = $(id);
  el?.classList.toggle("hidden", !on);
  el?.classList.toggle("flex", on);
}

function showModeSelect(): void {
  E.setPhase("menu");
  toggleFlex("modeSection", true);
  toggleFlex("goSection", false);
  showOverlay("start");
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
  toggleFlex("modeSection", false);
  toggleFlex("goSection", true);
  const n = E.savedLevel();
  const lv = E.ALL_LEVELS[n - 1] as LevelData;
  const title = $("startTitle");
  if (title) title.textContent = `${WORLD_INFO[lv.world].emoji} Level ${n}: ${lv.name}`;
  const reset = $("resetProgress");
  reset?.classList.toggle("hidden", n <= 1);
  if (reset) {
    reset.onclick = () => {
      E.saveLevel(1);
      showStart();
    };
  }
  showOverlay("start");
}

function syncTouchClusters(): void {
  const duo = E.playerCount === 2;
  $("touchClusterP2")?.classList.toggle("hidden", !duo);
  const jump1 = $("btnJump1");
  if (jump1) jump1.style.marginRight = duo ? "18px" : "0";
}

function go(): void {
  firstGesture();
  E.startLevel(E.savedLevel() - 1);
  showOverlay(null);
}

function setupFlow(): void {
  picker = buildPicker(onPick);
  shop = buildShop(() => E.totalCoins, (n) => E.spendCoins(n), () => {});

  for (const id of ["btnShopMode", "btnShopGo"]) {
    $(id)?.addEventListener("click", () => {
      firstGesture();
      shop?.open();
    });
  }
  $("shopBack")?.addEventListener("click", () => shop?.close());

  $("btnMusic")?.addEventListener("click", () => {
    const nowOn = !isMusicOn();
    setMusic(nowOn);
    if (nowOn) unlockAudio();
    syncMusicButton();
  });
  syncMusicButton();

  for (const [id, n] of [["btn1P", 1], ["btn2P", 2]] as const) {
    $(id)?.addEventListener("click", () => {
      firstGesture();
      E.setPlayerCount(n);
      setPlayerCount(n);
      syncTouchClusters();
      beginPicks();
    });
  }

  $("goBtn")?.addEventListener("click", go);
  $("startOverlay")?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.id === "goSection") go();
  });

  $("nextBtn")?.addEventListener("click", () => {
    if (E.levelIndex + 1 >= E.TOTAL) {
      E.setPhase("gameDone");
      const winStats = $("winStats");
      if (winStats) winStats.textContent = `you have ${E.totalCoins} coins to spend in the shop!`;
      sounds.win();
      showOverlay("win");
    } else {
      E.startLevel(E.levelIndex + 1);
      showOverlay(null);
    }
  });
  $("againBtn")?.addEventListener("click", () => {
    E.saveLevel(1);
    showModeSelect();
  });

  // Ira's sugar box: yes or no
  $("sugarYes")?.addEventListener("click", () => E.answerSugar(true));
  $("sugarNo")?.addEventListener("click", () => E.answerSugar(false));
  window.addEventListener("keydown", (e) => {
    if (E.phase !== "sugar") return;
    if (e.code === "KeyY") E.answerSugar(true);
    else if (e.code === "KeyN") E.answerSugar(false);
  });

  showModeSelect();
}

/* ---------- rendering ---------- */

function charDefFor(slot: number): CharacterDef {
  return findCharacter(E.charIds[slot]);
}

function poseOf(p: number): Pose {
  const pl = E.players[p];
  if (E.phase === "levelDone" || E.phase === "gameDone") return "cheer";
  if (pl.dizzyT > 0) return "dizzy";
  if (!pl.onGround) return pl.vy < 0 ? "jump" : "fall";
  if (Math.abs(pl.vx) > 10) return "run";
  return "idle";
}

let petX = 0;
let petY = 0;
let petSeen = false;

function drawPetInWorld(time: number): void {
  if (!ctx) return;
  const petId = selectedPet();
  if (!petId) return;
  const pl = E.players[0];
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

function drawFlags(time: number): void {
  if (!ctx) return;
  const f = boil(time);
  E.checkpoints.forEach((x, i) => {
    const reached = i <= E.checkpointReached;
    sketchLine(ctx, x, 480, x, 400, 3000 + i, f, 0.6, INK, 3);
    const wave = Math.sin(time * 5 + i) * 3;
    ctx.beginPath();
    ctx.moveTo(x, 402);
    ctx.lineTo(x + 34, 412 + wave);
    ctx.lineTo(x, 424);
    ctx.closePath();
    ctx.fillStyle = reached ? "#5eaa61" : "#e04f4f";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });
}

function render(time: number): void {
  if (!ctx) return;
  const level = E.st.level;
  let scale = 1;
  let camX = E.players[0].x - W * 0.4;

  if (E.playerCount === 2 && E.phase !== "menu") {
    const a = E.players[0];
    const b = E.players[1];
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x + E.PW, b.x + E.PW);
    const span = Math.max(420, maxX - minX + 320);
    scale = Math.max(0.55, Math.min(1, W / span));
    const viewW = W / scale;
    camX = (minX + maxX) / 2 - viewW / 2;
    camX = Math.max(0, Math.min(camX, Math.max(0, level.width - viewW)));
  } else {
    camX = Math.max(0, Math.min(camX, level.width - W));
  }

  drawBackground(ctx, camX, level.width, time, level.world);

  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-Math.round(camX), -Math.round(H / scale - H));
  drawFlags(time);
  drawWorld(ctx, E.st, E.allFoodCollected());
  if (E.phase !== "menu") {
    const baseOpts = { outfit: selectedOutfit(), dance: selectedDance() };
    for (let p = 0; p < E.playerCount; p++) {
      const pl = E.players[p];
      const opts = {
        ...baseOpts,
        allergic: pl.dizzyT > 0,
        speedy: pl.energyT > 0 || pl.rushT > 0,
        slowed: pl.crashT > 0 || pl.inSyrup,
      };
      drawCharacter(ctx, charDefFor(p), pl.x + E.PW / 2, pl.y + E.PH, poseOf(p), pl.facing, time, 1.15, opts);
      if (E.playerCount === 2) {
        // little P1 / P2 tags so kids know who is who
        const f = boil(time);
        sketchRect(ctx, pl.x + E.PW / 2 - 13, pl.y - 40, 26, 16, p === 0 ? "#4a90d9" : "#e07fb0", 4000 + p, f, 0.5);
        ctx.font = 'bold 12px "Chalkboard SE", "Comic Sans MS", cursive';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`P${p + 1}`, pl.x + E.PW / 2, pl.y - 32);
      }
    }
    drawPetInWorld(time);
  }
  ctx.restore();

  // screen-space extras
  if (E.phase === "playing" && E.foodsLeft() > 0) {
    const viewLeft = camX;
    const behind = E.st.level.foods.some((fd, i) => !E.st.foodsTaken.has(i) && fd.x < viewLeft + 10);
    if (behind) drawFoodArrow(ctx, -1, time);
  }
  drawHint(ctx, E.st);
}

/* ---------- main loop ---------- */
let last = performance.now();

function loop(now: number): void {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  E.tick(dt);
  if (pickerVisible && picker) picker.tick(now / 1000);
  if (E.phase === "playing") statusSync();
  render(now / 1000);
  requestAnimationFrame(loop);
}

/* ---------- boot ---------- */

/** Homepage world-jump links use /games/food-run/?level=N */
function applyLevelQuery(): void {
  const raw = new URLSearchParams(location.search).get("level");
  if (!raw) return;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1 || n > E.TOTAL) return;
  E.saveLevel(n);
}

E.loadWallet();
applyLevelQuery();
E.startLevel(E.savedLevel() - 1); // shows the level behind the menu
E.setPhase("menu");
initInput(firstGesture, () => E.phase === "playing" || E.phase === "sugar");
setupFlow();
requestAnimationFrame(loop);

/* ---------- debug helpers (harmless in production) ---------- */
declare global {
  interface Window {
    __foodrun?: {
      setLevel: (n: number) => void;
      warp: (player: number, x: number, y: number) => void;
      eatAll: () => void;
      info: () => unknown;
    };
  }
}
window.__foodrun = {
  setLevel: (n) => {
    E.startLevel(Math.max(0, Math.min(E.TOTAL - 1, n - 1)));
    showOverlay(null);
  },
  warp: (p, x, y) => {
    const pl = E.players[p];
    pl.x = x;
    pl.y = y;
    pl.vx = 0;
    pl.vy = 0;
  },
  eatAll: () => {
    E.st.level.foods.forEach((_, i) => E.st.foodsTaken.add(i));
    hudSync();
  },
  info: () => ({
    phase: E.phase,
    level: E.levelIndex + 1,
    players: E.players.slice(0, E.playerCount).map((pl) => ({
      x: Math.round(pl.x), y: Math.round(pl.y), energy: pl.energyT, rush: pl.rushT, crash: pl.crashT, dizzy: pl.dizzyT,
    })),
    chars: [...E.charIds],
    foods: `${E.st.foodsTaken.size}/${E.st.level.foods.length}`,
    coins: E.totalCoins,
    checkpoints: E.checkpoints,
    sugar: E.st.level.sugar,
    energy: E.st.level.energy,
    best: E.st.level.best,
  }),
};
