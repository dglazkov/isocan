import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";
import { mintTestBadge, type TestBadge } from "./badge.ts";
import {
  LIVE_MODEL,
  forgetVoiceModel,
  listModels,
  liveUrl,
  modelNameShape,
  readVoiceModel,
  startVoiceServer,
  testModel,
  writeVoiceModel,
  writeVoiceKey,
} from "../src/voice-harness.ts";

/**
 * **Which Gemini model the voice talks through** (Paul, 13 Sep 2026: “we should
 * be able to select (and type our own) gemini model, sometimes we have access
 * to beta models not in the public list”).
 *
 * The shape of this file follows from why the text field exists: the LIST
 * cannot be the validation, because the whole point is names the list does not
 * carry. So what is asserted here is
 *
 *   - a name is checked for SHAPE here and said to be checked here;
 *   - whether a model exists, and whether it can hold a Live session, is the
 *     PROVIDER's answer, handed over verbatim;
 *   - the two identical provider messages (measured: a text-only model and a
 *     name that does not exist both answer “is not found for API version
 *     v1beta, or is not supported for bidiGenerateContent”) are told apart by
 *     what the provider's own list says, so a person can act on the answer;
 *   - the choice is a file, and it survives the process that wrote it.
 */

const cliBin = fileURLToPath(new URL("../../cli/bin/isocan.js", import.meta.url));
const seeder = { id: "usr_seeder", name: "Seeder" };
const person = { id: "usr_person", name: "Person" };

let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-voice-model-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...person, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  badge = await mintTestBadge(base);
  await badge.speakAs(seeder);
  await post("/api/ops", { canvasId: null, actor: seeder, op: { type: "project.create", canvasId: "prj_1", title: "Model test" } });
  // The harness resolves its actor by the session it was given, so the claim
  // has to exist before a server starts — the same door the rc uses.
  const claimed = await isocan(["identity", "--name", "Voice", "--session"], {
    ISOCAN_SESSION_ID: "Voice",
    ISOCAN_HARNESS: "agent",
  });
  if (claimed.code !== 0) throw new Error(`could not claim the voice actor: ${claimed.stderr}`);
});

/** The CLI, in this test's home, the way the harness resolves its identity. */
function isocan(args: string[], extraEnv: Record<string, string> = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  const env = { ...process.env };
  for (const name of harnessVars) delete env[name];
  const child = spawn(process.execPath, [cliBin, ...args], {
    env: { ...env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port, ...extraEnv },
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout!.setEncoding("utf8");
  child.stdout!.on("data", (chunk) => (stdout += chunk));
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve) => child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })));
}

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

