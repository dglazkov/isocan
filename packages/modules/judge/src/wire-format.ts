import { FIDELITY_PROP } from "@isocan/core";

/**
 * **The stored format this reader reads, spelled out by value.**
 *
 * Judge reads what the wireframe module wrote onto canvases: an item property
 * or two and a spec embedded in each screen's HTML file. It does not import
 * that module — the removability guard (`test/modules.test.ts`) holds every
 * module to its own directory, and a reader of stored data should not need
 * the writer's code in any case: the bytes already on a canvas are what they
 * are, whatever the writer is renamed to later. So the names are written
 * here, and `test/format.test.ts` reads the writer's source and fails the day
 * the two spellings part.
 */

/** Every screen's `item.add` carries `fidelity: "wireframe"`. */
export const WIRE_FIDELITY = "wireframe";
export { FIDELITY_PROP };

/** The comment that marks a file as a wire, and the id of the script that carries its spec. */
export const WIRE_MARKER = "<!-- isocan:wireframe -->";
export const WIRE_SCRIPT_ID = "isocan-wireframe";

/** The keep mark — a screen in the prototype — and who put it there (`<property>By`, core's `moduleMarkPatch`). */
export const KEEP_PROP = "wireKeep";
export const KEEP_BY_PROP = `${KEEP_PROP}By`;

/**
 * The names an answerer signs with, on `spec.by.answerer` and on a keep the
 * flow made by itself (`wireKeepBy`). A keep signed with one of these is the
 * judge's own output, never a person's label.
 */
export const ANSWERERS = ["jev", "stub", "agent"] as const;
export type Answerer = (typeof ANSWERERS)[number];

export function isAnswerer(value: unknown): value is Answerer {
  return typeof value === "string" && (ANSWERERS as readonly string[]).includes(value);
}

/**
 * The part of a screen's spec a label needs — and deliberately nothing that
 * only a maybe carries. P is `need`, on every screen of a composed flow since
 * 24 Sep 2026; the maybe item property holds a copy of it on maybes
 * alone, and reading it would make the sure half of the corpus disappear.
 */
export interface WireFacts {
  /** The words that asked for the flow. Real text: stays in the local labelled set. */
  request: string;
  /** Shared by every screen of one request — and the op group the flow was drawn in. */
  flow: string;
  archetype: string;
  /** Real text: stays in the local labelled set. */
  title: string;
  /** Round 1's P(yes) for this screen's archetype. Absent before 24 Sep 2026 and on a hand-drawn spec. */
  need?: number;
  /** Round 1 drew it marked *maybe*: P between the maybe floor and the auto-keep cut. */
  maybe?: true;
  /** On a variation: the item id of the screen it varies. */
  variantOf?: string;
  /** Who answered, when the spec says (from 24 Sep 2026, 11:35). */
  by?: { answerer: string; model?: string; via?: string };
}

/** The spec a wire's HTML carries, as the facts a label needs; null for anything that is not a wire. */
export function readWireFacts(html: string): WireFacts | null {
  if (!html.includes(WIRE_MARKER)) return null;
  const m = new RegExp(`<script type="application/json" id="${WIRE_SCRIPT_ID}">([\\s\\S]*?)</script>`).exec(html);
  if (!m) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(m[1]!) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || typeof raw.flow !== "string" || typeof raw.archetype !== "string") return null;
  const by = raw.by as { answerer?: unknown; model?: unknown; via?: unknown } | undefined;
  return {
    request: typeof raw.request === "string" ? raw.request : "",
    flow: raw.flow,
    archetype: raw.archetype,
    title: typeof raw.title === "string" ? raw.title : "",
    ...(typeof raw.need === "number" && raw.need >= 0 && raw.need <= 1 ? { need: raw.need } : {}),
    ...(raw.maybe === true ? { maybe: true as const } : {}),
    ...(typeof raw.variantOf === "string" ? { variantOf: raw.variantOf } : {}),
    ...(by && typeof by === "object" && typeof by.answerer === "string"
      ? { by: { answerer: by.answerer, ...(typeof by.model === "string" ? { model: by.model } : {}), ...(typeof by.via === "string" ? { via: by.via } : {}) } }
      : {}),
  };
}
