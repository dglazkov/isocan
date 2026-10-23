import "../assets/styles.css";
import { useEffect, useRef, useState } from "react";
import {
  mainThread,
  motionRenderUrl,
  newCommentId,
  newThreadId,
  type CanvasContents,
  type DialogFacts,
  type DialogHost,
  type Item,
  type ItemVersion,
  type ModuleAction,
  type ModuleMenuFacts,
  type ModuleMenuRow,
  type NewComment,
  type Operation,
  type WebModule,
} from "@isocan/core";
import {
  addMotionItem,
  addMotionMovie,
  buildMotion,
  MOTION_PROPS,
  MOTION_RECIPES,
  motionAsk,
  motionDocumentSpec,
  motionLayerSources,
  motionStale,
  motionStaleLine,
  rebuildMotion,
  versionMotionItem,
  type MotionBuild,
  type MotionRecipeName,
  type MotionSource,
  type MotionWriter,
} from "@isocan/core/motion";
import { MOTION_RENDER_CAPS, motionRenderPlan, type MotionRenderedFrom } from "@isocan/core/motion-render";
import { motionModule } from "./core.ts";

/**
 * **Motion in the browser** (motion phase 2; `docs/projects/motion/design.md`
 * §2–§5) — the web's doors, fetched only once the `motion` experiment is on
 * (`packages/web/src/modules.ts`): nothing here is in a first visit.
 *
 * - **Animate…** on a selection of SVG items (their menu, and ⌘K): a recipe
 *   builds the motion HERE, with core's `buildMotion` — the builder `isocan
 *   motion new` runs, its SVG parsers fetched as their own chunk when a
 *   motion is first built — and core's `addMotionItem` writes it. Words go
 *   to the canvas's lead as an ordinary summons in the Chat (`motionAsk`),
 *   which an agent answers with `isocan motion new … --spec`. With nobody
 *   parked, one sentence and nothing is sent.
 * - **Refresh from sources** on a motion whose source has a newer version:
 *   `rebuildMotion` and one `item.edit`, as `isocan motion refresh` does.
 * - **Render movie…**: the render page `isocan motion render` drives, in a
 *   one-pixel frame of this page, polled through `window.isocanMotionRender`;
 *   then `addMotionMovie`, the CLI's own write.
 *
 * The scrubber lives in the motion document itself, and a comment's `at`
 * reaches it through the shell's frame (`ItemView`); neither is here.
 */

const said = (err: unknown) => (err instanceof Error ? err.message : String(err));

const current = (item: Item): ItemVersion | undefined => item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[item.versions.length - 1];

const isSvg = (item: Item | undefined): item is Item => {
  const v = item ? current(item) : undefined;
  return v !== undefined && (v.mimeType === "image/svg+xml" || /\.svg$/i.test(v.filename));
};

const isMotion = (item: Item | undefined): item is Item => item?.properties[MOTION_PROPS.motion] === "true";

