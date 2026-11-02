import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escalatedTo, parsePersona, PERSONA_DIR } from "@isocan/core";
import {
  escalation,
  IDLE_SHARE,
  machineIdle,
  readReport,
  readVerdicts,
  smallPassArgs,
  smallPassPrompt,
  smallPassWanted,
  // @ts-expect-error — a plain .mjs module with no types, imported for its
  // decisions on purpose: a second copy of them here would be the drift this
  // file exists to prevent.
} from "../scripts/lib/persona-tier.mjs";

/**
 * **The cheap tier and its hand-off** — `docs/research/2026-09-07-small-personas.md`
 * phase 1, issue #205. Every decision the runner makes about paying for a
 * model is a pure function in `scripts/lib/persona-tier.mjs`, held here
 * without a paid call.
 */
const repo = fileURLToPath(new URL("..", import.meta.url));
const runner = readFileSync(path.join(repo, "scripts/persona-run.mjs"), "utf8");
const workflow = readFileSync(path.join(repo, ".github/workflows/persona.yml"), "utf8");

const goal = { name: "dead links", bound: { kind: "at most", value: 4 }, measuredBy: "node scripts/measure.mjs dead-doc-links" };
const small = {
  name: "librarian",
  model: "haiku",
  tools: ["Read", "Glob", "Grep"],
  budget: { usdPerRun: 0.05, turnsPerRun: 6 },
  escalate: "reviewer",
  body: "You keep the links honest.",
};
const missed = [{ goal, value: 6, missed: true, names: ["a.md → x.md  · maybe: docs/x.md", "b.md → gone.md  · no file of that name"] }];
const report = (result: string, extra: Record<string, unknown> = {}) => ({
  type: "result",
  subtype: "success",
  is_error: false,
  num_turns: 2,
  total_cost_usd: 0.012,
  modelUsage: { "claude-haiku-4-5": {} },
  result,
  ...extra,
});

describe("whether a run pays for a model at all", () => {
  it("never, for a persona with no budget — which is all nine expensive ones", () => {
    /**
     * D3: machinery never hands a model to a persona that has not said what
     * it may spend. This is what keeps the opus personas exactly where they
     * were — and the tree is checked, not just the rule: no budget-less
     * persona is ever a small-pass candidate, however badly its number moved.
     */
    const { budget: _none, ...opus } = small;
    expect(smallPassWanted({ ...opus, model: "opus" }, missed)).toMatchObject({ run: false });
    const dir = path.join(repo, PERSONA_DIR);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
      const p = parsePersona(readFileSync(path.join(dir, file), "utf8"), file)!;
      if (!p.budget) expect(smallPassWanted(p, missed).run, `${p.name} has no budget`).toBe(false);
    }
  });

  it("not when every number held — the cheap tier's best night costs $0", () => {
    expect(smallPassWanted(small, [{ goal, value: 4 }])).toMatchObject({ run: false });
  });

  it("not when an instrument is broken — there is no number to reason about", () => {
    expect(smallPassWanted(small, [...missed, { goal, broken: "the command failed" }])).toMatchObject({ run: false });
  });

  it("only when a number missed, for a persona with a budget and a model", () => {
    expect(smallPassWanted(small, missed)).toMatchObject({ run: true });
  });
});

describe("the declared cost is a cap the harness enforces, and a number the page reports", () => {
  it("hands the budget to the harness as hard caps, with the persona's own tools", () => {
    const args: string[] = smallPassArgs(small, "prompt");
    const after = (flag: string) => args[args.indexOf(flag) + 1];
    expect(after("--model")).toBe("haiku");
    expect(after("--max-budget-usd")).toBe("0.05");
    expect(after("--max-turns")).toBe("6");
    expect(after("--tools")).toBe("Read,Glob,Grep");
    expect(after("--append-system-prompt")).toBe(small.body);
    // No hooks, no CLAUDE.md, no keychain: the persona is the whole brief,
    // and auth is ANTHROPIC_API_KEY, which is what CI has.
    expect(args).toContain("--bare");
    expect(after("--output-format")).toBe("json");
  });

  it("reads the harness's own cost, and judges over-budget itself rather than trusting the cap", () => {
    /**
     * `--max-budget-usd` is checked between turns, so one turn can land past
     * it. A declared cost quietly exceeded is "a bound nothing enforces is a
     * comment", so the report is compared, and the runner files a finding.
     */
    expect(readReport(report("FIX a => b"), small.budget)).toMatchObject({
      usd: 0.012,
      turns: 2,
      models: ["claude-haiku-4-5"],
      overBudget: false,
      failed: false,
    });
    expect(readReport(report("", { total_cost_usd: 0.061 }), small.budget).overBudget).toBe(true);
    expect(readReport(report("", { num_turns: 7 }), small.budget).overBudget).toBe(true);
    expect(readReport(report("", { subtype: "error_max_budget_usd", is_error: true }), small.budget)).toMatchObject({
      overBudget: true,
      failed: true,
    });
    expect(readReport(null, small.budget)).toMatchObject({ failed: true, usd: null });
  });

  it("writes the cost on the page, and files a run over budget as a finding", () => {
    expect(runner).toContain("## The small pass");
    expect(runner).toMatch(/Spent \$0 of/);
    expect(runner).toContain("past its budget | unanswered |");
  });
});

