import type { Actor, CanvasContents, Comment, Item, ItemVersion } from "./model.ts";
import { itemKind } from "./kinds.ts";
import { parentOf } from "./lineage.ts";
import { PROPOSAL_PROP, proposalCites, proposalMarked } from "./proposal.ts";

/**
 * **Changes ripple** (proactive-agent phase 6, design §8).
 *
 * A person spends twenty minutes on one screen and stops. What they decided
 * there — a new accent, a tighter type scale, "Collection" where it said
 * "Pickup" — is usually meant for the other screens too, and nothing said so:
 * the canvas held one screen that moved and five that silently fell behind.
 *
 * This is the deterministic half, the part a person can check without a
 * model: **when an iteration has settled** (`rippleRuns`), **what the run
 * changed** that another screen could share (`rippleChanges`: a token's
 * value, a property's value, a term), **which other screens use it and in
 * which of three states** (`rippleRead`: *would change*, *already in sync*,
 * *disagrees, your call*), and **the project pulse** (`ripplePulse`: one tick
 * per screen, current, behind or in conflict). All of it is derived on every
 * read and written nowhere — the pulse is a reading, like the wireframe
 * module's *behind* (`behind.ts`), never a stored flag that could go stale.
 *
 * The other half is the canvas's lead agent's, through the ordinary summons
 * (`rippleAsk`), as Explain's critique and the brief card's re-read are: the
 * edits read back as at most three named decisions in design words, with
 * one good move named once ("caught doing it right"); a preview of each
 * screen that would change, as a proposal (`proposal.ts`) citing the source's
 * version — so nothing changes until the person keeps it; an exception argued
 * in one line; and one sketched idea, set apart. With nobody to answer, the
 * deterministic half still shows and says the rest waits.
 *
 * **The altitude is the person's** (design §8; default screen by screen,
 * never the design system unless they choose it): keep the previews one by
 * one, ask the lead to put the change in the design system (`systemAsk`), or
 * mark the source a one-off (`ripple=off`), which silences it.
 *
 * Its own export path (`@isocan/core/ripple`), so none of this reaches the
 * web's entry chunk: the pulse strip and the panel load it, and the CLI loads
 * it on `isocan ripple`.
 */

/** `ripple=off`: a one-off. On a source it stops the ripple; on any screen the pulse calls it in conflict. One `item.update`, one undo. */
export const RIPPLE_PROP = "ripple";

/**
 * **When an iteration has settled** — chosen 14 Oct 2026, Dion to confirm:
 * at least `RIPPLE_RUN` new versions of one screen by one person in a row
 * (no gap longer than half an hour between them), then quiet on it for
 * `RIPPLE_QUIET_MS` — the journey's "stops, and a minute later". Or the
 * person says so: "I like this" is `isocan ripple <item> --ask` or the
 * panel's **Ripple this**, which reads any run of one or more edits at once.
 */
export const RIPPLE_RUN = 3;
/** How long a run must be quiet before it has settled (design §2.7: never over a run of edits). */
export const RIPPLE_QUIET_MS = 60_000;
const RIPPLE_GAP_MS = 30 * 60_000;

/** One run of edits on one screen: from the version before it to the one it ended on. */
export interface RippleRun {
  itemId: string;
  title: string;
  by: Actor;
  fromVersionId: string;
  toVersionId: string;
  /** 1-based version numbers, for the `itm@vN` refs a person can read. */
  from: number;
  to: number;
  edits: number;
  /** The run's last version, as an instant (ms). */
  lastAt: number;
  /** Quiet long enough (or said so). */
  settled: boolean;
  /** When it settles, if it has not (ms). */
  settlesAt: number;
}

/** A screen the ripple reads: an HTML page that is not itself a proposal. */
function isScreen(item: Item): boolean {
  return itemKind(item) === "screen" && !proposalMarked(item);
}

/** Who stands here as an agent — their edits are not the person's iteration. */
function isAgent(canvas: CanvasContents, actorId: string): boolean {
  return Boolean(canvas.agents?.[actorId]);
}