/** The selected SVG items, back to front as the canvas stacks them — `motion new`'s order. */
function svgsOf(canvas: CanvasContents, ids: readonly string[]): Item[] {
  const order = Object.keys(canvas.items);
  return [...new Set(ids)].map((id) => canvas.items[id]).filter(isSvg).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

/** The ids a dialog is about: the words it opened with, else the selection. */
const idsOf = (args: string, selection: readonly string[]) => (args.trim() ? args.trim().split(/\s+/) : [...selection]);

/** This browser's two hands, as core's writes want them. */
function writer(host: DialogHost): MotionWriter {
  return {
    upload: (bytes, mimeType, filename) => host.putBlob(new Blob([bytes as BlobPart], { type: mimeType }), filename),
    send: (op, group) => host.send([op], group),
  };
}

/** Say something in the Chat; the thread is born if this is the first word. */
async function inChat(host: DialogHost, comment: NewComment): Promise<void> {
  const main = mainThread(host.getCanvas());
  await host.send([
    main
      ? ({ type: "thread.reply", threadId: main.id, comment } as Operation)
      : ({ type: "thread.create", threadId: newThreadId(), x: 0, y: 0, anchorItemId: null, main: true, comment } as Operation),
  ]);
}

/** What the builder found worth saying: what it stripped, and the first broken principle. */
function builtWords(built: MotionBuild): string | null {
  const parts = [
    ...built.stripped.map((s) => `stripped from ${s.title}: ${s.what.join(", ")}`),
    ...built.warnings.slice(0, 1).map((w) => w.message),
  ];
  return parts.length ? parts.join(" · ") : null;
}

/* ---- Animate… ------------------------------------------------------------ */

const RECIPE_WORDS: Record<MotionRecipeName, string> = {
  assemble: "line drawings draw on, named parts grow up from their base, the rest settles in last — plays once",
  idle: "named parts sway a few degrees on their base, the rest breathes — loops",
};

/**
 * **Animate…** — `isocan motion new <svg…> --recipe` from the browser, or the
 * words, asked of the lead. The two are one dialog because they are one ask:
 * how should these move.
 */
function AnimateDialog({ args, selection, canvas, rcParked, canEdit, host }: DialogFacts) {
  const svgs = svgsOf(canvas, idsOf(args, selection));
  const [recipe, setRecipe] = useState<MotionRecipeName>("assemble");
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState<"recipe" | "words" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [lead, setLead] = useState<{ lead: { id: string; name: string } | null; cannot: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    if (!host.lead) setLead({ lead: null, cannot: "this app cannot say who leads here" });
    else host.lead().then((l) => { if (live) setLead(l); }, (err) => { if (live) setLead({ lead: null, cannot: said(err) }); });
    return () => { live = false; };
  }, [host]);

  if (svgs.length === 0) return <p className="motion-problem">Select one or more SVG items to animate — a motion moves SVG drawings.</p>;
  const names = svgs.map((s) => s.title || "Untitled").join(", ");

  const animate = async () => {
    setBusy("recipe");
    setProblem(null);
    try {
      const now = host.getCanvas();
      const sources: MotionSource[] = [];
      for (const s of svgs) {
        const item = now.items[s.id] ?? s;
        const version = current(item)!;
        sources.push({ item: item.id, version: version.id, title: item.title, box: { x: item.x, y: item.y, width: item.width, height: item.height }, svg: await host.readText(version.blobHash) });
      }
      const built = await buildMotion({ sources, recipe });
      const title = `${svgs.map((s) => s.title).join(" + ")} — ${recipe}`;
      const { itemId } = await addMotionItem(writer(host), built, title);
      host.notice(builtWords(built) ?? `${title}: ${built.spec.seconds} s, ${built.spec.loop ? "loops" : "plays once"}`, built.warnings.length > 0);
      host.reveal([itemId]);
      host.close();
    } catch (err) {
      setProblem(said(err));
    } finally {
      setBusy(null);
    }
  };

  const ask = async () => {
    const who = lead?.lead;
    if (!who || !words.trim()) return;
    setBusy("words");
    setProblem(null);
    try {
      await inChat(host, { id: newCommentId(), body: motionAsk(who, svgs, words), mentions: [who.id], items: svgs.map((s) => s.id) });
      host.notice(`Asked ${who.name} to animate ${names} — the motion lands beside them`);
      host.close();
    } catch (err) {
      setProblem(said(err));
    } finally {
      setBusy(null);
    }
  };

  const nobody = !rcParked
    ? "Nobody’s agent is parked on this canvas — start isocan rc there to ask in words. Nothing was sent."
    : lead && (!lead.lead || lead.cannot) ? `Nothing can animate from words here: ${lead.cannot ?? "no agent leads this canvas"}. Nothing was sent.` : null;

  return (
    <div className="motion-dialog" data-motion-animate>
      <p className="motion-note">Moving <b>{names}</b> — laid out as they are on the canvas. The motion lands beside them.</p>
      {!canEdit && <p className="motion-note">You are reading this canvas — a motion is added by somebody who can edit it.</p>}
      <section aria-labelledby="motion-recipes">
        <h3 id="motion-recipes">A recipe</h3>
        <fieldset className="motion-pick">
          <legend className="motion-note">No model — a good default</legend>
          {MOTION_RECIPES.map((r) => (
            <label key={r} className="motion-row">
              <input type="radio" name="motion-recipe" value={r} checked={recipe === r} onChange={() => setRecipe(r)} disabled={!canEdit} />
              <span><b>{r}</b><small>{RECIPE_WORDS[r]}</small></span>
            </label>
          ))}
        </fieldset>
        <div className="motion-actions">
          <button type="button" className="btn primary" data-motion-recipe-go disabled={!canEdit || busy !== null} onClick={() => void animate()}>
            {busy === "recipe" ? "Animating…" : `Animate with ${recipe}`}
          </button>
        </div>
      </section>
      <section aria-labelledby="motion-say">
        <h3 id="motion-say">Or say how it moves</h3>
        <label className="motion-words">
          Words for {lead?.lead && !lead.cannot ? lead.lead.name : "the agent"}, who writes the motion
          <textarea value={words} onChange={(e) => setWords(e.target.value)} rows={3} disabled={!canEdit || nobody !== null}
            placeholder="the circle draws on, the wheat grows up from its base, the wordmark settles in last" />
        </label>
        {nobody && <p className="motion-problem" role="status">{nobody}</p>}
        <div className="motion-actions">
          <button type="button" className="btn" data-motion-ask disabled={!canEdit || nobody !== null || !lead?.lead || !words.trim() || busy !== null} onClick={() => void ask()}>
            {busy === "words" ? "Asking…" : lead?.lead && !lead.cannot ? `Ask ${lead.lead.name}` : "Ask"}
          </button>
        </div>
      </section>
      {problem && <p className="motion-problem" role="alert">{problem}</p>}
      <div className="motion-actions">
        <button type="button" className="btn" onClick={host.close}>Cancel</button>
      </div>
    </div>
  );
}

