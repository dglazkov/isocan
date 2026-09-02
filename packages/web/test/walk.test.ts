import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const chip = read("../src/components/SprintChip.tsx");
const lib = read("../src/lib/sprint.ts");
const menu = read("../src/lib/menuentries.tsx");
const css = read("../src/styles.css");
const skill = read("../../core/src/commands.ts");

/**
 * **The walk** (sprint phase 2, journey Scene 1): a phase call presents its
 * sheet and the chip offers the phase's one action. What these pin is that
 * the walk is derived from the phase and the board and stored nowhere, that
 * a button on the chip and an entry on the menu are the same act, and that
 * arriving mid-sprint is not a call.
 */
describe("a phase call walks the room to its sheet", () => {
  it("glides to the sheet on a phase change — and only one you watched", () => {
    // `undefined` is "not mounted yet": the one state that never walks. A
    // tab that saw "no sprint" on mount and sees Map now DID watch a change,
    // and that first call is the walk's most important moment.
    const effect = chip.slice(chip.indexOf("if (!canvas) return;"), chip.indexOf("}, [state, canvas]);"));
    expect(effect).toContain("lastPhase.current !== undefined && lastPhase.current !== now");
    // A tab that opens on an empty store and then receives a running sprint
    // saw the canvas LOAD, not a call: nothing is recorded until it is here.
    expect(effect.startsWith("if (!canvas) return;")).toBe(true);
    expect(effect).toContain("goToArea(state)");
    expect(chip).toContain("useRef<string | null | undefined>(undefined)");
  });

  it("goes nowhere without a board", () => {
    const fn = lib.slice(lib.indexOf("export function goToArea"));
    expect(fn.slice(0, fn.indexOf("}"))).toContain("if (!state.area) return;");
  });
});

describe("the chip offers the phase's one action", () => {
  it("Go there, when there is a sheet", () => {
    expect(chip).toContain("{state.area && (");
    expect(chip).toContain("onClick={() => goToArea(state)}");
  });

  it("New note, on the phase's paper, in the sheet — never for a vote", () => {
    expect(chip).toContain("{phaseTakesNotes(state) && (");
    expect(chip).toContain("onClick={() => newNoteIn(state)}");
    const takes = lib.slice(lib.indexOf("export function phaseTakesNotes"));
    expect(takes.slice(0, takes.indexOf("}"))).toContain('state.phase.kind === "silent" || state.phase.kind === "group"');
    const note = lib.slice(lib.indexOf("export function newNoteIn"), lib.indexOf("export function handable"));
    expect(note).toContain("freeSpotIn(canvas, state.area, PAPER_SIZE, PAPER_SIZE)");
    expect(note).toContain("paper: phasePaper(state.phase.name)");
  });

  it("Hand in, for what is selected and not yet in", () => {
    expect(chip).toContain("const pending = handable(selected, state);");
    expect(chip).toContain("onClick={() => void handIn(canvasId, actor, pending, state)}");
  });

  it("takes the pointer now that it has buttons", () => {
    const rule = css.slice(css.indexOf(".sprint-chip {"));
    expect(rule.slice(0, rule.indexOf("}"))).toContain("pointer-events: auto");
  });
});

describe("a hand-in lands on the sheet, from the chip and the menu alike", () => {
  it("moves an item onto the sheet before stamping it, in one group", () => {
    const fn = lib.slice(lib.indexOf("export async function handIn"));
    const body = fn.slice(0, fn.indexOf("flashNotice"));
    expect(body).toContain("const group = newGroupId();");
    expect(body).toContain("!inArea(state.area, item)");
    expect(body).toMatch(/type: "item\.move"[\s\S]*group/);
    expect(body).toMatch(/handInPatch\(state\.phase\.name\) \}, group\)/);
  });

  it("is the one helper the menu calls too", () => {
    expect(menu).toContain("void handIn(ctx.canvasId, ctx.actor, pending, state);");
    expect(menu).not.toContain("patch: handInPatch(");
  });
});

describe("the skill tells the facilitator the board does the pointing", () => {
  it("says a phase call walks the room and what the chip offers", () => {
    expect(skill).toContain("THE CLOCK, AND THE WALK.");
    expect(skill).toContain("it walks the room");
    expect(skill).toContain("isocan sprint board");
  });
});
