import type { CoreModule, ModuleKind } from "@isocan/core";

/**
 * **Diagrams as text** (`docs/projects/modules/design.md`, phase 2).
 *
 * A Mermaid file is the whole item: `text/vnd.mermaid`, the mime GitHub,
 * Obsidian and Notion already agree on, with `.mmd` as its extension. The
 * module adds one KIND and nothing else — no property key, no verb, no op.
 * `isocan add diagram.mmd` lands one because the CLI's mime table asks the
 * registry; a dropped file lands one because the web app's does; the card
 * and the stage draw it because the module's renderer claims the mime; and
 * with the module gone the same file is a document, readable as the text it
 * always was. That is the shape every node-type module should have, which is
 * why this is the first.
 */
export const MERMAID_MIME = "text/vnd.mermaid";

export const DIAGRAM_KIND: ModuleKind = {
  id: "diagram",
  mimes: [MERMAID_MIME],
  extensions: ["mmd", "mermaid"],
  label: "Diagrams",
  noun: "diagram",
  icon: "drawing",
};


export const mermaidModule: CoreModule = {
  name: "@isocan/mermaid",
  kinds: [DIAGRAM_KIND],
};

export default mermaidModule;
