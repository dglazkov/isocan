import { blobUrl } from "./api.ts";
import { fetchBlobText } from "./blobtext.ts";

/** Nothing grows past this: a screen that wants 6000px is a screen with a bug,
 *  and an item that fills the canvas is not a fit, it is a wall. */
const MAX_FIT = 2400;
/** A screen with nothing to say about its own width gets a desktop. */
const SCREEN_FIT = { width: 1280, height: 800 };

const clamp = (n: number) => Math.max(80, Math.min(MAX_FIT, Math.round(n)));

/**
 * How big an item's content actually wants to be.
 *
 * Images and video carry their size in the file, so those are exact. HTML is
 * the hard one: an item renders in a frame sandboxed WITHOUT
 * `allow-same-origin`, which is what stops a page somebody dropped on the
 * canvas from reaching the app — and it also means the parent cannot read
 * `contentDocument` to measure it.
 *
 * So the page is asked instead of inspected. A measuring frame is built with
 * `srcdoc`, the content plus a few lines of our own script, still sandboxed
 * exactly as the real one is; the script measures from the inside and posts
 * the answer out. The content gains nothing it did not already have when it
 * was displayed, and we never have to loosen the sandbox to find out how big
 * something is.
 *
 * Takes the version rather than a URL: an image is measured by handing the
 * blob route to the browser as an `<img src>`, and text is measured by
 * READING it — two different needs for the same pair, and only one of them
 * is a fetch that can recover from a 401.
 */
export async function naturalSize(
  canvasId: string,
  blobHash: string,
  mimeType: string,
): Promise<{ width: number; height: number }> {
  if (mimeType.startsWith("image/") && mimeType !== "image/svg+xml") {
    const img = new Image();
    img.src = blobUrl(canvasId, blobHash);
    try {
      await img.decode();
      return { width: clamp(img.naturalWidth), height: clamp(img.naturalHeight) };
    } catch {
      return SCREEN_FIT;
    }
  }
  if (mimeType === "text/html" || mimeType === "image/svg+xml") {
    /* A read that fails is a size nobody can know, and the fallback is the
       same one an unmeasurable page already gets — never a fit computed from
       a refusal's body. */
    const text = await fetchBlobText(canvasId, blobHash).catch(() => null);
    if (text === null) return SCREEN_FIT;
    const measured = await measureInFrame(text, mimeType);
    if (measured) return measured;
  }
  return SCREEN_FIT;
}

const PROBE = `<script>
  // Measured at the widest the content would ever be asked for, so a
  // responsive page reports the layout it prefers rather than the one this
  // frame happens to force on it.
  const send = () => {
    const d = document.documentElement, b = document.body;
    parent.postMessage({ isocanMeasure: true,
      width: Math.max(d.scrollWidth, b ? b.scrollWidth : 0),
      height: Math.max(d.scrollHeight, b ? b.scrollHeight : 0) }, "*");
  };
  if (document.readyState === "complete") send();
  else addEventListener("load", send);
  setTimeout(send, 700);
<\/script>`;

function measureInFrame(
  source: string,
  mimeType: string,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    // Same sandbox the real item gets. Measuring must not be a reason to
    // relax it, or the measurement becomes the hole.
    frame.setAttribute("sandbox", "allow-scripts");
    frame.style.cssText =
      "position:fixed; left:-10000px; top:0; width:2400px; height:1400px; border:0; visibility:hidden;";
    const done = (size: { width: number; height: number } | null) => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      frame.remove();
      resolve(size);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow) return;
      const d = e.data as { isocanMeasure?: boolean; width?: number; height?: number };
      if (!d?.isocanMeasure || !d.width || !d.height) return;
      done({ width: clamp(d.width), height: clamp(d.height) });
    };
    // A page that never answers must not hang the gesture.
    const timer = setTimeout(() => done(null), 2500);
    window.addEventListener("message", onMessage);
    frame.srcdoc =
      mimeType === "image/svg+xml"
        ? `<body style="margin:0">${source}${PROBE}`
        : source + PROBE;
    document.body.appendChild(frame);
  });
}
