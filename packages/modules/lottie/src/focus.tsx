import "./lottie.css";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  designSystem,
  newGroupId,
  newVersionId,
  type FocusFacts,
  type FocusSubtarget,
} from "@isocan/core";
import {
  LOTTIE_JSON_MIME,
  LOTTIE_POSTER_FRAME_PROP,
  extractLottiePalette,
  inspectLottie,
  lintLottie,
  lottieEmbedSnippets,
  parseLottieJson,
  profileLottieFrames,
  remapLottiePalette,
  removeLottieMarker,
  renderLottieFrameSvg,
  setLottieLayerHidden,
  setLottieLayerText,
  setLottieMarker,
  syncLottieToDesignSystem,
  trimLottie,
  type LottieDocument,
  type LottieLayerSummary,
  type LottieMarker,
  type LottieTarget,
} from "./core.ts";

export type LottieBackdrop = "checker" | "light" | "dark" | "surface";
export type LottieLoopMode = "loop" | "bounce" | "once";

const SPEED_PRESETS = [0.25, 0.5, 1, 1.5, 2] as const;

export function layerSubtargetFor(layer: LottieLayerSummary): FocusSubtarget {
  return {
    kind: "lottie-layer",
    id: String(layer.ind),
    label: `Layer #${layer.ind}: ${layer.name} (${layer.kind})`,
    metadata: {
      ind: layer.ind,
      name: layer.name,
      layerKind: layer.kind,
    },
  };
}

