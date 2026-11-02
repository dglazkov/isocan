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
