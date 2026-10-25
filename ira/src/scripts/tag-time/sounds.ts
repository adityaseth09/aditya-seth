/**
 * Tiny WebAudio blips — no audio files needed.
 * AudioContext is created lazily on the first user gesture.
 */

let ac: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ac) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state === "suspended") void ac.resume().catch(() => {});
    return ac;
  } catch {
    // audio must NEVER break gameplay (some iOS modes refuse AudioContext)
    return null;
  }
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
  stomp: () => {
    tone(300, 0.08, "square", 0, 120, 0.12);
    tone(600, 0.1, "triangle", 0.08, undefined, 0.1);
  },
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

/* ---------------- background music ---------------- */

/** Note at an absolute AudioContext time (used by the music sequencer). */
function noteAt(freq: number, start: number, dur: number, type: OscillatorType, vol: number): void {
  const a = ctx();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(vol, start + 0.02);
  gain.gain.setValueAtTime(vol, start + dur * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

// gentle pentatonic tune (C major), 64 steps, 0.24s per step
const N = {
  C3: 130.81, A2: 110.0, F3: 174.61, G3: 196.0,
  A4: 440.0, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0, C6: 1046.5,
};
const MELODY: number[] = [
  N.E5, 0, N.G5, 0, N.A5, 0, N.G5, 0,
  N.E5, 0, N.D5, 0, N.C5, 0, N.D5, 0,
  N.E5, 0, N.G5, 0, N.A5, 0, N.C6, 0,
  N.A5, 0, N.G5, 0, N.E5, 0, 0, 0,
  N.G5, 0, N.E5, 0, N.D5, 0, N.E5, 0,
  N.C5, 0, N.D5, 0, N.E5, 0, N.G5, 0,
  N.A4, 0, N.C5, 0, N.D5, 0, N.E5, 0,
  N.D5, 0, N.C5, 0, 0, 0, 0, 0,
];
const BASS: number[] = [
  N.C3, 0, 0, 0, N.C3, 0, 0, 0,
  N.C3, 0, 0, 0, N.C3, 0, 0, 0,
  N.A2, 0, 0, 0, N.A2, 0, 0, 0,
  N.A2, 0, 0, 0, N.A2, 0, 0, 0,
  N.F3, 0, 0, 0, N.F3, 0, 0, 0,
  N.F3, 0, 0, 0, N.F3, 0, 0, 0,
  N.G3, 0, 0, 0, N.G3, 0, 0, 0,
  N.C3, 0, 0, 0, 0, 0, 0, 0,
];
const STEP = 0.24;
const LOOP = MELODY.length;

let musicOn = false;
let pumpTimer: number | null = null;
let stepIdx = 0;
let nextStepTime = 0;

function pump(): void {
  const a = ctx();
  if (!a || !musicOn) return;
  while (nextStepTime < a.currentTime + 0.5) {
    const m = MELODY[stepIdx % LOOP];
    if (m) noteAt(m, nextStepTime, STEP * 1.8, "triangle", 0.045);
    const b = BASS[stepIdx % LOOP];
    if (b) noteAt(b, nextStepTime, STEP * 2.2, "sine", 0.05);
    stepIdx++;
    nextStepTime += STEP;
  }
}

export function startMusic(): void {
  if (musicOn) return;
  const a = ctx();
  if (!a) return;
  musicOn = true;
  stepIdx = 0;
  nextStepTime = a.currentTime + 0.1;
  pump();
  pumpTimer = window.setInterval(pump, 200);
}

export function stopMusic(): void {
  musicOn = false;
  if (pumpTimer !== null) {
    window.clearInterval(pumpTimer);
    pumpTimer = null;
  }
}

export function isMusicOn(): boolean {
  return musicOn;
}

/** Enable/disable music and remember the choice. */
export function setMusic(enabled: boolean): void {
  localStorage.setItem("tagTime:music", enabled ? "1" : "0");
  if (enabled) startMusic();
  else stopMusic();
}

export function musicPref(): boolean {
  return localStorage.getItem("tagTime:music") !== "0";
}
