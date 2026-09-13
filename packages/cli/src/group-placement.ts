import { groupContentBox, type CanvasSnapshotResponse, type GroupBox, type GroupCell, type Operation, type Placement } from "@isocan/core";
import { insertedItemBox, resolveCanvasGroupRef } from "@isocan/api";
import { parseXY } from "./output.ts";

type Add = Extract<Operation, { type: "item.add" }>;
/** Local placement hints are lifted onto the single insertion request before transport. */
export type PlannedPlacement = Placement & Pick<Add, "containerId" | "cell" | "groupPlacement">;

export function parseGroupCell(value: string): GroupCell {
  const parts = value.split(",").map(Number);
  if (parts.length !== 2 || parts.some((n) => !Number.isInteger(n) || n < 1)) throw new Error(`--cell wants positive row,column counted from 1, e.g. --cell 3,4 — got: ${value}`);
  return { row: parts[0]!, column: parts[1]! };
}

/** Membership is explicit even when --at supplies world coordinates. The writer finds the final slot. */
export function groupPlacementFor(snapshot: CanvasSnapshotResponse, opts: { at?: string; in?: string; cell?: string }): PlannedPlacement | undefined {
  if (snapshot.project.groupMode !== "groups" || opts.in === undefined) return undefined;
  const parent = resolveCanvasGroupRef(snapshot.canvas, opts.in, true);
  const content = groupContentBox(parent);
  const at = opts.at ? parseXY(opts.at) : content;
  return { x: at.x, y: at.y, chosen: true, containerId: parent.id, groupPlacement: opts.at ? "exact" : "auto", ...(opts.cell ? { cell: parseGroupCell(opts.cell) } : {}) };
}

export function insertionOperation(op: Operation): Operation {
  if (op.type !== "item.add") return op;
  const planned = op.placement as PlannedPlacement;
  if (planned.containerId === undefined) return op;
  const { containerId, cell, groupPlacement, ...placement } = planned;
  return { ...op, containerId, ...(cell ? { cell } : {}), ...(groupPlacement ? { groupPlacement } : {}), placement };
}

/** Keep legacy placement JSON (including chosen); group receipts report the writer's complete frame. */
export function insertionReceiptPlacement(op: Operation, itemId: string): GroupBox | Extract<Placement, { x: number }> {
  if (op.type === "item.add" && op.itemId === itemId && "x" in op.placement && "y" in op.placement) return op.placement;
  return insertedItemBox(op, itemId);
}