async function post(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

/** The provider's list, in the shape it was measured to have on 13 Sep 2026. */
const PROVIDER_LIST = {
  models: [
    {
      name: "models/gemini-3.1-flash-live-preview",
      displayName: "Gemini 3.1 Flash Live Preview",
      description: "Live, audio in and out.\nMore prose below the first line.",
      supportedGenerationMethods: ["bidiGenerateContent"],
    },
    {
      name: "models/gemini-2.5-flash-native-audio-latest",
      displayName: "Gemini 2.5 Flash Native Audio Latest",
      description: "Native audio.",
      supportedGenerationMethods: ["countTokens", "bidiGenerateContent"],
    },
    {
      name: "models/gemini-2.5-flash",
      displayName: "Gemini 2.5 Flash",
      description: "Fast text.",
      supportedGenerationMethods: ["generateContent", "countTokens"],
    },
  ],
};

const listFetch = (body: unknown = PROVIDER_LIST, status = 200): typeof fetch =>
  (async () => ({ ok: status === 200, status, text: async () => JSON.stringify(body) })) as unknown as typeof fetch;

/** A Live socket that says whatever a test tells it to. */
class FakeLive {
  static latest: FakeLive | null = null;
  static all: FakeLive[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  closed = false;
  constructor(readonly url: string) {
    FakeLive.latest = this;
    FakeLive.all.push(this);
  }
  send(data: unknown): void {
    this.sent.push(String(data));
  }
  close(): void {
    this.closed = true;
  }
  /** What the provider does when the setup is acceptable. */
  accept(): void {
    this.onmessage?.({ data: JSON.stringify({ setupComplete: {} }) });
  }
  /** What the provider does when it is not: a close code and its own sentence. */
  refuse(code: number, reason: string): void {
    this.onclose?.({ code, reason });
  }
  /** The setup message the harness sent, as an object. */
  setup(): { setup?: { model?: string; generationConfig?: { responseModalities?: string[] } } } {
    return JSON.parse(this.sent[0] ?? "{}") as never;
  }
}

const key = { provider: "gemini" as const, key: "AIza-synthetic-not-a-real-key" };

beforeEach(() => {
  FakeLive.latest = null;
  FakeLive.all = [];
});

describe("a model name is checked for shape, and said to be checked here", () => {
  it("prefixes what a person would type", () => {
    expect(modelNameShape("gemini-2.5-flash-native-audio-latest")).toEqual({
      ok: true,
      name: "models/gemini-2.5-flash-native-audio-latest",
    });
    expect(modelNameShape("models/gemini-9-beta")).toEqual({ ok: true, name: "models/gemini-9-beta" });
  });

  it("refuses a name that is not shaped like one, without asking anybody", () => {
    const refused = modelNameShape("gemini 2.5 flash!");
    expect(refused.ok).toBe(false);
    if (refused.ok) throw new Error("unreachable");
    expect(refused.why).toContain("not shaped like a Gemini model name");
    // The honest half: a local check must say that it is local.
    expect(refused.why).toContain("nothing was sent");
    expect(modelNameShape("   ").ok).toBe(false);
  });
});

describe("the choice is a file, the way the key is", () => {
  it("round-trips, forgets, and stores nothing a person did not ask for", async () => {
    expect(await readVoiceModel(home)).toBeNull();
    await writeVoiceModel(home, "models/gemini-9.9-beta");
    expect((await readVoiceModel(home))?.model).toBe("models/gemini-9.9-beta");
    await forgetVoiceModel(home);
    expect(await readVoiceModel(home)).toBeNull();
  });
});

describe("the provider's list, in the provider's words", () => {
  it("reads the measured shape, and marks the Live models by the provider's own method", async () => {
    const list = await listModels(key, listFetch());
    expect(list.ok).toBe(true);
    expect(list.models.map((one) => one.name)).toEqual([
      "models/gemini-3.1-flash-live-preview",
      "models/gemini-2.5-flash-native-audio-latest",
      "models/gemini-2.5-flash",
    ]);
    // `bidiGenerateContent` is the Live API's own method name; it is read from
    // the provider rather than guessed at here.
    expect(list.models.map((one) => one.live)).toEqual([true, true, false]);
    expect(list.models[0]?.description).toBe("Live, audio in and out.");
    expect(list.answer).toBe("the provider lists 3 models, 2 of them Live");
  });

  it("hands a refusal over verbatim rather than inventing one", async () => {
    const list = await listModels(key, listFetch({ error: { message: "API key not valid" } }, 400));
    expect(list.ok).toBe(false);
    expect(list.models).toEqual([]);
    expect(list.answer).toContain("400");
    expect(list.answer).toContain("API key not valid");
  });

  it("says so when the provider cannot be reached at all", async () => {
    const list = await listModels(key, (async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    }) as unknown as typeof fetch);
    expect(list.ok).toBe(false);
    expect(list.answer).toContain("could not reach the provider");
  });
});

/** The list once, for the checks below: the provider's measured shape. */
const KNOWN = [
  {
    name: "models/gemini-3.1-flash-live-preview",
    displayName: "Gemini 3.1 Flash Live Preview",
    description: "Live, audio in and out.",
    methods: ["bidiGenerateContent"],
    live: true,
  },
  {
    name: "models/gemini-2.5-flash-native-audio-latest",
    displayName: "Gemini 2.5 Flash Native Audio Latest",
    description: "Native audio.",
    methods: ["countTokens", "bidiGenerateContent"],
    live: true,
  },
  {
    name: "models/gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    description: "Fast text.",
    methods: ["generateContent", "countTokens"],
    live: false,
  },
];

describe("whether a model works is the provider's answer", () => {
  const known = KNOWN;

  it("accepts a Live model, and sends the setup the Live API needs", async () => {
    const checking = testModel({
      asked: "models/gemini-2.5-flash-native-audio-latest",
      key,
      known,
      WebSocketImpl: FakeLive as unknown as typeof WebSocket,
      urlFor: (k) => liveUrl(k),
    });
    FakeLive.latest?.onopen?.();
    const setup = FakeLive.latest?.setup();
    expect(setup?.setup?.model).toBe("models/gemini-2.5-flash-native-audio-latest");
    // Audio out is what this page plays; a model that will not send it is not
    // usable here however good it is at text.
    expect(setup?.setup?.generationConfig?.responseModalities).toEqual(["AUDIO"]);
    FakeLive.latest?.accept();
    const result = await checking;
    expect(result.ok).toBe(true);
    expect(result.answer).toContain("accepted");
    expect(result.why).toContain("Live");
  });

  it("explains a real model that cannot hold a Live session — the mistake the field invites", async () => {
    const checking = testModel({
      asked: "gemini-2.5-flash",
      key,
      known,
      WebSocketImpl: FakeLive as unknown as typeof WebSocket,
      urlFor: (k) => liveUrl(k),
    });
    FakeLive.latest?.refuse(
      1008,
      "models/gemini-2.5-flash is not found for API version v1beta, or is not supported for bidiGenerateContent.",
    );
    const result = await checking;
    expect(result.ok).toBe(false);
    // The provider's sentence, verbatim, including the code it came with.
    expect(result.answer).toBe(
      "1008 — models/gemini-2.5-flash is not found for API version v1beta, or is not supported for bidiGenerateContent.",
    );
    // And the part the provider cannot say: WHICH of the two this is.
    expect(result.why).toContain("not a Live one");
    expect(result.why).toContain("audio in and sends audio back");
    expect(result.why).toContain("generateContent");
  });

  it("says a name the provider does not list is not in the list, and still tried it", async () => {
    const checking = testModel({
      asked: "models/gemini-9.9-does-not-exist",
      key,
      known,
      WebSocketImpl: FakeLive as unknown as typeof WebSocket,
      urlFor: (k) => liveUrl(k),
    });
    expect(FakeLive.latest, "a name not in the list must still be tried — that is the beta case").toBeTruthy();
    FakeLive.latest?.refuse(
      1008,
      "models/gemini-9.9-does-not-exist is not found for API version v1beta, or is not supported for bidiGenerateContent.",
    );
    const result = await checking;
    expect(result.ok).toBe(false);
    expect(result.answer).toContain("is not found for API version v1beta");
    expect(result.why).toContain("no model by this name is in the provider's list");
    expect(result.why).toContain("tried anyway");
  });

  it("does not open a socket for a name that is not shaped like one", async () => {
    const result = await testModel({
      asked: "gemini 2.5 flash!",
      key,
      known,
      WebSocketImpl: FakeLive as unknown as typeof WebSocket,
      urlFor: (k) => liveUrl(k),
    });
    expect(result.ok).toBe(false);
    expect(FakeLive.all).toHaveLength(0);
    expect(result.why).toBe("not a model name");
  });

  it("explains a Live model that is not conversational — the transcribe trap, 1007", async () => {
    const checking = testModel({
      asked: "models/gemini-3.5-transcribe-live",
      key,
      known: [
        ...KNOWN,
        {
          name: "models/gemini-3.5-transcribe-live",
          displayName: "Gemini 3.5 Transcribe Live",
          description: "Live transcription.",
          methods: ["bidiGenerateContent"],
          live: true,
        },
      ],
      WebSocketImpl: FakeLive as unknown as typeof WebSocket,
      urlFor: (k) => liveUrl(k),
    });
    // Measured: this model accepts the setup and then refuses the modality.
    FakeLive.latest?.refuse(1007, "Response modality is not supported");
    const result = await checking;
    expect(result.ok).toBe(false);
    expect(result.answer).toContain("1007");
    expect(result.why).toContain("Live model, but not a conversational one");
    expect(result.why).toContain("does not send AUDIO back");
    expect(result.why).toContain("Transcription and translation models");
  });

  it("says the provider did not answer, rather than pretending it refused", async () => {
    const result = await testModel({
      asked: "models/gemini-3.1-flash-live-preview",
      key,
      known,
      WebSocketImpl: FakeLive as unknown as typeof WebSocket,
      urlFor: (k) => liveUrl(k),
      timeoutMs: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.answer).toContain("did not answer within");
  });
});

describe("the harness's own routes", () => {
  let close: (() => Promise<void>) | null = null;
  afterEach(async () => {
    await close?.();
    close = null;
  });

  async function serve(model?: string, withKey = true) {
    // A key is what makes the list and the check possible at all; the provider
    // calls are stubbed, so this is a synthetic one.
    if (withKey) await writeVoiceKey(home, key);
    const server = await startVoiceServer({
      home,
      port: 0,
      identity: { session: "Voice", harness: "agent" },
      canvas: "prj_1",
      daemonPort: Number(new URL(base).port),
      ...(model ? { model } : {}),
      fetchImpl: listFetch(),
      WebSocketImpl: FakeLive as unknown as typeof WebSocket,
    });
    close = server.close;
    return server;
  }

  const state = async (server: { state: { url: string } }) =>
    (await (await fetch(`${server.state.url}state`)).json()) as {
      provider: { model: string; modelSource: string; modelLive: string | null };
    };

  it("reports the shipped default, then the stored choice, and where each came from", async () => {
    const server = await serve();
    expect((await state(server)).provider).toMatchObject({ model: LIVE_MODEL, modelSource: "default", modelLive: null });

    const stored = (await (
      await fetch(`${server.state.url}model`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "gemini-9.9-beta" }),
      })
    ).json()) as Record<string, unknown>;
    expect(stored).toMatchObject({ ok: true, model: "models/gemini-9.9-beta", source: "stored", appliesTo: "now" });
    expect((await state(server)).provider).toMatchObject({ model: "models/gemini-9.9-beta", modelSource: "stored" });
  });

  it("refuses a malformed name at the door, and forgets the choice when asked", async () => {
    const server = await serve();
    const refused = await fetch(`${server.state.url}model`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "gemini 2.5 flash!" }),
    });
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { error: string }).error).toContain("not shaped like a Gemini model name");

    await fetch(`${server.state.url}model`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "models/gemini-9.9-beta" }),
    });
    const forgotten = (await (
      await fetch(`${server.state.url}model`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "" }),
      })
    ).json()) as Record<string, unknown>;
    expect(forgotten).toMatchObject({ ok: true, source: "default", model: LIVE_MODEL });
    expect((await state(server)).provider.modelSource).toBe("default");
  });

  it("serves the provider's list, and checks a model against it", async () => {
    const server = await serve();
    const list = (await (await fetch(`${server.state.url}models`)).json()) as {
      ok: boolean;
      models: { live: boolean }[];
    };
    expect(list.ok).toBe(true);
    expect(list.models).toHaveLength(3);
    expect(list.models.filter((one) => one.live)).toHaveLength(2);

    const checking = fetch(`${server.state.url}model/test`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "gemini-2.5-flash" }),
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    FakeLive.latest?.refuse(1008, "models/gemini-2.5-flash is not found for API version v1beta, or is not supported for bidiGenerateContent.");
    const result = (await (await checking).json()) as { ok: boolean; why: string };
    expect(result.ok).toBe(false);
    expect(result.why).toContain("not a Live one");
  });

  it("says there is no list to fetch when no key is stored, rather than an empty one", async () => {
    const server = await serve(undefined, false);
    const list = (await (await fetch(`${server.state.url}models`)).json()) as { ok: boolean; answer: string };
    expect(list.ok).toBe(false);
    expect(list.answer).toContain("no key stored");
  });

  it("keeps the choice across a restart — the point of storing it", async () => {
    const first = await serve();
    await fetch(`${first.state.url}model`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "models/gemini-9.9-beta" }),
    });
    await first.close();
    close = null;

    const second = await serve();
    expect((await state(second)).provider).toMatchObject({ model: "models/gemini-9.9-beta", modelSource: "stored" });
  });

  it("lets --model win for the run, and says that is what happened", async () => {
    await writeVoiceModel(home, "models/gemini-stored-choice");
    const server = await serve("gemini-3.6-flash-live-preview");
    // The flag is not silently ignored in favour of the file, and the file is
    // not silently ignored in favour of the flag: the source is reported.
    expect((await state(server)).provider).toMatchObject({
      model: "gemini-3.6-flash-live-preview",
      modelSource: "flag",
    });
  });

  it("needs a key before it will test anything", async () => {
    const server = await serve(undefined, false);
    const result = (await (
      await fetch(`${server.state.url}model/test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "models/gemini-3.1-flash-live-preview" }),
      })
    ).json()) as { ok: boolean; answer: string };
    expect(result.ok).toBe(false);
    expect(result.answer).toContain("no key stored");
    // A key would be needed for the list too, which the route above shows.
    await writeVoiceKey(home, key);
    const withKey = (await (await fetch(`${server.state.url}models`)).json()) as { ok: boolean };
    expect(withKey.ok).toBe(true);
  });
});
