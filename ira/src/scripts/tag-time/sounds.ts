/**
 * Tiny WebAudio blips — no audio files needed.
 * AudioContext is created lazily on the first user gesture.
 */

let ac: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ac) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
  }
  if (ac.state === "suspended") void ac.resume();
  return ac;
}

/** Unlock audio on the first tap/click (required by browsers). */
export function unlockAudio(): void {
  ctx();
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  delay = 0,
  slideTo?: number,
  vol = 0.15,
): void {
  const a = ctx();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  const t0 = a.currentTime + delay;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sounds = {
  jump: () => tone(300, 0.18, "square", 0, 520, 0.08),
  coin: () => {
    tone(880, 0.09, "square", 0, undefined, 0.1);
    tone(1320, 0.14, "square", 0.08, undefined, 0.1);
  },
  key: () => {
    tone(660, 0.1, "triangle", 0, undefined, 0.14);
    tone(880, 0.1, "triangle", 0.09);
    tone(1100, 0.18, "triangle", 0.18);
  },
  lever: () => tone(180, 0.12, "square", 0, 90, 0.12),
  door: () => {
    tone(140, 0.15, "square", 0, 90, 0.12);
    tone(500, 0.12, "triangle", 0.16);
  },
  locked: () => tone(220, 0.15, "sawtooth", 0, 160, 0.08),
  death: () => tone(400, 0.5, "sawtooth", 0, 70, 0.16),
  level: () => {
    tone(523, 0.12, "triangle", 0);
    tone(659, 0.12, "triangle", 0.12);
    tone(784, 0.12, "triangle", 0.24);
    tone(1047, 0.3, "triangle", 0.36);
  },
  win: () => {
    tone(523, 0.15, "triangle", 0);
    tone(659, 0.15, "triangle", 0.15);
    tone(784, 0.15, "triangle", 0.3);
    tone(1047, 0.15, "triangle", 0.45);
    tone(1319, 0.45, "triangle", 0.6);
  },
};
