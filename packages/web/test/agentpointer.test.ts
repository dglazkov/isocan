// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * **The pointer pill: shows what an agent wears, lets its owner change it,
 * and tells anybody else whose choice it is** (agent pointers, 30 Sep 2026).
 *
 * The home is the authority (`ownsAgent`, tested in core and over HTTP); what
 * this file holds is the web's half — the pill reads ownership the way the
 * home does (through joins), a pick is ONE `actor.setMark` naming the agent
 * and spoken by you, and no click on it is ever silent.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ada = { id: "usr_ada_acme", name: "Ada" };
const rover = { id: "usr_rover_acme", name: "Rover" };
const stranger = { id: "usr_bo_acme", name: "Bo" };

const api = vi.hoisted(() => ({
  badges: [] as { actors: { id: string; name: string }[] }[],
  sent: [] as unknown[][],
}));

vi.mock("../src/lib/api.ts", async (actual) => ({
  ...(await actual<typeof import("../src/lib/api.ts")>()),
  listBadges: async () => ({ badges: api.badges }),
  sendOp: async (...args: unknown[]) => {
    api.sent.push(args);
    return null;
  },
  fetchActorMarks: () => new Promise(() => {}),
}));
vi.mock("../src/lib/identity.ts", async (actual) => ({
  ...(await actual<typeof import("../src/lib/identity.ts")>()),
  readIdentity: () => ada,
}));

/** A fresh module graph per test — the badge list is read once per tab —
 *  with the stores the component will actually read from that same graph. */
let marks: typeof import("../src/lib/marks.ts");
let store: typeof import("../src/stores/canvasStore.ts");
async function load() {
  vi.resetModules();
  marks = await import("../src/lib/marks.ts");
  store = await import("../src/stores/canvasStore.ts");
  return import("../src/components/AgentPointer.tsx");
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  api.sent = [];
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

async function mount(
  agent: { id: string; name: string },
  owner?: string,
  joins: Record<string, string> = {},
): Promise<HTMLButtonElement | null> {
  const { default: AgentPointer } = await load();
  store.useCanvasStore.setState({ actorJoins: joins });
  await act(async () => root.render(h(AgentPointer, { agent, owner })));
  await act(async () => {});
  return host.querySelector<HTMLButtonElement>(".agent-pointer");
}

describe("whose agent the browser thinks it is", () => {
  it("is an actor held on a badge that also holds you — your own other surface", async () => {
    const { heldWith } = await load();
    const machine = { actors: [ada, rover] };
    const browser = { actors: [ada] };
    const theirs = { actors: [stranger, { id: "usr_other_bot", name: "Other" }] };
    const held = heldWith([browser, machine, theirs], ada.id);
    expect(held.has(rover.id)).toBe(true);
    expect(held.has("usr_other_bot")).toBe(false);
  });

  it("reads through joins: the machine may hold you under the identity you folded away", async () => {
    const { heldWith } = await load();
    const admiral = { id: "usr_acme_admiral", name: "Acme Admiral" };
    const machine = { actors: [admiral, rover] };
    // The browser speaks as Ada; the machine enrolled Rover as the admiral,
    // who has since been folded into Ada.
    expect(heldWith([machine], ada.id).has(rover.id)).toBe(false);
    expect(heldWith([machine], ada.id, { [admiral.id]: ada.id }).has(rover.id)).toBe(true);
  });
});

describe("the pointer pill", () => {
  it("shows 🤖 until a mark is chosen, then the mark", async () => {
    api.badges = [{ actors: [ada, rover] }];
    const pill = await mount(rover);
    expect(pill?.querySelector(".agent-pointer-glyph")?.textContent).toBe("🤖");
    expect(pill?.textContent).toBe("🤖Pointer");
    await act(async () => marks.rememberMark(rover.id, "🐕"));
    expect(host.querySelector(".agent-pointer-glyph")?.textContent).toBe("🐕");
  });

  it("opens the picker for the owner, and a pick sends the same actor.setMark the CLI sends", async () => {
    api.badges = [{ actors: [ada] }, { actors: [ada, rover] }];
    const pill = await mount(rover);
    expect(pill?.classList.contains("not-yours")).toBe(false);

    await act(async () => pill!.click());
    const picker = document.querySelector(".react-picker");
    // Lifted over the covers the tray also lives under (a module page, the
    // workbench) — the layer that made the first click look like nothing.
    expect(picker?.classList.contains("over-covers")).toBe(true);
    const option = document.querySelector<HTMLButtonElement>(".react-picker .react-option");
    const emoji = option!.textContent!;
    await act(async () => option!.click());
    await act(async () => {});

    expect(api.sent).toHaveLength(1);
    const [canvasId, speaker, op] = api.sent[0]!;
    expect(canvasId).toBe(null);
    expect(speaker).toEqual(ada);
    expect(op).toEqual({ type: "actor.setMark", actorId: rover.id, mark: emoji });
    expect(document.querySelector(".react-picker")).toBeNull();
    // And the pill now shows what was picked.
    expect(host.querySelector(".agent-pointer-glyph")?.textContent).toBe(emoji);
  });

  it("works for a joined owner — the case that drew nothing", async () => {
    const admiral = { id: "usr_acme_admiral", name: "Acme Admiral" };
    api.badges = [{ actors: [ada] }, { actors: [admiral, rover] }];
    const pill = await mount(rover, undefined, { [admiral.id]: ada.id });
    expect(pill?.classList.contains("not-yours")).toBe(false);
    await act(async () => pill!.click());
    expect(document.querySelector(".react-picker")).not.toBeNull();
  });

  it("for somebody else's agent, shows the pointer and says whose choice it is — never silence", async () => {
    api.badges = [{ actors: [ada] }];
    const pill = await mount({ id: "usr_their_bot", name: "Theirs" }, "Bo");
    expect(pill?.classList.contains("not-yours")).toBe(true);
    await act(async () => pill!.click());
    expect(document.querySelector(".react-picker")).toBeNull();
    expect(host.querySelector(".agent-pointer-said")?.textContent).toBe(
      "Theirs's pointer is set by its owner, Bo.",
    );
    expect(api.sent).toHaveLength(0);
  });
});
