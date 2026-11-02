import type { Actor } from "@isocan/core";
import type { Desk } from "./desk.ts";
import type { GoogleToken } from "./google.ts";
import type { HomeLinks } from "./home-links.ts";
import type { RuntimeModule } from "./modules.ts";
import type { Store } from "./store.ts";
import type { PickListing } from "./tree.ts";

/**
 * **The local workstation seam** (`Workstation | null`).
 *
 * `Store` is replicated canvas state; `Desk` is a home's private ledgers;
 * `Workstation` is the single-user machine and outbound replica state that
 * exists ONLY when a daemon runs on somebody's own computer (`FileWorkstation`)
 * and is `null` on a hosted home (`ISOCAN_STORE=cloud` or `servesWorld: true`).
 *
 * Making this `Workstation | null` rather than scattering `home: string` path
 * parameters across routes turns "a hosted home cannot become a replica, spend
 * a local `keys.json`, or touch local directories" from a convention each
 * route has to remember into a property of composition: there is no
 * `Workstation` object on a hosted home to ask.
 *
 * Like `store.ts` and `desk.ts`, this file has NO runtime imports.
 */
export interface Workstation {
  /** Outbound replica connections and `homes.json` assignments. */
  readonly homes: HomeLinks;
  /** Where a canvas born here, naming nothing, is born — or null when it stays here. */
  readonly birthHome: string | null;
  /** Directory holding `keys.json` and `models/` for local key/model routes. */
  readonly keysHome: string;

  /** Run local disk migrations and load `homes.json` before serving. */
  init(store: Store, desk: Desk): Promise<void>;
  /** Record the bound loopback port so `HomeLinks` refuses self-links. */
  setLocalPort(port: number): void;
  /** Start background replica polling once the HTTP listener is up. */
  start(): Promise<void>;
  /** Stop background replica links and drain writes to `homes.json`. */
  close(): Promise<void>;

  /** The machine's person (`identity.json`), or null if none is recorded. */
  person(): Promise<{ id: string; name: string } | null>;
  /** Record or adopt `identity.json` on this machine after redeeming a pass. */
  adoptIdentity(actor: Actor): Promise<{ actor: Actor; adopted: boolean }>;
  /** This machine's saved Google Drive token (`google.json`), or null. */
  googleToken(): Promise<GoogleToken | null>;

  /** Directories bound to `canvasId` in `dirs.json`. */
  boundDirs(canvasId: string): Promise<string[]>;
  /** Directory picker listing under `$HOME`, or null when outside the jail. */
  pickList(at: string | null): Promise<PickListing | null>;
  /** Resolve the bindable root (git toplevel or dir) for `wanted`, or null if refused. */
  bindableRoot(wanted: string): Promise<string | null>;
  /** Record a directory binding in `dirs.json`. */
  recordDir(root: string, canvasId: string): Promise<void>;

  /** Runtime modules installed under `<home>/modules/`. */
  runtimeModules(): RuntimeModule[];
  /** Verified path to a file inside a loaded runtime module, or null. */
  moduleFile(slug: string, relative: string): string | null;
}
