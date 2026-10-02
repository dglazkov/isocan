import { FIDELITY_PROP } from "@isocan/core";
import { wireCopyFile, type CopyEdit } from "@isocan/core/copy-deck";
import { applyCopy } from "./content/flesh-spec.ts";
import { validateCopyPayload } from "./copy-schema.ts";
import { readWire, renderWire } from "./render.ts";

/**
 * **A wire screen's copy variant** (copy-edit phase 2): the screen's spec
 * with one voice's words, rendered — the file a `words vary` sibling of a
 * wireframe carries. A wire's words live in its spec (a row draws three
 * joined, a re-render would undo any splice), so the variant is the spec
 * through the same three steps `wire copy --apply` takes — the deck's edits
 * as a copy file (`wireCopyFile`, which refuses a stale string), validated
 * against the screen (`validateCopyPayload`, which refuses touching an
 * intent), applied as `source: "copy"` by `by` — and rendered.
 *
 * Two things differ from writing the screen itself. It is a NEW item: the
 * spec says `variantOf: <source>`, so the flow reads it as a variation of
 * its screen (not a second screen in the row) and `wire keep` can put it in
 * the prototype instead. And nothing else is written — no version on the
 * source, no prototype rebuilt — until somebody chooses it; `choose` folds
 * this file onto the source, where `wiresOn` reads a `variantOf` naming the
 * item it is on as no variation at all.
 *
 * Pure, on purpose: the CLI (`CliModule.copy.variant`) and the web
 * (`WebModule.copy`) both call it with the screen's HTML in hand.
 */
export function wireCopyVariant(html: string, edits: readonly CopyEdit[], by: string, sourceId: string): { html: string; properties: Record<string, string> } {
  const spec = readWire(html);
  if (!spec) throw new Error("this wireframe's spec could not be read");
  const file = wireCopyFile(html, edits);
  if (!file.ok) throw new Error(file.reason);
  const next = applyCopy(spec, validateCopyPayload(spec, file.file), by);
  return { html: renderWire({ ...next, variantOf: sourceId }), properties: { [FIDELITY_PROP]: "wireframe" } };
}
