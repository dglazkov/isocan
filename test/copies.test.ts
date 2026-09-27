import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as ownerAudio from "../packages/voice-agent/src/voiceAudio.ts";
import * as talkAudio from "../packages/modules/talk/src/audio.ts";
import { mintTestBadge as cliBadge } from "../packages/cli/test/badge.ts";
import { mintTestBadge as serverBadge } from "../packages/server/test/badge.ts";
import { mintTestBadge as voiceBadge } from "../packages/voice-agent/test/badge.ts";
import { mintTestBadge as webBadge } from "../packages/web/test/badge.ts";

/**
 * **Every copy this repository declares, held to being a copy** (cleanup
 * DU-1, 27 Sep 2026).
 *
 * A copy marked "reconcile by hand" is a comment, and this repository's
 * standing argument is that a bound nothing enforces is a comment. The talk
 * module's `audio.ts` proved it: it is a declared copy of the voice agent's
 * `voiceAudio.ts`, `053d2d42` fixed two bugs in the owner's `Resampler`, and
 * the copy kept both — at 44.1 kHz it wrote a PCM zero about once a second
 * into every browser Talk session. `live.ts` had a guard (#337, in the file
 * this one replaced, `test/live-copy.test.ts`); `audio.ts`, declared in the
 * same words on the same day, had none.
 *
 * So this file is the one place a declared copy is held, and it holds two
 * kinds:
 *
 * - **Byte copies** (`live.ts`): everything after the header that says it is
 *   a copy must equal the owner.
 * - **Behavioural copies** (`audio.ts`, the per-package test badge): the two
 *   files have legitimately different text — the talk module's playback
 *   carries an analyser the harness page does not — so both sides are RUN on
 *   the same inputs and must answer the same. That is the property the copy
 *   promised, and the one the `Resampler` broke.
 *
 * The pure DSP the two audio files shared (meter, resampler) is no longer
 * copied at all: it lives in `@isocan/core/voice-dsp` and both import it.
 * What is left in the pair is the browser I/O, which core cannot carry.
 *
 * The first `describe` is the forcing function: a new `COPY of <path>` header
 * anywhere under `packages/` fails here until it has a case below.
 */
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/** Every declared copy, and how it is held. The owner is the file a
 *  reconciliation flows from. */
const DECLARED = [
  { owner: "packages/voice-agent/src/live.ts", copy: "packages/modules/talk/src/live.ts", held: "bytes" },
  { owner: "packages/voice-agent/src/voiceAudio.ts", copy: "packages/modules/talk/src/audio.ts", held: "behaviour" },
] as const;

afterEach(() => vi.unstubAllGlobals());

describe("the declared copies are all held here", () => {
  it("every `COPY of` header under packages/ names a pair this file holds", () => {
    const tracked = execFileSync("git", ["ls-files", "packages"], { cwd: root, encoding: "utf8", timeout: 10_000 })
      .split("\n")
      .filter((f) => /\.(tsx?|mjs|js)$/.test(f));
    const declared: string[] = [];
    for (const file of tracked) {
      const head = read(file).slice(0, 600);
      const m = /COPY of (\S+?\.[a-z]+)\b/.exec(head);
      if (m) declared.push(`${m[1]} -> ${file}`);
    }
    expect(declared.sort()).toEqual(DECLARED.map((d) => `${d.owner} -> ${d.copy}`).sort());
  });
});

describe("the talk module's copy of the live provider face", () => {
  const { owner: OWNER, copy: COPY } = DECLARED[0];

  /** The copy's licence to differ: one block, at the top, saying it is a copy.
   *  Everything after it must match the owner byte for byte. */
  function withoutCopyHeader(copy: string): string {
    const open = copy.indexOf("/**");
    const close = copy.indexOf("*/", open);
    expect(open, `${COPY} should open with a block comment`).toBe(0);
    const header = copy.slice(open, close + 2);
    expect(header).toContain(`COPY of ${OWNER}`);
    return copy.slice(close + 2).replace(/^\n+/, "");
  }

  it("is the harness's file exactly, apart from the header that says it is a copy", () => {
    expect(withoutCopyHeader(read(COPY))).toBe(read(OWNER));
  });

  it("would notice a change made to one and not the other", () => {
    // Falsification: the assertion above is only worth having if an edit to
    // either file breaks it.
    expect(withoutCopyHeader(read(COPY))).not.toBe(read(OWNER) + "// a change made to one file only\n");
  });

  it("still says which file is the owner, so a reconciliation has a direction", () => {
    expect(read(COPY)).toContain("The harness\n * file remains the owner");
  });
});

