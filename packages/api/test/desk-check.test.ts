import { describe, expect, it } from "vitest";
import { applyOperation, type Actor, type CanvasContents, type CanvasState, type Operation } from "@isocan/core";
import { deskCheckFindings, deskCheckSections, deskCheckSummary, type DeskCheckInput } from "@isocan/core/desk-check";
import { readDeskCheck, type DeskCheckPort } from "../src/desk-check-reader.ts";
import type { CanvasDesignAudit } from "../src/design-audit-reader.ts";

/**
 * **The desk check** (proactive-agent phase 8, design §9 "Before you share"),
 * on a synthetic Acme canvas: what it reads, and how it says it. The reader
 * takes its bytes, audit, receipts and wires through ports, so here they are
 * fixtures; the CLI and the Share dialog hand it the real ones. It reads the
 * person's screens — never a critic's card or an open proposal — finds the
 * system's ink too light for its ground and a word the Voice forbids, and
 * says so in sections whose summary always ends "it never blocks".
 */

const MAYA: Actor = { id: "usr_maya", name: "Maya" };
let n = 0;
function apply(s: CanvasState | null, op: Operation): CanvasState {
  n += 1;
  return applyOperation(s, { id: `op_${n}`, canvasId: op.type === "project.create" ? null : "prj_acme", actor: MAYA, ts: new Date(Date.UTC(2026, 9, 14, 10, 0, n)).toISOString(), op })!;
}
const version = (id: string, mimeType: string) => ({ id: `ver_${id}`, blobHash: `hash_${id}`, mimeType, filename: mimeType === "text/html" ? `${id}.html` : "DESIGN.md", size: 10 });

const DESIGN = `---
name: Acme Bakery
colors:
  primary: "#dddddd"
  neutral: "#ffffff"
---

## Overview

A neighbourhood bakery's pre-order app.

## Voice

Warm and plain.

Glossary:
- pickup — never pick-up
`;

const BLOBS: Record<string, string> = {
  hash_design: DESIGN,
  hash_home: `<!doctype html><title>Home</title><main><h1>Fresh bread</h1><button>Choose a pick-up time</button></main>`,
  hash_menu: `<!doctype html><title>Menu</title><main><h1>Today's loaves</h1><button>Order for pickup</button></main>`,
  hash_card: "---\nname: the-reductionist\ncritic: true\n---\n",
  hash_proposal: `<!doctype html><title>Home, proposed</title><main><button>Pick-up</button></main>`,
};

function acme(): CanvasContents {
  let s = apply(null, { type: "project.create", canvasId: "prj_acme", title: "Acme Bakery", description: "" });
  s = apply(s, { type: "item.add", itemId: "itm_design", version: version("design", "text/markdown"), width: 400, height: 400, placement: { x: -500, y: 0 }, title: "DESIGN.md", properties: { role: "design-system" } });
  s = apply(s, { type: "item.add", itemId: "itm_home", version: version("home", "text/html"), width: 390, height: 800, placement: { x: 0, y: 0 }, title: "Home" });
  s = apply(s, { type: "item.add", itemId: "itm_menu", version: version("menu", "text/html"), width: 390, height: 800, placement: { x: 450, y: 0 }, title: "Menu" });
  s = apply(s, { type: "item.add", itemId: "itm_card", version: version("card", "text/markdown"), width: 360, height: 440, placement: { x: 900, y: 0 }, title: "The Reductionist", properties: { "critique.critic": "the-reductionist" } });
  s = apply(s, { type: "item.add", itemId: "itm_proposal", version: version("proposal", "text/html"), width: 390, height: 800, placement: { x: 0, y: 900 }, title: "Home, proposed", properties: { proposal: "sure", parent: "itm_home", proposalCites: JSON.stringify([{ kind: "comment", ref: "cmt_1" }]), proposalWhy: "Summary first." } });
  return s.canvas;
}

function port(over: Partial<DeskCheckPort> = {}): DeskCheckPort & { audited: string[][] } {
  const audited: string[][] = [];
  return {
    audited,
    text: async (hash) => {
      const t = BLOBS[hash];
      if (t === undefined) throw new Error(`no blob ${hash}`);
      return t;
    },
    audit: async (ids) => {
      audited.push([...ids]);
      return {
        canvasId: "prj_acme", ruleVersion: "1", system: "Acme Bakery", screens: ids.length, offSystem: 3, audited: ids.length, unavailable: 0,
        items: [{ itemId: "itm_home", title: "Home", status: "audited", offSystem: [{ value: "#123456", kind: "colour", count: 3, line: 1 }] }],
        refusedSources: [],
      } as unknown as CanvasDesignAudit;
    },
    staleReceipts: async () => [{ title: "Home", why: "the brief changed after it was checked" }],
    wiresBehind: async () => [],
    ...over,
  };
}

