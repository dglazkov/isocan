import { afterEach, describe, expect, it, vi } from "vitest";
import { Playback, START_CUSHION, type ScheduleInfo } from "../src/voiceAudio.ts";

/**
 * **The overlap Paul heard, and the cursor that ends it.**
 *
 * `source.start()` with no argument starts a chunk at "now", so any chunk that
 * arrived while the previous one still had audio left started on top of it.
 * The overlap was guaranteed, not occasional: the model sends audio faster
 * than real time, so a chunk arriving 20 ms after its predecessor began 20 ms
 * after it and played over it. The measured symptom was "a lot of overlap in
 * the audio" and the cause was one missing cursor.
 *
 * These are the numbers the page's log now shows, held to as arithmetic:
 * every chunk starts where the last one ended, nothing is scheduled in the
 * past, and an interruption resets the clock rather than leaving a hole or an
 * overlap behind it.
 */

/** A context just real enough to record when each chunk was asked to start. */
class FakeContext {
  currentTime = 0;
  state = "running";
  destination = {};
  /** What `AudioContext.setSinkId` leaves behind, and the page reads back. */
  sinkId = "";
  readonly started: number[] = [];
  readonly stopped: unknown[] = [];

  constructor(routable = true) {
    // A browser without the API: the method is simply not there, which is
    // what the page feature-detects rather than a flag it has to agree on.
    if (!routable) (this as { setSinkId?: unknown }).setSinkId = undefined;
  }

  async setSinkId(id: string): Promise<void> {
    this.sinkId = id;
  }

  createBuffer(_channels: number, length: number, rate: number) {
    return { duration: length / rate, getChannelData: () => new Float32Array(length) };
  }

  createBufferSource() {
    const context = this;
    const source = {
      buffer: null as { duration: number } | null,
      onended: null as (() => void) | null,
      connect: () => undefined,
      start: (when = 0) => context.started.push(when),
      stop: () => context.stopped.push(source),
    };
    return source;
  }

  async resume(): Promise<void> {}
  async close(): Promise<void> {}
}

/** 0.1 s of 24 kHz PCM, the granularity the Live API sends. */
const chunk = (): Int16Array => new Int16Array(2400).fill(1000);

function fake(options: { routable?: boolean } = {}): FakeContext {
  const context = new FakeContext(options.routable ?? true);
  vi.stubGlobal("AudioContext", function AudioContext() {
    return context;
  } as unknown as typeof AudioContext);
  return context;
}

afterEach(() => vi.unstubAllGlobals());

describe("playback schedules each chunk after the last", () => {
  it("starts chunk N+1 exactly where chunk N ended", async () => {
    const context = fake();
    const playback = new Playback();
    const seen: ScheduleInfo[] = [];
    playback.onSchedule = (info) => seen.push(info);

    for (let i = 0; i < 4; i++) await playback.push(chunk());

    // 0.1 s chunks at a stopped clock: the cursor does all the moving.
    const expected = [0, 1, 2, 3].map((index) => START_CUSHION + index * 0.1);
    context.started.forEach((start, index) => expect(start).toBeCloseTo(expected[index]!, 9));
    for (let i = 1; i < seen.length; i++) {
      // The overlap assertion: no chunk begins before its predecessor ends.
      expect(seen[i]!.start).toBeGreaterThanOrEqual(seen[i - 1]!.start + seen[i - 1]!.duration - 1e-9);
    }
    expect(seen.map((one) => one.seq)).toEqual([0, 1, 2, 3]);
    expect(seen[0]!.bytes).toBe(4800);
  });

  it("exposes the audio clock rather than elapsed wall time", async () => {
    const context = fake();
    const playback = new Playback();
    expect(playback.currentTime).toBe(0);
    await playback.push(chunk());
    context.currentTime = 0.04;
    expect(playback.currentTime).toBe(0.04);
    context.state = "suspended";
    expect(playback.currentTime).toBe(0.04);
    context.currentTime = 0.08;
    expect(playback.currentTime).toBe(0.08);
    playback.close();
    expect(playback.currentTime).toBe(0);
  });

  it("starts at now rather than in the past when playback fell behind", async () => {
    const context = fake();
    const playback = new Playback();
    const seen: ScheduleInfo[] = [];
    playback.onSchedule = (info) => seen.push(info);

    await playback.push(chunk()); // cursor: 0.02 … 0.12
    context.currentTime = 5; // a long silence, or a slow decode
    await playback.push(chunk());

    expect(seen[1]!.behind).toBe(true);
    expect(seen[1]!.start).toBeCloseTo(5 + START_CUSHION, 9);
    expect(seen[1]!.start).toBeGreaterThan(context.currentTime);

    context.currentTime = 5.05;
    await playback.push(chunk());
    expect(seen[2]!.behind).toBe(false);
    expect(seen[2]!.start).toBeCloseTo(seen[1]!.start + 0.1, 9);
  });

  it("resets the clock on an interruption instead of overlapping the next reply", async () => {
    const context = fake();
    const playback = new Playback();
    const seen: ScheduleInfo[] = [];
    playback.onSchedule = (info) => seen.push(info);

    await playback.push(chunk());
    await playback.push(chunk());
    playback.stopNow();
    expect(context.stopped).toHaveLength(2);

    context.currentTime = 1;
    await playback.push(chunk());
    expect(seen[2]!.start).toBeCloseTo(1 + START_CUSHION, 9);
  });
});

/**
 * **Where the reply comes out.**
 *
 * Playback is Web Audio, so this is the CONTEXT's `setSinkId` — never an
 * `<audio>` element's — and a context is not built until the first chunk of a
 * reply arrives, which is long after the picker beside the microphone was
 * used. These are the three moments that has to work at.
 */
describe("the reply goes to the device that was chosen", () => {
  it("applies a stored choice when the context appears", async () => {
    const context = fake();
    const playback = new Playback("spk-a");
    // Nothing is playing yet, so there is no sink to report — `sinkId` answers
    // about the context, not about the wish, which is why the page asks it
    // before it tells anyone where their reply is going.
    expect(playback.sinkId).toBe("");

    await playback.push(chunk());
    expect(context.sinkId).toBe("spk-a");
    expect(playback.sinkId).toBe("spk-a");
  });

  it("moves a reply that is already playing, and can move it back", async () => {
    const context = fake();
    const playback = new Playback();
    await playback.push(chunk());
    expect(context.sinkId).toBe("");

    await playback.setSink("spk-b");
    expect(context.sinkId).toBe("spk-b");

    // "" is a choice too, and it is the one that has to move the context
    // BACK: leaving it is how a page ends up playing on a speaker the person
    // just turned off.
    await playback.setSink("");
    expect(context.sinkId).toBe("");
  });

  it("plays on the default and says so when the browser has no routing", async () => {
    const context = fake({ routable: false });
    const playback = new Playback("spk-a");
    const refused: string[] = [];
    playback.onSinkError = (err) => refused.push(String((err as Error).message));

    // The chunk still plays: a route the browser will not take must not be
    // able to end a conversation.
    await playback.push(chunk());
    expect(refused).toHaveLength(1);
    expect(refused[0]).toContain("cannot send audio to a chosen speaker");
    expect(context.started).toHaveLength(1);

    // A press in the picker DOES reject: that is the moment there is somebody
    // to tell, and the page turns it into a sentence.
    await expect(playback.setSink("spk-b")).rejects.toThrow(/cannot send audio to a chosen speaker/);
  });
});
