import type { CopyDeck } from "./copy-deck.js";
import { type CopyVoice } from "./copy-voice.js";
import type { SLOP_RULES } from "./slop.js";
/**
 * **The copy lint: a flow's words, checked** (copy-edit phase 4 —
 * `docs/projects/copy-edit/phases.md`, design point 5 of
 * `docs/research/2026-10-02-copy-edit.md`, journey scene 4).
 *
 * Design lint grades colour, size, radius and spacing (`designaudit.ts`);
 * nothing graded the words. This does, over one screen's deck or a whole
 * flow's, and every finding names the screen, the string's address and what
 * to do — so an agent can fix the string with `isocan words --apply`, not the
 * file. Five kinds:
 *
 * - **glossary** — a string says a form the Voice section bans ("Log in"
 *   where the voice says "sign in"); **avoid** — a word the voice avoids.
 * - **one-name** — across the flow the same thing is called two names
 *   ("Sign in" here, "Log in" next door) and no glossary line settles which.
 *   The families are the few the web reliably splits (`NAME_FAMILIES`), plus
 *   every glossary line; a glossary family is reported as glossary slips, not
 *   twice.
 * - **tell** — the copy tells of a generated interface. Not a second list:
 *   these are `slop.ts`'s copy rules (`SLOP_RULES`, which the design auditor
 *   and the system prompt already read), each given a detector here, and the
 *   finding quotes the rule's own name and advice. A rule that needs judgement
 *   rather than a pattern is listed in `UNCHECKED_TELLS` with why, so the
 *   gap is said, not hidden (`copy-lint.test.ts` holds the two lists to the
 *   rules). The caller hands the rules in (`SLOP_RULES`, from the barrel):
 *   imported here, `slop.ts` — eager in both clients — would be shared with
 *   this lazy file and carved into a chunk of its own, one more module on
 *   `isocan --version` (`test/cli-bundle.test.ts`, measured 2 Oct 2026).
 * - **length** — a string over its role's character budget. A count, said as
 *   one: the rendered fit is measured where screens render (*Compare the
 *   copy…*), and a surface without a renderer says so.
 */
interface LintScreen {
    itemId: string;
    title: string;
    deck: CopyDeck;
}
type CopyLintKind = "glossary" | "avoid" | "one-name" | "tell" | "length" | "voice";
interface CopyLintFinding {
    kind: CopyLintKind;
    /** The screen, when the finding is about one (a Voice section problem is about none). */
    itemId?: string;
    title?: string;
    address?: string;
    role?: string;
    text?: string;
    /** What is wrong, in words. */
    what: string;
    /** What to do instead. */
    fix: string;
}
/** The copy rules a pattern cannot judge, and why — said, so nobody believes the lint checked them. */
export declare const UNCHECKED_TELLS: Record<string, string>;
/** The copy tells the lint checks: `SLOP_RULES`' copy half, each with its detector. */
export declare const CHECKED_TELLS: string[];
/**
 * **Lint the words of one screen or a flow.** `screens` in reading order (a
 * flow's order); `voice` is the governing DESIGN.md's Voice section, or null;
 * `rules` is `SLOP_RULES` — the copy half is read, each by its detector.
 * Findings come back screen by screen in reading order, the flow-wide ones
 * (one-name, the voice's own problems) after.
 */
export declare function lintCopy(screens: readonly LintScreen[], voice: CopyVoice | null, slopRules: typeof SLOP_RULES): CopyLintFinding[];
export {};