/**
 * **The run of edits a screen ends on**, or null. The trailing versions by
 * one person, each within half an hour of the last; from the version before
 * them (or the first, when the run made the screen). It needs `RIPPLE_RUN`
 * edits — or, when the person says "I like this" (`explicit`), one — and the
 * screen showing its newest version: a person who stepped back down the
 * stack is not done.
 */
export function rippleRun(canvas: CanvasContents, itemId: string, now: number, explicit = false): RippleRun | null {
  const item = canvas.items[itemId];
  if (!item || !isScreen(item)) return null;
  const vs = item.versions;
  const last = vs.at(-1);
  if (!last || last.id !== item.currentVersionId || isAgent(canvas, last.createdBy.id)) return null;
  let start = vs.length - 1;
  while (start > 0) {
    const prev = vs[start - 1]!;
    if (prev.createdBy.id !== last.createdBy.id || Date.parse(vs[start]!.createdAt) - Date.parse(prev.createdAt) > RIPPLE_GAP_MS) break;
    start -= 1;
  }
  const fromIndex = start === 0 ? 0 : start - 1;
  const edits = vs.length - 1 - fromIndex;
  if (edits < (explicit ? 1 : RIPPLE_RUN)) return null;
  const lastAt = Date.parse(last.createdAt);
  const settlesAt = lastAt + RIPPLE_QUIET_MS;
  return {
    itemId,
    title: item.title || "Untitled",
    by: last.createdBy,
    fromVersionId: vs[fromIndex]!.id,
    toVersionId: last.id,
    from: fromIndex + 1,
    to: vs.length,
    edits,
    lastAt,
    settled: explicit || now >= settlesAt,
    settlesAt,
  };
}

/**
 * Every screen's run on the canvas, settled or not, newest first — what the
 * pulse and the settle trigger read. A run somebody asked about ("I like
 * this", or the settle's own ask) is settled whatever the clock says.
 */
export function rippleRuns(canvas: CanvasContents, now: number): RippleRun[] {
  return Object.values(canvas.items)
    .map((item) => {
      const run = rippleRun(canvas, item.id, now);
      if (run && !run.settled) return rippleRun(canvas, item.id, now, true) && rippleAsked(canvas, rippleAt(run)) ? { ...run, settled: true } : run;
      return run ?? explicitRun(canvas, item.id, now);
    })
    .filter((r): r is RippleRun => r !== null)
    .sort((a, b) => b.lastAt - a.lastAt);
}

/** A run shorter than `RIPPLE_RUN` counts once somebody asked about it. */
function explicitRun(canvas: CanvasContents, itemId: string, now: number): RippleRun | null {
  const run = rippleRun(canvas, itemId, now, true);
  return run && rippleAsked(canvas, rippleAt(run)) ? run : null;
}

/** Where a run is, as the ask, the read-back and the cite name it: `itm_x@v1..v4`. */
export function rippleAt(run: Pick<RippleRun, "itemId" | "from" | "to">): string {
  return `${run.itemId}@v${run.from}..v${run.to}`;
}

// ---------- what a run changed

/** One thing the run changed that another screen could share. */
export interface RippleChange {
  kind: "token" | "value" | "term";
  /** The token (`--accent`), the property (`font-size`), or "" for a term. */
  name: string;
  before: string[];
  after: string[];
  /** How the change is said on a tag: `--accent #b5452a → #8a3a20`. */
  tag: string;
}

/** The properties whose literal values are decisions worth carrying across: colour, type, space, shape. */
const TRACKED = new Set([
  "color", "background", "background-color", "border-color",
  "font-size", "font-weight", "font-family", "line-height", "letter-spacing",
  "border-radius", "padding", "margin", "gap",
]);

/** A screen, read for what a ripple asks of it. */
interface ScreenRead {
  tokens: Map<string, string>;
  refs: Set<string>;
  values: Map<string, Set<string>>;
  words: Set<string>;
  /** First spelling of each word, for the tag a person reads. */
  spelled: Map<string, string>;
}

function normValue(raw: string): string {
  const v = raw.replace(/!important/i, "").trim().toLowerCase().replace(/\s+/g, " ");
  return /^#[\da-f]{3}$/.test(v) ? `#${[...v.slice(1)].map((c) => c + c).join("")}` : v;
}

