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
    expect(tray).toMatch(/roster\(sessions, canvas, Date\.now\(\), answerable\)/);
    expect(read("components/Workbench.tsx"), "the workbench still asks the same one").toMatch(
      /roster\(sessions, canvas, Date\.now\(\), answerable\)/,
    );
    // No local opinion about state. `sessionState` is roster's own business.
    expect(tray, "the tray must not decide what working means").not.toMatch(/sessionState\(/);
  });

  it("passes the fourth argument, without which a standing agent cannot be answerable", () => {
    /**
     * **This guard used to freeze the bug.** It asserted the exact call
     * `roster(sessions, canvas, Date.now())` — three arguments, matching what
     * the app did — and the fourth is the connection-bound set of actors a
     * live rc is answering for. Omit it and `roster()` downgrades every
     * standing row to `enrolled`, so the app said "nobody is listening right
     * now" beside an agent that was listening, while `isocan who` on the same
     * canvas said `answerable`. `AgentRow` had the branch written and nothing
     * could reach it.
     *
     * A guard pinned to a call's exact shape guards the shape. This one asks
     * for the FACT: the liveness set is fetched, and it goes to the fold.
     */
    for (const file of ["components/AgentTray.tsx", "components/Workbench.tsx"]) {
      expect(read(file), `${file} must ask who is answering`).toMatch(/useAnswerable\(/);
    }
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
 * **The standing-agent doors** (agents-on-demand phase 2.5, reshaped by
 * agent-custody 2026-08-31): the tray is where journey 1 adds an agent and
 * journey 8 dismisses one. What these guard now: adding is an ASK the parked
 * rc completes — the browser never mints the actor, because an actor minted
 * on a cookie badge is one the machine running the turns can never vouch for
 * at the home (issue #83) — and the gesture exists only while an rc is
 * parked, on the connection-bound fact rather than a presence TTL (issue
 * #81's decided shape: no rc, no button).
 */
describe("the tray's standing-agent doors", () => {
  const add = read("components/AddAgent.tsx");
  const row = read("components/AgentRow.tsx");

  it("the dialog asks the parked rc, and never mints the actor itself", () => {
    /**
     * **This guard used to freeze issue #83.** It asserted the dialog's own
     * claim-then-enroll — "the CLI's exact moves" — which was true in the
     * oplog and false at the desk: the claim landed on the BROWSER's badge,
     * so the laptop relaying the agent's face could never vouch for it and
     * the home dropped it silently. The custody design inverts the gesture:
     * the dialog sends a name, the rc claims and enrolls on the machine that
     * answers, and the records become indistinguishable from `isocan agent
     * add` at the desk too.
     */
    expect(add).toMatch(/askEnrolAgent\(/);
    expect(add, "minting is the rc's, never the browser's").not.toMatch(/actor\.claim/);
    expect(add, "the enroll op is sent by the rc, not from here").not.toMatch(
      /type: "agent\.enroll"/,
    );
    // The outcome is the op landing — the dialog watches the roster and has
    // a countdown, because failure may not be silent.
    expect(add).toMatch(/canvas\?\.agents/);
    expect(add).toMatch(/ASK_PATIENCE_MS/);
  });

  it("no rc, no button — gated on the connection-bound fact", () => {
    expect(add).toMatch(/useRcParked\(/);
    expect(add).toMatch(/if \(!parked\) return null/);
    // Not the presence announcement: an "rc" kind session outlives a killed
    // rc by its TTL, and a button standing on a TTL is the lie journey 7
    // forbids for "answerable" wearing different clothes.
    expect(add).not.toMatch(/kind === "rc"/);
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
