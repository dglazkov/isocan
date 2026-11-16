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
import { awaitingReply } from "../src/components/MainThreadPanel.tsx";

/**
 * A record in the Chat asks nobody anything — a `/wire` act's account of what
 * it made (wireframes phase 8) is `record: true` — so the Chat must not say
 * "Nobody is parked — this waits on the thread" under it. Seen in the phase 8
 * browser walk, under the first Wire builder record.
 */
describe("awaitingReply", () => {
  const me = { id: "usr_ada" };
  it("waits on an ask that is yours and last", () => {
    expect(awaitingReply({ comments: [{ author: me }] }, me.id)).toBe(true);
  });
  it("does not wait on a record, which summoned nobody", () => {
    expect(awaitingReply({ comments: [{ author: me }, { author: me, record: true }] }, me.id)).toBe(false);
  });
  it("does not wait once somebody else has spoken last", () => {
    expect(awaitingReply({ comments: [{ author: me }, { author: { id: "usr_bot" } }] }, me.id)).toBe(false);
  });
});
