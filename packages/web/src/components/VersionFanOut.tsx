import { useEffect, useState } from "react";
import type { Actor, Item } from "@isocan/core";
import { isTextItem, prunedVersions } from "@isocan/core";

import { useUiStore } from "../stores/uiStore.ts";
import { VersionContent } from "./ItemView.tsx";
import { actorNameIn, useActorNames } from "../lib/names.ts";
import { sendEchoed } from "../stores/canvasStore.ts";

const FAN_SCALE = 0.62;
const FAN_GAP = 18;
/**
 * **How many cards carry a live document.** Every card used to: a stack
 * 150 deep fanned out as 150 iframes, each fetching its blob, which was the
 * one place the canvas ever rendered every version at once — the ordinary
 * render only ever fetches the current one. Past this many the card keeps
 * its label and its click and shows no document; nobody compares the 40th
 * version against the 41st by eye, and the ones people do compare are the
 * newest, which is the end the fan starts from.
 */
export const FAN_LIVE = 24;

/**
 * **Past this depth the fan offers to prune.** Fourteen is a fortnight of a
 * daily generator, which is the only thing that makes stacks this deep — a
 * person iterating by hand gets to five or six and stops. A shallower stack
 * is somebody's history and the fan says nothing about cutting it.
 */
export const PRUNE_OFFER_DEPTH = 14;
/** What the offer keeps: the fortnight, and the current version whatever its age. */
export const PRUNE_KEEP = 14;

/**
 * The 0.5D unfolded: all versions of an item as a row of live cards to its
 * right, newest first. Click a card to bring that version to the top.
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
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const cardW = Math.max(140, item.width * FAN_SCALE);
  const cardH = Math.max(100, item.height * FAN_SCALE) + 22;
  const newestFirst = [...item.versions].reverse();
  const dropping = item.versions.length > PRUNE_OFFER_DEPTH ? prunedVersions(item, PRUNE_KEEP) : [];

  return (
    <>
      {dropping.length > 0 && (
        <div
          className="fan-prune"
          style={{ left: item.x + item.width + 28, top: item.y - 34 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {confirming ? (
            <>
              <button
                className="btn danger"
                onClick={() => {
                  setConfirming(false);
                  void sendEchoed(canvasId, actor, {
                    type: "item.pruneVersions",
                    itemId: item.id,
                    keep: PRUNE_KEEP,
                  });
                }}
              >
                Really drop {dropping.length} older version{dropping.length === 1 ? "" : "s"} —
                can't be undone
              </button>{" "}
              <button className="btn" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </>
          ) : (
            <button
              className="btn"
              title={`${item.versions.length} versions here — keep the newest ${PRUNE_KEEP} (and the current one). isocan version prune ${item.id} --keep ${PRUNE_KEEP}`}
              onClick={() => setConfirming(true)}
            >
              Keep only the latest {PRUNE_KEEP}…
            </button>
          )}
        </div>
      )}
      {newestFirst.map((version, index) => {
        const targetX = item.x + item.width + 28 + index * (cardW + FAN_GAP);
        const startX = item.x + index * 6;
        return (
          <div
            key={version.id}
            className={`fan-card${version.id === item.currentVersionId ? " current" : ""}${index < FAN_LIVE ? "" : " folded"}`}
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
              setFanned(null);
            }}
          >
            <div className="fan-label">
              <b>v{item.versions.indexOf(version) + 1}</b>
              <span>{actorNameIn(names, version.createdBy)}</span>
              <span>{new Date(version.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="fan-body">
              {index < FAN_LIVE ? (
                <VersionContent
                  canvasId={canvasId}
                  blobHash={version.blobHash}
                  mimeType={version.mimeType}
                  filename={version.filename}
                  entered={false}
                  textNode={isTextItem(item)}
                />
              ) : (
                <span>click to bring it to the top</span>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
