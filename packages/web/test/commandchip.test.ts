import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { splitChips } from "../src/lib/chips.ts";

/**
 * **A message that ran something now says so.**
 *
 * `/anatomy` and a path rendered as plain text in Chat: the one word saying
 * work had been asked for looked like every other word, and there was nothing
 * to click to find out what it does. A mention has been a chip for months and
 * an item reference too; a command is the same kind of thing — a reference to
 * something this canvas knows about — and was the one that was not.
 *
 * The rule is in core (`findCommandSpans`, with its own cases), because it is
 * a fact about a body and both surfaces read bodies. What is checked here is
 * the composition: that a command takes its place beside the other two span
 * kinds without either of them losing a piece.
 */
const repo = fileURLToPath(new URL("../../..", import.meta.url));
const VERBS = ["anatomy", "sprint"];

describe("a command in a message body", () => {
  it("becomes its own piece, with the text around it kept", () => {
    const pieces = splitChips("/anatomy ~/code/isocan", [], [], VERBS);
    expect(pieces.map((piece) => piece.text)).toEqual(["/anatomy", " ~/code/isocan"]);
    expect(pieces[0]!.command?.name).toBe("anatomy");
    expect(pieces[1]!.command).toBeUndefined();
  });

  it("is plain text when this canvas has no such verb", () => {
    expect(splitChips("/anatomy", [], [], []).map((p) => p.text)).toEqual(["/anatomy"]);
    expect(splitChips("/anatomy", [], [], [])[0]!.command).toBeUndefined();
  });

  it("shares a body with a mention without either losing a piece", () => {
    const pieces = splitChips("/sprint\n@Sonia look", [{ id: "usr_1", name: "Sonia" }], [], VERBS);
    expect(pieces.find((p) => p.command)?.command?.name).toBe("sprint");
    expect(pieces.find((p) => p.mention)?.mention?.actorId).toBe("usr_1");
    // Nothing swallowed: the pieces still reassemble into the original body.
    expect(pieces.map((p) => p.text).join("")).toBe("/sprint\n@Sonia look");
  });

  it("never drops or duplicates text, whatever it finds", () => {
    for (const body of ["/anatomy", "no commands here", "", "/anatomy a\n/sprint b", "and/or /anatomy"]) {
      expect(splitChips(body, [], [], VERBS).map((p) => p.text).join("")).toBe(body);
    }
  });
});

describe("the chip is wired to the surfaces that render bodies", () => {
  const read = (rel: string): string => readFileSync(path.join(repo, rel), "utf8");

  it("is drawn by the markdown renderer, not only the splitter", () => {
    const chips = read("packages/web/src/lib/chips.ts");
    expect(chips).toContain("commandElement(");
    expect(chips, "the chip needs a handle for the click delegation").toContain("dataCommand: name");
  });

  it("is offered only the verbs this canvas has", () => {
    // The roster is the palette's own list, so a chip can never offer to open
    // something the palette would not.
    const panel = read("packages/web/src/components/MainThreadPanel.tsx");
    expect(panel).toContain("commandNames = useMemo(() => commands.map((one) => one.name)");
    expect(panel).toContain("rehypeChips(candidates, actor.id, itemRoster.candidates, commandNames)");
  });

  it("opens the palette when clicked, rather than explaining itself", () => {
    const panel = read("packages/web/src/components/MainThreadPanel.tsx");
    expect(panel).toContain('closest("[data-command]")');
    expect(panel).toContain('setPaletteOpen("commands")');
  });

  it("is quieter than a mention, because a verb has no colour of its own", () => {
    /* In its own stylesheet, not `styles.css`. That file is one of the three
       doors every feature goes through (`measure.mjs registry-lines`), and
       adding to it is how the number goes up — this chip's first version did,
       the ratchet said so, and moving it here is what paying that down looks
       like. Five other components already keep their own. */
    const css = read("packages/web/src/components/command-chip.css");
    expect(css).toContain(".command-chip");
    expect(css, "tokens, not literals").toMatch(/\.command-chip \{[^}]*var\(--chip\)/);
    expect(
      read("packages/web/src/components/MainThreadPanel.tsx"),
      "a stylesheet nothing imports is a stylesheet that does nothing",
    ).toContain('import "./command-chip.css"');
    expect(read("packages/web/src/styles.css"), "and not in the crowded file too").not.toContain(
      ".command-chip",
    );
  });
});
