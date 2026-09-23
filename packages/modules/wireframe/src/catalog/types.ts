import type { IntentId } from "./intents.ts";

/**
 * **What a catalog entry is** (design §2; research §1, *Props, and the
 * question each becomes*).
 *
 * Every prop is one of the four shapes a Jev question can ask, and nothing
 * else — which is the point: a catalog whose props are these four types is a
 * catalog whose every question is generated rather than written.
 *
 * | prop     | Jev question            | spec value |
 * | -------- | ----------------------- | ---------- |
 * | `choice` | `choice` (≤ 8 values)   | string     |
 * | `flag`   | yes/no                  | boolean    |
 * | `count`  | `score` over min…max    | number     |
 * | `index`  | `choice` over 1…max     | number     |
 *
 * Text is not a prop. Actionable text is an element's intent; headings come
 * from the archetype; everything else is grey bars.
 */
export type PropDef =
  | { kind: "choice"; values: readonly string[]; default: string }
  | { kind: "flag"; default: boolean }
  | { kind: "count"; min: number; max: number; default: number }
  | { kind: "index"; max: number; default: number };

export type PropValue = string | number | boolean;
export type Props = Record<string, PropValue>;

/** An actionable element: the intents it can take, and the one it takes when nothing chose. */
export interface ElementDef {
  accepts: readonly IntentId[];
  default: IntentId;
  /** Whether the element is drawn under these props (an `actions` count of 1 draws no second action). */
  when?: (props: Props) => boolean;
}

export type Platform = "app" | "web" | "site";

/** What a draw function is handed: the resolved props, the labels, and the screen it is on. */
export interface DrawContext {
  props: Props;
  /** The label of an element's intent, HTML-escaped. */
  label: (element: string) => string;
  /** The intent id an element carries. */
  intent: (element: string) => string;
  /**
   * The attribute that makes a part a prototype's hotspot — ` data-hot="<slot>#<element>"`,
   * with its leading space. Every actionable element carries it, and so do the two parts
   * that navigate without an intent: a row (`"row"`) and an app bar's chevron (`"leading"`).
   * The key is the slot and the element, so it is the same every time the spec is drawn.
   */
  hot: (element: string) => string;
  /** The screen's title, HTML-escaped — headings come from the archetype. */
  title: string;
  platform: Platform;
  /** True off a phone: `web` and `site`. */
  wide: boolean;
}

export interface Component {
  id: string;
  kind: "primitive" | "block";
  category: string;
  /** Sources that name it (research §1's "named by"). */
  namedBy: number;
  props: Record<string, PropDef>;
  elements?: Record<string, ElementDef>;
  /** The skeleton's height for a slot that would hold this, in CSS pixels. */
  h: number;
  draw: (d: DrawContext) => string;
}
