import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * **The two halves of one rule, on the two sides that have to agree.**
 *
 * Every write to grants is an owner's (roles phase 2): inviting, revoking,
 * the link and its rung. The daemon is what ENFORCES that — a client-side
 * check is a habit — but the app must not offer a control that is going to
 * refuse, and it must say whose canvas it is, or "why can I not press this"
 * has no answer on screen.
 */
describe("only an owner may change who may enter", () => {
  const dialog = read("../src/components/ShareDialog.tsx");
  const http = read("../../server/src/http.ts");

  it("is refused by the daemon, not merely hidden by the app", () => {
    // Both writes — the POST that invites or sets the link, and the DELETE
    // that revokes — ask the same question of the same function; and, since
    // roles phase 4, so does putting a canvas into a space (`own` on both).
    const asks = http.match(
      /atLeast\(await heldRung\(desk, snapshot\.project, req\.badge!, actorId \?\? null\), "own"\)/g,
    );
    expect(asks).toHaveLength(3);
    expect(http).toContain("code: NOT_OWNER");
  });

  it("names the owner in the refusal, resolved through the registry", () => {
    expect(http).toContain("notOwnerMessage(await ownerName(snapshot.project))");
  });

  it("asks core who the creator is, and the hello who else owns it", () => {
    expect(dialog).toContain("ownsCanvas(record, actor.id)");
    expect(dialog).toContain('atLeast(capability, "own")');
  });

  it("disables every control for everybody else instead of hiding it", () => {
    // What the link currently allows and who was invited are worth knowing
    // whoever you are, and a setting that vanishes reads as a bug.
    expect(dialog).toContain("disabled={busy || !owned}");
    expect(dialog).toContain("disabled={busy || grants === null || !owned}");
    expect(dialog).toContain("ownerNote");
  });

  it("puts Owner in both pickers, from core's ladder, and gives the creator no control", () => {
    expect(dialog).toContain("const INVITE_RUNGS: readonly Capability[] = [...RUNGS].reverse();");
    expect(dialog).toContain("Owner, made this");
  });

  it("says who made the canvas", () => {
    expect(dialog).toContain("Made by");
  });
});

describe("a slide that cannot be photographed is not animated", () => {
  const flip = read("../src/lib/deckflip.ts");
  const full = read("../src/components/FullScreen.tsx");
  const viewer = read("../src/components/Viewer.tsx");

  it("cuts when either side of the flip is a frame", () => {
    /**
     * A view transition animates a SNAPSHOT, and a sandboxed cross-origin
     * iframe captures as a blank rectangle — so the push was a white flash
     * across the screen on every flip. Caching never touched it: the frame
     * was loaded the whole time, it just cannot be photographed.
     */
    expect(flip).toMatch(/framed = false/);
    expect(flip).toMatch(/if \(\s*framed \|\|/);
  });

  it("is asked on both faces of the deck, which flip the same way", () => {
    for (const [name, src] of [["full screen", full], ["the viewer", viewer]] as const) {
      expect(src, `${name} does not pass framed`).toContain("isFramedItem(next)");
      expect(src, `${name} ignores the slide being left`).toContain("isFramedItem(here)");
    }
  });
});
