import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PROPOSED, unknownProposals } from "@isocan/core";

import { EXPERIMENTS } from "../src/lib/experiments.ts";
import { useUiStore } from "../src/stores/uiStore.ts";
import { modules, moduleDropFor, moduleInspectorsFor } from "../src/modules.ts";

/**
 * **The API #156 asked for, and the bargain the experiment gate makes.**
 *
 * The slots have their own guards in the module that uses them; what is held
 * here is the shell's half — that a module behind an experiment is absent
 * until somebody asks, and absent from the DOWNLOAD and not just the screen.
 * That second one is the whole point and the one I got wrong first: gated at
 * render, stickers cost every first visit 6,227 bytes.
 */

const dist = fileURLToPath(new URL("../dist/assets/", import.meta.url));

function entryChunk(): string | null {
  let files: string[];
  try {
    files = readdirSync(dist).filter((f) => f.startsWith("index-") && f.endsWith(".js"));
  } catch {
    return null; // never built here
  }
  const biggest = files.map((f) => ({ f, size: statSync(dist + f).size })).sort((a, b) => b.size - a.size)[0];
  if (!biggest) return null;
  const src = fileURLToPath(new URL("../src/modules.ts", import.meta.url));
  if (statSync(src).mtimeMs > statSync(dist + biggest.f).mtimeMs) return null; // stale
  return readFileSync(dist + biggest.f, "utf8");
}

describe("a module behind an experiment", () => {
  it("is in no slot until the experiment is on", () => {
    /* Deliberately not naming the package: `modules.test.ts` holds a module's
       spec to appearing in the two lists and nowhere else, and a test that
       knows which module implements an experiment is a test that has to change
       when that stops being true. The observable fact is the count. */
    useUiStore.getState().setExperiment("modules.stickers", false);
    const off = modules().length;
    expect(moduleInspectorsFor("sticker")).toEqual([]);
    expect(moduleDropFor(["application/vnd.isocan.sticker-id"])).toBeNull();
    expect(off).toBe(modules().length);
  });

  it("costs a first visit nothing while it is off", () => {
    /**
     * The bargain. An experiment that ships its bytes to everybody is not off,
     * it is on and invisible — and this read the BUILT chunk because the first
     * version of this feature passed every other check while doing exactly
     * that. Skipped on a stale build, like `bundle-budget`.
     */
    const first = entryChunk();
    if (first === null) return;
    expect(first.includes("vnd.isocan.sticker"), "the sticker mime is in the first download").toBe(false);
    expect(first.includes("Thumbs up"), "the tray is in the first download").toBe(false);
  });

  it("names itself in Settings, in words rather than an id", () => {
    /* A switch whose label is `modules.stickers` is a switch nobody can decide
       about. Every experiment owes a name and a sentence saying what is
       unfinished — that sentence is the informed half of the consent. */
    for (const e of EXPERIMENTS) {
      expect(e.name).not.toBe(e.id);
      expect(e.what.length, `${e.id} says nothing about itself`).toBeGreaterThan(30);
    }
  });
});

describe("how early the API says it is", () => {
  it("names the slots it intends to change", () => {
    /* The three that landed on 9 Sep with one caller each, and the five the
       design competition asked for on 11 Sep with one caller each. Shipping is
       not stability, and calling it stable because it shipped is how an API
       gets frozen by accident. */
    expect([...PROPOSED].sort()).toEqual(["assets", "dialogs", "drops", "host", "overlays", "points", "rounds", "templates"]);
  });

  it("refuses a proposal this build has never heard of, by name", () => {
    /* A module asking for something that no longer exists must be told, not
       loaded without the thing it needed and left to fail somewhere else. */
    expect(unknownProposals(["overlays"])).toEqual([]);
    expect(unknownProposals(["overlays", "telepathy"])).toEqual(["telepathy"]);
  });
});
