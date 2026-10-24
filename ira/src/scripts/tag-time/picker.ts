/**
 * The character picker overlay: 4 crayon character cards.
 * Cards animate in the shared rAF loop while the picker is visible.
 */
import { CHARACTERS, drawCharacter, type CharacterDef } from "./characters";

export interface PickerHandle {
  root: HTMLElement;
  /** advance card animations; call each frame while visible */
  tick: (t: number) => void;
  /** current selection (null until picked) */
  picked: () => CharacterDef | null;
  /** pre-select a card (e.g. the saved choice) */
  select: (id: string) => void;
}

export function buildPicker(onPick: (def: CharacterDef) => void): PickerHandle {
  const root = document.getElementById("pickerOverlay");
  const row = document.getElementById("charRow");
  if (!root || !row) throw new Error("picker markup missing");

  const cards: Array<{ def: CharacterDef; cvs: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> = [];
  let choice: CharacterDef | null = null;

  for (const def of CHARACTERS) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "char-card";
    card.setAttribute("aria-label", `choose ${def.name}`);

    const cvs = document.createElement("canvas");
    cvs.width = 120;
    cvs.height = 150;
    card.appendChild(cvs);

    const name = document.createElement("div");
    name.textContent = def.name;
    name.style.cssText =
      "font-weight:700; text-align:center; font-size:1.1rem; padding-bottom:4px;";
    card.appendChild(name);

    const cctx = cvs.getContext("2d");
    if (cctx) cards.push({ def, cvs, ctx: cctx });

    card.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      choice = def;
      onPick(def);
    });

    row.appendChild(card);
  }

  return {
    root,
    picked: () => choice,
    select: (id: string) => {
      // visually pre-highlight the saved choice
      const defs = cards.map((c) => c.def);
      for (const d of defs) {
        if (d.id === id) {
          const idx = cards.findIndex((c) => c.def.id === id);
          if (idx >= 0) {
            const el = cards[idx].cvs.parentElement as HTMLElement | null;
            el?.style.setProperty("transform", "rotate(-2deg) scale(1.06)");
          }
        }
      }
    },
    tick: (t: number) => {
      for (const { cvs, ctx, def } of cards) {
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        drawCharacter(ctx, def, cvs.width / 2, cvs.height - 26, "idle", 1, t, 2.4);
      }
    },
  };
}
