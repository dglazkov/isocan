import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PASS_REDEEM_ROUTE, ownsAgent, passesRoute, type ActorClaim, type MintPassResponse } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Who may choose an agent's pointer** (agent pointers, 30 Sep 2026).
 *
 * An agent's pointer is its mark, and `actor.setMark` asks the presenting
 * badge to claim whose face changes. That was the whole rule, and it left the
 * one surface where a pointer is looked at — the owner's browser — unable to
 * dress the owner's own agent, because the agent lives on the machine that
 * enrolled it. The second arm (`ownsAgent`) lets a person mark an AGENT that
 * one of their own badges holds, and nothing wider: not a person, and not
 * somebody else's agent.
 */

const ada = { id: "usr_ada_acme", name: "Ada" };
const rover = { id: "usr_rover_acme", name: "Rover" };
const bo = { id: "usr_bo_acme", name: "Bo" };
const boBot = { id: "usr_bobot_acme", name: "Bo's Bot" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-agentmark-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const mark = (badge: TestBadge, speaker: { id: string; name: string }, target: string, emoji: string | null) =>
  fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ canvasId: null, actor: speaker, op: { type: "actor.setMark", actorId: target, mark: emoji } }),
  });

const marks = async (badge: TestBadge) =>
  ((await (await fetch(`${base}/api/marks`, { headers: badge.headers })).json()) as { marks?: Record<string, string> } & Record<string, unknown>);

const codeOf = async (res: Response) => ((await res.json()) as { code?: string }).code;

/** Ada's laptop holds Ada and the agent it enrolled; her browser holds Ada
 * alone. Bo is somebody else, with a laptop of his own and an agent on it. */
async function rig() {
  const laptop = await mintTestBadge(base);
  await laptop.speakAs(ada, "home:ada-laptop");
  await laptop.speakAs(rover, "agent:rover-acme");
  // The browser becomes Ada the way people's browsers do: handed a pass by
  // a surface that already is her (`isocan open`).
  await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...laptop.headers },
    body: JSON.stringify({ canvasId: null, actor: ada, op: { type: "project.create", canvasId: "prj_acme", title: "Acme" } }),
  });
  const minted = await fetch(`${base}${passesRoute("prj_acme")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...laptop.headers },
    body: JSON.stringify({ actorId: ada.id }),
  });
  const { token } = (await minted.json()) as MintPassResponse;
  const browser = await mintTestBadge(base);
  const redeemed = await fetch(`${base}${PASS_REDEEM_ROUTE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...browser.headers },
    body: JSON.stringify({ token }),
  });
  if (!redeemed.ok) throw new Error(`could not redeem the pass: ${await redeemed.text()}`);
  const theirs = await mintTestBadge(base);
  await theirs.speakAs(bo, "home:bo-laptop");
  await theirs.speakAs(boBot, "agent:bobot-acme");
  return { laptop, browser, theirs };
}

describe("the rule, as a function", () => {
  const claim = (actorId: string): ActorClaim => ({ actorId }) as ActorClaim;
  it("is an agent held on a badge that also holds the speaker", () => {
    const laptop = [claim(ada.id), claim(rover.id)];
    expect(ownsAgent([laptop], ada.id, true)).toBe(true);
    expect(ownsAgent([laptop], bo.id, true)).toBe(false);
    // Never a person, whoever holds them.
    expect(ownsAgent([laptop], ada.id, false)).toBe(false);
  });
});

describe("actor.setMark on an agent, over HTTP", () => {
  it("the owner's browser may dress the owner's agent, though it does not hold it", async () => {
    const { browser } = await rig();
    const res = await mark(browser, ada, rover.id, "🐕");
    expect(res.status, await res.clone().text()).toBe(200);
    expect(JSON.stringify(await marks(browser))).toContain(`"${rover.id}":"🐕"`);
    // And take it back: null is the arrow again.
    expect((await mark(browser, ada, rover.id, null)).status).toBe(200);
    expect(JSON.stringify(await marks(browser))).not.toContain(rover.id);
  });

  it("the machine holding the agent may, as it always could", async () => {
    const { laptop } = await rig();
    expect((await mark(laptop, ada, rover.id, "🐕")).status).toBe(200);
  });

  it("somebody else may not mark your agent", async () => {
    const { theirs } = await rig();
    const res = await mark(theirs, bo, rover.id, "🐱");
    expect(res.status).toBe(400);
    expect(await codeOf(res)).toBe("not-your-actor");
  });

  it("the owner arm reaches agents only — never another person's face", async () => {
    const { browser, laptop } = await rig();
    // Bo is a person; nothing Ada holds makes his face hers to choose.
    expect(await codeOf(await mark(browser, ada, bo.id, "🐱"))).toBe("not-your-actor");
    expect(await codeOf(await mark(laptop, ada, bo.id, "🐱"))).toBe("not-your-actor");
    // And Bo's agent is Bo's.
    expect(await codeOf(await mark(browser, ada, boBot.id, "🐱"))).toBe("not-your-actor");
    // A PERSON sharing Ada's laptop is still not hers to dress from her
    // browser: the arm is for agents, whoever else a machine holds.
    const cy = { id: "usr_cy_acme", name: "Cy" };
    await laptop.speakAs(cy, "home:cy-on-ada-laptop");
    expect(await codeOf(await mark(browser, ada, cy.id, "🐱"))).toBe("not-your-actor");
  });
});
