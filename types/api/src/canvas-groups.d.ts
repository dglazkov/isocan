import type { Actor, CanvasContents, GroupAction, GroupAnchor, GroupBox, GroupCell, GroupLayout, GroupPlacementPolicy, Item, Operation } from "../../core/src/index.js";
import { groupArrangeAction } from "../../core/src/index.js";
import type { DaemonRoutes } from "./routes.js";
type PublicAction = Exclude<GroupAction, {
    kind: "apply";
}>;
type GroupClient = Pick<DaemonRoutes, "snapshot" | "uploadBlob" | "changeGroup">;
/** Membership inspection exposes the relation and both boxes, rather than counting overlap. */
export interface CanvasGroupView {
    id: string;
    title: string;
    description: string;
    parentId: string | null;
    directMemberIds: string[];
    directCount: number;
    descendantCount: number;
    outerBox: GroupBox;
    contentBox: GroupBox;
    layout: Item["groupLayout"];
    members: Array<{
        id: string;
        title: string;
        parentId: string | null;
        kind: string | null;
    }>;
}
/** Dry runs and receipts share the actual resolver's effects; no guessed placement summary. */
export interface CanvasGroupResult {
    dryRun: boolean;
    intent: PublicAction["kind"];
    itemId?: string;
    affectedRoots: string[];
    changes: Array<{
        itemId: string;
        parentBefore: string | null;
        parentAfter: string | null;
        boxBefore: GroupBox | null;
        boxAfter: GroupBox | null;
        state: "live" | "trash";
    }>;
    constraints: {
        valid: true;
        adjustedFrameIds: string[];
    };
    seq?: number;
}
/** Creation accepts bytes as text; preview hashes them locally and never uploads a blob. */
export interface CanvasGroupCreateOptions {
    at?: {
        x: number;
        y: number;
    };
    size?: {
        width: number;
        height: number;
    };
    note?: string;
    properties?: Record<string, string>;
    dryRun?: boolean;
}
/** Exact IDs win; every other title/ID prefix must identify one item, with candidates on refusal. */
export declare function resolveCanvasGroupRef(canvas: CanvasContents, ref: string, groupOnly?: boolean): Item;
/** The canonical canvas-group family, shared by `connect()` and the CLI without argv or UI state. */
export declare class CanvasGroups {
    private client;
    readonly canvasId: string;
    private identity;
    constructor(client: GroupClient, canvasId: string, identity: Actor | (() => Actor));
    private read;
    /** Listing reads explicit group identities, including valid empty groups. */
    list(): Promise<CanvasGroupView[]>;
    /** Recursive inspection expands descendants without changing anybody's selection. */
    show(ref: string, recursive?: boolean): Promise<CanvasGroupView>;
    /** An empty named frame is one creation; its card bytes are uploaded only after validation. */
    new(title: string, options?: CanvasGroupCreateOptions): Promise<CanvasGroupResult>;
    /** Wrapping preserves positions and lets the shared writer assign the lowest common parent. */
    wrap(refs: string[], title: string, options?: Pick<CanvasGroupCreateOptions, "note" | "dryRun">): Promise<CanvasGroupResult>;
    private create;
    /** Add and move-between-groups are one reparent intent, optionally placing the new members. */
    add(group: string, refs: string[], options?: {
        place?: boolean;
        dryRun?: boolean;
        cell?: GroupCell;
        groupPlacement?: GroupPlacementPolicy;
    }): Promise<CanvasGroupResult>;
    /** Move one root and its placement unit, with the dependency capture made before the write. */
    move(ref: string, destination: {
        at: {
            x: number;
            y: number;
        };
    } | {
        by: {
            x: number;
            y: number;
        };
    }, options?: {
        dryRun?: boolean;
    }): Promise<CanvasGroupResult>;
    /** Scale the group's native frames and attached marks, keeping the named corner fixed. */
    resize(ref: string, size: {
        width: number;
        height: number;
    }, options?: {
        anchor?: GroupAnchor;
        dryRun?: boolean;
    }): Promise<CanvasGroupResult>;
    /** Frame edits never scale children. Fitting several groups still produces one record. */
    frame(refs: string | string[], options?: {
        fit?: boolean;
        at?: {
            x: number;
            y: number;
        };
        size?: {
            width: number;
            height: number;
        };
        dryRun?: boolean;
    }): Promise<CanvasGroupResult>;
    layout(ref: string, layout: GroupLayout, options?: {
        tidy?: boolean;
        dryRun?: boolean;
    }): Promise<CanvasGroupResult>;
    /** Grid counts and optional names use the same saved layout as the browser. */
    grid(ref: string, counts: {
        rows: number;
        columns: number;
    }, options?: {
        rows?: string[];
        columns?: string[];
        tidy?: boolean;
        dryRun?: boolean;
    }): Promise<CanvasGroupResult>;
    arrange(refs: string[], arrangement: Parameters<typeof groupArrangeAction>[2], options?: {
        dryRun?: boolean;
    }): Promise<CanvasGroupResult>;
    /** Sized content updates reserve headers and transform geometry in the same accepted record. */
    update(ref: string, update: Omit<Extract<Operation, {
        type: "item.update";
    }>, "type" | "itemId">, options?: {
        dryRun?: boolean;
    }): Promise<CanvasGroupResult>;
    /** Native leaf fitting and frame-only group fitting share one bounded writer act. */
    fit(targets: Array<{
        itemId: string;
        width?: number;
        height?: number;
    }>, options?: {
        dryRun?: boolean;
    }): Promise<CanvasGroupResult>;
    /** Remove promotes each root one level; mixed-parent selections still use one undoable act. */
    remove(refs: string[], options?: {
        toRoot?: boolean;
        dryRun?: boolean;
    }): Promise<CanvasGroupResult>;
    /** Dissolve frames while preserving their children; frame-attached marks follow the frame to trash. */
    ungroup(refs: string[], options?: {
        dryRun?: boolean;
    }): Promise<CanvasGroupResult>;
    private perform;
}
export {};
