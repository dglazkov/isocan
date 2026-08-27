import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { workbenchItemPath, workbenchPath, workbenchUrl } from "@isocan/core";


const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * The workbench's standing constraints, held as tests rather than as
 * sentences in the design doc.
 *
 * The doc's headline finding was that the agent room costs ZERO new
 * operations — everything in it is a projection of presence, canvas state
 * and the one main thread, and its only write path is the composer, which is
 * the same component the canvas docks. These tests are what keep that
 * finding true after the doc stops being read.
 */
describe("the workbench writes only where the design says it may", () => {
  const workbench = read("../src/components/Workbench.tsx");
  const stage = read("../src/components/ArtifactStage.tsx");
  const editor = read("../src/components/StageEditor.tsx");

  it("sends no operations from the room or the stage frame", () => {
    // The composer writes — through MainThreadBody, the same component the
    // canvas docks. The editor writes — one op, below. Everything else in
    // the workbench is a projection and must stay one.
    expect(workbench).not.toContain("sendOp");
    expect(workbench).not.toContain("applyLocalEcho");
    expect(stage).not.toContain("sendOp");
  });

  it("lets the editor send exactly one kind of op: a version", () => {
    // ⌘S is `item.addVersion` — the identical op `isocan edit` sends, which
    // is the whole isomorphism of the editor. A second op type appearing
    // here is a product decision that belongs in the design doc first.
    const ops = [...editor.matchAll(/type:\s*"([a-z]+\.[a-zA-Z]+)"/g)].map((m) => m[1]);
    expect(ops).toEqual(["item.addVersion"]);
  });



  it("renders the main thread through the shared component, never a copy", () => {
    expect(workbench).toContain("MainThreadBody");
    expect(workbench).not.toContain("postToMain");
  });

  it("builds every address from core's one spelling", () => {
    // address.test.ts sweeps the whole source for hand-spelled paths; this
    // asserts the positive half — the workbench actually imports the
    // builders it navigates with.
    for (const name of ["workbenchPath", "workbenchItemPath", "workbenchUrl"]) {
      expect(workbench).toContain(name);
    }
  });

  it("shares the stage with full screen — one renderer, two addresses", () => {
    // The two-products tell: the same artifact rendering differently at
    // /i/:itemId and /w/:itemId. Both frames must mount ArtifactStage.
    expect(workbench).toContain("<ArtifactStage");
    expect(read("../src/components/FullScreen.tsx")).toContain("<ArtifactStage");
  });

  it("never classifies a status string into a semantic badge", () => {
    // The design doc bans string-matching lifecycle copy ("waiting for
    // you…") into a PARKED state until statusSource crosses the wire. The
    // verbatim string is honest; a badge built from it is a lie waiting for
    // the day the copy changes.
    expect(workbench).not.toContain("waiting for you");
  });
});

describe("the workbench address family", () => {
  it("builds both levels, and the url form takes the item optionally", () => {
    expect(workbenchPath("prj_1")).toBe("/p/prj_1/w");
    expect(workbenchItemPath("prj_1", "itm_2")).toBe("/p/prj_1/w/itm_2");
    expect(workbenchUrl("https://isocan.io", "prj_1")).toBe("https://isocan.io/p/prj_1/w");
    expect(workbenchUrl("https://isocan.io/", "prj_1", "itm_2")).toBe(
      "https://isocan.io/p/prj_1/w/itm_2",
    );
  });

  it("escapes an id the way the item route does", () => {
    expect(workbenchItemPath("prj_1", "itm/odd")).toBe("/p/prj_1/w/itm%2Fodd");
  });
});

/**
 * The stage's two panes — toggles, not tabs.
 *
 * It shipped as Preview/Edit/Split tabs and they lasted a day: three names
 * for the states of two switches, with a default that hid the editor. The
 * rules that replaced them, frozen here: an editable artifact opens with
 * BOTH panes; each collapses from its own control, which stays put as the
 * way back; and the stage never shows nothing — the sole open pane's toggle
 * goes inert rather than leaving a blank.
 */
