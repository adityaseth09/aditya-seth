/**
 * Per-player input. In 1-player mode both keyboard sets and the single touch
 * cluster drive player 1. In 2-player mode: P1 = WASD + Space (left touch
 * cluster), P2 = arrow keys (right touch cluster).
 */

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpQueued: boolean;
}

export const inputs: InputState[] = [
  { left: false, right: false, jump: false, jumpQueued: false },
  { left: false, right: false, jump: false, jumpQueued: false },
];

/** How many players are active right now (read by the key mapper). */
let playerCount = 1;

export function setPlayerCount(n: number): void {
  playerCount = Math.max(1, Math.min(2, n));
  releaseAll();
}

interface Action {
  player: number; // 0-based; -1 means "P1 in solo, split in duo"
  act: "left" | "right" | "jump";
  soloPlayer?: number; // in 1-player mode this key maps to this player
}

const KEYMAP: Record<string, Action> = {
  // player 1 keys
  KeyA: { player: 0, act: "left", soloPlayer: 0 },
  KeyD: { player: 0, act: "right", soloPlayer: 0 },
  KeyW: { player: 0, act: "jump", soloPlayer: 0 },
  Space: { player: 0, act: "jump", soloPlayer: 0 },
  // player 2 keys (in solo mode these also drive player 1, like before)
  ArrowLeft: { player: 1, act: "left", soloPlayer: 0 },
  ArrowRight: { player: 1, act: "right", soloPlayer: 0 },
  ArrowUp: { player: 1, act: "jump", soloPlayer: 0 },
};

export function initInput(
  onFirstGesture: () => void,
  isPlaying: () => boolean,
): void {
  const keys = new Set<string>();

  const resolve = (code: string): { p: number; act: "left" | "right" | "jump" } | null => {
    const a = KEYMAP[code];
    if (!a) return null;
    if (playerCount === 1) {
      return { p: a.soloPlayer ?? 0, act: a.act };
    }
    // duo mode: arrows are P2's; WASD/Space are P1's.
    // If P2 presses arrows, player 1. If P1 presses arrows in duo... they're P2's.
    return { p: a.player, act: a.act };
  };

  window.addEventListener(
    "keydown",
    (e) => {
      const r = resolve(e.code);
      if (!r) return;
      onFirstGesture();
      const inp = inputs[r.p];
      if (r.act === "jump" && !keys.has(e.code)) inp.jumpQueued = true;
      keys.add(e.code);
      inp[r.act] = true;
      if (e.code === "Space") e.preventDefault();
    },
    { passive: false },
  );

  window.addEventListener("keyup", (e) => {
    const r = resolve(e.code);
    if (!r) return;
    keys.delete(e.code);
    let still = false;
    for (const k of keys) {
      const other = resolve(k);
      if (other && other.p === r.p && other.act === r.act) still = true;
    }
    if (!still) inputs[r.p][r.act] = false;
  });

  // ---- touch buttons (iOS-Safari-proof: pointer events + touch fallback) ----
  const bind = (id: string, player: number, act: "left" | "right" | "jump") => {
    const el = document.getElementById(id);
    if (!el) return;

    const down = (ev: Event) => {
      ev.preventDefault();
      try {
        onFirstGesture();
      } catch {
        /* audio unlock must never block input */
      }
      const inp = inputs[player];
      if (act === "jump" && !inp.jump) inp.jumpQueued = true;
      inp[act] = true;
    };
    const up = (ev: Event) => {
      if (ev.cancelable) ev.preventDefault();
      inputs[player][act] = false;
    };

    el.addEventListener("pointerdown", (ev: PointerEvent) => {
      try {
        (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
      } catch {
        /* best-effort */
      }
      down(ev);
    });
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("touchstart", down, { passive: false });
    el.addEventListener("touchend", up, { passive: false });
    el.addEventListener("touchcancel", up, { passive: false });
    el.addEventListener("mousedown", down);
    el.addEventListener("mouseup", up);
    el.addEventListener("contextmenu", (ev) => ev.preventDefault());
  };

  // P1 cluster (left side) — in solo mode this is the only cluster shown
  bind("btnLeft1", 0, "left");
  bind("btnRight1", 0, "right");
  bind("btnJump1", 0, "jump");
  // P2 cluster (right side) — only shown in duo mode
  bind("btnLeft2", 1, "left");
  bind("btnRight2", 1, "right");
  bind("btnJump2", 1, "jump");

  const touchy =
    window.matchMedia("(pointer: coarse)").matches ||
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0;
  if (touchy) {
    document.getElementById("touchControls")?.classList.replace("hidden", "flex");
  }

  const releaseAll = () => {
    for (const inp of inputs) {
      inp.left = false;
      inp.right = false;
      inp.jump = false;
    }
  };
  window.addEventListener("blur", releaseAll);
  window.addEventListener("pagehide", releaseAll);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseAll();
  });

  // stop the page from scrolling while playing on touch
  document
    .getElementById("stage")
    ?.addEventListener("touchmove", (e) => {
      if (isPlaying()) e.preventDefault();
    }, { passive: false });
}

function releaseAll(): void {
  for (const inp of inputs) {
    inp.left = false;
    inp.right = false;
    inp.jump = false;
  }
}
