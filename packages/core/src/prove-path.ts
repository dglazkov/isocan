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

/*
 * **The operator's proof page, as an address** (moved out of `operator.ts` on
 * 14 Oct 2026, unchanged; `operator.ts` re-exports it).
 *
 * The web app asks on every load whether it was opened AT that page, so these
 * lines are in its first paint. The rest of `operator.ts` — the handoff, the
 * loopback rule, the refusals and the operator's records — is read by the
 * proof page itself and by the CLI and the daemon; while it shared a file
 * with the question, it was in every first visit too, because a module in the
 * entry chunk carries every export any chunk uses.
 */

/**
 * **Where the browser makes the proof**, and the handoff rides in the PATH.
 *
 * Not in the query, and the reason is measured rather than stylistic. The
 * magic-link path returns through `/__/auth/action`, which resolves the
 * provider's `continueUrl` and keeps the path (`authaction.ts`); the provider
 * appends `continueUrl` to its link **unencoded**, so a second `&`-separated
 * parameter inside it is parsed as a parameter of the outer link and never
 * reaches the landing page. One opaque segment survives that round trip; a
 * query string does not survive it whole.
 */
export const PROVE_PATH_PREFIX = "/operator/prove";

/** The handoff segment in a path this page was loaded at, or null. */
export function proveSegmentIn(pathname: string): string | null {
  if (!pathname.startsWith(`${PROVE_PATH_PREFIX}/`)) return null;
  const rest = pathname.slice(PROVE_PATH_PREFIX.length + 1);
  return rest.length > 0 ? rest.split("/")[0]! : null;
}
