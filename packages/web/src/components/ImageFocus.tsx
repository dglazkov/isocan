import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  formatAspectRatio,
  formatBytes,
  imageBacklinksIn,
  isDrawingItem,
  itemPath,
  newVersionId,
  parseImageMetadata,
  visualFaceOf,
  type FocusFacts,
  type ImageBacklink,
  type ImageBinaryMetadata,
  type Item,
  type ItemVersion,
} from "@isocan/core";
import { blobUrl, readBlob, readBlobText } from "../lib/api.ts";
import type { FocusFacetRecord } from "../lib/focusRegistry.ts";

export interface ImageCropRect {
  /** Normalized 0..100 percentages relative to the displayed image frame. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageMarkupStroke {
  color: string;
  /** Normalized 0..1 coordinates inside the image frame. */
  points: readonly { x: number; y: number }[];
}

export interface ImageStudioTransform {
  crop: ImageCropRect | null;
  rotation: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  strokes: readonly ImageMarkupStroke[];
}

export const INITIAL_IMAGE_TRANSFORM: ImageStudioTransform = {
  crop: null,
  rotation: 0,
  flipH: false,
  flipV: false,
  strokes: [],
};

/** Compute output pixel dimensions after applying crop and 90° rotation. */
export function computeCroppedDimensions(
  naturalWidth: number,
  naturalHeight: number,
  transform: ImageStudioTransform,
): { width: number; height: number } {
  const crop = transform.crop ?? { x: 0, y: 0, width: 100, height: 100 };
  const cw = Math.max(1, Math.round((naturalWidth * crop.width) / 100));
  const ch = Math.max(1, Math.round((naturalHeight * crop.height) / 100));
  if (transform.rotation === 90 || transform.rotation === 270) {
    return { width: ch, height: cw };
  }
  return { width: cw, height: ch };
}

/**
 * Stack a new `ItemVersion` (`item.addVersion`) from an edited image `Blob`
 * through `FocusFacts.host` — zero new operation types, one undo step (`⌘Z`).
 */
export async function stackImageEditVersion(
  facts: FocusFacts,
  bytes: Blob,
  mimeType?: string,
): Promise<string> {
  const face = visualFaceOf(facts.version);
  const outMime = mimeType ?? (bytes.type || face.mimeType);
  const filename = face.filename ?? facts.version.filename;
  const uploaded = await facts.host.putBlob(bytes, filename);
  const versionId = newVersionId();
  await facts.host.send([
    {
      type: "item.addVersion",
      itemId: facts.item.id,
      version: {
        id: versionId,
        blobHash: uploaded.blobHash,
        mimeType: outMime,
        filename,
        size: uploaded.size,
      },
    },
  ]);
  return versionId;
}

const ASPECT_PRESETS: readonly { label: string; ratio: number | null }[] = [
  { label: "Free", ratio: null },
  { label: "1:1", ratio: 1 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "9:16", ratio: 9 / 16 },
];

const MARKUP_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#111827", "#ffffff"] as const;

/**
 * **View Focus (`/i/:itemId`) for images:** pan/zoom lightbox (`Fit`, `1:1`,
 * zoom slider, alpha checkerboard), version diff slider/onion-skin (`v(N-1) ↔
 * vN`), and collapsible **Metadata Inspector** (dimensions, aspect ratio, MIME,
 * size, SHA-256 hash, author/timestamp, PNG `tEXt` / EXIF tags, and canvas
 * **Where Used** backlinks).
 */
