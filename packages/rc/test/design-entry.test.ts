import { expect, it } from "vitest";
import { summonsPrompt } from "../src/helpers.ts";

it("directs the actual canvas summons to the shared on-demand design procedure", () => {
  const prompt = summonsPrompt("Acme Board", "Acme Designer", { reason: "Acme design request", entries: [] });
  expect(prompt).toContain("isocan design workflow");
  expect(prompt).toContain("designed screen, HTML node or connected app");
  expect(prompt).toContain("precise edits and archive imports do not start a new interview");
  expect(prompt).toContain("isocan --agent-help");
  expect(prompt).not.toContain("zero to three");
});
