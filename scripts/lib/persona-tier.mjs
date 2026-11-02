/**
 * **The cheap tier and its hand-off, as decisions a test can hold.**
 *
 * `docs/research/2026-09-07-small-personas.md`, phase 1: one small persona,
 * a declared cost, an idle trigger. `persona-run.mjs` does the I/O — takes the
 * numbers, spawns the harness, writes the page — and every choice it makes
 * about the small pass is a pure function here, so what "cheap finds,
 * expensive decides" (#197) means is written once and tested rather than
 * buried in a script that talks to a paid API.
 *
 * The shape of a run, cheapest first:
 *
 * 1. **The instrument** — free. The persona's goal commands, as for every
 *    persona. If every number held, the run ends here and costs nothing.
 * 2. **The small pass** — only when a number MISSED, and only for a persona
 *    that declares a `budget` and a `model`. The harness gets the budget as
 *    hard caps and the offenders as evidence, and answers one line per
 *    offender: `FIX` (with the proposal) or `ESCALATE` (with the reason).
 * 3. **The hand-off** — to the persona named in `escalate:`, and only for what
 *    the small pass could not settle: an `ESCALATE` line, a pass that failed or
 *    answered nothing readable, or a pass that went over its budget. It is
 *    RECORDED, not run: the page says "Escalated to `<name>`", the finding row
 *    names it, `isocan persona runs <name>` lists it, and the findings queue
 *    (`test/review-queue.test.ts`) reddens the suite if nobody answers it in
 *    three days. Machinery never launches the expensive tier — see
 *    `escalation` below for why.
 */

/**
 * **A machine is idle when its load average over the declared window is under
 * a quarter of its cores.**
 *
 * The load average is the one idleness the OS already measures without a
 * daemon, and it comes in exactly three windows — 1, 5 and 15 minutes — so a
 * declared `idle: machine 20m` is read against the longest window that fits
 * inside it (15). Rounding DOWN is the conservative direction: it can only
 * make the check stricter about "recently", never looser.
 *
 * A quarter of the cores is a judgement, and written as one: high enough that
 * an editor, a browser and a parked daemon read as idle; low enough that a
 * build, a test run or a second agent's turn do not.
 */
export const IDLE_SHARE = 0.25;

export function machineIdle({ loadavg, cpus, minutes }) {
  const window = minutes >= 15 ? 15 : minutes >= 5 ? 5 : 1;
  const load = loadavg[window === 15 ? 2 : window === 5 ? 1 : 0];
  const limit = cpus * IDLE_SHARE;
  return { idle: load < limit, load, limit, window };
}

/**
 * **Whether this run pays for a model at all.**
 *
 * Three refusals, each a sentence the page prints:
 *
 * - **No budget, no model.** D3: a persona that has not said what it may spend
 *   is never handed to a model by machinery. That is what keeps the nine
 *   opus personas exactly where they were — run by a person, on purpose.
 * - **A broken instrument is not a reason to think.** A number nobody could
 *   take is a failure of the instrument, and a model reasoning about it would
 *   be reasoning about nothing.
 * - **A held number is the cheap tier's best outcome**, and it costs $0.
 */
export function smallPassWanted(persona, readings) {
  if (!persona.budget) return { run: false, why: "no budget declared — machinery runs no model for this persona" };
  if (!persona.model) return { run: false, why: "no model declared" };
  if (readings.some((r) => r.broken)) {
    return { run: false, why: "an instrument is broken — there is no number to reason about" };
  }
  const missed = readings.filter((r) => r.missed);
  if (missed.length === 0) return { run: false, why: "every number held — nothing to look at, and it cost nothing" };
  return { run: true, why: `${missed.map((r) => r.goal.name).join(", ")} missed its bound` };
}

/**
 * **The harness invocation, with the budget as hard caps.**
 *
 * `claude -p` rather than an SDK call: it is how `lift.mjs`, `calibrate.mjs`
 * and `converge-night.mjs` already run a model here, it reports its own cost
 * (`total_cost_usd`) so no price table has to be kept in step with a pricing
 * page, and `--max-budget-usd` / `--max-turns` are enforced by the harness
 * rather than by this script trusting itself.
 *
 * `--bare` so the run reads no hooks, no CLAUDE.md, no auto-memory and no
 * keychain — the persona's body is the whole brief, and auth is
 * `ANTHROPIC_API_KEY` and nothing else, which is also what CI has. The tool
 * list is the persona's own `tools:`, so the lens and its reach are declared
 * in one file.
 */
export function smallPassArgs(persona, prompt) {
  const args = ["-p", prompt, "--bare", "--output-format", "json", "--no-session-persistence", "--model", persona.model];
  if (persona.effort) args.push("--effort", persona.effort);
  if (persona.budget.usdPerRun !== undefined) args.push("--max-budget-usd", String(persona.budget.usdPerRun));
  if (persona.budget.turnsPerRun !== undefined) args.push("--max-turns", String(persona.budget.turnsPerRun));
  if (persona.tools.length) {
    args.push("--tools", persona.tools.join(","));
    args.push("--allowedTools", persona.tools.join(","));
  }
  args.push("--append-system-prompt", persona.body);
  return args;
}

/**
 * **What the small model is asked**, with the evidence already gathered.
 *
 * The runner hands over the number, the bound and the offenders (the goal's
 * `--names`, when its instrument has one), so the model's job is the part that
 * wants a reader — which candidate is right, whether a dead link is a link at
 * all — and not the part a script already did. A small model given a search
 * to run is a small model spending its budget on grep.
 */