/* ---- Refresh from sources ------------------------------------------------ */

/** **Refresh from sources** — `isocan motion refresh`: each source's current version, moving the same way. */
function RefreshDialog({ args, selection, canvas, canEdit, host }: DialogFacts) {
  const motion = canvas.items[idsOf(args, selection)[0] ?? ""];
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!isMotion(motion)) return <p className="motion-problem">That is not a motion — refresh is for a motion made from SVGs.</p>;
  const stale = motionStale(canvas, motion);
  const line = motionStaleLine(stale);
  const refresh = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const now = host.getCanvas();
      const item = now.items[motion.id] ?? motion;
      const spec = motionDocumentSpec(await host.readText(current(item)!.blobHash));
      if (!spec) throw new Error(`${item.title}'s current version carries no motion spec`);
      const sources: MotionSource[] = [];
      for (const s of motionLayerSources(spec, now, "current")) {
        sources.push({ item: s.item.id, version: s.version.id, title: s.title, box: s.box, svg: await host.readText(s.version.blobHash) });
      }
      const built = await rebuildMotion(spec, sources, item.title);
      await versionMotionItem(writer(host), item, built);
      host.notice(builtWords(built) ?? `${item.title}: a new version from ${stale.map((s) => s.title).join(", ")}`, built.warnings.length > 0);
      host.close();
    } catch (err) {
      setProblem(said(err));
      setBusy(false);
    }
  };
  return (
    <div className="motion-dialog">
      <p className="motion-note">{line ? `${line} than ${motion.title} was made from.` : `Every source of ${motion.title} is at the version it took.`} A refresh makes a new version that moves the same way; the old one stays in its versions.</p>
      {problem && <p className="motion-problem" role="alert">{problem}</p>}
      <div className="motion-actions">
        <button type="button" className="btn" onClick={host.close}>Cancel</button>
        <button type="button" className="btn primary" disabled={!canEdit || !line || busy} onClick={() => void refresh()}>{busy ? "Refreshing…" : "Refresh"}</button>
      </div>
    </div>
  );
}

/* ---- Render movie… --------------------------------------------------------- */

