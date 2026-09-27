/**
 * **The arithmetic of a voice, with no browser in it** — the level meter and
 * the resampler both voice surfaces run their microphone through.
 *
 * Moved here from the voice agent's `voiceAudio.ts` (cleanup DU-1, 27 Sep
 * 2026). The talk module carried a declared copy of that file ("reconcile the
 * two by hand"), `053d2d42` fixed two bugs in the owner's `Resampler`, and the
 * copy kept both: at 44.1 kHz every browser Talk session wrote a PCM zero into
 * the stream about once a second. Nothing here touches a DOM, a device or a
 * socket, so nothing stopped it being one file both sides import — the talk
 * module must not depend on the harness package, and both already depend on
 * core. The browser I/O that is still copied is held by `test/copies.test.ts`.
 *
 * A subpath, not the barrel: the harness page imports nothing it does not
 * need, and the web app's entry chunk never sees this file.
 */

/**
 * **A level meter, not a peak display and not a random number.**
 *
 * Three things were wrong at once and this is all three:
 *
 *   - the reading was `0.35 + Math.random() * 0.6`, so every tick pinned the
 *     top half of the bars on any sound and on no sound at all;
 *   - amplitude is linear where loudness is logarithmic — normal speech sits
 *     near −20 dBFS, which on a linear scale is already 90% of the way up, so
 *     "everything above a whisper pins the top" is arithmetic, not taste;
 *   - a peak meter jumps to full on one transient and reads as broken.
 *
 * So: RMS over the block (`sqrt(mean(x²))`), converted with `20·log10`, floored
 * at −60 dBFS, gated below −55 so a quiet room reads zero rather than one
 * twitching bar, mapped −60…0 → 0…bars, and smoothed in dB — a release
 * measured in dB per tick is visible at the top and not sluggish at the bottom,
 * which a multiplicative decay on raw amplitude is not.
 */
export const METER_FLOOR_DB = -60;
/** Under this, the room is silent: zero bars, not one that twitches. */
export const METER_GATE_DB = -55;
const METER_BARS = 28;
/** How much of the gap to a louder reading is closed per 100 ms tick. */
const ATTACK = 0.55;
/** Decay, in dB per tick — 60 dB/s. */
const RELEASE_DB = 6;
/** The held peak falls this much per tick, so a word stays visible. */
const PEAK_DROP_DB = 1.5;

/** `mean(x²)`, the step before the square root. Int16 is normalised first. */
function meanSquareOf(pcm: Int16Array | Float32Array): number {
  if (pcm.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) {
    const sample = pcm instanceof Int16Array ? pcm[i]! / 0x8000 : pcm[i]!;
    sum += sample * sample;
  }
  return sum / pcm.length;
}

/** Root mean square, 0…1 — the one number the harness page logs per frame. */
export function rmsOf(pcm: Int16Array | Float32Array): number {
  return Math.sqrt(meanSquareOf(pcm));
}

/** Mean square → dBFS, floored. Silence answers `-Infinity`, not `-Infinity` dB. */
function dbFromMeanSquare(meanSquare: number): number {
  if (!(meanSquare > 0)) return -Infinity;
  return Math.max(METER_FLOOR_DB, 20 * Math.log10(Math.sqrt(meanSquare)));
}

/** A block's loudness in dBFS, floored at the meter's floor; silence is `-Infinity`. */
export function dbfs(pcm: Int16Array | Float32Array): number {
  return dbFromMeanSquare(meanSquareOf(pcm));
}

/** −60…0 dBFS → 0…count bars. Everything under the gate is silence. */
export function barsFromDb(db: number, count = METER_BARS): number {
  if (!Number.isFinite(db) || db <= METER_GATE_DB) return 0;
  const level = Math.min(0, db) - METER_FLOOR_DB;
  return Math.max(0, Math.min(count, Math.round((level / -METER_FLOOR_DB) * count)));
}

/**
 * **What the meter remembers between frames.**
 *
 * `feed` takes blocks as they arrive (about 8 ms each) and accumulates their
 * energy; `tick` runs on the display interval, turns the window into one dBFS
 * reading, and applies attack, release and the held peak. Keeping the two
 * apart is what makes this testable without a microphone: a test can feed a
 * synthetic sine of a known level and read the same numbers the page shows.
 */
