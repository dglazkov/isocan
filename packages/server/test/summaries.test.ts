import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CANVAS_GROUPS_FEATURE } from "@isocan/core";
import { CLAUDE_TEXT_MODEL } from "@isocan/core/jev";
import { TEXT_OWNER_ONLY } from "@isocan/core/keys";
import { writeKey } from "@isocan/core/keystore";
import {
  SEMANTIC_ZOOM_PROMPT_VERSION, summariesRoute, summaryKey, summaryMembers, SUMMARY_EXCLUDED, SUMMARY_MODEL, SUMMARY_NO_SOURCE, SUMMARY_QUIET, SUMMARY_SYSTEM, textSummaryKey,
  type SummaryEntry, type SummaryRead,
} from "@isocan/core/semantic-zoom";
import { TEXT_ROUTE } from "@isocan/core/text";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Semantic Zoom's summaries at the home** (phase 1: text nodes;
 * `docs/projects/semantic-zoom/design.md` §4–§7).
 *
 * What is held: a viewer may read summaries and may not cause one; owner-only
 * spend holds for a stored key; a note changed in the last 30 s is not
 * summarised, and is once it has been quiet; two requests for one key make
 * one call; a short note and an excluded one never reach a model; the make
 * asks with a summary's own system line and the cheap model and without the
 * fallbacks the cheap tier lacks, while `/api/text` still asks as it always
 * did; an edit gives a new key and the old summary is read back as stale; an
 * undo restores the old key and its summary; and nothing a summary does is an
 * op. A real daemon on a temp home, a fake provider; never a real model.
 *
 * Fixtures are synthetic: Acme, Priya, Ravi, a made-up key.
 */

const KEY = "sk-ant-fake_SUMMARY_DO_NOT_PRINT_";
const priya = { id: "usr_priya", name: "Priya" };
const ravi = { id: "usr_ravi", name: "Ravi" };
const CANVAS = "prj_acme_summaries";
const LONG = `# Acme launch notes\n\n${"The Acme launch slips two weeks while Ravi rewrites the pricing page and the team settles the open question on data residency for the warehouse customers. ".repeat(3)}`;
const SHORT = "# Acme reminder\n\nCall the warehouse on Monday.";
const SUMMARY = "Acme's launch slips two weeks; Ravi owns pricing; data residency is still open.";

interface Call { body: Record<string, unknown> }
interface Rig {
  daemon: Daemon;
  base: string;
  home: string;
  owner: TestBadge;
  calls: Call[];
  clock: { now: number };
}
const rigs: Rig[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const r of rigs.splice(0).reverse()) {
    await r.daemon.close();
    await fsp.rm(r.home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

const claudeSays = (value: unknown) =>
  new Response(JSON.stringify({ id: "msg_acme", type: "message", role: "assistant", model: SUMMARY_MODEL, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(value) }] }), { status: 200 });

async function rig(opts: { storedKey?: boolean; answer?: () => Promise<Response>; legacy?: boolean } = {}): Promise<Rig> {
  const home = await fsp.mkdtemp(path.join(os.tmpdir(), "isocan-summaries-"));
  const calls: Call[] = [];
  const clock = { now: Date.now() };
  const fake = (async (_url: string, init: RequestInit) => {
    calls.push({ body: JSON.parse(String(init.body)) as Record<string, unknown> });
    return opts.answer ? opts.answer() : claudeSays({ summary: SUMMARY });
  }) as unknown as typeof fetch;
  if (opts.storedKey) {
    await fsp.writeFile(path.join(home, "identity.json"), JSON.stringify(priya));
    await writeKey(home, "anthropic", KEY);
  }
  const daemon = await startDaemon({
    port: 0, home, auth: null, contentPort: "off", birthHome: null,
    text: opts.storedKey ? { fetch: fake } : { key: () => KEY, fetch: fake },
    summaries: { now: () => clock.now },
  });
  const address = daemon.app.server.address();
  const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  const owner = await mintTestBadge(base);
  await owner.speakAs(priya);
  const made = await op(base, owner, { type: "project.create", canvasId: CANVAS, title: "Acme Summaries", ...(opts.legacy ? { groupMode: "legacy" } : {}) }, null);
  expect(made.ok).toBe(true);
  const r = { daemon, base, home, owner, calls, clock };
  rigs.push(r);
  return r;
}

