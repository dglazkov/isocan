import { describe, expect, it, vi } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ANSWER_WITHIN_MS, type Actor, type CommentThread } from "@isocan/core";

// A static render reads zustand's SERVER snapshot, which is the store's initial
// state; read the live one instead so `setState` below reaches the component.
// Same shim as `sprint-performance.test.ts`.
vi.mock("../src/stores/canvasStore.ts", async (original) => {
  const real = await original<typeof import("../src/stores/canvasStore.ts")>();
  const useCanvasStore = Object.assign(
    (selector: (state: ReturnType<typeof real.useCanvasStore.getState>) => unknown) => selector(real.useCanvasStore.getState()),
    real.useCanvasStore,
  );
  return { ...real, useCanvasStore };
});
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import { OnIt } from "../src/components/OnIt.tsx";

/**
 * **A summons you can see** (#197 phase 1, web half).
 *
 * The thread under an ask renders core's receipt — the real `OnIt`, fed a
 * store, not a restatement of the rule. Before this the web showed only a
 * refusal: an agent named by an rc-answered mention read "Nobody is parked",
 * and an answer left no receipt at all. The words are core's
 * (`summonsLine`); what is proved here is that the thread says them.
 *
 * Static render, so the rc poll has not answered: every agent reads as
 * having no rc, which is the "nothing is listening" case. The parked-rc
 * sentence and the refusal are proved against `threadSummonses` in core,
 * which is the function this component maps row for row.
 */
const alice: Actor = { id: "usr_alice", name: "Alice" };
const percy: Actor = { id: "usr_percy", name: "Percy" };
const at = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

function render(comments: { author: Actor; createdAt: string; mentions?: string[] }[], sessions: unknown[] = []) {
  useCanvasStore.setState({
    sessions,
    canvas: { agents: { [percy.id]: { actor: percy } } },
  } as never);
  const thread = {
    id: "thr_1",
    comments: comments.map((c, i) => ({ id: `c${i}`, body: "…", ...c })),
  } as unknown as CommentThread;
  const last = thread.comments[thread.comments.length - 1];
  return renderToStaticMarkup(
    h(OnIt, { thread, waiting: last?.author.id === alice.id, canvasId: "cnv_1", actor: alice }),
  );
}

describe("the receipt under an ask", () => {
  it("says asked while the ask is fresh — not the room's head-count", () => {
    const html = render([{ author: alice, createdAt: at(3_000), mentions: [percy.id] }]);
    expect(html).toContain("asked Percy");
    expect(html).not.toContain("Nobody is parked");
    expect(html).not.toContain("overdue");
    // Nothing has read it yet: it can still be taken back.
    expect(html).toContain("Cancel");
  });

  it("says nothing answered past the bound, and marks it", () => {
    const html = render([{ author: alice, createdAt: at(ANSWER_WITHIN_MS + 5_000), mentions: [percy.id] }]);
    expect(html).toContain("nothing answered — nothing is listening for Percy here");
    expect(html).toContain("onit waiting overdue");
  });

  it("keeps an answered receipt under the reply", () => {
    const html = render([
      { author: alice, createdAt: at(20_000), mentions: [percy.id] },
      { author: percy, createdAt: at(14_000) },
    ]);
    expect(html).toContain("Percy answered (6s)");
    expect(html).not.toContain("Cancel");
  });

  it("shows picked up as the agent's own presence, never as a guess", () => {
    const working = {
      sessionId: "ses_1",
      actor: percy,
      kind: "cli",
      capability: "edit",
      onThread: "thr_1",
      status: "reading the brief",
    };
    const html = render([{ author: alice, createdAt: at(3_000), mentions: [percy.id] }], [working]);
    expect(html).toContain("reading the brief");
    expect(html).not.toContain("asked Percy");
    // And without presence, nothing claims it was picked up.
    expect(render([{ author: alice, createdAt: at(3_000), mentions: [percy.id] }])).not.toMatch(/picked it up|on it/);
  });

  it("says nothing about a person named, or once somebody else has spoken", () => {
    expect(render([{ author: alice, createdAt: at(60_000), mentions: ["usr_bob"] }])).not.toMatch(/asked|nothing answered/);
    const moved = render([
      { author: alice, createdAt: at(60_000), mentions: [percy.id] },
      { author: { id: "usr_bob", name: "Bob" }, createdAt: at(50_000) },
    ]);
    expect(moved).toBe("");
  });
});