export function smallPassPrompt(persona, missed) {
  const lines = [
    `You are the \`${persona.name}\` persona. Your number moved past its bound tonight:`,
    "",
  ];
  for (const r of missed) {
    lines.push(`- ${r.goal.name}: ${r.value}, bound ${r.goal.bound.kind} ${r.goal.bound.value} (\`${r.goal.measuredBy}\`)`);
    if (r.names?.length) {
      lines.push("  The offenders:");
      for (const n of r.names) lines.push(`  - ${n}`);
    }
  }
  lines.push(
    "",
    "For EACH offender, answer with exactly one line, and nothing else:",
    "",
    "FIX <the offender, as listed> => <the exact change you propose>",
    "ESCALATE <the offender, as listed> — <why this needs a judgement you should not make>",
    "",
    "Propose, never apply: you change no file. FIX only when the evidence settles it.",
    `ESCALATE hands it to \`${persona.escalate ?? "a person"}\`; use it when it does not.`,
  );
  return lines.join("\n");
}

/** `FIX a => b` and `ESCALATE a — why`, read off the model's answer. Anything
 *  else is ignored, and an answer with neither is treated as no answer. */
export function readVerdicts(text) {
  const fixes = [];
  const escalations = [];
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim().replace(/^[-*]\s+/, "").replace(/^`|`$/g, "");
    const fix = /^FIX\s+(.+?)\s+=>\s+(.+)$/.exec(line);
    if (fix) {
      fixes.push({ what: fix[1], proposal: fix[2] });
      continue;
    }
    const esc = /^ESCALATE\s+(.+?)\s+(?:—|--|-)\s+(.+)$/.exec(line);
    if (esc) escalations.push({ what: esc[1], why: esc[2] });
  }
  return { fixes, escalations };
}

/**
 * **What the harness reported, against what was declared.**
 *
 * `usd` is the harness's own `total_cost_usd`. `overBudget` is judged here,
 * not trusted to the cap: `--max-budget-usd` is checked between turns, so a
 * single turn can land past it, and a declared cost that is quietly exceeded
 * is the "bound nothing enforces is a comment" failure the note warns about.
 */
export function readReport(report, budget) {
  const usd = typeof report?.total_cost_usd === "number" ? report.total_cost_usd : null;
  const turns = typeof report?.num_turns === "number" ? report.num_turns : null;
  const models = Object.keys(report?.modelUsage ?? {});
  const overBudget =
    (usd !== null && budget.usdPerRun !== undefined && usd > budget.usdPerRun) ||
    (turns !== null && budget.turnsPerRun !== undefined && turns > budget.turnsPerRun) ||
    /max_budget|max_turns/.test(String(report?.subtype ?? ""));
  return {
    usd,
    turns,
    models,
    overBudget,
    failed: !report || report.is_error === true || typeof report.result !== "string",
    text: typeof report?.result === "string" ? report.result : "",
    subtype: report?.subtype ?? null,
  };
}

/**
 * **What goes to the expensive tier, and why only that.**
 *
 * Escalate what the small pass could not settle, and nothing it could:
 *
 * - every offender without a `FIX` — an `ESCALATE` line, which is the small
 *   model saying so, or one it skipped, which is the small model not saying;
 * - the reason too, when the pass failed, went over budget, or answered
 *   nothing readable — a small model that could not do the job is itself the
 *   finding, and silently dropping it would file a moved number as handled;
 * - nothing, when every offender got a `FIX`. Those proposals go on the page
 *   for a person, which is D4 (open, never merge) at its smallest.
 *
 * **Recorded, never launched.** The runner does not start the escalation
 * target, and that is a decision rather than a gap: the expensive personas
 * declare no budget, and D3 says machinery never runs a model without one. So
 * the hand-off is PULLED — by the finding row that names the target, by
 * `isocan persona runs <target>`, and by the three-day queue — rather than
 * pushed by a cron into an unbudgeted opus run. Giving the target a budget is
 * the day that changes, and it is one line in its file.
 */
export function escalation(persona, missed, pass) {
  if (!persona.escalate) return null;
  const reasons = [];
  if (pass.failed) reasons.push(`the small pass failed${pass.subtype ? ` (${pass.subtype})` : ""}`);
  if (pass.overBudget) reasons.push("the small pass went over its budget");
  const verdicts = readVerdicts(pass.text);
  if (!pass.failed && verdicts.fixes.length + verdicts.escalations.length === 0) {
    reasons.push("the small pass answered nothing readable");
  }
  // Matched loosely because a model re-types what it was given: an offender
  // is settled when a FIX names it, in either direction of containment.
  const names = (a, b) => a.includes(b) || b.includes(a);
  const items = [];
  for (const r of missed) {
    const offenders = r.names?.length ? r.names : [`${r.goal.name} is ${r.value}`];
    for (const o of offenders) {
      if (verdicts.fixes.some((f) => names(o, f.what))) continue;
      const said = verdicts.escalations.find((e) => names(o, e.what));
      // Neither FIX nor ESCALATE is not settled either — an offender the
      // small model skipped is handed on, never dropped.
      items.push(said ? `${o} — ${said.why}` : `${o} — no answer from the small pass`);
    }
  }
  if (items.length === 0 && reasons.length === 0) return null;
  return { to: persona.escalate, reasons, items };
}