describe("readDeskCheck — what the desk check reads", () => {
  it("reads the person's screens only, the system's contrast, and the words against its Voice", async () => {
    const p = port();
    const found = await readDeskCheck(p, acme());
    expect(found.screens.map((s) => s.title)).toEqual(["Home", "Menu"]);
    expect(p.audited).toEqual([["itm_home", "itm_menu"]]);
    expect(found.audit).toEqual({ audited: 2, offSystem: 3, unavailable: 0, worst: [{ title: "Home", count: 3 }] });
    expect(found.contrast).toEqual([{ system: "Acme Bakery", what: expect.stringMatching(/^colors\.primary is [\d.]+:1 against the ground — body text needs 4\.5:1$/) }]);
    expect(found.words.voice).toBe(true);
    expect(found.words.count).toBeGreaterThan(0);
    expect(found.words.first.some((f) => f.title === "Home" && /pick-up/i.test(f.what))).toBe(true);
    expect(found.words.first.some((f) => f.title === "Home, proposed")).toBe(false);
    expect(found.stale).toEqual([{ title: "Home", why: "the brief changed after it was checked" }]);
    expect(found.behind).toEqual([]);
  });

  it("a present reads its one screen; and nothing that fails to read stops it", async () => {
    const one = await readDeskCheck(port(), acme(), { itemIds: ["itm_menu"] });
    expect(one.screens.map((s) => s.itemId)).toEqual(["itm_menu"]);
    const broken = await readDeskCheck(port({
      audit: async () => { throw new Error("the home is away"); },
      staleReceipts: async () => { throw new Error("no requests"); },
      wiresBehind: async () => { throw new Error("no module"); },
    }), acme());
    expect(broken.audit).toBeNull();
    expect(broken.stale).toEqual([]);
    expect(broken.behind).toEqual([]);
    expect(broken.contrast).toHaveLength(1);
  });
});

describe("deskCheckSections — how the desk check says it", () => {
  const base: DeskCheckInput = {
    screens: [{ itemId: "itm_home", title: "Home" }],
    audit: { audited: 1, offSystem: 0, worst: [], unavailable: 0 },
    contrast: [],
    words: { count: 0, first: [], voice: true },
    behind: [],
    stale: [],
    critics: [],
  };

  it("a clean canvas has nothing to look at, and still says it never blocks", () => {
    const sections = deskCheckSections(base);
    expect(sections.map((s) => s.key)).toEqual(["audit", "contrast", "words", "behind", "stale", "critics"]);
    expect(sections.every((s) => s.ok)).toBe(true);
    expect(deskCheckSummary(sections)).toBe("Desk check before you share: nothing to look at — it reports; it never blocks.");
    expect(deskCheckFindings(sections)).toEqual([]);
  });

  it("each finding is something to look at, in words the critics read too; a critic waiting is said, never a gate", () => {
    const sections = deskCheckSections({
      ...base,
      audit: { audited: 1, offSystem: 3, worst: [{ title: "Home", count: 3 }], unavailable: 0 },
      contrast: [{ system: "Acme Bakery", what: "colors.primary is 1.4:1 against the ground — body text needs 4.5:1" }],
      behind: [{ title: "Checkout", system: "Acme Bakery" }],
      critics: [{ agentName: "The Brand Voice", asked: true }, { agentName: "The Newcomer", asked: false, why: "nothing is answering for Kit here" }],
    });
    expect(deskCheckSummary(sections)).toBe("Desk check before you share: 3 things to look at — it reports; it never blocks.");
    expect(sections.find((s) => s.key === "audit")!.lines).toEqual(["3 values the system never named", "“Home”: 3 off-system values"]);
    expect(sections.find((s) => s.key === "behind")!.lines).toEqual(["“Checkout” was drawn from an older Acme Bakery"]);
    const critics = sections.find((s) => s.key === "critics")!;
    expect(critics.ok).toBe(true);
    expect(critics.lines).toEqual(["The Brand Voice — asked to read it; its notes land as pins", "The Newcomer waits: nothing is answering for Kit here"]);
    expect(deskCheckFindings(sections)).toEqual([
      "Design audit: 3 values the system never named; “Home”: 3 off-system values.",
      "Contrast: Acme Bakery: colors.primary is 1.4:1 against the ground — body text needs 4.5:1.",
      "Wires behind the design system: “Checkout” was drawn from an older Acme Bakery.",
    ]);
  });
});
