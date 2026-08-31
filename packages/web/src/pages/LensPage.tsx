import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Actor, LensBy, LensEntry, LensGroup, LensSource } from "@isocan/core";
import {
  ago,
  itemPath,
  LENS_REFUSAL,
  lensEntries,
  lensGroups,
  lensSubjectLabels,
  lensSubjects,
} from "@isocan/core";
import { getSnapshot, listCanvases } from "../lib/api.ts";
import { actorColorIn, loadActorColors, useActorColors } from "../lib/colors.ts";
import { ItemThumb } from "../components/ItemThumb.tsx";
import { HomeGlyph } from "../components/Glyphs.tsx";

/**
 * **What somebody has made, across every canvas — and it is not a canvas.**
 *
 * `docs/research/2026-08-30-standing-agents.md` is blunt about the physics, and
 * this page is where the decision has to hold rather than be remembered: **an
 * item's `x`/`y` belong to the canvas it is on.** A view gathering an agent's
 * work from five canvases can hold references to those items; it cannot hold
 * the items. Copy them in and they silt, and editing one changes nothing about
 * the original. Write positions through and a drag here moves something on a
 * canvas the person is not looking at.
 *
 * So the arrangement is DERIVED — by canvas, by day, by kind — nothing is
 * stored, and there is no drag to get wrong. Each entry is a link to where the
 * thing actually lives, which is the only honest thing a reference can be.
 *
 * The whole fold is `core/lens.ts`, the same functions `isocan lens` calls, so
 * the two surfaces cannot disagree about what an agent has been up to.
 */
/** "1 canvases" is the kind of thing that makes a page look unfinished, and it
 *  is the same sentence in two places. */
function countWhere(entries: readonly LensEntry[]): string {
  const n = new Set(entries.map((e) => e.canvasId)).size;
  return `${n} canvas${n === 1 ? "" : "es"}`;
}

const BY: LensBy[] = ["canvas", "day", "kind"];
const BY_LABEL: Record<LensBy, string> = {
  canvas: "By canvas",
  day: "By day",
  kind: "By kind",
};

