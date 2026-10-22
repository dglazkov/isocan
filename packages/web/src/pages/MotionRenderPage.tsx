import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { motionRenderRequest, renderMotion, type MotionRenderStatus } from "../lib/motion-render.ts";

/**
 * **`MOTION_RENDER_ROUTE` — a motion, recorded** (motion phase 1;
 * `docs/projects/motion/design.md` §4).
 *
 * One page both surfaces open, so the movie the terminal makes and the one
 * the web will make are made by the same code: `isocan motion render` opens
 * it in the headless browser `canvas shot` drives and reads the bytes off
 * `window`, and phase 2's *Render movie…* will open it in a hidden frame and
 * read the same. Lazy, because nobody's first visit is a render; and NOT
 * behind the `motion` experiment, because the CLI's browser has no settings
 * to switch one on. It reads with this browser's own badge, so it reaches
 * exactly what the person reaching it may read.
 *
 * **What a reader of `window` gets** — `window.isocanMotionRender`:
 * `status` (`state` loading | rendering | done | error, `frame` of `frames`,
 * `error` in words, the `plan`, the `codec`, and the `renderedFrom` record
 * the video item will wear), and once done `size`, `chunk(offset, length)`
 * (the MP4's bytes as base64, a slice at a time so no single answer is
 * tens of megabytes) and `kept` (the pre-encode PNGs asked for by `?keep=`).
 */

interface MotionRenderWindow {
  status: MotionRenderStatus;
  size: number;
  chunk: (offset: number, length: number) => string;
  kept: Record<number, string>;
}

declare global {
  interface Window {
    isocanMotionRender?: MotionRenderWindow;
  }
}

const base64 = (bytes: Uint8Array): string => {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
};

export function MotionRenderPage() {
  const { canvasId = "", itemId = "" } = useParams();
  const { search } = useLocation();
  const [status, setStatus] = useState<MotionRenderStatus | null>(null);

  useEffect(() => {
    let live = true;
    const stop = new AbortController();
    const surface: MotionRenderWindow = {
      status: { state: "loading", frame: 0, frames: 0, error: null, plan: null, codec: null, renderedFrom: null, title: null },
      size: 0,
      chunk: () => "",
      kept: {},
    };
    window.isocanMotionRender = surface;
    const show = (next: MotionRenderStatus) => {
      surface.status = next;
      if (live) setStatus(next);
    };
    renderMotion(motionRenderRequest(canvasId, itemId, search), show, stop.signal)
      .then(({ bytes, kept }) => {
        surface.size = bytes.length;
        surface.chunk = (offset, length) => base64(bytes.subarray(offset, offset + length));
        surface.kept = kept;
        show({ ...surface.status, state: "done" });
      })
      .catch((err: unknown) => !stop.signal.aborted && show({ ...surface.status, state: "error", error: err instanceof Error ? err.message : String(err) }));
    return () => {
      live = false;
      stop.abort();
    };
  }, [canvasId, itemId, search]);

  const title = status?.title ?? "a motion";
  return (
    <div className="page-note page-note-stack" role="status" aria-live="polite">
      {(!status || status.state === "loading") && <div>Reading {title}…</div>}
      {status?.state === "rendering" && (
        <div>
          Rendering {title}: frame {status.frame} of {status.frames}
        </div>
      )}
      {status?.state === "done" && (
        <div>
          Rendered {title}: {status.frames} frames, {status.plan?.width} × {status.plan?.height} at {status.plan?.fps} fps
        </div>
      )}
      {status?.state === "error" && <div>Could not render {title}: {status.error}</div>}
    </div>
  );
}
