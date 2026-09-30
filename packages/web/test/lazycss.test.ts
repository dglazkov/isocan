import { describe, expect, it } from "vitest";
import { css, rules, selectorsOf } from "./cssrules.ts";
import { classesOf, eagerWebFiles, namedBy, sources } from "./cssuse.ts";

/**
 * **`styles.css` is what a first visit waits for.** It is the one stylesheet
 * `main.tsx` imports, so the browser will not paint the app until all of it
 * has arrived — and much of it styles things a first visit never draws: the
 * file editor, the questionnaire dock, the Context panel, all of which load
 * with their lazy component.
 *
 * BC-2, 27 Sep 2026. The fix is the pattern `chat-tidy.css` and `phone.css`
 * already use: a lazy component's rules live in a sheet beside it, which Vite
 * ships with that component's chunk. The editor's chrome (`stage-editor.css`),
 * the dock (`questionnaire.css`) and the Context panel (`context-panel.css`)
 * moved on the first day, 729 lazy-only rules becoming 658; with BC-3's dead
 * rules gone too, the entry CSS went from 165,590 bytes to 154,900. The
 * rest is a queue, not a failure: each section has to be read for its
 * cascade before it moves, because a moved rule now comes after every rule
 * in `styles.css`.
 *
 * A rule is lazy-only when every selector in it needs a class that only a
 * lazily-loaded web file names (`cssuse.ts` says what "names" and "lazily"
 * mean, and why each errs towards eager).
 */

/**
 * **The last agreed number of lazy-only rules in `styles.css`.** Lower it when
 * a section moves out; a rule added for a lazy component goes in that
 * component's own sheet instead.
 *
 * Raised once, to 713, by DC-4 (27 Sep 2026) without a rule moving: turning
 * on `noUnusedLocals` deleted `Toolbar.tsx`'s unused `IdentityMenu` import,
 * an edge the bundler had always dropped but `eagerWebFiles` still walked. The
 * walk now names 146 files, as the built entry does, and the 55 rules that
 * styled that lazy subtree read as the lazy-only rules they always were. The
 * entry CSS stayed 154,900 bytes.
 *
 * 713 became 319 the same day (the queue, worked). Twelve sheets left
 * `styles.css`, and what decided which was the ENTRY JS rather than the CSS:
 * a lazy chunk's first stylesheet is one more name in the entry's
 * `__vite__mapDeps`, about forty bytes, against the 399 the bundle ceiling
 * had left. So every chunk that already carried CSS, or is only ever asked
 * for by another lazy chunk, went first and free — the ⌘K window, Add, the
 * ink well, the editor's shared buttons — and nine new sheets bought the most
 * rules each: the home screen, a design system read, the Lens, the stage, the
 * workbench, an agent's row, History's track, the printed deck and the Inbox.
 * Entry JS 700,901 to 701,253; entry CSS 154,900 to 115,808. Each move was
 * held to a computed-style comparison in headless Chrome, HEAD's build
 * against the new one, element for element. What is left is mostly small
 * sections whose chunk has no sheet yet, each worth ~40 bytes of entry JS the
 * bundle ceiling no longer has to spare.
 */
const CEILING = 318;

const eagerFiles = eagerWebFiles();
const isLazyWeb = (file: string) => file.startsWith("packages/web/src/") && !eagerFiles.has(file);
const firstVisit = namedBy(sources.filter((s) => !isLazyWeb(s.file)));
const later = namedBy(sources.filter((s) => isLazyWeb(s.file)));

/** Every rule in `styles.css` that only a lazily-loaded component can match. */
function lazyOnly(): string[] {
  return rules(css)
    .filter((rule) => !rule.at.some((at) => at.startsWith("@keyframes")))
    .filter((rule) =>
      selectorsOf(rule).every((selector) => classesOf(selector).some((c) => later(c) && !firstVisit(c))),
    )
    .map((rule) => [...rule.at, rule.selector].join(" "));
}

describe("the stylesheet a first visit waits for", () => {
  it("can tell eager from lazy", () => {
    // A walk that reaches nothing makes every rule lazy-only, and one that
    // reaches everything makes none; the second is silent (lessons.md #8).
    expect(eagerFiles.has("packages/web/src/components/ItemView.tsx"), "the canvas's items read as lazy").toBe(true);
    expect(isLazyWeb("packages/web/src/components/StageEditor.tsx"), "the lazy editor reads as eager").toBe(true);
    expect(eagerFiles.size, "the walk from main.tsx found almost nothing").toBeGreaterThan(100);
  });

  it("carries no more rules for lazy components than the last number somebody agreed to", () => {
    const found = lazyOnly();
    expect(
      found.length,
      `${found.length} rules in styles.css match only what a lazy component renders, past the agreed ${CEILING}.\n` +
        "  Put a lazy component's rules in a sheet beside it (`import \"./x.css\"`), which ships with its chunk;\n" +
        "  when a section moves out, lower CEILING here. All of them, in sheet order:\n    " +
        found.join("\n    "),
    ).toBeLessThanOrEqual(CEILING);
  });
});
