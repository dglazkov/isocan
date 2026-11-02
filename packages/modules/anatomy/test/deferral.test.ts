import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { anatomyActivation } from "../src/activation.ts";
import { ANATOMY_KINDS, PROJECT_MIME, PROP, projectsOn } from "../src/facts.ts";

/**
 * **Anatomy is for a subset of canvases, so every other canvas must not pay
 * for it** — and that is a property of how the module is WIRED, which no test
 * of what it does can see.
 *
 * It was a build-time entry in the shell's `LIST` and put 7,039 bytes into the
 * entry chunk for everybody: the core record, which closes over the graph
 * maths through `edges` and `contextPieces`, and 2,329 bytes of instructions
 * written for an agent that a browser never runs. It arrives through
 * `deferredModule` now, the path `design-competition` already uses.
 *
 * Two things make that save anything, and both are easy to undo by accident,
 * which is what these cases are for. The activation must not reach into
 * `manifest.ts` — the first attempt did, and saved exactly zero bytes, because
 * the eager chunk and the lazy one were reaching into one module and rollup
 * hoisted what they shared into the entry. And the underlay must stay a
 * predicate rather than a `lazy()`: a lazy underlay is asked to draw on every
 * canvas, so it would fetch the module everywhere and the deferral would be a
 * comment rather than a fact.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (file: string): string => readFileSync(path.join(here, "..", "src", file), "utf8");

describe("anatomy is not in the entry chunk", () => {
  it("carries the command without the agent's instructions", () => {
    const command = anatomyActivation.core.commands?.[0];
    expect(command?.name, "the palette still needs the verb").toBe("anatomy");
    expect(command?.description, "and one line about it").toBeTruthy();
    expect(command?.body, "2,329 bytes the browser never runs").toBe("");
  });

  it("reaches only the light module, never the manifest", () => {
    const source = read("activation.ts");
    expect(source).toMatch(/from "\.\/facts\.ts"/);
    expect(
      source,
      "importing manifest.ts puts `anatomyModule`, the graph maths and the prompt back in the entry chunk",
    ).not.toMatch(/from "\.\/(manifest|web|workspace|card|edges)\.[a-z]+"/);
  });

  it("keeps the graph maths out of the light module", () => {
    const facts = read("facts.ts");
    for (const heavy of ["projectEdges", "convergence", "projectNeighborhood", "layoutProject", "anatomyModule"]) {
      expect(facts, `${heavy} belongs in manifest.ts, which is fetched with the module`).not.toContain(
        `export function ${heavy}`,
      );
    }
  });

  it("asks its underlay a question rather than loading it to find out", () => {
    // A `lazy()` underlay downloads the module on every canvas, which is the
    // one shape of this that looks deferred and is not.
    const underlay = anatomyActivation.underlays?.[0];
    expect(typeof underlay?.needed, "the underlay must decide before it draws").toBe("function");
    const empty = { items: {} } as Parameters<typeof projectsOn>[0];
    expect(underlay?.needed(empty), "a canvas with nothing on it fetches nothing").toBe(false);
  });

  /**
   * **A kind with no renderer is a card that says its own mime out loud.**
   *
   * `/anatomy` records its request as an item — it has to be one, because an
   * agent claims it, polls it for `cancelRequested` and completes it, and a
   * chat message cannot carry state anybody writes to. But `anatomy-run` was
   * declared as a kind and left out of the renderer's mime list, so the card
   * fell through to the generic file placeholder and Dion saw
   * `analysis-request.json (application/vnd.isocan.anatomy-run+json)` sitting
   * on his canvas.
   *
   * Declaring a kind is a promise that this module knows what the thing IS.
   * Anything less than a renderer for it hands that job back to a fallback
   * that can only read the filename.
   */
  it("renders every kind it declares — a mime it names is a mime it draws", () => {
    const drawn = new Set(anatomyActivation.renderers?.flatMap((one) => one.mimes) ?? []);
    const undrawn = ANATOMY_KINDS.flatMap((kind) => kind.mimes).filter((mime) => !drawn.has(mime));
    expect(
      undrawn,
      "declared as a kind and left to the generic file card, which can only say the filename",
    ).toEqual([]);
  });

  it("draws the request through the same lazy half as everything else", () => {
    // Not a second renderer: the request card is a branch of `card.tsx`, so it
    // arrives in the chunk that is already fetched to draw a concept.
    const card = read("card.tsx");
    expect(card).toContain("mimeType === RUN_MIME");
    expect(card, "the repository is the question a person actually has").toContain("run.repository");
    expect(card, "and the state in the words the requests pane uses").toContain("runStateLine(run)");
  });

  it("still says enough for the shell to route a project item", () => {
    expect(ANATOMY_KINDS.some((kind) => kind.mimes.includes(PROJECT_MIME))).toBe(true);
    expect(anatomyActivation.renderers?.[0]?.mimes).toContain(PROJECT_MIME);
    expect(anatomyActivation.workspaces?.[0]?.segment).toBe("anatomy");
    expect(anatomyActivation.core.propertyKeys).toContain(PROP.repository);
  });
});
