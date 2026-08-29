import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CANVAS_PATH_PREFIX,
  CANVAS_ROUTE,
  INSTALL_SPEC,
  canvasPath,
  canvasUrl,
  canvasUrlWithPass,
  parseCanvasAddress,
  setupCommand,
  cloudAgentInstructions,
  splitPassFragment,
} from "../src/address.ts";

/**
 * **One spelling of a canvas's address.**
 *
 * The bug this guards against was measured, not imagined: the docs wrote
 * `isocan.io/c/7f3a…`, the app served `/p/:canvasId`, and nothing anywhere
 * reconciled them — so a doc-shaped share link returned 200, served the app
 * shell, matched no route, and rendered a **blank page**. Dimitri settled the
 * address on 2026-08-23 (keep `/p/`, fix the docs) and left the underlying
 * canvas-versus-project rename for later; it landed in phase 13.5.
 *
 * The settlement is only worth as much as the thing that keeps it true. So:
 * the prefix has exactly one definition, and the second test is a lint that
 * fails the build if anybody builds a canvas URL by hand again — in either
 * client, in either spelling.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");

describe("a canvas's address", () => {
  it("is /p/, and the router pattern is built from the same prefix", () => {
    expect(CANVAS_PATH_PREFIX).toBe("/p");
    expect(CANVAS_ROUTE).toBe("/p/:canvasId");
    expect(canvasPath("prj_acme")).toBe("/p/prj_acme");
  });

  it("carries an escalation pass in the FRAGMENT, and takes it back off", () => {
    const token = "pss_abc123.s3cr3t-value_x";
    const address = canvasUrlWithPass("https://isocan.io", "prj_acme", token);
    // A fragment, never a query parameter: `#` is not sent to a server, so a
    // pass pasted into a browser by mistake never reaches an access log — and
    // the round trip is what the dialog (which builds it) and `setup` (which
    // reads it) both depend on.
    expect(address).toBe(`https://isocan.io/p/prj_acme#${token}`);
    expect(splitPassFragment(address)).toEqual({
      address: "https://isocan.io/p/prj_acme",
      pass: token,
    });
  });

  it("treats a bare address, and a trailing #, as no pass at all", () => {
    expect(splitPassFragment("https://isocan.io/p/prj_acme")).toEqual({
      address: "https://isocan.io/p/prj_acme",
    });
    // A trailing `#` is what a copy-paste leaves behind; asking the home to
    // redeem the empty string would turn a typo into a refusal.
    expect(splitPassFragment("https://isocan.io/p/prj_acme#")).toEqual({
      address: "https://isocan.io/p/prj_acme",
    });
    // Everything after the FIRST hash is the token, so a mangled paste is
    // refused by the desk rather than silently truncated into a different one.
    expect(splitPassFragment("https://isocan.io/p/prj_acme#a#b")).toEqual({
      address: "https://isocan.io/p/prj_acme",
      pass: "a#b",
    });
  });

  it("reads an address back apart, filling in the scheme a person did not type", () => {
    // Scene 5's literal command has no scheme — `setup isocan.io/p/7f3a…` —
    // and neither does an address copied out of a browser bar, because every
    // browser hides `https://` on display. Refusing would be defensible and
    // would fail the exact paste the scene is built around.
    expect(parseCanvasAddress("isocan.io/p/prj_acme")).toEqual({
      origin: "https://isocan.io",
      canvasId: "prj_acme",
    });
    expect(parseCanvasAddress("https://isocan.io/p/prj_acme#pss_1.s3cret")).toEqual({
      origin: "https://isocan.io",
      canvasId: "prj_acme",
      pass: "pss_1.s3cret",
    });
    // Loopback gets http, because nobody runs TLS on 127.0.0.1 and the one
    // place a scheme-less loopback address is typed is a developer's terminal.
    expect(parseCanvasAddress("127.0.0.1:4441/p/prj_acme")).toEqual({
      origin: "http://127.0.0.1:4441",
      canvasId: "prj_acme",
    });
    // A trailing slash is what a browser adds; it is not a different canvas.
    expect(parseCanvasAddress("https://isocan.io/p/prj_acme/")?.canvasId).toBe("prj_acme");
    // Round trip, both directions, against the one writer.
    const built = canvasUrlWithPass("https://isocan.io", "prj_acme", "pss_1.s3cret");
    expect(parseCanvasAddress(built)).toEqual({
      origin: "https://isocan.io",
      canvasId: "prj_acme",
      pass: "pss_1.s3cret",
    });
  });

  it("refuses everything that is not exactly one canvas", () => {
    // Null, never a partial answer: `isocan setup` has to decide between "this
    // is an address" and "this is a directory", and a near-miss that parsed
    // into something plausible is phase 7's cheerful wrong address.
    for (const nope of [
      "",
      "isocan.io", // a home, not a canvas
      "isocan.io/prj_acme", // the prefix people guess
      "isocan.io/c/prj_acme", // the prefix the DOCS used to guess
      "isocan.io/p/", // no canvas named
      "isocan.io/p/prj_acme/extra", // a deeper page is a different page
      "ftp://isocan.io/p/prj_acme",
      "./some/dir",
    ]) {
      expect(parseCanvasAddress(nope), nope).toBeNull();
    }
  });

  it("builds Scene 5's whole command, with the branch on the install spec", () => {
    // The one command a person pastes, built rather than written: the CLI's
    // `isocan pass` and the web app's "Bring your own agent…" dialog both
    // hand over this exact string, so they cannot disagree.
    expect(setupCommand("https://isocan.io", "prj_acme", "pss_1.s3cret")).toBe(
      `npx ${INSTALL_SPEC} setup https://isocan.io/p/prj_acme#pss_1.s3cret`,
    );
    // The pass-less form is the same builder: what a person is handed when the
    // link grant is open and no credential is needed to arrive.
    expect(setupCommand("https://isocan.io", "prj_acme")).toBe(
      `npx ${INSTALL_SPEC} setup https://isocan.io/p/prj_acme`,
    );
    // #47: a branchless spec installs an EMPTY directory and a dangling bin.
    expect(INSTALL_SPEC).toContain("#release");
  });

  it("builds Scene 6's instructions — a prompt for an agent, not a shell command", () => {
    const line = cloudAgentInstructions("https://isocan.io", "prj_acme", "pss_1.s3cret");
    // The address, with its pass, so the agent arrives admitted and as
    // somebody rather than knocking at a door.
    expect(line).toContain("https://isocan.io/p/prj_acme#pss_1.s3cret");
    // **`ISOCAN_DIRECT=1` is the whole reason this is a separate builder.**
    // Picking "Run an agent in the cloud…" IS the declaration that the
    // workspace is disposable, so the line carries it and nothing has to sniff
    // the environment on the person's behalf. Without this, the agent sets up
    // a daemon and a replica in a sandbox that is about to be deleted.
    expect(line).toContain("ISOCAN_DIRECT=1");
    // It parks. An agent that sets itself up and exits is not on the canvas.
    expect(line).toContain("isocan wait");
    expect(line).toContain("#release"); // #47, same hazard as its sibling
  });

  it("names no vendor — the line goes to whatever cloud the person already has", () => {
    // The journey says claude.ai/code as ONE instantiation. A string that
    // named it would be wrong for every other reader of this dialog, and the
    // same rule direct mode follows in the CLI: never ask who the vendor is.
    const line = cloudAgentInstructions("https://isocan.io", "prj_acme", "pss_1.s3cret");
    for (const vendor of ["claude", "anthropic", "github", "codex", "gemini", "cursor", "gitpod"]) {
      // `github:` inside the install spec is a package source, not a harness —
      // so the check is on the prose, with the command line taken out.
      const prose = line
        .split("\n")
        .filter((row) => !row.includes(INSTALL_SPEC))
        .join("\n");
      expect(prose.toLowerCase(), vendor).not.toContain(vendor);
    }
  });

  it("joins an origin without doubling or dropping the slash", () => {
    expect(canvasUrl("https://isocan.io", "prj_acme")).toBe("https://isocan.io/p/prj_acme");
    // A home address read out of a config file very often has a trailing
    // slash, and `https://isocan.io//p/…` is a different URL to a router.
    expect(canvasUrl("https://isocan.io/", "prj_acme")).toBe("https://isocan.io/p/prj_acme");
    expect(canvasUrl("http://127.0.0.1:4441", "prj_acme")).toBe("http://127.0.0.1:4441/p/prj_acme");
  });

  it("is never hand-spelled anywhere else in the source", () => {
    // The forcing function. `/c/${id}` is the shape that shipped as a blank
    // page; `/p/${id}` is the shape that works and would drift the moment
    // somebody changed their mind in one file. Both are refused here — build
    // the address from `canvasPath`/`canvasUrl`, or change this file too.
    const offenders: string[] = [];
    for (const file of sourceFiles(repo)) {
      // Except the one definition, which has to write the shape down to be it
      // (and whose comment tells the story of why).
      if (file.endsWith(path.join("core", "src", "address.ts"))) continue;
      const text = readFileSync(file, "utf8");
      for (const [i, line] of text.split("\n").entries()) {
        if (/["'`]\/[pc]\/(\$\{|:|<)/.test(line)) {
          offenders.push(`${path.relative(repo, file)}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(
      offenders,
      `build canvas addresses with canvasPath()/canvasUrl() from @isocan/core:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

/** Every `.ts`/`.tsx` under the workspaces' `src` directories. */
function sourceFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "dist") continue;
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) found.push(full);
    }
  };
  for (const pkg of readdirSync(path.join(root, "packages"))) {
    const src = path.join(root, "packages", pkg, "src");
    try {
      if (statSync(src).isDirectory()) walk(src);
    } catch {
      // A workspace without a src directory: nothing to lint.
    }
  }
  return found;
}
