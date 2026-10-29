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

export interface CharOptions {
  /** equipped outfit id (cape | crown | party | bowtie) */
  outfit?: string | null;
  /** selected dance id for the level-clear celebration (twirl | wiggle | stars) */
  dance?: string | null;
}

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
  opts: CharOptions = {},
): void {
  const f = boil(t);
  const seed = def.id.charCodeAt(0) * 31 + 7;
  const s = scale;

  // celebration dance transforms (wrap the whole drawing)
  if (pose === "cheer" && opts.dance) {
    ctx.save();
    if (opts.dance === "twirl") {
      ctx.translate(cx, footY);
      ctx.rotate(t * 5);
      ctx.translate(-cx, -footY);
    } else if (opts.dance === "wiggle") {
      ctx.translate(Math.sin(t * 10) * 8, 0);
      ctx.rotate(Math.sin(t * 10) * 0.08);
    } else if (opts.dance === "stars") {
      ctx.translate(0, -Math.abs(Math.sin(t * 5)) * 36);
    } else if (opts.dance === "moonwalk") {
      // glide smoothly backwards with a cool lean
      ctx.translate(-Math.sin(t * 2.5) * 26, 0);
      ctx.rotate(0.1);
    } else if (opts.dance === "robot") {
      // snap between poses a few times a second, like a robot
      const step = Math.floor(t * 4) % 4;
      ctx.translate(step === 1 || step === 3 ? 10 : -6, step === 2 ? -6 : 0);
      ctx.rotate(step === 1 ? 0.12 : step === 3 ? -0.12 : 0);
    } else if (opts.dance === "backflip") {
      // a full flip around the middle of the body
      ctx.translate(cx, footY - 20 * s);
      ctx.rotate(t * 7);
      ctx.translate(-cx, -(footY - 20 * s));
    }
  }

  const bodyTop = footY - 26 * s;

  // cape (worn behind everything, waving in the wind)
  if (opts.outfit === "cape") {
    const shoulderY = bodyTop - 14 * s;
    const wave = Math.sin(t * 6) * 4 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 4 * s * facing, shoulderY);
    ctx.lineTo(cx - 18 * s * facing + wave, shoulderY + 22 * s + wave);
    ctx.lineTo(cx - 2 * s * facing, shoulderY + 20 * s);
    ctx.closePath();
    ctx.fillStyle = "#e04f4f";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // flutter wings (behind everything, flapping faster when you move)
  if (opts.outfit === "wings") {
    const shoulderY = bodyTop - 15 * s;
    const flapSpeed = pose === "run" || pose === "jump" ? 14 : 5;
    const flap = Math.sin(t * flapSpeed) * 0.5;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(cx - 2 * s * facing, shoulderY);
      ctx.rotate(side * (0.5 + flap) * (facing === 1 ? 1 : -1));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-14 * s * side, -12 * s, -20 * s * side, 2 * s);
      ctx.quadraticCurveTo(-12 * s * side, 4 * s, 0, 8 * s);
      ctx.closePath();
      ctx.fillStyle = side === 1 ? "#f2c14e" : "#efb53e";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }
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

  // hats & accessories (drawn on top)
  const headTop = headCy - headR - 2 * s;
  if (opts.outfit === "crown") {    ctx.beginPath();
    const cy0 = headTop - 1;
    ctx.moveTo(cx - 7 * s, cy0);
    ctx.lineTo(cx - 7 * s, cy0 - 7 * s);
    ctx.lineTo(cx - 3.5 * s, cy0 - 3 * s);
    ctx.lineTo(cx, cy0 - 8 * s);
    ctx.lineTo(cx + 3.5 * s, cy0 - 3 * s);
    ctx.lineTo(cx + 7 * s, cy0 - 7 * s);
    ctx.lineTo(cx + 7 * s, cy0);
    ctx.closePath();
    ctx.fillStyle = "#f2c14e";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (opts.outfit === "party") {
    ctx.beginPath();
    ctx.moveTo(cx - 6 * s, headTop);
    ctx.lineTo(cx + Math.sin(t * 3) * 2 * s, headTop - 14 * s);
    ctx.lineTo(cx + 6 * s, headTop);
    ctx.closePath();
    ctx.fillStyle = "#e07fb0";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    sketchCircle(ctx, cx + Math.sin(t * 3) * 2 * s, headTop - 15 * s, 2.5 * s, "#4a90d9", seed + 30, f, 0.6);
  } else if (opts.outfit === "bowtie") {
    const by = bodyTop - 15 * s;
    ctx.beginPath();
    ctx.moveTo(cx, by);
    ctx.lineTo(cx - 6 * s, by - 3 * s);
    ctx.lineTo(cx - 6 * s, by + 3 * s);
    ctx.closePath();
    ctx.moveTo(cx, by);
    ctx.lineTo(cx + 6 * s, by - 3 * s);
    ctx.lineTo(cx + 6 * s, by + 3 * s);
    ctx.closePath();
    ctx.fillStyle = "#4a90d9";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    sketchCircle(ctx, cx, by, 1.6 * s, "#f2c14e", seed + 31, f, 0.4);
  }

  // space helmet: a see-through bubble around the head
  if (opts.outfit === "helmet") {
    sketchCircle(ctx, headCx, headCy, headR + 5 * s, "rgba(160,210,240,0.35)", seed + 40, f, 1.2, "rgba(74,144,217,0.8)");
    // shine highlight
    sketchLine(ctx, headCx - headR - 2 * s, headCy - 5 * s, headCx - headR + 2 * s, headCy - 8 * s, seed + 41, f, 0.8, "#ffffff", 3);
  }

  // cool sunglasses: a band across the eyes
  if (opts.outfit === "shades") {
    const gy = headCy - 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(headCx - 6 * s, gy - 3 * s);
    ctx.lineTo(headCx + 7 * s, gy - 3 * s);
    ctx.lineTo(headCx + 7 * s, gy + 2 * s);
    ctx.lineTo(headCx - 6 * s, gy + 2 * s);
    ctx.closePath();
    ctx.fillStyle = "#41403c";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    sketchLine(ctx, headCx + 7 * s, gy - 1 * s, headCx + headR + 2 * s, gy - 3 * s, seed + 42, f, 0.6, INK, 1.5);
  }

  // rainbow socks: striped bands at the ankles
  if (opts.outfit === "socks") {
    const sockY = footY - 5 * s;
    const colors = ["#e04f4f", "#f2c14e", "#5eaa61", "#4a90d9", "#9a6fd0"];
    for (let lx = -1; lx <= 1; lx += 2) {
      for (let r = 0; r < 5; r++) {
        ctx.fillStyle = colors[r];
        ctx.fillRect(cx + (lx === -1 ? -8 * s : 3 * s), sockY + r * 2 * s * 1.2, 5 * s, 2.4 * s);
      }
    }
  }

  // close the dance transform
  if (pose === "cheer" && opts.dance) {
    ctx.restore();
  }
}