function op(base: string, badge: TestBadge, body: unknown, canvasId: string | null = CANVAS) {
  return fetch(`${base}/api/ops`, { method: "POST", headers: { "Content-Type": "application/json", ...badge.headers }, body: JSON.stringify({ canvasId, actor: priya, op: body, clientFeatures: CANVAS_GROUPS_FEATURE }) });
}

/** A text node with these words, added as `version`, and the clock moved past its quiet period. */
async function note(r: Rig, itemId: string, words: string, properties: Record<string, string> = {}): Promise<void> {
  const blob = await r.daemon.store.putBlob(CANVAS, Buffer.from(words), { mimeType: "text/markdown", filename: "note.md" });
  const res = await op(r.base, r.owner, {
    type: "item.add", itemId, title: words.split("\n")[0]!.replace(/^#\s*/, ""), width: 320, height: 200,
    placement: { x: 0, y: 0, chosen: true }, properties: { kind: "text", ...properties },
    version: { id: `ver_${itemId}_1`, blobHash: blob.blobHash, mimeType: "text/markdown", filename: "note.md", size: Buffer.byteLength(words) },
  });
  expect(res.ok, await res.clone().text()).toBe(true);
  r.clock.now = Date.now() + 31_000;
}

async function itemOf(r: Rig, itemId: string) {
  return (await r.daemon.engine.getSnapshot(CANVAS)).canvas.items[itemId]!;
}

const make = (r: Rig, badge: TestBadge, sourceId: string, kind = "text") =>
  fetch(`${r.base}${summariesRoute(CANVAS)}`, { method: "POST", headers: { "Content-Type": "application/json", ...badge.headers }, body: JSON.stringify({ kind, sourceId }) });

const read = async (r: Rig, badge: TestBadge, keys: string[], sources: string[] = []) => {
  const res = await fetch(`${r.base}${summariesRoute(CANVAS)}?keys=${keys.join(",")}${sources.length ? `&for=${sources.join(",")}` : ""}`, { headers: badge.headers });
  expect(res.status, await res.clone().text()).toBe(200);
  return ((await res.json()) as SummaryRead).summaries;
};

async function viewer(r: Rig): Promise<TestBadge> {
  for (const grant of await r.daemon.desk.grantsFor(CANVAS)) await r.daemon.desk.revokeGrant(grant.id, new Date().toISOString(), r.owner.badgeId);
  const shared = await fetch(`${r.base}/api/projects/${CANVAS}/grants`, {
    method: "POST", headers: { "Content-Type": "application/json", ...r.owner.headers }, body: JSON.stringify({ subject: "link", capability: "view" }),
  });
  expect(shared.ok).toBe(true);
  return mintTestBadge(r.base);
}

describe("POST /api/projects/:id/summaries", () => {
  it("makes a summary with its own system line and the cheap model, keeps it at the home, and writes no op", async () => {
    const r = await rig();
    await note(r, "itm_long", LONG);
    const before = (await r.daemon.engine.getSnapshot(CANVAS)).lastSeq;
    const res = await make(r, r.owner, "itm_long");
    expect(res.status, await res.clone().text()).toBe(200);
    const entry = (await res.json()) as SummaryEntry;
    const key = await textSummaryKey(await itemOf(r, "itm_long"));
    expect(entry).toMatchObject({ key, kind: "text", sourceIds: ["itm_long"], summary: SUMMARY, model: SUMMARY_MODEL, promptVersion: SEMANTIC_ZOOM_PROMPT_VERSION, madeFor: "home" });
    expect(r.calls).toHaveLength(1);
    const asked = r.calls[0]!.body;
    expect(asked.model).toBe(SUMMARY_MODEL);
    expect(asked.system).toBe(SUMMARY_SYSTEM);
    expect(asked).not.toHaveProperty("fallbacks");
    expect(JSON.stringify(asked.messages)).toContain("Ravi rewrites the pricing page");
    expect(existsSync(path.join(r.home, "summaries", CANVAS, `${key}.json`))).toBe(true);
    // Not an op: the canvas's sequence did not move.
    expect((await r.daemon.engine.getSnapshot(CANVAS)).lastSeq).toBe(before);
    // Asked again, it is read from the cache: no second call.
    expect((await make(r, r.owner, "itm_long")).status).toBe(200);
    expect(r.calls).toHaveLength(1);

    // `/api/text` is unchanged for its own callers: the copywriter's system line, its model, its fallbacks.
    const text = await fetch(`${r.base}${TEXT_ROUTE}`, {
      method: "POST", headers: { "Content-Type": "application/json", ...r.owner.headers },
      body: JSON.stringify({ canvasId: CANVAS, prompt: "Write Acme's heading.", schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] } }),
    });
    expect(text.status).toBe(200);
    expect(r.calls[1]!.body).toMatchObject({ model: CLAUDE_TEXT_MODEL, fallbacks: "default" });
    expect(String(r.calls[1]!.body.system)).toMatch(/words on an app's screens/);
  });

  it("waits for a note to go quiet: changed moments ago is refused with how long to wait, and nothing is asked", async () => {
    const r = await rig();
    await note(r, "itm_long", LONG);
    const created = Date.parse((await itemOf(r, "itm_long")).versions[0]!.createdAt);
    r.clock.now = created + 1_000;
    const early = await make(r, r.owner, "itm_long");
    expect(early.status).toBe(202);
    const said = (await early.json()) as { code: string; retryAfterMs: number };
    expect(said.code).toBe(SUMMARY_QUIET);
    expect(said.retryAfterMs).toBe(29_000);
    expect(r.calls).toHaveLength(0);
    r.clock.now = created + 30_000;
    expect((await make(r, r.owner, "itm_long")).status).toBe(200);
    expect(r.calls).toHaveLength(1);
  });

  it("makes one call for two requests for the same key", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const r = await rig({ answer: async () => (await gate, claudeSays({ summary: SUMMARY })) });
    await note(r, "itm_long", LONG);
    const first = make(r, r.owner, "itm_long");
    const second = make(r, r.owner, "itm_long");
    await vi.waitFor(() => expect(r.calls).toHaveLength(1));
    release();
    const [a, b] = await Promise.all([first, second]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(((await b.json()) as SummaryEntry).summary).toBe(SUMMARY);
    expect(r.calls).toHaveLength(1);
  });

  it("never sends a short note or an excluded one to a model", async () => {
    const r = await rig();
    await note(r, "itm_short", SHORT);
    const short = await make(r, r.owner, "itm_short");
    expect(short.status).toBe(200);
    expect(await short.json()).toMatchObject({ short: true, summary: null });
    await note(r, "itm_secret", LONG.replace("Acme", "Acme secret"), { context: "excluded" });
    const excluded = await make(r, r.owner, "itm_secret");
    expect(excluded.status).toBe(422);
    expect(await excluded.json()).toMatchObject({ code: SUMMARY_EXCLUDED });
    expect(r.calls).toHaveLength(0);
  });

  it("drops an answer that breaks the answer rule, and caches nothing", async () => {
    const r = await rig({ answer: async () => claudeSays({ summary: "Here is a summary:\n- one\n- two" }) });
    await note(r, "itm_long", LONG);
    expect((await make(r, r.owner, "itm_long")).status).toBe(502);
    const key = await textSummaryKey(await itemOf(r, "itm_long"));
    expect(await read(r, r.owner, [key])).toEqual({});
  });
});

