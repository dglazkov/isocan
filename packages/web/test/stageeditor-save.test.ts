// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EditorView } from "@codemirror/view";
import type { Actor, CanvasState, Item, ItemVersion, NewVersion } from "@isocan/core";

/**
 * **The stage editor's save is the save of the item on screen, and its own
 * version is not somebody else's** (cleanup RH-3 and RH-4, 27 Sep 2026).
 *
 * RH-4: the ⌘S binding is built once, when CodeMirror mounts, and it called
 * the `save` of THAT render — whose `current`, `source` and visual face are
 * the version the editor opened on. Once another version landed, ⌘S uploaded
 * under the old version's filename and carried its visual forward, while the
 * Save button (a fresh closure every render) did the right thing. Two ways to
 * save, two answers.
 *
 * RH-3: "vN landed while you edited" compares the item's current version to
 * the one the buffer started from. Your own save lands on the item before its
 * receipt comes back — and for the whole wait when the home queues it — so
 * the note announced your own version as somebody else's.
 *
 * The real component under jsdom (`createRoot`), a real CodeMirror, and the
 * network edge stubbed: the blob store and the op send.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom lays nothing out; CodeMirror's selection layer measures a Range anyway.
const noRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Range.prototype.getClientRects ??= noRects;
Range.prototype.getBoundingClientRect ??= () => new DOMRect();

const edge = vi.hoisted(() => ({ upload: vi.fn(), send: vi.fn(), read: vi.fn() }));
vi.mock("../src/lib/api.ts", async (original) => ({
  ...(await original<object>()),
  readBlobText: edge.read,
  uploadBlob: edge.upload,
  getSnapshot: () => new Promise(() => {}),
}));
vi.mock("../src/stores/canvasStore.ts", async (original) => ({
  ...(await original<object>()),
  sendEchoedResult: edge.send,
  setNotice: () => {},
}));
vi.mock("../src/lib/groupplacement.ts", () => ({ creationDestination: () => ({ originGroupMode: "groups" }) }));

const { useCanvasStore } = await import("../src/stores/canvasStore.ts");
const { newWrite } = await import("../src/lib/writequeue.ts");
const { StageEditor } = await import("../src/components/StageEditor.tsx");

const acme: Actor = { id: "usr_acme", name: "Acme" };
const other: Actor = { id: "usr_other", name: "Acme teammate" };
const v1: ItemVersion = { id: "ver_1", blobHash: "1".repeat(64), mimeType: "text/markdown", filename: "acme.md", size: 5 } as ItemVersion;
const itemAt = (versions: ItemVersion[]): Item =>
  ({ id: "itm_acme", title: "Acme notes", versions, currentVersionId: versions.at(-1)!.id }) as unknown as Item;

let root: Root;
let host: HTMLDivElement;
const props = (item: Item) => ({ canvasId: "prj_acme", item, actor: acme, onDraft: () => {} });

beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  useCanvasStore.setState({ canvasId: null, confirmed: null, queue: [], refused: [] });
  try { localStorage.clear(); } catch { /* none */ }
  edge.upload.mockReset().mockResolvedValue({ blobHash: "f".repeat(64), size: 9 });
  edge.send.mockReset();
  edge.read.mockReset().mockResolvedValue("hello");
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(h(StageEditor, props(itemAt([v1])))));
  await act(async () => {});
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function editor(): EditorView {
  const view = EditorView.findFromDOM(host.querySelector(".cm-editor") as HTMLElement);
  expect(view, "CodeMirror did not mount — the case measures nothing").toBeTruthy();
  return view!;
}

async function type(text: string) {
  const view = editor();
  await act(async () => view.dispatch({ changes: { from: view.state.doc.length, insert: text } }));
}

