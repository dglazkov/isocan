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
});