describe("who may read and who may cause", () => {
  it("a viewer reads a summary an editor's key paid for, and cannot cause one", async () => {
    const r = await rig();
    await note(r, "itm_long", LONG);
    await note(r, "itm_other", LONG.replace("Acme launch", "Acme retro"));
    expect((await make(r, r.owner, "itm_long")).status).toBe(200);
    const visitor = await viewer(r);
    const key = await textSummaryKey(await itemOf(r, "itm_long"));
    expect((await read(r, visitor, [key]))[key]?.summary).toBe(SUMMARY);
    const refused = await make(r, visitor, "itm_other");
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: "view-only" });
    expect(r.calls).toHaveLength(1);
  });

  it("a stored key pays only for its owner: a collaborator is refused with the owner-only code before anything is asked", async () => {
    const r = await rig({ storedKey: true });
    await note(r, "itm_long", LONG);
    const ravisBadge = await mintTestBadge(r.base);
    await ravisBadge.speakAs(ravi);
    const refused = await make(r, ravisBadge, "itm_long");
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: TEXT_OWNER_ONLY });
    expect(r.calls).toHaveLength(0);
    const paid = await make(r, r.owner, "itm_long");
    expect(paid.status).toBe(200);
    expect(await paid.json()).toMatchObject({ madeFor: priya.id });
    expect(r.calls).toHaveLength(1);
  });
});