describe("⌘S saves the item that is on screen now (RH-4)", () => {
  it("uploads under the current version's name, not the one the editor opened on", async () => {
    await type(" world");
    // A teammate's version lands while the buffer is open, under a new name.
    const theirs = { id: "ver_2", blobHash: "2".repeat(64), mimeType: "text/markdown", filename: "acme-renamed.md", size: 7, author: other } as unknown as ItemVersion;
    await act(async () => root.render(h(StageEditor, props(itemAt([v1, theirs])))));
    edge.send.mockResolvedValue({ status: "accepted" });
    const content = editor().contentDOM;
    await act(async () => {
      content.dispatchEvent(new KeyboardEvent("keydown", { key: "s", code: "KeyS", keyCode: 83, ctrlKey: true, metaKey: false, bubbles: true, cancelable: true }));
    });
    await act(async () => {});
    expect(edge.upload, "⌘S did not save at all — the keymap never ran").toHaveBeenCalledTimes(1);
    expect(edge.upload.mock.calls[0]![2], "⌘S saved under the filename of the version the editor opened on").toBe("acme-renamed.md");
    const sent = edge.send.mock.calls[0]![2] as { version: NewVersion };
    expect(sent.version.filename).toBe("acme-renamed.md");
  });
});

describe("your own save is not somebody else's version (RH-3)", () => {
  it("says nothing has landed while your save's own version is on the item", async () => {
    await type(" world");
    let finish: (value: { status: "accepted" }) => void = () => {};
    edge.send.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const save = [...host.querySelectorAll("button")].find((b) => b.textContent === "Save version");
    expect(save, "no Save button over a dirty buffer").toBeTruthy();
    await act(async () => save!.click());
    await act(async () => {});
    expect(edge.send, "the save never reached the op send").toHaveBeenCalledTimes(1);
    // The echo of OUR version reaches the item before the receipt does — and
    // for a queued save, for the whole wait.
    const op = edge.send.mock.calls[0]![2] as { version: NewVersion };
    const ours = { ...op.version, author: acme } as unknown as ItemVersion;
    await act(async () => root.render(h(StageEditor, props(itemAt([v1, ours])))));
    expect(host.textContent, "our own save was announced as a version that landed under us").not.toContain("landed while you edited");
    await act(async () => finish({ status: "accepted" }));
    expect(host.textContent).not.toContain("landed while you edited");
  });

  it("still says so when somebody else's version lands", async () => {
    // The note is not deleted, only aimed: the case it exists for still fires.
    await type(" world");
    const theirs = { id: "ver_2", blobHash: "2".repeat(64), mimeType: "text/markdown", filename: "acme.md", size: 7, author: other } as unknown as ItemVersion;
    await act(async () => root.render(h(StageEditor, props(itemAt([v1, theirs])))));
    expect(host.textContent).toContain("v2 landed while you edited");
  });
});


describe("offline Stage saves", () => {
  async function saveWithKey() {
    await act(async () => editor().contentDOM.dispatchEvent(new KeyboardEvent("keydown", {
      key: "s", code: "KeyS", keyCode: 83, ctrlKey: true, bubbles: true, cancelable: true,
    })));
  }

  it.each(["accepted", "refused"] as const)("stages the saved bytes once and retains newer typing when the home says %s", async (status) => {
    edge.upload.mockRejectedValue(Object.assign(new Error("Offline"), { offline: true }));
    let finish!: (value: { status: "accepted" | "refused"; message?: string }) => void;
    const completion = new Promise((resolve) => { finish = resolve; });
    edge.send.mockResolvedValue({ status: "queued", completion });
    await type(" offline");
    await saveWithKey();
    await act(async () => { await vi.waitFor(() => expect(edge.send).toHaveBeenCalledTimes(1)); });
    expect(edge.send.mock.calls[0]![5]).toMatchObject({ text: "hello offline", mimeType: "text/markdown", filename: "acme.md" });
    const version = (edge.send.mock.calls[0]![2] as { version: NewVersion }).version;
    expect(version.blobHash).toBe(edge.send.mock.calls[0]![5].blobHash);
    expect(version.size).toBe(new TextEncoder().encode("hello offline").length);
    await type(" and newer edits");
    await saveWithKey();
    expect(edge.send).toHaveBeenCalledTimes(1);
    expect(edge.upload).toHaveBeenCalledTimes(1);
    // The old draft remains until acceptance; a refusal never clears it.
    const originalKey = "isocan.draft.prj_acme.itm_acme.ver_1";
    await vi.waitFor(() => expect(localStorage.getItem(originalKey)).toBe("hello offline and newer edits"));
    await act(async () => finish({ status, message: "Synthetic refusal" }));
    expect(editor().state.doc.toString()).toBe("hello offline and newer edits");
    const key = status === "accepted" ? `isocan.draft.prj_acme.itm_acme.${version.id}` : originalKey;
    expect(localStorage.getItem(key)).toBe("hello offline and newer edits");
    expect([...host.querySelectorAll("button")].some((b) => b.textContent === "Save version" && !b.disabled)).toBe(true);
  });
});


