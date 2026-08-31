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

describe("the dock holds one at a time, and everything knows", () => {
  it("counts every panel as the rail being open", () => {
    /**
     * Spelled once in `stage.ts`, so a new panel cannot be added without
     * every caller learning about it — framing, the pan, the strip and the
     * minimap all read this one answer.
     *
     * The fourth panel (Context) proved it works, and the fifth (Personas)
     * proved it again: adding one meant editing this one function, and nothing
     * standing beside the rail had to be found and told. That is what the
     * guard below is protecting.
     */
    const stage = read("lib/stage.ts");
    /**
     * **Derived from `DockState`, not a hard-coded pair.** This used to assert
     * two exact strings — `ui.mainPanelOpen || ui.filesPanelOpen` and
     * `ui.agentsPanelOpen || ui.contextPanelOpen` — which had two problems:
     * reformatting the function across lines broke it while the code stayed
     * correct, and adding a SIXTH panel would have left it passing while
     * `railIsOpen` ignored it. Reading the field list off the interface fixes
     * both: every `*PanelOpen` that exists must be counted, however the
     * function happens to be laid out.
     */
    const fields = [...stage.matchAll(/^ {2}(\w+PanelOpen): boolean;$/gm)].map((m) => m[1]!);
    expect(fields.length, "DockState should declare the panels").toBeGreaterThan(3);
    const body = stage.slice(stage.indexOf("export function railIsOpen"));
    const answer = body.slice(0, body.indexOf("}"));
    const missing = fields.filter((f) => !answer.includes(`ui.${f}`));
    expect(missing, "railIsOpen must count every panel in DockState").toEqual([]);
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

/**
 * **The standing-agent doors** (agents-on-demand phase 2.5): the tray is
 * where journey 1 adds an agent and journey 8 dismisses one. What these
 * guard: the gestures go through the SAME ops the CLI verbs send — one
 * record, two doors — and the dialog's rc line is derived from the rc's
 * presence announcement rather than optimism.
 */
describe("the tray's standing-agent doors", () => {
  const add = read("components/AddAgent.tsx");
  const row = read("components/AgentRow.tsx");

  it("the dialog claims the actor and sends the enroll op — the CLI's exact moves", () => {
    expect(add).toMatch(/sessionKey: `agent:\$\{canvasId\}:\$\{wanted\}`/);
    expect(add).toMatch(/type: "agent\.enroll"/);
  });

  it("the dialog's footer tells the truth about the rc, from its announcement", () => {
    expect(add).toMatch(/s\.kind === "rc"/);
    // Both worlds have words: an rc parked, and the line to start one.
    expect(add).toMatch(/isocan rc/);
  });

  it("dismiss appears exactly on rows with standing, and sends the withdraw op", () => {
    expect(tray).toMatch(/canvas\?\.agents\?\.\[row\.actorId\]/);
    expect(tray).toMatch(/type: "agent\.withdraw"/);
  });

  it("the standing words are the derivation's, never invented in rendering", () => {
    // Phase 6 earned "answerable": it renders exactly when roster() derives
    // it from the connection-bound rc holds — the row prints `row.state`,
    // and the one hand-written claim is the safe direction ("nobody is
    // listening"), never an unearned promise.
    expect(row).toMatch(/row\.state === "enrolled" \|\| row\.state === "answerable"/);
    expect(row).toMatch(/\{row\.state\}/);
    expect(row).toMatch(/nobody is listening/);
  });
});