describe("the key follows the content", () => {
  it("an edit reads the old summary back as stale; an undo restores the old key and finds it current", async () => {
    const r = await rig();
    await note(r, "itm_long", LONG);
    expect((await make(r, r.owner, "itm_long")).status).toBe(200);
    const oldKey = await textSummaryKey(await itemOf(r, "itm_long"));

    // A move keeps the key.
    expect((await op(r.base, r.owner, { type: "item.move", itemId: "itm_long", x: 400, y: 80 })).ok).toBe(true);
    expect(await textSummaryKey(await itemOf(r, "itm_long"))).toBe(oldKey);

    const edited = `${LONG}\nRavi adds a line.`;
    const blob = await r.daemon.store.putBlob(CANVAS, Buffer.from(edited), { mimeType: "text/markdown", filename: "note.md" });
    expect((await op(r.base, r.owner, { type: "item.addVersion", itemId: "itm_long", version: { id: "ver_itm_long_2", blobHash: blob.blobHash, mimeType: "text/markdown", filename: "note.md", size: edited.length } })).ok).toBe(true);
    const newKey = await textSummaryKey(await itemOf(r, "itm_long"));
    expect(newKey).not.toBe(oldKey);
    const stale = await read(r, r.owner, [newKey], ["itm_long"]);
    expect(stale[newKey]).toMatchObject({ key: oldKey, summary: SUMMARY, stale: true });
    expect(await read(r, r.owner, [newKey])).toEqual({});

    const undone = await fetch(`${r.base}/api/projects/${CANVAS}/undo`, { method: "POST", headers: { "Content-Type": "application/json", ...r.owner.headers }, body: JSON.stringify({ actor: priya }) });
    expect(undone.ok, await undone.clone().text()).toBe(true);
    expect(await textSummaryKey(await itemOf(r, "itm_long"))).toBe(oldKey);
    const found = await read(r, r.owner, [oldKey], ["itm_long"]);
    expect(found[oldKey]).toMatchObject({ summary: SUMMARY });
    expect(found[oldKey]?.stale).toBeUndefined();
    expect(r.calls).toHaveLength(1);
  });
});

/** A card (an uploaded Markdown file, not a text node) with these words, at a point; the clock past its quiet period. */
async function card(r: Rig, itemId: string, title: string, words: string, x: number, y: number, extra: Record<string, unknown> = {}): Promise<void> {
  const blob = await r.daemon.store.putBlob(CANVAS, Buffer.from(words), { mimeType: "text/markdown", filename: "card.md" });
  const res = await op(r.base, r.owner, {
    type: "item.add", itemId, title, width: 200, height: 120, placement: { x, y, chosen: true }, ...extra,
    version: { id: `ver_${itemId}_1`, blobHash: blob.blobHash, mimeType: "text/markdown", filename: "card.md", size: Buffer.byteLength(words) },
  });
  expect(res.ok, await res.clone().text()).toBe(true);
  r.clock.now = Date.now() + 31_000;
}

/** A legacy area: a sheet things are placed on, holding what sits inside it by geometry. Only a legacy canvas has them; a groups canvas's "area" is a group. */
async function area(r: Rig, itemId: string, title: string, x: number): Promise<void> {
  const blob = await r.daemon.store.putBlob(CANVAS, Buffer.from(""), { mimeType: "text/markdown", filename: "area.md" });
  const res = await op(r.base, r.owner, {
    type: "item.add", itemId, title, width: 400, height: 600, placement: { x, y: 0, chosen: true }, properties: { kind: "area" },
    version: { id: `ver_${itemId}_1`, blobHash: blob.blobHash, mimeType: "text/markdown", filename: "area.md", size: 0 },
  });
  expect(res.ok, await res.clone().text()).toBe(true);
}

async function containerKey(r: Rig, kind: "group" | "area", id: string): Promise<string> {
  const held = summaryMembers((await r.daemon.engine.getSnapshot(CANVAS)).canvas, kind, id);
  if (!held || held === "excluded") throw new Error(`no ${kind} ${id}`);
  return summaryKey(kind, [held.container, ...held.members]);
}