/** Read a screen's styles and words without a parser — the regex is enough for what a ripple compares, and keeps parse5 out of the pulse's chunk. */
function readScreen(html: string): ScreenRead {
  const css: string[] = [];
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) css.push(m[1]!);
  for (const m of html.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) css.push(m[1] ?? m[2] ?? "");
  const out: ScreenRead = { tokens: new Map(), refs: new Set(), values: new Map(), words: new Set(), spelled: new Map() };
  const text = css.join(";").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of text.matchAll(/(--[\w-]+|[a-z-]+)\s*:\s*([^;{}]+)/gi)) {
    const prop = m[1]!.toLowerCase();
    const value = normValue(m[2]!);
    if (prop.startsWith("--")) {
      if (!out.tokens.has(prop)) out.tokens.set(prop, value);
    } else if (TRACKED.has(prop) && !value.includes("var(")) {
      if (!out.values.has(prop)) out.values.set(prop, new Set());
      out.values.get(prop)!.add(value);
    }
  }
  for (const m of text.matchAll(/var\(\s*(--[\w-]+)/gi)) out.refs.add(m[1]!.toLowerCase());
  const visible = html
    .replace(/<(style|script|title|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(nbsp|middot|amp|times);/g, " ");
  for (const m of visible.matchAll(/\p{L}[\p{L}'’-]*/gu)) {
    const word = m[0];
    if (word.length < 3) continue;
    const key = word.toLowerCase();
    out.words.add(key);
    if (!out.spelled.has(key)) out.spelled.set(key, word);
  }
  return out;
}

const minus = <T,>(a: Iterable<T>, b: Set<T>) => [...a].filter((x) => !b.has(x));

/**
 * **What a run changed that another screen could share**, from the version
 * before it and the one it ended on: a token whose value moved
 * (`--accent: #b5452a` → `#8a3a20`); a colour, type, space or shape value the
 * screen stopped using in favour of another (`font-size: 18px` → `16px`);
 * and a term, when a word or three went out and a word or three came in
 * ("Pickup" → "Collection") — a rewrite of the copy is not a term.
 */
export function rippleChanges(beforeHtml: string, afterHtml: string): RippleChange[] {
  const a = readScreen(beforeHtml);
  const b = readScreen(afterHtml);
  const out: RippleChange[] = [];
  for (const [name, was] of a.tokens) {
    const now = b.tokens.get(name);
    if (now !== undefined && now !== was) out.push({ kind: "token", name, before: [was], after: [now], tag: `${name} ${was} → ${now}` });
  }
  for (const [prop, was] of a.values) {
    const now = b.values.get(prop) ?? new Set<string>();
    const gone = minus(was, now);
    const came = minus(now, was);
    if (gone.length && came.length) out.push({ kind: "value", name: prop, before: gone, after: came, tag: `${prop} ${gone.join(", ")} → ${came.join(", ")}` });
  }
  const gone = minus(a.words, b.words);
  const came = minus(b.words, a.words);
  if (gone.length >= 1 && gone.length <= 3 && came.length >= 1 && came.length <= 3) {
    const say = (words: string[], r: ScreenRead) => words.map((w) => r.spelled.get(w) ?? w).join(" ");
    out.push({ kind: "term", name: "", before: gone, after: came, tag: `“${say(gone, a)}” → “${say(came, b)}”` });
  }
  return out;
}

/** Whether a screen uses a change, and how: its old form (it would change), only its new one (already in sync), or neither. */
function touches(change: RippleChange, s: ScreenRead): "would" | "sync" | null {
  if (change.kind === "token") {
    const def = s.tokens.get(change.name);
    if (def !== undefined) return change.after.includes(def) ? "sync" : "would";
    return s.refs.has(change.name) ? "would" : null;
  }
  if (change.kind === "value") {
    const vals = s.values.get(change.name);
    if (!vals) return null;
    if (change.before.some((v) => vals.has(v))) return "would";
    return change.after.some((v) => vals.has(v)) ? "sync" : null;
  }
  if (change.before.every((w) => s.words.has(w))) return "would";
  return change.after.every((w) => s.words.has(w)) ? "sync" : null;
}

// ---------- the three states

/** The three states a screen is in, after a ripple (design §8). */
type RippleState = "would change" | "in sync" | "disagrees";

/** One screen the ripple reaches. */
interface RippleScreen {
  itemId: string;
  title: string;
  state: RippleState;
  /** The changes it would take (its tags). */
  would: string[];
  /** The changes it already has. */
  sync: string[];
  /** Why it disagrees: a one-off, a deleted preview, or the lead's argued exception. */
  because?: string;
  /** The open preview of it, when the lead has made one. */
  previewId?: string;
}

/** A run, read against every other screen in its scope. */
export interface RippleRead {
  source: { itemId: string; title: string };
  run: RippleRun;
  /** `itm@v1..v4` — the ask's and the read-back's address. */
  at: string;
  /** `itm@v4` — what a preview cites (`--cites version:<cite>`). */
  cite: string;
  changes: RippleChange[];
  screens: RippleScreen[];
  /** Screens in scope that use none of it. */
  untouched: number;
  /** The source is marked a one-off: the ripple is silent. */
  off: boolean;
}

/** An exception the lead argued, in one line. */
interface RippleException {
  itemId: string;
  why: string;
}

const isOff = (item: Pick<Item, "properties">) => item.properties?.[RIPPLE_PROP] === "off";

/** Does this proposal preview the ripple from `sourceId` — a `version:` cite of that source? */
function previews(item: Pick<Item, "properties">, sourceId: string): boolean {
  return proposalCites(item).some((c) => c.kind === "version" && c.ref.startsWith(`${sourceId}@`));
}

/** The screens a ripple from `source` reaches: every other screen in the same group (or at the canvas's root), top to bottom. */
function scopeOf(canvas: CanvasContents, source: Item): Item[] {
  return Object.values(canvas.items)
    .filter((item) => item.id !== source.id && isScreen(item) && (item.containerId ?? null) === (source.containerId ?? null))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

/** The text a version's blob holds, if it has been read. */
type TextOf = (version: ItemVersion) => string | undefined;

/**
 * The versions whose words a ripple must read — the run's two ends, and every
 * screen in its scope as it stands — so the CLI downloads, and the pulse
 * fetches, exactly these.
 */
export function rippleVersions(canvas: CanvasContents, runs: readonly RippleRun[]): ItemVersion[] {
  const out = new Map<string, ItemVersion>();
  const add = (v: ItemVersion | undefined) => v && out.set(v.blobHash, v);
  for (const run of runs) {
    const source = canvas.items[run.itemId];
    if (!source) continue;
    add(source.versions.find((v) => v.id === run.fromVersionId));
    add(source.versions.find((v) => v.id === run.toVersionId));
    for (const s of scopeOf(canvas, source)) add(s.versions.find((v) => v.id === s.currentVersionId));
  }
  return [...out.values()];
}

/**
 * **A run, read against every other screen** — or null while any version it
 * needs is unread. Each screen that uses a change is listed: *would change*
 * when it holds the old form; *already in sync* when it holds only the new;
 * *disagrees, your call* when it is marked a one-off, a preview of it from
 * this source was deleted, or the lead argued it is an exception. Screens
 * that use none of it are counted, not listed. A source marked a one-off
 * reads as silent. Nothing is written.
 */
export function rippleRead(canvas: CanvasContents, run: RippleRun, textOf: TextOf, exceptions: readonly RippleException[] = []): RippleRead | null {
  const source = canvas.items[run.itemId];
  if (!source) return null;
  const fromV = source.versions.find((v) => v.id === run.fromVersionId);
  const toV = source.versions.find((v) => v.id === run.toVersionId);
  const before = fromV && textOf(fromV);
  const after = toV && textOf(toV);
  if (before === undefined || after === undefined) return null;
  const base = { source: { itemId: source.id, title: source.title || "Untitled" }, run, at: rippleAt(run), cite: `${run.itemId}@v${run.to}` };
  if (isOff(source)) return { ...base, changes: [], screens: [], untouched: 0, off: true };
  const changes = rippleChanges(before, after);
  // A preview in the trash was deleted — unless it was kept: Keep (`choose`) trashes it too, after its bytes became a version of its screen.
  const kept = (p: Item) => {
    const hash = p.versions.find((v) => v.id === p.currentVersionId)?.blobHash;
    return Boolean(hash && canvas.items[parentOf(p) ?? ""]?.versions.some((v) => v.blobHash === hash));
  };
  const deleted = new Set(canvas.trash.filter((t) => t.item.properties?.[PROPOSAL_PROP] && previews(t.item, source.id) && !kept(t.item)).map((t) => parentOf(t.item)));
  const screens: RippleScreen[] = [];
  let untouched = 0;
  for (const screen of scopeOf(canvas, source)) {
    const current = screen.versions.find((v) => v.id === screen.currentVersionId);
    const html = current && textOf(current);
    if (html === undefined) return null;
    const read = readScreen(html);
    const would: string[] = [];
    const sync: string[] = [];
    for (const c of changes) {
      const t = touches(c, read);
      if (t === "would") would.push(c.tag);
      else if (t === "sync") sync.push(c.tag);
    }
    if (!would.length && !sync.length) {
      untouched += 1;
      continue;
    }
    const preview = Object.values(canvas.items).find((p) => proposalMarked(p) && parentOf(p) === screen.id && previews(p, source.id));
    const argued = exceptions.find((e) => e.itemId === screen.id);
    const because = isOff(screen)
      ? "marked a one-off"
      : deleted.has(screen.id)
        ? "a preview of it was deleted"
        : argued
          ? argued.why
          : undefined;
    screens.push({
      itemId: screen.id,
      title: screen.title || "Untitled",
      state: because ? "disagrees" : would.length ? "would change" : "in sync",
      would,
      sync,
      ...(because ? { because } : {}),
      ...(preview ? { previewId: preview.id } : {}),
    });
  }
  return { ...base, changes, screens, untouched, off: false };
}

// ---------- the pulse

/** One tick of the pulse. */
export interface PulseTick {
  itemId: string;
  title: string;
  state: "current" | "behind" | "conflict";
  /** Why, when it is not current. */
  why?: string;
}

/**
 * **The project pulse** (design §8): one tick per screen on the canvas, in
 * reading order. *Behind* when a settled ripple says it would change; *in
 * conflict* when it disagrees with one, or is itself marked a one-off;
 * *current* otherwise. Derived from the reads, like *behind* is: no write.
 */
export function ripplePulse(canvas: CanvasContents, reads: readonly RippleRead[]): PulseTick[] {
  const ticks: PulseTick[] = [];
  const screens = Object.values(canvas.items).filter(isScreen).sort((a, b) => a.y - b.y || a.x - b.x);
  for (const screen of screens) {
    const title = screen.title || "Untitled";
    if (isOff(screen)) {
      ticks.push({ itemId: screen.id, title, state: "conflict", why: "marked a one-off" });
      continue;
    }
    const rows = reads.flatMap((r) => r.screens.filter((s) => s.itemId === screen.id).map((s) => ({ r, s })));
    const against = rows.find((x) => x.s.state === "disagrees");
    const behind = rows.find((x) => x.s.state === "would change");
    if (against) ticks.push({ itemId: screen.id, title, state: "conflict", why: `disagrees with “${against.r.source.title}”: ${against.s.because}` });
    else if (behind) ticks.push({ itemId: screen.id, title, state: "behind", why: `behind “${behind.r.source.title}”: ${behind.s.would.join("; ")}` });
    else ticks.push({ itemId: screen.id, title, state: "current" });
  }
  return ticks;
}

// ---------- the lead's half: the ask, and the read-back

const ASK_MARK = "Ripple, please";
const BACK_HEAD = "Ripple read-back";
const SYSTEM_MARK = "Ripple into the design system, please";

const names = (rows: RippleScreen[]) => rows.map((r) => `“${r.title}”`).join(", ") || "none";

/**
 * **What a settled run posts to the lead** — an ordinary summons, as the brief
 * card's re-read is: the run, what it changed, the derived three states, and
 * how to answer. Nothing on any other screen has changed.
 */
export function rippleAsk(lead: Pick<Actor, "name">, read: RippleRead): string {
  const by = (s: RippleState) => read.screens.filter((x) => x.state === s);
  return `@${lead.name} ${ASK_MARK} (${read.at}): ${read.run.by.name}'s run on “${read.source.title}” settled — ${read.run.edits} edit${read.run.edits === 1 ? "" : "s"}. Changed: ${read.changes.map((c) => c.tag).join("; ") || "nothing another screen shares"}. Would change: ${names(by("would change"))}. Already in sync: ${names(by("in sync"))}. Disagrees: ${names(by("disagrees"))}. Nothing on any other screen has changed. Read the edits back as at most three decisions in design words, preview each screen that would change as a proposal citing version:${read.cite}, argue any exception in one line, and sketch one idea set apart — \`isocan ripple ${read.source.itemId} --read-back …\`.`;
}

/** The person chose the design system as the altitude: the lead proposes the change as a new version of the DESIGN.md. */
export function systemAsk(lead: Pick<Actor, "name">, read: RippleRead): string {
  return `@${lead.name} ${SYSTEM_MARK} (${read.at}): put “${read.source.title}”'s change in the design system — ${read.changes.map((c) => c.tag).join("; ")}. Propose it beneath the DESIGN.md that governs it, citing version:${read.cite}; nothing changes until it is kept.`;
}

function comments(canvas: CanvasContents): Comment[] {
  return Object.values(canvas.threads).flatMap((t) => t.comments).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Whether this run's ripple was asked for — so a settle posts once. */
export function rippleAsked(canvas: CanvasContents, at: string): boolean {
  return comments(canvas).some((c) => c.body.includes(`${ASK_MARK} (${at})`));
}

/** Whether the person asked for this run in the design system. */
export function systemAsked(canvas: CanvasContents, at: string): boolean {
  return comments(canvas).some((c) => c.body.includes(`${SYSTEM_MARK} (${at})`));
}

/** The lead's read-back: the decisions, a good move named once, the exceptions it argued, and one idea set apart. */
export interface ReadBack {
  decisions: string[];
  good: string | null;
  exceptions: Array<RippleException & { title: string }>;
  sketch: string | null;
}

/** Why a read-back may not be posted, or null — at most three decisions, a good move named once on this canvas, a one-line exception per listed screen. */
export function readBackRefusal(canvas: CanvasContents, read: RippleRead, back: ReadBack): string | null {
  if (!back.decisions.length) return "read the edits back as at least one decision, in design words: --decision \"…\"";
  if (back.decisions.length > 3) return "three decisions at most — a read-back names what mattered, not every edit";
  if (back.decisions.some((d) => d.length > 120)) return "a decision is a phrase (\"a tighter type scale\"), not a paragraph";
  for (const e of back.exceptions) {
    if (!read.screens.some((s) => s.itemId === e.itemId)) return `“${e.title}” is not one of the screens this ripple reaches — an exception names one of them`;
    if ((e.why.match(/[.!?](\s|$)/g) ?? []).length > 1) return "an exception is argued in one line";
  }
  if (back.good) {
    const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (comments(canvas).some((c) => c.record && c.body.startsWith(BACK_HEAD) && c.body.split("\n").some((l) => l.startsWith("Caught doing it right: ") && n(l.slice(23)) === n(back.good!)))) {
      return "that good move was already named on this canvas — name one once, sparingly";
    }
  }
  if (back.sketch && (back.sketch.match(/[.!?](\s|$)/g) ?? []).length > 2) return "the sketch is two sentences at most";
  return null;
}

/** The read-back, as its `record` comment says it — the shape `readBackOf` reads back. */
export function readBackBody(at: string, back: ReadBack): string {
  const one = (s: string) => s.replace(/\s+/g, " ").trim();
  return [
    `${BACK_HEAD} (${at})`,
    ...back.decisions.map((d) => `Decision: ${one(d)}`),
    ...(back.good ? [`Caught doing it right: ${one(back.good)}`] : []),
    ...back.exceptions.map((e) => `Exception: “${e.title}” (${e.itemId}) — ${one(e.why)}`),
    ...(back.sketch ? [`Sketch: ${one(back.sketch)}`] : []),
  ].join("\n");
}

/** The lead's latest read-back of this run, if it has come. */
export function readBackOf(canvas: CanvasContents, at: string): (ReadBack & { by: Actor; commentId: string }) | null {
  const head = `${BACK_HEAD} (${at})`;
  const c = comments(canvas).filter((one) => one.record && one.body.startsWith(head)).at(-1);
  if (!c) return null;
  const lines = c.body.split("\n");
  const after = (label: string) => lines.filter((l) => l.startsWith(label)).map((l) => l.slice(label.length).trim());
  return {
    by: c.author,
    commentId: c.id,
    decisions: after("Decision: "),
    good: after("Caught doing it right: ")[0] ?? null,
    exceptions: after("Exception: ").flatMap((l) => {
      const m = /^“(.*)” \((itm_[\w-]+)\) — (.*)$/.exec(l);
      return m ? [{ title: m[1]!, itemId: m[2]!, why: m[3]! }] : [];
    }),
    sketch: after("Sketch: ")[0] ?? null,
  };
}

// ---------- one reading, for the panel and the terminal

/** One section of the ripple as both surfaces show it. */
interface RippleSection {
  key: "back" | "changes" | "would" | "sync" | "disagrees" | "altitude" | "sketch";
  heading: string;
  lines: Array<{ text: string; itemId?: string; previewId?: string }>;
}

/**
 * **The ripple, in sections** — the panel draws them and `isocan ripple`
 * prints them, so the two say the same. `waits` is why the read-back has not
 * come (null once it has, or while it is asked and on its way).
 */
export function rippleSections(read: RippleRead, back: ReadBack | null, waits: string | null): RippleSection[] {
  const out: RippleSection[] = [];
  out.push({
    key: "back",
    heading: "What you decided",
    lines: back
      ? [...back.decisions.map((d) => ({ text: d })), ...(back.good ? [{ text: `Caught doing it right: ${back.good}` }] : [])]
      : [{ text: waits ? `The read-back waits: ${waits}` : "Asked the lead; the read-back has not come yet." }],
  });
  if (read.off) {
    out.push({ key: "changes", heading: "A one-off", lines: [{ text: `“${read.source.title}” is marked a one-off, so its changes stay where they are. Undo takes it back.` }] });
    return out;
  }
  out.push({ key: "changes", heading: "What changed", lines: read.changes.length ? read.changes.map((c) => ({ text: c.tag })) : [{ text: "Nothing another screen shares: no token, value or term." }] });
  const rows = (state: RippleState) => read.screens.filter((s) => s.state === state);
  const row = (s: RippleScreen, text: string) => ({ text, itemId: s.itemId, ...(s.previewId ? { previewId: s.previewId } : {}) });
  out.push({ key: "would", heading: "Would change", lines: rows("would change").map((s) => row(s, `“${s.title}” — ${s.would.join("; ")}${s.previewId ? " · previewed" : ""}`)) });
  out.push({ key: "sync", heading: "Already in sync", lines: rows("in sync").map((s) => row(s, `“${s.title}” — ${s.sync.join("; ")}`)) });
  out.push({ key: "disagrees", heading: "Disagrees, your call", lines: rows("disagrees").map((s) => row(s, `“${s.title}” — ${s.because}`)) });
  if (read.untouched) out[out.length - 1]!.lines.push({ text: `${read.untouched} other screen${read.untouched === 1 ? " uses" : "s use"} none of it.` });
  out.push({
    key: "altitude",
    heading: "Where it goes — your choice",
    lines: [
      { text: "Screen by screen (the default): keep each preview you want; nothing changes until you do." },
      { text: "Put it in the design system: the lead proposes it as a new version of the DESIGN.md." },
      { text: `This one is a one-off: “${read.source.title}” stops rippling (ripple=off; undo takes it back).` },
    ],
  });
  if (back?.sketch) out.push({ key: "sketch", heading: "One idea this makes possible — a sketch, set apart", lines: [{ text: back.sketch }] });
  return out;
}
