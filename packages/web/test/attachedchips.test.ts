// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CanvasState, CommentThread, ContextManifest, Item } from "@isocan/core";
import { applyOperation, contextManifest } from "@isocan/core";
import { ComposePopover, ThreadPopover } from "../src/components/CommentPopovers.tsx";
import "../src/components/GroupContext.tsx";
import { Attached, needsContextManifestPreview } from "../src/components/MainThreadPanel.tsx";
import { NodeFocusChat } from "../src/components/NodeFocusChat.tsx";
import { manifestNeedsDisclosure, type useMessageContext } from "../src/lib/messagecontext.ts";
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import { useUiStore } from "../src/stores/uiStore.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const actor = { id: "usr_acme", name: "Acme" };
const stamp = {
  createdAt: "2026-10-15T00:00:00Z",
  createdBy: actor,
  updatedAt: "2026-10-15T00:00:00Z",
  updatedBy: actor,
};

function makeItem(id: string, title: string, opts?: { group?: boolean; image?: boolean }): Item {
  return {
    id,
    title,
    description: "",
    x: 0,
    y: 0,
    width: 320,
    height: 240,
    properties: opts?.group ? { kind: "group" } : {},
    currentVersionId: opts?.group ? "" : `ver_${id}`,
    versions: opts?.group
      ? []
      : [
          {
            id: `ver_${id}`,
            blobHash: `hash_${id}`,
            mimeType: opts?.image ? "image/png" : "text/html",
            filename: opts?.image ? `${id}.png` : `${id}.html`,
            size: 128,
            ...stamp,
          },
        ],
    ...stamp,
  };
}

function makeState(): CanvasState {
  const state = applyOperation(null, {
    id: "op_birth",
    canvasId: "prj_acme",
    actor,
    ts: stamp.createdAt,
    op: { type: "project.create", canvasId: "prj_acme", title: "Acme", groupMode: "groups" },
  })!;
  const items = [
    makeItem("itm_dash", "Acme Dashboard", { image: true }),
    makeItem("itm_blank", ""),
    makeItem("itm_group", "Navigation Group", { group: true }),
    makeItem("itm_four", "Fourth Screen", { image: true }),
    makeItem("itm_five", "Fifth Screen", { image: true }),
  ];
  state.canvas.items = Object.fromEntries(items.map((item) => [item.id, item]));
  return state;
}

type Context = ReturnType<typeof useMessageContext>;

function fakeContext(
  over: Omit<Partial<Context>, "manifest"> & { manifest?: Partial<ContextManifest> | null },
): Context {
  const baseManifest: ContextManifest = {
    canvasId: "prj_acme",
    revision: 2,
    includeExcluded: false,
    ambient: false,
    rootIds: ["itm_dash"],
    expandedIds: ["itm_dash"],
    counts: { included: 1, excluded: 0, unavailable: 0 },
    entries: [
      {
        itemId: "itm_dash",
        title: "Acme Dashboard",
        kind: "image",
        parentId: null,
        version: null,
        depth: 0,
        excluded: false,
        threadIds: [],
      },
    ],
  };
  const { manifest: manifestOver, ...rest } = over;
  return {
    enabled: true,
    request: { rootIds: ["itm_dash"], includeExcluded: false },
    includeExcluded: false,
    setIncludeExcluded: () => {},
    refresh: () => {},
    error: null,
    loading: false,
    stale: false,
    ...rest,
    manifest: manifestOver === null ? null : { ...baseManifest, ...manifestOver },
  } as Context;
}

describe("selected items in the chat composer", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    const state = makeState();
    useCanvasStore.setState({
      canvasId: state.project.id,
      record: state.project,
      canvas: state.canvas,
      confirmed: state,
      lastSeq: 1,
    });
    useUiStore.setState({ selectedItemIds: [] });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    useUiStore.setState({ selectedItemIds: [] });
  });

  it("renders circular item thumbnails, fallback kind glyphs, truncated titles, and remove buttons", async () => {
    useUiStore.setState({ selectedItemIds: ["itm_dash", "itm_blank", "itm_group"] });
    await act(async () => root.render(h(Attached, { canvasId: "prj_acme" })));
    const html = host.innerHTML;
    expect(html).toContain('class="attached"');
    expect(host.querySelectorAll(".attached-chip")).toHaveLength(3);
    expect(host.querySelector(".item-thumb")).not.toBeNull();
    expect(html).toContain("Acme Dashboard");
    // Untitled items fall back to "Untitled" rather than rendering an empty pill.
    expect(html).toContain("<b>Untitled</b>");
    expect(host.querySelector('[aria-label="Remove Acme Dashboard"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Remove Untitled"]')).not.toBeNull();
    // Versionless items (like groups) get a circular kind/group icon badge.
    expect(host.querySelector(".attached-kind")).not.toBeNull();
    expect(html).toContain("Navigation Group");
  });

  it("caps visible pills at 4 and summarizes overflow with +N", async () => {
    useUiStore.setState({
      selectedItemIds: ["itm_dash", "itm_blank", "itm_group", "itm_four", "itm_five"],
    });
    await act(async () => root.render(h(Attached, { canvasId: "prj_acme" })));
    expect(host.querySelectorAll(".attached-chip")).toHaveLength(4);
    expect(host.querySelector(".attached-more")?.textContent).toBe("+1");
  });

  it("suppresses the redundant group-context summary when only flat leaf items are selected", () => {
    expect(needsContextManifestPreview(fakeContext({}), ["itm_dash"])).toBe(false);
    // Loading state for flat selection also stays quiet so pills never jump.
    expect(needsContextManifestPreview(fakeContext({ manifest: null, loading: true }), ["itm_dash"])).toBe(false);
  });

  it("shows the group-context disclosure when a group expands, items are excluded, or #refs add roots", () => {
    expect(
      needsContextManifestPreview(
        fakeContext({
          manifest: {
            rootIds: ["itm_group"],
            expandedIds: ["itm_group", "itm_dash"],
            entries: [
              { itemId: "itm_group", title: "Navigation Group", kind: "group", parentId: null, version: null, depth: 0, excluded: false, threadIds: [] },
            ],
          },
        }),
        ["itm_group"],
      ),
    ).toBe(true);

    expect(
      needsContextManifestPreview(
        fakeContext({
          manifest: { counts: { included: 1, excluded: 1, unavailable: 0 } },
        }),
        ["itm_dash"],
      ),
    ).toBe(true);

    expect(
      needsContextManifestPreview(
        fakeContext({
          manifest: { rootIds: ["itm_dash", "itm_four"], expandedIds: ["itm_dash", "itm_four"] },
        }),
        ["itm_dash"],
      ),
    ).toBe(true);

    expect(needsContextManifestPreview(fakeContext({ error: "home unreachable" }), ["itm_dash"])).toBe(true);
    expect(manifestNeedsDisclosure(fakeContext({ manifest: { includeExcluded: true } }).manifest!, ["itm_dash"])).toBe(true);
  });
});

