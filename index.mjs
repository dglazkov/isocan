/**
 * **`import { connect } from "isocan"`** — the package's module entry
 * (iso-api phase 4; docs/projects/iso-api/design.md, "Distribution").
 *
 * The release branch ships TypeScript sources, so this is the bin's own trick
 * worn as a module: register tsx, register the workspace loader, and hand back
 * `@isocan/api`'s surface. Registration is process-global — acceptable for an
 * agent's script, and stated in the design; if it ever bites a real consumer,
 * the lever is a release-time compile, not a cleverer loader.
 *
 * The re-export is dynamic and NAMED, not `export * from`, because it cannot
 * be otherwise: static imports resolve while the module graph links, before
 * any line here runs, so a static re-export would look for `@isocan/api`
 * before the loader that knows where it lives exists. The name list is held
 * to the real surface by `packages/api/test/entry.test.ts`, which fails the
 * suite when the two drift.
 *
 * Types do not come through here at all — the manifest's `types` condition
 * points straight at `packages/api/src/index.ts`, so an editor reads the
 * sources this module runs.
 */
import { register as registerLoader } from "node:module";
import { register } from "tsx/esm/api";
register();
registerLoader("./packages/cli/bin/workspace-loader.mjs", import.meta.url);

const api = await import("@isocan/api");

export const {
  // connect.ts — the public surface
  connect,
  Home,
  CanvasHandle,
  activityRows,
  buildComment,
  // routes.ts / client.ts — the typed routes and the daemon lifecycle
  ApiError,
  DaemonClient,
  DaemonRoutes,
  resolveBase,
  baseForCwd,
  shaOfRoot,
  // ctx.ts — which home, which canvas
  DEFAULT_MODE,
  resolveCtx,
  resolveCanvas,
  resolveDeclared,
  matchRef,
  ensureDirBinding,
  homeAddressOf,
  readHomeRecord,
  // identity.ts / harness.ts — which actor
  HOME_CLAIM_KEY,
  adoptIdentity,
  builtinHarnesses,
  claimSessionIdentity,
  findSessionIdentity,
  harnessSessions,
  harnessVars,
  harnessVarsFor,
  noIdentityHere,
  readIdentity,
  reclaimIdentity,
  requireIdentity,
  resolveExplicitIdentity,
  resolveIdentity,
  resolved,
  retireStrandedIdentities,
  writeIdentity,
  // direct.ts — speaking to a canvas's home when it lives elsewhere
  DIRECT_VAR,
  refuseDaemonVerb,
} = api;
