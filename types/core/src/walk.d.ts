import type { Actor, CanvasContents, Comment, Item } from "./model.js";
import { type WalkGraph } from "./modules.js";
import { type ScreenRead, type WalkRect } from "./walk-read.js";
export { readScreen, type ScreenRead, type TextRun, type WalkTarget, type Spoken, type WalkRect } from "./walk-read.js";
/**
 * **Walk it as someone else** (proactive-agent phase 9, design §11).
 *
 * A person asks for a walk of a task over a flow; each **walker** is one
 * situation and one constraint — never a biography, never a stereotype — and
 * meets the flow's screens in order. This file is the deterministic half both
 * surfaces read:
 *
 * - **which screens a flow reaches** (`walkFlow`): a module's flow (a wire
 *   prototype's links, through `CoreModule.walkFlow`), a group's screens in
 *   reading order, or one screen;
 * - **what each walker can be measured to meet** (`walkFindings`): contrast
 *   from the screen's own CSS (`contrast.ts`'s WCAG maths), target size and
 *   thumb reach where the CSS places a target, names and roles from the HTML
 *   (`walk-read.ts`);
 * - **the transforms the canvas draws them with** (`thumbArcs`,
 *   `lowVisionFilter`, `seenContrast`, `contrastFix`) — every parameter in
 *   `WALK_PARAMETERS`, with where it comes from;
 * - **the records**: the person's ask, the lead's stumbles (pins: a comment
 *   on the screen worn as the walker, `persona`), its outcome per walker and
 *   the shared finding (a Chat record), and the refusals that keep them
 *   grounded (`walkRecordRefusal`).
 *
 * The stumbles, the outcomes and the shared sentence are the lead's — a model
 * answering the ordinary summons. Nothing here calls one. **These are
 * simulations** (`WALK_NOTICE`), and every surface says so.
 */
/** Said wherever a walk is shown: the panel, the terminal, the ask and the record. */
export declare const WALK_NOTICE = "These are simulations, not people: each walker is one situation and one constraint, measured where the screen's code allows and judged by the lead where it does not. They do not replace testing with the people they stand for.";
/** What a walker is measured on; a walker measured on nothing is the lead's judgement alone. */
type WalkCheck = "reach" | "contrast" | "names";
/** One simulated person: a situation and a constraint (design §11: "never a stereotype"). */
export interface Walker {
    /** A slug: the persona its pins are worn as. */
    id: string;
    name: string;
    situation: string;
    constraint: string;
    checks: readonly WalkCheck[];
    /** The person described this one for this walk (not a starter). */
    described?: true;
}
/**
 * **The starters** (chosen, Dion to confirm): four ways of meeting a screen
 * that the journey names. A person can describe another for one walk
 * (`walkerOf("commuter: one hand on a strap, phone in the other")`); those are
 * judged by the lead, never measured, and say so.
 */
export declare const WALKERS: readonly Walker[];
/** The two the smallest walk takes when nobody names any. */
export declare const DEFAULT_WALKERS: readonly ["one-handed", "low-vision"];
/** Enough lanes to compare; more is a survey. */
export declare const WALKERS_MAX = 6;
/**
 * **A walker from what the person typed**: a starter's id (or a near
 * spelling), or `name: what they are doing and what they cannot do`.
 */
export declare function walkerOf(spec: string): Walker | {
    refused: string;
};
/**
 * **Every number a walk uses, and where it comes from.** None of them is a
 * clinical model of anybody's eyes or hands: they are honest approximations,
 * cited so a person can disagree with one.
 */
