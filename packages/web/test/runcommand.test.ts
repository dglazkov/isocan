import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "@isocan/core";

/**
 * **`WebHost.runCommand` is the composer's send, in the composer's order.**
 *
 * `MainThreadPanel` answers a local command first — a module command that
 * opens a dialog opens it, so `/wire <request>` composes in the browser — and
 * posts everything else to the Chat with the selection attached. The voice
 * session reaches the same two calls through this door, and the ORDER is the
 * thing worth holding: a voice that posted `/wire` straight to the Chat (what
 * `say "/wire …"` did before this door existed) skipped the local half, so no
 * dialog opened, and with nobody parked, nothing happened at all.
 *
 * The two halves are the real functions' seams, stubbed at their modules —
 * `runLocalCommand` has its own tests and `postToMain` its own; what this
 * holds is that the host calls them, in this order, with these arguments,
 * and says which one answered.
 */
const { local, posted, state } = vi.hoisted(() => ({
  local: [] as string[],
  posted: [] as Array<{ body: string; attached: string[] }>,
  state: {
    commands: [{ name: "wire", description: "Wireframes", source: "module", opens: "wire" }] as unknown[],
    selectedItemIds: ["itm_a"] as string[],
    canEdit: true,
  },
}));

vi.mock("../src/lib/localcommands.ts", () => ({
  runLocalCommand: (body: string) => {
    local.push(body);
    return body.startsWith("/wire");
  },
}));
vi.mock("../src/lib/mainthread.ts", () => ({
  postToMain: async (_canvas: string, _actor: Actor, body: string, attached: string[]) => {
    posted.push({ body, attached });
  },
}));
vi.mock("../src/lib/capability.ts", () => ({ canEditNow: () => state.canEdit, useCanEdit: () => state.canEdit }));
vi.mock("../src/stores/canvasStore.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/stores/canvasStore.ts")>()),
  useCanvasStore: { getState: () => ({ commands: state.commands, canvas: { items: {} } }) },
}));
vi.mock("../src/stores/uiStore.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/stores/uiStore.ts")>()),
  useUiStore: { getState: () => ({ selectedItemIds: state.selectedItemIds }) },
}));

const { webHostFor } = await import("../src/lib/modulehost.ts");
const acme: Actor = { id: "usr_acme", name: "Acme" };

describe("the module host runs a command the way the composer does", () => {
  beforeEach(() => {
    local.length = 0;
    posted.length = 0;
    state.canEdit = true;
  });

  it("a command the page can run runs here, and nothing is posted", async () => {
    const host = webHostFor("prj_acme", acme);
    expect(await host.runCommand("/wire a bowling score tracker")).toBe("local");
    expect(local).toEqual(["/wire a bowling score tracker"]);
    expect(posted).toEqual([]);
  });

  it("anything else is posted, with the selection attached, after the page declined it", async () => {
    const host = webHostFor("prj_acme", acme);
    expect(await host.runCommand("/design-audit")).toBe("posted");
    expect(local).toEqual(["/design-audit"]);
    expect(posted).toEqual([{ body: "/design-audit", attached: ["itm_a"] }]);
  });

  it("a reader cannot post one, and is told so rather than ignored", async () => {
    state.canEdit = false;
    const host = webHostFor("prj_acme", acme);
    await expect(host.runCommand("/design-audit")).rejects.toThrow(/reading this canvas/);
    expect(posted).toEqual([]);
  });

  it("offers the composer's list — the daemon's answer with the modules' commands under it", () => {
    const host = webHostFor("prj_acme", acme);
    expect(host.commands().map((c) => c.name)).toContain("wire");
  });
});
