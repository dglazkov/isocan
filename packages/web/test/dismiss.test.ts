import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe as suite, expect, it } from "vitest";

/**
 * **A portalled surface belongs to whoever opened it.**
 *
 * `useDismissOnOutside` asks `contains`, which is about the TREE — and the
 * emoji picker portals to `document.body` on purpose, to escape the overflow
 * and transform of whatever it hangs off. So an emoji click read as
 * "outside", the identity menu closed, and the picker unmounted before its
 * own `onPick` could run: the click dismissed the menu and chose nothing.
 *
 * The picker's own `stopPropagation` cannot fix it, and that is the part
 * worth remembering — the dismiss listener is on the CAPTURE phase, so it has
 * already run by the time a bubble-phase handler could stop anything.
 */
suite("a dismiss-on-outside spares what it owns", () => {
  const dismiss = readFileSync(
    fileURLToPath(new URL("../src/lib/dismiss.ts", import.meta.url)),
    "utf8",
  );
  const picker = readFileSync(
    fileURLToPath(new URL("../src/components/EmojiPicker.tsx", import.meta.url)),
    "utf8",
  );

  it("treats an owned popover as inside", () => {
    expect(dismiss).toContain('closest?.("[data-owned-popover]")');
  });

  it("and the picker claims to be one", () => {
    /* An attribute rather than a class list, so the rule is about INTENT —
       this surface belongs to something — and not about which component
       happens to be portalling this month. */
    expect(picker).toContain('data-owned-popover=""');
  });

  it("keeps listening on capture, which is why the attribute is needed", () => {
    /* If this ever moved to the bubble phase the picker's own
       `stopPropagation` would start working and this rule would look
       redundant — it is not, it is load-bearing for every OTHER portalled
       surface that does not stop propagation. */
    expect(dismiss).toMatch(/addEventListener\("pointerdown", onPointerDown, true\)/);
  });
});
