import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **A button that is ready to be pressed must not look like one that isn't.**
 *
 * `.btn:disabled` is a 45% opacity and nothing else, so a PLAIN `.btn` is
 * grey when it is ready and slightly paler grey when it is not — two shades
 * of one colour standing for two opposite states. Reported by somebody who
 * had typed a comment and could not tell whether they were allowed to send
 * it: "grey == disabled in my world".
 *
 * The accent makes the states two different colours instead. That is why
 * every control that SENDS something somebody typed wears `primary`, and it
 * is the reason rather than a house style: the reply button was the only
 * composer that did not, while the Chat's send and the thread's own opening
 * comment already did.
 */
const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("everything that sends says it can be pressed", () => {
  const composers = [
    "../src/components/CommentLayer.tsx",
    "../src/components/MainThreadPanel.tsx",
    "../src/components/ShareDialog.tsx",
  ];

  it("gives every submit the accent, not the chip grey", () => {
    for (const file of composers) {
      const src = read(file);
      const submits = src.split("<button").filter((chunk) => chunk.includes('type="submit"'));
      expect(submits.length, `${file} should still have a submit`).toBeGreaterThan(0);
      for (const button of submits) {
        const tag = button.slice(0, button.indexOf(">"));
        expect(
          tag,
          `${file}: a submit in chip grey cannot say whether it is enabled`,
        ).toMatch(/className="btn primary"/);
      }
    }
  });
});
