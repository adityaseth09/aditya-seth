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

  // ---- touch buttons ----
  const bind = (id: string, prop: "left" | "right" | "jump") => {
    const el = document.getElementById(id);
    if (!el) return;
    const down = (ev: PointerEvent) => {
      ev.preventDefault();
      onFirstGesture();
      if (prop === "jump") input.jumpQueued = true;
      input[prop] = true;
    };
    const up = (ev: PointerEvent) => {
      ev.preventDefault();
      input[prop] = false;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", up);
    el.addEventListener("contextmenu", (ev) => ev.preventDefault());
  };

  bind("btnLeft", "left");
  bind("btnRight", "right");
  bind("btnJump", "jump");

  // show touch controls on coarse pointers / touch devices
  const touchy =
    window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
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
