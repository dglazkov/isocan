import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const chip = read("../src/components/SprintChip.tsx");
const lib = read("../src/lib/sprint.ts");
const cli = read("../../cli/src/main.ts");
const skill = read("../../core/src/commands.ts");

/**
 * **The desk** (sprint phase 3, journey Scene 2): a private canvas whose
 * chip reads the sprint's clock from elsewhere and hands in across canvases.
 * What these pin: the desk is told apart by the canvas record and nothing
 * else; the sprint's state is PULLED, since the store holds one canvas; a
 * hand-in from a desk is a copy that lands on the sheet, stamped, in one
 * group, and leaves the original where it was.
 */
describe("a desk's chip reads the sprint it belongs to", () => {
  it("is a desk only when the canvas record says so, and only without a sprint of its own", () => {
    expect(chip).toContain("const deskOf = state ? null : deskSprintOf(project);");
    expect(chip).toContain("const remote = useRemoteSprint(deskOf);");
  });

  it("pulls the sprint's snapshot on a timer, and keeps the last one on a failed pull", () => {
    const hook = lib.slice(lib.indexOf("export function useRemoteSprint"), lib.indexOf("export async function handInFromDesk"));
    expect(hook).toContain("getSnapshot(canvasId)");
    expect(hook).toContain("setInterval(pull, DESK_PULL_MS)");
    expect(hook).toContain(".catch(() => {");
  });

  it("offers Hand in for the selection, and nothing that belongs to the sprint canvas", () => {
    const desk = chip.slice(chip.indexOf("if (!state && deskOf && remote.state && remote.canvas)"), chip.indexOf("if (!state) return null;"));
    expect(desk).toContain("handInFromDesk(canvasId, deskOf, sprintCanvas, actor, chosen, away)");
    expect(desk).not.toContain("newNoteIn");
    expect(desk).not.toContain("goToArea");
  });
});

describe("a hand-in from a desk is a copy onto the sheet", () => {
  const fn = lib.slice(lib.indexOf("export async function handInFromDesk"), lib.indexOf("/** Whether votes are hidden"));

  it("reads the bytes from the desk and writes them to the sprint", () => {
    expect(fn).toContain("readBlob(deskId, version.blobHash)");
    expect(fn).toContain("uploadBlob(sprintId, bytes, version.filename)");
  });

  it("lands each copy at the first clear spot on the sheet, seeing the last one land, chosen", () => {
    expect(fn).toContain("freeSpotIn(occupied, state.area, item.width, item.height)");
    expect(fn).toContain("occupied = { ...occupied, items: { ...occupied.items, [itemId]:");
    expect(fn).toContain("...(state.area ? { chosen: true } : {})");
  });

  it("stamps the copy for the phase, in one group, and never touches the original", () => {
    expect(fn).toContain("...handInPatch(state.phase.name).properties");
    expect(fn).toContain("const group = newGroupId();");
    expect(fn).not.toContain("item.delete");
    expect(fn).not.toContain("item.move");
  });
});

describe("the terminal has the same desk", () => {
  it("births a desk with the link off and one pass, knowing its sprint", () => {
    const desk = cli.slice(cli.indexOf('.command("desk <name...>")'), cli.indexOf('.command("end [note...]")'));
    expect(desk).toContain("properties: { [DESK_OF_PROP]: sprint.id }");
    expect(desk).toContain("g.subject === LINK");
    expect(desk).toContain("revokeGrant(canvasId, link.id)");
    expect(desk).toContain("mintPass(canvasId)");
    expect(desk).toContain("canvasUrlWithPass(origin, canvasId, token)");
  });

  it("hands in with one copy: --to, --in and --handin", () => {
    expect(cli).toContain('.option("--handin"');
    expect(cli).toContain("...(running ? handInPatch(running.phase.name).properties : {})");
  });

  it("is what the skill tells the facilitator to do", () => {
    expect(skill).toContain("isocan sprint desk <name>");
    expect(skill).toContain("--in <sheet> --handin");
  });
});
