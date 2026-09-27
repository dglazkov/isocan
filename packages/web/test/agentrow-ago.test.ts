// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { ago, type AgentRow } from "@isocan/core";
import { AgentRowView } from "../src/components/AgentRow.tsx";

/**
 * **The roster says "how long ago" in core's words** (cleanup DU-5,
 * 27 Sep 2026).
 *
 * The agent row kept two private copies of `ago` — one for ISO strings, one
 * for milliseconds — beside core's, which the home screen, the inbox, the
 * scrubber and the palette all share. They had already drifted: core says
 * `3d` for three days, the row said `72h`. The row keeps the one thing it
 * asks for that the others do not — seconds, because it re-renders every
 * second while an agent works — as an argument to the shared function, not as
 * a third copy of it.
 *
 * Rendered, not read: the row is real, and so is the line a person sees.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 8, 27, 12, 0, 0);

const away = (at: string): AgentRow => ({
  actorId: "usr_acme",
  name: "Acme",
  state: "away",
  primary: null,
  others: [],
  harness: null,
  lastAct: { kind: "made", at, subject: "Acme board" },
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  // The answering poll asks the home; here, it never answers.
  vi.stubGlobal("fetch", () => new Promise(() => {}));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function lineFor(row: AgentRow): Promise<string> {
  await act(async () =>
    root.render(h(MemoryRouter, null, h(AgentRowView, { canvasId: "prj_acme", row, open: false, focused: null, onToggle: () => {} }))),
  );
  return host.querySelector(".wb-row-line")?.textContent ?? "";
}

describe("an agent row says how long ago the way every other surface does", () => {
  it.each([
    ["five seconds", 5_000, "5s"],
    ["forty minutes", 40 * 60_000, "40m"],
    ["three days", 72 * 3_600_000, "3d"],
  ])("%s ago", async (_, before, words) => {
    const at = new Date(NOW - before).toISOString();
    // The shared rule, asked the row's question: seconds are its finest unit.
    expect(ago(at, NOW, true)).toBe(words);
    expect(await lineFor(away(at))).toMatch(new RegExp(` · ${words}$`));
  });
});
