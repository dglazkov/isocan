/**
 * **The daemon is NOT here, and that is the point** (phase 3 of
 * `docs/projects/first-minute`).
 *
 * This index used to re-export `startDaemon`, `runDaemon`, `stopDaemons` and
 * one constant from `http.ts`. Sixteen files in the CLI and the API import
 * this module for `paths`, `readConfigFile` or `readBadge` — and every one of
 * them was therefore importing fastify. Measured in the bundle: `isocan
 * --version` loaded a 2.1 MB chunk of fastify and its plugins to print a
 * version string, 1.3 MB of the 5.8 MB it read at startup.
 *
 * So the daemon has its own entry, `@isocan/server/daemon`, and the CLI's
 * `serve` reaches it with `await import()`. Its TYPES stay below, because a
 * type import is erased and costs nothing. The constant went with no
 * replacement: nothing outside `http.ts` ever used it.
 */
export type { Daemon, DaemonOptions, RunDaemonOptions } from "./daemon.js";
export { Engine, CanvasNotFoundError, NothingToUndoError } from "./engine.js";
export type { BlobListing, BlobMeta, BlobUploadRequest, LoadedCanvas, PurgeReport, Store, } from "./store.js";
export { FileStore } from "./file-store.js";
export type { Desk, BadgeRecord, Admission, PassRecord, Provenance, BadgeKind } from "./desk.js";
export { FileDesk } from "./file-desk.js";
/**
 * `liveAdmission` crosses the package boundary because the second desk backing
 * has to ask it too (operator phase 2): "an admission that has run out is
 * replaced, not kept" is one rule, and two backings that each had their own
 * copy of it would be two rules.
 */
export { admissionIn, liveAdmission, rungOfAdmission, keepsAdmission } from "./grants.js";
export { Refusals, TakenDownError, RefusedError } from "./takedowns.js";
export { readConfigFile, resolveHomeUrl, updateConfigFile } from "./config.js";
export { DocRefusal, clearGoogleToken, driveAccount, driveModifiedTime, fetchGoogleDoc, googleTokenFile, readGoogleToken, writeGoogleToken, type FetchedDoc, type GoogleToken, } from "./google.js";
export type { HomeConfig } from "./config.js";
export { adoptIdentity, askTheDoor, bearerHeader, fileBadgeStore, knockOnDoor, readBadge, writeBadge, writeIdentityName } from "./badge-store.js";
export type { BadgeStore, DoorAnswer, StoredBadge } from "./badge-store.js";
export { MINT_PER_MINUTE, TOO_MANY_BADGES } from "./meter.js";
export { HomeLink, HomeRefusedError, HomeUnreachableError } from "./home-link.js";
export type { HomeConnection, HomeDirectory, HomeHandshakes, HomeHello, HomeRegistry, } from "./home-link.js";
export { HomeLinks } from "./home-links.js";
export type { HomeLinksOptions } from "./home-links.js";
export { homesRecorded, readHomes, writeHomes } from "./homes.js";
export type { HomeAssignments } from "./homes.js";
export { buildStamp, describeBuild, plausibleSha, stalenessOf, upgradeVerdict } from "./build.js";
export type { BuildStamp, HomeBuild } from "./build.js";
export * as paths from "./paths.js";
export { modulesDir, readRuntimeModules, type RuntimeModule } from "./modules.js";
/**
 * Binding: which directory a canvas means on this machine. It lived in the
 * CLI until the app needed to bind without one — the daemon is the only party
 * that can name a directory, so the primitives belong beside the filesystem
 * and both surfaces call them (`docs/research/2026-08-26-attaching-a-directory.md`).
 */
export { bindableRoot, dirsOf, findBinding, markerFile, readMarker, recordDir, writeMarker, } from "./binding.js";
export type { DirBinding, DirMarker } from "./binding.js";
export * from "./personas.js";
export * from "./personal-desk.js";
export type { CanvasLifecycle } from "./store.js";