describe("reopening an offline Stage save", () => {
  it.each([
    ["accepted", ""], ["accepted", " and newer edits"],
    ["refused", ""], ["refused", " and newer edits"],
  ] as const)("keeps the pending identity and draft on %s with suffix %j", async (status, suffix) => {
    edge.upload.mockRejectedValue(Object.assign(new Error("Offline"), { offline: true }));
    let finish!: (value: { status: "accepted" | "refused" }) => void;
    edge.send.mockResolvedValue({ status: "queued", completion: new Promise((resolve) => { finish = resolve; }) });
    await type(" offline");
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Save version")!.click());
    await act(async () => { await vi.waitFor(() => expect(edge.send).toHaveBeenCalledTimes(1)); });
    const op = edge.send.mock.calls[0]![2] as { type: "item.addVersion"; itemId: string; version: NewVersion };
    const ours = { ...op.version, author: acme } as unknown as ItemVersion;
    const queued = itemAt([v1, ours]);
    const stateAt = (item: Item) => ({ project: { id: "prj_acme" }, canvas: { items: { itm_acme: item } } }) as unknown as CanvasState;
    await act(async () => {
      useCanvasStore.setState({ canvasId: "prj_acme", confirmed: stateAt(itemAt([v1])), queue: [newWrite("op_stage", acme, op, undefined, "groups", edge.send.mock.calls[0]![5])] });
      root.render(h(StageEditor, props(queued)));
    });
    if (suffix) await type(suffix);
    await act(async () => root.unmount());
    edge.read.mockResolvedValue("hello offline");
    root = createRoot(host);
    await act(async () => root.render(h(StageEditor, props(queued))));
    expect(editor().state.doc.toString()).toBe(`hello offline${suffix}`);
    await act(async () => editor().contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "s", code: "KeyS", keyCode: 83, ctrlKey: true, bubbles: true, cancelable: true })));
    expect(edge.send).toHaveBeenCalledTimes(1);
    // The old component's completion must not clear the new component's draft.
    await act(async () => finish({ status }));
    await act(async () => useCanvasStore.setState({ queue: [], confirmed: stateAt(status === "accepted" ? queued : itemAt([v1])) }));
    expect(editor().state.doc.toString()).toBe(`hello offline${suffix}`);
    const key = `isocan.draft.prj_acme.itm_acme.${status === "accepted" ? ours.id : v1.id}`;
    expect(localStorage.getItem(key)).toBe(status === "accepted" && !suffix ? null : `hello offline${suffix}`);
    const save = [...host.querySelectorAll("button")].find((b) => b.textContent === "Save version");
    if (status === "accepted" && !suffix) expect(save).toBeUndefined();
    else expect(save?.disabled).toBe(false);
  });
});


it.each(["canvas", "actor"] as const)("replaces the editor when its %s changes without letting the old completion touch the replacement", async (identity) => {
  edge.upload.mockRejectedValue(Object.assign(new Error("Offline"), { offline: true }));
  let finish!: (value: { status: "accepted" }) => void;
  edge.send.mockResolvedValue({ status: "queued", completion: new Promise((resolve) => { finish = resolve; }) });
  await type(" offline");
  await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Save version")!.click());
  await act(async () => { await vi.waitFor(() => expect(edge.send).toHaveBeenCalledTimes(1)); });
  const originalView = editor();
  const originalMarker = localStorage.getItem("isocan.pending-stage.prj_acme.itm_acme.usr_acme");
  expect(originalMarker).not.toBeNull();
  const next = { ...props(itemAt([v1])), ...(identity === "canvas" ? { canvasId: "prj_other" } : { actor: other }) };
  await act(async () => root.render(h(StageEditor, next)));
  expect(editor()).not.toBe(originalView);
  await type(" different context");
  const text = editor().state.doc.toString();
  await act(async () => finish({ status: "accepted" }));
  expect(editor().state.doc.toString()).toBe(text);
  expect(localStorage.getItem("isocan.pending-stage.prj_acme.itm_acme.usr_acme")).toBe(originalMarker);
  expect([...host.querySelectorAll("button")].find(b => b.textContent === "Save version")?.disabled).toBe(false);
});
