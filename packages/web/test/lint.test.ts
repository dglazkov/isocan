import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

/**
 * **The linter runs inside the suite, because the suite is the gate.**
 *
 * This repo's checks are tests — guards that remember a bug and explain it.
 * One class of bug cannot be written that way: a hook called conditionally.
 * There is no seam to assert against, no exported function to call. React
 * counts hooks by call order and throws out of the render phase when the
 * count changes, so the failure is a white screen, and the only thing that
 * sees it coming is a parser.
 *
 * That happened. Picking up the Pen blanked the canvas — `OwnCursor`
 * early-returns under every tool but Select, and a stale-colour fix turned
 * the plain `actorColor(...)` below that return into `useActorColor(...)`.
 * Three hooks under Select, two under Pen, React #300.
 *
 * The first version of this file was a hand-written scan for the exact shape
 * that shipped. It worked, and it was the wrong tool: it could not see a hook
 * inside an `if`, in a loop, in a callback, or after a return nested deeper
 * than the top level — four ways to write the same bug that it would have
 * called clean. So the scan is gone and the real rule runs here instead.
 *
 * Running it AS A TEST rather than as a separate CI step is the point. `npm
 * test` is what decides whether a commit reaches `green`, and `green` is what
 * dev and prod deploy from. A lint step beside that gate is a step somebody
 * can forget to add to a new workflow; a lint step INSIDE it cannot come
 * loose. `npm run lint` exists too, for the shorter loop while writing code.
 */
describe("the hooks rules hold across the web app", () => {
  it("reports no violation anywhere in src", async () => {
    const eslint = new ESLint({ cwd: fileURLToPath(new URL("../../..", import.meta.url)) });
    const results = await eslint.lintFiles(["packages/web/src"]);
    const problems = results.flatMap((r) =>
      r.messages.map((m) => `${r.filePath.split("/src/")[1]}:${m.line} ${m.ruleId} — ${m.message}`),
    );
    expect(problems, "a conditional hook is a white screen; a stale dep is a dead shortcut").toEqual(
      [],
    );
  }, 60_000);

  /**
   * A rule nobody can turn off is worth more than a rule that is currently
   * passing. Both of these are set to `error` because both have already cost
   * a shipped bug — `rules-of-hooks` the Pen white-screen, `exhaustive-deps`
   * the ⌘C that copied nothing (a keydown effect closed over a canvas that
   * had not loaded). Downgrading either to `warn` would leave the suite green
   * while the thing it guards walks back in.
   */
  it("keeps both rules at error, not warn", async () => {
    const eslint = new ESLint({ cwd: fileURLToPath(new URL("../../..", import.meta.url)) });
    const config = await eslint.calculateConfigForFile("packages/web/src/components/OwnCursor.tsx");
    // Severity in a CALCULATED config is normalised to a number — 2 is
    // "error", 1 is "warn", 0 is off. Asserting the number rather than the
    // word is what makes this catch a downgrade written either way.
    const severity = (rule: string) => (config.rules?.[rule] as [number] | undefined)?.[0];
    expect(severity("react-hooks/rules-of-hooks"), "the Pen white-screen").toBe(2);
    expect(severity("react-hooks/exhaustive-deps"), "the ⌘C that copied nothing").toBe(2);
  }, 60_000);

  /**
   * **What `eslint .` walks, which is not the same question as what it has
   * rules for.**
   *
   * `files:` in the config scopes the RULES. It does not scope the walk, and
   * for months `eslint .` opened every file in the tree — including
   * `.claude/worktrees/`, which on a working machine is up to twenty other
   * checkouts of this same repository, each with its own `packages/web/dist`
   * full of minified bundles.
   *
   * It cost fifty seconds, which was the whole of `npm run board` and two
   * thirds of the 90-second budget the board's tests give their child. But the
   * expensive half was not the slow half. **The report grew past
   * `execSync`'s one-megabyte buffer**, so `measure.mjs lint-violations` got
   * truncated JSON, threw parsing it, and reported itself as an instrument
   * that would not run — which is what qa-tester's only goal has said on every
   * machine with worktrees. And a hook bug in somebody else's checkout would
   * have counted toward that goal's "at most 0", which is a gate whose answer
   * depends on what another agent happens to have open.
   *
   * So the config carries a global `ignores`, and this is the guard on it.
   * Both halves matter: nothing outside this checkout's own source, and the
   * source still actually reached — an over-broad ignore would empty the scope
   * and every lint would pass by looking at nothing, which is the shape
   * `syncexec.test.ts` calls "a search over nothing always passes".
   */
  it("walks this checkout's source and nothing else", async () => {
    const eslint = new ESLint({ cwd: fileURLToPath(new URL("../../..", import.meta.url)) });
    const walked = (await eslint.lintFiles(["."])).map((r) => r.filePath);
    expect(
      walked.filter((f) => f.includes("/.claude/")),
      "another session's worktree is not this commit's lint",
    ).toEqual([]);
    expect(walked.filter((f) => f.includes("/dist/")), "nobody fixes a hook in a bundle").toEqual([]);
    expect(
      walked.filter((f) => f.includes("/packages/web/src/")).length,
      "the ignore list has eaten the source it exists to protect",
    ).toBeGreaterThan(100);
    expect(
      walked.some((f) => f.endsWith("/packages/web/src/components/OwnCursor.tsx")),
      "the file the linter was added for",
    ).toBe(true);
  }, 60_000);
});
