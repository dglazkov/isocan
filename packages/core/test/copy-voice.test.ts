import { describe, expect, it } from "vitest";
import { parseDesign } from "../src/designmd.ts";
import { newVoiceSlips, parseVoiceSection, voiceOf, voicePrompt, voiceSlips, voiceSlipText } from "../src/copy-voice.ts";

/**
 * **DESIGN.md's Voice section, read** (copy-edit phase 4, journey scene 4):
 * tone as prose, Use / Avoid / Glossary as labelled lines or `###` parts, a
 * glossary line in the forms people write it, and what cannot be read said
 * as a problem, never guessed. Synthetic: Acme's design system.
 */

const ACME = `---
name: Acme
colors:
  primary: "#1a5"
---

## Overview

Acme sells parcels.

## Voice

Plain and direct, second person. Say what happens.

Use: your order, sign in
Avoid: seamless, unlock, simply

Glossary:
- sign in — never log in, login
- canvas, not board
- **parcel** (never package)
- Register → create an account

## Colors

Green.
`;

describe("voiceOf — the Voice section of a DESIGN.md", () => {
  it("reads tone, use, avoid and every glossary form", () => {
    const voice = voiceOf(parseDesign(ACME))!;
    expect(voice.tone).toBe("Plain and direct, second person. Say what happens.");
    expect(voice.use).toEqual(["your order", "sign in"]);
    expect(voice.avoid).toEqual(["seamless", "unlock", "simply"]);
    expect(voice.glossary).toEqual([
      { term: "sign in", banned: ["log in", "login"] },
      { term: "canvas", banned: ["board"] },
      { term: "parcel", banned: ["package"] },
      { term: "create an account", banned: ["Register"] },
    ]);
    expect(voice.problems).toEqual([]);
  });

  it("is null when the DESIGN.md has no Voice section", () => {
    expect(voiceOf(parseDesign("## Overview\n\nAcme.\n\n## Colors\n\nGreen."))).toBeNull();
  });

  it("takes ### parts, list items under them, and the other names a Voice section goes by", () => {
    const doc = parseDesign("## Voice & Tone\n\nWarm, never cute.\n\n### Avoid\n\n- awesome\n- super\n\n### Glossary\n\n- checkout — never check-out\n");
    const voice = voiceOf(doc)!;
    expect(voice.tone).toBe("Warm, never cute.");
    expect(voice.avoid).toEqual(["awesome", "super"]);
    expect(voice.glossary).toEqual([{ term: "checkout", banned: ["check-out"] }]);
  });

  it("says what it cannot read: a glossary line with no banned form, an unknown part, a word both used and avoided, an empty section", () => {
    const voice = parseVoiceSection("Glossary:\n- sign in\n\n### Mood\n\nUse: simple\nAvoid: simple");
    expect(voice.glossary).toEqual([]);
    expect(voice.problems.join("\n")).toContain('glossary line "sign in" names no banned form');
    expect(voice.problems.join("\n")).toContain('"### Mood" is not a part of a Voice section');
    expect(voice.problems.join("\n")).toContain('"simple" is under both Use and Avoid');
    expect(parseVoiceSection("").problems).toEqual(["the Voice section says nothing yet — a tone in a sentence, words to use and avoid, a glossary"]);
    expect(parseVoiceSection("Glossary:\n- sign in — never log in\n- log in — never sign in").problems.join(" ")).toContain("both a glossary term and banned");
  });
});

describe("voiceSlips — where a string breaks the voice", () => {
  const voice = voiceOf(parseDesign(ACME))!;

  it("finds a banned form and an avoided word as whole words, any case", () => {
    expect(voiceSlips(voice, "Log in to unlock your parcel")).toEqual([
      { kind: "glossary", said: "Log in", preferred: "sign in" },
      { kind: "avoid", said: "unlock" },
    ]);
    expect(voiceSlips(voice, "Catalog index")).toEqual([]);
    expect(voiceSlipText({ kind: "glossary", said: "Log in", preferred: "sign in" })).toBe('says "Log in" — the voice says "sign in", never "log in"');
  });

  it("counts only what a new string adds: keeping the source's word is not writing it", () => {
    expect(newVoiceSlips(voice, "Log in", "Log in now")).toEqual([]);
    expect(newVoiceSlips(voice, "Continue", "Log in")).toEqual([{ kind: "glossary", said: "Log in", preferred: "sign in" }]);
  });

  it("says itself as one prompt block, every part named", () => {
    const said = voicePrompt(voice);
    expect(said).toContain("Tone: Plain and direct, second person.");
    expect(said).toContain("Words to avoid — never write them: seamless, unlock, simply.");
    expect(said).toContain('Say "sign in", never "log in" or "login".');
    expect(voicePrompt(null)).toBe("");
  });
});
