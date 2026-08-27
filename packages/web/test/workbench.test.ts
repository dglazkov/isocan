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

  it("calls every hook BEFORE the stage's early returns", () => {
    // React counts hooks per render, and this component returns early when
    // the item is not loaded yet. A hook below that line is fine on every
    // render you get by clicking around inside the app — and blanks the page
    // the moment somebody opens a full-screen item URL cold, which is
    // exactly how it was found (error #310, a white screen).
    const firstReturn = stage.search(/^\s*if \(!item\) \{/m);
    expect(firstReturn, "the early return moved — re-point this guard").toBeGreaterThan(0);
    const after = stage.slice(firstReturn);
    // The component's own body only; the helpers below it have their own.
    const body = after.slice(0, after.indexOf("\nfunction "));
    for (const hook of ["useState(", "useEffect(", "useRef(", "useCanvasStore("]) {
      expect(body.includes(hook), `${hook} is called after an early return`).toBe(false);
    }
  });

  it("makes the seam between the panes a handle, reusing the panel's own", () => {
    // `PanelResizer` is the docked panel's edge, generalized when the
    // workbench grew one; this is its third caller rather than a second
    // kind of resizer for a second kind of edge.
    expect(stage).toContain("<PanelResizer");
    expect(stage).toContain('className="stage-editor-slot"');
  });

  it("stores the split as a FRACTION, not a width", () => {
    // A width is one answer to a question that keeps changing: the left
    // panel is draggable and the window resizes, so a width chosen at
    // 1600px is most of the stage at 900.
    expect(stage).toMatch(/split \* 100}%/);
    expect(stage).toContain("const next = clamped / width;");
  });

  it("clamps in the OWNER, so neither pane can be squeezed to nothing", () => {
    // The resizer only reports; whoever owns the value decides what is
    // legal. Its own doc comment says so, and this holds it to that.
    expect(stage).toContain("Math.min(Math.max(px, PANE_MIN), width - PANE_MIN)");
  });

  it("offers the seam only when there are two panes to divide", () => {
    // A folded pane leaves a rail, and a rail is not a seam.
    expect(stage).toMatch(/\{panes\.preview && \(\s*<PanelResizer/);
  });

  it("measures the stage rather than peeking a ref during render", () => {
    // A ref read during render is null on the first one, so the handle
    // opened believing the stage was 0 wide and the first drag slammed the
    // editor to its floor. Observing also keeps it honest as the left panel
    // is dragged and the window resized.
    expect(stage).toContain("new ResizeObserver(measure)");
    expect(stage).not.toContain("body.current?.clientWidth");
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

/**
 * **Items backed by files** (`docs/projects/workbench/files-on-disk.md`) —
 * the app half. The canvas fact and the per-machine one must stay apart, and
 * the write must never be offered where it cannot happen.
 */
describe("the file mark and the save", () => {
  const item = readFileSync(new URL("../src/components/ItemView.tsx", import.meta.url), "utf8");
  const stage = readFileSync(
    new URL("../src/components/ArtifactStage.tsx", import.meta.url),
    "utf8",
  );
  const store = readFileSync(
    new URL("../src/stores/canvasStore.ts", import.meta.url),
    "utf8",
  );

  it("marks only items that HAVE a place on disk", () => {
    // An untracked item is the default and the common case — a view run up
    // to answer "let me see" — so silence is its signal.
    expect(item).toContain("{backing && <span className={`file-mark ${backing.state}`}");
    expect(item).toContain("backingOf(item, disk.bound, ");
  });

  it("keeps the per-machine answer out of the canvas state", () => {
    // `backing` is one browser's answer about one daemon's disk. Replicating
    // or persisting it would carry a machine's fact to a machine where it is
    // false — which is the mistake the whole design is shaped to avoid.
    expect(store).toContain("backing: { bound: false, onDisk: {} }");
    // Not in the replica that gets written down, and not on the wire.
    const persist = store.slice(store.indexOf("function persist("), store.indexOf("function persist(") + 700);
    expect(persist).not.toContain("backing");
  });

  it("offers the write only where there is a disk to write to", () => {
    // A hosted canvas, or a machine without the checkout, is `unbound` — the
    // button must not be there at all rather than there and refusing.
    expect(stage).toContain('backing && backing.state !== "unbound"');
  });

  it("makes overwriting a drifted file a second, deliberate press", () => {
    // The first press is refused by the daemon; the second says `force`.
    // Two presses rather than a confirm dialog keeps the decision in the
    // same place as the gesture.
    expect(stage).toContain("onClick={() => void save(drifted)}");
    expect(stage).toMatch(/Overwrite file/);
    expect(stage).toMatch(/changed on disk outside the canvas/);
  });

  it("re-asks the disk after writing, so the marks stop lying", () => {
    expect(stage).toContain("await loadBacking(canvasId)");
  });

  it("has ＋ say where the file it just carried came from", () => {
    // Closes the round trip: without this the canvas had no idea where an
    // added file came from, so it could never be put back.
    const files = readFileSync(new URL("../src/components/WbFiles.tsx", import.meta.url), "utf8");
    expect(files).toContain("[FILE_PROP]: where");
    expect(files).toContain("cleanFilePath(entry.path)");
  });
});
