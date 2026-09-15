/**
 * **The isomorphic API** — the CLI's middle layer, named and moved
 * (docs/projects/iso-api/design.md, phase 1).
 *
 * One Node client for the daemon, owned here and consumed by `@isocan/cli`:
 * the typed route surface (`routes.ts`), the daemon lifecycle around it
 * (`client.ts`), which home and which canvas (`ctx.ts`, `direct.ts`), and
 * which actor (`identity.ts`, `harness.ts`).
 *
 * Workspace-internal for now, deliberately: the root manifest advertises no
 * `exports` entry until phase 4 makes the install line true, so nothing
 * outside this repository is invited in yet.
 *
 * `connect.ts` is the public surface (phase 2): a home handle whose canvases
 * open by ref, identity as a parameter, content as values, ops returning what
 * they made. Everything else here is the layer underneath it — shared with
 * the CLI, which consumes the same resolution and adds argv.
 */
export * from "./connect.ts";
export * from "./context-summary.ts";
export * from "./design-audit.ts";
export * from "./design-audit-reader.ts";
export * from "./questionnaire-reader.ts";
export * from "./questionnaire.ts";
export * from "./design-request-reader.ts";
export * from "./design-request.ts";
export * from "./design-decision-reader.ts";
export * from "./design-decision.ts";
export * from "./feedback.ts";
export * from "./canvas-groups.ts";
export type { ContextReadOptions, CommentContextOptions, ContextPageOptions, ContextBytesOptions, ContextItemContent } from "./canvas-context.ts";
export type { CanvasGroupCopyOptions } from "./canvas-groups.ts";
export * from "./operation-receipt.ts";
export * from "./routes.ts";
export * from "./client.ts";
export * from "./ctx.ts";
export * from "./identity.ts";
export * from "./direct.ts";
export * from "./harness.ts";
export * from "./export.ts";
/** The address helpers, from core, for a script or a host beside `connect`:
 * compose a pass address, read one a person pasted, ask whether a home is
 * this machine. The same three `isocan/rc` hands a host with no Node. */
export { canvasUrlWithPass, isLoopbackBase, parseCanvasAddress, type CanvasAddress } from "@isocan/core";
export * from "./design-system-reader.ts";
export * from "./design-system.ts";
export * from "./design-recipes.ts";
