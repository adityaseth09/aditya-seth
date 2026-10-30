/**
 * Clam Collector page: menus, swimming input, shop, and the draw loop.
 */
import { findCharacter, type CharacterDef } from "../tag-time/characters";
import { buildPicker, type PickerHandle } from "../tag-time/picker";
import { buildShop, type ShopHandle } from "../tag-time/shop";
import { unlockAudio, startMusic, setMusic, musicPref, isMusicOn } from "../tag-time/sounds";
import * as E from "./engine";
import { drawWorld } from "./render";

const LS_CHAR = "clamCollector:char";
const LS_CHAR2 = "clamCollector:char2";

type OverlayId = "start" | "picker" | "shop" | "death" | "level" | "win";

const $ = (id: string) => document.getElementById(id);

function showOverlay(id: OverlayId | null): void {
  for (const name of ["start", "picker", "shop", "death", "level", "win"] as OverlayId[]) {
    const el = $(name + "Overlay");
    if (!el) continue;
    const on = name === id;
    el.classList.toggle("hidden", !on);
    el.classList.toggle("flex", on);
  }
  const touch = $("touchControls");
  if (touch) touch.style.visibility = id === null || id === "death" ? "visible" : "hidden";
}

function toggleFlex(id: string, on: boolean): void {
  const el = $(id);
  el?.classList.toggle("hidden", !on);
  el?.classList.toggle("flex", on);
}

function updateHud(): void {
  const lv = E.currentLevel();
  const levelEl = $("hudLevel");
  const keysEl = $("hudKeys");
  const coinsEl = $("hudCoins");
  if (levelEl) levelEl.textContent = `🐚 Level ${E.levelIndex + 1}: ${lv.name}`;
  if (keysEl) keysEl.textContent = `🔑 ${lv.keys.length - E.keysLeft()}/${lv.keys.length}`;
  if (coinsEl) coinsEl.textContent = `🪙 ${E.totalCoins}`;
}

const DEATH_COPY: Record<E.DeathCause, string> = {
  coral: "the coral stuck on! swim it again from the start.",
  fish: "a fish bumped you! back to the start.",
  jelly: "the jelly stung you! back to the start.",
  eel: "the eel got you! back to the start.",
};

E.hooks.hud = updateHud;
E.hooks.death = () => {
  const msg = $("deathMsg");
  if (msg) msg.textContent = DEATH_COPY[E.deathCause];
  showOverlay("death");
};
E.hooks.levelDone = () => {
  const stats = $("levelStats");
  const lv = E.currentLevel();
  if (stats) stats.textContent = `${lv.keys.length} keys + the pearl! +${lv.keys.length + 2} coins`;
  showOverlay("level");
};
E.hooks.gameDone = () => {
  const stats = $("winStats");
  if (stats) stats.textContent = `you have ${E.totalCoins} coins 🪙`;
  showOverlay("win");
};

let picker: PickerHandle | null = null;
let shop: ShopHandle | null = null;
let pickingPlayer = 0;
let last = performance.now();

interface Held {
  x: number;
  y: number;
}
const held: Held[] = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];

function firstGesture(): void {
  unlockAudio();
  if (musicPref()) startMusic();
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
  picker?.setPrompt("Player 1 — pick your octopus!");
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
      picker?.setPrompt("Player 2 — pick your octopus!");
      picker?.highlight(localStorage.getItem(LS_CHAR2));
      return;
    }
  } else {
    localStorage.setItem(LS_CHAR2, def.id);
  }
  const title = $("startTitle");
  if (title) {
    const names = E.charIds.filter(Boolean).map((id) => findCharacter(id).name);
    title.textContent = names.join(" & ") + " — ready to swim?";
  }
  toggleFlex("modeSection", false);
  toggleFlex("goSection", true);
  showOverlay("start");
}

function go(): void {
  firstGesture();
  const q = new URLSearchParams(location.search).get("level");
  const fromQuery = q ? parseInt(q, 10) : NaN;
  const start = Number.isFinite(fromQuery) ? fromQuery : E.savedLevel();
  E.startLevel(start - 1);
  showOverlay(null);
}

