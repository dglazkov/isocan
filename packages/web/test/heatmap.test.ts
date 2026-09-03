import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const view = read("../src/components/ItemView.tsx");
const chip = read("../src/components/SprintChip.tsx");
const reactions = read("../src/components/Reactions.tsx");
const lib = read("../src/lib/sprint.ts");
const page = read("../src/pages/CanvasPage.tsx");
const css = read("../src/styles.css");
const cli = read("../../cli/src/main.ts");

/**
 * **The heat map, and the curtain on the wall only** (sprint phase 4). A
 * placed mark is one op — `item.react` with `at` — written the same way by
 * a click and by `react --at`; dots draw where they were put; under the
 * curtain only your own shows; and the curtain applies to the Vote sheet's
 * contents and nothing else.
 */
describe("placing a mark", () => {
  it("is a mode the chip turns on during a vote, and Escape turns off first", () => {
    expect(chip).toContain("setStamp(stamp === state.phase.mark ? null : state.phase.mark)");
    expect(page).toMatch(/if \(ui\.stamp\) ui\.setStamp\(null\);\s*else if \(ui\.renamingItemId\)/);
  });

  it("puts the mark where the press landed, as fractions of the box, on the wall only", () => {
    const press = view.slice(view.indexOf("if (ui.stamp && onWall)"), view.indexOf("if (commentMode) {"));
    expect(press).toContain("(e.clientX - rect.left) / rect.width");
    expect(press).toContain('{ type: "item.react", itemId: item.id, emoji: ui.stamp, on: true, at }');
    expect(view).toContain("const onWall = mark !== null && wall;");
  });

  it("is the same op the terminal writes", () => {
    expect(cli).toContain('.option("--at <x,y>", "place it on a part of the item');
    expect(cli).toContain("...(at ? { at } : {}),");
  });
});

describe("the dots", () => {
  it("draw where each person put them, and only yours under the curtain", () => {
    const dots = view.slice(view.indexOf('<div className="vote-dots"'), view.indexOf('<div className="item-titlebar"'));
    expect(dots).toContain("left: `${dot.x * 100}%`, top: `${dot.y * 100}%`");
    expect(dots).toContain("!votesHidden || dot.actorId === actor.id");
  });

  it("take no pointer — the sketch under them does", () => {
    const rule = css.slice(css.indexOf(".vote-dots {"));
    expect(rule.slice(0, rule.indexOf("}"))).toContain("pointer-events: none");
  });
});

describe("the curtain is on the wall only", () => {
  it("asks per item whether it is on the wall, folding the wall once per canvas", () => {
    expect(lib).toContain("export function useVotesHiddenOn(item: Item): boolean");
    expect(lib).toContain("wallMemo.canvas === canvas && wallMemo.commentId === state.commentId");
    expect(view).toContain("const votesHidden = useVotesHiddenOn(item);");
    expect(reactions).toContain("const veiled = useVotesHiddenOn(item);");
    expect(reactions).not.toContain("hidesVotes(sprint, nowMs)");
  });
});
