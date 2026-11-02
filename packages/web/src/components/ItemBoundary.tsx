import { Component, type ReactNode } from "react";
import type { Item } from "@isocan/core";

type Props = { item: Item; children: ReactNode };
type State = { item: Item; failed: boolean };

/**
 * **One item's bad render costs one item** (cleanup RP-5, 27 Sep 2026).
 *
 * Nothing sat above the canvas to catch a render-time throw, so any one of
 * them was a blank page. The Pen was the first (28 Aug, React #300). The third
 * was found by reading: scrub to before somebody deleted a note and `ItemView`
 * asked the LIVE canvas how deep it sat, which core answers by throwing
 * `unknown-item`. That selector is fixed; this is for the next one nobody has
 * found yet, and for an item shaped in a way its renderer was not written for.
 *
 * Per item rather than around the canvas, because the canvas is the thing
 * people are looking at: one card that cannot draw is a card-shaped gap, and
 * the forty around it — and the camera, and the tools — carry on.
 *
 * **Caught is not swallowed.** The error goes to the console with the item
 * named, and the gap says in words that something is missing, in the item's
 * own box so the layout does not jump. A new version of the item (a new
 * object from the reducer) gets another try: whatever broke may be what the
 * next op fixes.
 *
 * Kept to the bone on purpose: it is in the entry chunk, every byte of it.
 */
export class ItemBoundary extends Component<Props, State> {
  state = { item: this.props.item, failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  static getDerivedStateFromProps({ item }: Props, state: State) {
    return item === state.item ? null : { item, failed: false };
  }
  componentDidCatch(error: unknown) {
    console.error(`isocan: item ${this.props.item.id} could not be drawn`, error);
  }
  render() {
    const { item, children } = this.props;
    return this.state.failed
      ? <div className="item item-unrenderable" data-unrenderable-item={item.id} style={{ left: item.x, top: item.y, width: item.width, height: item.height }}>{item.title || "This item"} could not be drawn.</div>
      : children;
  }
}
