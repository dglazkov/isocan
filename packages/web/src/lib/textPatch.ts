/**
 * Unique-match text patching — the V0 of WYSIWYG's native path
 * (docs/research/2026-08-26-wysiwyg.md).
 *
 * The rule that makes in-place editing structurally unable to corrupt a
 * file: an edit applies only when the text it replaces appears in the
 * source VERBATIM and EXACTLY ONCE. Then the save is a byte-exact splice of
 * just that text — the rest of the file survives untouched, so an agent
 * diffing its own file sees one changed string, not a reformat. Anything
 * else — absent (the DOM normalized it), ambiguous (two "Submit" buttons),
 * empty — is a REFUSAL with a sentence, and the person is pointed at the
 * source editor that already exists. The worst outcome is a polite no.
 *
 * Deliberately not a parser. parse5's `sourceCodeLocation` offsets are the
 * planned upgrade (patch by node location, so repeats and entities work);
 * this V0 exists to ship the frame and measure how long that tail really
 * is. When the parser lands, only this module's matching rule changes.
 */

export type PatchOutcome =
  | { ok: true; source: string }
  | { ok: false; reason: string };

/** One committed in-place edit: what the text node said, what it says now. */
export interface TextEdit {
  from: string;
  to: string;
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    count++;
    at = haystack.indexOf(needle, at + 1);
  }
  return count;
}

/** Apply one edit under the unique-match rule. */
export function uniqueSplice(source: string, edit: TextEdit): PatchOutcome {
  const { from, to } = edit;
  if (from.length === 0) {
    return { ok: false, reason: "nothing was selected to replace" };
  }
  if (from === to) return { ok: true, source };
  const seen = countOccurrences(source, from);
  if (seen === 0) {
    return {
      ok: false,
      reason:
        "that text does not appear verbatim in the source (entities or collapsed whitespace) — this one needs the editor",
    };
  }
  if (seen > 1) {
    return {
      ok: false,
      reason: `that text appears ${seen} times in the source — this one needs the editor`,
    };
  }
  const at = source.indexOf(from);
  return { ok: true, source: source.slice(0, at) + to + source.slice(at + from.length) };
}

/**
 * Apply several edits in the order they were made, each judged against the
 * source AS PATCHED SO FAR — an earlier replacement must not create or
 * destroy the uniqueness a later edit depends on without the rule noticing.
 * One refusal refuses the whole save, by name: a version that applied three
 * of four edits is a version nobody asked for.
 */
export function applyEdits(source: string, edits: readonly TextEdit[]): PatchOutcome {
  let patched = source;
  for (const edit of edits) {
    const outcome = uniqueSplice(patched, edit);
    if (!outcome.ok) return outcome;
    patched = outcome.source;
  }
  if (patched === source) return { ok: false, reason: "nothing changed" };
  return { ok: true, source: patched };
}

/**
 * Fold a new edit into the pending list: re-editing the same text chains
 * (the file still holds the ORIGINAL, so the pending entry must map
 * original → latest, never intermediate → latest), and an edit that undoes
 * itself disappears.
 */
export function foldEdit(pending: readonly TextEdit[], edit: TextEdit): TextEdit[] {
  if (edit.from === edit.to) return [...pending];
  const chained = pending.findIndex((p) => p.to === edit.from);
  if (chained === -1) return [...pending, edit];
  const next = [...pending];
  const original = next[chained]!.from;
  if (original === edit.to) next.splice(chained, 1);
  else next[chained] = { from: original, to: edit.to };
  return next;
}
