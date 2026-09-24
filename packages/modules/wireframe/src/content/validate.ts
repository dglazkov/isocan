/**
 * **Every way a spec's content can be wrong, in words** — `validateWire`
 * runs these, so a hand-written or agent-written fill cannot put markup, a
 * function or a wall of text on a screen. Strings are escaped when drawn;
 * what is held here is the shape, and a length that keeps a wire a wire.
 */

const MAX_WORDS = 400;
const WORD_KEYS = ["heading", "sub", "person", "motif"] as const;
const LIST_KEYS = ["lines", "labels", "values", "groups"] as const;
const ITEM_KEYS = ["title", "sub", "status", "meta", "person", "text", "motif"] as const;
const KNOWN = new Set<string>([...WORD_KEYS, ...LIST_KEYS, "items", "stats", "series", "actions"]);

const isWord = (v: unknown): v is string => typeof v === "string" && v.length <= MAX_WORDS;

export function contentProblems(input: unknown): string[] {
  const c = input as Record<string, unknown> | null;
  if (!c || typeof c !== "object" || Array.isArray(c)) return ["content must be { source: \"pack\", pack } or { source: \"copy\", by }"];
  const problems: string[] = [];
  if (c.source === "pack") {
    if (typeof c.pack !== "string" || !c.pack) problems.push("content.pack must be a pack id");
    if (c.p !== undefined && !(typeof c.p === "number" && c.p >= 0 && c.p <= 1)) problems.push("content.p must be 0–1");
    if (c.by !== undefined && typeof c.by !== "string") problems.push("content.by must be a string");
  } else if (c.source === "copy") {
    if (typeof c.by !== "string" || !c.by) problems.push("content.by must say who wrote the copy");
    if (c.pack !== undefined && typeof c.pack !== "string") problems.push("content.pack must be a pack id");
  } else {
    problems.push(`content.source must be "pack" or "copy"`);
  }
  if (c.title !== undefined && !isWord(c.title)) problems.push(`content.title must be a string of at most ${MAX_WORDS} characters`);
  if (c.bar !== undefined && !isWord(c.bar)) problems.push(`content.bar must be a string of at most ${MAX_WORDS} characters`);
  return problems;
}

export function fillProblems(input: unknown, where: string): string[] {
  const f = input as Record<string, unknown> | null;
  if (!f || typeof f !== "object" || Array.isArray(f)) return [`${where}: fill must be an object`];
  const problems: string[] = [];
  for (const key of Object.keys(f)) if (!KNOWN.has(key)) problems.push(`${where}: fill has no "${key}" (it has ${[...KNOWN].join(", ")})`);
  for (const key of WORD_KEYS) if (f[key] !== undefined && !isWord(f[key])) problems.push(`${where}: fill.${key} must be a string`);
  for (const key of LIST_KEYS) {
    const v = f[key];
    if (v !== undefined && !(Array.isArray(v) && v.length <= 64 && v.every(isWord))) problems.push(`${where}: fill.${key} must be a list of strings`);
  }
  if (f.items !== undefined) {
    if (!Array.isArray(f.items) || f.items.length > 64) problems.push(`${where}: fill.items must be a list`);
    else {
      f.items.forEach((raw, i) => {
        const it = raw as Record<string, unknown> | null;
        if (!it || typeof it !== "object" || !isWord(it.title)) return problems.push(`${where}: fill.items[${i}] needs a title`);
        for (const key of ITEM_KEYS) if (it[key] !== undefined && !isWord(it[key])) problems.push(`${where}: fill.items[${i}].${key} must be a string`);
        if (it.cells !== undefined && !(Array.isArray(it.cells) && it.cells.length <= 16 && it.cells.every(isWord))) problems.push(`${where}: fill.items[${i}].cells must be a list of strings`);
        if (it.rating !== undefined && !(Number.isInteger(it.rating) && (it.rating as number) >= 0 && (it.rating as number) <= 5)) problems.push(`${where}: fill.items[${i}].rating must be 0–5`);
      });
    }
  }
  if (f.stats !== undefined) {
    if (!Array.isArray(f.stats) || f.stats.length > 8) problems.push(`${where}: fill.stats must be a list`);
    else f.stats.forEach((raw, i) => {
      const s = raw as Record<string, unknown> | null;
      if (!s || !isWord(s.label) || !isWord(s.value)) problems.push(`${where}: fill.stats[${i}] needs a label and a value`);
      else if ((s.delta !== undefined && !isWord(s.delta)) || (s.down !== undefined && typeof s.down !== "boolean")) problems.push(`${where}: fill.stats[${i}].delta must be a string`);
    });
  }
  if (f.series !== undefined && !(Array.isArray(f.series) && f.series.length <= 8 && f.series.every((s) => Array.isArray(s) && s.length <= 31 && s.every((n) => typeof n === "number" && n >= 0 && n <= 100)))) {
    problems.push(`${where}: fill.series must be lists of numbers 0–100`);
  }
  if (f.actions !== undefined && !(typeof f.actions === "object" && f.actions !== null && !Array.isArray(f.actions) && Object.values(f.actions).every(isWord))) {
    problems.push(`${where}: fill.actions must map elements to words`);
  }
  return problems;
}