describe("what the small model is asked, and how its answer is read", () => {
  it("is handed the evidence, so the budget buys judgement and not grep", () => {
    const prompt: string = smallPassPrompt(small, missed);
    for (const n of missed[0]!.names) expect(prompt).toContain(n);
    expect(prompt).toContain("FIX <");
    expect(prompt).toContain("ESCALATE <");
    expect(prompt).toContain("`reviewer`");
  });

  it("reads FIX and ESCALATE lines and ignores everything else", () => {
    const v = readVerdicts(
      "Here you go:\n- FIX a.md → x.md => docs/x.md\n`ESCALATE b.md → gone.md — deleted, not moved`\nthanks",
    );
    expect(v.fixes).toEqual([{ what: "a.md → x.md", proposal: "docs/x.md" }]);
    expect(v.escalations).toEqual([{ what: "b.md → gone.md", why: "deleted, not moved" }]);
  });
});

describe("the hand-off: cheap finds, expensive decides (#197)", () => {
  const pass = (text: string, over: Partial<{ failed: boolean; overBudget: boolean; subtype: string }> = {}) => ({
    text,
    failed: false,
    overBudget: false,
    subtype: null,
    ...over,
  });

  it("hands on nothing when the small pass settled every offender", () => {
    expect(escalation(small, missed, pass("FIX a.md → x.md => docs/x.md\nFIX b.md → gone.md => `gone.md`"))).toBeNull();
  });

  it("hands on what it escalated, and what it skipped — never drops an offender", () => {
    const h = escalation(small, missed, pass("FIX a.md → x.md => docs/x.md"));
    expect(h.to).toBe("reviewer");
    expect(h.items).toHaveLength(1);
    expect(h.items[0]).toContain("b.md → gone.md");
    expect(h.items[0]).toContain("no answer from the small pass");
    const said = escalation(small, missed, pass("FIX a.md → x.md => docs/x.md\nESCALATE b.md → gone.md — deleted"));
    expect(said.items[0]).toMatch(/— deleted$/);
  });

  it("hands on everything, with the reason, when the small model could not do the job", () => {
    for (const [p, reason] of [
      [pass("", { failed: true, subtype: "error_max_turns" }), "failed (error_max_turns)"],
      [pass("I looked and it seems fine."), "answered nothing readable"],
      [pass("FIX a.md → x.md => docs/x.md\nFIX b.md → gone.md => y", { overBudget: true }), "over its budget"],
    ] as const) {
      const h = escalation(small, missed, p);
      expect(h, reason).not.toBeNull();
      expect(h.reasons.join(" ")).toContain(reason);
    }
  });

  it("is recorded in the line core reads back, so the target can find it", () => {
    /**
     * The runner writes it; `escalatedTo` in core reads it for
     * `isocan persona runs <target>`. Two ends of one string — held together
     * here so neither can be reworded alone.
     */
    const written = /`\*\*Escalated to \\`\$\{handoff\.to\}\\`\*\*/;
    expect(runner).toMatch(written);
    expect(escalatedTo("**Escalated to `reviewer`** — what the small pass could not settle:")).toBe("reviewer");
    expect(runner).toContain("— escalated to ${handoff.to}");
  });

  it("is never LAUNCHED by the runner — the expensive tier is pulled, not pushed", () => {
    // The only model the runner starts is the small persona's own, through
    // `smallPassArgs(persona, …)`; nothing spawns the escalation target.
    expect(runner.match(/spawnSync\(/g)).toHaveLength(1);
    expect(runner).toMatch(/spawnSync\(bin, smallPassArgs\(persona,/);
  });

  it("names a persona that exists, for every persona that hands off", () => {
    const dir = path.join(repo, PERSONA_DIR);
    const all = readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => parsePersona(readFileSync(path.join(dir, f), "utf8"), f)!);
    const names = new Set(all.map((p) => p.name));
    const handing = all.filter((p) => p.escalate);
    expect(handing.length, "the cheap tier has at least one member").toBeGreaterThan(0);
    for (const p of handing) {
      expect(names.has(p.escalate!), `${p.name} hands off to ${p.escalate}, which is not a persona`).toBe(true);
      expect(p.budget, `${p.name} hands off but declares no budget`).toBeDefined();
    }
  });
});

describe("the idle trigger — the machine's, for a repo-wide persona (D2)", () => {
  it("reads the longest load window that fits inside the declared idleness", () => {
    expect(machineIdle({ loadavg: [9, 9, 0.5], cpus: 8, minutes: 20 })).toMatchObject({ idle: true, window: 15 });
    expect(machineIdle({ loadavg: [0.1, 9, 9], cpus: 8, minutes: 3 })).toMatchObject({ idle: true, window: 1 });
    expect(machineIdle({ loadavg: [0.1, 3, 0.1], cpus: 8, minutes: 10 })).toMatchObject({ idle: false, window: 5 });
  });

  it(`calls a machine idle under ${IDLE_SHARE} of its cores, and busy at it`, () => {
    expect(machineIdle({ loadavg: [0, 0, 1.99], cpus: 8, minutes: 15 }).idle).toBe(true);
    expect(machineIdle({ loadavg: [0, 0, 2], cpus: 8, minutes: 15 }).idle).toBe(false);
  });

  it("is a door the runner has, which refuses canvas idleness by name", () => {
    expect(runner).toContain('argv.includes("--idle")');
    expect(runner).toContain("declares canvas idleness, which a repo run cannot answer");
  });
});

describe("the nightly can run the cheap tier", () => {
  it("hands the runner the key, and installs the harness only when there is one", () => {
    /**
     * Without a key the small pass is SKIPPED, not failed — the page says so
     * and the finding waits for a person like any other. So the workflow runs
     * green before the secret exists and starts spending the night it does.
     */
    const step = workflow.slice(workflow.indexOf("Take each persona's numbers"));
    expect(step.slice(0, 1200)).toContain("ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}");
    expect(workflow).toContain("@anthropic-ai/claude-code");
    expect(runner).toContain("no ANTHROPIC_API_KEY in the environment");
  });
});