const prompts = (r: Rig) => r.calls.map((call) => JSON.stringify(call.body.messages));

describe("groups and areas (phase 2)", () => {
  it("an area is summarised from what sits inside it, collected by the home; a card dragged across waits out the quiet period in both areas, then changes both", async () => {
    const r = await rig({ legacy: true });
    await area(r, "itm_todo", "To do", 0);
    await area(r, "itm_doing", "Doing", 500);
    await area(r, "itm_done", "Done", 1000);
    await card(r, "itm_billing", "Billing migration", "Ravi moves Acme billing to the new ledger.", 100, 100);
    await card(r, "itm_copy", "Copy fix", "Ana rewrites the Acme empty state.", 100, 300);
    await card(r, "itm_safari", "Safari crash", "Ana is on the Acme Safari crash.", 600, 100);

    const todo = await make(r, r.owner, "itm_todo", "area");
    expect(todo.status, await todo.clone().text()).toBe(200);
    expect(await todo.json()).toMatchObject({ kind: "area", sourceIds: ["itm_todo", "itm_billing", "itm_copy"], summary: SUMMARY, key: await containerKey(r, "area", "itm_todo") });
    expect((await make(r, r.owner, "itm_doing", "area")).status).toBe(200);
    expect(r.calls).toHaveLength(2);
    expect(prompts(r)[0]).toContain('This is an area on a board, titled \\"To do\\", holding 2 items.');
    expect(prompts(r)[0]).toContain("Ravi moves Acme billing");
    expect(prompts(r)[0]).not.toContain("Safari crash");
    expect(prompts(r)[1]).toContain("Safari crash");

    // A move inside an area keeps its key and makes nothing.
    const todoKey = await containerKey(r, "area", "itm_todo");
    expect((await op(r.base, r.owner, { type: "item.move", itemId: "itm_billing", x: 150, y: 420 })).ok).toBe(true);
    expect(await containerKey(r, "area", "itm_todo")).toBe(todoKey);
    r.clock.now = Date.now() + 1_000;
    expect((await make(r, r.owner, "itm_todo", "area")).status).toBe(200);
    expect(r.calls).toHaveLength(2);

    // From To do to Doing: both keys change, and both wait — To do through what its last summary held.
    const doingKey = await containerKey(r, "area", "itm_doing");
    expect((await op(r.base, r.owner, { type: "item.move", itemId: "itm_copy", x: 600, y: 300 })).ok).toBe(true);
    expect(await containerKey(r, "area", "itm_todo")).not.toBe(todoKey);
    expect(await containerKey(r, "area", "itm_doing")).not.toBe(doingKey);
    r.clock.now = Date.now() + 1_000;
    for (const id of ["itm_todo", "itm_doing"]) {
      const early = await make(r, r.owner, id, "area");
      expect(early.status, id).toBe(202);
      expect(await early.json()).toMatchObject({ code: SUMMARY_QUIET });
    }
    expect(r.calls).toHaveLength(2);
    // Meanwhile a reader is handed the old summary, marked stale.
    const newTodo = await containerKey(r, "area", "itm_todo");
    expect((await read(r, r.owner, [newTodo], ["itm_todo"]))[newTodo]).toMatchObject({ key: todoKey, stale: true });

    r.clock.now = Date.now() + 31_000;
    expect((await make(r, r.owner, "itm_todo", "area")).status).toBe(200);
    expect((await make(r, r.owner, "itm_doing", "area")).status).toBe(200);
    expect(r.calls).toHaveLength(4);
    expect(prompts(r)[2]).not.toContain("empty state");
    expect(prompts(r)[3]).toContain("empty state");
  });

  it("a group's summary never carries an excluded member, nor anything under an excluded group; an excluded group is refused", async () => {
    const r = await rig();
    await card(r, "itm_signup", "Sign-up", "Acme sign-up asks for a work email.", 0, 0);
    await card(r, "itm_secret", "Pricing", "ACME-CONFIDENTIAL margins are forty percent.", 300, 0, { properties: { context: "excluded" } });
    await card(r, "itm_deep", "Deep", "ACME-CONFIDENTIAL board notes.", 600, 0);
    const brief = await r.daemon.store.putBlob(CANVAS, Buffer.from("# Onboarding\n"), { mimeType: "text/markdown", filename: "brief.md" });
    const version = (id: string) => ({ id: `ver_${id}`, blobHash: brief.blobHash, mimeType: "text/markdown", filename: "brief.md", size: 13 });
    const group = (id: string, title: string, itemIds: string[]) => op(r.base, r.owner, { type: "group.change", action: { kind: "create", group: { id, title, version: version(id) }, itemIds } });
    expect((await group("itm_hidden", "Hidden", ["itm_deep"])).ok).toBe(true);
    expect((await op(r.base, r.owner, { type: "item.update", itemId: "itm_hidden", patch: { properties: { context: "excluded" } } })).ok).toBe(true);
    const made = await group("itm_onboarding", "Onboarding", ["itm_signup", "itm_secret", "itm_hidden"]);
    expect(made.ok, await made.clone().text()).toBe(true);
    r.clock.now = Date.now() + 31_000;

    const res = await make(r, r.owner, "itm_onboarding", "group");
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toMatchObject({ kind: "group", sourceIds: ["itm_onboarding", "itm_signup"] });
    expect(r.calls).toHaveLength(1);
    expect(prompts(r)[0]).toContain("work email");
    expect(prompts(r)[0]).not.toMatch(/CONFIDENTIAL|margins|board notes/);

    const refused = await make(r, r.owner, "itm_hidden", "group");
    expect(refused.status).toBe(422);
    expect(await refused.json()).toMatchObject({ code: SUMMARY_EXCLUDED });
    expect(r.calls).toHaveLength(1);
  });

  it("over the size bound, the longest members' words are left out first, their titles kept, and the prompt says so", async () => {
    const r = await rig({ legacy: true });
    await area(r, "itm_board", "Acme board", 0);
    await card(r, "itm_small", "Small", "Acme small card.", 100, 100);
    await card(r, "itm_mid", "Mid", `MIDWORD ${"m".repeat(30_000)}`, 100, 250);
    await card(r, "itm_big", "Big", `BIGWORD ${"b".repeat(40_000)}`, 100, 400);
    expect((await make(r, r.owner, "itm_board", "area")).status).toBe(200);
    const prompt = prompts(r)[0]!;
    expect(prompt).toContain("1 item, the longest, is given by title only.");
    expect(prompt).toContain("MIDWORD");
    expect(prompt).not.toContain("BIGWORD");
    expect(prompt).toContain('- Card \\"Big\\"');
  });

  it("holds the same guards: a viewer reads and never causes, a stored key pays only for its owner, and a kind must match its source", async () => {
    const r = await rig({ storedKey: true, legacy: true });
    await area(r, "itm_doing", "Doing", 0);
    await card(r, "itm_safari", "Safari crash", "Ana is on the Acme Safari crash.", 100, 100);
    const ravisBadge = await mintTestBadge(r.base);
    await ravisBadge.speakAs(ravi);
    const notHis = await make(r, ravisBadge, "itm_doing", "area");
    expect(notHis.status).toBe(403);
    expect(await notHis.json()).toMatchObject({ code: TEXT_OWNER_ONLY });
    expect((await make(r, r.owner, "itm_doing", "group")).status).toBe(404);
    expect((await make(r, r.owner, "itm_safari", "area")).status).toBe(404);
    const unknown = await make(r, r.owner, "itm_doing", "board");
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toMatchObject({ code: SUMMARY_NO_SOURCE });
    expect(r.calls).toHaveLength(0);
    expect((await make(r, r.owner, "itm_doing", "area")).status).toBe(200);
    const visitor = await viewer(r);
    const key = await containerKey(r, "area", "itm_doing");
    expect((await read(r, visitor, [key]))[key]?.summary).toBe(SUMMARY);
    await card(r, "itm_more", "More", "Another Acme card.", 100, 300);
    const refused = await make(r, visitor, "itm_doing", "area");
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: "view-only" });
    expect(r.calls).toHaveLength(1);
  });

  it("an empty area is nothing to summarise: remembered as short, and no model is asked", async () => {
    const r = await rig({ legacy: true });
    await area(r, "itm_empty", "Empty", 0);
    r.clock.now = Date.now() + 31_000;
    const res = await make(r, r.owner, "itm_empty", "area");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ short: true, summary: null, sourceIds: ["itm_empty"] });
    expect(r.calls).toHaveLength(0);
  });
});
