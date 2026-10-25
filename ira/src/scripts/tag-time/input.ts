/**
 * Keyboard + touch input. Exposes a single `input` object the engine reads.
 */

export const input = {
  left: false,
  right: false,
  jump: false,
  /** consumed by the engine once per press */
  jumpQueued: false,
};

export function initInput(
  onFirstGesture: () => void,
  isPlaying: () => boolean,
): void {
  const keys = new Set<string>();

  const map = (code: string): "left" | "right" | "jump" | null => {
    switch (code) {
      case "ArrowLeft":
      case "KeyA":
        return "left";
      case "ArrowRight":
      case "KeyD":
        return "right";
      case "Space":
      case "ArrowUp":
      case "KeyW":
        return "jump";
      default:
        return null;
    }
  };

  window.addEventListener(
    "keydown",
    (e) => {
      const m = map(e.code);
      if (!m) return;
      onFirstGesture();
      if (m === "jump" && !keys.has(e.code)) input.jumpQueued = true;
      keys.add(e.code);
      input[m] = true;
      if (e.code === "Space") e.preventDefault();
    },
    { passive: false },
  );

  window.addEventListener("keyup", (e) => {
    const m = map(e.code);
    if (!m) return;
    keys.delete(e.code);
    // only clear the flag if no other key maps to the same action
    let still = false;
    for (const k of keys) if (map(k) === m) still = true;
    if (!still) input[m] = false;
  });

  // ---- touch buttons (iOS-Safari-proof: pointer events + touch fallback) ----
  const bind = (id: string, prop: "left" | "right" | "jump") => {
    const el = document.getElementById(id);
    if (!el) return;

    const down = (ev: Event) => {
      ev.preventDefault();
      try {
        onFirstGesture();
      } catch {
        /* audio unlock must never block input */
      }
      if (prop === "jump" && !input[prop]) input.jumpQueued = true;
      input[prop] = true;
    };
    const up = (ev: Event) => {
      if (ev.cancelable) ev.preventDefault();
      input[prop] = false;
    };

    // pointer events (modern browsers) — capture the pointer so sliding a
    // finger off the button doesn't release it early (fixes iOS quirks)
    el.addEventListener("pointerdown", (ev: PointerEvent) => {
      try {
        (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
      } catch {
        /* capture is best-effort */
      }
      down(ev);
    });
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);

    // touch fallback (older iOS / WebKit oddities) — passive: false so
    // preventDefault works and Safari doesn't scroll/zoom mid-jump
    el.addEventListener("touchstart", down, { passive: false });
    el.addEventListener("touchend", up, { passive: false });
    el.addEventListener("touchcancel", up, { passive: false });

    // mouse fallback for desktop clicks on the buttons
    el.addEventListener("mousedown", down);
    el.addEventListener("mouseup", up);
    el.addEventListener("contextmenu", (ev) => ev.preventDefault());
  };

  bind("btnLeft", "left");
  bind("btnRight", "right");
  bind("btnJump", "jump");

  // safety nets: release everything if the finger lifts anywhere,
  // the tab loses focus, or iOS drops events for any reason
  const releaseAll = () => {
    input.left = false;
    input.right = false;
    input.jump = false;
  };
  window.addEventListener("blur", releaseAll);
  window.addEventListener("pagehide", releaseAll);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releaseAll();
  });

  // show touch controls on coarse pointers / touch devices
  const touchy =
    window.matchMedia("(pointer: coarse)").matches ||
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0;
  if (touchy) {
    document.getElementById("touchControls")?.classList.replace("hidden", "flex");
  }

  // stop the page from scrolling while playing on touch
  document
    .getElementById("stage")
    ?.addEventListener("touchmove", (e) => {
      if (isPlaying()) e.preventDefault();
    }, { passive: false });
}