export function LottieFocusView(facts: FocusFacts) {
  const [doc, setDoc] = useState<LottieDocument | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const [loopMode, setLoopMode] = useState<LottieLoopMode>("loop");
  const [speed, setSpeed] = useState<number>(1);
  const [frame, setFrame] = useState<number>(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [activeMarker, setActiveMarker] = useState<LottieMarker | null>(null);
  const [backdrop, setBackdrop] = useState<LottieBackdrop>("checker");
  const [wireframe, setWireframe] = useState(false);
  const [devToolsOpen, setDevToolsOpen] = useState(true);
  const [lintTarget, setLintTarget] = useState<LottieTarget | "all">("all");
  const [embedTab, setEmbedTab] = useState<"html" | "react" | "ios" | "android">("html");
  const readTextRef = useRef(facts.readText);
  readTextRef.current = facts.readText;

  useEffect(() => {
    let active = true;
    void readTextRef
      .current()
      .then((raw) => {
        if (!active) return;
        const parsed = parseLottieJson(raw);
        if ("error" in parsed) {
          setDoc(null);
          setParseError(parsed.error);
          return;
        }
        setDoc(parsed);
        setParseError(null);
        setFrame(parsed.ip);
        setActiveMarker(null);
      })
      .catch((err) => {
        if (active) setParseError((err as Error).message || "Unable to read animation");
      });
    return () => {
      active = false;
    };
  }, [facts.version.blobHash]);

  const rangeStart = activeMarker ? activeMarker.tm : (doc?.ip ?? 0);
  const rangeEnd = activeMarker
    ? Math.max(activeMarker.tm + 1, activeMarker.tm + activeMarker.dr)
    : Math.max((doc?.ip ?? 0) + 1, doc?.op ?? 1);

  useEffect(() => {
    if (!doc || !playing) return;
    if (typeof requestAnimationFrame === "undefined") return;
    const fps = Math.max(1, doc.fr || 30);
    const span = Math.max(1, rangeEnd - rangeStart);
    let rafId = 0;
    let lastTs: number | null = null;

    const tick = (ts: number) => {
      if (lastTs === null) lastTs = ts;
      const dtSec = (ts - lastTs) / 1000;
      lastTs = ts;
      setFrame((prev) => {
        const delta = dtSec * fps * speed * direction;
        const next = prev + delta;
        if (direction === 1 && next >= rangeEnd) {
          if (loopMode === "once") {
            setPlaying(false);
            return rangeEnd;
          }
          if (loopMode === "bounce") {
            setDirection(-1);
            return rangeEnd;
          }
          return rangeStart + ((next - rangeStart) % span);
        }
        if (direction === -1 && next <= rangeStart) {
          setDirection(1);
          return rangeStart;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [doc, playing, speed, loopMode, direction, rangeStart, rangeEnd]);

  const inspection = useMemo(() => (doc ? inspectLottie(doc) : null), [doc]);
  const issues = useMemo(
    () => (doc ? lintLottie(doc, lintTarget === "all" ? undefined : lintTarget) : []),
    [doc, lintTarget],
  );
  const profile = useMemo(() => (doc ? profileLottieFrames(doc, 36) : null), [doc]);
  const snippets = useMemo(
    () =>
      lottieEmbedSnippets({
        filename: facts.version.filename || "animation.lottie.json",
        loop: loopMode !== "once",
        speed,
        segment: activeMarker?.cm ?? null,
      }),
    [facts.version.filename, loopMode, speed, activeMarker],
  );
  const governingDs = useMemo(
    () => designSystem(facts.canvas, { at: facts.item }),
    [facts.canvas, facts.item],
  );
  const svgMarkup = useMemo(
    () => (doc ? renderLottieFrameSvg(doc, frame, { wireframe }) : ""),
    [doc, frame, wireframe],
  );

  if (parseError) {
    return (
      <div className="lottie-focus" data-testid="lottie-focus-error">
        <div className="lottie-focus-toolbar">
          <strong>Lottie Error:</strong> <span>{parseError}</span>
        </div>
      </div>
    );
  }

  if (!doc || !inspection) {
    return <div className="page-note">Loading Lottie studio…</div>;
  }

  const currentFrameInt = Math.round(frame);
  const elapsedSec = ((currentFrameInt - doc.ip) / Math.max(1, doc.fr)).toFixed(2);

  return (
    <div className="lottie-focus" data-testid="lottie-focus-view">
      <div className="lottie-focus-toolbar">
        <div className="lottie-pill-group" role="group" aria-label="Stage backdrop">
          {(["checker", "light", "dark", "surface"] as const).map((b) => (
            <button
              key={b}
              type="button"
              data-backdrop={b}
              aria-pressed={backdrop === b}
              onClick={() => setBackdrop(b)}
            >
              {b === "checker"
                ? "Checker"
                : b === "light"
                  ? "Light"
                  : b === "dark"
                    ? "Dark"
                    : "Surface"}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="lottie-btn"
          aria-pressed={wireframe}
          data-testid="lottie-wireframe-toggle"
          onClick={() => setWireframe((w) => !w)}
        >
          {wireframe ? "Outlines: On" : "Outlines"}
        </button>

        <div className="lottie-pill-group" role="group" aria-label="Playback speed">
          {SPEED_PRESETS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={speed === s}
              onClick={() => setSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>

        <div className="lottie-pill-group" role="group" aria-label="Loop mode">
          {(["loop", "bounce", "once"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={loopMode === m}
              onClick={() => {
                setLoopMode(m);
                setDirection(1);
              }}
            >
              {m === "loop" ? "Loop" : m === "bounce" ? "Bounce" : "Once"}
            </button>
          ))}
        </div>

        <span className="spacer" />

        <button
          type="button"
          className="lottie-btn"
          aria-expanded={devToolsOpen}
          data-testid="lottie-devtools-toggle"
          onClick={() => setDevToolsOpen((o) => !o)}
        >
          DevTools ({issues.length} {issues.length === 1 ? "issue" : "issues"})
        </button>
      </div>

      <div className="lottie-focus-workspace">
        <div className="lottie-stage-column">
          <div
            className={`lottie-stage-viewport backdrop-${backdrop}`}
            data-testid="lottie-stage-viewport"
          >
            <div
              className="lottie-stage-canvas"
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
          </div>

          <div className="lottie-transport-bar" data-testid="lottie-transport-bar">
            <div className="lottie-transport-row">
              <button
                type="button"
                className="lottie-btn"
                aria-label="Step frame backward"
                onClick={() => {
                  setPlaying(false);
                  setFrame((f) => Math.max(rangeStart, Math.round(f) - 1));
                }}
              >
                ◀
              </button>
              <button
                type="button"
                className="lottie-btn primary"
                aria-label={playing ? "Pause" : "Play"}
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                className="lottie-btn"
                aria-label="Step frame forward"
                onClick={() => {
                  setPlaying(false);
                  setFrame((f) => Math.min(rangeEnd, Math.round(f) + 1));
                }}
              >
                ▶
              </button>
              <input
                type="range"
                aria-label="Timeline frame scrubber"
                min={rangeStart}
                max={rangeEnd}
                step={1}
                value={currentFrameInt}
                onChange={(e) => {
                  setPlaying(false);
                  setFrame(Number(e.target.value));
                }}
              />
              <span className="lottie-frame-readout" data-testid="lottie-frame-readout">
                f{currentFrameInt}/{doc.op} · {elapsedSec}s
              </span>
            </div>

            {inspection.markers.length > 0 && (
              <div className="lottie-markers-row" aria-label="Named markers">
                <button
                  type="button"
                  className={`lottie-marker-pill${activeMarker === null ? " active" : ""}`}
                  onClick={() => {
                    setActiveMarker(null);
                    setFrame(doc.ip);
                  }}
                >
                  All ({doc.ip}–{doc.op})
                </button>
                {inspection.markers.map((m) => (
                  <button
                    key={m.cm}
                    type="button"
                    data-marker={m.cm}
                    className={`lottie-marker-pill${activeMarker?.cm === m.cm ? " active" : ""}`}
                    onClick={() => {
                      setActiveMarker(m);
                      setFrame(m.tm);
                      setPlaying(true);
                    }}
                  >
                    ◆ {m.cm} ({m.tm}–{m.tm + m.dr})
                  </button>
                ))}
              </div>
            )}
          </div>

          {devToolsOpen && (
            <div className="lottie-devtools-drawer" data-testid="lottie-devtools-drawer">
              <div className="lottie-section-header">
                <span>Lottie DevTools — Compatibility Linter, Frame Profiler & Embed</span>
                <div className="lottie-pill-group" role="group" aria-label="Target runtime">
                  {(["all", "web-svg", "thorvg", "ios", "android"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={lintTarget === t}
                      onClick={() => setLintTarget(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lottie-devtools-grid">
                <div>
                  <strong>
                    Compatibility ({issues.length === 0 ? "Clean" : `${issues.length} warnings`})
                  </strong>
                  {issues.length === 0 ? (
                    <p>No cross-platform issues detected for {lintTarget}.</p>
                  ) : (
                    <ul className="lottie-lint-list">
                      {issues.map((iss, idx) => (
                        <li key={`${iss.code}-${idx}`} className="lottie-lint-item">
                          <strong>{iss.code}</strong>: {iss.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {profile && (
                  <div>
                    <strong>
                      Frame Complexity (Peak f{profile.peakFrame} · score {profile.peakScore})
                    </strong>
                    <div className="lottie-sparkline" role="group" aria-label="Frame complexity sparkline">
                      {profile.samples.map((s) => {
                        const pct =
                          profile.peakScore > 0
                            ? Math.max(12, Math.round((s.score / profile.peakScore) * 100))
                            : 12;
                        return (
                          <div
                            key={s.frame}
                            className={`lottie-sparkline-bar${s.frame === profile.peakFrame ? " peak" : ""}`}
                            style={{ height: `${pct}%` }}
                            title={`Frame ${s.frame}: ${s.activeLayers} layers, ${s.vertices} verts`}
                            onClick={() => {
                              setPlaying(false);
                              setFrame(s.frame);
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <div className="lottie-section-header">
                    <strong>Embed Snippet</strong>
                    <div className="lottie-pill-group">
                      {(["html", "react", "ios", "android"] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          aria-pressed={embedTab === tab}
                          onClick={() => setEmbedTab(tab)}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>
                  <pre className="lottie-embed-code" data-testid="lottie-embed-code">
                    {snippets[embedTab]}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="lottie-inspector-rail" aria-label="Animation anatomy">
          <div className="lottie-section">
            <strong>Metadata</strong>
            <div className="lottie-field-grid">
              <div>
                <span>Dimensions</span>
                <div>
                  <strong>
                    {inspection.width} × {inspection.height}
                  </strong>
                </div>
              </div>
              <div>
                <span>Frame Rate</span>
                <div>
                  <strong>{inspection.fps} fps</strong>
                </div>
              </div>
              <div>
                <span>Duration</span>
                <div>
                  <strong>
                    {inspection.durationSeconds}s ({inspection.totalFrames}f)
                  </strong>
                </div>
              </div>
              <div>
                <span>Bodymovin</span>
                <div>
                  <strong>v{inspection.version}</strong>
                </div>
              </div>
            </div>
            {governingDs && (
              <div>
                Governing DESIGN.md: <strong>{governingDs.title}</strong>
              </div>
            )}
          </div>

          <div className="lottie-section">
            <strong>Palette ({inspection.palette.length} colors)</strong>
            <div className="lottie-palette-grid">
              {inspection.palette.map((sw) => (
                <div key={sw.hex} className="lottie-swatch-row">
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      background: sw.hex,
                      display: "inline-block",
                    }}
                  />
                  <span className="lottie-swatch-hex">{sw.hex}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lottie-section">
            <strong>Layers ({inspection.layers.length})</strong>
            <ul className="lottie-layer-list">
              {inspection.layers.map((layer) => (
                <li key={layer.ind} className="lottie-layer-row">
                  <span className="lottie-layer-select-btn">
                    #{layer.ind} {layer.name}
                  </span>
                  <span className="lottie-layer-kind">{layer.kind}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function LottieFocusEdit(facts: FocusFacts) {
  const [initialRaw, setInitialRaw] = useState<string | null>(null);
  const [draftDoc, setDraftDoc] = useState<LottieDocument | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [frame, setFrame] = useState<number>(0);
  const [playing, setPlaying] = useState(false);
  const [soloLayerInd, setSoloLayerInd] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [newMarkerName, setNewMarkerName] = useState("");
  const [newMarkerFrame, setNewMarkerFrame] = useState("0");
  const [newMarkerDur, setNewMarkerDur] = useState("15");
  const readTextRef = useRef(facts.readText);
  readTextRef.current = facts.readText;

  useEffect(() => {
    let active = true;
    void readTextRef
      .current()
      .then((raw) => {
        if (!active) return;
        const parsed = parseLottieJson(raw);
        if ("error" in parsed) {
          setDraftDoc(null);
          setParseError(parsed.error);
          return;
        }
        const canonical = JSON.stringify(parsed, null, 2);
        setInitialRaw(canonical);
        setDraftDoc(parsed);
        setParseError(null);
        setFrame(parsed.ip);
      })
      .catch((err) => {
        if (active) setParseError((err as Error).message || "Unable to read animation");
      });
    return () => {
      active = false;
    };
  }, [facts.version.blobHash]);

  useEffect(() => {
    if (!draftDoc || !playing) return;
    if (typeof requestAnimationFrame === "undefined") return;
    const fps = Math.max(1, draftDoc.fr || 30);
    const ip = draftDoc.ip;
    const op = Math.max(ip + 1, draftDoc.op);
    const span = op - ip;
    let rafId = 0;
    let lastTs: number | null = null;

    const tick = (ts: number) => {
      if (lastTs === null) lastTs = ts;
      const dtSec = (ts - lastTs) / 1000;
      lastTs = ts;
      setFrame((prev) => {
        const next = prev + dtSec * fps;
        return next >= op ? ip + ((next - ip) % span) : next;
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [draftDoc, playing]);

  const inspection = useMemo(() => (draftDoc ? inspectLottie(draftDoc) : null), [draftDoc]);
  const palette = useMemo(
    () => (draftDoc ? extractLottiePalette(draftDoc) : []),
    [draftDoc],
  );
  const governingDs = useMemo(
    () => designSystem(facts.canvas, { at: facts.item }),
    [facts.canvas, facts.item],
  );
  const currentSerialized = useMemo(
    () => (draftDoc ? JSON.stringify(draftDoc, null, 2) : null),
    [draftDoc],
  );
  const dirty = initialRaw !== null && currentSerialized !== null && currentSerialized !== initialRaw;

  const svgMarkup = useMemo(
    () =>
      draftDoc
        ? renderLottieFrameSvg(draftDoc, frame, { soloLayerInd })
        : "",
    [draftDoc, frame, soloLayerInd],
  );

  if (parseError) {
    return (
      <div className="lottie-focus" data-testid="lottie-focus-edit-error">
        <div className="lottie-focus-toolbar">
          <strong>Lottie Error:</strong> <span>{parseError}</span>
        </div>
      </div>
    );
  }

  if (!draftDoc || !inspection) {
    return <div className="page-note">Loading Lottie studio…</div>;
  }

  const onSyncDesignSystem = async () => {
    if (!governingDs || !facts.canEdit) return;
    const dsVersion =
      governingDs.versions.find((v) => v.id === governingDs.currentVersionId) ??
      governingDs.versions[0];
    if (!dsVersion) return;
    try {
      const resp = await fetch(
        `/api/projects/${encodeURIComponent(facts.canvasId)}/blobs/${encodeURIComponent(dsVersion.blobHash)}`,
        { credentials: "include" },
      );
      if (!resp.ok) return;
      const dsText = await resp.text();
      const { doc: synced, remappedCount } = syncLottieToDesignSystem(draftDoc, dsText);
      setDraftDoc(synced);
      setStatusMsg(
        remappedCount > 0
          ? `Synced ${remappedCount} color occurrence(s) to ${governingDs.title}`
          : "Colors already aligned with DESIGN.md",
      );
    } catch {
      setStatusMsg("Could not fetch DESIGN.md blob");
    }
  };

  const onSetPosterFrame = async () => {
    if (!facts.canEdit) return;
    const poster = String(Math.round(frame));
    await facts.host.send(
      [
        {
          type: "item.update",
          itemId: facts.item.id,
          patch: {
            properties: {
              ...facts.item.properties,
              [LOTTIE_POSTER_FRAME_PROP]: poster,
            },
          },
        },
      ],
      newGroupId(),
    );
    setStatusMsg(`Set poster frame to f${poster}`);
  };

  const onSaveVersion = async () => {
    if (!facts.canEdit || saving || !dirty || !currentSerialized) return;
    setSaving(true);
    try {
      const filename = facts.version.filename || "animation.lottie.json";
      const uploaded = await facts.host.putBlob(
        new Blob([currentSerialized], { type: LOTTIE_JSON_MIME }),
        filename,
      );
      const versionId = newVersionId();
      await facts.host.send(
        [
          {
            type: "item.addVersion",
            itemId: facts.item.id,
            version: {
              id: versionId,
              blobHash: uploaded.blobHash,
              mimeType: LOTTIE_JSON_MIME,
              filename,
              size: uploaded.size,
            },
          },
        ],
        newGroupId(),
      );
      setInitialRaw(currentSerialized);
      setStatusMsg(`Stacked version (${versionId})`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lottie-focus" data-testid="lottie-focus-edit">
      <div className="lottie-focus-toolbar">
        <strong>Lottie Studio</strong>
        <span>
          {inspection.width}×{inspection.height} · {inspection.fps} fps · {inspection.layers.length} layers
        </span>
        {governingDs && (
          <button
            type="button"
            className="lottie-btn"
            disabled={!facts.canEdit}
            data-testid="lottie-sync-ds-btn"
            onClick={() => void onSyncDesignSystem()}
          >
            Sync to {governingDs.title}
          </button>
        )}
        <button
          type="button"
          className="lottie-btn"
          disabled={!facts.canEdit}
          data-testid="lottie-set-poster-btn"
          onClick={() => void onSetPosterFrame()}
        >
          Set Poster (f{Math.round(frame)})
        </button>

        <span className="spacer" />

        {statusMsg && (
          <span role="status" data-testid="lottie-edit-status">
            {statusMsg}
          </span>
        )}

        <button
          type="button"
          className="lottie-btn primary"
          disabled={!facts.canEdit || saving || !dirty}
          data-testid="lottie-save-version-btn"
          onClick={() => void onSaveVersion()}
        >
          {saving ? "Saving…" : dirty ? "Stack Animation Version" : "Saved"}
        </button>
      </div>

      <div className="lottie-focus-workspace">
        <div className="lottie-stage-column">
          <div className="lottie-stage-viewport backdrop-checker">
            <div
              className="lottie-stage-canvas"
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
          </div>

          <div className="lottie-transport-bar">
            <div className="lottie-transport-row">
              <button
                type="button"
                className="lottie-btn primary"
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? "Pause" : "Play"}
              </button>
              <input
                type="range"
                aria-label="Edit studio frame scrubber"
                min={draftDoc.ip}
                max={draftDoc.op}
                step={1}
                value={Math.round(frame)}
                onChange={(e) => {
                  setPlaying(false);
                  setFrame(Number(e.target.value));
                }}
              />
              <span className="lottie-frame-readout">
                f{Math.round(frame)}/{draftDoc.op}
              </span>
            </div>
          </div>
        </div>

        <aside className="lottie-inspector-rail" aria-label="Lottie edit inspector">
          {/* 1. Color Palette Map */}
          <div className="lottie-section">
            <div className="lottie-section-header">
              <span>Color Palette ({palette.length})</span>
            </div>
            <div className="lottie-palette-grid">
              {palette.map((sw) => (
                <label key={sw.hex} className="lottie-swatch-row">
                  <input
                    type="color"
                    aria-label={`Remap color ${sw.hex}`}
                    disabled={!facts.canEdit}
                    value={sw.hex}
                    onChange={(e) => {
                      const nextHex = e.target.value;
                      const { doc: nextDoc } = remapLottiePalette(draftDoc, {
                        [sw.hex]: nextHex,
                      });
                      setDraftDoc(nextDoc);
                    }}
                  />
                  <span className="lottie-swatch-hex">{sw.hex}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 2. Trim & Timing */}
          <div className="lottie-section">
            <div className="lottie-section-header">
              <span>Trim & Timing</span>
            </div>
            <div className="lottie-field-grid">
              <label className="lottie-field">
                <span>In Frame (ip)</span>
                <input
                  type="number"
                  aria-label="In Frame"
                  disabled={!facts.canEdit}
                  value={draftDoc.ip}
                  onChange={(e) =>
                    setDraftDoc(trimLottie(draftDoc, { ip: Number(e.target.value) }))
                  }
                />
              </label>
              <label className="lottie-field">
                <span>Out Frame (op)</span>
                <input
                  type="number"
                  aria-label="Out Frame"
                  disabled={!facts.canEdit}
                  value={draftDoc.op}
                  onChange={(e) =>
                    setDraftDoc(trimLottie(draftDoc, { op: Number(e.target.value) }))
                  }
                />
              </label>
              <label className="lottie-field">
                <span>FPS (fr)</span>
                <input
                  type="number"
                  aria-label="FPS"
                  disabled={!facts.canEdit}
                  value={draftDoc.fr}
                  onChange={(e) =>
                    setDraftDoc(trimLottie(draftDoc, { fr: Number(e.target.value) }))
                  }
                />
              </label>
            </div>
          </div>

          {/* 3. Named Markers */}
          <div className="lottie-section">
            <div className="lottie-section-header">
              <span>State Markers ({inspection.markers.length})</span>
            </div>
            <div className="lottie-markers-row">
              {inspection.markers.map((m) => (
                <span key={m.cm} className="lottie-marker-pill">
                  {m.cm} ({m.tm}+{m.dr}){" "}
                  {facts.canEdit && (
                    <button
                      type="button"
                      aria-label={`Remove marker ${m.cm}`}
                      onClick={() => setDraftDoc(removeLottieMarker(draftDoc, m.cm))}
                      style={{ border: "none", background: "transparent", cursor: "pointer" }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
            {facts.canEdit && (
              <div className="lottie-transport-row">
                <input
                  type="text"
                  placeholder="Marker name"
                  aria-label="New marker name"
                  value={newMarkerName}
                  onChange={(e) => setNewMarkerName(e.target.value)}
                  style={{ width: 90 }}
                />
                <input
                  type="number"
                  placeholder="tm"
                  aria-label="New marker start frame"
                  value={newMarkerFrame}
                  onChange={(e) => setNewMarkerFrame(e.target.value)}
                  style={{ width: 52 }}
                />
                <input
                  type="number"
                  placeholder="dr"
                  aria-label="New marker duration"
                  value={newMarkerDur}
                  onChange={(e) => setNewMarkerDur(e.target.value)}
                  style={{ width: 52 }}
                />
                <button
                  type="button"
                  className="lottie-btn"
                  onClick={() => {
                    const name = newMarkerName.trim();
                    if (!name) return;
                    setDraftDoc(
                      setLottieMarker(
                        draftDoc,
                        name,
                        Number(newMarkerFrame) || 0,
                        Number(newMarkerDur) || 0,
                      ),
                    );
                    setNewMarkerName("");
                  }}
                >
                  + Marker
                </button>
              </div>
            )}
          </div>

          {/* 4. Layer Tree & Subtarget Selection */}
          <div className="lottie-section">
            <div className="lottie-section-header">
              <span>Layers ({inspection.layers.length})</span>
              <small>Click to anchor Chat</small>
            </div>
            <ul className="lottie-layer-list">
              {inspection.layers.map((layer) => {
                const isSelected =
                  facts.subtarget?.kind === "lottie-layer" &&
                  facts.subtarget.id === String(layer.ind);
                const isSolo = soloLayerInd === layer.ind;
                return (
                  <li
                    key={layer.ind}
                    className={`lottie-layer-row${isSelected ? " selected" : ""}`}
                  >
                    <button
                      type="button"
                      className="lottie-layer-select-btn"
                      data-lottie-layer-select={layer.ind}
                      onClick={() => facts.setSubtarget(layerSubtargetFor(layer))}
                    >
                      #{layer.ind} {layer.name}
                    </button>
                    <span className="lottie-layer-kind">{layer.kind}</span>
                    <button
                      type="button"
                      className="lottie-btn"
                      aria-label={layer.hidden ? `Show layer ${layer.name}` : `Hide layer ${layer.name}`}
                      disabled={!facts.canEdit}
                      onClick={() =>
                        setDraftDoc(setLottieLayerHidden(draftDoc, layer.ind, !layer.hidden))
                      }
                    >
                      {layer.hidden ? "Hidden" : "Visible"}
                    </button>
                    <button
                      type="button"
                      className="lottie-btn"
                      aria-pressed={isSolo}
                      onClick={() =>
                        setSoloLayerInd((prev) => (prev === layer.ind ? null : layer.ind))
                      }
                    >
                      Solo
                    </button>
                    {layer.kind === "text" && layer.text !== undefined && facts.canEdit && (
                      <input
                        type="text"
                        aria-label={`Text for layer ${layer.name}`}
                        value={layer.text}
                        onChange={(e) =>
                          setDraftDoc(setLottieLayerText(draftDoc, layer.ind, e.target.value))
                        }
                        style={{ width: 80 }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