function bindHold(id: string, player: number, axis: "x" | "y", sign: number): void {
  const el = $(id);
  if (!el) return;
  const down = (ev: Event) => {
    ev.preventDefault();
    held[player][axis] = sign;
  };
  const up = (ev: Event) => {
    ev.preventDefault();
    if (held[player][axis] === sign) held[player][axis] = 0;
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointerleave", up);
  el.addEventListener("pointercancel", up);
}

function boot(): void {
  E.loadWallet();
  updateHud();
  const canvas = $("game") as HTMLCanvasElement | null;
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;

  picker = buildPicker(onPick);
  shop = buildShop(() => E.totalCoins, (n) => E.spendCoins(n), updateHud);

  $("btn1P")?.addEventListener("click", () => {
    E.setPlayerCount(1);
    $("touchClusterP2")?.classList.add("hidden");
    beginPicks();
  });
  $("btn2P")?.addEventListener("click", () => {
    E.setPlayerCount(2);
    $("touchClusterP2")?.classList.remove("hidden");
    beginPicks();
  });
  $("goBtn")?.addEventListener("click", go);
  $("goSection")?.addEventListener("click", go);
  $("againDeath")?.addEventListener("click", () => {
    E.startLevel(E.levelIndex);
    showOverlay(null);
  });
  $("nextBtn")?.addEventListener("click", () => {
    E.startLevel(E.levelIndex + 1);
    showOverlay(null);
  });
  $("againBtn")?.addEventListener("click", () => {
    E.saveLevel(1);
    E.startLevel(0);
    showOverlay(null);
  });

  for (const id of ["btnShopMode", "btnShopGo"]) {
    $(id)?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      shop?.open();
      showOverlay("shop");
    });
  }
  $("shopBack")?.addEventListener("click", () => {
    shop?.close();
    showOverlay("start");
  });
  $("btnMusic")?.addEventListener("click", () => {
    const nowOn = !isMusicOn();
    setMusic(nowOn);
    const btn = $("btnMusic");
    if (btn) btn.textContent = nowOn ? "🔊" : "🔇";
    if (nowOn) startMusic();
  });
  if (!musicPref()) {
    const btn = $("btnMusic");
    if (btn) btn.textContent = "🔇";
  }

  bindHold("btnLeft1", 0, "x", -1);
  bindHold("btnRight1", 0, "x", 1);
  bindHold("btnUp1", 0, "y", -1);
  bindHold("btnDown1", 0, "y", 1);
  bindHold("btnLeft2", 1, "x", -1);
  bindHold("btnRight2", 1, "x", 1);
  bindHold("btnUp2", 1, "y", -1);
  bindHold("btnDown2", 1, "y", 1);

  const keys = new Set<string>();
  window.addEventListener("keydown", (ev) => {
    keys.add(ev.key.toLowerCase());
    if (ev.key === " " || ev.key.startsWith("Arrow")) ev.preventDefault();
  });
  window.addEventListener("keyup", (ev) => keys.delete(ev.key.toLowerCase()));

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (coarse) $("touchControls")?.classList.replace("hidden", "flex");

  showModeSelect();

  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    if (! $("pickerOverlay")?.classList.contains("hidden")) picker?.tick(t);

    const dirs = [dirFrom(keys, 0), dirFrom(keys, 1)];
    E.tick(dt, dirs);

    const cam = camera();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, E.W, E.H);
    if (E.phase === "menu") {
      ctx.fillStyle = "#d7f6ff";
      ctx.fillRect(0, 0, E.W, E.H);
    } else {
      drawWorld(ctx, cam.x, cam.y, cam.zoom);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const debug = {
    setLevel: (n: number) => E.startLevel(n - 1),
    warp: (x: number, y: number) => {
      const p = E.players[0];
      if (p) {
        p.x = x;
        p.y = y;
        p.vx = 0;
        p.vy = 0;
      }
    },
    info: () => ({
      level: E.levelIndex + 1,
      phase: E.phase,
      keys: E.keysLeft(),
      coins: E.totalCoins,
      x: Math.round(E.players[0]?.x ?? 0),
      y: Math.round(E.players[0]?.y ?? 0),
    }),
  };
  (window as unknown as { __clam: typeof debug }).__clam = debug;
}

function dirFrom(keys: Set<string>, player: number): E.Dir {
  let x = held[player].x;
  let y = held[player].y;
  if (player === 0) {
    if (keys.has("a") || (E.playerCount === 1 && keys.has("arrowleft"))) x = -1;
    if (keys.has("d") || (E.playerCount === 1 && keys.has("arrowright"))) x = 1;
    if (keys.has("w") || (E.playerCount === 1 && keys.has("arrowup"))) y = -1;
    if (keys.has("s") || (E.playerCount === 1 && keys.has("arrowdown"))) y = 1;
  } else {
    if (keys.has("arrowleft")) x = -1;
    if (keys.has("arrowright")) x = 1;
    if (keys.has("arrowup")) y = -1;
    if (keys.has("arrowdown")) y = 1;
  }
  if (x !== 0 && y !== 0) {
    const s = Math.SQRT1_2;
    return { x: x * s, y: y * s };
  }
  return { x, y };
}

function camera(): { x: number; y: number; zoom: number } {
  const lv = E.currentLevel();
  if (E.players.length === 0) return { x: E.W / 2, y: E.H / 2, zoom: 1 };
  let minX = Infinity;
  let maxX = -Infinity;
  let sx = 0;
  for (const p of E.players) {
    sx += p.x;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
  }
  const zoom = E.players.length === 2 ? Math.min(1, 700 / (maxX - minX + 220)) : 1;
  const viewW = E.W / zoom;
  let x = sx / E.players.length;
  x = Math.max(viewW / 2, Math.min(lv.width - viewW / 2, x));
  return { x, y: E.H / 2, zoom };
}

boot();
