/**
 * **How far a name may reach before it lands on somebody else's work.**
 *
 * An item's title is clipped to the item's own width, so anything longer than
 * the card reads as "White Lot…" and the canvas is full of things whose names
 * you cannot know without clicking them. The room to the right is usually
 * empty — the obvious fix is to let the name use it.
 *
 * The obvious fix is also how labels come to sit on top of neighbours, so the
 * reach has to be measured rather than assumed. That measurement is here
 * rather than in the renderer because it is geometry, it is the kind of thing
 * that is wrong in one direction at one zoom level, and a browser is a poor
 * place to find that out.
 *
 * **Hover only, and that is a design decision rather than an implementation
 * limit.** One thing is hovered at a time, so at most one name is reaching and
 * it cannot collide with another reaching name. Selection is different: a
 * marquee over nine items would have nine names all reaching at once, over
 * each other, and the arrangement that reads as "these nine" would become
 * unreadable exactly when you had asked to see it.
 */
export interface TitleBox {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface Neighbour extends TitleBox {
    /**
     * Whether this neighbour is showing its own title row — a selected item
     * does, and that row sits ABOVE its card, in the same band the reaching
     * name wants. Without this the name stops at the neighbour's card and runs
     * straight through the neighbour's name, which is the one collision a
     * person is most likely to be looking at.
     */
    titled?: boolean;
}
/**
 * The width available to `item`'s title, measured rightwards from its left
 * edge. Never less than the item's own width — the name already had that much
 * and taking it away would make hovering shrink the label.
 *
 * **`Infinity` when nothing is in the way**, and the caller is expected to say
 * so in its own terms. The first version returned `MAX_SAFE_INTEGER` to spare
 * callers a branch, and the branch turned up anyway one layer down: the web
 * multiplied it by the zoom scale and wrote `max-width: 3.35544e+07px` into
 * the DOM. A number that means "no limit" should not be a number.
 */
export declare function titleRoom(item: TitleBox, others: readonly Neighbour[], 
/** How tall the title row is, in the same units as the boxes. */
strip: number, 
/** How much clear space to leave before the next thing. */
gap?: number): number;
