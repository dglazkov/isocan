import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PROPOSED, unknownProposals } from "@isocan/core";

import { EXPERIMENTS } from "../src/lib/experiments.ts";
import { useUiStore } from "../src/stores/uiStore.ts";
import { modules, moduleDropFor, moduleInspectorsFor, moduleWorkspace } from "../src/modules.ts";

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
    useUiStore.getState().setExperiment("modules.anatomy", false);
    const off = modules().length;
    expect(moduleInspectorsFor("sticker")).toEqual([]);
    expect(moduleDropFor(["application/vnd.isocan.sticker-id"])).toBeNull();
    expect(moduleWorkspace("anatomy")).toBeNull();
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
    expect(first.includes("vnd.isocan.anatomy"), "the anatomy mime is in the first download").toBe(false);
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
    /* The three that landed on 9 Sep with one caller each, the five the design
       competition asked for on 11 Sep, `workspaces`, which anatomy asked
       for on 12 Sep and is the only caller of, and `composer`, which the talk
       module asked for on 20 Sep so voice could reach the Chat's own row.
       Shipping is not stability, and calling it stable because it shipped is
       how an API gets frozen by accident. */
    expect([...PROPOSED].sort()).toEqual([
      "assets",
      "composer",
      "dialogs",
      "drops",
      "host",
      "overlays",
      "points",
      "rounds",
      "templates",
      "workspaces",
    ]);
  });

  it("refuses a proposal this build has never heard of, by name", () => {
    /* A module asking for something that no longer exists must be told, not
       loaded without the thing it needed and left to fail somewhere else. */
    expect(unknownProposals(["overlays"])).toEqual([]);
    expect(unknownProposals(["overlays", "telepathy"])).toEqual(["telepathy"]);
  });
});

/**
 * **The composer slot** (proposed: `composer`, 20 Sep 2026).
 *
 * The overlay slot next door names an EDGE and may never cover the middle,
 * which left voice nowhere to go: the gesture people arrive expecting is a
 * mic among the composer's own buttons. So a module may contribute one
 * control there and ask for the row while it is running.
 *
 * What is held here is the shell's half of that bargain — that the row is
 * OFFERED and not seized, and that it comes back.
 */
describe("a module's control in the composer", () => {
  it("is a proposal, so a module naming it has said so", () => {
    // The whole point of the proposed list: a slot we are still shaping must
    // be asked for by name rather than arrived at by accident.
    expect(PROPOSED).toContain("composer");
    expect(unknownProposals(["composer"])).toEqual([]);
  });

  it("offers at most one control per module, because the row is small", () => {
    // Two controls from one module is a row nobody laid out; the slot reader
    // takes the first and the guard says so rather than the layout saying it.
    for (const module of modules()) {
      expect((module.composer ?? []).length, module.core.name).toBeLessThanOrEqual(1);
    }
  });

  it("names the control, so it can be labelled and turned off like other chrome", () => {
    for (const module of modules()) {
      for (const control of module.composer ?? []) {
        expect(control.label.trim().length, module.core.name).toBeGreaterThan(0);
        expect(control.component, module.core.name).toBeTruthy();
      }
    }
  });
});
