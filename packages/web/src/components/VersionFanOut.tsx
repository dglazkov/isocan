import { useEffect, useState } from "react";
import type { Actor, Item } from "@isocan/core";
import { sendOp } from "../lib/api.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { VersionContent } from "./ItemView.tsx";
import { actorNameIn, useActorNames } from "../lib/names.ts";

const FAN_SCALE = 0.62;
const FAN_GAP = 18;

/**
 * The 0.5D unfolded: all versions of an item as a row of live cards to its
 * right, newest first. Click a card to bring that version to the top.
 */
export function VersionFanOut({
  item,
  projectId,
  actor,
}: {
  item: Item;
  projectId: string;
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
      {newestFirst.map((version, index) => {
        const targetX = item.x + item.width + 28 + index * (cardW + FAN_GAP);
        const startX = item.x + index * 6;
        return (
          <div
            key={version.id}
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
                await sendOp(projectId, actor, {
                  type: "item.setCurrentVersion",
                  itemId: item.id,
                  versionId: version.id,
                });
              }
              setFanned(null);
            }}
          >
            <div className="fan-label">
              <b>v{item.versions.indexOf(version) + 1}</b>
              <span>{actorNameIn(names, version.createdBy)}</span>
              <span>{new Date(version.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="fan-body">
              <VersionContent
                projectId={projectId}
                blobHash={version.blobHash}
                mimeType={version.mimeType}
                filename={version.filename}
                entered={false}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}