export function ImageFocusView(facts: FocusFacts) {
  const { canvasId, canvas, item, version } = facts;
  const navigate = useNavigate();
  const face = visualFaceOf(version);
  const [zoomMode, setZoomMode] = useState<"fit" | "actual" | "custom">("fit");
  const [zoomPct, setZoomPct] = useState(100);
  const [checkerboard, setCheckerboard] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [compareMode, setCompareMode] = useState<"off" | "split" | "onion">("off");
  const [compareSplit, setCompareSplit] = useState(50);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [binaryMeta, setBinaryMeta] = useState<ImageBinaryMetadata | null>(null);
  const [itemTexts, setItemTexts] = useState<Record<string, string>>({});
  const [copiedHash, setCopiedHash] = useState(false);

  const versionIdx = item.versions.findIndex((v) => v.id === version.id);
  const prevVersion = versionIdx > 0 ? item.versions[versionIdx - 1]! : null;
  const prevFace = prevVersion ? visualFaceOf(prevVersion) : null;

  useEffect(() => {
    let live = true;
    setBinaryMeta(null);
    readBlob(canvasId, face.blobHash)
      .then((blob) => blob.arrayBuffer())
      .then((buf) => {
        if (!live) return;
        const meta = parseImageMetadata(new Uint8Array(buf), face.mimeType);
        setBinaryMeta(meta);
      })
      .catch(() => {
        if (live) setBinaryMeta(null);
      });
    return () => {
      live = false;
    };
  }, [canvasId, face.blobHash, face.mimeType]);

  const textCandidateKey = useMemo(() => {
    const entries: string[] = [];
    for (const other of Object.values(canvas.items)) {
      if (other.id === item.id) continue;
      const v = other.versions.find((ver) => ver.id === other.currentVersionId) ?? other.versions[0];
      if (!v) continue;
      if (v.mimeType === "text/html" || v.mimeType === "text/markdown") {
        entries.push(`${other.id}\u0000${v.blobHash}`);
      }
    }
    return entries.sort().join("\n");
  }, [canvas.items, item.id]);

  // Load text of HTML and Markdown items on the canvas so Where Used backlinks
  // find `<img src="...">` and Markdown image embeds. Keyed on the candidate
  // (id, blobHash) signature so unrelated item moves never re-fetch blobs.
  useEffect(() => {
    let live = true;
    if (!textCandidateKey) {
      setItemTexts({});
      return;
    }
    const entries = textCandidateKey.split("\n").map((row) => {
      const [id, blobHash] = row.split("\u0000");
      return { id: id!, blobHash: blobHash! };
    });
    void Promise.all(
      entries.map(async ({ id, blobHash }) => {
        try {
          const text = await readBlobText(canvasId, blobHash);
          return [id, text] as const;
        } catch {
          return [id, ""] as const;
        }
      }),
    ).then((pairs) => {
      if (!live) return;
      const next: Record<string, string> = {};
      for (const [id, text] of pairs) {
        if (text) next[id] = text;
      }
      setItemTexts(next);
    });
    return () => {
      live = false;
    };
  }, [canvasId, textCandidateKey]);

  const backlinks: ImageBacklink[] = useMemo(
    () => imageBacklinksIn(canvas, item, itemTexts),
    [canvas, item, itemTexts],
  );

  const width = binaryMeta?.width ?? naturalSize?.width ?? null;
  const height = binaryMeta?.height ?? naturalSize?.height ?? null;
  const aspectRatio =
    binaryMeta?.aspectRatio ?? (width && height ? formatAspectRatio(width, height) : null);

  const copyHash = () => {
    void navigator.clipboard?.writeText(face.blobHash).then(() => {
      setCopiedHash(true);
      window.setTimeout(() => setCopiedHash(false), 1500);
    });
  };

  const tagEntries = [
    ...Object.entries(binaryMeta?.textTags ?? {}),
    ...Object.entries(binaryMeta?.exifTags ?? {}),
  ];

  return (
    <div className="image-focus-view" data-testid="image-focus-view">
      <div className="image-focus-toolbar">
        <div className="image-focus-toolbar-group" role="group" aria-label="Zoom controls">
          <button
            type="button"
            className={`focus-chip-btn${zoomMode === "fit" ? " active" : ""}`}
            onClick={() => {
              setZoomMode("fit");
              setZoomPct(100);
            }}
          >
            Fit
          </button>
          <button
            type="button"
            className={`focus-chip-btn${zoomMode === "actual" ? " active" : ""}`}
            onClick={() => {
              setZoomMode("actual");
              setZoomPct(100);
            }}
          >
            1:1
          </button>
          <input
            type="range"
            min={25}
            max={400}
            step={25}
            value={zoomPct}
            aria-label="Zoom percentage"
            onChange={(e) => {
              setZoomMode("custom");
              setZoomPct(Number(e.target.value));
            }}
          />
          <span className="image-focus-zoom-readout">
            {zoomMode === "fit" ? "Fit" : zoomMode === "actual" ? "100%" : `${zoomPct}%`}
          </span>
        </div>

        <button
          type="button"
          className={`focus-chip-btn${checkerboard ? " active" : ""}`}
          onClick={() => setCheckerboard((v) => !v)}
          title="Toggle alpha checkerboard backdrop"
        >
          ▦ Alpha
        </button>

        {prevFace && (
          <div className="image-focus-toolbar-group" role="group" aria-label="Version comparison">
            <button
              type="button"
              className={`focus-chip-btn${compareMode === "split" ? " active" : ""}`}
              onClick={() => setCompareMode((m) => (m === "split" ? "off" : "split"))}
              title="Compare current version with previous via split slider"
            >
              ⇔ Split v{versionIdx}↔v{versionIdx + 1}
            </button>
            <button
              type="button"
              className={`focus-chip-btn${compareMode === "onion" ? " active" : ""}`}
              onClick={() => setCompareMode((m) => (m === "onion" ? "off" : "onion"))}
              title="Blend current version over previous version"
            >
              ◐ Onion
            </button>
            {compareMode !== "off" && (
              <input
                type="range"
                min={0}
                max={100}
                value={compareSplit}
                aria-label="Version comparison slider"
                onChange={(e) => setCompareSplit(Number(e.target.value))}
              />
            )}
          </div>
        )}

        <span className="spacer" />

        <button
          type="button"
          className={`focus-chip-btn${inspectorOpen ? " active" : ""}`}
          onClick={() => setInspectorOpen((o) => !o)}
          aria-expanded={inspectorOpen}
        >
          ⓘ Metadata
        </button>
      </div>

      <div className="image-focus-main">
        <div
          className={`image-focus-canvas${checkerboard ? " checkerboard" : ""}${zoomMode !== "fit" ? " scrollable" : ""}`}
        >
          <div
            className="image-focus-frame"
            style={
              zoomMode === "actual"
                ? { width: width ? `${width}px` : "auto" }
                : zoomMode === "custom"
                  ? { transform: `scale(${zoomPct / 100})`, transformOrigin: "center center" }
                  : undefined
            }
          >
            {prevFace && compareMode !== "off" && (
              <img
                src={blobUrl(canvasId, prevFace.blobHash)}
                alt={`${item.title} (previous version)`}
                className="image-focus-img compare-under"
              />
            )}
            <img
              src={blobUrl(canvasId, face.blobHash)}
              alt={item.properties?.alt || item.title}
              className={`image-focus-img${zoomMode === "fit" ? " fit" : ""}`}
              style={
                compareMode === "split" && prevFace
                  ? { clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }
                  : compareMode === "onion" && prevFace
                    ? { opacity: compareSplit / 100 }
                    : undefined
              }
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
                }
              }}
            />
          </div>
        </div>

        {inspectorOpen && (
          <aside className="image-focus-inspector" aria-label="Image metadata inspector">
            <section className="image-inspector-section">
              <h4>Dimensions &amp; Format</h4>
              <dl className="image-inspector-grid">
                <dt>Dimensions</dt>
                <dd>{width && height ? `${width} × ${height} px` : "Measuring…"}</dd>
                <dt>Aspect</dt>
                <dd>{aspectRatio ?? "—"}</dd>
                <dt>MIME</dt>
                <dd>{face.mimeType}</dd>
                <dt>Size</dt>
                <dd>{formatBytes(face.size ?? version.size)}</dd>
                {binaryMeta?.colorType && (
                  <>
                    <dt>Color</dt>
                    <dd>
                      {binaryMeta.colorType}
                      {binaryMeta.bitDepth ? ` · ${binaryMeta.bitDepth}-bit` : ""}
                    </dd>
                  </>
                )}
                <dt>SHA-256</dt>
                <dd className="image-inspector-hash">
                  <code>{face.blobHash.slice(0, 12)}…</code>
                  <button type="button" className="focus-chip-btn" onClick={copyHash}>
                    {copiedHash ? "Copied" : "Copy"}
                  </button>
                </dd>
              </dl>
            </section>

            <section className="image-inspector-section">
              <h4>Provenance</h4>
              <dl className="image-inspector-grid">
                <dt>Version</dt>
                <dd>
                  v{versionIdx + 1} of {item.versions.length}
                </dd>
                <dt>Author</dt>
                <dd>{version.createdBy?.name || version.createdBy?.id || "—"}</dd>
                <dt>Created</dt>
                <dd>{version.createdAt ? new Date(version.createdAt).toLocaleString() : "—"}</dd>
                {item.properties?.alt && (
                  <>
                    <dt>Alt text</dt>
                    <dd>{item.properties.alt}</dd>
                  </>
                )}
              </dl>
            </section>

            {tagEntries.length > 0 && (
              <section className="image-inspector-section">
                <h4>Embedded Metadata (EXIF / PNG)</h4>
                <dl className="image-inspector-grid">
                  {tagEntries.map(([key, val]) => (
                    <div key={key} className="image-inspector-tag-row">
                      <dt>{key}</dt>
                      <dd>{val}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <section className="image-inspector-section">
              <h4>Where Used ({backlinks.length})</h4>
              {backlinks.length === 0 ? (
                <p className="image-inspector-empty">
                  Not referenced by other screens or threads on this canvas yet.
                </p>
              ) : (
                <ul className="image-inspector-backlinks">
                  {backlinks.map((b, idx) => (
                    <li key={`${b.kind}-${b.itemId ?? b.threadId ?? idx}`}>
                      {b.itemId && b.itemId !== item.id ? (
                        <button
                          type="button"
                          className="image-backlink-btn"
                          onClick={() => navigate(itemPath(canvasId, b.itemId!))}
                        >
                          <b>{b.title}</b>
                          <span>{b.detail}</span>
                        </button>
                      ) : (
                        <div className="image-backlink-row">
                          <b>{b.title}</b>
                          <span>{b.detail}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}

/**
 * **Edit Focus (`/w/:itemId`) for images:** non-destructive Image Studio with
 * crop & aspect-ratio presets, 90° rotate & H/V flip, freehand markup pen,
 * alt-text & description editor, and `image-region` `FocusSubtarget` selection
 * for Node-Anchored Chat (`⌘J`).
 */
export function ImageFocusEdit(facts: FocusFacts) {
  const { canvasId, item, version, canEdit, host, setSubtarget, askAgent } = facts;
  const face = visualFaceOf(version);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const [transform, setTransform] = useState<ImageStudioTransform>(INITIAL_IMAGE_TRANSFORM);
  const [tool, setTool] = useState<"crop" | "markup">("crop");
  const [aspectPreset, setAspectPreset] = useState<string>("Free");
  const [penColor, setPenColor] = useState<string>(MARKUP_COLORS[0]);
  const [drawingStroke, setDrawingStroke] = useState<ImageMarkupStroke | null>(null);
  const [altText, setAltText] = useState(item.properties?.alt ?? "");
  const [description, setDescription] = useState(item.description ?? "");
  const [busy, setBusy] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({
    width: item.width || 800,
    height: item.height || 600,
  });

  useEffect(() => {
    setAltText(item.properties?.alt ?? "");
    setDescription(item.description ?? "");
  }, [item.id, item.properties?.alt, item.description]);

  const hasChanges =
    transform.crop !== null ||
    transform.rotation !== 0 ||
    transform.flipH ||
    transform.flipV ||
    transform.strokes.length > 0;

  const applyAspectPreset = (label: string, ratio: number | null) => {
    setAspectPreset(label);
    if (ratio === null) {
      setTransform((t) => ({ ...t, crop: null }));
      setSubtarget(null);
      return;
    }
    const imgRatio = naturalSize.width / Math.max(1, naturalSize.height);
    let wPct = 80;
    let hPct = 80;
    if (ratio > imgRatio) {
      wPct = 80;
      hPct = Math.min(100, Math.round((80 * imgRatio) / ratio));
    } else {
      hPct = 80;
      wPct = Math.min(100, Math.round((80 * ratio) / imgRatio));
    }
    const xPct = Math.round((100 - wPct) / 2);
    const yPct = Math.round((100 - hPct) / 2);
    const crop: ImageCropRect = { x: xPct, y: yPct, width: wPct, height: hPct };
    setTransform((t) => ({ ...t, crop }));
    setSubtarget({
      kind: "image-region",
      id: `${crop.x},${crop.y},${crop.width}x${crop.height}`,
      label: `Crop ${label} (${crop.width}%×${crop.height}%)`,
      metadata: { ...crop, preset: label },
    });
  };

  const setCustomCrop = (crop: ImageCropRect | null) => {
    setTransform((t) => ({ ...t, crop }));
    if (!crop) {
      setSubtarget(null);
    } else {
      setSubtarget({
        kind: "image-region",
        id: `${crop.x},${crop.y},${crop.width}x${crop.height}`,
        label: `Region ${crop.width}%×${crop.height}% at (${crop.x}%,${crop.y}%)`,
        metadata: { ...crop },
      });
    }
  };

  const rotateBy = (delta: 90 | -90) => {
    setTransform((t) => {
      const next = (((t.rotation + delta) % 360) + 360) % 360;
      return { ...t, rotation: next as 0 | 90 | 180 | 270 };
    });
  };

  const resetStudio = () => {
    setTransform(INITIAL_IMAGE_TRANSFORM);
    setAspectPreset("Free");
    setSubtarget(null);
    setStatusNote(null);
  };

  const saveVersion = async () => {
    if (!canEdit || busy) return;
    const img = imgRef.current;
    if (!img) return;
    setBusy(true);
    setStatusNote(null);
    try {
      const nw = img.naturalWidth || naturalSize.width || 800;
      const nh = img.naturalHeight || naturalSize.height || 600;
      const crop = transform.crop ?? { x: 0, y: 0, width: 100, height: 100 };
      const sx = Math.round((nw * crop.x) / 100);
      const sy = Math.round((nh * crop.y) / 100);
      const sw = Math.max(1, Math.round((nw * crop.width) / 100));
      const sh = Math.max(1, Math.round((nh * crop.height) / 100));
      const outDims = computeCroppedDimensions(nw, nh, transform);

      const canvasEl = document.createElement("canvas");
      canvasEl.width = outDims.width;
      canvasEl.height = outDims.height;
      const ctx = canvasEl.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable.");

      ctx.save();
      ctx.translate(outDims.width / 2, outDims.height / 2);
      ctx.rotate((transform.rotation * Math.PI) / 180);
      ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);
      ctx.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);

      // Draw freehand markup strokes in source space
      for (const stroke of transform.strokes) {
        if (stroke.points.length < 2) continue;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = Math.max(2, Math.round(Math.min(sw, sh) * 0.008));
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        stroke.points.forEach((pt, idx) => {
          const px = pt.x * nw - sx - sw / 2;
          const py = pt.y * nh - sy - sh / 2;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
      ctx.restore();

      const outMime =
        face.mimeType === "image/jpeg" || face.mimeType === "image/webp"
          ? face.mimeType
          : "image/png";
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvasEl.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Could not encode edited image."))),
          outMime,
          0.92,
        );
      });

      await stackImageEditVersion(facts, blob, outMime);
      resetStudio();
      setStatusNote(`Saved v${item.versions.length + 1}`);
    } catch (err) {
      setStatusNote(err instanceof Error ? err.message : "Could not save image version.");
    } finally {
      setBusy(false);
    }
  };

  const saveMetadata = async () => {
    if (!canEdit || busy) return;
    setBusy(true);
    setStatusNote(null);
    try {
      await host.send([
        {
          type: "item.update",
          itemId: item.id,
          patch: {
            description,
            properties: { alt: altText },
          },
        },
      ]);
      setStatusNote("Saved alt text & description");
    } catch (err) {
      setStatusNote(err instanceof Error ? err.message : "Could not save metadata.");
    } finally {
      setBusy(false);
    }
  };

  const onPointerDownMarkup = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== "markup" || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawingStroke({ color: penColor, points: [{ x, y }] });
  };

  const onPointerMoveMarkup = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingStroke || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setDrawingStroke((prev) =>
      prev ? { ...prev, points: [...prev.points, { x, y }] } : null,
    );
  };

  const onPointerUpMarkup = () => {
    if (!drawingStroke) return;
    if (drawingStroke.points.length >= 2) {
      setTransform((t) => ({ ...t, strokes: [...t.strokes, drawingStroke] }));
    }
    setDrawingStroke(null);
  };

  const outDims = computeCroppedDimensions(naturalSize.width, naturalSize.height, transform);

  return (
    <div className="image-focus-edit" data-testid="image-focus-edit">
      <div className="image-focus-toolbar">
        <div className="image-focus-toolbar-group" role="group" aria-label="Studio tools">
          <button
            type="button"
            className={`focus-chip-btn${tool === "crop" ? " active" : ""}`}
            onClick={() => setTool("crop")}
          >
             crop
          </button>
          <button
            type="button"
            className={`focus-chip-btn${tool === "markup" ? " active" : ""}`}
            onClick={() => setTool("markup")}
          >
            ✎ Markup
          </button>
        </div>

        {tool === "crop" && (
          <div className="image-focus-toolbar-group" role="group" aria-label="Crop aspect ratio">
            {ASPECT_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className={`focus-chip-btn${aspectPreset === p.label ? " active" : ""}`}
                onClick={() => applyAspectPreset(p.label, p.ratio)}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {tool === "markup" && (
          <div className="image-focus-toolbar-group" role="group" aria-label="Markup ink color">
            {MARKUP_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`image-color-dot${penColor === color ? " active" : ""}`}
                style={{ backgroundColor: color }}
                aria-label={`Ink ${color}`}
                onClick={() => setPenColor(color)}
              />
            ))}
            {transform.strokes.length > 0 && (
              <button
                type="button"
                className="focus-chip-btn"
                onClick={() => setTransform((t) => ({ ...t, strokes: [] }))}
              >
                Clear ink
              </button>
            )}
          </div>
        )}

        <div className="image-focus-toolbar-group" role="group" aria-label="Transform">
          <button type="button" className="focus-chip-btn" onClick={() => rotateBy(-90)} title="Rotate 90° counter-clockwise">
            ↺ -90°
          </button>
          <button type="button" className="focus-chip-btn" onClick={() => rotateBy(90)} title="Rotate 90° clockwise">
            ↻ +90°
          </button>
          <button
            type="button"
            className={`focus-chip-btn${transform.flipH ? " active" : ""}`}
            onClick={() => setTransform((t) => ({ ...t, flipH: !t.flipH }))}
            title="Flip horizontally"
          >
            ⇆ Flip H
          </button>
          <button
            type="button"
            className={`focus-chip-btn${transform.flipV ? " active" : ""}`}
            onClick={() => setTransform((t) => ({ ...t, flipV: !t.flipV }))}
            title="Flip vertically"
          >
            ⇅ Flip V
          </button>
        </div>

        <span className="spacer" />

        {statusNote && <span className="image-focus-status">{statusNote}</span>}

        {hasChanges && (
          <button type="button" className="focus-chip-btn" onClick={resetStudio} disabled={busy}>
            Reset
          </button>
        )}

        <button
          type="button"
          className="focus-chip-btn primary"
          onClick={() => void saveVersion()}
          disabled={!canEdit || busy || !hasChanges}
          data-testid="image-save-version"
        >
          {busy ? "Saving…" : `Save as v${item.versions.length + 1}`}
        </button>
      </div>

      <div className="image-focus-main">
        <div className="image-focus-canvas checkerboard">
          <div
            ref={frameRef}
            className={`image-focus-frame studio-${tool}`}
            onPointerDown={onPointerDownMarkup}
            onPointerMove={onPointerMoveMarkup}
            onPointerUp={onPointerUpMarkup}
            style={{
              transform: `rotate(${transform.rotation}deg) scale(${transform.flipH ? -1 : 1}, ${transform.flipV ? -1 : 1})`,
            }}
          >
            <img
              ref={imgRef}
              src={blobUrl(canvasId, face.blobHash)}
              alt={altText || item.title}
              crossOrigin="anonymous"
              className="image-focus-img fit"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
                }
              }}
            />

            {transform.crop && (
              <div
                className="image-crop-box"
                data-testid="image-crop-box"
                style={{
                  left: `${transform.crop.x}%`,
                  top: `${transform.crop.y}%`,
                  width: `${transform.crop.width}%`,
                  height: `${transform.crop.height}%`,
                }}
              >
                <div className="image-crop-badge">
                  {outDims.width} × {outDims.height} px
                  <button
                    type="button"
                    className="image-crop-ask-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      askAgent("Edit this selected region: ");
                    }}
                  >
                    💬 Ask Agent
                  </button>
                </div>
              </div>
            )}

            {(transform.strokes.length > 0 || drawingStroke) && (
              <svg className="image-markup-overlay" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                {[...transform.strokes, ...(drawingStroke ? [drawingStroke] : [])].map((s, idx) => (
                  <polyline
                    key={idx}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={s.points.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")}
                  />
                ))}
              </svg>
            )}
          </div>
        </div>

        <aside className="image-focus-inspector" aria-label="Image properties and crop controls">
          <section className="image-inspector-section">
            <h4>Crop Region (%)</h4>
            <div className="image-crop-inputs">
              <label>
                <span>X</span>
                <input
                  type="number"
                  min={0}
                  max={95}
                  value={transform.crop?.x ?? 0}
                  onChange={(e) => {
                    const x = Math.min(95, Math.max(0, Number(e.target.value)));
                    const base = transform.crop ?? { x: 0, y: 0, width: 100, height: 100 };
                    setCustomCrop({ ...base, x, width: Math.min(base.width, 100 - x) });
                  }}
                />
              </label>
              <label>
                <span>Y</span>
                <input
                  type="number"
                  min={0}
                  max={95}
                  value={transform.crop?.y ?? 0}
                  onChange={(e) => {
                    const y = Math.min(95, Math.max(0, Number(e.target.value)));
                    const base = transform.crop ?? { x: 0, y: 0, width: 100, height: 100 };
                    setCustomCrop({ ...base, y, height: Math.min(base.height, 100 - y) });
                  }}
                />
              </label>
              <label>
                <span>W</span>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={transform.crop?.width ?? 100}
                  onChange={(e) => {
                    const base = transform.crop ?? { x: 0, y: 0, width: 100, height: 100 };
                    const width = Math.min(100 - base.x, Math.max(5, Number(e.target.value)));
                    setCustomCrop({ ...base, width });
                  }}
                />
              </label>
              <label>
                <span>H</span>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={transform.crop?.height ?? 100}
                  onChange={(e) => {
                    const base = transform.crop ?? { x: 0, y: 0, width: 100, height: 100 };
                    const height = Math.min(100 - base.y, Math.max(5, Number(e.target.value)));
                    setCustomCrop({ ...base, height });
                  }}
                />
              </label>
            </div>
            <p className="image-inspector-hint">
              Output: <b>{outDims.width} × {outDims.height} px</b> · Rotation {transform.rotation}°
            </p>
          </section>

          <section className="image-inspector-section">
            <h4>Accessibility &amp; Metadata</h4>
            <label className="image-meta-field">
              <span>Alt text</span>
              <input
                type="text"
                value={altText}
                placeholder="Concise description for screen readers…"
                onChange={(e) => setAltText(e.target.value)}
              />
            </label>
            <label className="image-meta-field">
              <span>Notes / Description</span>
              <textarea
                rows={3}
                value={description}
                placeholder="Provenance, prompt notes, or usage guidance…"
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="focus-chip-btn"
              onClick={() => void saveMetadata()}
              disabled={!canEdit || busy}
            >
              Save Metadata
            </button>
          </section>

          <section className="image-inspector-section">
            <h4>Agent Co-Editing</h4>
            <div className="image-agent-chips">
              <button
                type="button"
                className="focus-chip-btn"
                onClick={() => askAgent("Create a new version of this image with a clean transparent background.")}
              >
                Remove background
              </button>
              <button
                type="button"
                className="focus-chip-btn"
                onClick={() => askAgent("Generate a visual variation keeping the same composition and palette.")}
              >
                Generate variant
              </button>
              <button
                type="button"
                className="focus-chip-btn"
                onClick={() => askAgent("Write concise, accurate accessibility alt text for this image.")}
              >
                Draft alt text
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function isFocusableImageItem(item: Item, version: ItemVersion): boolean {
  if (isDrawingItem(item)) return false;
  const face = visualFaceOf(version);
  return face.mimeType.startsWith("image/");
}

export const imageFocusFacet: FocusFacetRecord = {
  id: "builtin.image",
  matches: isFocusableImageItem,
  priority: 0,
  view: ImageFocusView,
  edit: ImageFocusEdit,
  agentPrompts: [
    {
      label: "Remove background",
      prompt: "Create a new version of this image with a clean transparent background.",
    },
    {
      label: "Generate variant",
      prompt: "Generate a fresh visual variation of this image keeping the same composition.",
    },
    {
      label: "Describe alt text",
      prompt: "Write concise, accurate accessibility alt text and metadata for this image.",
    },
  ],
};
