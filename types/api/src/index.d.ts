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
export * from "./connect.js";
export * from "./routes.js";
export * from "./client.js";
export * from "./ctx.js";
export * from "./identity.js";
export * from "./direct.js";
export * from "./harness.js";