export function LensPage() {
  const { actorId } = useParams();
  const [sources, setSources] = useState<LensSource[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [by, setBy] = useState<LensBy>("canvas");

  /**
   * One request per canvas, and that is the cost of a cross-canvas view: the
   * items live where they live, and no single endpoint holds them. Acceptable
   * here in a way it would not be on the home screen, because this page is
   * opened deliberately by somebody who wants exactly this.
   */
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        /* `listCanvases` and `getSnapshot` rather than a hand-rolled fetch:
           they carry the badge, recover from a 401 at the door, and know which
           route this build actually serves — I wrote `/api/canvases` from
           memory and it 404s here. */
        const canvases = await listCanvases();
        const loaded = await Promise.all(
          canvases.map(async (canvas) => {
            const state = await getSnapshot(canvas.id).catch(() => null);
            return {
              canvasId: canvas.id,
              canvasTitle: canvas.title,
              // A canvas this badge cannot read contributes nothing rather
              // than failing the whole page — a lens over nine canvases should
              // not go blank because one of them is shut.
              canvas: state?.canvas ?? { items: {}, threads: {}, trash: [] },
            };
          }),
        );
        if (live) setSources(loaded);
      } catch (err) {
        if (live) setFailed(err instanceof Error ? err.message : "could not read the canvases");
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  /* Faces need colours, and nothing has opened a canvas here to seed them.
     They derive from the actor id when unseeded, so this only replaces a good
     answer with the chosen one. */
  useEffect(() => void loadActorColors(), []);
  const colors = useActorColors();

  /** The canvases by id, so a tile can find the item it is drawing. */
  const byCanvas = useMemo(
    () => new Map((sources ?? []).map((s) => [s.canvasId, s.canvas])),
    [sources],
  );

  const subjects = useMemo(() => (sources ? lensSubjects(sources) : []), [sources]);
  const labels = useMemo(() => lensSubjectLabels(subjects), [subjects]);
  const subject: Actor | undefined = actorId
    ? subjects.find((s) => s.id === actorId)
    : undefined;
  const entries = useMemo<LensEntry[]>(
    () => (sources && subject ? lensEntries(sources, subject.id) : []),
    [sources, subject],
  );
  const groups = useMemo<LensGroup[]>(() => lensGroups(entries, by), [entries, by]);
  const nowMs = Date.now();

  return (
    <div className="canvases-page">
      <div className="canvases-head">
        <div className="head-mark">
          <Link to="/" className="home-mark" aria-label="Every canvas">
            <HomeGlyph size={16} />
          </Link>
          {subject && (
            <span
              className="lens-face lens-face-big"
              style={{ background: actorColorIn(colors, subject.id) }}
              aria-hidden
            >
              {subject.name.charAt(0).toUpperCase()}
            </span>
          )}
          <h1>{subject ? labels.get(subject.id) : "Lens"}</h1>
          {/* The same name-then-quiet-hint pattern the panel headers use, and
              it answers the question a bare "Lens" leaves open: a page called
              after a metaphor has to say what it is a lens ON. */}
          {!subject && <i className="panel-hint">who has made what, across every canvas</i>}
        </div>
        <span className="spacer" />
        {subject && (
          <div className="canvas-sorts" role="group" aria-label="Arrangement">
            {BY.map((option) => (
              <button
                key={option}
                className={`btn quiet${option === by ? " on" : ""}`}
                aria-pressed={option === by}
                onClick={() => setBy(option)}
              >
                {BY_LABEL[option]}
              </button>
            ))}
          </div>
        )}
      </div>

      {failed && <p className="canvas-none">{failed}</p>}
      {!sources && !failed && <p className="canvas-none">Reading every canvas…</p>}

      {/* No subject chosen: the roster. Labels are disambiguated in core,
          because two actors really can share a name and a list showing it
          twice reads as a bug in the list rather than as two people. */}
      {sources && !subject && (
        <div className="lens-subjects">
          {subjects.length === 0 && <p className="canvas-none">Nobody has made anything yet.</p>}
          {subjects.map((s) => {
            /* Their most recent work, as the thing itself. A name and a count
               say who has been busy; four thumbnails say what they have been
               busy WITH, which is the question somebody opens this holding. */
            const theirs = lensEntries(sources, s.id);
            const recent = theirs.slice(0, 4);
            return (
              <Link key={s.id} className="lens-subject" to={`/lens/${encodeURIComponent(s.id)}`}>
                <span className="lens-subject-head">
                  <span className="lens-face" style={{ background: actorColorIn(colors, s.id) }}>
                    {s.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="lens-subject-who">
                    <b>{labels.get(s.id)}</b>
                    <span className="lens-subject-count">
                      {theirs.length} thing{theirs.length === 1 ? "" : "s"} ·{" "}
                      {countWhere(theirs)}
                    </span>
                  </span>
                </span>
                <span className="lens-strip" aria-hidden>
                  {recent.map((e) => (
                    <ItemThumb
                      key={e.itemId}
                      canvasId={e.canvasId}
                      itemId={e.itemId}
                      item={byCanvas.get(e.canvasId)?.items[e.itemId]}
                      width={62}
                      height={44}
                    />
                  ))}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {sources && subject && (
        <>
          {/* Said once, at the top, rather than discovered by trying: this
              looks like a canvas and is not one, and the difference is a drag
              that has nowhere true to land. */}
          <p className="lens-note">
            {entries.length} thing{entries.length === 1 ? "" : "s"} across{" "}
            {countWhere(entries)} — {LENS_REFUSAL}.
          </p>
          {groups.map((group) => (
            <section key={group.key} className="lens-group">
              {/* A title is whatever somebody typed, and this view renders
                  data it did not author — from canvases it has never opened,
                  named by people and agents it has never met. Nothing bounds
                  the length, so the heading bounds it here and keeps the whole
                  string on `title` where it costs nothing. */}
              <h2 title={group.label}>
                <span className="lens-group-name">{group.label}</span>
                <span className="lens-count">{group.entries.length}</span>
              </h2>
              {/* Tiles, not rows. The work is a visual medium and a list of
                  its titles is the view that tells you least about it —
                  "Sketch, Sketch, Sketch" is three names and no information,
                  where three thumbnails are three different drawings. */}
              <div className="lens-tiles">
                {group.entries.map((e) => (
                  <Link key={e.itemId} className="lens-tile" to={itemPath(e.canvasId, e.itemId)}>
                    <span className="lens-shot">
                      <ItemThumb
                        canvasId={e.canvasId}
                        itemId={e.itemId}
                        item={byCanvas.get(e.canvasId)?.items[e.itemId]}
                        width={188}
                        height={128}
                      />
                    </span>
                    <span className="lens-name">{e.title}</span>
                    <span className="lens-meta">
                      {/* Grouped by canvas, the canvas is the heading above —
                          repeating it on every tile is noise. */}
                      {by !== "canvas" && <span className="lens-where">{e.canvasTitle}</span>}
                      <span className="lens-kind">{e.kind}</span>
                      {/* Not "stale" and not a warning — other hands on a
                          thing is ordinary collaboration, and this says so. */}
                      {e.editedSince && <span className="lens-touched">edited since</span>}
                      <span className="lens-when">{ago(e.at, nowMs)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
