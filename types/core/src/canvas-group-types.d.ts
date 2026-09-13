import type { Actor, Item } from "./model.js";
import type { NewVersion, Operation } from "./ops.js";
/** Saved world-space reservations; never derived from browser text metrics. */
export interface GroupLayout {
    titleHeight?: number;
    briefHeight?: number;
    inset?: number;
    rowGutter?: number;
    columnGutter?: number;
    rows?: string[];
    columns?: string[];
}
/** World coordinates stay flat even when explicit membership nests several levels deep. */
export interface GroupBox {
    x: number;
    y: number;
    width: number;
    height: number;
}
/** The fixed corner during resize, rather than the handle the person is dragging. */
export type GroupAnchor = "nw" | "ne" | "sw" | "se";
/** Writer-owned authorship and cohort identity; intent cannot supply a replacement stamp. */
export interface GroupStamp {
    actor: Actor;
    ts: string;
    opId: string;
}
/** Creation carries source metadata so canonical replay and backups retain its blob references. */
export interface GroupCreation {
    id: string;
    title: string;
    version: NewVersion;
    description?: string;
    properties?: Record<string, string>;
    box?: GroupBox;
    layout?: GroupLayout;
}
/** Closed intents at the request boundary. `apply` is writer/undo output only. */
export type GroupAction = {
    kind: "create";
    group: GroupCreation;
    itemIds?: string[];
    containerId?: string | null;
} | {
    kind: "reparent";
    itemIds: string[];
    containerId: string | null;
    place?: boolean;
} | {
    kind: "remove";
    itemIds: string[];
    toRoot?: boolean;
} | {
    kind: "ungroup";
    itemIds: string[];
} | {
    kind: "transform";
    itemIds: string[];
    by: {
        x: number;
        y: number;
    };
    expected: GroupExpectation[];
} | {
    kind: "transform";
    moves: Array<{
        itemId: string;
        x: number;
        y: number;
    }>;
    expected: GroupExpectation[];
} | {
    kind: "transform";
    itemId: string;
    box: GroupBox;
    anchor?: GroupAnchor;
    expected: GroupExpectation[];
} | {
    kind: "frame";
    itemId: string;
    box?: GroupBox;
    fit?: boolean;
} | {
    kind: "layout";
    itemId: string;
    layout: GroupLayout;
    tidy?: boolean;
} | {
    kind: "delete";
    itemIds: string[];
} | {
    kind: "restore";
    itemIds: string[];
} | {
    kind: "apply";
    change: GroupChange;
};
/** Only fields structural edits own. Metadata/content edits remain independent. */
export interface GroupFields {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    containerId?: string | null;
    groupLayout?: GroupLayout | null;
}
/** Only geometry, membership and layout inputs participate in structural conflict detection. */
export interface GroupFacts extends GroupBox {
    containerId: string | null;
    groupLayout: GroupLayout | null;
    kind: string | null;
    annotates: string | null;
    mimeType: string | null;
}
/** Location and relation sets catch membership changes that leave an item's own box intact. */
export interface GroupExpectation {
    itemId: string;
    location: "live" | "trash" | "absent";
    facts?: GroupFacts;
    children?: string[];
    annotations?: string[];
    cohortId?: string | null;
}
/** Each trash entry points to one deletion act, preventing restore from stealing newer trash. */
export interface GroupDeletionCohort {
    id: string;
    rootIds: string[];
}
/** One capture survives partial restores so later restore can report members it skipped. */
export interface GroupCohortRecord {
    rootIds: string[];
    members: Array<{
        itemId: string;
        containerId: string | null;
        annotates: string | null;
    }>;
}
/** Bounded writer effects preserve content edits while recording an exact structural inverse. */
export type GroupWrite = {
    kind: "patch";
    itemId: string;
    fields: GroupFields;
} | {
    kind: "create";
    item: Item;
} | {
    kind: "trash";
    itemId: string;
    deletedAt: string;
    deletedBy: Actor;
    cohort?: GroupDeletionCohort;
} | {
    kind: "restore";
    itemId: string;
    containerId: string | null;
};
/** Concrete record: no placement search or intent resolution during replay. */
export interface GroupChange {
    canvasId: string;
    intent: Exclude<GroupAction["kind"], "apply" | "remove">;
    expected: GroupExpectation[];
    writes: GroupWrite[];
    cohorts?: Record<string, GroupCohortRecord>;
    skippedIds?: string[];
}
/** Narrow the shared vocabulary without inventing a separate client-side mutation channel. */
export type GroupOperation = Extract<Operation, {
    type: "group.change";
}>;
