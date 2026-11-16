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

import { describe, expect, it } from "vitest";
import { canListGrant, isListedGrant, isGrantListingDecision, publicListingRoute, type Grant } from "../src/index.ts";

const decision = { listed: true, at: "2026-09-13T00:00:00Z", by: "bdg_owner" };
const link: Grant = { id: "gnt_acme", canvasId: "prj_acme", subject: "link", grantedBy: "bdg_owner", at: decision.at, capability: "read" };

describe("public is explicit consent beside an existing link", () => {
  it("starts legacy grants unlisted and permits read/view only", () => {
    expect(canListGrant(link)).toBe(true);
    expect(isListedGrant(link)).toBe(false);
    expect(isListedGrant({ ...link, listing: decision })).toBe(true);
    expect(isListedGrant({ ...link, capability: "view", listing: decision })).toBe(true);
    for (const capability of [undefined, "edit", "own", "future"] as const) {
      expect(canListGrant({ ...link, capability } as Grant)).toBe(false);
    }
  });
  it("refuses malformed consent, revocations, spaces, other subjects and bars", () => {
    for (const listing of [null, true, {}, { ...decision, listed: "true" }, { ...decision, by: "" }, { ...decision, at: "tomorrow" }, { ...decision, unknown: 1 }]) {
      expect(isGrantListingDecision(listing)).toBe(false);
      expect(isListedGrant({ ...link, listing } as Grant)).toBe(false);
    }
    expect(isListedGrant({ ...link, listing: { ...decision, listed: false } })).toBe(false);
    for (const changed of [{ revokedAt: decision.at }, { spaceId: "spc_acme" }, { subject: "email:acme@example.test" }, { bars: true }]) {
      expect(isListedGrant({ ...link, listing: decision, ...changed } as Grant)).toBe(false);
    }
  });
  it("encodes both ids in the one route builder", () => {
    expect(publicListingRoute("prj/a", "gnt/b")).toBe("/api/projects/prj%2Fa/grants/gnt%2Fb/listing");
  });
});
