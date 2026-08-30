import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cloudAgentInstructions } from "@isocan/core";

/**
 * **Scene 6's door** — "Run an agent in the cloud…", under your own face.
 *
 * This exists because of how the gap was found. The mechanism of direct mode
 * was built and tested first, and the scene still could not be walked: the
 * dialog Scene 6 opens with was named in `journey.md` and in no phase, so
 * there was a verifiable CLI and an unwalkable journey. The lesson is that a
 * scene's UI is load-bearing, and prose in the journey reads like description
 * rather than like work.
 *
 * There is no DOM in this suite, and `IdentityMenu` cannot even be imported
 * without one (`theme.ts` reads `window.matchMedia` at module load). So these
 * read the source, which is `chrome.test.ts`'s established pattern for the
 * same problem — enough to catch an entry that vanished or lost its guard, not
 * enough to press it. The pressing was done by driving Chrome, and the report
 * says so.
 */

const menu = readFileSync(
  fileURLToPath(new URL("../src/components/IdentityMenu.tsx", import.meta.url)),
  "utf8",
);

describe("the door Scene 6 opens with", () => {
  it("sits under your own face, beside Scene 5's", () => {
    expect(menu).toContain("Run an agent in the cloud…");
    // Beside its sibling, never instead of it: they are two different answers
    // to "extend my reach" and a person picks between them.
    expect(menu).toContain("Bring your own agent…");
    // The order is the order a person meets them — your own machine is the
    // obvious answer, the cloud is what you reach for after a lid has taken
    // your agent with it.
    expect(menu.indexOf("Bring your own agent…")).toBeLessThan(
      menu.indexOf("Run an agent in the cloud…"),
    );
  });

  it("is behind the same canvas guard its sibling is, because a pass names one", () => {
    // The canvas list is not a canvas: with no canvas there is nothing to
    // escalate onto, and the entry would mint nothing and refuse. Both doors
    // sit inside `canvasId && (...)` blocks, and this is what fails if one
    // gets hoisted out of its guard.
    const cloud = menu.slice(menu.indexOf("Run an agent in the cloud…"));
    expect(cloud).toContain("</button>");
    const guardBefore = menu.slice(0, menu.indexOf("Run an agent in the cloud…"));
    expect(guardBefore.lastIndexOf("{canvasId && (")).toBeGreaterThan(
      guardBefore.lastIndexOf("</button>"),
    );
  });

  it("opens the dialog rather than a second panel beside the menu", () => {
    // The menu takes the dialog over, the way every other entry here does —
    // two stacked panels hanging off one face is a worse thing to look at.
    expect(menu).toContain("setCloud(true)");
    expect(menu).toMatch(/if \(cloud && canvasId\) \{[\s\S]*?CloudAgentDialog/);
  });
});

describe("what the dialog hands over", () => {
  /**
   * The line itself is built in core and tested there. What matters HERE is
   * the property that made it a separate builder rather than a second call to
   * `setupCommand`: it declares direct mode, so the person types nothing and
   * nothing guesses. A regression to `setupCommand` would leave an agent
   * building a replica inside a sandbox that is about to be deleted — and
   * every other test in this repo would still pass.
   */
  it("declares direct mode, so a disposable workspace keeps no copy", () => {
    const line = cloudAgentInstructions("https://isocan.io", "prj_acme", "pss_1.s3cret");
    expect(line).toContain("ISOCAN_DIRECT=1");
    expect(line).toContain("https://isocan.io/p/prj_acme#pss_1.s3cret");
    // And it ends at the protocol, because an agent that sets itself up and
    // exits is not on the canvas — which is the whole thing Inna came here
    // for. `--agent-help` is where parking is defined; the line used to name
    // `isocan wait` itself and stopped, which paraphrased one step of a guide
    // that ships with the build.
    expect(line).toContain("isocan --agent-help");
  });
});
