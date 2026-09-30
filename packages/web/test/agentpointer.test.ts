// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * **"Set pointer…" sends the op `isocan agent mark` sends, and only its owner
 * is offered it** (agent pointers, 30 Sep 2026).
 *
 * The home is the authority (`ownsAgent`, tested in core and over HTTP); what
 * this file holds is the web's half of the bargain — the button appears where
 * the home would say yes and nowhere else, and a pick is ONE `actor.setMark`
 * naming the agent, spoken by you.
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

const { default: AgentPointer, heldWith } = await import("../src/components/AgentPointer.tsx");

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

async function mount(agent: { id: string; name: string }): Promise<HTMLButtonElement | null> {
  await act(async () => root.render(h(AgentPointer, { agent })));
  await act(async () => {});
  return host.querySelector<HTMLButtonElement>(".agent-pointer");
}

describe("whose agent the browser thinks it is", () => {
  it("is an actor held on a badge that also holds you — your own other surface", () => {
    const machine = { actors: [ada, rover] };
    const browser = { actors: [ada] };
    const theirs = { actors: [stranger, { id: "usr_other_bot", name: "Other" }] };
    const held = heldWith([browser, machine, theirs], ada.id);
    expect(held.has(rover.id)).toBe(true);
    expect(held.has("usr_other_bot")).toBe(false);
  });
});

describe("Set pointer…", () => {
  it("is offered to the owner, and a pick sends the same actor.setMark the CLI sends", async () => {
    api.badges = [{ actors: [ada] }, { actors: [ada, rover] }];
    const button = await mount(rover);
    expect(button?.textContent).toBe("Set pointer…");

    await act(async () => button!.click());
    const option = document.querySelector<HTMLButtonElement>(".react-picker .react-option");
    expect(option).not.toBeNull();
    const emoji = option!.textContent!;
    await act(async () => option!.click());

    expect(api.sent).toHaveLength(1);
    const [canvasId, speaker, op] = api.sent[0]!;
    expect(canvasId).toBe(null);
    expect(speaker).toEqual(ada);
    expect(op).toEqual({ type: "actor.setMark", actorId: rover.id, mark: emoji });
    // The picker goes when it has been used.
    expect(document.querySelector(".react-picker")).toBeNull();
  });

  it("is not offered for somebody else's agent", async () => {
    api.badges = [{ actors: [ada] }];
    expect(await mount({ id: "usr_their_bot", name: "Theirs" })).toBeNull();
  });
});
