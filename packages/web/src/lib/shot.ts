/**
 * **The one picture on the front page**, and its identity in one place.
 *
 * A screenshot has four facts that must agree — the file, its two dimensions,
 * and the sentence somebody who cannot see it is given instead — and they used
 * to live in three: the markup, the stylesheet, and the file on disk. That is
 * how lessons.md #3 happened. `width`/`height` on an `<img>` are presentational
 * hints with a USED value, so a stylesheet that sets `width` and says nothing
 * about `height` leaves the attribute's height in force: this exact image once
 * shipped 1158x1346 on a 2880x1346 file, a stretched screenshot on a page
 * selling a design tool.
 *
 * So the facts get ONE home and the guard points at that home rather than
 * restating it (lessons.md #5). `packages/web/test/shot.test.ts` reads the
 * bytes under `public/` and checks these numbers against the file's own header,
 * checks the stylesheet still lets the intrinsic ratio win, and checks the page
 * actually draws it.
 *
 * **Under `public/`, not imported.** The bytes are wanted by exactly one page
 * that exactly one kind of visitor sees, so they must not be linked into a
 * chunk anybody opening a canvas downloads. An `<img>` is the cheapest possible
 * split — the browser fetches it when the element renders and never otherwise —
 * and a stable path is a path a test can resolve without asking a bundler.
 */
export const CANVAS_SHOT = {
  /** Served from `public/` at this exact path; the guard resolves it there. */
  src: "/front/canvas.webp",
  /** The file's real pixels. Declared on the tag so the box is reserved before
   *  the bytes land, and asserted against the header so they cannot drift. */
  width: 1440,
  height: 673,
  /**
   * What the picture says, for somebody who is not going to see it — and it is
   * long on purpose, because the claim the picture makes ("four cursors, three
   * of them agents, all on one live canvas") is the page's whole argument, and
   * an argument that only lands visually does not land for everybody.
   */
  alt:
    "An isocan canvas titled Onboarding flow. Three variations of an onboarding " +
    "screen sit side by side, each with a version count. Four cursors are on the " +
    "canvas, each labelled: Di, and three agents — Gemini reading all three, " +
    "Fable trying multi-select, and Codex checking the week framing against the " +
    "other two.",
} as const;