type AudioSide = typeof ownerAudio | typeof talkAudio;

/**
 * A microphone, a context at `rate`, and the worklet's port — just enough of
 * a browser for `capture` to run, so the PCM it hands on is what a real
 * session would send the provider.
 */
async function captured(side: AudioSide, rate: number, signal: Float32Array): Promise<Int16Array> {
  let port: { onmessage: ((m: { data: Float32Array }) => void) | null } | undefined;
  const track = { stop: () => undefined, label: "Acme microphone", getSettings: () => ({ deviceId: "acme" }) };
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track], getAudioTracks: () => [track] }) },
  });
  vi.stubGlobal(
    "AudioContext",
    class {
      sampleRate = rate;
      destination = {};
      audioWorklet = { addModule: async () => undefined };
      async resume() {}
      async close() {}
      createMediaStreamSource() {
        return { connect: () => undefined, disconnect: () => undefined };
      }
    },
  );
  vi.stubGlobal(
    "AudioWorkletNode",
    class {
      port = { onmessage: null };
      constructor() {
        port = this.port;
      }
      connect() {}
      disconnect() {}
    },
  );
  const out: number[] = [];
  const session = await side.capture((pcm) => out.push(...pcm));
  // The worklet hands over 128-sample render quanta.
  for (let i = 0; i < signal.length; i += 128) port!.onmessage!({ data: signal.slice(i, i + 128) });
  session.stop();
  return Int16Array.from(out);
}

describe("the talk module's copy of the voice agent's audio, run on the same inputs", () => {
  it.each([44100, 48000])("captures the same PCM at %d Hz, with no sample dropped to zero", async (rate) => {
    // Two seconds of DC at 0.25: every output sample is 8191, so a zero is a
    // dropout and not a zero crossing. At 44.1 kHz the unported copy wrote
    // one at 17600, 19040 and 20480 — `053d2d42`'s negative-phase bug.
    const signal = new Float32Array(rate * 2).fill(0.25);
    const [owner, copy] = [await captured(ownerAudio, rate, signal), await captured(talkAudio, rate, signal)];
    expect(owner).toHaveLength(32000);
    expect([...copy].flatMap((s, i) => (s === 8191 ? [] : [i]))).toEqual([]);
    expect([...copy]).toEqual([...owner]);
  });

  it("schedules playback identically: each chunk after the last, then from now after an interruption", async () => {
    const schedule = async (side: AudioSide) => {
      const context = {
        currentTime: 0,
        state: "running",
        destination: {},
        sinkId: "",
        async setSinkId(id: string) {
          this.sinkId = id;
        },
        createBuffer: (_c: number, length: number, rate: number) => ({ duration: length / rate, getChannelData: () => new Float32Array(length) }),
        createBufferSource: () => ({ buffer: null, onended: null, connect: () => undefined, start: () => undefined, stop: () => undefined }),
        // The talk module's playback meters what it plays; the harness does not.
        createAnalyser: () => ({ fftSize: 0, connect: () => undefined, getFloatTimeDomainData: () => undefined }),
        async resume() {},
        async close() {},
      };
      vi.stubGlobal("AudioContext", function AudioContext() {
        return context;
      });
      const playback = new side.Playback("acme-speaker");
      const seen: unknown[] = [];
      playback.onSchedule = (info) => seen.push(info);
      for (let i = 0; i < 3; i++) await playback.push(new Int16Array(2400).fill(1000));
      context.currentTime = 0.5;
      await playback.push(new Int16Array(2400));
      playback.stopNow();
      await playback.push(new Int16Array(1200));
      return { seen, sink: playback.sinkId };
    };
    const [owner, copy] = [await schedule(ownerAudio), await schedule(talkAudio)];
    expect(owner.seen).toHaveLength(5);
    expect(copy).toEqual(owner);
  });

  it("lists the same devices from the same enumeration", async () => {
    const list = async (side: AudioSide, devices: { kind: string; deviceId: string; label: string }[]) => {
      vi.stubGlobal("navigator", { mediaDevices: { enumerateDevices: async () => devices } });
      return side.listDevices();
    };
    const named = [
      { kind: "audioinput", deviceId: "default", label: "Default" },
      { kind: "audioinput", deviceId: "acme-mic", label: "Acme microphone" },
      { kind: "audioinput", deviceId: "quiet", label: "" },
      { kind: "audiooutput", deviceId: "communications", label: "Communications" },
      { kind: "audiooutput", deviceId: "acme-speaker", label: "Acme speaker" },
    ];
    const nameless = [{ kind: "audioinput", deviceId: "", label: "" }];
    for (const devices of [named, nameless]) {
      const owner = await list(ownerAudio, devices);
      expect(await list(talkAudio, devices)).toEqual(owner);
    }
  });

  it("agrees about whether a speaker can be chosen, with and without the API", () => {
    for (const setSinkId of [async () => undefined, undefined]) {
      vi.stubGlobal("AudioContext", Object.assign(function AudioContext() {}, { prototype: { setSinkId } }));
      expect(talkAudio.canRouteOutput()).toBe(ownerAudio.canRouteOutput());
    }
  });

  it("turns PCM into bytes and back the same way", async () => {
    const pcm = Int16Array.from([0, 1, -1, 0x7fff, -0x8000, 8191]);
    const bytes = ownerAudio.toBytes(pcm.subarray(1));
    expect(new Uint8Array(talkAudio.toBytes(pcm.subarray(1)))).toEqual(new Uint8Array(bytes));
    for (const wire of [bytes, new Blob([bytes])]) {
      expect([...(await talkAudio.fromBytes(wire))]).toEqual([...(await ownerAudio.fromBytes(wire))]);
    }
  });
});

