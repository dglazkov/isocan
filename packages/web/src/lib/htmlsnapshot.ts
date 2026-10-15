import { useEffect, useState } from "react";
import { readBlobText } from "./api.ts";
import { useUiStore } from "../stores/uiStore.ts";

const MAX_CACHED_SNAPSHOTS = 120;
const MAX_CONCURRENT = 4;
const snapshotUrls = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

let activeTasks = 0;
const pendingQueue: Array<() => void> = [];
const calmWaiters = new Map<string, () => void>();

function runLimited<T>(fn: () => Promise<T>, eager = false): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      activeTasks++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          activeTasks--;
          const next = pendingQueue.shift();
          if (next) next();
        });
    };
    if (activeTasks < MAX_CONCURRENT) start();
    else if (eager) pendingQueue.unshift(start);
    else pendingQueue.push(start);
  });
}

function rememberSnapshot(key: string, url: string): void {
  const existing = snapshotUrls.get(key);
  if (existing) {
    if (existing !== url) URL.revokeObjectURL(existing);
    snapshotUrls.delete(key);
  }
  snapshotUrls.set(key, url);
  while (snapshotUrls.size > MAX_CACHED_SNAPSHOTS) {
    const oldest = snapshotUrls.keys().next().value;
    if (!oldest) break;
    const oldUrl = snapshotUrls.get(oldest);
    snapshotUrls.delete(oldest);
    if (oldUrl) URL.revokeObjectURL(oldUrl);
  }
}

function waitUntilCalm(blobHash: string, delayMs: number, eager: boolean): Promise<void> {
  if (eager) {
    return new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
  return new Promise((resolve) => {
    let settled = false;
    let unsub: (() => void) | undefined;
    const finish = () => {
      if (settled) return;
      settled = true;
      calmWaiters.delete(blobHash);
      unsub?.();
      resolve();
    };
    calmWaiters.set(blobHash, finish);
    const check = () => {
      if (settled) return;
      if (useUiStore.getState().panning) {
        unsub = useUiStore.subscribe((s, prev) => {
          if (!s.panning && prev.panning) {
            unsub?.();
            unsub = undefined;
            setTimeout(check, delayMs);
          }
        });
        return;
      }
      // The page can be gone by the time the delay ends (a test's DOM torn
      // down under a pending timer threw "window is not defined" in CI).
      if (typeof window === "undefined") return finish();
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => finish(), { timeout: 200 });
      } else {
        setTimeout(finish, 16);
      }
    };
    setTimeout(check, delayMs);
  });
}

/**
 * **The canvas zoom below which a screen's words cannot be read, so a still
 * picture may stand in for the live page.**
 *
 * The picture is NOT the page and cannot be made to be: it is drawn with the
 * page's scripts, linked stylesheets, frames and remote assets removed, and
 * with `body`/`html` rules matching nothing, so its type, its photos and even
 * its height can differ from what the frame shows (14 Oct 2026: a storefront
 * at rest showed an older-looking, shorter page with no photos). So it is
 * shown only where that difference cannot be read — a screen this far away —
 * and never as a screen at rest that a person can read.
 *
 * 0.3 from measurement (14 Oct 2026, a 2x display): at 0.37 a storefront's
 * 16–20px body text still reads as words; at 0.3 it is 9.6–12 device px, the
 * edge of that. And the 24-screen board the pan budget was measured on fits
 * on screen only below it, so that board keeps its pictures. Above the line,
 * `node scripts/frames.mjs --html 24 --scale 0.3 --dpr 2 --cross-site` (20
 * live frames on screen) panned at p90 16.7 ms, p99 16.8, none over 32 ms.
 */
export const PICTURE_BELOW_SCALE = 0.3;
/** A live frame stays until the zoom falls this far under the line, so a zoom
 *  resting on the line does not swap the page for its picture and back. */
const PICTURE_HYSTERESIS = 0.85;

/** Where the camera's zoom is against the line: 2 readable, 0 not, 1 the band between. */
export function readabilityBand(scale: number): 0 | 1 | 2 {
  return scale >= PICTURE_BELOW_SCALE ? 2 : scale >= PICTURE_BELOW_SCALE * PICTURE_HYSTERESIS ? 1 : 0;
}

