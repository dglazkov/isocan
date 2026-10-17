import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ownerOnlySentence } from "@isocan/core/keys";
import { removeKey, setKeySharing, writeKey } from "@isocan/core/keystore";
import { IMAGE_BAD_REQUEST, IMAGE_MODEL_DEFAULT, IMAGE_OWNER_ONLY, IMAGE_RATE_LIMITED, IMAGE_REFUSED, IMAGE_ROUTE, IMAGE_UNAVAILABLE, IMAGE_UPSTREAM, MOOD_AXES, type ImageResponse } from "@isocan/core/mood";
import type { CanvasSnapshotResponse, Item } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { IMAGE_ENDPOINT } from "../src/image.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **`POST /api/image`** (moodboard phase 0; design §2). The mood board's
 * spread: the person's words wrapped in core's template once per axis, drawn
 * with this home's Gemini key, each picture a blob and an image item with
 * its provenance, laid out as a tray, all one undo — behind the voice
 * route's door: the canvas named and editable, the stored key spent only for
 * this machine's person unless sharing is on, a per-badge rate. And two
 * refusals ahead of the door that cost nothing: past the cap, and the
 * deny-list.
 *
 * A real daemon on a temp home, real badges over HTTP, a fake Google behind
 * the `fetch` seam answering a fixture PNG. What Google's live Interactions
 * endpoint answers is NOT proved here — no key in the suite, and spending
 * needs a person's yes. Synthetic fixtures: Acme, Priya, Ravi, made-up keys.
 */

