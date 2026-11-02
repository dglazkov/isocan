import { promises as fs } from "node:fs";
import type { Actor } from "@isocan/core";
import { adoptIdentity } from "./badge-store.ts";
import { bindableRoot, recordDir } from "./binding.ts";
import type { Desk } from "./desk.ts";
import type { Engine } from "./engine.ts";
import { readGoogleToken, type GoogleToken } from "./google.ts";
import { HomeLinks } from "./home-links.ts";
import { runWorkstationMigrations } from "./migrations.ts";
import { moduleFile, readRuntimeModules, type RuntimeModule } from "./modules.ts";
import { identityFile } from "./paths.ts";
import type { PresenceHub } from "./presence.ts";
import type { RcHolds } from "./rc-holds.ts";
import type { Store } from "./store.ts";
import { boundDirs, pickList, type PickListing } from "./tree.ts";
import type { Workstation } from "./workstation.ts";

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
export class FileWorkstation implements Workstation {
  readonly homes: HomeLinks;
  readonly birthHome: string | null;
  readonly keysHome: string;
  private readonly home: string;

  constructor(options: FileWorkstationOptions) {
    this.home = options.home;
    this.keysHome = options.home;
    this.homes = new HomeLinks({
      home: options.home,
      engine: options.engine,
      presence: options.presence,
      birthHome: options.birthHome,
      ...(options.rc !== undefined ? { rc: options.rc } : {}),
      ...(options.homePollMs !== undefined ? { pollMs: options.homePollMs } : {}),
      ...(options.homeProbeMs !== undefined ? { probeMs: options.homeProbeMs } : {}),
    });
    this.birthHome = this.homes.birthHome;
  }

  async init(store: Store, desk: Desk): Promise<void> {
    await runWorkstationMigrations(this.home, store, desk, this.birthHome);
    await this.homes.load();
  }

  setLocalPort(port: number): void {
    this.homes.setLocalPort(port);
  }

  async start(): Promise<void> {
    await this.homes.start();
  }

  async close(): Promise<void> {
    await this.homes.close();
  }

  async person(): Promise<{ id: string; name: string } | null> {
    try {
      const raw = JSON.parse(await fs.readFile(identityFile(this.home), "utf8")) as {
        id?: unknown;
        name?: unknown;
      };
      return typeof raw.id === "string" && raw.id && typeof raw.name === "string"
        ? { id: raw.id, name: raw.name }
        : null;
    } catch {
      return null;
    }
  }

  adoptIdentity(actor: Actor): Promise<{ actor: Actor; adopted: boolean }> {
    return adoptIdentity(this.home, actor);
  }

  googleToken(): Promise<GoogleToken | null> {
    return readGoogleToken(this.home);
  }

  boundDirs(canvasId: string): Promise<string[]> {
    return boundDirs(this.home, canvasId);
  }

  pickList(at: string | null): Promise<PickListing | null> {
    return pickList(this.home, at);
  }

  bindableRoot(wanted: string): Promise<string | null> {
    return bindableRoot(wanted, this.home);
  }

  recordDir(root: string, canvasId: string): Promise<void> {
    return recordDir(this.home, root, canvasId);
  }

  runtimeModules(): RuntimeModule[] {
    return readRuntimeModules(this.home);
  }

  moduleFile(slug: string, relative: string): string | null {
    return moduleFile(this.home, slug, relative);
  }
}
