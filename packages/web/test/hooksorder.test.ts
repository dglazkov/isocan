import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **No hook below an early return.**
 *
 * React counts hooks by call order, so a component must call the same ones on
 * every render. A hook underneath `if (…) return null` is called on some
 * renders and not others, and the render where the count drops does not
 * degrade — it THROWS, out of the render phase, taking the whole tree with it.
 * The user sees a white screen.
 *
 * That is not a hypothetical. `OwnCursor` painted the cursor chip with
 * `actorColor(actor.id)` — a plain function, legal anywhere — sitting below
 * `if (!shown) return null`. Fixing a stale-colour bug swapped it for
 * `useActorColor(actor.id)` and left it exactly where it was. Under Select the
 * component ran three hooks; picking up the Pen made `shown` false, the
 * component returned early, two hooks ran, and React #300 whited out the app.
 * The call site never moved. What changed was what the call WAS, and nothing
 * in the codebase was watching for that.
 *
 * This is the rule `react-hooks/rules-of-hooks` enforces, and the honest note
 * is that this repo has no linter — so it is enforced here, by reading the
 * source, for the surface that has components. A real linter would be better
 * and would subsume this file; until there is one, the class of bug that took
 * production down gets a guard rather than a promise.
 *
 * SCOPE, deliberately narrow to stay true:
 *   - only inside a top-level component (`Name`) or custom hook (`useName`),
 *     because that is where the rule applies;
 *   - a hook is `useThing(` — `useUiStore.getState()` is a plain read through
 *     a store object and is correct anywhere, including after a return;
 *   - the FIRST top-level `return` opens the danger zone. A `return` nested
 *     deeper (inside a callback, an effect, a `.map`) is another function's
 *     return and says nothing about this one's hook count.
 */
const HOOK = /(?<![.\w])use[A-Z]\w*\(/;
const SCOPE = /^(?:export )?(?:async )?(?:function|const|class) (\w+)/;
const TOP_RETURN = /^ {2}(?:if \(.*\) )?return\b/;

interface Offence {
  file: string;
  scope: string;
  returnLine: number;
  hookLine: number;
  text: string;
}

function offences(src: string, file: string): Offence[] {
  const found: Offence[] = [];
  let scope = "";
  let returnedAt = 0;
  src.split("\n").forEach((line, i) => {
    const opens = SCOPE.exec(line);
    if (opens) {
      // A new top-level declaration ends the previous one's body, whatever it
      // was — this is what stops a helper's early return from being blamed on
      // the component above it.
      scope = opens[1]!;
      returnedAt = 0;
      return;
    }
    const guarded = /^[A-Z]/.test(scope) || /^use[A-Z]/.test(scope);
    if (!guarded) return;
    // Asked BEFORE this line can open the zone, because `return useThing()` is
    // a one-expression body — the hook is the return, not something stranded
    // after it, and half the custom hooks in `lib/` are written that way.
    if (returnedAt !== 0 && HOOK.test(line)) {
      found.push({ file, scope, returnLine: returnedAt, hookLine: i + 1, text: line.trim() });
    }
    if (returnedAt === 0 && TOP_RETURN.test(line)) returnedAt = i + 1;
  });
  return found;
}

describe("hooks are called on every render or they are not called at all", () => {
  it("finds no hook below an early return anywhere in the app", () => {
    const src = fileURLToPath(new URL("../src", import.meta.url));
    const all: Offence[] = [];
    for (const rel of readdirSync(src, { recursive: true, encoding: "utf8" })) {
      if (!rel.endsWith(".tsx") && !rel.endsWith(".ts")) continue;
      all.push(...offences(readFileSync(`${src}/${rel}`, "utf8"), `src/${rel}`));
    }
    expect(
      all.map((o) => `${o.file}:${o.hookLine} — ${o.scope} returns at ${o.returnLine}: ${o.text}`),
      "move the hook up with the others; a conditional hook is a white screen",
    ).toEqual([]);
  });

  it("recognises the shape that actually shipped", () => {
    // The exact code that whited out the canvas, kept as a specimen so the
    // detector is proven against the real thing rather than an invented one.
    const shipped = [
      "export function OwnCursor({ actor }: { actor: Actor }) {",
      "  const tool = useUiStore((s) => s.activeTool);",
      "  if (!shown) return null;",
      "  const color = useActorColor(actor.id);",
      "  return <div />;",
    ].join("\n");
    expect(offences(shipped, "specimen")).toHaveLength(1);
  });

  it("does not mistake a plain store read for a hook", () => {
    // `useUiStore.getState()` reads once through the store object. It is the
    // RIGHT call below a return, and a guard that banned it would push people
    // to subscribe where they must not.
    const fine = [
      "export function Panel() {",
      "  const open = useUiStore((s) => s.open);",
      "  if (!open) return null;",
      "  const ui = useUiStore.getState();",
      "  return <div>{ui.name}</div>;",
      "}",
    ].join("\n");
    expect(offences(fine, "specimen")).toEqual([]);
  });

  it("does not mistake a one-expression body for a stranded hook", () => {
    // `return useCanvasStore(...)` is how most of `lib/`'s custom hooks are
    // written, and the hook there is the body, not something after it.
    const fine = [
      "export function useActorNames() {",
      "  return useCanvasStore((s) => s.actorNames);",
      "}",
    ].join("\n");
    expect(offences(fine, "specimen")).toEqual([]);
  });

  it("does not blame a component for the next function's early return", () => {
    const fine = [
      "export function Widget() {",
      "  const a = useThing();",
      "  return <div>{a}</div>;",
      "}",
      "",
      "function usePopoverPlacement(x: number) {",
      "  const ref = useRef(null);",
      "  return ref;",
      "}",
    ].join("\n");
    expect(offences(fine, "specimen")).toEqual([]);
  });
});
