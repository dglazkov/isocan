/**
 * **A persona: a named role an agent takes on.**
 *
 * A lens, the skills to use it, a goal it is judged against, and a memory of
 * what it already found. `docs/projects/personas/design.md` is the argument;
 * this file is the one reading of the format, so the CLI, the web app and any
 * harness that opens the file are looking at the same thing.
 *
 * **The persona is the costume, not the actor.** Any agent can wear one, and
 * the canvas already knows who is actually working — presence is a session
 * with an actor behind it. Nothing here identifies a person.
 *
 * The file is Markdown with YAML-ish front matter, in the shape Claude Code
 * already parses, so the doorway in `.claude/agents/` needs no translation.
 * Keys that vendor does not know (`goal`, `runs`, `trigger`) are ours and it
 * ignores them, which is the whole reason to stay inside its shape rather than
 * invent a better one.
 */
/**
 * **A goal is a number, a bound, and the command that produces it.**
 *
 * Not an aspiration. The night shift's rule, which this borrows verbatim
 * because it is stricter than it looks: a change may be called an improvement
 * only if it names, BEFORE the work starts, a number that is already being
 * measured. "Keep the design accessible" is not a goal. "Zero contrast
 * failures at 390, 768 and 1440, measured by `grade.mjs`" is one.
 *
 * `at` is deliberately absent until somebody measures it. A baseline invented
 * at authoring time is a number nobody took, and a persona judged against one
 * is judged against fiction — see `baselineOf`.
 */
interface PersonaGoal {
    /** What is counted, in the words a person would use. */
    name: string;
    /** The direction that is good, and the line. */
    bound: {
        kind: "at most" | "at least";
        value: number;
    };
    /** The command that produces the number. Runnable, not descriptive. */
    measuredBy: string;
    /** The unit, when there is one — "ms", "%", left off for a plain count. */
    unit?: string;
    /** What it measured when the baseline was taken, and when. */
    baseline?: {
        value: number;
        at: string;
        commit?: string;
    };
}
/** Time, or an event. `docs/projects/personas/design.md` argues for starting
 *  with time: it is built, and its failure mode is boring. */
type PersonaTrigger = {
    kind: "schedule";
    cron: string;
} | {
    kind: "push";
    to: string;
    paths?: string[];
} | {
    kind: "manual";
};
export interface Persona {
    /** The filename's stem, and the name every surface calls it by. */
    name: string;
    /** When to reach for it — one line, because it is read in a list. */
    description: string;
    model?: string;
    effort?: string;
    /** Tool names, as the harness spells them. Not validated here: this file
     *  must not become a registry of what some vendor allows this month. */
    tools: string[];
    goals: PersonaGoal[];
    trigger: PersonaTrigger;
    /** Where its runs are filed. */
    runs?: string;
    /** Everything after the front matter — the lens itself, in prose, which is
     *  the part a model actually reads. Kept verbatim. */
    body: string;
    /** Front-matter keys this build did not recognise, kept so a round trip
     *  through an editor cannot silently delete somebody else's. */
    extra: Record<string, string>;
}
export declare const PERSONA_DIR = ".agents/personas";
/**
 * Where the vendor doorway goes. A relative symlink to the file above, never
 * a copy — `installSkill` uses the same arrangement for the skill, and its
 * comment says why: one copy per directory, several doorways to it.
 */
export declare const PERSONA_DOORWAY = ".claude/agents";
/** Split front matter from body. Returns null when there is no front matter,
 *  which is a file that is not a persona rather than a malformed one. */
export declare function splitFrontMatter(text: string): {
    front: string;
    body: string;
} | null;
/**
 * **`at most 12ms` and `at least 3`** — the two bounds a goal can have, read
 * off one line so the file stays something a person writes by hand.
 *
 * The unit rides with the number rather than in its own key, because that is
 * how anybody would type it, and separating them is the kind of tidiness that
 * makes a format worse to use than to parse.
 */
export declare function parseBound(text: string): {
    bound: PersonaGoal["bound"];
    unit?: string;
} | null;
/**
 * Read one persona file. `name` falls back to the filename's stem, because a
 * file whose front matter disagrees with what it is called is a persona two
 * surfaces would refer to differently.
 */
export declare function parsePersona(text: string, filename: string): Persona | null;
/**
 * **What a persona is judged on, in one line per goal.** The same sentence on
 * every surface — a list in the terminal, a row in the app — because a goal
 * described two ways is a goal two people disagree about.
 */
export declare function goalLine(goal: PersonaGoal): string;
/**
 * **A persona with no measured goal cannot fail**, and the build rule from the
 * design says so plainly: three instruments this week reported nothing and were
 * believed. This is that rule as a function, so both surfaces can say it in the
 * same words rather than each deciding how loudly to worry.
 */
export declare function personaWarnings(persona: Persona): string[];
/** Newest baseline wins; used when a run records one. */
export declare function withBaseline(persona: Persona, goalName: string, reading: {
    value: number;
    at: string;
    commit?: string;
}): Persona;
/**
 * **What a run found, and what was done about it.**
 *
 * Step 5 of `docs/projects/personas/design.md`: a finding is accepted,
 * rejected, or unanswered — *"still no score, just the column."*
 *
 * Read out of the run page's own table rather than kept in a second file,
 * because the page is what a person edits when they decide. A record that
 * lives beside the thing it describes cannot drift from it; one that lives
 * elsewhere needs somebody to keep the two in step, and nobody ever does.
 */
type FindingOutcome = "accepted" | "rejected" | "unanswered";
export interface RunFinding {
    finding: string;
    outcome: FindingOutcome;
}
/**
 * The findings table of one run page. Anything that is not one of the three
 * words is read as `unanswered` — a cell somebody typed a sentence into is a
 * finding nobody has decided, and guessing at their meaning would be worse
 * than saying so.
 */
export declare function runFindings(page: string): RunFinding[];
/**
 * **Counted, and deliberately not scored.**
 *
 * An accept rate over five findings is noise, and a trust score that governs
 * autonomy before it means anything is a way to lose trust in trust. So this
 * returns the tally and nothing derived from it: the ratio is somebody's to
 * compute when there is enough to argue about.
 */
export declare function tallyOutcomes(findings: readonly RunFinding[]): Record<FindingOutcome, number>;
export {};