describe("the stage's panes", () => {
  const stage = read("../src/components/ArtifactStage.tsx");
  const editor = read("../src/components/StageEditor.tsx");

  it("defaults to both panes open", () => {
    expect(stage).toContain("return { preview: true, edit: true };");
  });

  it("makes the empty stage unreachable, not merely refused", () => {
    // The sole open pane carries NO fold control: the editor's fold arrives
    // only while the preview is open, and the preview's only while the
    // editor is. The guard in fold() is the belt; this is the door.
    expect(stage).toMatch(/onFold=\{panes\.preview \? \(\) => fold\("edit"\) : undefined\}/);
    expect(stage).toMatch(/\{panes\.edit && \(\s*<button\s+className="stage-pane-fold"/);
    expect(stage).toMatch(/if \(!next\.preview && !next\.edit\) return;/);
  });

  it("folds into rails whose whole face is the way back", () => {
    // No third bar of toggles: each pane's own header carries its fold, and
    // a folded pane leaves an edge rail that reopens it from where it stood.
    expect(stage).toContain('className="stage-rail left"');
    expect(stage).toContain('className="stage-rail right"');
    expect(stage).not.toContain("stage-panes");
    expect(editor).toContain('className="stage-pane-fold"');
  });

  it("names what the preview is showing — draft and saved are different claims", () => {
    expect(stage).toMatch(/\{showDraft \? "Draft" : "Saved"\}/);
  });

  it("keeps the draft preview sandboxed to the one flag item frames get", () => {
    expect(stage).toMatch(/sandbox="allow-scripts"/);
    expect(stage).not.toMatch(/allow-same-origin/);
  });
});

describe("the editor's bar earns its buttons", () => {
  const editor = read("../src/components/StageEditor.tsx");

  it("offers Save and Revert only over a dirty buffer", () => {
    // A Save button over a clean buffer is a question with no answer — and
    // the habitual ⌘S must not mint an identical version either, so the
    // guard is in save() as well as in the render.
    expect(editor).toMatch(/\{dirty && \(/);
    expect(editor).toMatch(/saving \|\| !dirtyRef\.current\) return;/);
  });
});

/**
 * Edit-text-in-place: the WYSIWYG V0's two safety floors, pinned.
 *
 * The research doc measured the frame physics; this holds the build to
 * them. The edit frame is `allow-same-origin` with NO scripts — same-origin
 * is what lets our chrome reach the DOM, and dead scripts are what make
 * same-origin acceptable before the content origin lands. Either token
 * changing is a security event, not a style choice. And the patch path is
 * the unique-match rule, whose own suite proves it refuses rather than
 * guesses.
 */
describe("edit-text-in-place", () => {
  const frame = read("../src/components/TextEditFrame.tsx");
  const stage = read("../src/components/ArtifactStage.tsx");

  it("freezes the page: same-origin, scripts dead, exactly", () => {
    // Asserted on the ATTRIBUTE, not the prose — the comments discuss
    // allow-scripts at length precisely because it must not be here.
    expect(frame).toMatch(/sandbox="allow-same-origin"/);
    expect(frame).not.toMatch(/sandbox="[^"]*allow-scripts/);
  });

  it("renders fetched text, never the blob URL", () => {
    // The blob route's response-header CSP forces its own sandbox over the
    // iframe attribute; srcdoc is the path that carries no such header.
    expect(frame).toContain("srcDoc={source}");
    expect(frame).not.toMatch(/src=\{blobUrl/);
  });

  it("saves through the unique-match rule and the ordinary version path", () => {
    expect(frame).toContain("applyEdits(");
    expect(frame).toContain("addVersionFromFile(");
    // Refusals surface as a sentence, never as a silent partial save.
    expect(frame).toContain("setRefusal(outcome.reason)");
  });

  it("opens what each COVER is for, and remembers them apart", () => {
    // Enter is "look at this thing big" — the preview, editor a rail away.
    // W is "work on this thing" — both. One shared preference could not say
    // that: whichever cover you used last decided what the other opened.
    expect(stage).toMatch(/fullscreen: \{ preview: true, edit: false \}/);
    expect(stage).toMatch(/workbench: \{ preview: true, edit: true \}/);
    // Two keys, so folding in one cover does not fold the other.
    expect(stage).toMatch(/fullscreen: "isocan\.stage\.panes\.fullscreen"/);
    expect(stage).toMatch(/workbench: "isocan\.stage\.panes\.workbench"/);
    // And each cover says which it is, rather than the stage guessing.
    const full = readFileSync(new URL("../src/components/FullScreen.tsx", import.meta.url), "utf8");
    const bench = readFileSync(new URL("../src/components/Workbench.tsx", import.meta.url), "utf8");
    expect(full).toContain('surface="fullscreen"');
    expect(bench).toContain('surface="workbench"');
  });

  it("is offered on the saved preview, whichever panes are open", () => {
    // It used to require the editor pane to be FOLDED. The rule behind that
    // was right — two pens on one file is a conflict machine — but both
    // panes open is the DEFAULT, so the precondition hid the feature in the
    // layout almost everybody has. Offered against the saved file instead.
    expect(stage).toMatch(/offerTextEdit = current\.mimeType === "text\/html" && !showDraft;/);
  });

  it("keeps one pen by taking the stage, not by hiding the door", () => {
    // The mode owns the whole stage for its duration, so the editor is
    // behind you rather than beside you — same guarantee, discoverable.
    expect(stage).toMatch(/if \(textEditing && offerTextEdit\) \{/);
    // And it must not fold the editor to get there: folding is persisted
    // (`writePanes`), and a temporary mode may not rewrite how somebody has
    // decided to work.
    const mode = stage.slice(stage.indexOf("if (textEditing && offerTextEdit)"));
    expect(mode.slice(0, 600)).not.toContain("fold(");
  });

  it("withholds it while a draft is open — that pen is already in hand", () => {
    // `showDraft` is true exactly when the editor has unsaved text, and the
    // preview is showing THAT rather than the saved file.
    expect(stage).toMatch(/showDraft = panes\.edit && draft !== null/);
  });
});
