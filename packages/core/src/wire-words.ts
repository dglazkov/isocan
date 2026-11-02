/**
 * **A wireframe's words, read from its spec alone** — no HTML parser, so the
 * browser can carry it inside the wireframe module's lazy half without a
 * parser chunk riding along (copy-edit phase 1's open bug: the stage's
 * in-place text edit on a wire screen, 2 Oct 2026).
 *
 * `copy-deck.ts` builds a wire screen's deck on these (adding reading order
 * and roles, which need the rendered markup); the wireframe module's web
 * writer (`packages/modules/wireframe/src/web-copy.ts`) uses them to name the
 * word a clicked node draws and to check an edit against the screen as it is
 * now. Core cannot import a module, so the word walk repeats the module's
 * `wordsOf`; `packages/modules/wireframe/test/copy-deck.test.ts` holds the
 * two equal.
 */

/** The parts of a `WireSpec` that carry words (core cannot import the module's type). */
export interface WireSpecWords {
  title?: string;
  slots?: Array<{ slot: string; block: string | null; fill?: unknown }>;
  content?: { title?: string; bar?: string } & Record<string, unknown>;
}

/** One word on a wire screen: its `wire copy` path, what it says, and the `data-wf` element it draws in. */
interface WireWord {
  address: string;
  text: string;
  wf?: string;
}

/** Whitespace a splice keeps: ASCII only, so a `&nbsp;` is words, not padding. */
const trimWords = (value: string) => value.replace(/^[ \t\n\r\f]*/, "").replace(/[ \t\n\r\f]*$/, "");

/** The words a wire slot's fill holds, by path — the wireframe module's
 *  `wordsOf` (`content/flesh-spec.ts`), repeated because core cannot import a
 *  module; its test holds the two equal. */
export function wireWordsOf(fill: unknown): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (!fill || typeof fill !== "object") return out;
  const f = fill as Record<string, unknown>;
  const str = (v: unknown): v is string => typeof v === "string";
  for (const key of ["heading", "sub", "person"]) if (str(f[key])) out.push([key, f[key] as string]);
  for (const key of ["lines", "labels", "values", "groups"]) {
    const list = f[key];
    if (Array.isArray(list)) list.forEach((w, i) => str(w) && out.push([`${key}.${i}`, w]));
  }
  if (Array.isArray(f.items)) {
    f.items.forEach((it: Record<string, unknown>, i) => {
      for (const key of ["title", "sub", "status", "meta", "person", "text"]) if (str(it?.[key])) out.push([`items.${i}.${key}`, it[key] as string]);
      if (Array.isArray(it?.cells)) (it.cells as unknown[]).forEach((w, j) => str(w) && out.push([`items.${i}.cells.${j}`, w]));
    });
  }
  if (Array.isArray(f.stats)) {
    f.stats.forEach((s: Record<string, unknown>, i) => {
      if (str(s?.label)) out.push([`stats.${i}.label`, s.label as string]);
      if (str(s?.value)) out.push([`stats.${i}.value`, s.value as string]);
      if (str(s?.delta)) out.push([`stats.${i}.delta`, s.delta as string]);
    });
  }
  if (f.actions && typeof f.actions === "object") {
    for (const [element, w] of Object.entries(f.actions as Record<string, unknown>)) if (str(w)) out.push([`actions.${element}`, w]);
  }
  return out;
}

/** Every word a fleshed wire screen has, in spec order: the title, the bar when it has one, then each slot's — the copy deck's strings without their order or roles. */
export function wireWords(spec: WireSpecWords): WireWord[] {
  if (!spec.content) return [];
  const out: WireWord[] = [{ address: "title", text: spec.content.title ?? spec.title ?? "" }];
  if (spec.content.bar !== undefined) out.push({ address: "bar", text: spec.content.bar, wf: "header" });
  for (const s of spec.slots ?? []) {
    if (!s.block || !s.fill) continue;
    for (const [path, text] of wireWordsOf(s.fill)) {
      out.push({ address: `${s.slot}/${path}`, text, wf: path.startsWith("actions.") ? `${s.slot}.${path.slice("actions.".length)}` : s.slot });
    }
  }
  return out;
}

