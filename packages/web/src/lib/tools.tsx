import { useEffect, useState } from "react";
import type { ExtensionIcon, ToolExtension } from "@isocan/core";
import { readToolExtension, toolCapabilities, toolExtensionItems } from "@isocan/core";
import { readBlobText } from "./api.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useCommands } from "./commands.ts";

/**
 * **The tools this canvas brought with it** — stage 1 of
 * `docs/projects/extensions/design.md`, on the web surface.
 *
 * A tool is an ordinary item with `role=tool` whose bytes are a small JSON
 * manifest, so this hook is the whole "loader": find the items, read their
 * bytes, hand them to core's reader. There is no other mechanism, because the
 * design's first tier is *no code at all* — the app renders the button, from
 * a manifest it validated, and the button's only power is to ask for a slash
 * command that already exists.
 *
 * **One reader, and it is core's.** `readToolExtension` is what `isocan tool
 * list` calls too, so a manifest the terminal refuses is a manifest the rail
 * refuses, with the same sentence. A second little parser here is how the two
 * surfaces would come to disagree about what a tool is.
 */
interface CanvasTool {
  itemId: string;
  /** The item's title, so an unavailable tool can still be named. */
  title: string;
  tool?: ToolExtension | undefined;
  /** Why this is not a tool, if it is not. Shown rather than swallowed: the
   * design's own open question is *what happens to a canvas whose extension is
   * gone*, and the answer is that the rail says a tool is unavailable rather
   * than silently dropping it. */
  problem?: string | undefined;
  can: string[];
}

export function useCanvasTools(canvasId: string): CanvasTool[] {
  const canvas = useCanvasStore((s) => s.canvas);
  const commands = useCommands();
  const [tools, setTools] = useState<CanvasTool[]>([]);

  // Keyed on the blob hashes rather than the canvas: a tool's manifest changes
  // only when a new version lands, and re-reading every bytes on every canvas
  // update would fetch on each pointer move.
  const items = canvas ? toolExtensionItems(canvas) : [];
  const key = items.map((i) => `${i.id}:${i.currentVersionId}`).join(",");

  useEffect(() => {
    if (!canvas) return;
    let alive = true;
    void Promise.all(
      toolExtensionItems(canvas).map(async (item): Promise<CanvasTool> => {
        const version = item.versions.find((v) => v.id === item.currentVersionId);
        if (!version) return { itemId: item.id, title: item.title, problem: "no version to read", can: [] };
        try {
          const text = await readBlobText(canvasId, version.blobHash);
          const { tool, problem } = readToolExtension(text, commands);
          return {
            itemId: item.id,
            title: item.title,
            tool,
            problem,
            can: tool ? toolCapabilities(tool, commands) : [],
          };
        } catch {
          // Offline, or a blob that has not reached this replica. Not an
          // error to throw at somebody: the button is absent and says why.
          return { itemId: item.id, title: item.title, problem: "its manifest could not be read here", can: [] };
        }
      }),
    ).then((read) => alive && setTools(read));
    return () => {
      alive = false;
    };
    // `key` rather than `canvas`, for the reason given where it is built: the
    // effect READS the whole canvas but only cares when a tool's version
    // changes, and depending on the canvas would re-fetch every manifest on
    // every pointer move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, key, commands]);

  return tools;
}

/**
 * **The icons a tool may wear, drawn by us.**
 *
 * Core owns the NAMES (`EXTENSION_ICONS`) and this owns the strokes, which is
 * the same split every other shared fact has: the rule travels to both
 * surfaces, the pixels do not. A closed set is a security decision — an icon
 * is a place somebody would otherwise paint anything at all, including a
 * convincing copy of a control that already exists.
 *
 * One viewBox, one stroke width, `currentColor` throughout, so a tool cannot
 * be off-brand by construction rather than by review.
 */
const PATHS: Record<ExtensionIcon, string> = {
  broom: "M9.5 2.5 7 8m0 0-3.5 1.2c-.6.2-.9.9-.6 1.5l1.4 2.6c.3.6 1 .8 1.6.5l5.6-3c.6-.3.8-1 .5-1.6L10.6 6.6c-.3-.6-1-.8-1.6-.5zM5 10.5l1.2 2.2M7.5 9.2l1.2 2.2M10 7.8l1.2 2.2",
  wand: "M3 13 11 5M9.5 3 10 4.6l1.6.5-1.6.5-.5 1.6-.5-1.6L7.4 5l1.6-.5zM13 8l.3 1 1 .3-1 .3-.3 1-.3-1-1-.3 1-.3z",
  check: "M3 8.5 6.2 12 13 4.5",
  star: "M8 2.5l1.7 3.5 3.8.5-2.8 2.7.7 3.8L8 11.2l-3.4 1.8.7-3.8L2.5 6.5l3.8-.5z",
  tag: "M8.6 2.5H13v4.4l-6 6a1 1 0 0 1-1.4 0L2.6 9.9a1 1 0 0 1 0-1.4zM10.8 5.2h.01",
  list: "M5.5 4.5H13M5.5 8H13M5.5 11.5H13M3 4.5h.01M3 8h.01M3 11.5h.01",
  eye: "M1.8 8S4.1 3.8 8 3.8 14.2 8 14.2 8 11.9 12.2 8 12.2 1.8 8 1.8 8zM9.9 8a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0z",
  bolt: "M8.8 1.8 3.5 9h3.7l-.9 5.2L12.5 7H8.8z",
  clock: "M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0zM8 4.6V8l2.2 1.3",
  flag: "M3.5 14V2.5m0 0h7.8l-1.5 2.6 1.5 2.6H3.5",
  link: "M6.6 9.4a2.6 2.6 0 0 0 3.8 0l2-2a2.7 2.7 0 0 0-3.8-3.8l-.5.5M9.4 6.6a2.6 2.6 0 0 0-3.8 0l-2 2a2.7 2.7 0 0 0 3.8 3.8l.5-.5",
  note: "M12.5 6.8V13a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h4.2zM8.7 2v3.8a1 1 0 0 0 1 1h2.8",
};

export function ToolGlyph({ icon }: { icon: ExtensionIcon }) {
  return (
    <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
      <path d={PATHS[icon]} />
    </svg>
  );
}

/** What the button's tooltip says: the ask, then what that means, so the rule
 * is legible from the rail rather than only from `isocan tool list`. */
export function toolHint(tool: CanvasTool): string {
  if (!tool.tool) return `${tool.title} — unavailable: ${tool.problem}`;
  return [`${tool.tool.label} — asks for ${tool.tool.does}`, ...tool.can].join("\n");
}
