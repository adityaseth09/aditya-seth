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

// Ira's soundtrack: every song is a 64-step melody + bass pair.
// The first song is free; the others are bought in the shop with coins.
export interface Song {
  id: string;
  step: number;
  melody: number[];
  bass: number[];
}

const N = {
  A2: 110.0, C3: 130.81, E3: 164.81, F3: 174.61, G3: 196.0,
  D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, C6: 1046.5,
};

const SONGS: Song[] = [
  {
    id: "ira",
    step: 0.24,
    melody: [
      N.E5, 0, N.G5, 0, N.A5, 0, N.G5, 0,
      N.E5, 0, N.D5, 0, N.C5, 0, N.D5, 0,
      N.E5, 0, N.G5, 0, N.A5, 0, N.C6, 0,
      N.A5, 0, N.G5, 0, N.E5, 0, 0, 0,
      N.G5, 0, N.E5, 0, N.D5, 0, N.E5, 0,
      N.C5, 0, N.D5, 0, N.E5, 0, N.G5, 0,
      N.A4, 0, N.C5, 0, N.D5, 0, N.E5, 0,
      N.D5, 0, N.C5, 0, 0, 0, 0, 0,
    ],
    bass: [
      N.C3, 0, 0, 0, N.C3, 0, 0, 0,
      N.C3, 0, 0, 0, N.C3, 0, 0, 0,
      N.A2, 0, 0, 0, N.A2, 0, 0, 0,
      N.A2, 0, 0, 0, N.A2, 0, 0, 0,
      N.F3, 0, 0, 0, N.F3, 0, 0, 0,
      N.F3, 0, 0, 0, N.F3, 0, 0, 0,
      N.G3, 0, 0, 0, N.G3, 0, 0, 0,
      N.C3, 0, 0, 0, 0, 0, 0, 0,
    ],
  },
  {
    id: "bouncy",
    step: 0.18,
    melody: [
      N.C5, 0, N.E5, 0, N.G5, 0, N.E5, 0,
      N.A5, 0, N.G5, 0, N.E5, 0, N.C5, 0,
      N.D5, 0, N.F5, 0, N.A5, 0, N.F5, 0,
      N.G5, 0, N.E5, 0, N.D5, 0, N.C5, 0,
      N.C5, 0, N.E5, 0, N.G5, 0, N.C6, 0,
      N.A5, 0, N.G5, 0, N.A5, 0, N.C6, 0,
      N.G5, N.E5, N.D5, N.E5, N.C5, N.D5, N.E5, N.G5,
      N.E5, 0, N.D5, 0, N.C5, 0, 0, 0,
    ],
    bass: [
      N.C3, 0, N.C3, 0, N.C3, 0, N.C3, 0,
      N.A2, 0, N.A2, 0, N.C3, 0, N.C3, 0,
      N.F3, 0, N.F3, 0, N.F3, 0, N.F3, 0,
      N.C3, 0, N.C3, 0, N.G3, 0, N.G3, 0,
      N.C3, 0, N.C3, 0, N.C3, 0, N.C3, 0,
      N.A2, 0, N.A2, 0, N.A2, 0, N.A2, 0,
      N.G3, 0, N.G3, 0, N.G3, 0, N.G3, 0,
      N.C3, 0, N.C3, 0, N.C3, 0, 0, 0,
    ],
  },
  {
    id: "sleepy",
    step: 0.34,
    melody: [
      N.E5, 0, 0, 0, N.G5, 0, 0, 0,
      N.D5, 0, 0, 0, N.C5, 0, 0, 0,
      N.A4, 0, 0, 0, N.C5, 0, 0, 0,
      N.D5, 0, 0, 0, N.E5, 0, 0, 0,
      N.G5, 0, 0, 0, N.E5, 0, 0, 0,
      N.D5, 0, 0, 0, N.C5, 0, 0, 0,
      N.A4, 0, 0, 0, N.G4, 0, 0, 0,
      N.C5, 0, 0, 0, 0, 0, 0, 0,
    ],
    bass: [
      N.C3, 0, 0, 0, 0, 0, 0, 0,
      N.G3, 0, 0, 0, 0, 0, 0, 0,
      N.A2, 0, 0, 0, 0, 0, 0, 0,
      N.F3, 0, 0, 0, 0, 0, 0, 0,
      N.C3, 0, 0, 0, 0, 0, 0, 0,
      N.F3, 0, 0, 0, 0, 0, 0, 0,
      N.G3, 0, 0, 0, 0, 0, 0, 0,
      N.C3, 0, 0, 0, 0, 0, 0, 0,
    ],
  },
  {
    id: "space",
    step: 0.22,
    melody: [
      N.A4, 0, N.C5, 0, N.D5, 0, N.E5, 0,
      N.G5, 0, N.E5, 0, N.D5, 0, N.C5, 0,
      N.A4, 0, N.C5, 0, N.D5, 0, N.G4, 0,
      N.E5, 0, N.D5, 0, N.C5, 0, N.D5, 0,
      N.A4, 0, N.C5, 0, N.E5, 0, N.G5, 0,
      N.A5, 0, N.G5, 0, N.E5, 0, N.D5, 0,
      N.C5, 0, N.D5, 0, N.E5, 0, N.G5, 0,
      N.A4, 0, 0, 0, 0, 0, 0, 0,
    ],
    bass: [
      N.A2, 0, 0, 0, 0, 0, 0, 0,
      N.A2, 0, 0, 0, 0, 0, 0, 0,
      N.E3, 0, 0, 0, 0, 0, 0, 0,
      N.E3, 0, 0, 0, 0, 0, 0, 0,
      N.F3, 0, 0, 0, 0, 0, 0, 0,
      N.F3, 0, 0, 0, 0, 0, 0, 0,
      N.G3, 0, 0, 0, 0, 0, 0, 0,
      N.A2, 0, 0, 0, 0, 0, 0, 0,
    ],
  },
  {
    id: "rain",
    step: 0.28,
    melody: [
      N.E5, 0, 0, N.G5, 0, 0, N.E5, 0,
      N.D5, 0, 0, N.C5, 0, 0, N.D5, 0,
      N.E5, 0, 0, N.G5, 0, 0, N.A5, 0,
      N.G5, 0, 0, N.E5, 0, 0, 0, 0,
      N.C5, 0, 0, N.D5, 0, 0, N.E5, 0,
      N.G5, 0, 0, N.E5, 0, 0, N.D5, 0,
      N.E5, 0, 0, N.D5, 0, 0, N.C5, 0,
      N.C5, 0, 0, 0, 0, 0, 0, 0,
    ],
    bass: [
      N.A2, 0, 0, 0, 0, 0, 0, 0,
      N.F3, 0, 0, 0, 0, 0, 0, 0,
      N.C3, 0, 0, 0, 0, 0, 0, 0,
      N.G3, 0, 0, 0, 0, 0, 0, 0,
      N.A2, 0, 0, 0, 0, 0, 0, 0,
      N.F3, 0, 0, 0, 0, 0, 0, 0,
      N.G3, 0, 0, 0, 0, 0, 0, 0,
      N.C3, 0, 0, 0, 0, 0, 0, 0,
    ],
  },
  {
    id: "race",
    step: 0.13,
    melody: [
      N.C5, N.C5, N.G5, 0, N.A5, 0, N.G5, 0,
      N.E5, N.E5, N.C5, 0, N.D5, 0, N.E5, 0,
      N.C5, N.C5, N.G5, 0, N.A5, 0, N.C6, 0,
      N.G5, 0, N.E5, 0, N.D5, 0, N.C5, 0,
      N.E5, N.E5, N.G5, 0, N.A5, 0, N.G5, 0,
      N.C5, N.C5, N.E5, 0, N.G5, 0, N.A5, 0,
      N.C6, 0, N.A5, 0, N.G5, 0, N.E5, 0,
      N.D5, 0, N.C5, 0, 0, 0, 0, 0,
    ],
    bass: [
      N.C3, 0, N.G3, 0, N.C3, 0, N.G3, 0,
      N.C3, 0, N.G3, 0, N.C3, 0, N.G3, 0,
      N.A2, 0, N.E3, 0, N.A2, 0, N.E3, 0,
      N.F3, 0, N.C3, 0, N.G3, 0, N.C3, 0,
      N.C3, 0, N.G3, 0, N.C3, 0, N.G3, 0,
      N.A2, 0, N.E3, 0, N.A2, 0, N.E3, 0,
      N.F3, 0, N.C3, 0, N.G3, 0, N.C3, 0,
      N.C3, 0, N.C3, 0, N.C3, 0, 0, 0,
    ],
  },
  {
    id: "monster",
    step: 0.26,
    melody: [
      N.E4, 0, N.G4, 0, N.E4, 0, N.D4, 0,
      N.E4, 0, N.G4, 0, N.A4, 0, N.G4, 0,
      N.E4, 0, N.G4, 0, N.A4, 0, N.C5, 0,
      N.D5, 0, N.C5, 0, N.A4, 0, N.E4, 0,
      N.G4, 0, N.E4, 0, N.D4, 0, N.E4, 0,
      N.G4, 0, N.A4, 0, N.C5, 0, N.A4, 0,
      N.D5, 0, N.E5, 0, N.D5, 0, N.C5, 0,
      N.A4, 0, N.E4, 0, 0, 0, 0, 0,
    ],
    bass: [
      N.E3, 0, 0, 0, N.E3, 0, 0, 0,
      N.A2, 0, 0, 0, N.A2, 0, 0, 0,
      N.E3, 0, 0, 0, N.E3, 0, 0, 0,
      N.A2, 0, 0, 0, N.A2, 0, 0, 0,
      N.G3, 0, 0, 0, N.G3, 0, 0, 0,
      N.A2, 0, 0, 0, N.A2, 0, 0, 0,
      N.E3, 0, 0, 0, N.E3, 0, 0, 0,
      N.A2, 0, 0, 0, N.A2, 0, 0, 0,
    ],
  },
];

const LS_SONG = "tagTime:song";

export function currentSongId(): string {
  const id = localStorage.getItem(LS_SONG);
  return id && SONGS.some((s) => s.id === id) ? id : SONGS[0].id;
}

function songById(id: string): Song {
  return SONGS.find((s) => s.id === id) ?? SONGS[0];
}

/** Switch the background tune (bought in the shop); restarts if playing. */
export function setSong(id: string): void {
  if (!SONGS.some((s) => s.id === id)) return;
  localStorage.setItem(LS_SONG, id);
  if (musicOn) {
    stopMusic();
    startMusic();
  }
}

let musicOn = false;
let pumpTimer: number | null = null;
let stepIdx = 0;
let nextStepTime = 0;

function pump(): void {
  const a = ctx();
  if (!a || !musicOn) return;
  const song = songById(currentSongId());
  while (nextStepTime < a.currentTime + 0.5) {
    const m = song.melody[stepIdx % song.melody.length];
    if (m) noteAt(m, nextStepTime, song.step * 1.8, "triangle", 0.045);
    const b = song.bass[stepIdx % song.bass.length];
    if (b) noteAt(b, nextStepTime, song.step * 2.2, "sine", 0.05);
    stepIdx++;
    nextStepTime += song.step;
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
