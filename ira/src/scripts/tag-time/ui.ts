/**
 * DOM overlay + HUD helpers. No engine imports (avoids circular deps).
 */

export type OverlayId = "picker" | "start" | "death" | "level" | "win" | "mode";

const overlays: Record<OverlayId, HTMLElement | null> = {
  picker: null,
  start: null,
  death: null,
  level: null,
  win: null,
  mode: null,
};

export function initUI(): void {
  for (const id of Object.keys(overlays) as OverlayId[]) {
    overlays[id] = document.getElementById(id === "mode" ? "startOverlay" : `${id}Overlay`);
  }
}

export function showOverlay(id: OverlayId | null): void {
  // "mode" and "start" share the same overlay element; showing one hides the other
  const target = id === null ? null : id === "mode" || id === "start" ? overlays.start : overlays[id];
  for (const [k, el] of Object.entries(overlays)) {
    const el2 = k === "mode" || k === "start" ? overlays.start : el;
    el2?.classList.toggle("hidden", el2 !== target);
  }
}

const hud = {
  level: null as HTMLElement | null,
  coins: null as HTMLElement | null,
  key1: null as HTMLElement | null,
  key2: null as HTMLElement | null,
};

export interface HudData {
  levelNo: number;
  levelName: string;
  coins: number;
  keys: number[];
}

export function updateHUD(d: HudData): void {
  if (!hud.level) {
    hud.level = document.getElementById("hudLevel");
    hud.coins = document.getElementById("hudCoins");
    hud.key1 = document.getElementById("hudKey1");
    hud.key2 = document.getElementById("hudKey2");
  }
  if (hud.level) hud.level.textContent = `Level ${d.levelNo}: ${d.levelName}`;
  if (hud.coins) hud.coins.textContent = `coins: ${d.coins}`;
  const has1 = d.keys.includes(1);
  const has2 = d.keys.includes(2);
  hud.key1?.classList.toggle("opacity-30", !has1);
  hud.key1?.classList.toggle("grayscale", !has1);
  hud.key2?.classList.toggle("opacity-30", !has2);
  hud.key2?.classList.toggle("grayscale", !has2);
}

export function setDeathMessage(cause: string): void {
  const msg = document.getElementById("deathMsg");
  if (!msg) return;
  msg.textContent =
    cause === "lava"
      ? "You fell in the lava! 🔥"
      : cause === "spikes"
        ? "Ouch! The spikes! 💥"
        : cause === "beast"
          ? "A beast got you! 👹"
          : cause === "bird"
            ? "A bird got you! 🦅"
            : cause === "wind"
              ? "The gust blew you away! 💨"
              : cause === "rain"
                ? "The raindrop soaked you! ☔"
                : cause === "fire"
                  ? "The fire flame got you! 🔥"
                  : "Whoops, you fell! 😵";
}
