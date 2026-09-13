import type { Actor, Item, ItemVersion } from "./model.ts";
import type { NewVersion, Operation } from "./ops.ts";

/** Saved world-space reservations; never derived from browser text metrics. */
export interface GroupLayout {
  titleHeight?: number;
  briefHeight?: number;
  inset?: number;
  rowGutter?: number;
  columnGutter?: number;
  rows?: string[];
  columns?: string[];
  rowCount?: number;
  columnCount?: number;
}

/** A named grid cell is one-based on both user surfaces. */
export interface GroupCell { row: number; column: number }
/** Auto finds space; preserve keeps world geometry; exact refuses a violated cell constraint. */
export type GroupPlacementPolicy = "auto" | "preserve" | "exact";
/** Only existing item content verbs can be compiled into atomic header repair. */
type GroupContentOperation = Extract<Operation, { type: "item.update" | "item.addVersion" | "item.setCurrentVersion" }>;
/** Saved content effects own specific metadata keys and the version fields they replace. */
export interface GroupContentFields {
  title?: string;
  description?: string;
  properties?: Record<string, string | null>;
  versions?: ItemVersion[];
  currentVersionId?: string;
}

/** World coordinates stay flat even when explicit membership nests several levels deep. */
export interface GroupBox { x: number; y: number; width: number; height: number }
/** The fixed corner during resize, rather than the handle the person is dragging. */
export type GroupAnchor = "nw" | "ne" | "sw" | "se";
/** Writer-owned authorship and cohort identity; intent cannot supply a replacement stamp. */
export interface GroupStamp { actor: Actor; ts: string; opId: string }
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
export type GroupAction =
  | { kind: "create"; group: GroupCreation; itemIds?: string[]; containerId?: string | null }
  | { kind: "reparent"; itemIds: string[]; containerId: string | null; place?: boolean; cell?: GroupCell; groupPlacement?: GroupPlacementPolicy; expected?: GroupExpectation[] }
  | { kind: "insert"; item: Extract<Operation, { type: "item.add" }> }
  | { kind: "content"; operation: GroupContentOperation }
  | { kind: "remove"; itemIds: string[]; toRoot?: boolean }
  | { kind: "ungroup"; itemIds: string[] }
  | { kind: "transform"; itemIds: string[]; by: { x: number; y: number }; expected: GroupExpectation[]; containerId?: string | null; cell?: GroupCell; groupPlacement?: GroupPlacementPolicy }
  | { kind: "transform"; moves: Array<{ itemId: string; x: number; y: number }>; expected: GroupExpectation[]; containerId?: string | null; cell?: GroupCell; groupPlacement?: GroupPlacementPolicy }
  | { kind: "transform"; itemId: string; box: GroupBox; anchor?: GroupAnchor; expected: GroupExpectation[]; containerId?: string | null; cell?: GroupCell; groupPlacement?: GroupPlacementPolicy }
  | { kind: "frame"; itemId: string; box?: GroupBox; fit?: boolean; expected?: GroupExpectation[] }
  | { kind: "frame"; itemIds: string[]; fit: true; expected?: GroupExpectation[] }
  | { kind: "frame"; targets: Array<{ itemId: string; box?: GroupBox }>; expected?: GroupExpectation[] }
  | { kind: "layout"; itemId: string; layout: GroupLayout; tidy?: boolean }
  | { kind: "delete"; itemIds: string[] }
  | { kind: "restore"; itemIds: string[] }
  | { kind: "apply"; change: GroupChange };

/** Only fields structural edits own. Metadata/content edits remain independent. */
export interface GroupFields {
  x?: number; y?: number; width?: number; height?: number;
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
  content?: GroupContentFields;
}
/** Each trash entry points to one deletion act, preventing restore from stealing newer trash. */
export interface GroupDeletionCohort { id: string; rootIds: string[] }
/** One capture survives partial restores so later restore can report members it skipped. */
export interface GroupCohortRecord {
  rootIds: string[];
  members: Array<{ itemId: string; containerId: string | null; annotates: string | null }>;
}
/** Bounded writer effects preserve content edits while recording an exact structural inverse. */
export type GroupWrite =
  | { kind: "patch"; itemId: string; fields: GroupFields; content?: GroupContentFields }
  | { kind: "create"; item: Item }
  | { kind: "trash"; itemId: string; deletedAt: string; deletedBy: Actor; cohort?: GroupDeletionCohort }
  | { kind: "restore"; itemId: string; containerId: string | null };

/** Concrete record: no placement search or intent resolution during replay. */
export interface GroupChange {
  canvasId: string;
  intent: Exclude<GroupAction["kind"], "apply" | "remove">;
  expected: GroupExpectation[];
  writes: GroupWrite[];
  cohorts?: Record<string, GroupCohortRecord>;
  skippedIds?: string[];
  /** Absent means the original v1 record; v2 adds insertion and content effects. */
  schemaVersion?: 2;
}
/** Narrow the shared vocabulary without inventing a separate client-side mutation channel. */
export type GroupOperation = Extract<Operation, { type: "group.change" }>;
