/**
 * **What the shell may know about Anatomy without downloading Anatomy.**
 *
 * Separated from `manifest.ts` on 13 Sep, and the separation is the point
 * rather than tidiness. `activation.ts` needs the mimes, the kinds and
 * `projectsOn` to decide whether this canvas has anything to do with Anatomy.
 * `manifest.ts` also holds `anatomyModule`, whose `edges` and `contextPieces`
 * close over the graph maths, and 2,329 bytes of instructions for an agent.
 *
 * While both lived in one file the deferral bought nothing. Rollup will shake
 * out an unused export, but `web.tsx` in a lazy chunk and `activation.ts` in
 * the eager one were reaching into the SAME module, so what they share is
 * hoisted to the chunk that loads first — the entry. Measured either way:
 * 748,173 bytes, before this file existed.
 *
 * The rule for what belongs here: a constant, or a predicate over a canvas the
 * shell already holds. Nothing that draws, nothing an agent reads, and nothing
 * that walks the graph.
 */
import type { CanvasContents, Item, ModuleKind, SlashCommand } from "@isocan/core";
import type { AnatomyProject } from "./schema.ts";

export const PROJECT_MIME = "application/vnd.isocan.anatomy-project+json";
export const NODE_MIME = "application/vnd.isocan.anatomy-node+json";
export const RUN_MIME = "application/vnd.isocan.anatomy-run+json";
export const CHECKPOINT_MIME = "application/vnd.isocan.anatomy-checkpoint+json";
export const PROP = {
  project: "anatomy.project",
  origin: "anatomy.origin",
  parent: "anatomy.parent",
  relation: "anatomy.parentRelation",
  edges: "anatomy.edges",
  source: "anatomy.source",
  analysis: "anatomy.analysis",
  repository: "anatomy.repository",
  requestTarget: "anatomy.requestTarget",
} as const;
export const NODE_SIZE = { width: 320, height: 210 };
export const currentVersion = (item: Item) =>
  item.versions.find((v) => v.id === item.currentVersionId)!;
export const hasMime = (item: Item, mime: string) =>
  currentVersion(item)?.mimeType === mime;
export const projectsOn = (canvas: CanvasContents) =>
  Object.values(canvas.items).filter((i) => i.versions.some(v => v.mimeType === PROJECT_MIME));
export const nodesOn = (canvas: CanvasContents, projectId: string) =>
  Object.values(canvas.items).filter(
    (i) => i.properties[PROP.project] === projectId && i.versions.some(v => v.mimeType === NODE_MIME),
  );
export const checkpointsOn = (canvas: CanvasContents, projectId: string) =>
  Object.values(canvas.items).filter(
    (i) =>
      i.properties[PROP.project] === projectId && i.versions.some(v => v.mimeType === CHECKPOINT_MIME),
  );
export const originId = (item: Item) => item.properties[PROP.origin] ?? item.id;

/**
 * **The command's metadata, apart from its body.** The body is instructions
 * for an agent and the browser never runs them, so the palette gets the name,
 * the usage and one line of description and nothing else.
 * `design-competition` splits the same way, for the same reason.
 */
export const ANATOMY_COMMAND_METADATA = {
      name: "anatomy",
      usage: "[repository path or URL]",
      source: "module",
      description:
        "Analyze this project's repository as concepts, decisions and evidence",
} satisfies Omit<SlashCommand, "body">;

/** The four kinds, named here so the activation record can list them without
 *  reaching for `anatomyModule` and everything it closes over. */
export const ANATOMY_KINDS: readonly ModuleKind[] = [
    { id: "anatomy-run", mimes: [RUN_MIME], label: "Analysis requests", noun: "analysis request", icon: "file" },
    {
      id: "anatomy-project",
      mimes: [PROJECT_MIME],
      label: "Anatomy projects",
      noun: "Anatomy project",
      icon: "file",
    },
    {
      id: "anatomy-node",
      mimes: [NODE_MIME],
      label: "Concepts",
      noun: "concept",
      icon: "file",
    },
    {
      id: "anatomy-checkpoint",
      mimes: [CHECKPOINT_MIME],
      label: "Checkpoints",
      noun: "checkpoint",
      icon: "file",
    },
];