describe("the per-package test badge, run on the same door", () => {
  /**
   * `packages/web/test/badge.ts` calls itself "a third copy of the same fifteen
   * lines, and deliberately so": each package's tests import their own rather
   * than reach across a package boundary for a fixture. The copies are
   * allowed; four fixtures that mint four different badges are not — a
   * suite would then be asserting different things about the same door.
   */
  it("sends the same requests and hands back the same badge from every package", async () => {
    const mint = async (badge: typeof cliBadge) => {
      const sent: { url: string; init: RequestInit | undefined }[] = [];
      vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
        sent.push({ url, init });
        const door = { badgeId: "bdg_acme", secret: "s3cret" };
        return new Response(JSON.stringify(door), { status: 200 });
      });
      const held = await badge("http://acme.test");
      await held.speakAs({ id: "usr_acme", name: "Acme" });
      return { sent, held: { badgeId: held.badgeId, token: held.token, headers: held.headers } };
    };
    const cli = await mint(cliBadge);
    expect(cli.sent).toHaveLength(2);
    for (const other of [serverBadge, voiceBadge, webBadge]) expect(await mint(other)).toEqual(cli);
  });
});

describe("a title becomes a filename by one rule", () => {
  /**
   * Cleanup DU-2, 27 Sep 2026: the rule was written six ways, and the five
   * ASCII copies dropped letters ("Café" → `caf`). `titleSlug` in
   * `packages/core/src/filenames.ts` is the rule now, tested on accented and
   * non-Latin titles through every former copy in
   * `packages/core/test/filenames.test.ts`. This is the other half: a new
   * spelling of the old idioms fails here rather than becoming copy seven.
   */
  const IDIOMS = [/\[\^a-z0-9\]\+\/g, "-"\)/, /\[\^\\p\{L\}\\p\{N\}\]\+\/gu, "-"\)/];
  /** Where an idiom is allowed, and why it is not a filename made from a title. */
  const ALLOWED: Record<string, string> = {
    // A heading's anchor id, read by a browser in a URL fragment — not a file.
    "packages/web/src/lib/markdown-body.tsx": "anchor",
  };

  it("is spelled nowhere outside core, apart from the one line that finds a pre-rule directory", () => {
    const tracked = execFileSync("git", ["ls-files", "packages"], { cwd: root, encoding: "utf8", timeout: 10_000 })
      .split("\n")
      .filter((f) => /\.(tsx?|mjs|js)$/.test(f) && !f.includes("/test/") && f !== "packages/core/src/filenames.ts");
    const found: string[] = [];
    for (const file of tracked) {
      if (ALLOWED[file]) continue;
      read(file).split("\n").forEach((line, i) => {
        if (IDIOMS.some((idiom) => idiom.test(line)) && !line.includes("DU-2: pre-rule names only")) found.push(`${file}:${i + 1}`);
      });
    }
    expect(found).toEqual([]);
  });

  it("would notice the old spelling", () => {
    // Falsification: the ASCII idiom as the wireframe module wrote it.
    const old = 'title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")';
    expect(IDIOMS.some((idiom) => idiom.test(old))).toBe(true);
  });
});
