export { startDaemon, runDaemon, stopDaemons } from "./daemon.ts";
export type { Daemon, DaemonOptions, RunDaemonOptions } from "./daemon.ts";
export { Engine, CanvasNotFoundError, NothingToUndoError } from "./engine.ts";
export type {
  BlobListing,
  BlobMeta,
  BlobUploadRequest,
  LoadedCanvas,
  Store,
} from "./store.ts";
export { FileStore } from "./file-store.ts";
export type { Desk, BadgeRecord, Admission, PassRecord, Provenance, BadgeKind } from "./desk.ts";
export { FileDesk } from "./file-desk.ts";
export { readConfigFile, resolveHomeUrl, updateConfigFile } from "./config.ts";
export {
  DocRefusal,
  clearGoogleToken,
  driveAccount,
  driveModifiedTime,
  fetchGoogleDoc,
  googleTokenFile,
  readGoogleToken,
  writeGoogleToken,
  type FetchedDoc,
  type GoogleToken,
} from "./google.ts";
export type { HomeConfig } from "./config.ts";
export { askTheDoor, bearerHeader, knockOnDoor, readBadge, writeBadge } from "./badge-store.ts";
export type { DoorAnswer, StoredBadge } from "./badge-store.ts";
export { MINT_PER_MINUTE, TOO_MANY_BADGES } from "./meter.ts";
export { HomeLink, HomeRefusedError, HomeUnreachableError } from "./home-link.ts";
export type {
  HomeConnection,
  HomeDirectory,
  HomeHandshakes,
  HomeHello,
  HomeRegistry,
} from "./home-link.ts";
export { HomeLinks } from "./home-links.ts";
export type { HomeLinksOptions } from "./home-links.ts";
export { homesRecorded, readHomes, writeHomes } from "./homes.ts";
export type { HomeAssignments } from "./homes.ts";
export { HOME_HEADER } from "./http.ts";
export { buildStamp, describeBuild, plausibleSha, stalenessOf, upgradeVerdict } from "./build.ts";
export type { BuildStamp, HomeBuild } from "./build.ts";
export * as paths from "./paths.ts";
export { modulesDir, readRuntimeModules, type RuntimeModule } from "./modules.ts";
/**
 * Binding: which directory a canvas means on this machine. It lived in the
 * CLI until the app needed to bind without one — the daemon is the only party
 * that can name a directory, so the primitives belong beside the filesystem
 * and both surfaces call them (`docs/research/2026-08-26-attaching-a-directory.md`).
 */
export {
  bindableRoot,
  dirsOf,
  findBinding,
  markerFile,
  readMarker,
  recordDir,
  writeMarker,
} from "./binding.ts";
export type { DirBinding, DirMarker } from "./binding.ts";
export * from "./personas.ts";
