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

import { classifyAddable, looksLikeSite, normalizeSiteUrl, type Addable } from "@isocan/core";

/** A field is an unfinished paste. Keep an incomplete address as a draft;
 * submit still validates it through normalizeSiteUrl before any request.
 * Only a site-like draft falls back to kind "site" (normalizeSiteUrl is the
 * one thrower, and only for input that reads as an address) — any other
 * error is a real bug and propagates. */
export function classifyAddableDraft(...args: Parameters<typeof classifyAddable>): Addable {
  try {
    return classifyAddable(...args);
  } catch (error) {
    const draft = args[0].trim();
    if (looksLikeSite(draft)) return { kind: "site", url: draft };
    throw error;
  }
}

/**
 * **What to say about an address that is not one yet.**
 *
 * A draft wears kind "site" so the field can keep it, but `addableWords` reads
 * that kind as a promise — "Add example.com as a live site" — and a draft has
 * nothing to put in the blank. Typing `https://` rendered "Add  as a live
 * site", a sentence with a hole in it, and `file:///etc/passwd` was announced
 * as a live site directly above the error refusing it. A preview that promises
 * what submit will refuse is worse than one that says nothing.
 *
 * Unfinished and unsupported are different answers, and the scheme tells them
 * apart without a parse: `https:/` is on its way to being an address and the
 * words should wait for it; `ftp://` never will be, and saying so while the
 * words are still in the field beats a rejection at the end.
 *
 * `null` means "not a draft — the shared words apply".
 */
export function siteDraftWords(url: string): string | null {
  try {
    normalizeSiteUrl(url);
    return null;
  } catch {
    const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(url.trim())?.[1]?.toLowerCase();
    return scheme && scheme !== "http" && scheme !== "https"
      ? `Only http:// and https:// can be projected — not ${scheme}://`
      : "Keep typing — that is not a whole address yet.";
  }
}
