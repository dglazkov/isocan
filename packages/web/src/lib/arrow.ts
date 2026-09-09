/**
 * **The one cursor that ships eagerly, in a module of its own** (9 Sep 2026).
 *
 * This is one string and it does not want a file — it has one because of how
 * bundlers treat a module that is imported both ways. `wearscursor.ts` needs
 * the arrow synchronously (every canvas draws it, including for the frame
 * before a themed shape arrives) and needs the TABLE lazily. Putting both in
 * `cursorart.ts` and importing `ARROW` from it statically made Rollup merge
 * the whole module into the entry chunk and quietly turn the `import()` into
 * a no-op: measured, the split saved 12 bytes and cost 81.
 *
 * So the arrow lives apart, and `cursorart.ts` has exactly one kind of
 * importer. `cursorart.test.ts` asserts the outcome against the BUILT chunks
 * rather than against this arrangement, because the first version of that
 * guard asserted the arrangement, passed, and the bytes were still there.
 */
export const ARROW = "M1.5 0.5 L16 12 L9.2 12.8 L5.5 19 Z";
