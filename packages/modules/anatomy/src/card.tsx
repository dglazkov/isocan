import { useEffect, useState } from "react";
import type { RendererFacts } from "@isocan/core";
import { modulePagePath } from "@isocan/core";
import { NODE_MIME, PROJECT_MIME } from "./manifest.ts";
import {
  AXIS_LABELS,
  nodeBodySchema,
  projectBodySchema,
  checkpointSchema,
} from "./schema.ts";
import "./style.css";

export default function Card({
  readText,
  mimeType,
  item,
  canvasId,
  presentation,
}: RendererFacts) {
  const [content, setContent] = useState<{
    label: string;
    text: string;
    status?: string;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setError("");
    setContent(null);
    readText()
      .then((text) => {
        const raw: unknown = JSON.parse(text);
        if (mimeType === NODE_MIME) {
          const node = nodeBodySchema.parse(raw);
          return {
            label: AXIS_LABELS[node.category],
            text: node.summary,
            status: node.status,
          };
        }
        if (mimeType === PROJECT_MIME) {
          const p = projectBodySchema.parse(raw);
          return {
            label: "Project anatomy",
            text:
              p.goalStatement ||
              "Define this project's Goal & Intent in Anatomy.",
          };
        }
        const c = checkpointSchema.parse(raw);
        return {
          label: "Checkpoint",
          text: `${c.nodes.length} concepts · ${c.convergenceScore}% settled\n${c.triggerDescription}`,
        };
      })
      .then((value) => {
        if (live) setContent(value);
      })
      .catch((err: Error) => {
        if (live) setError(err.message);
      });
    return () => {
      live = false;
    };
  }, [readText, mimeType]);
  return (
    <article className={`anatomy-card${presentation?.detail === "compact" ? " anatomy-card-compact" : ""}`}>
      <div className="anatomy-card-meta">
        <span>{content?.label ?? "Anatomy"}</span>
        {content?.status && (
          <span className={`anatomy-status anatomy-${content.status}`}>
            {content.status}
          </span>
        )}
      </div>
      <h2>{item?.title ?? "Anatomy file"}</h2>
      {presentation?.detail !== "compact" && <p>
        {error
          ? `Unable to read this file: ${error}`
          : (content?.text ?? "Loading…")}
      </p>}
      {mimeType === PROJECT_MIME && item && !presentation && (
        <a
          className="anatomy-card-open"
          href={`${modulePagePath(canvasId, "anatomy")}?project=${encodeURIComponent(item.id)}`}
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          Open Anatomy →
        </a>
      )}
    </article>
  );
}
