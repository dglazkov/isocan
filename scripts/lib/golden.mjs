/**
 * **Golden tasks — the browser-free half.**
 *
 * Stage 3 of `docs/projects/evals/plan.md`: a task is a starting screen (a
 * synthetic fixture), an ask in plain words, and a grader. The graders here
 * are the ones that read the FILE — what is in it, what is missing, what is
 * in what order, and what changed against the fixture. The ones that need a
 * rendered page (contrast, sideways scroll, named controls…) are
 * `scripts/grade.mjs`'s, and `scripts/golden.mjs` asks it. Splitting the two
 * is what lets the suite's own test run in vitest without a browser: every
 * task's reference answer must pass its file checks and every task's
 * untouched fixture must fail at least one, or the task is not measuring
 * anything.
 *
 * Deliberately no DOM library. A check reads the HTML as text and as a very
 * small tag walk — enough for "is there a `[role=alert]`", "does *Arrival*
 * come before *Departure*", "is the `<nav>` byte-for-byte what it was" — and
 * nothing that would tempt a check into judging taste. Taste is Stage 4's.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repo = fileURLToPath(new URL("../..", import.meta.url));
export const SUITE = path.join(repo, "evals/golden/v1");

export function loadSuite(dir = SUITE) {
  const suite = JSON.parse(readFileSync(path.join(dir, "tasks.json"), "utf8"));
  for (const task of suite.tasks) {
    task.fixturePath = path.join(dir, "fixtures", task.fixture);
    task.answerPath = path.join(dir, "answers", task.answer);
  }
  return suite;
}

// ---- reading a file ----

const strip = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
/** The words a reader would see, in document order, whitespace folded. */
export const visibleText = (html) => decode(strip(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/**
 * A tiny selector matcher: `tag`, `.class`, `#id`, `[attr]`, `[attr=value]`,
 * `[attr*=part]`, and one level of combination (`tag.class[attr]`). It finds
 * opening tags, not subtrees, which is all a count or a presence check needs;
 * `outerOf` walks to the matching close for the change checks.
 */
export function matchTags(html, selector) {
  const m = selector.match(/^([a-z][a-z0-9-]*)?((?:[.#][\w-]+|\[[^\]]+\])*)$/i);
  if (!m) throw new Error(`golden: selector too clever for this grader: ${selector}`);
  const tag = m[1]?.toLowerCase();
  const parts = [...(m[2] ?? "").matchAll(/([.#])([\w-]+)|\[([\w-]+)(?:([*^$]?)=["']?([^"'\]]*)["']?)?\]/g)];
  const out = [];
  for (const t of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    const name = t[1].toLowerCase();
    if (tag && name !== tag) continue;
    const attrs = t[2];
    const attr = (k) => { const a = attrs.match(new RegExp(`\\b${k}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")); return a ? (a[2] ?? a[3] ?? a[4]) : attrs.match(new RegExp(`\\b${k}\\b`, "i")) ? "" : null; };
    let ok = true;
    for (const p of parts) {
      if (p[1] === ".") ok = (attr("class") ?? "").split(/\s+/).includes(p[2]);
      else if (p[1] === "#") ok = attr("id") === p[2];
      else {
        const v = attr(p[3]);
        if (v === null) ok = false;
        else if (p[5] === undefined) ok = true;
        else if (p[4] === "*") ok = v.includes(p[5]);
        else if (p[4] === "^") ok = v.startsWith(p[5]);
        else if (p[4] === "$") ok = v.endsWith(p[5]);
        else ok = v === p[5];
      }
      if (!ok) break;
    }
    if (ok) out.push({ index: t.index, tag: name, attrs, attr });
  }
  return out;
}

const VOID = new Set(["img", "br", "hr", "input", "meta", "link", "source", "wbr", "area", "col", "embed", "track"]);
/** The outer HTML of the first match — the element and everything in it. */
export function outerOf(html, selector, nth = 0) {
  const hit = matchTags(html, selector)[nth];
  if (!hit) return null;
  if (VOID.has(hit.tag)) return html.slice(hit.index, html.indexOf(">", hit.index) + 1);
  let depth = 0;
  const re = new RegExp(`<(/?)${hit.tag}\\b[^>]*>`, "gi");
  re.lastIndex = hit.index;
  for (let t; (t = re.exec(html)); ) {
    if (t[1] === "/") { depth -= 1; if (depth === 0) return html.slice(hit.index, t.index + t[0].length); }
    else if (!t[0].endsWith("/>")) depth += 1;
  }
  return html.slice(hit.index);
}
const norm = (s) => s.replace(/\s+/g, " ").trim();

// ---- the checks ----

/**
 * One check → `{ name, ok, why }`. The names are what a person reads, so
 * they say what was looked for, not which function ran.
 */
export function fileCheck(check, output, fixture) {
  const text = visibleText(output);
  const has = (s) => text.toLowerCase().includes(s.toLowerCase());
  switch (check.kind) {
    case "text": {
      const ok = has(check.text);
      return { name: `says "${check.text}"`, ok, why: ok ? "" : "not in the visible text" };
    }
    case "no-text": {
      const ok = !has(check.text);
      return { name: `no longer says "${check.text}"`, ok, why: ok ? "" : "still in the visible text" };
    }
    case "matches": {
      const ok = new RegExp(check.pattern, "i").test(text);
      return { name: `says something like /${check.pattern}/`, ok, why: ok ? "" : "nothing matched" };
    }
    case "text-count": {
      const n = text.toLowerCase().split(check.text.toLowerCase()).length - 1;
      const ok = n >= (check.min ?? 1) && n <= (check.max ?? Infinity);
      return { name: `"${check.text}" appears ${check.min ?? 1}${check.max !== undefined ? `–${check.max}` : "+"} times`, ok, why: ok ? "" : `appears ${n} times` };
    }
    case "selector": {
      const n = matchTags(output, check.selector).length;
      const min = check.min ?? 1, max = check.max ?? Infinity;
      const ok = n >= min && n <= max;
      const want = max === Infinity ? `≥ ${min}` : min === max ? `${min}` : `${min}–${max}`;
      return { name: `${want} × ${check.selector}`, ok, why: ok ? "" : `found ${n}` };
    }
    case "attr": {
      const hits = matchTags(output, check.selector);
      const v = hits[0]?.attr(check.name) ?? null;
      let ok = v !== null;
      if (ok && check.contains !== undefined) ok = v.includes(check.contains);
      if (ok && check.value !== undefined) ok = v === check.value;
      if (ok && check.minLength !== undefined) ok = v.length >= check.minLength;
      return { name: `${check.selector} has ${check.name}${check.contains ? ` containing "${check.contains}"` : check.value !== undefined ? ` = "${check.value}"` : ""}`, ok, why: ok ? "" : hits.length === 0 ? "no such element" : v === null ? "attribute missing" : `it is "${v.slice(0, 40)}"` };
    }
    case "order": {
      const lower = text.toLowerCase();
      const idx = check.texts.map((t) => lower.indexOf(t.toLowerCase()));
      const missing = check.texts.filter((_, i) => idx[i] < 0);
      const ok = missing.length === 0 && idx.every((v, i) => i === 0 || v > idx[i - 1]);
      return { name: `in order: ${check.texts.join(" → ")}`, ok, why: ok ? "" : missing.length ? `missing ${missing.join(", ")}` : `found in order ${[...check.texts].sort((a, b) => idx[check.texts.indexOf(a)] - idx[check.texts.indexOf(b)]).join(" → ")}` };
    }
    case "unchanged": {
      // The one thing was asked for; everything else stays. Compared with
      // whitespace folded so a reformat is not a change, and byte-exact
      // otherwise so a "small tidy" of the nav is caught as the drift it is.
      const before = outerOf(fixture, check.selector), after = outerOf(output, check.selector);
      const ok = before !== null && after !== null && norm(before) === norm(after);
      return { name: `${check.selector} untouched`, ok, why: ok ? "" : after === null ? "gone" : before === null ? "fixture lacks it" : "differs from the fixture" };
    }
    case "same-text": {
      const before = visibleText(fixture), after = text;
      const ok = before === after;
      return { name: "the words are the same", ok, why: ok ? "" : "the visible text changed" };
    }
    case "same-words": {
      // Rearranged, not rewritten: the same words, in any order. For the
      // arrange tasks, where `same-text` would fail the very move asked for.
      const bag = (s) => s.toLowerCase().split(/\s+/).filter(Boolean).sort().join(" ");
      const ok = bag(visibleText(fixture)) === bag(text);
      return { name: "the same words, rearranged", ok, why: ok ? "" : "words were added or lost" };
    }
    case "changed": {
      const before = outerOf(fixture, check.selector), after = outerOf(output, check.selector);
      const ok = after !== null && (before === null || norm(before) !== norm(after));
      return { name: `${check.selector} changed`, ok, why: ok ? "" : after === null ? "gone" : "identical to the fixture" };
    }
    case "headings": {
      const n = (output.match(/^#{1,6}\s+\S/gm) ?? []).length;
      const ok = n >= (check.min ?? 1);
      return { name: `≥ ${check.min ?? 1} markdown headings`, ok, why: ok ? "" : `found ${n}` };
    }
    case "fewer-literals": {
      // Colour literals in the output may not exceed the fixture's minus the
      // asked-for reduction; counted the way grade.mjs counts them.
      const count = (h) => { const css = h.replace(/\/\*[\s\S]*?\*\//g, ""); return (css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length + (css.match(/\b(?:rgba?|hsla?)\([^)]*\)/g) ?? []).length; };
      const before = count(fixture), after = count(output);
      const ok = after <= (check.max ?? Math.max(0, before - (check.by ?? 1)));
      return { name: `colour literals ≤ ${check.max ?? `fixture − ${check.by ?? 1}`}`, ok, why: ok ? "" : `fixture ${before}, output ${after}` };
    }
    default:
      throw new Error(`golden: unknown check kind ${check.kind}`);
  }
}

/** Every file check of a task, on an output. */
export function fileChecks(task, output, fixture) {
  return (task.checks ?? []).filter((c) => c.kind !== "screen").map((c) => fileCheck(c, output, fixture));
}

/** The screen checks a task asks `grade.mjs` for, by name. */
export const screenChecksOf = (task) => (task.checks ?? []).find((c) => c.kind === "screen")?.names ?? [];
