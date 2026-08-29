import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Three surfaces, one derivation.**
 *
 * The agent tray is the redesign's least novel feature and its most
 * isocan-specific one: nothing here is computed. The states were already
 * correct and already printed by `isocan who`; they had simply never been
 * shown to the person at the canvas, who had to read a facepile of initials
 * and guess.
 *
 * What this guards is that it stays that way. The moment the tray works out
 * for itself what "working" means, the terminal and the canvas can disagree
 * about the same agent — and the person believes whichever one they are
 * looking at.
 */
const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8");
const tray = read("components/AgentTray.tsx");

describe("the tray shows what the terminal would print", () => {
  it("asks core's roster, the same one `isocan who` and the workbench use", () => {
    expect(tray).toMatch(/roster\(sessions, canvas, Date\.now\(\)\)/);
    expect(read("components/Workbench.tsx"), "the workbench still asks the same one").toMatch(
      /roster\(sessions, canvas, Date\.now\(\)\)/,
    );
    // No local opinion about state. `sessionState` is roster's own business.
    expect(tray, "the tray must not decide what working means").not.toMatch(/sessionState\(/);
  });

  it("draws a row with the component the workbench draws one with", () => {
    // Lifted out of `Workbench.tsx` rather than copied: a second copy of "how
    // an agent's row looks" is how two views come to disagree about where a
    // row's link goes.
    expect(tray).toMatch(/<AgentRowView/);
    expect(read("components/Workbench.tsx")).toMatch(/import \{ AgentRowView \}/);
    expect(read("components/AgentRow.tsx")).toMatch(/export function AgentRowView\(/);
  });

  it("never prints 'away' on the screen its reader is looking at", () => {
    // The store filters your own session out of presence, so an unfiltered
    // roster puts YOU in its away half. The workbench carries the same guard
    // and the same comment; this is the bug being prevented twice, not once.
    expect(tray).toMatch(/row\.state === "away" && row\.actorId === actor\.id/);
  });

  it("has an empty state that says how to get in the room", () => {
    expect(tray).toMatch(/isocan wait/);
  });
});

describe("the dock holds one of three, and everything knows", () => {
  it("counts all three panels as the rail being open", () => {
    // Spelled once in `stage.ts`, so a fourth panel cannot be added without
    // every caller learning about it — framing, the pan and the strip all
    // read this one answer.
    const stage = read("lib/stage.ts");
    expect(stage).toMatch(
      /return ui\.mainPanelOpen \|\| ui\.filesPanelOpen \|\| ui\.agentsPanelOpen;/,
    );
    expect(stage, "dockEdges must go through it").toMatch(/railSpan\(railIsOpen\(ui\)/);
  });

  it("lets nobody spell out which panels count as open", () => {
    /**
     * `railIsOpen` existed and the minimap did not ask it — it asked about
     * Chat and Files by name, which was true until the tray was added and
     * then left the map sitting INSIDE the open tray. A shared answer only
     * helps if it is the only answer, so this is the rule rather than the
     * instance: nothing outside `stage.ts` and the store may decide what
     * "the rail is open" means.
     */
    const offenders: string[] = [];
    for (const rel of readdirSync(fileURLToPath(new URL("../src", import.meta.url)), {
      recursive: true,
      encoding: "utf8",
    })) {
      if (!rel.endsWith(".tsx") && !rel.endsWith(".ts")) continue;
      if (rel.endsWith("lib/stage.ts") || rel.endsWith("stores/uiStore.ts")) continue;
      if (rel.endsWith("lib/panels.ts")) continue; // it SETS them, one at a time
      const src = read(rel);
      src.split("\n").forEach((line, i) => {
        const code = line.trim();
        if (code.startsWith("//") || code.startsWith("*")) return;
        // Two of the three panels in one boolean is the shape that goes stale.
        if (/(mainPanelOpen|filesPanelOpen|agentsPanelOpen)[^\n]*\|\|[^\n]*(mainPanelOpen|filesPanelOpen|agentsPanelOpen)/.test(line)) {
          offenders.push(`src/${rel}:${i + 1} — ${code}`);
        }
      });
    }
    expect(offenders, "ask railIsOpen(); it is the whole answer").toEqual([]);
  });

  it("remembers the tray the way it remembers the other two", () => {
    const panels = read("lib/panels.ts");
    expect(panels).toMatch(/agents: \(canvasId\) => `isocan\.agentspanel\./);
    expect(panels, "and restores it").toMatch(/KEY\.agents\(canvasId\)\) === "open"\) return "agents"/);
  });

  it("sends a face on the strip to the tray, not to the Chat", () => {
    // A face is a question about what that agent is DOING. Answering it with
    // the conversation was the strip's faces being decorative, which is what
    // phase 3 set out to avoid.
    expect(read("components/RailStrip.tsx")).toMatch(/openPanel\(canvasId, "agents"\)/);
  });
});