/* ---------- pet sidekicks (bought in the shop, follow you around) ---------- */

/**
 * Draw a pet sidekick. (cx, footY) is the center-bottom pivot point,
 * same convention as drawCharacter. Purely cosmetic.
 */
export function drawPet(
  ctx: CanvasRenderingContext2D,
  petId: string,
  cx: number,
  footY: number,
  t: number,
  scale = 1,
): void {
  const f = boil(t);
  const s = scale;
  if (petId === "petStar") drawStarPet(ctx, cx, footY, t, f, s);
  else if (petId === "petAlien") drawAlienPet(ctx, cx, footY, t, f, s);
}

/** Twinkle the Star: a bobbing golden star with a happy face. */
function drawStarPet(
  ctx: CanvasRenderingContext2D, cx: number, footY: number, t: number, f: number, s: number,
): void {
  const bob = Math.sin(t * 4) * 5 * s;
  const cy = footY - 14 * s + bob;
  const spin = Math.sin(t * 2) * 0.15;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(spin);
  // five-point star
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = (i % 2 === 0 ? 11 : 5) * s;
    const wob = (hash(i + 3, f) - 0.5) * 2;
    const px = Math.cos(a) * (rr + wob) * s;
    const py = Math.sin(a) * (rr + wob) * s;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#f2c14e";
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // happy face
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(-2.5 * s, -1 * s, 1.2 * s, 0, Math.PI * 2);
  ctx.arc(2.5 * s, -1 * s, 1.2 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 1.5 * s, 2 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  // little sparkle trail
  const sp = (t * 2) % 1;
  sketchCircle(ctx, cx - 12 * s - sp * 10 * s, cy + 6 * s - sp * 8 * s, 1.8 * (1 - sp), "#f2c14e", 77, f, 0.5);
}

/** Zorp the Alien: a green wobbling alien with antennae. */
function drawAlienPet(
  ctx: CanvasRenderingContext2D, cx: number, footY: number, t: number, f: number, s: number,
): void {
  const wobble = Math.sin(t * 6) * 2 * s;
  const bodyY = footY - 10 * s;
  // little feet
  const step = Math.sin(t * 8) * 3 * s;
  sketchLine(ctx, cx - 4 * s, bodyY, cx - 5 * s + step, footY, 81, f, 1, INK, 3);
  sketchLine(ctx, cx + 4 * s, bodyY, cx + 5 * s - step, footY, 82, f, 1, INK, 3);
  // squishy body
  sketchCircle(ctx, cx + wobble * 0.5, bodyY - 8 * s, 8 * s, "#8ed16f", 83, f, 1.4);
  // antennae
  const atip = Math.sin(t * 5) * 2 * s;
  sketchLine(ctx, cx - 3 * s, bodyY - 14 * s, cx - 6 * s, bodyY - 20 * s + atip, 84, f, 0.8, INK, 2);
  sketchLine(ctx, cx + 3 * s, bodyY - 14 * s, cx + 6 * s, bodyY - 20 * s - atip, 85, f, 0.8, INK, 2);
  sketchCircle(ctx, cx - 6 * s, bodyY - 21 * s + atip, 1.6 * s, "#e07fb0", 86, f, 0.4);
  sketchCircle(ctx, cx + 6 * s, bodyY - 21 * s - atip, 1.6 * s, "#e07fb0", 87, f, 0.4);
  // happy face
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx - 2.5 * s + wobble * 0.5, bodyY - 9 * s, 1.1 * s, 0, Math.PI * 2);
  ctx.arc(cx + 2.5 * s + wobble * 0.5, bodyY - 9 * s, 1.1 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + wobble * 0.5, bodyY - 7 * s, 2.2 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
