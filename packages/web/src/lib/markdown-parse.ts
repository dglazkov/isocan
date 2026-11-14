/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Processor } from "unified";
import type { Node } from "unist";

/**
 * **A note's text is parsed once, not once per mount** (27 Sep 2026).
 *
 * Far from the camera a card stands its content down (`ItemView`'s standby),
 * so a zoom that settles, or a pan back to where you were, remounts notes that
 * were parsed a moment ago — and react-markdown parses on every render. In the
 * frame census that remount parsing was ~410 ms of CPU after a zoom; with this
 * it is 3 ms. (It is not what zoom's worst frames are: those are items
 * rendering in the wheel handler — `docs/research/2026-09-26-frame-budget.md`.
 * This removes work, not a felt frame.) Parsing is a pure function of
 * the text — the extensions are fixed (GFM, always; `breaks` is a transform
 * after the parse, not part of it) — so the tree is kept by the text and each
 * render gets its own copy, since the transforms after the parse (remark-breaks,
 * the heading ids, the `#` chips) change the tree they are handed.
 *
 * Everything after the parse is still react-markdown's own code, run as
 * before; this only replaces the parser remark-parse installed, which a plugin
 * after it may do. The cache is bounded and least-recently-used, and a text
 * too large to be worth holding is parsed every time, as before.
 */
const PARSED = new Map<string, Node>();
/** Enough for every note on a large canvas and the comments beside it. */
const PARSED_KEPT = 600;
/** Bigger than this is a document, not a note: parsed each time, never held. */
const PARSED_MAX_CHARS = 100_000;

/** The remark plugin that puts the cache in front of remark-parse's parser; it must come after remark-parse, as every remark plugin does. */
export function cachedParse(this: Processor) {
  const parse = this.parser;
  if (!parse) return;
  this.parser = (doc, file) => {
    if (doc.length > PARSED_MAX_CHARS) return parse(doc, file);
    let tree = PARSED.get(doc);
    if (tree) PARSED.delete(doc);
    else tree = parse(doc, file);
    PARSED.set(doc, tree);
    if (PARSED.size > PARSED_KEPT) PARSED.delete(PARSED.keys().next().value!);
    return structuredClone(tree);
  };
}
