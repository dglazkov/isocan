import { useEffect, useState } from "react";
import { readBlobText } from "./api.ts";
import { useUiStore } from "../stores/uiStore.ts";

const MAX_CACHED_SNAPSHOTS = 120;
const MAX_CONCURRENT = 4;
const snapshotUrls = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

let activeTasks = 0;
const pendingQueue: Array<() => void> = [];

function runLimited<T>(fn: () => Promise<T>): Promise<T> {
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

function waitUntilCalm(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (useUiStore.getState().panning) {
        const unsub = useUiStore.subscribe((s, prev) => {
          if (!s.panning && prev.panning) {
            unsub();
            setTimeout(check, delayMs);
          }
        });
        return;
      }
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => resolve(), { timeout: 200 });
      } else {
        setTimeout(resolve, 16);
      }
    };
    setTimeout(check, delayMs);
  });
}

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
  xhtml.setAttribute(
    "style",
    `width:${width}px;height:${height}px;overflow:hidden;background:#ffffff;position:relative;box-sizing:border-box;`,
  );
  for (const style of doc.head.querySelectorAll("style")) {
    xhtml.appendChild(style.cloneNode(true));
  }
  const bodyWrap = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
  for (const attr of doc.body.attributes) {
    if (attr.name === "class" || attr.name === "style" || attr.name.startsWith("data-")) {
      bodyWrap.setAttribute(attr.name, attr.value);
    }
  }
  bodyWrap.innerHTML = doc.body.innerHTML;
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
): Promise<string | null> {
  const cached = snapshotUrls.get(blobHash);
  if (cached) return cached;
  const existing = inflight.get(blobHash);
  if (existing) return existing;

  const task = runLimited(async () => {
    await waitUntilCalm(16);
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
      inflight.delete(blobHash);
    }
  });

  inflight.set(blobHash, task);
  return task;
}

export function useHtmlSnapshot(
  canvasId: string,
  blobHash: string,
  width: number,
  height: number,
  enabled: boolean,
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
    void renderHtmlBlobSnapshot(canvasId, blobHash, width, height).then((got) => {
      if (alive && got) setUrl(got);
    });
    return () => {
      alive = false;
    };
  }, [canvasId, blobHash, width, height, enabled]);

  return url;
}
