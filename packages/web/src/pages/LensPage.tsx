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
          <h1>{subject ? labels.get(subject.id) : "Lens"}</h1>
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
          {subjects.map((s) => (
            <Link key={s.id} className="btn" to={`/lens/${encodeURIComponent(s.id)}`}>
              {labels.get(s.id)}
            </Link>
          ))}
        </div>
      )}

      {sources && subject && (
        <>
          {/* Said once, at the top, rather than discovered by trying: this
              looks like a canvas and is not one, and the difference is a drag
              that has nowhere true to land. */}
          <p className="lens-note">
            {entries.length} thing{entries.length === 1 ? "" : "s"} across{" "}
            {new Set(entries.map((e) => e.canvasId)).size} canvases — {LENS_REFUSAL}.
          </p>
          {groups.map((group) => (
            <section key={group.key} className="lens-group">
              <h2>{group.label}</h2>
              <div className="lens-rows">
                {group.entries.map((e) => (
                  <Link key={e.itemId} className="lens-row" to={itemPath(e.canvasId, e.itemId)}>
                    <span className="lens-title">{e.title}</span>
                    <span className="lens-kind">{e.kind}</span>
                    {by !== "canvas" && <span className="lens-where">{e.canvasTitle}</span>}
                    {/* Not "stale" and not a warning — other hands on a thing
                        is ordinary collaboration, and this only says so. */}
                    {e.editedSince && <span className="lens-touched">edited since</span>}
                    <span className="lens-when">{ago(e.at, nowMs)}</span>
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
