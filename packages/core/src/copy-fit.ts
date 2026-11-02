/**
 * **Fit: does a string have the room its role allows?** (copy-edit phase 4 —
 * `docs/projects/copy-edit/phases.md`, design point 4 of
 * `docs/research/2026-10-02-copy-edit.md`, journey scene 3.)
 *
 * A copy variant can be good words and still not fit: *Warm*'s button reads
 * "Let's get you all set up and ready", and in the real screen that is two
 * lines in a one-line button. A model cannot see that from the source; only
 * the renderer can. So the check is split the way the rest of the copy work
 * is: the MEASUREMENT happens where screens render (the web's compare frames
 * count each string's line boxes and whether its box overflows), and the RULE
 * — given what was measured and the string's role, does it fit, and if not,
 * why, in words — is here, pure, so every surface says the same sentence.
 *
 * A role's budget has two halves. `lines` is the most line boxes the role may
 * take when rendered (a button gets one; body copy is unbounded). `chars` is
 * the most characters a string of that role may be before anything is
 * rendered — the bound a copy variant is held to when it is written
 * (`checkCopyVariants`), and the only fit a surface with no renderer can
 * honestly report (`isocan words lint`, said as a character count).
 *
 * The mark is a fact, not a refusal: a person can still take the string that
 * does not fit (journey scene 3).
 */

/** The room a role gives its words: line boxes when rendered (null: unbounded), and characters before. */
export interface CopyBudget {
  lines: number | null;
  chars: number;
  /** The role is one line of source text: no line breaks in the words themselves. */
  oneLine: boolean;
}

/**
 * Every role's budget. The `chars` and `oneLine` halves are the shape a role
 * kept in phase 2; `lines` is what phase 4 measures against. A heading gets
 * two lines (a display heading that wraps once is a layout, three times is a
 * paragraph); a link may wrap once inside running text; labels, buttons,
 * navigation and placeholders stay on one.
 */
const ROLE_BUDGET: Record<string, CopyBudget> = {
  button: { lines: 1, chars: 40, oneLine: true },
  nav: { lines: 1, chars: 32, oneLine: true },
  label: { lines: 1, chars: 60, oneLine: true },
  placeholder: { lines: 1, chars: 80, oneLine: true },
  link: { lines: 2, chars: 80, oneLine: true },
  heading: { lines: 2, chars: 140, oneLine: true },
  alt: { lines: null, chars: 240, oneLine: true },
  error: { lines: 3, chars: 240, oneLine: false },
  empty: { lines: 4, chars: 400, oneLine: false },
  body: { lines: null, chars: 1200, oneLine: false },
};

/** The budget a role gives — body copy's for a role this file does not know. */
export function copyBudget(role: string): CopyBudget {
  return ROLE_BUDGET[role] ?? ROLE_BUDGET.body!;
}

/** What the renderer measured for one string: its line boxes, and whether its box overflows (or clips) it. */
interface CopyMeasure {
  lines: number;
  overflow: boolean;
}

/** Whether one string fits, and when it does not, why — in words. */
type CopyFit = { fits: true } | { fits: false; why: string };

const SPELLED = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const spell = (n: number) => SPELLED[n] ?? String(n);
const lineWord = (n: number) => `${spell(n)}-line`;

/**
 * **The fit rule.** A string does not fit when its box overflows it (the
 * words spill past, or are clipped at, the edge the layout gave them), or
 * when it wraps past the lines its role allows. Said the way the journey says
 * it: "two lines in a one-line button".
 */
export function copyFit(role: string, measured: CopyMeasure): CopyFit {
  const budget = copyBudget(role);
  const lines = Math.max(1, Math.round(measured.lines));
  if (budget.lines !== null && lines > budget.lines) {
    return { fits: false, why: `${spell(lines)} lines in a ${lineWord(budget.lines)} ${role}${measured.overflow ? ", and it overflows its box" : ""}` };
  }
  if (measured.overflow) return { fits: false, why: `overflows its box — the ${role}'s words run past the room the layout gives them` };
  return { fits: true };
}

/**
 * The fit a surface without a renderer can report: characters against the
 * role's `chars`. Never called a measurement — the sentence says it is a count.
 */
export function copyFitByCount(role: string, text: string): CopyFit {
  const budget = copyBudget(role);
  // Whitespace collapses where HTML renders, so a heading written over two source lines is still one string.
  const n = text.trim().replace(/\s+/g, " ").length;
  if (n > budget.chars) return { fits: false, why: `${n} characters — a ${role}'s budget is ${budget.chars} (by character count; Compare the copy… measures the real box)` };
  return { fits: true };
}
