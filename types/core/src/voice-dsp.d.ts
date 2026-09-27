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
export declare const METER_FLOOR_DB = -60;
/** Under this, the room is silent: zero bars, not one that twitches. */
export declare const METER_GATE_DB = -55;
/** Root mean square, 0…1 — the one number the harness page logs per frame. */
export declare function rmsOf(pcm: Int16Array | Float32Array): number;
/** A block's loudness in dBFS, floored at the meter's floor; silence is `-Infinity`. */
export declare function dbfs(pcm: Int16Array | Float32Array): number;
/** −60…0 dBFS → 0…count bars. Everything under the gate is silence. */
export declare function barsFromDb(db: number, count?: number): number;
/**
 * **What the meter remembers between frames.**
 *
 * `feed` takes blocks as they arrive (about 8 ms each) and accumulates their
 * energy; `tick` runs on the display interval, turns the window into one dBFS
 * reading, and applies attack, release and the held peak. Keeping the two
 * apart is what makes this testable without a microphone: a test can feed a
 * synthetic sine of a known level and read the same numbers the page shows.
 */
export declare class LevelMeter {
    readonly bars: number;
    private db;
    private peakDb;
    private sum;
    private samples;
    constructor(bars?: number);
    /** One block of PCM: Float32 from the worklet, Int16 off the wire. */
    feed(pcm: Int16Array | Float32Array): void;
    /** One display frame: 0…1 for the bars, 0…1 for the held peak, and the dB. */
    tick(): {
        level: number;
        peak: number;
        db: number;
    };
    /** A new session starts at rest rather than holding the last one's peak. */
    reset(): void;
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
export declare class Resampler {
    readonly ratio: number;
    private carry;
    /** Where the next window starts, in input samples, modulo the buffer. */
    private position;
    constructor(ratio: number);
    /** Feed one worklet block; answer the completed 16 kHz PCM, if any. */
    push(input: Float32Array): Int16Array;
}
