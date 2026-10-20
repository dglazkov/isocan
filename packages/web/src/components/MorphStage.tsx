import { useEffect, useMemo, useRef, useState } from "react";
import {
  deckStep,
  deckTransitionOf,
  itemPath,
  morphPlan,
  sceneFromMessage,
  visualFaceOf,
  type Item,
  type MorphScene,
} from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { readBlobText } from "../lib/api.ts";
import { DECK_TRANSITION_MS, setMorphPlayer, useTransitionsOn } from "../lib/deckflip.ts";
import { morphTwin } from "../lib/morphruntime.ts";

/** The HTML a slide shows, when it is a screen — the morph's raw material. */
function screenHash(item: Item | null | undefined): string | null {
  if (!item) return null;
  const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
  if (!current) return null;
  const face = visualFaceOf(current, item.properties.face);
  return face.mimeType === "text/html" ? face.blobHash : null;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * **The morph's stage: twins of the slides either side, ready before the
 * arrow is pressed.**
 *
 * The morph takes a slide apart into its pieces (`@isocan/core`'s
 * `morph.ts`), and the live slide is a sandboxed frame nobody outside it may
 * touch. So while the deck is set to morph, this stage keeps a TWIN of the
 * slide on screen and of the slides either side: the same HTML, loaded with
 * a small runtime (`morphruntime.ts`) under the same lone `allow-scripts`
 * sandbox, laid out at exactly the live frame's size and kept invisible.
 * Each twin reports its pieces once its fonts are in.
 *
 * When `flipTo` asks (`setMorphPlayer`), the stage answers whether both
 * twins of this flip are ready. If they are, it ARMS each with its half of
 * `morphPlan` and shows them over the live slide with nothing behind: the
 * twin being left is armed at its first frame, which is the live slide
 * itself, and the arriving one at nothing at all, so this beat is invisible
 * whatever the browser has painted yet. When both say they are armed it
 * lets them run, puts the ground behind them, tilts the two frames together
 * and only then moves to the next slide — underneath, where the pool
 * promotes it. At the end the arriving twin is at rest and pixel-for-pixel
 * that live slide, so the stage simply stops covering it. Not ready, and the
 * answer is no: the flip fades, because a presenter's arrow never waits.
 *
 * Renders nothing and loads nothing unless the canvas chose `morph`.
 */
export function MorphStage({ canvasId, itemId }: { canvasId: string; itemId: string }) {
  const canvas = useCanvasStore((s) => s.canvas);
  // Behind Presentation Transitions (`lib/deckflip.ts`): off, no twin mounts.
  const transitionsOn = useTransitionsOn();
  const morphing = useCanvasStore((s) => deckTransitionOf(s.record ?? {}) === "morph") && transitionsOn;
  const still = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const active = morphing && !still;

  /** This slide and its neighbours, as far as they are screens. */
  const slides = useMemo(() => {
    if (!active || !canvas) return [];
    const here = canvas.items[itemId];
    const seen = new Set<string>();
    return [here, deckStep(canvas, itemId, 1), deckStep(canvas, itemId, -1)]
      .map((item) => (item ? { itemId: item.id, hash: screenHash(item) } : null))
      .filter((one): one is { itemId: string; hash: string } => {
        if (!one?.hash || seen.has(one.hash)) return false;
        seen.add(one.hash);
        return true;
      });
  }, [active, canvas, itemId]);

  const [html, setHtml] = useState<Record<string, string>>({});
  const [scenes, setScenes] = useState<Record<string, MorphScene>>({});
  const [box, setBox] = useState<Box | null>(null);
  const [playing, setPlaying] = useState<{ from: string; to: string; armed: boolean } | null>(null);
  const armedBy = useRef(new Set<string>());
  const onArmed = useRef<(hash: string) => void>(() => {});
  const frames = useRef(new Map<string, HTMLIFrameElement>());

  // The words of each slide, fetched once per blob — a blob never changes.
  const want = slides.map((s) => s.hash).join(" ");
  useEffect(() => {
    if (!want) return;
    let live = true;
    for (const hash of want.split(" ")) {
      if (html[hash] !== undefined) continue;
      readBlobText(canvasId, hash)
        .then((text) => live && setHtml((was) => (was[hash] !== undefined ? was : { ...was, [hash]: morphTwin(text) })))
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [want, canvasId, html]);

  /**
   * **The twins lay out at the live frame's size, or the pieces they report
   * are somewhere else.** The live frame is the pool's stack under full
   * screen's stage; its box is read, and read again whenever it changes.
   */
  useEffect(() => {
    if (!active) return;
    let observed: Element | null = null;
    const measure = () => {
      const el = document.querySelector(".fullscreen-stage .html-view-stack");
      if (el && el !== observed) {
        resize.disconnect();
        resize.observe(el);
        observed = el;
      }
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      setBox((was) =>
        was && was.left === r.left && was.top === r.top && was.width === r.width && was.height === r.height
          ? was
          : { left: r.left, top: r.top, width: r.width, height: r.height },
      );
    };
    const resize = new ResizeObserver(measure);
    measure();
    const poll = window.setInterval(measure, 500);
    window.addEventListener("resize", measure);
    return () => {
      resize.disconnect();
      clearInterval(poll);
      window.removeEventListener("resize", measure);
    };
  }, [active, itemId]);

  // A twin's report of its pieces — from that twin's window and no other.
  useEffect(() => {
    if (!active) return;
    const hear = (e: MessageEvent) => {
      for (const [hash, frame] of frames.current) {
        if (frame.contentWindow !== e.source) continue;
        if ((e.data as { type?: unknown } | null)?.type === "isocan:morph:armed") return onArmed.current(hash);
        const scene = sceneFromMessage(e.data);
        if (scene) setScenes((was) => ({ ...was, [hash]: scene }));
        return;
      }
    };
    window.addEventListener("message", hear);
    return () => window.removeEventListener("message", hear);
  }, [active]);

  /**
   * **Every twin rests in the pose its next morph starts from**: the slide
   * on screen shown, its neighbours invisible (see the runtime's `pose`).
   * Sent whenever that changes and whenever a twin reports in, never while a
   * morph is playing — the runtime ignores it then anyway.
   */
  const current = slides.find((s) => s.itemId === itemId)?.hash;
  const readyKey = Object.keys(scenes).sort().join(" ");
  useEffect(() => {
    if (!active || playing) return;
    for (const [hash, frame] of frames.current) {
      frame.contentWindow?.postMessage({ type: "isocan:morph:pose", shown: hash === current }, "*");
    }
  }, [active, playing, current, readyKey]);

  // The answer `flipTo` asks for, from the freshest state there is.
  const latest = useRef({ slides, scenes, playing, itemId });
  latest.current = { slides, scenes, playing, itemId };
  useEffect(() => {
    if (!active) return;
    let sceneAnims: Animation[] = [];
    let done = 0;
    let giveUp = 0;
    const post = (hash: string, message: object) => frames.current.get(hash)?.contentWindow?.postMessage(message, "*");
    setMorphPlayer((path, dir, go) => {
      const now = latest.current;
      const from = now.slides.find((s) => s.itemId === now.itemId)?.hash;
      const to = now.slides.find((s) => itemPath(canvasId, s.itemId) === path)?.hash;
      if (!from || !to || from === to || now.playing) return false;
      const a = now.scenes[from];
      const b = now.scenes[to];
      const out = frames.current.get(from);
      const into = frames.current.get(to);
      if (!a || !b || !out?.contentWindow || !into?.contentWindow) return false;
      const plan = morphPlan(a, b, dir);
      const ms = DECK_TRANSITION_MS.morph;
      armedBy.current = new Set();
      let started = false;
      const start = () => {
        if (started) return;
        started = true;
        clearTimeout(giveUp);
        post(from, { type: "isocan:morph:play" });
        post(to, { type: "isocan:morph:play" });
        // The two frames tilt as one.
        sceneAnims = [out, into].map((frame) => frame.animate(plan.scene, { duration: ms, fill: "both", easing: "linear" }));
        setPlaying({ from, to, armed: true });
        document.documentElement.dataset.morph = "playing";
        go();
        clearTimeout(done);
        done = window.setTimeout(() => {
          document.documentElement.dataset.morph = "ready";
          setPlaying(null);
          requestAnimationFrame(() => {
            sceneAnims.forEach((anim) => anim.cancel());
            sceneAnims = [];
            // Each ends in the pose it rests in from now on: the slide that
            // arrived shown, the one left behind invisible.
            post(from, { type: "isocan:morph:reset" });
            post(to, { type: "isocan:morph:reset" });
            post(from, { type: "isocan:morph:pose", shown: false });
            post(to, { type: "isocan:morph:pose", shown: true });
          });
        }, ms);
      };
      // Armed means painted: the twin being left now shows exactly the live
      // slide above it, and the arriving one shows nothing.
      onArmed.current = (hash) => {
        armedBy.current.add(hash);
        if (armedBy.current.has(from) && armedBy.current.has(to)) start();
      };
      // A twin that never answers must not hold the deck: past this, the
      // flip happens anyway — a cut, which is better than a stuck arrow.
      giveUp = window.setTimeout(() => {
        if (started) return;
        started = true;
        post(from, { type: "isocan:morph:reset" });
        post(to, { type: "isocan:morph:reset" });
        setPlaying(null);
        go();
      }, 900);
      post(from, { type: "isocan:morph:arm", side: plan.out, ms });
      post(to, { type: "isocan:morph:arm", side: plan.in, ms });
      setPlaying({ from, to, armed: false });
      return true;
    });
    document.documentElement.dataset.morph = "ready";
    return () => {
      delete document.documentElement.dataset.morph;
      setMorphPlayer(null);
      clearTimeout(done);
      clearTimeout(giveUp);
      sceneAnims.forEach((anim) => anim.cancel());
    };
  }, [active, canvasId]);

  /**
   * **Append-only, as the frame pool is** (`HtmlView`). Moving a mounted
   * iframe to a new place among its siblings re-inserts it, which reloads it:
   * the neighbours change order on every flip, and the reloading twin was a
   * blank stage at the start of the morph (measured 19 Oct). So a twin keeps
   * its place for as long as it is wanted; new ones join the end.
   */
  const wanted = new Set([...slides.map((s) => s.hash), ...(playing ? [playing.from, playing.to] : [])]);
  const order = useRef<string[]>([]);
  order.current = [...order.current.filter((hash) => wanted.has(hash)), ...[...wanted].filter((hash) => !order.current.includes(hash))];
  const mounted = order.current;
  if (!active || !box) return null;

  // Held at the slide being left until the morph ends: the order of the
  // twins must not change while they are on screen (see presentation.css).
  const lowest = playing ? playing.from : slides.find((s) => s.itemId === itemId)?.hash;
  return (
    <div
      className="morph-stage"
      data-playing={playing?.armed ? "" : undefined}
      aria-hidden
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    >
      {mounted.map((hash) =>
        html[hash] === undefined ? null : (
          <iframe
            key={hash}
            ref={(el) => {
              if (el) frames.current.set(hash, el);
              else frames.current.delete(hash);
            }}
            className="morph-frame"
            data-role={playing?.from === hash ? "out" : playing?.to === hash ? "in" : undefined}
            data-current={hash === lowest ? "" : undefined}
            data-ready={scenes[hash] ? "" : undefined}
            // The same lone allow-scripts every item frame gets: an opaque
            // origin with no cookie, no API and no storage. A twin is the
            // slide's own HTML plus the runtime, local by construction —
            // the draft preview's posture (`ArtifactStage`).
            sandbox="allow-scripts"
            srcDoc={html[hash]}
            tabIndex={-1}
            title=""
          />
        ),
      )}
    </div>
  );
}
