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

import { expect, it } from "vitest";
import { parseSourcePolicyHeader, sourcePolicyHeader } from "../src/personal.ts";

it("captures a bounded policy independently of mutable caller input", () => {
  const policy = { mode: "direct" as const, actorId: "person-test", intent: "read" as const };
  const captured = parseSourcePolicyHeader(sourcePolicyHeader({ policy, expectedHome: "https://home.example" }));
  policy.actorId = "another-person";
  expect(captured).toEqual({ policy: { mode: "direct", actorId: "person-test", intent: "read" }, expectedHome: "https://home.example" });
  expect(Object.isFrozen(captured.policy)).toBe(true);
});

it.each([
  "null", "[]", "{}", "broken", " ".repeat(4097),
  '{"policy":{"mode":"exclude","actorId":"person"}}',
  '{"policy":{"mode":"direct","actorId":"person","intent":"view"}}',
  '{"policy":{"mode":"direct","actorId":"","intent":"own"}}',
  '{"policy":{"mode":"exclude"},"capability":"own"}',
  '{"policy":{"mode":"exclude"},"expectedHome":null}',
])("refuses a damaged restriction instead of treating it as unrestricted (%s)", (header) => {
  expect(() => parseSourcePolicyHeader(header)).toThrow();
});
