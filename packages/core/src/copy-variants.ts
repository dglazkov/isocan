import type { CopyDeck, CopyEdit } from "./copy-deck.ts";
import type { JsonSchema } from "./jev.ts";
import type { CanvasContents, Item } from "./model.ts";
import type { NewVersion, Operation } from "./ops.ts";

/**
 * **Copy variants: N voices for one screen's words** (copy-edit phase 2 —
 * `docs/projects/copy-edit/phases.md`, design point 2 of
 * `docs/research/2026-10-02-copy-edit.md`, journey scenes 1 and 6).
 *
 * A variant is a whole-screen set of string edits with a short STANCE ("plain
 * and direct", "warm") and one line of WHY. It lands as an ordinary
 * `/variation` child — an `item.add` carrying `parent=<source>` — whose file is
 * the source with only those strings changed (`applyCopyDeck` for plain HTML,
 * the wireframe module's renderer for a wire screen). So *Choose this
 * variation*, `isocan choose`, `isocan diff --source` and undo all work
 * unchanged, and there is no new op.
 *
 * **One generation call for N voices, not N calls.** Asking once for all N is
 * what keeps the stances distinct (a model asked three times for "a voice"
 * writes the same voice three times), and it spends one of the text route's
 * thirty a minute rather than N. The answer is checked here, purely, before
 * anything lands: every address must be one the deck has, every string must
 * stay the shape its role allows, and the stances must be N different ones.
 * The same check takes an agent's own file (`isocan words vary --from`), so a
 * written voice and a generated one are held to one rule.
 */

/** One voice: what it is trying, why, and the strings it changes. */
interface CopyVariant {
  stance: string;
  why: string;
  edits: CopyEdit[];
}

/** The property a copy variant carries its stance in, and its one line of why. */
export const COPY_STANCE_PROP = "copyStance";
/** The property a copy variant carries its one-line reason in. */
export const COPY_WHY_PROP = "copyWhy";

/**
 * `lineage.ts`'s `parent` property and `placement.ts`'s `PLACEMENT_GAP`,
 * spelled here rather than imported — and the item ids come from the caller —
 * so this file imports no value from core's barrel. Both clients load it
 * lazily, and a barrel module shared with a lazy file is carved out of the
 * eager code into a chunk of its own: measured 2 Oct 2026, importing `ids`,
 * `lineage` and `placement` here put two more modules on `isocan --version`'s
 * load (`test/cli-bundle.test.ts` holds that under 40). `copy-variants.test.ts`
 * holds both equal to the originals.
 */
export const VARIANT_PARENT_PROP = "parent";
/** The space left between a source and the variants stacked under it. */
export const VARIANT_GAP = 40;

/** At most this many voices in one ask: past six they stop being different. */
export const MAX_COPY_VARIANTS = 6;

/** A stance is a label, not a paragraph. */
const STANCE_WORDS = 5;

/**
 * How long a string of each role may become, and whether it must stay on one
 * line. A button that grew into a sentence is a different control, and a
 * heading with a line break is markup the deck cannot write; the fit check
 * that measures the real box is phase 4 — these are the bounds a role has
 * before anything is rendered.
 */
const ROLE_SHAPE: Record<string, { max: number; oneLine: boolean }> = {
  button: { max: 40, oneLine: true },
  nav: { max: 32, oneLine: true },
  label: { max: 60, oneLine: true },
  placeholder: { max: 80, oneLine: true },
  link: { max: 80, oneLine: true },
  heading: { max: 140, oneLine: true },
  alt: { max: 240, oneLine: true },
  error: { max: 240, oneLine: false },
  empty: { max: 400, oneLine: false },
  body: { max: 1200, oneLine: false },
};

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const show = (s: string) => JSON.stringify(s.length > 40 ? `${s.slice(0, 39)}…` : s);

/**
 * The one question N voices are: a prompt naming every string with its role
 * and address, and a schema that asks for exactly `n` variants whose edits
 * can only name addresses the deck has. `brief` is what the person asked for
 * ("shorter, for a first-time buyer"); `voice` is the product's own (a
 * DESIGN.md Voice section, phase 4) — both optional.
 */