/** Where a rendered text node sits on a wire screen: its section's `data-sec`, its nearest `data-wf`, and what it says. */
interface WirePlace {
  slot?: string;
  wf?: string;
  text: string;
}

/**
 * **Which word a rendered text node draws**, or why it is not one word of
 * its own — the stage's in-place text edit on a wireframe.
 *
 * The node's section names the slot, and the node must say exactly one of
 * that slot's words; its nearest `data-wf` breaks a tie (an action's label
 * against a body word). Text that is none of its slot's words is the
 * screen's title or bar. Anything else is refused in a sentence rather than
 * guessed: a node that joins several words ("sub · status · meta"), the same
 * words twice in one place, initials drawn from a name, an icon.
 */
export function wireWordAt(spec: WireSpecWords, place: WirePlace): { ok: true; address: string; text: string } | { ok: false; reason: string } {
  if (!spec.content) return { ok: false, reason: "This wireframe draws bars, so it has no words to edit yet — `/wire flesh` (or `isocan wire flesh`) fills it." };
  const words = wireWords(spec);
  const text = trimWords(place.text);
  const inSlot = place.slot === undefined ? [] : words.filter((w) => w.address.startsWith(`${place.slot}/`));
  let hits = inSlot.filter((w) => w.text === text);
  if (hits.length > 1) {
    const near = hits.filter((w) => w.wf === place.wf);
    if (near.length === 1) hits = near;
  }
  if (hits.length === 0) hits = words.filter((w) => (w.address === "title" || w.address === "bar") && w.text === text);
  if (hits.length === 1) return { ok: true, address: hits[0]!.address, text };
  if (hits.length > 1) return { ok: false, reason: `"${text}" is on this part of the screen more than once, so which one this is cannot be told — change it with \`isocan words <screen>\`, which names each.` };
  if (inSlot.filter((w) => w.text !== "" && text.includes(w.text)).length > 1) {
    return { ok: false, reason: "This line draws several of the screen's words at once — change them one by one with `isocan words <screen>` (or `/wire copy`)." };
  }
  return { ok: false, reason: "This text is drawn from the screen's other words or is an icon, not words of its own — `isocan words <screen>` lists the words you can change." };
}

/**
 * Turn word edits into the copy file `wire copy --apply` takes, checked
 * against the spec as it is NOW: every address must be a word the screen
 * has and still say what the edit read — a screen that moved under the edit
 * is refused by name, as the copy deck refuses it.
 */
export function wireCopyFor(spec: WireSpecWords, edits: ReadonlyArray<{ address: string; text: string; to: string }>): { ok: true; file: { title?: string; bar?: string; slots: Record<string, Record<string, string>> }; changed: string[] } | { ok: false; reason: string } {
  const now = new Map(wireWords(spec).map((w) => [w.address, w.text]));
  const file: { title?: string; bar?: string; slots: Record<string, Record<string, string>> } = { slots: {} };
  const changed: string[] = [];
  const seen = new Set<string>();
  for (const e of edits) {
    if (seen.has(e.address)) return { ok: false, reason: `${e.address} is edited twice — say it once` };
    seen.add(e.address);
    const was = now.get(e.address);
    if (was === undefined || was !== trimWords(e.text)) return { ok: false, reason: `${e.address} no longer says "${e.text}" — the screen changed while you were editing; reload and try again` };
    const to = trimWords(e.to);
    if (to === was) continue;
    if (e.address === "title" && to === "") return { ok: false, reason: "title must not be empty" };
    changed.push(e.address);
    if (e.address === "title") file.title = to;
    else if (e.address === "bar") file.bar = to;
    else {
      const cut = e.address.indexOf("/");
      (file.slots[e.address.slice(0, cut)] ??= {})[e.address.slice(cut + 1)] = to;
    }
  }
  return { ok: true, file, changed };
}