export declare const WALK_PARAMETERS: {
    readonly phone: {
        readonly width: 390;
        readonly height: 844;
        readonly pxPerMm: 6;
        readonly source: "a current phone's CSS viewport (390×844, iPhone 12–15); 6 CSS px per mm from a 460 ppi panel at a device pixel ratio of 3";
    };
    readonly thumb: {
        readonly hand: "right";
        readonly innerMm: 15;
        readonly easyMm: 60;
        readonly stretchMm: 75;
        readonly source: "the thumb pivots at the bottom corner of the holding hand: comfortable 15–60 mm from it, a stretch to 75 mm, hard beyond and very near. Shaped after Hoober's observation of how phones are held (UXmatters, 2013: 49% one-handed) and the thumb-zone map drawn from it (Hurff, 2014); a band rather than a disc because the thumb's functional area is (Bergstrom-Lehtovirta & Oulasvirta, CHI 2014). Radii are our approximation, not anthropometry";
    };
    readonly target: {
        readonly thumbPx: 44;
        readonly minPx: 24;
        readonly source: "WCAG 2.2: 2.5.8 Target Size (Minimum) 24×24 CSS px, AA; 2.5.5 Target Size (Enhanced) 44×44, AAA — the size we hold a thumb to outside its easy zone";
    };
    readonly contrast: {
        readonly body: 4.5;
        readonly large: 3;
        readonly enhanced: 7;
        readonly largePx: 24;
        readonly largeBoldPx: 18.66;
        readonly source: "WCAG 2.2 1.4.3 Contrast (Minimum): 4.5:1, 3:1 for large text (24 px, or 18.66 px bold); 1.4.6 Contrast (Enhanced): 7:1";
    };
    readonly lowVision: {
        readonly acuity: "20/80";
        readonly marArcmin: 4;
        readonly viewingMm: 330;
        readonly blurPx: number;
        readonly veil: 0.3;
        readonly source: `blur: the minimum angle of resolution of 20/80 (4\u2032) at 330 mm \u2014 where people hold a phone to read (Bababekova et al., Optometry and Vision Science, 2011: 32\u201336 cm) \u2014 is about ${number} CSS px; the blur's deviation is half that, ${number} px, which leaves detail at the resolution limit with about 29% of its contrast \u2014 near threshold, not gone. Wash: a veil of 0.3 of white's luminance, so 7:1 (WCAG's enhanced ratio, which its Understanding of 1.4.6 ties to about 20/80) is seen as 3:1. A stand-in for one kind of low vision, not a diagnosis`;
    };
};
/** How the thumb meets a point: comfortably, at a stretch, or hardly at all. */
type ThumbZone = "easy" | "stretch" | "hard";
/** The thumb's arcs on a screen, in its own CSS px: where it pivots and how far each zone reaches. */
export declare function thumbArcs(viewport: {
    width: number;
    height: number;
}): {
    pivot: {
        x: number;
        y: number;
    };
    inner: number;
    easy: number;
    stretch: number;
};
/** Which zone a point falls in, for the right thumb. */
export declare function thumbZone(point: {
    x: number;
    y: number;
}, viewport: {
    width: number;
    height: number;
}): ThumbZone;
/** Is this screen the size of a phone? Reach is only measured on one. */
export declare const phoneSized: (viewport: {
    width: number;
}) => boolean;
/** The low-vision render as an SVG filter's numbers: a Gaussian blur, then a veil in linear light (`slope·c + intercept`). */
export declare function lowVisionFilter(): {
    blurPx: number;
    slope: number;
    intercept: number;
};
/** The ratio a pair is seen at through the low-vision veil. */
export declare function seenContrast(fg: string, bg: string): number | null;
/** **The fix**: the ink nearest the one used that reaches the ratio — the same hue, darkened on a light ground or lightened on a dark one. */
export declare function contrastFix(fg: string, bg: string, need: number): {
    colour: string;
    ratio: number;
} | null;
/** The screen with each fix applied — one stylesheet appended, the person's file otherwise byte for byte. What the lane draws beside the failure. */
export declare function walkFixHtml(html: string, fixes: readonly {
    path: string;
    colour: string;
}[]): string;
/** The screens a walk meets, in order. */
interface WalkFlow {
    via: "prototype" | "group" | "screen";
    title: string;
    screens: string[];
    /** In the flow, but no link reaches them from where it opens. */
    unreached: string[];
}
/** Rows top to bottom, each left to right: items whose tops sit within half a screen's height of the row's first share it. */
export declare function readingOrder(items: readonly Item[]): Item[];
/** Every screen a graph reaches from where it opens, in the order a walker first meets them: breadth first, links in their own order. */
export declare function flowReach(graph: WalkGraph): {
    screens: string[];
    unreached: string[];
};
/**
 * **Which screens a walk of this item meets.** A module's flow first (a wire
 * prototype, read from its file `html`); a group's screens in reading order;
 * or the one screen. Proposals are never walked: they are not the person's.
 */
