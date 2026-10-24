/**
 * Crayon / hand-drawn rendering helpers.
 * Lines "boil" (re-wobble) a few times per second like a pencil sketch animation.
 */

export const INK = "#41403c";

/** Quantized time so wobble changes ~8 times per second (sketchy "boiling" look). */
export function boil(t: number): number {
  return Math.floor(t * 8);
}

/** Deterministic pseudo-random 0..1 from several numbers. */
export function hash(...ns: number[]): number {
  let h = 2166136261;
  for (const n of ns) {
    h ^= Math.imul(Math.floor(n * 1000) | 0, 374761393);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function jitter(seed: number, frame: number, i: number, amp: number): number {
  return (hash(seed, frame, i) - 0.5) * 2 * amp;
}

/** A wobbly pencil line from (x1,y1) to (x2,y2). */
export function sketchLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  seed: number, frame: number, amp = 1.6, ink = INK, width = 3,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(2, Math.floor(Math.hypot(dx, dy) / 22));
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const wob = jitter(seed, frame, i, amp);
    const px = x1 + dx * p + (dy === 0 ? wob : wob * 0.6);
    const py = y1 + dy * p + (dx === 0 ? wob : wob * 0.6);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.stroke();
}

/** A wobbly rectangle, filled and outlined like a colored pencil block. */
export function sketchRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  fill: string, seed: number, frame: number, amp = 2,
): void {
  ctx.beginPath();
  const pts: Array<[number, number]> = [
    [x, y], [x + w, y], [x + w, y + h], [x, y + h],
  ];
  for (let c = 0; c < 4; c++) {
    const [cx, cy] = pts[c];
    const [nx, ny] = pts[(c + 1) % 4];
    const steps = Math.max(1, Math.floor(Math.hypot(nx - cx, ny - cy) / 26));
    for (let i = 0; i < steps; i++) {
      const p = i / steps;
      const wob = jitter(seed, frame, c * 10 + i, amp);
      const px = cx + (nx - cx) * p + (cy === ny ? wob : wob * 0.5);
      const py = cy + (ny - cy) * p + (cx === nx ? wob : wob * 0.5);
      if (c === 0 && i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.stroke();
}

/** A wobbly circle (drawn from little line segments). */
export function sketchCircle(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  fill: string | null, seed: number, frame: number, amp = 1.4, ink = INK,
): void {
  ctx.beginPath();
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wob = jitter(seed, frame, i, amp);
    const px = cx + Math.cos(a) * (r + wob);
    const py = cy + Math.sin(a) * (r + wob);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** A hand-written-ish word using canvas text (keeps the crayon vibe with rotation). */
export function crayonText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  size: number, color: string, frame: number, seed = 7, align: CanvasTextAlign = "center",
): void {
  ctx.save();
  ctx.font = `bold ${size}px "Chalkboard SE", "Comic Sans MS", "Comic Neue", cursive`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.translate(x, y);
  ctx.rotate((hash(seed, frame, 0) - 0.5) * 0.06);
  ctx.fillText(text, jitter(seed, frame, 1, 1.5), jitter(seed, frame, 2, 1.5));
  ctx.restore();
}
