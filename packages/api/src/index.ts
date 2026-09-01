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
 * outside this repository is invited in yet. The public `connect()` surface
 * is phase 2's.
 */
export * from "./routes.ts";
export * from "./client.ts";
export * from "./ctx.ts";
export * from "./identity.ts";
export * from "./direct.ts";
export * from "./harness.ts";
