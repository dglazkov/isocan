import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  Actor,
  LensAct,
  LensBy,
  LensEntry,
  LensFilter,
  LensGroup,
  LensLog,
  LensSource,
  PresenceWhere,
} from "@isocan/core";
import {
  ago,
  filterLens,
  LENS_WINDOWS,
  lensActs,
  lensLive,
  lensLiveList,
  lensLiveWords,
  lensKinds,
  lensShape,
  lensStanding,
  standingWords,
  opWords,
  canvasPath,
  itemPath,
  LENS_REFUSAL,
  lensEntries,
  lensGroups,
  lensSubjectLabels,
  lensSubjects,
  faceMark,
} from "@isocan/core";
import { fetchPresenceWhere, getOplog, getSnapshot, listCanvases } from "../lib/api.ts";
import { actorColorIn, loadActorColors, useActorColors } from "../lib/colors.ts";
import { ItemThumb } from "../components/ItemThumb.tsx";
import { HomeGlyph } from "../components/Glyphs.tsx";
import { useActorMarks } from "../lib/marks.ts";

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

/**
 * Press the chip that is on and it turns off — by DELETING the key rather than
 * setting it to `undefined`, which `exactOptionalPropertyTypes` refuses and
 * which would anyway leave a filter carrying a field that means nothing.
 */
function toggle<K extends keyof LensFilter>(
  filter: LensFilter,
  key: K,
  value: NonNullable<LensFilter[K]>,
): LensFilter {
  if (filter[key] === value) {
    const { [key]: _gone, ...rest } = filter;
    return rest;
  }
  return { ...filter, [key]: value };
}

/** Above this many things, the narrowing appears. */
const NARROW_FROM = 12;

/**
 * How often the dots refresh. Presence expires on a TTL the daemon owns, so
 * this only has to be comfortably under it — often enough that somebody
 * arriving shows up while you are still looking, rare enough that a page left
 * open all afternoon is not a load.
 */
