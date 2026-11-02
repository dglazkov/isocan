import { spawn } from "node:child_process";

/**
 * **How this machine opens an address, said once.**
 *
 * Three verbs open a browser — `isocan open`, `isocan setup`, and the operator's
 * proof and look — and until now each spelled the spawn itself. A second
 * spelling of "how do you open a browser here" is a second thing to get wrong
 * on a machine that has no session, no display, or no business opening windows
 * at all, which is exactly what happened: the operator verbs landed on 12–13
 * September and a test run started putting browser windows on somebody's
 * screen.
 *
 * **`ISOCAN_BROWSER=none` means print it, do not open it.** The callers all
 * print the address anyway — that is the rule the operator's opener already
 * stated, because a machine with no browser still needs the line — so refusing
 * to spawn loses nothing and is the whole difference between a test suite and
 * a poltergeist. `test/setup.ts` sets it for every worker, and the CLI children
 * a test spawns inherit it through `{ ...process.env }`, so a test cannot open
 * a window by forgetting to ask not to.
 *
 * It is a person's switch as well as a harness one: over SSH, in a container,
 * or on a machine where the browser is not where the work is, `ISOCAN_BROWSER=none`
 * makes every verb hand you the address instead of throwing a window at a
 * display you are not looking at.
 *
 * **Any other value is the command to run**, which is how a test watches the
 * opening happen without a window: `pass.test.ts` points it at a shell script
 * that records the address it was handed, and then asserts the tab would have
 * arrived holding a pass. A switch with only two positions would have made that
 * test unwritable, and it is the one test that proves `isocan open` escalates
 * the browser and prints a line with no credential in it.
 */
export function openInBrowser(url: string): void {
  const chosen = process.env["ISOCAN_BROWSER"]?.trim();
  if (chosen === "none") return;
  const opener = chosen || (process.platform === "darwin" ? "open" : "xdg-open");
  /**
   * **A machine with no opener is a report line, not a crash** (17 Sep 2026).
   * A Codespace has no `xdg-open`, and `spawn` reports that as an `error`
   * event on the child — unhandled, it took `isocan setup` down after the
   * report was printed, with a stack trace where the next step should be.
   * The callers already print the address, so the address is not lost; what
   * is said here is why no window came, and the switch that stops the try.
   */
  const child = spawn(opener, [url], { stdio: "ignore", detached: true });
  child.on("error", (err: NodeJS.ErrnoException) => {
    const why = err.code === "ENOENT" ? `no \`${opener}\` on this machine` : err.message;
    console.error(`could not open a browser here (${why}) — the address is printed above; ISOCAN_BROWSER=none stops the attempt`);
  });
  child.unref();
}