export function copyVariantsRequest(deck: CopyDeck, n: number, brief?: string, voice?: string): { prompt: string; schema: JsonSchema } {
  const lines = deck.strings.map((s) => `${s.address}\t${s.role}\t${JSON.stringify(s.text)}`);
  const prompt = [
    `Rewrite the words of one screen in ${n} distinct voices. Words only: you are not redesigning the screen.`,
    "",
    "The screen's strings, in reading order (address, role, current words):",
    ...lines,
    "",
    ...(brief?.trim() ? [`What the person asked for: ${brief.trim()}`, ""] : []),
    ...(voice?.trim() ? [`The product's voice (keep to it in every variant): ${voice.trim()}`, ""] : []),
    `Return exactly ${n} variants. Each has:`,
    `- "stance": what this voice is trying, in at most ${STANCE_WORDS} words (e.g. "Plain and direct", "Warm", "Benefit-first"). Every stance must be different from the others.`,
    '- "why": one sentence on why someone would pick this voice.',
    '- "edits": the strings this voice changes, each { "address", "to" } with an address from the list above. Leave out strings it would keep.',
    "Keep each string doing the same job: a button stays a short action, a label stays a label, a heading stays one line. Keep names, numbers, prices and links' destinations as they are.",
  ].join("\n");
  const addresses = deck.strings.map((s) => s.address);
  const schema: JsonSchema = {
    type: "object",
    properties: {
      variants: {
        type: "array",
        minItems: n,
        maxItems: n,
        items: {
          type: "object",
          properties: {
            stance: { type: "string", description: `what this voice is trying, at most ${STANCE_WORDS} words` },
            why: { type: "string", description: "one sentence: why pick this voice" },
            edits: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                properties: {
                  address: { type: "string", enum: addresses },
                  to: { type: "string", description: "the new words for that string" },
                },
                required: ["address", "to"],
                additionalProperties: false,
              },
            },
          },
          required: ["stance", "why", "edits"],
          additionalProperties: false,
        },
      },
    },
    required: ["variants"],
    additionalProperties: false,
  };
  return { prompt, schema };
}

/**
 * Hold an answer — a model's, or an agent's file — to the variant rules:
 * `{ variants: [{ stance, why, edits: [{ address, to }] }] }`, exactly `n` of
 * them when `n` is given, distinct stances of at most five words, a why, and
 * edits that name strings the deck has, keep each string inside its role's
 * shape, and change at least one word. Refused in words, naming the variant
 * and the string. The edits come back as `CopyEdit`s carrying the deck's
 * current text — the check `applyCopyDeck` refuses a moved screen by.
 */
export function checkCopyVariants(deck: CopyDeck, raw: unknown, n?: number): { ok: true; variants: CopyVariant[] } | { ok: false; reason: string } {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { variants?: unknown }).variants) ? (raw as { variants: unknown[] }).variants : null;
  if (!list) return { ok: false, reason: 'variants are { "variants": [{ "stance", "why", "edits": [{ "address", "to" }] }] }' };
  if (list.length === 0) return { ok: false, reason: "no variants" };
  if (n !== undefined && list.length !== n) return { ok: false, reason: `asked for ${n} variant${n === 1 ? "" : "s"} and got ${list.length}` };
  if (list.length > MAX_COPY_VARIANTS) return { ok: false, reason: `${list.length} variants — at most ${MAX_COPY_VARIANTS} in one go` };
  const byAddress = new Map(deck.strings.map((s) => [s.address, s]));
  const stances = new Map<string, number>();
  const out: CopyVariant[] = [];
  for (const [i, entry] of list.entries()) {
    const at = `variant ${i + 1}`;
    if (!entry || typeof entry !== "object") return { ok: false, reason: `${at} is not an object` };
    const v = entry as Record<string, unknown>;
    const stance = typeof v.stance === "string" ? v.stance.trim().replace(/\s+/g, " ") : "";
    if (!stance) return { ok: false, reason: `${at} has no stance` };
    if (words(stance) > STANCE_WORDS) return { ok: false, reason: `${at}'s stance ${show(stance)} is more than ${STANCE_WORDS} words — a stance is a label` };
    const key = stance.toLowerCase();
    if (stances.has(key)) return { ok: false, reason: `${at}'s stance ${show(stance)} is variant ${stances.get(key)! + 1}'s too — each voice must be a different one` };
    stances.set(key, i);
    const why = typeof v.why === "string" ? v.why.trim().replace(/\s+/g, " ") : "";
    if (!why) return { ok: false, reason: `${at} (${stance}) has no why` };
    if (!Array.isArray(v.edits)) return { ok: false, reason: `${at} (${stance}) has no edits` };
    const seen = new Set<string>();
    const edits: CopyEdit[] = [];
    for (const e of v.edits as unknown[]) {
      const edit = e as Record<string, unknown> | null;
      if (!edit || typeof edit.address !== "string" || typeof edit.to !== "string") return { ok: false, reason: `${at} (${stance}): every edit is { "address", "to" }` };
      const string = byAddress.get(edit.address);
      if (!string) return { ok: false, reason: `${at} (${stance}) edits ${edit.address}, which this screen does not have — \`isocan words <item>\` lists the addresses` };
      if (seen.has(edit.address)) return { ok: false, reason: `${at} (${stance}) edits ${edit.address} twice` };
      seen.add(edit.address);
      const to = edit.to.trim();
      if (!to) return { ok: false, reason: `${at} (${stance}) empties ${edit.address} (${string.role}) — a variant changes words, it does not remove them` };
      const shape = ROLE_SHAPE[string.role] ?? ROLE_SHAPE.body!;
      if (shape.oneLine && /[\r\n]/.test(to)) return { ok: false, reason: `${at} (${stance}) breaks ${edit.address} (${string.role}) over lines — a ${string.role} stays one line` };
      if (to.length > shape.max) return { ok: false, reason: `${at} (${stance}) makes ${edit.address} (${string.role}) ${to.length} characters — a ${string.role} stays under ${shape.max}` };
      if (to !== string.text) edits.push({ address: edit.address, text: string.text, to });
    }
    if (edits.length === 0) return { ok: false, reason: `${at} (${stance}) changes no words` };
    out.push({ stance, why, edits });
  }
  return { ok: true, variants: out };
}