const PRESENCE_EVERY_MS = 15_000;

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
  const marks = useActorMarks();

  /** The canvases by id, so a tile can find the item it is drawing. */
  const byCanvas = useMemo(
    () => new Map((sources ?? []).map((s) => [s.canvasId, s.canvas])),
    [sources],
  );
  /* Titles, for the canvases presence names — which are not always canvases
     this subject has made anything on, so no group heading below carries the
     name and the map above holds contents rather than a title. */
  const titles = useMemo(
    () => new Map((sources ?? []).map((s) => [s.canvasId, s.canvasTitle])),
    [sources],
  );

  const subjects = useMemo(() => (sources ? lensSubjects(sources) : []), [sources]);
  const labels = useMemo(() => lensSubjectLabels(subjects), [subjects]);
  const subject: Actor | undefined = actorId
    ? subjects.find((s) => s.id === actorId)
    : undefined;
  const [filter, setFilter] = useState<LensFilter>({});
  /**
   * **Two questions, and only one of them is a portfolio.**
   *
   * "Made" reads the canvas: what is there now. "Did" reads the LOG, which
   * remembers the half a portfolio cannot show — work that was made and then
   * deleted. An agent that made nine screens and removed eight looks, in a
   * portfolio, like an agent that made one.
   *
   * The logs are fetched only when somebody asks for them, for the reason the
   * card peek is lazy: a log per canvas is the cost this page is built to
   * avoid paying by default.
   */
  const [mode, setMode] = useState<"made" | "did">("made");
  const [logs, setLogs] = useState<LensLog[] | null>(null);
  useEffect(() => {
    if (mode !== "did" || !sources || logs) return;
    let live = true;
    (async () => {
      const loaded = await Promise.all(
        sources.map(async (source) => ({
          canvasId: source.canvasId,
          canvasTitle: source.canvasTitle,
          /* One shut canvas is not a reason for a blank record — the same
             bargain the entries make above, and for a stronger reason: a log
             that reads as empty looks like an agent who did nothing. */
          entries: await getOplog(source.canvasId).catch(() => []),
        })),
      );
      if (live) setLogs(loaded);
    })();
    return () => {
      live = false;
    };
  }, [mode, sources, logs]);

  /**
   * **Who is live, refreshed while the page is open.**
   *
   * Unlike the logs this is not lazy: it is one request for the whole board,
   * it answers a question on BOTH views (the roster and a subject's canvases),
   * and a dot that appears only after you click something is not presence.
   *
   * It polls rather than subscribes. Presence rides on the per-canvas socket,
   * so being exact here would mean a socket per canvas — a dozen connections
   * to draw a dozen dots. `null` while unknown, so nothing renders "nobody is
   * here" before anybody has been asked.
   */
  const [present, setPresent] = useState<PresenceWhere[] | null>(null);
  useEffect(() => {
    let live = true;
    const read = () => {
      fetchPresenceWhere()
        .then((r) => live && setPresent(r.where))
        .catch(() => {
          /* A daemon that will not answer this leaves the dots off. The rest
             of the page is about what happened, and none of it needs a dot. */
        });
    };
    read();
    const timer = setInterval(read, PRESENCE_EVERY_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  const acts = useMemo<LensAct[]>(
    () => (logs && subject ? lensActs(logs, subject.id) : []),
    [logs, subject],
  );
  const shape = useMemo(() => lensShape(acts), [acts]);
  const live = useMemo(
    () => lensLive(present ?? [], subject?.id ?? ""),
    [present, subject],
  );
  const all = useMemo<LensEntry[]>(
    () => (sources && subject ? lensEntries(sources, subject.id) : []),
    [sources, subject],
  );
  /* Where they STAND (standing agents, phase 4): the canvases they are
     enrolled on, with the strongest true state. The rc's holds are not
     polled per canvas here — presence already says "standing by" where an rc
     is parked — so a standing with nobody listening reads as enrolled. */
  const standing = useMemo(
    () =>
      sources && subject
        ? lensStanding(sources, acts, live, new Set(), subject.id).filter((row) => row.enrolled)
        : [],
    [sources, subject, acts, live],
  );
  /* Kinds are offered from what is ACTUALLY there — a chooser listing kinds
     nobody has made is a menu of dead ends. Counted before filtering, so
     choosing one does not empty the list you chose it from. */
  const kinds = useMemo(() => lensKinds(all), [all]);
  const entries = useMemo(() => filterLens(all, filter, Date.now()), [all, filter]);
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
              {faceMark(marks, subject)}
            </span>
          )}
          <h1>{subject ? labels.get(subject.id) : "Lens"}</h1>
          {/* The same name-then-quiet-hint pattern the panel headers use, and
              it answers the question a bare "Lens" leaves open: a page called
              after a metaphor has to say what it is a lens ON. */}
          {!subject && <i className="panel-hint">who has made what, across every canvas</i>}
          {/* Present tense, next to a page that is otherwise entirely past
              tense. Absent when there is nothing to say — see
              `lensLiveWords`, which will not call somebody offline on the
              strength of rooms it cannot see into. */}
          {subject && lensLiveList(live).length > 0 && (
            <i className="lens-live-said">
              {/* Named, not counted. "On a canvas now" invites exactly one
                  question, and until this the page could not answer it: the
                  canvas somebody is SITTING on is often not one they have
                  made anything on, so no group heading below is theirs. */}
              {lensLiveList(live).map((at, i) => (
                <span key={at.canvasId}>
                  {i > 0 && ", "}
                  <span
                    className={`lens-live-dot${at.state === "available" ? " standby" : ""}`}
                    aria-hidden
                  />{" "}
                  <Link className="lens-live-at" to={canvasPath(at.canvasId)}>
                    {titles.get(at.canvasId) ?? "a canvas"}
                  </Link>
                </span>
              ))}
            </i>
          )}
          {/* Where they stand, as a record rather than a moment: every canvas
              they are enrolled on, with what they did there — the fold
              `isocan history <actor>` leads with. */}
          {subject && standing.length > 0 && (
            <i className="lens-standing">
              stands on{" "}
              {standing.map((row, i) => (
                <span key={row.canvasId}>
                  {i > 0 && ", "}
                  <Link className="lens-live-at" to={canvasPath(row.canvasId)}>
                    {row.canvasTitle}
                  </Link>
                  <span className="lens-standing-note">
                    {" "}({standingWords(row)}{row.acts > 0 ? ` · ${row.acts} act${row.acts === 1 ? "" : "s"}, ${row.replies} ${row.replies === 1 ? "reply" : "replies"}` : " · nothing yet"})
                  </span>
                </span>
              ))}
            </i>
          )}
        </div>
        <span className="spacer" />
        {subject && (
          <div className="canvas-sorts" role="group" aria-label="What to show">
            {/* Two different questions, not two views of one — see `mode`. */}
            {(["made", "did"] as const).map((option) => (
              <button
                key={option}
                className={`btn quiet${option === mode ? " on" : ""}`}
                aria-pressed={option === mode}
                onClick={() => setMode(option)}
              >
                {option === "made" ? "Made" : "Did"}
              </button>
            ))}
          </div>
        )}
        {subject && mode === "made" && (
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
            /* The one present-tense fact on a page of past-tense ones, and
               the reason to look before choosing: "who is working right now"
               is answered here or nowhere. */
            const said = lensLiveWords(lensLive(present ?? [], s.id));
            return (
              <Link key={s.id} className="lens-subject" to={`/lens/${encodeURIComponent(s.id)}`}>
                <span className="lens-subject-head">
                  <span className="lens-face" style={{ background: actorColorIn(colors, s.id) }}>
                    {faceMark(marks, s)}
                  </span>
                  <span className="lens-subject-who">
                    <b>{labels.get(s.id)}</b>
                    <span className="lens-subject-count">
                      {theirs.length} thing{theirs.length === 1 ? "" : "s"} ·{" "}
                      {countWhere(theirs)}
                    </span>
                    {said && (
                      <span className="lens-live-said">
                        <span className="lens-live-dot" aria-hidden /> {said}
                      </span>
                    )}
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
          {/**
           * **The narrowing, offered only where it earns its space.**
           *
           * A row of chips above thirty tiles is chrome nobody asked for; the
           * same row above three hundred is the difference between a gallery
           * and a wall. The threshold counts what the subject HAS, not what is
           * showing — otherwise choosing a filter that matches a few things
           * would remove the controls you chose it with.
           */}
          {all.length > NARROW_FROM && (
            <div className="lens-narrow" role="group" aria-label="Narrow">
              <button
                className={`btn quiet${Object.keys(filter).length === 0 ? " on" : ""}`}
                aria-pressed={Object.keys(filter).length === 0}
                onClick={() => setFilter({})}
              >
                Everything
              </button>
              {kinds.map(({ kind, count }) => (
                <button
                  key={kind}
                  className={`btn quiet${filter.kind === kind ? " on" : ""}`}
                  aria-pressed={filter.kind === kind}
                  onClick={() => setFilter((f) => toggle(f, "kind", kind))}
                >
                  {kind} <span className="lens-tally">{count}</span>
                </button>
              ))}
              {LENS_WINDOWS.map((w) => (
                <button
                  key={w.label}
                  className={`btn quiet${filter.withinHours === w.hours ? " on" : ""}`}
                  aria-pressed={filter.withinHours === w.hours}
                  onClick={() => setFilter((f) => toggle(f, "withinHours", w.hours))}
                >
                  {w.label}
                </button>
              ))}
              {/* "Still as I left it" rather than "untouched": the question is
                  about the reader's own work, not about the item's state. */}
              <button
                className={`btn quiet${filter.untouched ? " on" : ""}`}
                aria-pressed={filter.untouched === true}
                onClick={() => setFilter((f) => toggle(f, "untouched", true))}
              >
                Untouched since
              </button>
            </div>
          )}
          {/* Said out loud, because a narrowed lens that matches nothing looks
              exactly like an agent who has made nothing. */}
          {all.length > 0 && entries.length === 0 && (
            <p className="canvas-none">
              Nothing here matches that.{" "}
              <button className="btn quiet" onClick={() => setFilter({})}>
                Show everything
              </button>
            </p>
          )}
          {mode === "made" ? (
            <p className="lens-note">
              {entries.length} thing{entries.length === 1 ? "" : "s"} across{" "}
              {countWhere(entries)} — {LENS_REFUSAL}.
            </p>
          ) : (
            /* The count says whether they were busy; "mostly" says doing what,
               which is the question actually asked of an agent nobody watched. */
            <p className="lens-note">
              {shape.acts} act{shape.acts === 1 ? "" : "s"} across {shape.canvases} canvas
              {shape.canvases === 1 ? "" : "es"}
              {shape.mostly ? `, mostly ${opWords(shape.mostly) ?? shape.mostly}` : ""} — including
              work that no longer exists.
            </p>
          )}
          {mode === "did" && (
            <>
              {logs === null && <p className="canvas-none">Reading every log…</p>}
              {logs !== null && acts.length === 0 && (
                <p className="canvas-none">Nothing recorded for {labels.get(subject.id)}.</p>
              )}
              {acts.length > 0 && (
                <div className="lens-rows">
                  {acts.slice(0, 200).map((act, i) => (
                    <span className="lens-act" key={`${act.ts}-${act.canvasId}-${i}`}>
                      <span className="lens-act-what">
                        {opWords(act.op) ?? act.op}
                      </span>
                      <Link className="lens-act-where" to={canvasPath(act.canvasId)}>
                        {act.canvasTitle}
                      </Link>
                      <span className="lens-when">{ago(act.ts, nowMs)}</span>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
          {mode === "made" && groups.map((group) => (
            <section key={group.key} className="lens-group">
              {/* A title is whatever somebody typed, and this view renders
                  data it did not author — from canvases it has never opened,
                  named by people and agents it has never met. Nothing bounds
                  the length, so the heading bounds it here and keeps the whole
                  string on `title` where it costs nothing. */}
              <h2 title={group.label}>
                {/* Grouped by canvas, `group.key` IS the canvas id — so the
                    dot is only meaningful in that arrangement. "By day" has
                    no room to be in. */}
                {by === "canvas" && live.here.has(group.key) && (
                  <span className="lens-live-dot" title="here now" />
                )}
                {by === "canvas" && live.available.has(group.key) && (
                  <span className="lens-live-dot standby" title="standing by" />
                )}
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
