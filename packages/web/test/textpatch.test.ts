import { describe, expect, it } from "vitest";
import { applyEdits, foldEdit, type TextEdit } from "../src/lib/textPatch.ts";

/**
 * **The parse5 upgrade**, and the two refusals it exists to retire.
 *
 * The V0 matched by string — verbatim, exactly once — which was structurally
 * unable to corrupt a file and refused two things people actually do: text
 * the source spells with an entity, and text that appears twice. Both are
 * now ordinary edits, because an edit names its node by POSITION and a
 * position is not a string. Every case below fails against a string search.
 */

/** The frame's job, done by hand: count text nodes in document order. */
const edit = (ordinal: number, from: string, to: string): TextEdit => ({ ordinal, from, to });

describe("what the string search could not do", () => {
  it("edits text the source spells with an ENTITY", async () => {
    // The very first in-place edit anybody attempted hit this: the DOM's
    // text node says "Rest & Play", the file says "Rest &amp; Play", and a
    // search for the former found nothing.
    const page = "<h1>Rest &amp; Play</h1>";
    const out = await applyEdits(page, [edit(0, "Rest & Play", "Work & Play")]);
    expect(out.ok).toBe(true);
    // And it goes back in ENCODED, so the file stays a file.
    if (out.ok) expect(out.source).toBe("<h1>Work &amp; Play</h1>");
  });

  it("edits ONE of two identical strings, and leaves the other alone", async () => {
    const page = "<button>Submit</button><button>Submit</button>";
    const first = await applyEdits(page, [edit(0, "Submit", "Send")]);
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.source).toBe("<button>Send</button><button>Submit</button>");
    // The second button, by the same gesture — the one the V0 could never
    // reach, because a string search cannot tell which was clicked.
    const second = await applyEdits(page, [edit(1, "Submit", "Send")]);
    if (second.ok) expect(second.source).toBe("<button>Submit</button><button>Send</button>");
  });

  it("is not confused by the same text living in an ATTRIBUTE", async () => {
    // "Book" is a headline AND an attribute value. The V0 counted both and
    // refused; a position knows the difference.
    const page = '<h1>Book</h1><a title="Book now">go</a>';
    const out = await applyEdits(page, [edit(0, "Book", "Reserve")]);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.source).toBe('<h1>Reserve</h1><a title="Book now">go</a>');
  });

  it("splices bytes and touches nothing else", async () => {
    const page = "<!doctype html><html><head><title>T</title></head><body>\n  <p>hi</p>\n</body></html>";
    // Ordinal 2, not 1: the title's "T" is 0 and the newline-and-spaces
    // before the <p> is 1. Whitespace text nodes COUNT, in this walk and in
    // the browser's, which is the whole of why the two agree.
    const out = await applyEdits(page, [edit(2, "hi", "hello")]);
    expect(out.ok).toBe(true);
    // The doctype, the whitespace, the head: all exactly as they were. This
    // is what makes an agent's diff of its own file one line.
    if (out.ok) expect(out.source).toBe(page.replace("<p>hi</p>", "<p>hello</p>"));
  });

  it("counts whitespace text nodes, exactly as a browser's walker does", async () => {
    // The correspondence this design rests on: `createTreeWalker(SHOW_TEXT)`
    // in the frame and this walk over parse5's tree must enumerate the same
    // nodes in the same order. Whitespace between tags is a text node in
    // both — miscounting it would silently point every later edit one node
    // off, which is the worst failure this could have.
    const page = "<p>a</p>\n<p>b</p>";
    const out = await applyEdits(page, [edit(2, "b", "B")]);
    expect(out.ok, "the newline between the two <p>s is node 1").toBe(true);
    if (out.ok) expect(out.source).toBe("<p>a</p>\n<p>B</p>");
  });

  it("escapes what a person types, so text cannot become markup", async () => {
    const out = await applyEdits("<p>plain</p>", [edit(0, "plain", 'a < b & <script>x</script>')]);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.source).toBe("<p>a &lt; b &amp; &lt;script>x&lt;/script></p>");
      expect(out.source).not.toContain("<script>");
    }
  });
});

describe("the refusals that remain", () => {
  it("refuses when the node no longer says what it said", async () => {
    // Somebody else saved, or a version landed. The ordinal still resolves,
    // so a splice here would overwrite a stranger's words.
    const out = await applyEdits("<p>now this</p>", [edit(0, "was that", "mine")]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain("changed while you were editing");
  });

  it("refuses an ordinal the file no longer has", async () => {
    const out = await applyEdits("<p>one</p>", [edit(9, "one", "two")]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain("no longer in the file");
  });

  it("refuses inside <script> and <style>, where escaping would be wrong", async () => {
    // Raw-text elements are not entity-decoded, so encoding on the way back
    // in would corrupt them. They are invisible in the frozen frame anyway;
    // this makes that true rather than assumed.
    const js = await applyEdits('<script>var a = "x";</script>', [edit(0, 'var a = "x";', "boom")]);
    expect(js.ok).toBe(false);
    if (!js.ok) expect(js.reason).toContain("<script>");
    const css = await applyEdits("<style>p{color:red}</style>", [edit(0, "p{color:red}", "boom")]);
    expect(css.ok).toBe(false);
  });

  it("refuses a save with nothing to say", async () => {
    expect((await applyEdits("<p>a</p>", [])).ok).toBe(false);
    expect((await applyEdits("<p>a</p>", [edit(0, "a", "a")])).ok).toBe(false);
  });

  it("one refusal refuses the WHOLE save", async () => {
    const page = "<p>keep</p><p>change</p>";
    const out = await applyEdits(page, [edit(1, "change", "changed"), edit(9, "gone", "x")]);
    expect(out.ok).toBe(false);
    // Not even the good one landed: a version holding half the edits is a
    // version nobody asked for.
  });
});

describe("several edits, one save", () => {
  it("applies them all against the ORIGINAL offsets", async () => {
    // Spliced from the back forward, so an earlier edit cannot shift the
    // coordinates of a later one — the bug a naive forward pass has.
    const page = "<h1>Title</h1><p>Alpha</p><p>Beta</p>";
    const out = await applyEdits(page, [
      edit(0, "Title", "A much longer heading"),
      edit(1, "Alpha", "First"),
      edit(2, "Beta", "Second"),
    ]);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.source).toBe("<h1>A much longer heading</h1><p>First</p><p>Second</p>");
    }
  });
});

describe("folding re-edits", () => {
  it("chains a re-edit back to the ORIGINAL the file still holds", async () => {
    let pending = foldEdit([], edit(0, "Title", "Header"));
    pending = foldEdit(pending, edit(0, "Header", "Heading"));
    expect(pending).toEqual([edit(0, "Title", "Heading")]);
  });

  it("an edit that returns a node to what it said disappears", () => {
    let pending = foldEdit([], edit(0, "Title", "Header"));
    pending = foldEdit(pending, edit(0, "Header", "Title"));
    expect(pending).toEqual([]);
  });

  it("tells two nodes saying the SAME thing apart", () => {
    // The V0 folded by matching strings, so editing one "Submit" and then
    // the other collapsed them into one entry pointing at one node.
    let pending = foldEdit([], edit(0, "Submit", "Send"));
    pending = foldEdit(pending, edit(1, "Submit", "Go"));
    expect(pending).toEqual([edit(0, "Submit", "Send"), edit(1, "Submit", "Go")]);
  });
});
