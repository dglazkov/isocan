import type { Canvas, CanvasContents, CoreModule } from "@isocan/core";
import {
  ANATOMY_COMMAND_METADATA,
  ANATOMY_KINDS,
  CHECKPOINT_MIME,
  NODE_MIME,
  PROJECT_MIME,
  RUN_MIME,
  PROP,
  projectsOn,
} from "./facts.ts";

/**
 * **What the shell knows about anatomy before it downloads it.**
 *
 * Anatomy is a module for a subset of canvases — the ones somebody has run an
 * analysis on — and until this record existed every canvas paid 7,039 bytes of
 * entry chunk for it: the module's core record, which closes over the graph
 * helpers through `edges` and `contextPieces`, plus 2,329 bytes of agent
 * prompt that a browser never runs.
 *
 * So it arrives the way `design-competition` does, through `deferredModule`:
 * this record is what sits in the registry, and the real web half is imported
 * the first time something asks it to draw. On a canvas with no Anatomy items
 * the import never happens; on one that has them it happens right after first
 * paint and the module replaces this record, `edges` and `contextPieces`
 * included.
 *
 * Every field here is either a small constant or a predicate over the canvas
 * the shell already holds. Nothing in it can draw, which is what keeps it
 * cheap — the drawing is `component`, and every component is `lazy`.
 */
export const anatomyActivation = {
  core: {
    name: "@isocan/anatomy",
    propertyKeys: Object.values(PROP),
    kinds: ANATOMY_KINDS,
    /* The palette needs the name and the one-line description; the body is
       instructions for an agent and stays in the loaded half. */
    commands: [{ ...ANATOMY_COMMAND_METADATA, body: "" }],
  } satisfies CoreModule,
  renderers: [{ mimes: [PROJECT_MIME, NODE_MIME, CHECKPOINT_MIME, RUN_MIME] }],
  /** The underlay draws project edges, so it is worth loading only where a
   *  project is. `projectsOn` is a scan of the items the shell already has. */
  underlays: [{ needed: (canvas: CanvasContents) => projectsOn(canvas).length > 0 }],
  workspaces: [
    {
      segment: "anatomy",
      label: "Anatomy",
      hint: "Explore concepts, decisions and evidence",
      cli: "anatomy show",
      /* The same answer the loaded half gives, because the Toolbar asks this
         on every project canvas and must not be the thing that downloads the
         module. Both spellings of the entry are here so the row reads right
         before anything is fetched. */
      projectEntry: ({ project, canvas }: { project: Canvas; canvas: CanvasContents }) => {
        const hasAnalysis = projectsOn(canvas).length > 0;
        return hasAnalysis || project.properties[PROP.repository] || project.properties.repository
          ? { label: hasAnalysis ? "Anatomy" : "Analyze repository", glyph: "\u25C8" }
          : null;
      },
    },
  ],
};
