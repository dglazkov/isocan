import { describe, expect, it } from "vitest";
import { LIVE_TOOLS, VOICE_RULES, commandsBrief, planForCall } from "../src/live.ts";

/**
 * **`run_command`: a skill, by name, from a voice.** The tool list and the
 * rule the model reads are shared by both voice surfaces, so they are held
 * here, in the file that owns them.
 *
 * The browser dialog asks its host first and runs a module's command in the
 * page; everything below is the PORTABLE meaning — what the standing harness,
 * which has no page, does with the same call.
 */
describe("run_command", () => {
  it("is declared, and says a posted command is not a done one", () => {
    const tool = LIVE_TOOLS.find((t) => t.name === "run_command");
    expect(tool).toBeDefined();
    expect(tool!.description).toMatch(/never claim a posted command is done/);
  });

  it("posts the command line to the Chat — the harness's whole meaning", () => {
    const { plans } = planForCall("run_command", { name: "wire", args: "a bowling score tracker" });
    expect(plans).toEqual([
      { op: { type: "thread.reply", body: "/wire a bowling score tracker" }, said: "posted /wire a bowling score tracker" },
    ]);
  });

  it("takes a name with or without its slash, and no args", () => {
    expect(planForCall("run_command", { name: "/design-audit" }).plans[0]!.op).toEqual({
      type: "thread.reply",
      body: "/design-audit",
    });
  });

  /**
   * The rule used to teach `say "/build …"`, which is how a voice asked to
   * "use the /wire skill" ended up reaching for `agent_enroll` instead: a
   * command was something you SAID, and a skill sounded like something you
   * enrol. It names the tool now, and says not to enrol.
   */
  it("the rule the model reads names run_command, and warns off enrolling", () => {
    expect(VOICE_RULES).toContain("`run_command`");
    expect(VOICE_RULES).toMatch(/Never enrol an agent to use a skill/);
    expect(VOICE_RULES).not.toMatch(/with `say` \(for example, say "\//);
  });

  it("the brief is the caller's list when one is handed over", () => {
    const brief = commandsBrief([{ name: "acme", usage: "<thing>", description: "Does the Acme thing" }]);
    expect(brief).toBe("/acme <thing> — Does the Acme thing");
  });
});
