/**
 * **Chrome as it comes, on every machine, owned by the script that started it.**
 *
 * `--disable-extensions`, because a managed Mac force-installs its policy
 * extensions into every new profile, headless ones included: eleven extension
 * targets in a profile a second old (14 Oct 2026). While they start, the page's
 * lazy chunks fail to load (`net::ERR_FAILED`, "Failed to fetch dynamically
 * imported module", a canvas that never opens), and now and then the page
 * stops answering. `scripts/journeys.mjs` measured it: 10 fresh browsers in 30
 * failed, 0 in 30 with the flag. A walk tests isocan in the browser CI has,
 * not in whatever a machine's policy adds.
 *
 * Owned like the daemon (`./daemon.mjs`): a script that is interrupted takes
 * its Chrome with it, and one that would not exit stays owned so the exit hook
 * does.
 *
 * Its own module rather than a line in `./browser.mjs`, because that file is
 * bundled into the release tree's `canvas shot` and is proven to import alone
 * (`test/browser-start.test.ts`); it must not grow a sibling import.
 * `scripts/journeys.mjs` still carries its own copy of this, from before it
 * was shared; it should import this one.
 */
import { browser } from "./browser.mjs";
import { reapOnExit } from "./daemon.mjs";

export async function ownBrowser() {
  const b = await browser({ args: ["--disable-extensions"] });
  const unreap = reapOnExit(b.pid);
  const close = b.close;
  b.close = async () => {
    await close();
    unreap();
  };
  return b;
}
