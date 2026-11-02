/**
 * **How many modules does one isocan command load?**
 *
 *   ISOCAN_MODULE_LOG=/tmp/log node --import ./test/lib/count-modules.mjs \
 *     packages/cli/dist/isocan.mjs --version
 *
 * The number this takes is the one `docs/projects/first-minute/design.md`
 * opens with: `isocan --version` loaded 456 modules, 297 of them our own `.ts`
 * files, every one of them transpiled or cache-checked by tsx on every single
 * command. A laptop hides that — the whole command is 0.3 s there — and a
 * hosted sandbox that intercepts file system calls does not, which is why
 * `packages/cli/test/bundle.test.ts` holds a ceiling on it.
 *
 * Preloaded with `--import` so the hook is registered before the entry point
 * is resolved; `count-hook.mjs` does the writing, from the hooks thread.
 */
import { register } from "node:module";

register("./count-hook.mjs", import.meta.url);
