// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EditorView } from "@codemirror/view";
import type { Actor, Item, ItemVersion, NewVersion } from "@isocan/core";

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
