import type { CopyDeck } from "./copy-deck.ts";
import { copyFitByCount } from "./copy-fit.ts";
import { saysPhrase, voiceSlips, voiceSlipText, type CopyVoice } from "./copy-voice.ts";
import type { SLOP_RULES } from "./slop.ts";

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

/**
 * Names the web reliably splits one thing into. Each family is one thing;
 * a flow that says two of its members has two names for it. Matched as whole
 * words, any case, hyphens as spaces.
 */
const NAME_FAMILIES: string[][] = [
  ["sign in", "log in", "login", "log on", "sign on"],
  ["sign up", "register", "create an account", "create account"],
  ["sign out", "log out", "logout"],
  ["cart", "basket", "bag"],
  ["email", "e-mail"],
  ["settings", "preferences"],
];

type Detector = (screen: LintScreen) => Array<{ address?: string; role?: string; text?: string; said: string }>;

const each = (match: (text: string, role: string) => string | null, roles?: readonly string[]): Detector => (screen) =>
  screen.deck.strings.flatMap((s) => {
    if (roles && !roles.includes(s.role)) return [];
    const said = match(s.text, s.role);
    return said ? [{ address: s.address, role: s.role, text: s.text, said }] : [];
  });

const first = (re: RegExp) => (text: string) => re.exec(text)?.[0] ?? null;

