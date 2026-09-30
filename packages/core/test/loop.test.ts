import { describe, expect, it } from "vitest";
import {
  DISMISSED_BY_US,
  findingProblems,
  loopContextPayload,
  loopSummary,
  normalizeInsight,
  parseFinding,
  pendingDismissals,
  projectCounts,
  reconcile,
  renderLoopDoc,
  serializeFinding,
  slugify,
  type LoopFinding,
  type LoopInsight,
} from "../src/index.ts";

const insight = (over: Partial<LoopInsight> = {}): LoopInsight => ({
  id: "aaaaaaaa-1111",
  title: "Drawing creation awaits a network upload",
  description: "The pen waits for the blob before the stroke shows.",
  state: "ACTIVE",
  rank: "P2",
  confidence: null,
  goal: "Fast everywhere",
  files: ["packages/web/src/x.ts#L1-L9"],
  ...over,
});

const finding = (over: Partial<LoopFinding> = {}): LoopFinding => ({
  slug: "a-finding",
  title: "A finding",
  loop: ["aaaaaaaa-1111"],
  loop_rank: "P2",
  loop_state: "ACTIVE",
  loop_goal: null,
  decision: "proposed",
  rank: "next",
  project: "wireframes",
  lesson: null,
  since: "2026-09-28",
  note: "holds: reason",
  body: "# A finding",
  ...over,
});

describe("a finding is a file whose front matter is the decision", () => {
  it("survives a round trip, quotes and colons and all", () => {
    /* The reader is docStatus's, which strips only the outer quotes, so the
       writer has to escape what it puts inside them. A title with a colon and a
       quotation mark is the case that would come back different. */
    const f = finding({
      title: 'Uploads: "serial" and slow',
      note: "partly true: the drop handler awaits each file (upload.ts:12), but batches of 2 are fine",
      loop: ["a-1", "b-2"],
      lesson: 12,
    });
    expect(parseFinding(serializeFinding(f), f.slug)).toEqual(f);
  });

  it("reads a word it does not know as untriaged, not as a decision", () => {
    /* A typo must not promote a finding to accepted — the same rule as a typo
       in a doc's status, which lands on `open`. */
    const f = parseFinding("---\ntitle: T\nloop: x\ndecision: acepted\n---\n\nbody", "t");
    expect(f.decision).toBe("untriaged");
  });

  it("says what is wrong with a decision that says nothing", () => {
    expect(findingProblems(finding({ note: null }))).toContain("no note — a proposed finding says why");
    expect(findingProblems(finding({ decision: "accepted", project: null }))).toContain(
      "accepted with no project — say where the work lives, or project: new",
    );
    expect(findingProblems(finding({ decision: "accepted", rank: "never" }))[0]).toMatch(/decline it instead/);
    expect(findingProblems(finding({ project: "no-such" }), ["wireframes"])).toEqual([
      "project no-such is not a directory under docs/projects/",
    ]);
    expect(findingProblems(finding({ body: "## Our read\n\nNot yet checked against the code." }))).toContain(
      "not yet read — prove the claim against the code before proposing or deciding",
    );
    expect(findingProblems(finding({ body: "## Our read\n\nI did not check the bundle output." }))).toContain(
      "unverified read — prove every sub-claim against the code instead of leaving 'did not check' or 'not run'",
    );
    expect(findingProblems(finding(), ["wireframes"])).toEqual([]);
  });

  it("builds a bounded proof prompt that calls propose and never decide or push", async () => {
    const { proveArgs, provePrompt } = await import("../src/index.ts");
    const u = finding({
      slug: "acme-claim",
      decision: "untriaged",
      rank: null,
      project: null,
      body: "# Acme claim\n\n> **Loop says** (P1): Something broke.\n\n- `packages/core/src/ops.ts`\n\n## Our read\n\nNot yet checked against the code.",
    });
    const prompt = provePrompt(u, ["multiuser", "wireframes"]);
    expect(prompt).toContain("Prove every sub-claim against the code");
    expect(prompt).toContain("node scripts/loop.mjs propose acme-claim");
    expect(prompt).toContain("Never run `decide`, `push`, or `mine`");
    const args = proveArgs(prompt);
    expect(args).toContain("--bare");
    expect(args).toContain("Bash,Read");
  });
});