const GEMINI = "fake-gemini-acme_MOOD_DO_NOT_PRINT_1234567890";
const priya = { id: "usr_priya", name: "Priya" };
const ravi = { id: "usr_ravi", name: "Ravi" };
const CANVAS = "prj_acme_mood";
const WORDS = "a quiet bakery at dawn";
/** A 1×1 PNG: the fixture every fake answer draws. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

interface Call { url: string; headers: Headers; body: { model: string; input: Array<{ type: string; text?: string; data?: string; mime_type?: string }>; response_format?: Record<string, unknown> } }
let daemon: Daemon;
let base: string;
let home: string;
let owner: TestBadge;
let calls: Call[];
let bodies: string[];
let logged: string[];
let googleAnswer: (call: Call) => Response;
let saved: string | undefined;

const drawn = () => new Response(JSON.stringify({ id: "int_acme", object: "interaction", status: "completed", steps: [{ type: "model_output", content: [{ type: "image", mime_type: "image/png", data: PNG.toString("base64") }] }] }), { status: 200 });

beforeEach(async () => {
  saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  logged = [];
  for (const level of ["log", "warn", "error", "info"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(" ")));
  }
  home = await fsp.mkdtemp(path.join(os.tmpdir(), "isocan-image-"));
  await fsp.writeFile(path.join(home, "identity.json"), JSON.stringify(priya));
  await writeKey(home, "gemini", GEMINI);
  calls = [];
  bodies = [];
  googleAnswer = drawn;
  const fake = (async (url: string, init: RequestInit) => {
    const call = { url: String(url), headers: new Headers(init.headers), body: JSON.parse(String(init.body)) as Call["body"] };
    calls.push(call);
    return googleAnswer(call);
  }) as unknown as typeof fetch;
  daemon = await startDaemon({ port: 0, home, auth: null, contentPort: "off", image: { fetch: fake, perMinute: 3 } });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  owner = await mintTestBadge(base);
  await owner.speakAs(priya);
  const made = await op(owner, priya, null, { type: "project.create", canvasId: CANVAS, title: "Acme Mood" });
  expect(made.ok).toBe(true);
});

afterEach(async () => {
  await daemon.close();
  vi.restoreAllMocks();
  await fsp.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  if (saved === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = saved;
  for (const text of [...bodies, ...logged]) expect(text).not.toContain(GEMINI);
});

function op(badge: TestBadge, actor: { id: string; name: string }, canvasId: string | null, operation: unknown): Promise<Response> {
  return fetch(`${base}/api/ops`, { method: "POST", headers: { "Content-Type": "application/json", ...badge.headers }, body: JSON.stringify({ canvasId, actor, op: operation }) });
}

const explore = async (badge: TestBadge, body: Record<string, unknown> = {}) => {
  const res = await fetch(`${base}${IMAGE_ROUTE}`, { method: "POST", headers: { "Content-Type": "application/json", ...badge.headers }, body: JSON.stringify({ canvasId: CANVAS, actor: priya, prompt: WORDS, ...body }) });
  const text = await res.text();
  bodies.push(text);
  return { status: res.status, text, json: JSON.parse(text) as ImageResponse & { code?: string; error?: string } };
};

const snapshot = async (): Promise<CanvasSnapshotResponse> => daemon.engine.getSnapshot(CANVAS);
const tiles = async (): Promise<Item[]> => Object.values((await snapshot()).canvas.items).filter((i) => i.properties.mood === "candidate");

const collaborator = async (): Promise<TestBadge> => {
  const badge = await mintTestBadge(base);
  await badge.speakAs(ravi);
  return badge;
};

describe("the image route: a spread of pictures, never the key", () => {
  it("draws nine by default, one per axis, each an image item with its provenance, laid out as a tray, all one undo", async () => {
    const answer = await explore(owner);
    expect(answer.status, answer.text).toBe(200);
    expect(answer.json.items).toHaveLength(9);
    expect(answer.json.model).toBe(IMAGE_MODEL_DEFAULT);
    expect(calls).toHaveLength(9);
    for (const call of calls) {
      expect(call.url).toBe(IMAGE_ENDPOINT);
      expect(call.headers.get("x-goog-api-key")).toBe(GEMINI);
      expect(call.url).not.toContain(GEMINI);
      expect(call.body.model).toBe(IMAGE_MODEL_DEFAULT);
      expect(call.body.input[0]!.text).toContain("not a user interface, not a screen");
      expect(call.body.input[0]!.text).toContain(`about: ${WORDS}.`);
      expect(call.body.response_format).toMatchObject({ type: "image" });
    }
    const added = await tiles();
    expect(added).toHaveLength(9);
    const axes = added.map((i) => i.properties.moodAxis).sort();
    expect(new Set(axes)).toEqual(new Set(MOOD_AXES.map((a) => a.axis)));
    for (const item of added) {
      expect(item.properties.moodRun).toBe(answer.json.run);
      expect(item.properties.moodModel).toBe(IMAGE_MODEL_DEFAULT);
      expect(item.properties.moodPrompt).toContain(`about: ${WORDS}.`);
      expect(item.properties.moodParent).toBeUndefined();
      const version = item.versions[0]!;
      expect(version.mimeType).toBe("image/png");
      expect(version.size).toBe(PNG.length);
    }
    expect(new Set(added.map((i) => `${i.x},${i.y}`)).size).toBe(9);
    // One undo takes the whole spread back.
    const undone = await fetch(`${base}/api/projects/${CANVAS}/undo`, { method: "POST", headers: { "Content-Type": "application/json", ...owner.headers }, body: JSON.stringify({ actor: priya }) });
    expect(undone.ok, await undone.clone().text()).toBe(true);
    expect(await tiles()).toHaveLength(0);
  });

  it("sends a parent picture beside the words and records it, for More like this", async () => {
    const first = await explore(owner, { n: 1 });
    expect(first.status, first.text).toBe(200);
    const parent = first.json.items[0]!.itemId;
    calls = [];
    const more = await explore(owner, { n: 2, parent });
    expect(more.status, more.text).toBe(200);
    for (const call of calls) {
      const image = call.body.input.find((b) => b.type === "image");
      expect(image?.mime_type).toBe("image/png");
      expect(Buffer.from(image!.data!, "base64").equals(PNG)).toBe(true);
    }
    const children = (await tiles()).filter((i) => i.properties.moodRun === more.json.run);
    expect(children.map((i) => i.properties.moodParent)).toEqual([parent, parent]);
    expect(children.map((i) => i.properties.moodAxis)).toEqual(["more: light", "more: material"]);
  });

  it("wraps a Push dial in the template, records push: <dial> · <axis>, and refuses an unknown dial", async () => {
    const bad = await explore(owner, { n: 1, push: "brighter" as never });
    expect(bad.status).toBe(400);
    expect(bad.json.code).toBe(IMAGE_BAD_REQUEST);
    expect(bad.json.error).toMatch(/push.*must be one of/);
    expect(calls).toHaveLength(0);

    const first = await explore(owner, { n: 1 });
    const parent = first.json.items[0]!.itemId;
    calls = [];
    const pushed = await explore(owner, { n: 2, parent, push: "warmer" });
    expect(pushed.status, pushed.text).toBe(200);
    expect(pushed.json.items.map((i) => i.axis)).toEqual(["push: warmer · light", "push: warmer · material"]);
    for (const call of calls) {
      const text = call.body.input.find((b) => b.type === "text")?.text ?? "";
      expect(text).toContain("Push the look warmer:");
    }
    const children = (await tiles()).filter((i) => i.properties.moodRun === pushed.json.run);
    expect(children.map((i) => i.properties.moodAxis)).toEqual(["push: warmer · light", "push: warmer · material"]);
    expect(children.map((i) => i.properties.moodParent)).toEqual([parent, parent]);
  });

  it("refuses a collaborator while sharing is off — nothing reaches Google — and serves them once it is on", async () => {
    const ravisBadge = await collaborator();
    const refused = await explore(ravisBadge, { actor: ravi });
    expect(refused.status, refused.text).toBe(403);
    expect(refused.json).toEqual({ code: IMAGE_OWNER_ONLY, error: ownerOnlySentence("Priya") });
    expect(calls).toHaveLength(0);
    await setKeySharing(home, true);
    const served = await explore(ravisBadge, { actor: ravi, n: 1 });
    expect(served.status, served.text).toBe(200);
    expect(calls).toHaveLength(1);
  });

  it("says when this home holds no Gemini key, and spends nothing", async () => {
    await removeKey(home, "gemini");
    const none = await explore(owner);
    expect(none.status, none.text).toBe(503);
    expect(none.json.code).toBe(IMAGE_UNAVAILABLE);
    expect(calls).toHaveLength(0);
  });

  it("refuses a spread past the cap, and a malformed ask, before anything is spent", async () => {
    for (const body of [{ n: 13 }, { n: 0 }, { n: 2.5 }, { prompt: "  " }, { actor: undefined }, { canvasId: "" }]) {
      const bad = await explore(owner, body);
      expect(bad.status, JSON.stringify(body)).toBe(400);
      expect(bad.json.code).toBe(IMAGE_BAD_REQUEST);
    }
    expect((await explore(owner, { n: 13 })).json.error).toMatch(/per-run cap/);
    expect(calls).toHaveLength(0);
  });

  it("refuses words naming a brand or a living artist, in words, before anything is spent", async () => {
    for (const prompt of ["a Nike store at dawn", "like Banksy on a bakery wall"]) {
      const refused = await explore(owner, { prompt });
      expect(refused.status, refused.text).toBe(422);
      expect(refused.json.code).toBe(IMAGE_REFUSED);
      expect(refused.json.error).toMatch(/refused before anything is spent/);
    }
    expect(calls).toHaveLength(0);
  });

  it("passes the model's own refusal through verbatim, and adds what it did draw", async () => {
    const REFUSAL = "I can't create that image because it may depict a real person.";
    let n = 0;
    googleAnswer = () => (++n === 2
      ? new Response(JSON.stringify({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: REFUSAL }] }] }), { status: 200 })
      : drawn());
    const some = await explore(owner, { n: 3 });
    expect(some.status, some.text).toBe(200);
    expect(some.json.items).toHaveLength(2);
    expect(some.json.refused).toHaveLength(1);
    expect(some.json.refused[0]!.why).toBe(REFUSAL);
    googleAnswer = () => new Response(JSON.stringify({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: REFUSAL }] }] }), { status: 200 });
    const none = await explore(owner, { n: 1 });
    expect(none.status).toBe(502);
    expect(none.json).toEqual({ code: IMAGE_UPSTREAM, error: REFUSAL });
  });

  it("passes Google's error on in its words, with the key scrubbed if Google quoted it", async () => {
    googleAnswer = () => new Response(JSON.stringify({ error: { message: `API key not valid: ${GEMINI}` } }), { status: 400 });
    const refused = await explore(owner, { n: 1 });
    expect(refused.status).toBe(502);
    expect(refused.json.code).toBe(IMAGE_UPSTREAM);
    expect(refused.json.error).toContain("API key not valid: [key]");
  });

  it("holds a badge to its rate of runs", async () => {
    for (let i = 0; i < 3; i++) expect((await explore(owner, { n: 1 })).status).toBe(200);
    const limited = await explore(owner, { n: 1 });
    expect(limited.status).toBe(429);
    expect(limited.json.code).toBe(IMAGE_RATE_LIMITED);
    expect(calls).toHaveLength(3);
  });
});
