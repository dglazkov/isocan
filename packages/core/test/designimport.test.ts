import { describe, expect, it } from "vitest";
import { classifyToken, detectFormat, importDesign, readCssTokens } from "../src/designimport.ts";

/**
 * **What survives the trip from somebody else's design system.**
 *
 * Not components — those arrive with a build step and a runtime. Tokens: the
 * colours, radii and type a house has agreed on. These tests are mostly about
 * the two ways an import can be quietly wrong: taking half a theme, and
 * dropping what it could not read.
 */
describe("reading a stylesheet", () => {
  it("takes properties from every block, not only :root", () => {
    /**
     * A shadcn theme puts its light palette in `:root` and its dark one in
     * `.dark`. An importer that read only the first would take half a theme
     * and say nothing about it — the worst failure this can have, because it
     * looks like success.
     */
    const css = `:root { --background: 0 0% 100%; } .dark { --background: 0 0% 4%; --ring: 0 0% 80%; }`;
    const found = readCssTokens(css);
    expect(found.size).toBe(2);
    // Later wins, which is what the cascade would do.
    expect(found.get("--background")).toBe("0 0% 4%");
  });

  it("ignores a property that is commented out", () => {
    // `/* --x: red */` is not a declaration, and importing it would invent a
    // token nobody wrote.
    const found = readCssTokens(`:root { /* --old: #f00; */ --new: #0f0; }`);
    expect([...found.keys()]).toEqual(["--new"]);
  });

  it("knows a JSON token file from a stylesheet by reading it", () => {
    expect(detectFormat(`{ "color": {} }`)).toBe("dtcg");
    expect(detectFormat(`:root { --a: 1px }`)).toBe("css");
  });
});

describe("deciding what a token IS", () => {
  it("reads a shadcn colour, which does not look like a colour", () => {
    /**
     * `--primary: 222.2 47.4% 11.2%` is three numbers. It is a colour only
     * because the stylesheet wraps it — `hsl(var(--primary))` — and that
     * wrapper is somewhere this importer never sees. A value-only classifier
     * loses the entire palette of the most popular theme format there is.
     */
    expect(classifyToken("primary", "222.2 47.4% 11.2%")).toBe("colors");
    const { tokens } = importDesign(`:root { --primary: 222.2 47.4% 11.2%; }`);
    // …and it lands as something a person and a contrast checker can both use.
    expect(tokens.colors?.primary).toBe("hsl(222.2 47.4% 11.2%)");
  });

  it("believes the value over the name", () => {
    // A `#ff0000` called `--spacing-large` is a colour whatever it is called:
    // the value is a fact and the name is somebody's habit.
    expect(classifyToken("spacing-large", "#ff0000")).toBe("colors");
  });

  it("sorts radii away from other lengths", () => {
    expect(classifyToken("radius", "0.5rem")).toBe("rounded");
    expect(classifyToken("rounded-lg", "12px")).toBe("rounded");
    expect(classifyToken("space-4", "16px")).toBe("spacing");
  });

  it("takes type into its own shape", () => {
    const { tokens } = importDesign(`:root { --font-sans: Inter, sans-serif; --font-size-lg: 18px; }`);
    expect(tokens.typography?.["font-sans"]?.fontFamily).toBe("Inter, sans-serif");
    expect(tokens.typography?.["font-size-lg"]?.fontSize).toBe("18px");
  });

  it("says what it could not read instead of dropping it", () => {
    /**
     * The failure that is discovered weeks later by somebody wondering why a
     * colour is missing. An import that quietly loses half a theme is worse
     * than one that names the half it could not place.
     */
    const { tokens, problems } = importDesign(`:root { --duration-fast: 150ms; --easing: cubic-bezier(.4,0,.2,1); }`);
    expect(tokens.colors).toBeUndefined();
    expect(problems).toHaveLength(2);
    expect(problems.join(" ")).toContain("--easing");
  });
});

describe("what an import can answer for itself", () => {
  it("names the system after the file it came from", () => {
    // `design check`'s first complaint about an unnamed system is one an
    // import can answer — and a system an agent cannot cite by name is one it
    // will not cite.
    const { tokens } = importDesign(`:root { --primary: #1f3fd0; }`, "shadcn-theme.css");
    expect(tokens.name).toBe("shadcn theme");
  });

  it("leaves the name alone when nobody said where it came from", () => {
    expect(importDesign(`:root { --primary: #1f3fd0; }`).tokens.name).toBeUndefined();
  });
});

describe("reading a W3C token file", () => {
  it("walks the tree and keeps the path as the name", () => {
    const json = JSON.stringify({
      color: { brand: { primary: { $value: "#1f3fd0", $type: "color" } } },
      radius: { lg: { $value: "12px", $type: "dimension" } },
    });
    const { tokens, format } = importDesign(json);
    expect(format).toBe("dtcg");
    expect(tokens.colors?.["color.brand.primary"]).toBe("#1f3fd0");
    expect(tokens.rounded?.["radius.lg"]).toBe("12px");
  });

  it("believes `$type` over its own guess", () => {
    // The author saying "this is a colour" outranks anything inferred from
    // the value — that is what the field is for.
    const json = JSON.stringify({ odd: { $value: "not-a-colour", $type: "color" } });
    expect(importDesign(json).tokens.colors?.odd).toBe("not-a-colour");
  });

  it("names a composite it has no home for", () => {
    const json = JSON.stringify({ shadow: { md: { $value: { blur: 4 }, $type: "shadow" } } });
    const { problems } = importDesign(json);
    expect(problems.join(" ")).toContain("shadow.md");
    expect(problems.join(" ")).toContain("composite");
  });

  it("does not throw on rubbish", () => {
    expect(importDesign("{ not json").problems[0]).toContain("not valid JSON");
    expect(importDesign(":root {}").problems[0]).toContain("no custom properties");
  });
});
