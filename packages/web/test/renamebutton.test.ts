import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  fileURLToPath(new URL("../src/components/IdentityMenu.tsx", import.meta.url)),
  "utf8",
);

/**
 * **Rename offers itself only when there is a rename to do.**
 *
 * The button was live whenever the field held anything, so it went blue and
 * pressable over a name nobody had touched — and pressing it just shut the
 * menu, because the submit handler had always known better: it returns
 * early when the name is unchanged.
 *
 * Two places asking the same question and only one of them acting on it is
 * how a control comes to promise something it will not do, which teaches
 * people not to believe the next one.
 */
describe("the Rename button", () => {
  it("asks one question, in one place", () => {
    expect(src).toContain('const renames = trimmed !== "" && trimmed !== actor.name;');
  });

  it("is disabled unless the name actually changed", () => {
    expect(src).toContain("disabled={!renames}");
    // The old spelling let an untouched name look pressable.
    expect(src).not.toContain("disabled={!trimmed}");
  });

  it("and the form agrees, rather than deciding again", () => {
    expect(src).toContain("if (!renames) return onClose();");
  });
});
