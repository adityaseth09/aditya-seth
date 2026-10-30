/**
 * The character picker overlay: crayon character cards.
 * Supports Ira's 2-player flow: "Player 1 — pick!", then "Player 2 — pick!"
 * (P2 can't choose the same character as P1).
 */
import { CHARACTERS, drawCharacter, type CharacterDef } from "./characters";

export interface PickerHandle {
  root: HTMLElement;
  /** advance card animations; call each frame while visible */
  tick: (t: number) => void;
  /** pre-highlight a card (e.g. the saved choice) */
  highlight: (id: string | null) => void;
  /** change the prompt text ("Player 1 — pick your character!") */
  setPrompt: (text: string) => void;
  /** gray out a card (P2 can't reuse P1's character) */
  exclude: (id: string) => void;
  /** re-enable all cards */
  enableAll: () => void;
}

export function buildPicker(onPick: (def: CharacterDef) => void): PickerHandle {
  const root = document.getElementById("pickerOverlay");
  const row = document.getElementById("charRow");
  if (!root || !row) throw new Error("picker markup missing");

  interface Card {
    def: CharacterDef;
    cvs: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    el: HTMLButtonElement;
    disabled: boolean;
  }
  const cards: Card[] = [];

  for (const def of CHARACTERS) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "char-card";
    el.setAttribute("aria-label", `choose ${def.name}`);

    const cvs = document.createElement("canvas");
    cvs.width = 120;
    cvs.height = 150;
    el.appendChild(cvs);

    const name = document.createElement("div");
    name.textContent = def.name;
    name.style.cssText =
      "font-weight:700; text-align:center; font-size:1.1rem; padding-bottom:4px;";
    el.appendChild(name);

    const cctx = cvs.getContext("2d");
    const card: Card = { def, cvs, ctx: cctx!, el, disabled: false };
    if (cctx) cards.push(card);

    el.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      if (card.disabled) return;
      onPick(def);
    });
    el.addEventListener("touchstart", (ev) => {
      ev.preventDefault();
      if (card.disabled) return;
      onPick(def);
    }, { passive: false });

    row.appendChild(el);
  }

  return {
    root,
    tick: (t: number) => {
      for (const { cvs, ctx, def } of cards) {
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        ctx.globalAlpha = 1;
        drawCharacter(ctx, def, cvs.width / 2, cvs.height - 26, "idle", 1, t, 2.4);
      }
    },
    highlight: (id: string | null) => {
      const normalized = id === "whiskers" ? "stella" : id;
      for (const c of cards) {
        c.el.style.removeProperty("transform");
        if (normalized && c.def.id === normalized) {
          c.el.style.transform = "rotate(-2deg) scale(1.06)";
        }
      }
    },
    setPrompt: (text: string) => {
      const p = document.getElementById("pickPrompt");
      if (p) p.textContent = text;
    },
    exclude: (id: string) => {
      for (const c of cards) {
        if (c.def.id === id) {
          c.disabled = true;
          c.el.style.opacity = "0.35";
          c.el.style.transform = "none";
        }
      }
    },
    enableAll: () => {
      for (const c of cards) {
        c.disabled = false;
        c.el.style.opacity = "";
        c.el.style.removeProperty("transform");
      }
    },
  };
}