export class LevelMeter {
  private db = METER_FLOOR_DB;
  private peakDb = METER_FLOOR_DB;
  private sum = 0;
  private samples = 0;

  constructor(readonly bars: number = METER_BARS) {}

  /** One block of PCM: Float32 from the worklet, Int16 off the wire. */
  feed(pcm: Int16Array | Float32Array): void {
    this.sum += meanSquareOf(pcm) * pcm.length;
    this.samples += pcm.length;
  }

  /** One display frame: 0…1 for the bars, 0…1 for the held peak, and the dB. */
  tick(): { level: number; peak: number; db: number } {
    const mean = this.samples > 0 ? this.sum / this.samples : 0;
    this.sum = 0;
    this.samples = 0;
    const raw = dbFromMeanSquare(mean);
    const gated = raw > METER_GATE_DB ? raw : -Infinity;
    const next =
      gated > this.db ? this.db + (gated - this.db) * ATTACK : Math.max(gated, this.db - RELEASE_DB);
    this.db = Math.max(METER_FLOOR_DB, next);
    this.peakDb = Math.max(this.peakDb - PEAK_DROP_DB, this.db);
    return {
      level: barsFromDb(this.db, this.bars) / this.bars,
      peak: barsFromDb(this.peakDb, this.bars) / this.bars,
      db: this.db,
    };
  }

  /** A new session starts at rest rather than holding the last one's peak. */
  reset(): void {
    this.db = METER_FLOOR_DB;
    this.peakDb = METER_FLOOR_DB;
    this.sum = 0;
    this.samples = 0;
  }
}

/**
 * **A streaming resampler that is correct at every ratio, not just integer ones.**
 *
 * The first version indexed its carry buffer with `i * ratio + j` and summed
 * over `j < ratio`. For a 48,000 Hz context the ratio is exactly 3 and every
 * index lands on a sample; for 44,100 it is 2.75625, every index is a float,
 * every lookup answers `undefined`, and the `?? 0` fallback turned the whole
 * stream into zeros — 98% of the PCM in a keyless browser capture. That
 * proves corrupted input, not the cause of a historical provider session
 * whose PCM and context rate were not recorded.
 *
 * This walks the input with a window `ratio` samples wide and weights the two
 * samples the window straddles by the fraction it covers — a box average, the
 * same flavour the first version meant and never achieved. The window always
 * covers exactly `ratio` of the input, at any ratio; the phase that survives
 * a block boundary is kept, so the filter is continuous across worklet blocks.
 *
 * `ratio < 1` (a context under 16 kHz) is a browser oddity, but the same
 * window arithmetic covers it without a special case.
 */
export class Resampler {
  private carry: number[] = [];
  /** Where the next window starts, in input samples, modulo the buffer. */
  private position = 0;

  constructor(readonly ratio: number) {}

  /** Feed one worklet block; answer the completed 16 kHz PCM, if any. */
  push(input: Float32Array): Int16Array {
    this.carry.push(...input);
    const out: number[] = [];
    const ratio = this.ratio;
    // A window is complete once its last sample is in the buffer.
    while (this.position + ratio <= this.carry.length + 1e-9) {
      const start = this.position;
      // The completion tolerance may accept an end just beyond the buffer.
      // Bound that same end before indexing its final sample.
      const end = Math.min(start + ratio, this.carry.length);
      const first = Math.floor(start);
      const last = Math.floor(end);
      let sum = 0;
      // The sample the window opens on, by its remaining fraction.
      sum += this.carry[first]! * (Math.min(end, first + 1) - start);
      // Whole samples inside the window.
      for (let j = first + 1; j < last; j++) sum += this.carry[j]!;
      // The sample the window closes on, by its covered fraction.
      if (end > last) sum += this.carry[last]! * (end - last);
      const value = Math.max(-1, Math.min(1, sum / ratio));
      out.push(value < 0 ? value * 0x8000 : value * 0x7fff);
      this.position = end;
    }
    // Everything before the next window's start is spent; the fraction of a
    // sample it is mid-way through stays in the buffer and in the phase.
    const spent = Math.floor(this.position + 1e-9);
    this.carry.splice(0, spent);
    // If epsilon rounded spent up, subtraction can leave a tiny negative
    // phase. floor(phase) then reads carry[-1], and NaN becomes a PCM zero.
    this.position = Math.max(0, this.position - spent);
    return Int16Array.from(out);
  }
}