/**
 * **Which surface an HTML screen shows: the live page, or its picture.**
 *
 * The live page whenever a person could read it or use it: entered, a deck's
 * warm slides, anywhere but the canvas (`picture` false — full screen, the
 * stage, the viewer, thumbnails), before a picture exists, and at any zoom a
 * person can read (`readabilityBand`). The picture only for a screen too
 * small on screen to read — where the 24-screen board's pan budget came from.
 *
 * Two holds keep the swap from being seen or paid for at the wrong moment: a
 * live frame stays through the band between (hysteresis), and a frame that
 * is NOT live yet is not started while the camera is moving — the same rule
 * `useOnScreen` keeps for new mounts — so zooming in past the line mounts it
 * once, when the gesture settles.
 */
export function showsLiveFrame(at: {
  picture: boolean;
  entered: boolean;
  warm: number;
  pictureReady: boolean;
  band: 0 | 1 | 2;
  panning: boolean;
  wasLive: boolean;
}): boolean {
  if (!at.picture || at.entered || at.warm > 0 || !at.pictureReady) return true;
  if (at.band === 0) return false;
  if (at.wasLive) return true;
  return at.band === 2 && !at.panning;
}

/** The picture's stand-ins for `<html>` and `<body>`: inside an SVG's
 *  foreignObject the document is two `div`s, so rules the page wrote for
 *  `html`, `:root` and `body` are pointed at these instead — a slide's
 *  background is usually on one of them. */
const SNAP_ROOT = "isocan-snap-root";
const SNAP_BODY = "isocan-snap-body";

/**
 * A picture is one instant, and the instant it is drawn at is the first: an
 * entrance animation (`opacity: 0` → 1, `forwards`) would be drawn before it
 * starts, which is a slide with its words missing (Dion, 14 Oct 2026: a deck
 * whose title and card fade in drew as its background alone). So every
 * animation is drawn as it ends and every transition as already done. A page
 * that reveals itself from a script still draws unrevealed; nothing here runs
 * scripts.
 */
const SETTLED_CSS = `.${SNAP_ROOT}, .${SNAP_ROOT} *, .${SNAP_ROOT} *::before, .${SNAP_ROOT} *::after {
  animation-delay: 0s !important; animation-duration: 0s !important;
  animation-iteration-count: 1 !important; animation-fill-mode: forwards !important;
  transition: none !important;
}`;

/** A page's CSS with its `html` / `:root` / `body` selectors aimed at the picture's stand-ins. Only selectors change — declarations and at-rule preludes are left as written. */
function asPictureCss(css: string): string {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let out = "";
  let at = 0;
  for (const match of text.matchAll(/[{}]/g)) {
    const end = match.index;
    const chunk = text.slice(at, end);
    if (match[0] === "{") {
      // The text since the last brace is a prelude only if it does not hold a
      // declaration's `;` — inside a block that does, the prelude follows it.
      const cut = chunk.lastIndexOf(";") + 1;
      const head = chunk.slice(0, cut);
      const prelude = chunk.slice(cut);
      out += head + (prelude.trim().startsWith("@") ? prelude : retarget(prelude)) + "{";
    } else {
      out += chunk + "}";
    }
    at = end + 1;
  }
  return out + text.slice(at);
}