describe("anchored comment and node-focus composers omit redundant single-item context", () => {
  let host: HTMLDivElement;
  let root: Root;
  let state: CanvasState;

  beforeEach(() => {
    state = makeState();
    useCanvasStore.setState({
      canvasId: state.project.id,
      record: state.project,
      canvas: state.canvas,
      confirmed: state,
      lastSeq: 2,
      capability: "edit",
    });
    useUiStore.setState({ selectedItemIds: ["itm_dash"] });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (raw: string) => {
        const url = new URL(raw, "https://acme.test");
        if (url.pathname.endsWith("/context")) {
          const rootIds = url.searchParams.get("roots")?.split(",").filter(Boolean) ?? [];
          const includeExcluded = url.searchParams.get("includeExcluded") === "true";
          return Response.json(contextManifest(state, 2, { rootIds, includeExcluded }));
        }
        return Response.json([]);
      }),
    );
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    useUiStore.setState({ selectedItemIds: [] });
  });

  async function flush() {
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  it("hides the context card when composing a comment on a single flat screen, but shows it for a group", async () => {
    await act(async () => {
      root.render(
        h(ComposePopover, {
          canvasId: "prj_acme",
          actor,
          embedded: true,
          pending: { x: 24, y: 24, anchorItemId: "itm_dash" },
        }),
      );
    });
    await flush();
    expect(host.querySelector(".group-context")).toBeNull();
    expect(host.innerHTML).not.toContain("1 included, 0 excluded");

    await act(async () => {
      root.render(
        h(ComposePopover, {
          canvasId: "prj_acme",
          actor,
          embedded: true,
          pending: { x: 24, y: 24, anchorItemId: "itm_group" },
        }),
      );
    });
    await flush();
    expect(host.querySelector(".group-context")).not.toBeNull();
    expect(host.innerHTML).toContain("Group Navigation Group");
  });

  it("hides the frozen context card on single-screen threads in ThreadPopover and NodeFocusChat, unless scope goes wider", async () => {
    const singleContext = contextManifest(state, 2, { rootIds: ["itm_dash"] });
    const widerContext = contextManifest(state, 2, { rootIds: ["itm_dash", "itm_four"] });
    const thread: CommentThread = {
      id: "thr_acme",
      x: 16,
      y: 16,
      anchorItemId: "itm_dash",
      createdAt: stamp.createdAt,
      createdBy: actor,
      comments: [
        {
          id: "cmt_single",
          author: actor,
          createdAt: stamp.createdAt,
          body: "Tighten the spacing on the header.",
          context: singleContext,
        },
      ],
    };
    state.canvas.threads = { [thread.id]: thread };

    await act(async () => {
      useCanvasStore.setState({ canvas: { ...state.canvas }, confirmed: state });
      root.render(
        h(ThreadPopover, {
          canvasId: "prj_acme",
          actor,
          thread,
          embedded: true,
          screen: { x: 0, y: 0 },
        }),
      );
    });
    await flush();
    expect(host.querySelector(".group-context")).toBeNull();

    await act(async () => {
      root.render(
        h(NodeFocusChat, {
          canvasId: "prj_acme",
          actor,
          item: state.canvas.items.itm_dash!,
        }),
      );
    });
    await flush();
    expect(host.querySelector(".group-context")).toBeNull();

    // When a comment's frozen context spans beyond the anchored screen, disclose it.
    const multiThread: CommentThread = {
      ...thread,
      comments: [{ ...thread.comments[0]!, id: "cmt_multi", context: widerContext }],
    };
    state.canvas.threads = { [multiThread.id]: multiThread };

    await act(async () => {
      useCanvasStore.setState({ canvas: { ...state.canvas }, confirmed: state });
      root.render(
        h(ThreadPopover, {
          canvasId: "prj_acme",
          actor,
          thread: multiThread,
          embedded: true,
          screen: { x: 0, y: 0 },
        }),
      );
    });
    await flush();
    expect(host.querySelector(".group-context")).not.toBeNull();
    expect(host.innerHTML).toContain("2 items");
  });
});