const SENTENCE = /[A-Za-z][A-Za-z'’]+/g;
const MINOR = new Set(["a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "at", "for", "by", "with", "from", "as", "is", "it", "your", "my", "our"]);

/** "Review Your Order" — every word of four or more letters capitalised, and at least two words. */
function titleCase(text: string): boolean | null {
  const ws = text.match(SENTENCE) ?? [];
  const long = ws.filter((w, i) => i > 0 && !MINOR.has(w.toLowerCase()) && w.length >= 3);
  if (ws.length < 2 || long.length === 0) return null;
  if (long.some((w) => w === w.toUpperCase())) return null; // an acronym says nothing about case style
  return long.every((w) => /^[A-Z]/.test(w));
}

/**
 * A detector for each of `slop.ts`'s copy rules that a pattern can spot.
 * Keyed by the rule's name; the finding quotes the rule.
 */
const COPY_TELLS: Record<string, Detector> = {
  "Generic call to action": each(first(/^\s*(get started|learn more|click here|discover)\b[\s!.→›>»]*$/i), ["button", "link", "nav"]),
  "Marketing adjectives instead of facts": each(first(/\b(seamless(?:ly)?|revolutioni[sz](?:e|es|ing)|unlock(?:s|ing)?|elevate(?:s|d)?|effortless(?:ly)?|cutting[- ]edge|(?:take it )?to the next level)\b/i)),
  "Lorem or invented content": each(first(/\b(lorem ipsum|dolor sit amet|john doe|jane doe|company name|your company)\b/i)),
  "Not just X — it's Y": each(first(/\b(?:not just (?:a |an |another )?[^.!?]{1,60}?[—–,;:]\s*(?:it'?s|it is|but|we'?re)\b|more than (?:just )?(?:a|an) [^.!?]{1,40}?\s*[—–:])/i)),
  "The opener that says nothing": each(first(/(?:\bin today'?s (?:fast[- ]paced|digital|modern|busy) (?:world|age)|\bin an era of\b|^\s*whether you'?re an? [^.!?]{1,40}? or an? )/i)),
  "Apology as an error message": each((text) => {
    const m = /\b(oops!?|something went wrong|we'?re sorry|sorry,? something)\b/i.exec(text);
    if (!m) return null;
    // An apology WITH a cause and a next step is information; an apology alone is not.
    const rest = text.replace(m[0], "").match(SENTENCE) ?? [];
    return rest.length < 5 ? m[0] : null;
  }),
  "Copy that narrates the interface": each(first(/\b(click (?:the|this) (?:button|link) (?:below|above)|use this (?:section|page|screen|form) to|here you can)\b/i)),
  "Title Case On Everything": (screen) => {
    const cased = screen.deck.strings.filter((s) => ["heading", "button", "label", "nav", "link"].includes(s.role)).map((s) => ({ s, title: titleCase(s.text) })).filter((x) => x.title !== null);
    if (cased.length < 3 || !cased.every((x) => x.title)) return [];
    return [{ said: `${cased.length} headings, buttons and labels, all Title Case — ${cased.slice(0, 3).map((x) => `"${x.s.text}"`).join(", ")}` }];
  },
};

/** The copy rules a pattern cannot judge, and why — said, so nobody believes the lint checked them. */
export const UNCHECKED_TELLS: Record<string, string> = {
  "The tricolon on repeat": "whether the third item adds anything is a judgement, not a pattern",
};

/** The copy tells the lint checks: `SLOP_RULES`' copy half, each with its detector. */
export const CHECKED_TELLS = Object.keys(COPY_TELLS);

const norm = (s: string) => s.toLowerCase().replace(/[-\s ]+/g, " ").trim();
const show = (s: string) => JSON.stringify(s.length > 48 ? `${s.slice(0, 47)}…` : s);

/**
 * **Lint the words of one screen or a flow.** `screens` in reading order (a
 * flow's order); `voice` is the governing DESIGN.md's Voice section, or null;
 * `rules` is `SLOP_RULES` — the copy half is read, each by its detector.
 * Findings come back screen by screen in reading order, the flow-wide ones
 * (one-name, the voice's own problems) after.
 */
export function lintCopy(screens: readonly LintScreen[], voice: CopyVoice | null, slopRules: typeof SLOP_RULES): CopyLintFinding[] {
  const out: CopyLintFinding[] = [];
  const rules = new Map(slopRules.filter((r) => r.kind === "copy").map((r) => [r.name, r]));

  for (const screen of screens) {
    const at = { itemId: screen.itemId, title: screen.title };
    for (const s of screen.deck.strings) {
      const where = { ...at, address: s.address, role: s.role, text: s.text };
      for (const slip of voiceSlips(voice, s.text)) {
        out.push({ ...where, kind: slip.kind, what: `${s.role} ${voiceSlipText(slip)}`, fix: slip.kind === "glossary" ? `say "${slip.preferred}"` : "say it without that word" });
      }
      const fit = copyFitByCount(s.role, s.text);
      if (!fit.fits) out.push({ ...where, kind: "length", what: fit.why, fix: `shorten it — or measure it: Compare the copy… marks what does not fit the real box` });
    }
    for (const [name, detect] of Object.entries(COPY_TELLS)) {
      const rule = rules.get(name);
      if (!rule) continue;
      for (const hit of detect(screen)) {
        out.push({ ...at, ...(hit.address ? { address: hit.address, role: hit.role, text: hit.text } : {}), kind: "tell", what: `${rule.name}: ${hit.address ? `says ${show(hit.said)}` : hit.said}`, fix: rule.instead });
      }
    }
  }

  // One name per thing, across the flow. A glossary line is a family too —
  // but its banned forms were already reported as slips, so it is not reported again.
  const governed = new Set((voice?.glossary ?? []).flatMap((g) => [g.term, ...g.banned].map(norm)));
  for (const family of NAME_FAMILIES) {
    if (family.some((m) => governed.has(norm(m)))) continue;
    const seen = new Map<string, Array<{ screen: LintScreen; address: string; said: string }>>();
    for (const screen of screens) {
      for (const s of screen.deck.strings) {
        for (const member of family) {
          for (const said of saysPhrase(s.text.replace(/-/g, " "), member.replace(/-/g, " "))) {
            const key = norm(member);
            seen.set(key, [...(seen.get(key) ?? []), { screen, address: s.address, said }]);
          }
        }
      }
    }
    if (seen.size < 2) continue;
    const names = [...seen.entries()];
    const where = names.map(([, hits]) => `${show(hits[0]!.said)} on "${hits[0]!.screen.title}" (${hits[0]!.address})`);
    const firstHit = names[0]![1][0]!;
    out.push({
      kind: "one-name",
      itemId: firstHit.screen.itemId,
      title: firstHit.screen.title,
      what: `one thing, ${names.length} names: ${where.join(", ")}`,
      fix: `pick one and say it everywhere — a glossary line in DESIGN.md's Voice ("${names[0]![0]} — never ${names.slice(1).map(([n]) => n).join(", ")}") keeps it`,
    });
  }

  for (const problem of voice?.problems ?? []) out.push({ kind: "voice", what: `DESIGN.md's Voice section: ${problem}`, fix: "`isocan design show` prints it; `isocan design set` writes it back" });
  return out;
}
