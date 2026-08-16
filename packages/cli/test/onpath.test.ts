import { describe, expect, it } from "vitest";
import path from "node:path";
import { findOnPath, rootOfBin, transientDir } from "../src/onpath.ts";

/**
 * The bug this file exists for (#48): `npx github:dglazkov/isocan#release
 * setup` reported "cli already on PATH" and installed nothing, because npx
 * puts its own cache directory on PATH and `which isocan` found the copy that
 * was running. The next command, in a shell without that directory, got
 * "command not found" — the CLI was never anywhere.
 */

const sep = path.sep;
const delim = path.delimiter;
const npxBin = `${sep}Users${sep}me${sep}.npm${sep}_npx${sep}605520e755a722a9${sep}node_modules${sep}.bin`;
const nvmBin = `${sep}Users${sep}me${sep}.nvm${sep}versions${sep}node${sep}v24.11.0${sep}bin`;

/** Pretend every listed file exists and is executable. */
const only =
  (...files: string[]) =>
  (file: string) =>
    files.includes(file);

describe("finding a copy that outlives this command", () => {
  it("does not answer with the npx cache it is running from", () => {
    const PATH = [npxBin, `${sep}usr${sep}bin`].join(delim);
    expect(findOnPath("isocan", PATH, only(path.join(npxBin, "isocan")))).toBeNull();
  });

  it("skips a project's local node_modules/.bin for the same reason", () => {
    const local = `${sep}Users${sep}me${sep}work${sep}node_modules${sep}.bin`;
    expect(findOnPath("isocan", local, only(path.join(local, "isocan")))).toBeNull();
  });

  it("finds a real install, and says where it is", () => {
    const PATH = [npxBin, nvmBin].join(delim);
    const installed = path.join(nvmBin, "isocan");
    expect(findOnPath("isocan", PATH, only(path.join(npxBin, "isocan"), installed))).toBe(installed);
  });

  it("ignores empty PATH entries rather than looking in the working directory", () => {
    expect(findOnPath("isocan", `${delim}${delim}`, () => true)).toBeNull();
  });

  it("knows which directories are transient — and that a versioned bin is not", () => {
    expect(transientDir(npxBin)).toBe(true);
    expect(transientDir(nvmBin)).toBe(false);
    expect(transientDir(`${sep}usr${sep}local${sep}bin`)).toBe(false);
  });

  it("reads a copy's root from its bin, the one place both installs agree on", () => {
    // <root>/packages/cli/bin/isocan.js in a checkout and in an install alike;
    // `stalenessOf` compares daemons by exactly this root.
    const root = `${sep}usr${sep}local${sep}lib${sep}node_modules${sep}isocan`;
    expect(rootOfBin(path.join(root, "packages", "cli", "bin", "isocan.js"))).toBe(root);
  });
});
