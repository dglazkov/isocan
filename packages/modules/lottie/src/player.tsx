import "./lottie.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RendererFacts } from "@isocan/core";
import {
  LOTTIE_POSTER_FRAME_PROP,
  inspectLottie,
  parseLottieJson,
  renderLottieFrameSvg,
  type LottieDocument,
} from "./core.ts";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function LottiePlayer(facts: RendererFacts) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [doc, setDoc] = useState<LottieDocument | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [loop, setLoop] = useState(true);
  const [frame, setFrame] = useState(0);

  const posterFrameProp = facts.item?.properties?.[LOTTIE_POSTER_FRAME_PROP];
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
        const initialFrame =
          posterFrameProp !== undefined && Number.isFinite(Number(posterFrameProp))
            ? Number(posterFrameProp)
            : parsed.ip;
        setFrame(Math.max(parsed.ip, Math.min(parsed.op, initialFrame)));
      })
      .catch((err) => {
        if (active) setParseError((err as Error).message || "Unable to read animation");
      });
    return () => {
      active = false;
    };
  }, [facts.blobHash, posterFrameProp]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setVisible(entry.isIntersecting);
      },
      { threshold: 0.05 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || !playing || !visible) return;
    if (typeof requestAnimationFrame === "undefined") return;
    const fps = Math.max(1, doc.fr || 30);
    const ip = doc.ip;
    const op = Math.max(ip + 1, doc.op);
    const span = op - ip;
    let rafId = 0;
    let lastTs: number | null = null;

    const tick = (ts: number) => {
      if (lastTs === null) lastTs = ts;
      const dtSec = (ts - lastTs) / 1000;
      lastTs = ts;
      setFrame((prev) => {
        const next = prev + dtSec * fps;
        if (next >= op) {
          if (!loop) {
            setPlaying(false);
            return op;
          }
          return ip + ((next - ip) % span);
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [doc, playing, visible, loop]);

  const summary = useMemo(() => (doc ? inspectLottie(doc) : null), [doc]);
  const svgMarkup = useMemo(
    () => (doc ? renderLottieFrameSvg(doc, frame) : ""),
    [doc, frame],
  );

  if (parseError) {
    return (
      <div className="lottie-card-player" data-testid="lottie-card-error">
        <div className="lottie-card-stage">
          <span>{parseError}</span>
        </div>
      </div>
    );
  }

  if (!doc || !summary) {
    return (
      <div className="lottie-card-player" ref={containerRef}>
        <div className="lottie-card-stage">
          <span>{facts.filename}</span>
        </div>
      </div>
    );
  }

  const compact = facts.presentation?.detail === "compact" || facts.presentation?.detail === "marker";

  return (
    <div
      className="lottie-card-player"
      ref={containerRef}
      data-testid="lottie-card-player"
      data-entered={facts.entered ? "true" : "false"}
    >
      <div
        className="lottie-card-stage"
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
      {!compact && !facts.entered && (
        <span className="lottie-card-badge" data-testid="lottie-card-badge">
          {summary.durationSeconds}s · {summary.fps} fps
        </span>
      )}
      {facts.entered && (
        <div
          className="lottie-card-mini-transport"
          data-testid="lottie-mini-transport"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label={playing ? "Pause animation" : "Play animation"}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <input
            type="range"
            aria-label="Scrub animation frame"
            min={doc.ip}
            max={doc.op}
            step={1}
            value={Math.round(frame)}
            onChange={(e) => {
              setPlaying(false);
              setFrame(Number(e.target.value));
            }}
          />
          <span>
            f{Math.round(frame)}/{doc.op}
          </span>
          <button
            type="button"
            aria-pressed={loop}
            onClick={() => setLoop((l) => !l)}
          >
            {loop ? "Loop" : "Once"}
          </button>
        </div>
      )}
    </div>
  );
}