describe("a pull refreshes what Loop says and never what we decided", () => {
  it("keeps our fields when Loop re-files under a new id", () => {
    const ours = finding({ decision: "declined", note: "by design: see AGENTS.md", title: "Drawing creation awaits a network upload" });
    const r = reconcile([ours], [insight({ id: "bbbbbbbb-2222" })]);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ decision: "declined", note: "by design: see AGENTS.md" });
    expect(r.findings[0]!.loop).toEqual(["aaaaaaaa-1111", "bbbbbbbb-2222"]);
    expect(r.refiled).toEqual(["a-finding"]);
    expect(r.added).toEqual([]);
  });

  it("files a new insight as untriaged with its evidence and no opinion", () => {
    const r = reconcile([], [insight()]);
    expect(r.added).toEqual(["drawing-creation-awaits-a-network-upload"]);
    const f = r.findings[0]!;
    expect(f).toMatchObject({ decision: "untriaged", rank: null, project: null, loop_goal: "Fast everywhere" });
    expect(f.body).toContain("**Loop says** (P2)");
    expect(f.body).toContain("Not yet checked against the code.");
  });

  it("reports what changed on Loop's side without acting on it", () => {
    const r = reconcile(
      [finding({ decision: "proposed" })],
      [insight({ state: "DISMISSED", title: "A finding", id: "aaaaaaaa-1111" })],
    );
    expect(r.dismissedInLoop).toEqual(["a-finding"]);
    expect(r.findings[0]!.decision).toBe("proposed");
    const done = reconcile([finding({ decision: "accepted" })], [insight({ state: "RESOLVED", title: "A finding" })]);
    expect(done.resolvedInLoop).toEqual(["a-finding"]);
  });
});

describe("a decision travels to Loop, and a proposal does not", () => {
  it("dismisses every active id of a declined or stale finding, and nothing else", () => {
    const declined = finding({ slug: "d", decision: "declined", loop: ["1", "2"] });
    const proposed = finding({ slug: "p", decision: "proposed", loop: ["3"] });
    const insights = [1, 2, 3].map((n) => insight({ id: String(n) }));
    expect(pendingDismissals([declined, proposed], insights)).toEqual([
      { slug: "d", id: "1" },
      { slug: "d", id: "2" },
    ]);
    expect(pendingDismissals([declined], [insight({ id: "1", state: "DISMISSED" }), insight({ id: "2", state: "DISMISSED" })])).toEqual([]);
    expect(DISMISSED_BY_US).toEqual(["declined", "stale"]);
  });

  it("sends decisions only — a proposal is not ours until a person makes it", () => {
    const payload = loopContextPayload([
      finding({ decision: "proposed" }),
      finding({ slug: "u", decision: "untriaged", rank: null, note: null }),
      finding({ slug: "d", decision: "declined", note: "by design" }),
    ]);
    expect(payload.decisions.map((d) => d.decision)).toEqual(["declined"]);
    expect(loopContextPayload([finding()]).decisions).toEqual([]);
  });
});

describe("the views are derived from the findings", () => {
  const all = [
    finding({ slug: "a", title: "Alpha", decision: "proposed" }),
    finding({ slug: "b", title: "Beta", decision: "accepted", project: "modules" }),
    finding({ slug: "c", title: "Gamma", decision: "declined", note: "by design | see AGENTS.md" }),
    finding({ slug: "u", title: "Delta", decision: "untriaged", rank: null, note: null, since: null }),
  ];

  it("counts per project, and only what still needs a person", () => {
    expect([...projectCounts(all)]).toEqual([
      ["wireframes", { accepted: 0, proposed: 1 }],
      ["modules", { accepted: 1, proposed: 0 }],
    ]);
    expect(loopSummary(all)).toBe("1 to decide · 1 accepted · 1 declined · 0 stale · 0 done · 1 not yet read");
  });

  it("renders every section a person needs and escapes a pipe in a note", () => {
    const page = renderLoopDoc(all);
    expect(page.startsWith("<!-- Generated by scripts/loop.mjs")).toBe(true);
    expect(page).toContain("## Needs a decision");
    expect(page).toContain("### [modules](projects/modules/)");
    expect(page).toContain("by design \\| see AGENTS.md");
    expect(page).toContain("- [Delta](loop/u.md) — Loop P2");
  });
});

describe("Loop's wire format, reduced to what triage uses", () => {
  it("reads a rank with and without a severity, the cited files, and the priority's name", () => {
    const raw = {
      id: "x1",
      title: "  T  ",
      description: "D",
      state: "ACTIVE",
      priority: "P1",
      priorities: ["workspaces/w/goals/pg_1"],
      references: {
        "1": { source: { uri: "https://github.com/o/r/blob/HEAD/a/b.ts#L1-L2" } },
        "2": { note: { content: "a note, not a file" } },
      },
    };
    const i = normalizeInsight(raw, new Map([["pg_1", "Fast everywhere"]]));
    expect(i).toMatchObject({ id: "x1", title: "T", rank: "P1", goal: "Fast everywhere", files: ["a/b.ts#L1-L2"] });
    expect(normalizeInsight({ ...raw, severity: "S0" }).rank).toBe("P1/S0");
    expect(normalizeInsight({ id: "y", title: "t" }).rank).toBe("unranked");
    expect(normalizeInsight({ ...raw, state: "??" }).state).toBe("ACTIVE");
  });

  it("makes a slug that never ends in half a word", () => {
    expect(slugify("Drawing creation awaits a network upload!")).toBe("drawing-creation-awaits-a-network-upload");
    expect(slugify("a ".repeat(50).trim())).toMatch(/^(a-)*a$/);
    expect(slugify("x".repeat(30) + " " + "y".repeat(40)).endsWith("y")).toBe(false);
  });
});
