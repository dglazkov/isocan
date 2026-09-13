import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **What a tab does when this home refuses the address it proved** — operator
 * phase 6, journey 9 step 2.
 *
 * Refusing an address looks, from a client's point of view, like the refusals
 * beside it, and each does something this one must not: `withdrawn` says an
 * owner removed you from a canvas, `refused` (link off) says the link is off,
 * `ended` says the badge is finished. This is none of those: the badge is
 * fine and was never inside, and the home will not admit the ADDRESS it
 * proved — so the sentence names the address and who to write to.
 *
 * These read the source for the two properties a rendered assertion could not
 * catch: that the sentence shown is the HOME's (off the 403) rather than one
 * this bundle composed, and that the refused mint surfaces the home's words
 * rather than *a badge is required*. The runtime — a real socket closing with
 * `refused`, a real browser on a refused network — is the ⚑ walk; the report
 * says which parts need it.
 */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const strip = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\/.*$/gm, "");

const store = strip(read("../src/stores/canvasStore.ts"));
const api = strip(read("../src/lib/api.ts"));
const canvasPage = strip(read("../src/pages/CanvasPage.tsx"));
const viewer = strip(read("../src/components/Viewer.tsx"));

describe("the tab, when the home refuses the address it proved", () => {
  it("has a state of its own, told apart from a link that is off", () => {
    expect(store).toMatch(/\|\s*"refused-here"/);
    expect(store).toMatch(/event\.reason === REFUSED/);
    // It is not the link-off `refused`: that one still exists, distinctly.
    expect(store).toMatch(/\|\s*"refused"/);
  });

  it("asks the HOME for the sentence off the 403 rather than composing one", () => {
    expect(store).toMatch(/fetchRefused\(canvasId\)/);
    expect(store).toMatch(/refusedHere: RefusalNotice \| null/);
    // Read off the 403, where the home writes the refusal notice beside the code.
    expect(api).toMatch(/export async function fetchRefused/);
    expect(api).toMatch(/json\?\.reason === REFUSED && json\.refusal/);
  });

  it("shows the home's sentence on the canvas page and the viewer", () => {
    expect(canvasPage).toMatch(/"refused-here":/);
    expect(canvasPage).toMatch(/refusedHere\?\.sentence/);
    expect(viewer).toMatch(/connection === "refused-here"/);
    expect(viewer).toMatch(/refusedHere\?\.sentence/);
    // And it never says the two things that are not true here.
    const branch = canvasPage.slice(canvasPage.indexOf('"refused-here":'));
    expect(branch.slice(0, 400)).not.toMatch(/not found|was deleted/);
  });
});

describe("a refused mint", () => {
  it("surfaces the home's sentence rather than `a badge is required`", () => {
    // The door answers a refused-network knock 403 with the sentence; the
    // knock keeps its boolean contract by recording it, and `request` throws
    // the sentence instead of the cheerful wrong answer. A 429 (metered) is
    // NOT recorded — waiting fixes that one.
    expect(api).toMatch(/lastDoorRefusal/);
    expect(api).toMatch(/res\.status === 401 && lastDoorRefusal/);
    expect(api).toMatch(/json\?\.reason === REFUSED/);
  });
});
