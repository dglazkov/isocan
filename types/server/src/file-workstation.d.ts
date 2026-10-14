import type { Actor } from "../../core/src/index.js";
import type { Desk } from "./desk.js";
import type { Engine } from "./engine.js";
import { type GoogleToken } from "./google.js";
import { HomeLinks } from "./home-links.js";
import { type RuntimeModule } from "./modules.js";
import type { PresenceHub } from "./presence.js";
import type { RcHolds } from "./rc-holds.js";
import type { Store } from "./store.js";
import { type PickListing } from "./tree.js";
import type { Workstation } from "./workstation.js";
interface FileWorkstationOptions {
    home: string;
    birthHome: string | null;
    engine: Engine;
    presence: PresenceHub;
    rc?: RcHolds;
    homePollMs?: number;
    homeProbeMs?: number;
}
/**
 * **The file-backed local workstation** (`~/.isocan`).
 *
 * Instantiated ONLY by `daemon.ts` when the daemon is local (`ISOCAN_STORE !== "cloud"`
 * and `servesWorld !== true`). A hosted home gets `null` instead, so it never
 * creates `homes.json`, never dials outbound replica links, never reads local
 * `keys.json` or `identity.json`, and never exposes directory bindings.
 */
export declare class FileWorkstation implements Workstation {
    readonly homes: HomeLinks;
    readonly birthHome: string | null;
    readonly keysHome: string;
    private readonly home;
    constructor(options: FileWorkstationOptions);
    init(store: Store, desk: Desk): Promise<void>;
    setLocalPort(port: number): void;
    start(): Promise<void>;
    close(): Promise<void>;
    person(): Promise<{
        id: string;
        name: string;
    } | null>;
    adoptIdentity(actor: Actor): Promise<{
        actor: Actor;
        adopted: boolean;
    }>;
    googleToken(): Promise<GoogleToken | null>;
    boundDirs(canvasId: string): Promise<string[]>;
    pickList(at: string | null): Promise<PickListing | null>;
    bindableRoot(wanted: string): Promise<string | null>;
    recordDir(root: string, canvasId: string): Promise<void>;
    runtimeModules(): RuntimeModule[];
    moduleFile(slug: string, relative: string): string | null;
}
export {};
