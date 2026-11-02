import { useEffect, useState } from "react";
import type { RendererFacts } from "@isocan/core";
import { modulePagePath } from "@isocan/core";
import { NODE_MIME, PROJECT_MIME, RUN_MIME } from "./facts.ts";
import {
  AXIS_LABELS,
  nodeBodySchema,
  projectBodySchema,
  checkpointSchema,
  runCardSchema,
  runStateLine,
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
        /**
         * **The analysis request, which had no renderer at all.**
         *
         * `/anatomy` records a request as an item — it has to be one: an agent
         * claims it, polls it for `cancelRequested`, and completes it, and a
         * chat message cannot carry state anybody writes to. But with no
         * renderer for its mime the card fell through to the generic file
         * placeholder and a person saw `analysis-request.json
         * (application/vnd.isocan.anatomy-run+json)` on their canvas, which
         * tells them nothing they wanted to know and looks like a mistake.
         *
         * The repository first, because that is the question — *what did I
         * just ask about* — and then what is happening to the request, in the
         * same words the requests pane uses (`runStateLine`, one home).
         */
        if (mimeType === RUN_MIME) {
          const run = runCardSchema.parse(raw);
          return {
            label: "Analysis request",
            text: `${run.repository}\n${runStateLine(run)}${run.message ? `\n${run.message}` : ""}`,
            status: run.status,
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