function retarget(selector: string): string {
  return selector
    .replace(/:root(?![-\w])/g, `.${SNAP_ROOT}`)
    .replace(/(?<![-\w.#:])html(?![-\w])/g, `.${SNAP_ROOT}`)
    .replace(/(?<![-\w.#:])body(?![-\w])/g, `.${SNAP_BODY}`);
}

/** An HTML document as a still SVG picture: scripts, frames, linked stylesheets and remote `url(…)` references removed, so drawing it fetches and runs nothing. */
export function sanitizeDocumentToSvg(html: string, width: number, height: number): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const el of doc.querySelectorAll("script, noscript, iframe, object, embed, link[rel='stylesheet']")) {
    el.remove();
  }
  for (const style of doc.querySelectorAll("style")) {
    if (style.textContent) {
      style.textContent = style.textContent.replace(/url\(\s*['"]?https?:[^)]+\)/gi, "none");
    }
  }
  for (const el of doc.querySelectorAll("*")) {
    const inlineStyle = el.getAttribute("style");
    if (inlineStyle && /url\(\s*['"]?https?:/i.test(inlineStyle)) {
      el.setAttribute("style", inlineStyle.replace(/url\(\s*['"]?https?:[^)]+\)/gi, "none"));
    }
    if (el instanceof HTMLImageElement) {
      const src = el.getAttribute("src") ?? "";
      if (src && !src.startsWith("data:")) el.removeAttribute("src");
    }
  }

  const xhtml = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
  xhtml.setAttribute("class", SNAP_ROOT);
  xhtml.setAttribute(
    "style",
    `width:${width}px;height:${height}px;overflow:hidden;position:relative;box-sizing:border-box;`,
  );
  // White only where the page says nothing: first, so the page's own `html`
  // rule (rewritten below) comes later and wins. Inline, it would beat it.
  const ground = doc.createElement("style");
  ground.textContent = `.${SNAP_ROOT}{background:#ffffff}`;
  xhtml.appendChild(ground);
  for (const style of doc.querySelectorAll("style")) {
    const copy = style.cloneNode(true) as HTMLStyleElement;
    copy.textContent = asPictureCss(style.textContent ?? "");
    xhtml.appendChild(copy);
  }
  const settled = doc.createElement("style");
  settled.textContent = SETTLED_CSS;
  xhtml.appendChild(settled);
  const bodyWrap = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
  for (const attr of doc.body.attributes) {
    if (attr.name === "class" || attr.name === "style" || attr.name.startsWith("data-")) {
      bodyWrap.setAttribute(attr.name, attr.value);
    }
  }
  bodyWrap.setAttribute("class", `${bodyWrap.getAttribute("class") ?? ""} ${SNAP_BODY}`.trim());
  bodyWrap.innerHTML = doc.body.innerHTML;
  for (const style of bodyWrap.querySelectorAll("style")) style.remove();
  xhtml.appendChild(bodyWrap);

  const serializer = new XMLSerializer();
  const serializedBody = serializer.serializeToString(xhtml);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${serializedBody}</foreignObject></svg>`;
}

async function renderHtmlBlobSnapshot(
  canvasId: string,
  blobHash: string,
  width: number,
  height: number,
  eager = false,
): Promise<string | null> {
  const cached = snapshotUrls.get(blobHash);
  if (cached) return cached;
  const existing = inflight.get(blobHash);
  if (existing) {
    if (eager) calmWaiters.get(blobHash)?.();
    return existing;
  }

  const task = (async () => {
    await waitUntilCalm(blobHash, 16, eager);
    return runLimited(async () => {
      try {
        const html = await readBlobText(canvasId, blobHash);
        const w = Math.max(160, Math.round(width) || 880);
        const h = Math.max(120, Math.round(height) || 640);
        const targetW = Math.min(w, 960);
        const targetH = Math.max(120, Math.round(h * (targetW / w)));

        const svg = sanitizeDocumentToSvg(html, w, h);
        const svgImg = new Image();
        svgImg.decoding = "async";
        svgImg.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        await svgImg.decode();

        let objectUrl: string | null = null;
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(svgImg, 0, 0, targetW, targetH);
          const webp = await new Promise<Blob | null>((resolve) => {
            try {
              canvas.toBlob(resolve, "image/webp", 0.86);
            } catch {
              resolve(null);
            }
          });
          if (webp) objectUrl = URL.createObjectURL(webp);
        }
        if (!objectUrl) {
          objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
        }
        const warm = new Image();
        warm.decoding = "async";
        warm.src = objectUrl;
        await warm.decode().catch(() => {});
        rememberSnapshot(blobHash, objectUrl);
        return objectUrl;
      } catch {
        return null;
      } finally {
        calmWaiters.delete(blobHash);
        inflight.delete(blobHash);
      }
    }, eager);
  })();

  inflight.set(blobHash, task);
  return task;
}

/**
 * Eagerly warm the WebP raster snapshot for an upcoming HTML screen along the
 * camera's directional lookahead vector, bypassing the pan-settle pause so the
 * proxy image is already decoded when the card crosses into the viewport.
 */
export function warmHtmlSnapshot(
  canvasId: string,
  blobHash: string,
  width: number,
  height: number,
): Promise<string | null> {
  return renderHtmlBlobSnapshot(canvasId, blobHash, width, height, true);
}

/** The cached still picture of an HTML item's blob, as an object URL — null until it has rendered, or while `enabled` is false. */
export function useHtmlSnapshot(
  canvasId: string,
  blobHash: string,
  width: number,
  height: number,
  enabled: boolean,
  eager = false,
): string | null {
  const [url, setUrl] = useState<string | null>(() => snapshotUrls.get(blobHash) ?? null);

  useEffect(() => {
    const hit = snapshotUrls.get(blobHash);
    if (hit) {
      setUrl(hit);
      return;
    }
    setUrl(null);
    if (!enabled) return;
    let alive = true;
    void renderHtmlBlobSnapshot(canvasId, blobHash, width, height, eager).then((got) => {
      if (alive && got) setUrl(got);
    });
    return () => {
      alive = false;
    };
  }, [canvasId, blobHash, width, height, enabled, eager]);

  return url;
}
