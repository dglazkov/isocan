import { describe, expect, it } from "vitest";
import {
  COMMAND_NAME,
  DEFAULT_COMMANDS,
  findCommand,
  matchCommands,
  commandFileText,
  mergeCommands,
  parseCommandFile,
  parseSlashCommand,
  type SlashCommand,
} from "../src/index.ts";

const command = (name: string, over: Partial<SlashCommand> = {}): SlashCommand => ({
  name, description: `does ${name}`, usage: "", body: "do it", source: "built-in", ...over,
});

describe("the command a message is", () => {
  it("reads the name and everything after it", () => {
    expect(parseSlashCommand("/variation 4 make the nav vertical")).toMatchObject({
      name: "variation",
      args: "4 make the nav vertical",
    });
  });

  it("takes a command with no arguments", () => {
    expect(parseSlashCommand("/grill-me")).toMatchObject({ name: "grill-me", args: "" });
  });

  it("forgives leading whitespace and nothing else", () => {
    expect(parseSlashCommand("  /format")).toMatchObject({ name: "format" });
    expect(parseSlashCommand("please /format this")).toBeNull();
  });

  it("does not fire on a message that is ABOUT a command", () => {
    // The difference between asking for the work and explaining why you did
    // not want it. An agent that cannot tell will do it while you explain.
    expect(parseSlashCommand("I ran /format and it moved the wrong thing")).toBeNull();
  });

  it("is not a path, a fraction, or a closing tag", () => {
    for (const body of ["/Users/dalmaer/code", "/ format", "//comment", "/2 of 3", "</div>", "/"]) {
      expect(parseSlashCommand(body), body).toBeNull();
    }
  });

  it("needs a separator after the name", () => {
    // "/formatting the disk" is not the format command with an argument.
    expect(parseSlashCommand("/formatting the disk")).toMatchObject({ name: "formatting" });
    expect(parseSlashCommand("/format-the-disk")).toMatchObject({ name: "format-the-disk" });
  });

  it("reports where the name ends, so a chip can be painted over it", () => {
    const parsed = parseSlashCommand("/format tighten it")!;
    expect("/format tighten it".slice(0, parsed.end)).toBe("/format");
  });
});

describe("matching what has been typed", () => {
  const list = [command("format"), command("favourite"), command("variation"), command("grill-me")];

  it("offers everything before anything is typed", () => {
    expect(matchCommands(list, "").map((c) => c.name)).toEqual([
      "format", "favourite", "variation", "grill-me",
    ]);
  });

  it("puts prefix matches first, then anything else that contains it", () => {
    // "a" starts nothing here, but three commands contain it.
    expect(matchCommands(list, "f").map((c) => c.name)).toEqual(["format", "favourite"]);
    expect(matchCommands(list, "ria").map((c) => c.name)).toEqual(["variation"]);
  });

  it("matches the description too — you remember what it does, not its name", () => {
    const list2 = [command("grill-me", { description: "interview the user" })];
    expect(matchCommands(list2, "interview").map((c) => c.name)).toEqual(["grill-me"]);
  });

  it("never offers the same command twice", () => {
    const names = matchCommands(list, "a").map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("a home's commands over the built-ins", () => {
  it("shadows by name, and says the result came from home", () => {
    const merged = mergeCommands(
      [command("format", { body: "ours" })],
      [command("format", { body: "theirs", source: "home" })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ body: "theirs", source: "home" });
  });

  it("keeps built-ins that were not shadowed, so an upgrade improves them", () => {
    const merged = mergeCommands([command("format"), command("variation")], [command("mine")]);
    expect(merged.map((c) => c.name)).toEqual(["format", "mine", "variation"]);
  });

  it("marks a home command as home even if its file claims otherwise", () => {
    const merged = mergeCommands([], [command("mine", { source: "built-in" })]);
    expect(merged[0]!.source).toBe("home");
  });
});

describe("the built-ins", () => {
  it("are all legally named, and named once", () => {
    for (const c of DEFAULT_COMMANDS) expect(c.name, c.name).toMatch(COMMAND_NAME);
    expect(new Set(DEFAULT_COMMANDS.map((c) => c.name)).size).toBe(DEFAULT_COMMANDS.length);
  });

  it("each say what they do and what to do", () => {
    for (const c of DEFAULT_COMMANDS) {
      expect(c.description.length, c.name).toBeGreaterThan(10);
      expect(c.body.length, c.name).toBeGreaterThan(200);
    }
  });

  it("are findable by the name a person types, in any case", () => {
    expect(findCommand(DEFAULT_COMMANDS, "FORMAT")?.name).toBe("format");
    expect(findCommand(DEFAULT_COMMANDS, "nope")).toBeNull();
  });
});

describe("a command written as a file", () => {
  it("reads the frontmatter and keeps the rest as the instructions", () => {
    const parsed = parseCommandFile(
      "tidy",
      "---\ndescription: Sweep the desk\nusage: [note]\n---\n\nDo the thing.\nThen say so.\n",
    );
    expect(parsed).toMatchObject({
      name: "tidy",
      description: "Sweep the desk",
      usage: "[note]",
      body: "Do the thing.\nThen say so.",
      source: "home",
    });
  });

  it("takes its name from the filename, never from the frontmatter", () => {
    // Two sources for one identity is how format.md ends up answering to /tidy.
    const parsed = parseCommandFile("tidy", "---\nname: format\ndescription: x\n---\nbody");
    expect(parsed!.name).toBe("tidy");
  });

  it("works with no frontmatter at all", () => {
    const parsed = parseCommandFile("tidy", "Just do it.");
    expect(parsed).toMatchObject({ body: "Just do it.", description: "Run the tidy command" });
  });

  it("refuses a name that could not be typed or saved", () => {
    for (const name of ["../escape", "Format", "", "a".repeat(40), "two words"]) {
      expect(parseCommandFile(name, "body"), name).toBeNull();
    }
  });

  it("refuses a command with no instructions", () => {
    expect(parseCommandFile("tidy", "---\ndescription: x\n---\n\n   \n")).toBeNull();
  });

  it("round-trips through the file it writes", () => {
    const original = { description: "Sweep the desk", usage: "[note]", body: "Do the thing." };
    const parsed = parseCommandFile("tidy", commandFileText(original));
    expect(parsed).toMatchObject(original);
  });
});
