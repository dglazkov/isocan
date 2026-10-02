import { Suspense, lazy } from "react";
import type { Actor, Item } from "@isocan/core";
import { useCanEdit } from "../lib/capability.ts";
import { stackGroup } from "../lib/groupstack.ts";
import "./GroupBand.css";

// The pile, fan and open grid: only a canvas with a stacked group loads them.
const GroupStack = lazy(() => import("./GroupStack.tsx"));

/**
 * **What a group's band holds besides its name** (groups-by-hand phase 4): the
 * *Stack* button on a spread group, or — on a stacked one — the whole pile.
 *
 * One lazy component for both, so the first paint carries a single
 * `lazy()` and no button: the band's toggle arrives with the first group a
 * canvas draws, and the pile only with the first stacked one.
 */
export default function GroupBand({ item, canvasId, actor, lifted }: { item: Item; canvasId: string; actor: Actor; lifted: boolean }) {
  const canEdit = useCanEdit();
  if (item.groupLayout?.display === "stack") return <Suspense fallback={null}><GroupStack item={item} canvasId={canvasId} actor={actor} lifted={lifted} /></Suspense>;
  if (!canEdit) return null;
  return (
    <button
      type="button"
      className="group-stack-toggle band"
      style={{ top: ((item.groupLayout?.titleHeight ?? 56) - 28) / 2, right: item.groupLayout?.inset ?? 24 }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => stackGroup(canvasId, actor, item, true)}
    >
      Stack
    </button>
  );
}
