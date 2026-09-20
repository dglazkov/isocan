/**
 * **This copy's root**, cached, since every command asks and the answer
 * cannot change while a process runs. `from` exists so a caller in another
 * tree can ask about that one; the default is this module's own location,
 * which in the bundle is the bundle's.
 */
export declare function packageRoot(from?: string): string;
/** A file inside this copy: `packagePath("packages/web/dist", "index.html")`. */
export declare function packagePath(...parts: string[]): string;
/**
 * **The executable a copy of isocan declares**, for the two places that spawn
 * one — the API starting a daemon, and `restart` reaching an older install.
 *
 * Read from that copy's own manifest rather than written down here, because
 * the answer differs by copy: a checkout's bin is the tsx launcher
 * `packages/cli/bin/isocan.js`, and the release branch's is the bundle
 * `packages/cli/dist/isocan.mjs`. Spawning the wrong one is the failure this
 * prevents — a bundled install has no `bin/isocan.js` at all.
 *
 * The fallback is the checkout's, for a tree whose manifest cannot be read;
 * an ENOENT from the spawn is a better error than one from here.
 */
export declare function packageBin(root?: string): string;
