import { useEffect, useState } from "react";
import type { Actor, Item } from "@isocan/core";
import { isTextItem } from "@isocan/core";

import { useUiStore } from "../stores/uiStore.ts";
import { VersionContent } from "./ItemView.tsx";
import { actorNameIn, useActorNames } from "../lib/names.ts";
import { useOnScreen } from "../lib/onscreen.ts";
import { sendEchoed } from "../stores/canvasStore.ts";

const FAN_SCALE = 0.62;
const FAN_GAP = 18;

/**
 * The 0.5D unfolded: all versions of an item as a row of live cards to its
 * right, newest first. Click a card to bring that version to the top.
 *
 * **Every version, and some items have hundreds.** The Repo Admin canvas
 * carries 909 versions across fourteen items; fanning the busiest of them
 * would have mounted a live document per version, which is the same failure
 * the Chat panel's thumbnails just cost a browser. Each card draws only once
 * it is on screen — the fan is a horizontal row, so the ones past the edge
 * are exactly the ones nobody is looking at.
 */
export function VersionFanOut({
  item,
  canvasId,
  actor,
}: {
  item: Item;
  canvasId: string;
  actor: Actor;
}) {
  const setFanned = useUiStore((s) => s.setFanned);
  const names = useActorNames();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const cardW = Math.max(140, item.width * FAN_SCALE);
  const cardH = Math.max(100, item.height * FAN_SCALE) + 22;
  const newestFirst = [...item.versions].reverse();

  return (
    <>
      {newestFirst.map((version, index) => (
        <FanCard
          key={version.id}
          item={item}
          canvasId={canvasId}
          actor={actor}
          version={version}
          index={index}
          mounted={mounted}
          cardW={cardW}
          cardH={cardH}
          names={names}
          onPicked={() => setFanned(null)}
        />
      ))}
    </>
  );
}


/**
 * One version, drawn only once it is on screen.
 *
 * The fan is a horizontal row and a long-lived item can have hundreds of
 * versions, so all but a handful are past the right edge of the window at any
 * moment. Drawing those is drawing documents nobody is looking at — the
 * failure the Chat panel's thumbnails cost a browser on 6 September 2026,
 * with the same renderer and the same shape.
 *
 * The card itself — its box, its label, its click target — is always there,
 * so the fan has its full width immediately and scrolling it does not chase a
 * layout that is still growing.
 */
function FanCard({
  item,
  canvasId,
  actor,
  version,
  index,
  mounted,
  cardW,
  cardH,
  names,
  onPicked,
}: {
  item: Item;
  canvasId: string;
  actor: Actor;
  version: Item["versions"][number];
  index: number;
  mounted: boolean;
  cardW: number;
  cardH: number;
  names: ReturnType<typeof useActorNames>;
  onPicked: () => void;
}) {
  const { ref, onScreen } = useOnScreen<HTMLDivElement>();
  const targetX = item.x + item.width + 28 + index * (cardW + FAN_GAP);
  const startX = item.x + index * 6;
  return (
    <div
      ref={ref}
      className={`fan-card${version.id === item.currentVersionId ? " current" : ""}`}
      style={{
        left: mounted ? targetX : startX,
        top: item.y + (mounted ? 0 : index * 6),
        width: cardW,
        height: cardH,
        opacity: mounted ? 1 : 0,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={async () => {
        if (version.id !== item.currentVersionId) {
          await sendEchoed(canvasId, actor, {
            type: "item.setCurrentVersion",
            itemId: item.id,
            versionId: version.id,
          });
        }
        onPicked();
      }}
    >
      <div className="fan-label">
        <b>v{item.versions.indexOf(version) + 1}</b>
        <span>{actorNameIn(names, version.createdBy)}</span>
        <span>{new Date(version.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="fan-body">
        {onScreen && (
          <VersionContent
            canvasId={canvasId}
            blobHash={version.blobHash}
            mimeType={version.mimeType}
            filename={version.filename}
            entered={false}
            textNode={isTextItem(item)}
          />
        )}
      </div>
    </div>
  );
}
