export { startDaemon, runDaemon, stopDaemons } from "./daemon.js";
export type { Daemon, DaemonOptions, RunDaemonOptions } from "./daemon.js";
export { Engine, CanvasNotFoundError, NothingToUndoError } from "./engine.js";
export type { BlobListing, BlobMeta, BlobUploadRequest, LoadedCanvas, Store, } from "./store.js";
export { FileStore } from "./file-store.js";
export type { Desk, BadgeRecord, Admission, PassRecord, Provenance, BadgeKind } from "./desk.js";
export { FileDesk } from "./file-desk.js";
export { readConfigFile, resolveHomeUrl, updateConfigFile } from "./config.js";
export { DocRefusal, clearGoogleToken, driveAccount, driveModifiedTime, fetchGoogleDoc, googleTokenFile, readGoogleToken, writeGoogleToken, type FetchedDoc, type GoogleToken, } from "./google.js";
export type { HomeConfig } from "./config.js";
export { askTheDoor, bearerHeader, knockOnDoor, readBadge, writeBadge } from "./badge-store.js";
export type { DoorAnswer, StoredBadge } from "./badge-store.js";
export { MINT_PER_MINUTE, TOO_MANY_BADGES } from "./meter.js";
export { HomeLink, HomeRefusedError, HomeUnreachableError } from "./home-link.js";
export type { HomeConnection, HomeDirectory, HomeHandshakes, HomeHello, HomeRegistry, } from "./home-link.js";
export { HomeLinks } from "./home-links.js";
export type { HomeLinksOptions } from "./home-links.js";
export { homesRecorded, readHomes, writeHomes } from "./homes.js";
export type { HomeAssignments } from "./homes.js";
export { HOME_HEADER } from "./http.js";
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
