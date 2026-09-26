import { useEffect, useState, type CSSProperties } from "react";
import type { Item, UnderlayFacts, WebHost } from "@isocan/core";
import { behindCount, checkWords, isWire, readSystemDoc, restyleArgs, restyleLabel, specKey, systemsToRead, wiresBehind, type WireCheck } from "./behind.ts";
import { currentVersionOf } from "./port.ts";
import { readWire } from "./render.ts";
import { cachedDoc, cachedSpec, docs, specs } from "./spec-cache.ts";

/**
 * **The "behind" marks** (`behind.ts`): a small quiet tag just below the
 * bottom-right corner of every wire whose governing DESIGN.md has a newer
 * version than the one that drew it, and one below the DESIGN.md itself
 * saying how many wires are behind it. Derived on every render from the
 * wires' specs (read once per version, `spec-cache.ts`) and the system's
 * current version — nothing is written by looking.
 *
 * A tag is a button: its click is the Restyle to <system> the item menu
 * offers, which opens `/wire style system <ids>` — what `isocan wire style
 * <screens…>` runs, for those wires' flows: one op group, one undo. A reader
 * (or the scrubber's past) sees the tag and cannot press it. Like the maybe
 * tag it fades out at a zoom where it would not fit under the item.
 */
export function WireBehind({ canvas, drag, readText, host, canEdit, past }: Pick<UnderlayFacts, "canvas" | "drag" | "readText" | "host" | "canEdit" | "past">) {
  const [, setRead] = useState(0);
  const wires = Object.values(canvas.items).filter(isWire);
  const wanted = wires.map(specKey).filter((h): h is string => h !== null && !specs.has(h)).join(",");
  // Then the DESIGN.md of every system a wire was drawn from an older version of — only those.
  const systems = systemsToRead(canvas, cachedSpec).filter((s) => cachedDoc(s) === undefined);
  const wantedDocs = systems.map((s) => s.id).join(",");
  useEffect(() => {
    if (!readText || (wanted === "" && wantedDocs === "")) return;
    let live = true;
    void Promise.all([
      ...(wanted ? wanted.split(",") : []).map(async (hash) => {
        try {
          specs.set(hash, readWire(await readText(hash)));
        } catch {
          specs.set(hash, null);
        }
      }),
      ...systems.map(async (system) => {
        const hash = currentVersionOf(system)?.blobHash;
        if (hash) docs.set(hash, await readSystemDoc(system, readText));
      }),
    ]).then(() => {
      if (live) setRead((n) => n + 1);
    });
    return () => {
      live = false;
    };
    // `systems` is what `wantedDocs` names.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, wantedDocs, readText]);

  const behind = wiresBehind(canvas, cachedSpec, cachedDoc);
  if (behind.length === 0) return null;
  const bySystem = new Map<string, WireCheck[]>();
  for (const c of behind) bySystem.set(c.governedBy!.itemId, [...(bySystem.get(c.governedBy!.itemId) ?? []), c]);
  const press = !past && canEdit !== false && host ? (ids: readonly string[]) => restyleOnCanvas(host, ids) : undefined;
  const tag = (item: Item, key: string, text: string, title: string, ids: readonly string[]) => {
    const on = drag?.itemIds.includes(item.id) ? drag : null;
    return (
      <div key={key} className="wire-behind-anchor" data-wire-behind={item.id} style={{ left: item.x + (on?.dx ?? 0) + item.width, top: item.y + (on?.dy ?? 0) + item.height, "--w": item.width } as CSSProperties}>
        <button type="button" className="wire-behind-tag" title={title} aria-label={title} aria-disabled={!press} onPointerDown={(e) => e.stopPropagation()} onClick={() => press?.(ids)}>
          {text}
        </button>
      </div>
    );
  };
  return (
    <>
      {behind.map((c) => {
        const item = canvas.items[c.itemId]!;
        return tag(item, c.itemId, "behind", `${checkWords(c)} — ${restyleLabel(c)}`, [c.itemId]);
      })}
      {[...bySystem].map(([systemId, list]) => {
        const system = canvas.items[systemId];
        if (!system) return null;
        const ids = list.map((c) => c.itemId);
        return tag(system, `system:${systemId}`, behindCount(list.length), `${behindCount(list.length)} this DESIGN.md — ${restyleLabel(list[0]!)}`, ids);
      })}
    </>
  );
}

/** The mark's click and the menu row, one door: the Wireframes dialog with `style system <ids>`. */
export function restyleOnCanvas(host: Pick<WebHost, "runCommand">, ids: readonly string[]): void {
  void host.runCommand(`/wire ${restyleArgs(ids)}`);
}