/** What the render page says on `window` (`MotionRenderPage`). */
interface RenderSurface {
  status: { state: "loading" | "rendering" | "done" | "error"; frame: number; frames: number; error: string | null; renderedFrom: MotionRenderedFrom | null };
  size: number;
  chunk: (offset: number, length: number) => string;
}

const SIZES = [
  { value: "1080", label: "1080 × 1080" },
  { value: "1920x1080", label: "1920 × 1080" },
  { value: "1080x1920", label: "1080 × 1920" },
  { value: "720", label: "720 × 720" },
];

/** The MP4 off the render page, a slice at a time. */
function bytesOf(surface: RenderSurface): Uint8Array {
  const out = new Uint8Array(surface.size);
  const step = 4 << 20;
  for (let o = 0; o < surface.size; o += step) {
    const bin = atob(surface.chunk(o, step));
    for (let i = 0; i < bin.length; i++) out[o + i] = bin.charCodeAt(i);
  }
  return out;
}

/**
 * **Render movie…** — `isocan motion render` from the browser, through the
 * same page: opened at one pixel in this tab, polled until it says done, and
 * its MP4 added beside the motion by `addMotionMovie`. Closing the dialog
 * stops the render with it.
 */
function RenderDialog({ args, selection, canvasId, canvas, canEdit, host }: DialogFacts) {
  const motion = canvas.items[idsOf(args, selection)[0] ?? ""];
  const length = Number(motion?.properties[MOTION_PROPS.seconds]);
  const [fps, setFps] = useState("60");
  const [size, setSize] = useState("1080");
  const [seconds, setSeconds] = useState(Number.isFinite(length) && length > 0 ? String(length) : "6");
  const [progress, setProgress] = useState<{ frame: number; frames: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => () => { frame.current?.remove(); frame.current = null; }, []);
  if (!isMotion(motion)) return <p className="motion-problem">That is not a motion — a movie is recorded from a motion.</p>;

  const stop = () => {
    frame.current?.remove();
    frame.current = null;
  };
  const go = async () => {
    setProblem(null);
    try {
      const item = host.getCanvas().items[motion.id] ?? motion;
      const plan = motionRenderPlan({ fps, size, seconds }, { seconds: Number.isFinite(length) && length > 0 ? length : MOTION_RENDER_CAPS.seconds, loop: item.properties[MOTION_PROPS.loop] === "true" });
      setProgress({ frame: 0, frames: plan.frames });
      const f = document.createElement("iframe");
      f.className = "motion-render-frame";
      f.title = `Rendering ${item.title}`;
      f.setAttribute("aria-hidden", "true");
      f.tabIndex = -1;
      f.src = motionRenderUrl(location.origin, canvasId, item.id, { version: item.currentVersionId, fps: plan.fps, size: `${plan.width}x${plan.height}`, seconds: plan.seconds, background: plan.background });
      document.body.appendChild(f);
      frame.current = f;
      const surface = await new Promise<RenderSurface>((resolve, reject) => {
        const tick = () => {
          if (frame.current !== f) return reject(new Error("stopped"));
          const s = (f.contentWindow as (Window & { isocanMotionRender?: RenderSurface }) | null)?.isocanMotionRender;
          if (s?.status.state === "done") return resolve(s);
          if (s?.status.state === "error") return reject(new Error(s.status.error ?? "the render page stopped"));
          if (s && s.status.frames > 0) setProgress({ frame: s.status.frame, frames: s.status.frames });
          setTimeout(tick, 250);
        };
        tick();
      });
      setProgress({ frame: surface.status.frames, frames: surface.status.frames });
      const bytes = bytesOf(surface);
      const renderedFrom = surface.status.renderedFrom!;
      stop();
      const { itemId, title } = await addMotionMovie(writer(host), host.getCanvas().items[motion.id] ?? item, bytes, renderedFrom);
      host.notice(`${title}: ${renderedFrom.size} at ${renderedFrom.fps} fps, ${renderedFrom.seconds} s`);
      host.reveal([itemId]);
      host.close();
    } catch (err) {
      stop();
      setProgress(null);
      if (said(err) !== "stopped") setProblem(said(err));
    }
  };
  const rendering = progress !== null;
  return (
    <div className="motion-dialog" data-motion-render>
      <p className="motion-note">Records <b>{motion.title}</b> to an MP4 beside it, frame by frame from the clock that plays it — the movie is the preview, recorded.</p>
      <div className="motion-fields">
        <label className="motion-field">Size
          <select value={size} onChange={(e) => setSize(e.target.value)} disabled={rendering}>
            {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="motion-field">Frames a second
          <input type="number" min={1} max={MOTION_RENDER_CAPS.fps} value={fps} onChange={(e) => setFps(e.target.value)} disabled={rendering} />
        </label>
        <label className="motion-field">Seconds
          <input type="number" min={0.1} max={MOTION_RENDER_CAPS.seconds} step={0.1} value={seconds} onChange={(e) => setSeconds(e.target.value)} disabled={rendering} />
        </label>
      </div>
      {progress && (
        <div role="status" aria-live="polite" data-motion-progress>
          <progress className="motion-progress" max={progress.frames} value={progress.frame} aria-label="Frames rendered" />
          <p className="motion-note">frame {progress.frame} of {progress.frames}</p>
        </div>
      )}
      {problem && <p className="motion-problem" role="alert">{problem}</p>}
      <div className="motion-actions">
        <button type="button" className="btn" onClick={() => { stop(); host.close(); }}>{rendering ? "Stop" : "Cancel"}</button>
        <button type="button" className="btn primary" data-motion-render-go disabled={!canEdit || rendering} onClick={() => void go()}>{rendering ? "Rendering…" : "Render MP4"}</button>
      </div>
    </div>
  );
}

/* ---- the doors ----------------------------------------------------------- */

/** An item's menu: *Animate…* on SVGs; *Render movie…* and, when a source moved on, *Refresh from sources* on a motion. */
function menu({ canvas, items, open }: ModuleMenuFacts): ModuleMenuRow[] {
  if (items.length > 0 && items.every(isSvg)) return [{ label: "Animate…", writes: true, run: () => open("motion-animate", items.map((i) => i.id).join(" ")) }];
  const [one] = items;
  if (items.length !== 1 || !isMotion(one)) return [];
  const line = motionStaleLine(motionStale(canvas, one));
  return [
    ...(line ? [{ label: `Refresh from sources — ${line}`, writes: true, run: () => open("motion-refresh", one.id) }] : []),
    { label: "Render movie…", writes: true, run: () => open("motion-render", one.id) },
  ];
}

const one = (canvas: CanvasContents, selection: readonly string[]) => (selection.length === 1 ? canvas.items[selection[0]!] : undefined);

const actions: ModuleAction[] = [
  {
    id: "motion.animate",
    name: "Animate…",
    hint: "make the selected SVGs move — a recipe, or words for your agent",
    available: ({ canvas, selection }) => selection.length > 0 && selection.every((id) => isSvg(canvas.items[id])),
    opens: "motion-animate",
  },
  {
    id: "motion.refresh",
    name: "Refresh from sources",
    hint: "a new version of this motion from its sources' newer versions",
    available: ({ canvas, selection }) => {
      const m = one(canvas, selection);
      return isMotion(m) && motionStale(canvas, m).length > 0;
    },
    opens: "motion-refresh",
  },
  {
    id: "motion.render",
    name: "Render movie…",
    hint: "record this motion to an MP4 beside it",
    available: ({ canvas, selection }) => isMotion(one(canvas, selection)),
    opens: "motion-render",
  },
];

/** The web half. */
export const motionWeb: WebModule<never, never, never, never, never, typeof AnimateDialog> = {
  core: motionModule,
  actions,
  dialogs: [
    { id: "motion-animate", title: "Animate", component: AnimateDialog },
    { id: "motion-refresh", title: "Refresh from sources", component: RefreshDialog },
    { id: "motion-render", title: "Render movie", component: RenderDialog },
  ],
  menu,
};

export default motionWeb;
