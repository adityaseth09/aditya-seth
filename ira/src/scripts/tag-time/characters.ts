/**
 * The four playable characters, drawn as crayon stick figures
 * (two of them straight from Ira's sketch: the girl with long hair
 * and the boy in a t-shirt and shorts).
 */
import { sketchCircle, sketchLine, sketchRect, boil, hash, INK } from "./draw";

export type CharKind = "girl" | "boy" | "cat" | "robot";

export interface CharacterDef {
  id: string;
  name: string;
  kind: CharKind;
  hair: string;
  clothes: string;
}

export const CHARACTERS: CharacterDef[] = [
  { id: "mia", name: "Mia", kind: "girl", hair: "#7a4a1f", clothes: "#e07fb0" },
  { id: "ziggy", name: "Ziggy", kind: "boy", hair: "#3b3a36", clothes: "#4a90d9" },
  { id: "whiskers", name: "Whiskers", kind: "cat", hair: "#ef8f4a", clothes: "#f2c14e" },
  { id: "robo", name: "Robo", kind: "robot", hair: "#9a6fd0", clothes: "#5eaa61" },
];

export type Pose = "idle" | "run" | "jump" | "fall" | "cheer";

/**
 * Draw a character. (cx, footY) is the center-bottom pivot point.
 * facing: 1 = right, -1 = left. t = seconds for animation.
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  def: CharacterDef,
  cx: number,
  footY: number,
  pose: Pose,
  facing: number,
  t: number,
  scale = 1,
): void {
  const f = boil(t);
  const seed = def.id.charCodeAt(0) * 31 + 7;
  const s = scale;
  const bodyTop = footY - 26 * s;
  const headR = 8 * s;
  const headCy = bodyTop - headR - 2 * s;

  const swing = pose === "run" ? Math.sin(t * 14) : 0;
  const bob = pose === "idle" ? Math.sin(t * 2.4) * 1.2 : 0;

  // legs
  if (pose === "jump" || pose === "cheer") {
    sketchLine(ctx, cx, bodyTop, cx - 7 * s * facing, footY - 4 * s, seed + 1, f, 1.2);
    sketchLine(ctx, cx, bodyTop, cx + 6 * s * facing, footY - 2 * s, seed + 2, f, 1.2);
  } else if (pose === "fall") {
    sketchLine(ctx, cx, bodyTop, cx - 6 * s, footY - 8 * s, seed + 1, f, 1.2);
    sketchLine(ctx, cx, bodyTop, cx + 8 * s, footY - 6 * s, seed + 2, f, 1.2);
  } else {
    sketchLine(ctx, cx, bodyTop, cx - 6 * s * facing + swing * 5 * s, footY, seed + 1, f, 1.2);
    sketchLine(ctx, cx, bodyTop, cx + 6 * s * facing - swing * 5 * s, footY, seed + 2, f, 1.2);
  }

  // body / clothes
  if (def.kind === "girl") {
    // dress: triangle from shoulders widening to hips
    ctx.beginPath();
    ctx.moveTo(cx - 3 * s, bodyTop - 16 * s);
    ctx.lineTo(cx + 3 * s, bodyTop - 16 * s);
    ctx.lineTo(cx + 10 * s, bodyTop + bob);
    ctx.lineTo(cx - 10 * s, bodyTop + bob);
    ctx.closePath();
    ctx.fillStyle = def.clothes;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (def.kind === "robot") {
    sketchRect(ctx, cx - 7 * s, bodyTop - 16 * s, 14 * s, 16 * s, def.clothes, seed + 5, f, 1.2);
  } else {
    sketchRect(ctx, cx - 7 * s, bodyTop - 16 * s, 14 * s, 10 * s, def.clothes, seed + 5, f, 1.2);
    if (def.kind === "boy") sketchRect(ctx, cx - 7 * s, bodyTop - 6 * s, 14 * s, 6 * s, def.hair === INK ? "#8bb8e8" : "#8bb8e8", seed + 6, f, 1.2);
  }

  // arms
  const armY = bodyTop - 13 * s;
  if (pose === "cheer") {
    sketchLine(ctx, cx - 5 * s, armY, cx - 11 * s, armY - 12 * s, seed + 3, f, 1.2);
    sketchLine(ctx, cx + 5 * s, armY, cx + 11 * s, armY - 12 * s, seed + 4, f, 1.2);
  } else if (pose === "run" || pose === "jump") {
    sketchLine(ctx, cx - 5 * s, armY, cx - 10 * s * facing, armY + 6 * s + swing * 3, seed + 3, f, 1.2);
    sketchLine(ctx, cx + 5 * s, armY, cx + 10 * s * facing, armY + 6 * s - swing * 3, seed + 4, f, 1.2);
  } else {
    sketchLine(ctx, cx - 5 * s, armY, cx - 8 * s, armY + 8 * s + bob, seed + 3, f, 1.2);
    sketchLine(ctx, cx + 5 * s, armY, cx + 8 * s, armY + 8 * s + bob, seed + 4, f, 1.2);
  }

  // head
  const headCx = cx + facing * 1.5 * s;
  if (def.kind === "robot") {
    sketchRect(ctx, headCx - headR, headCy - headR, headR * 2, headR * 2, "#e8e6df", seed + 8, f, 1.2);
    // antenna
    sketchLine(ctx, headCx, headCy - headR, headCx + 3 * s, headCy - headR - 7 * s, seed + 9, f, 1);
    sketchCircle(ctx, headCx + 3 * s, headCy - headR - 9 * s, 2.5 * s, def.hair, seed + 10, f, 0.8);
  } else {
    sketchCircle(ctx, headCx, headCy, headR, "#fde7d0", seed + 8, f, 1);
    if (def.kind === "cat") {
      // ears
      sketchLine(ctx, headCx - headR * 0.8, headCy - headR * 0.7, headCx - headR * 0.9, headCy - headR * 1.7, seed + 11, f, 0.8, def.hair, 3);
      sketchLine(ctx, headCx - headR * 0.9, headCy - headR * 1.7, headCx + 0.5 * s, headCy - headR * 1.05, seed + 12, f, 0.8, def.hair, 3);
      sketchLine(ctx, headCx + headR * 0.8, headCy - headR * 0.7, headCx + headR * 0.9, headCy - headR * 1.7, seed + 13, f, 0.8, def.hair, 3);
      sketchLine(ctx, headCx + headR * 0.9, headCy - headR * 1.7, headCx - 0.5 * s, headCy - headR * 1.05, seed + 14, f, 0.8, def.hair, 3);
      // whiskers
      sketchLine(ctx, headCx + facing * headR * 0.9, headCy - 2 * s, headCx + facing * (headR + 8 * s), headCy - 4 * s, seed + 15, f, 0.7, INK, 1.5);
      sketchLine(ctx, headCx + facing * headR * 0.9, headCy, headCx + facing * (headR + 9 * s), headCy + 1 * s, seed + 16, f, 0.7, INK, 1.5);
    }
    // hair
    if (def.kind === "girl") {
      // long hair: cap + strands on both sides
      sketchLine(ctx, headCx - headR, headCy, headCx - headR - 2 * s, headCy + 16 * s, seed + 17, f, 1.2, def.hair, 5);
      sketchLine(ctx, headCx + headR, headCy, headCx + headR + 2 * s, headCy + 16 * s, seed + 18, f, 1.2, def.hair, 5);
      ctx.beginPath();
      ctx.arc(headCx, headCy - 1 * s, headR + 1.5 * s, Math.PI * 1.05, Math.PI * 1.95);
      ctx.strokeStyle = def.hair;
      ctx.lineWidth = 5;
      ctx.stroke();
    } else if (def.kind === "boy") {
      ctx.beginPath();
      ctx.arc(headCx, headCy - 1 * s, headR + 1.5 * s, Math.PI * 1.08, Math.PI * 1.92);
      ctx.strokeStyle = def.hair;
      ctx.lineWidth = 5;
      ctx.stroke();
    } else if (def.kind === "cat") {
      // tail
      const tailWag = Math.sin(t * 5) * 6 * s;
      sketchLine(ctx, cx - 9 * s * facing, bodyTop - 2 * s, cx - 16 * s * facing, bodyTop - 10 * s + tailWag, seed + 19, f, 1.2, def.hair, 4);
    }
    // face: eyes + smile
    const eyeDx = 2.8 * s * facing;
    sketchCircle(ctx, headCx - eyeDx, headCy - 1.5 * s, 1.4 * s, INK, seed + 20, f, 0.4);
    sketchCircle(ctx, headCx + eyeDx, headCy - 1.5 * s, 1.4 * s, INK, seed + 21, f, 0.4);
    ctx.beginPath();
    ctx.arc(headCx, headCy + 2.5 * s, 3.5 * s, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // name tag under preview figures only (used by the picker)
  if (pose === "idle" && scale > 1.5) {
    // no-op: names are rendered in HTML by the picker
  }
}