export declare function walkFlow(canvas: CanvasContents, itemId: string, html: string | null): WalkFlow | {
    refused: string;
};
/** One screen of a walk, at the version walked. */
export interface WalkScreen {
    itemId: string;
    versionId: string;
    title: string;
    read: ScreenRead;
}
/** Read a screen of a walk from its bytes, at the size the canvas shows it. */
export declare function walkScreen(item: Pick<Item, "id" | "title" | "width" | "height">, versionId: string, html: string): WalkScreen;
/** Something the walk measured that a walker meets — what a measured stumble cites. */
export interface WalkFinding {
    /** `<screen number>.<n>`, per walker: `2.1` is the first on the second screen. */
    id: string;
    walker: string;
    itemId: string;
    kind: "reach" | "target" | "contrast" | "unnamed" | "no-role" | "placeholder" | "no-alt";
    path: string;
    at: WalkRect | null;
    /** The words on it, or its name. */
    label: string;
    /** One sentence, with the numbers. */
    text: string;
    contrast?: {
        fg: string;
        bg: string;
        fontPx: number;
        bold: boolean;
        ratio: number;
        need: number;
        seen: number;
        fix: string | null;
        fixRatio: number | null;
    };
    reach?: {
        zone: ThumbZone;
        width: number;
        height: number;
    };
}
/** **Everything a walker meets on the walk's screens, measured** — numbered per screen. A walker measured on nothing meets nothing here. */
export declare function walkFindings(walker: Walker, screens: readonly WalkScreen[]): WalkFinding[];
/** A walk the person asked for, read back off its comment. Its id is the comment's. */
export interface WalkAsk {
    id: string;
    createdAt: string;
    by: Actor;
    task: string;
    screens: {
        itemId: string;
        versionId: string;
    }[];
    walkers: Walker[];
}
/** **The ask** — to the lead, in the Chat: the task, the screens at their versions, each walker, what was measured, and how to answer. */
export declare function walkAskBody(lead: Pick<Actor, "name">, task: string, screens: readonly WalkScreen[], walkers: readonly Walker[], findings: readonly WalkFinding[]): string;
/** One comment as a walk ask, or null. */
export declare function readWalkAsk(c: Comment): WalkAsk | null;
/** Every walk asked on this canvas, oldest first. */
export declare function walkAsks(canvas: Pick<CanvasContents, "threads">): WalkAsk[];
/** A stumble the lead pinned. */
export interface WalkStumble {
    walk: string;
    walker: string;
    itemId: string;
    /** The measured finding it cites, or `judged`. */
    finding: string;
    what: string;
    threadId?: string;
    /** Where on the screen, as fractions of it. */
    at?: {
        x: number;
        y: number;
    };
}
/** The pin's words. The walker is the comment's `persona`. */
export declare function stumbleBody(walker: Pick<Walker, "name">, walkId: string, finding: string, what: string): string;
/** Every stumble pinned for a walk, in the order they were pinned. */
export declare function walkStumbles(canvas: Pick<CanvasContents, "threads" | "items">, walkId: string): WalkStumble[];
/** **The shared finding**: each screen two or more walkers stumbled on, with who. Derived from the pins, never written. */
export declare function walkShared(stumbles: readonly Pick<WalkStumble, "walker" | "itemId">[]): {
    itemId: string;
    walkers: string[];
}[];
/** How a walker's walk ended (design §11). */
export declare const WALK_OUTCOMES: readonly ["made it", "stumbled", "gave up"];
type WalkOutcome = (typeof WALK_OUTCOMES)[number];
/** The lead's read of the walk: posted once, as a record in the Chat. */
export interface WalkRecord {
    walk: string;
    commentId: string;
    by: Actor;
    createdAt: string;
    outcomes: {
        walker: string;
        outcome: WalkOutcome;
        line: string;
    }[];
    shared: {
        itemId: string;
        sentence: string;
    } | null;
    fix: string | null;
}
/** The record's words. */
export declare function walkRecordBody(ask: Pick<WalkAsk, "id" | "task">, outcomes: WalkRecord["outcomes"], shared: WalkRecord["shared"], fix: string | null): string;
/** The lead's record of a walk, or null while the walk waits. */
export declare function walkRecordOf(canvas: Pick<CanvasContents, "threads">, walkId: string): WalkRecord | null;
/**
 * **Why this record may not be posted, in words that say what to do** — or
 * null. The grounding rules: a stumble happens on a screen the walk met, to a
 * walker it took, and cites what was measured there — or says it was judged;
 * every walker ends once, and an ending agrees with the pins; where two or
 * more walkers stumbled on one screen the lead names the shared problem and
 * proposes one fix, and only there.
 */
export declare function walkRecordRefusal(ask: WalkAsk, findings: readonly WalkFinding[], stumbles: readonly WalkStumble[], outcomes: readonly {
    walker: string;
    outcome: string;
}[], shared: {
    itemId: string;
} | null, fix: boolean): string | null;
/** One walker's lane: the screens as they met them. */
export interface WalkLane {
    walker: Walker;
    outcome: WalkRecord["outcomes"][number] | null;
    screens: {
        itemId: string;
        title: string;
        findings: WalkFinding[];
        stumbles: WalkStumble[];
        notes: string[];
    }[];
}
/** **The lanes**: per walker, per screen, what was measured, what the lead pinned, and how it ended. */
export declare function walkLanes(walkers: readonly Walker[], screens: readonly WalkScreen[], stumbles: readonly WalkStumble[], record: WalkRecord | null): WalkLane[];
