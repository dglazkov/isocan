/**
 * **A selected SVG, made safe and made a layer** (motion phase 0;
 * `docs/projects/motion/design.md` §2, §6).
 *
 * A motion document inlines its sources' markup, so whatever a source SVG
 * carries runs in the motion's page. A motion runs no one else's code and
 * fetches nothing, so this strips, and says what it stripped: `<script>`,
 * every `on*` attribute, `<foreignObject>`, any `href` that is not a
 * same-document `#…` or a `data:` URL, remote `url(…)` and `@import` in CSS,
 * `javascript:` anywhere, and SMIL animation (`<animate>`, `<set>`, …),
 * because a motion's only clock is `render(t)`.
 *
 * **Parsed by the HTML parser the browser will use.** The markup is read
 * with parse5 as HTML foreign content, exactly as the motion document will
 * be read, so what is kept here is what the browser builds — an `<img>`
 * that would break out of `<svg>` breaks out here too, lands outside the
 * root, and is dropped with the rest of what is not the drawing.
 *
 * **Several SVGs share one document**, so ids are prefixed per layer (with
 * every `#id` and `url(#id)` that points at one), and a source's
 * `<style>` is wrapped in `@scope` to its own layer — two exports that
 * both say `.st0` keep their own colours.
 */
import { type DefaultTreeAdapterMap } from "parse5";
import type { MotionBox, MotionLayer } from "./motion-engine.js";
type Element = DefaultTreeAdapterMap["element"];
/** What a layer is built from: one SVG item on the canvas, its bytes, and where it sat. */
export interface MotionSource {
    item: string;
    version: string;
    title: string;
    /** The item's rect in canvas (world) coordinates. */
    box: MotionBox;
    svg: string;
}
/**
 * A source made safe and addressable: the layer record the spec carries,
 * the cleaned `<svg>` element ready to inline, and what was taken out, in
 * words.
 */
export interface PreparedLayer {
    layer: MotionLayer;
    root: Element;
    stripped: string[];
}
/**
 * **One source SVG as a layer**: stripped, its ids prefixed, its named
 * `<g id>` groups found and wrapped so the engine can move each without
 * clobbering a transform the drawing already had, and the whole drawing
 * wrapped once more for the layer's own moves.
 *
 * `id` is the layer's id in the spec; `offset` is the stage's top-left in
 * canvas coordinates. Throws, in words, when there is no `<svg>` to keep.
 */
export declare function prepareMotionLayer(source: MotionSource, id: string, offset: {
    x: number;
    y: number;
}): PreparedLayer;
/**
 * The layer's markup for the document, with the strokes of every target the
 * spec draws on made drawable: `pathLength="1"`, a dash as long as the path,
 * and `data-motion-draw` naming the target whose `draw` channel offsets it.
 */
export declare function motionLayerMarkup(prepared: PreparedLayer, drawn: ReadonlySet<string>): string;
export {};