/**
 * **Placeholder voices, said as what they are** — what lands when no text
 * model was reachable (no key on this machine, `text-unavailable` from the
 * home). The screen's headings, buttons and links (else its first string)
 * read "Placeholder heading B", under a stance that says "Placeholder": the
 * whole path — variants, compare, choose, undo — can be walked, and nobody
 * mistakes the filler for written copy. In the variant shape, so it passes
 * the same check a model's answer does.
 */
export function placeholderCopyVariants(deck: CopyDeck, n: number): { variants: Array<{ stance: string; why: string; edits: Array<{ address: string; to: string }> }> } {
  const loud = deck.strings.filter((s) => s.role === "heading" || s.role === "button" || s.role === "link").slice(0, 4);
  const targets = loud.length ? loud : deck.strings.slice(0, 1);
  return {
    variants: Array.from({ length: n }, (_, i) => {
      const letter = String.fromCharCode(65 + i);
      return {
        stance: `Placeholder ${letter}`,
        why: "No text model was reachable, so these are placeholder words — not written copy.",
        edits: targets.map((s) => ({ address: s.address, to: `Placeholder ${s.role} ${letter}` })),
      };
    }),
  };
}

/** A variant's title: the source's, and the stance — the idea, not a number (`/variation`'s rule). */
function copyVariantTitle(source: Pick<Item, "title" | "id">, stance: string): string {
  return `${source.title || source.id} — ${stance}`;
}

/**
 * **The ops that put N variants on the canvas** — one `item.add` each, what
 * `isocan add --prop parent=<source>` sends, so a copy variant is a
 * `/variation` child by the one convention there is (`lineage.ts`). Each is
 * the source's size, titled with its stance, carrying the stance and why as
 * properties, stacked directly under the source and any child already there,
 * in the source's group when it has one; `itemId` is the caller's
 * (`newItemId()`). Both surfaces send exactly these,
 * under one group: one undo takes all N back.
 */
export function copyVariantOps(
  canvas: CanvasContents,
  source: Item,
  made: ReadonlyArray<{ itemId: string; variant: CopyVariant; version: NewVersion; properties?: Record<string, string> }>,
): Array<Extract<Operation, { type: "item.add" }>> {
  // `childrenOf`'s reading of `parent=`: what was already made from the source sits under it too.
  const children = Object.values(canvas.items).filter((item) => item.properties[VARIANT_PARENT_PROP] === source.id);
  let bottom = Math.max(source.y + source.height, ...children.map((c) => c.y + c.height));
  return made.map(({ itemId, variant, version, properties }) => {
    const y = bottom + VARIANT_GAP;
    bottom = y + source.height;
    return {
      type: "item.add",
      itemId,
      version,
      width: source.width,
      height: source.height,
      placement: { x: source.x, y, chosen: true },
      title: copyVariantTitle(source, variant.stance),
      properties: { ...properties, [VARIANT_PARENT_PROP]: source.id, [COPY_STANCE_PROP]: variant.stance, [COPY_WHY_PROP]: variant.why },
      ...(source.containerId ? { containerId: source.containerId, groupPlacement: "exact" as const } : {}),
    };
  });
}
