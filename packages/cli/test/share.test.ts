import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Grant } from "@isocan/core";
import { canvasUrl, grantsRoute } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";
import { markerFile } from "@isocan/server";
import { harnessVars } from "@isocan/api";
import { mintTestBadge } from "./badge.ts";

/**
 * **`isocan share` — the verb half of Scenes 1–2.**
 *
 * House rule 2 says an agent needs a verb for every intent a person has a
 * button for, and Phase 7 says it outright: "button and verb, one endpoint".
 * What is asserted here is that the endpoint really is the same one — and, in
 * particular, that the verb run on a REPLICA changes who may enter the canvas
 * **at the home**, because a grant is desk state and the row that guards the
 * door lives where the door is. A `share --link off` that quietly edited the
 * laptop's own ledger would print exactly the same success and leave the link
 * on for the world, which is the failure worth a real two-daemon test.
 *
 * The door is the witness throughout: a brand-new badge at the home is turned
 * away after the revoke and walks in after the re-grant, so nothing here is
 * asserting that a command printed a word.
 *
 * Fixtures are synthetic: Priya, an Acme board, and a stranger.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const priya = { id: "usr_priya", name: "Priya" };

let upstreamDir: string;
let laptopDir: string;
let work: string;
let homeDaemon: Daemon;
let laptop: Daemon;
let homeBase: string;
/** What the home has borrowed: nothing, except where a suite below says so
 * (`beforeAll` runs before the `beforeEach` that boots the home). */
let homeAuth: { project: string; apiKey: string } | null = null;

function baseOf(daemon: Daemon): string {
  const address = daemon.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

const portOf = (daemon: Daemon) => Number(new URL(baseOf(daemon)).port);

beforeEach(async () => {
  upstreamDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-share-home-"));
  laptopDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-share-laptop-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-share-work-"));
  // `auth: null`: this home has borrowed nothing, said rather than inherited
  // from whatever the developer's shell has in `ISOCAN_AUTH_PROJECT`. The
  // email refusal below is about a home with no attester, and it must be about
  // that on every machine.
  homeDaemon = await startDaemon({ port: 0, home: upstreamDir, birthHome: null, auth: homeAuth });
  homeBase = baseOf(homeDaemon);
  await fs.writeFile(
    path.join(laptopDir, "identity.json"),
    JSON.stringify({ ...priya, createdAt: new Date().toISOString() }),
  );
  laptop = await startDaemon({ port: 0, home: laptopDir, birthHome: homeBase, homePollMs: 50 });
});

afterEach(async () => {
  await laptop.close();
  await homeDaemon.close();
  await Promise.allSettled(
    [upstreamDir, laptopDir, work].map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

/** The real CLI, on the laptop, in a directory bound by a marker. */
function cli(...args: string[]): Promise<Run> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ISOCAN_HOME: laptopDir,
    ISOCAN_PORT: String(portOf(laptop)),
  };
  for (const v of harnessVars) delete env[v];
  env.CLAUDE_CODE_SESSION_ID = "s-priya";
  const child = spawn(process.execPath, [cliBin, ...args], { cwd: work, env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c) => (stdout += c));
  child.stderr.on("data", (c) => (stderr += c));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

/** Born through the replica, so born at the home — Scene 0's topology. */
async function bornCanvas(): Promise<string> {
  const born = await cli("identity", "--session");
  expect(born.code, born.stderr).toBe(0);
  const marker = JSON.parse(await fs.readFile(markerFile(work), "utf8")) as { projectId: string };
  return marker.projectId;
}

/** The home's own rows, read past the CLI entirely. */
async function grantsAtHome(canvasId: string): Promise<Grant[]> {
  const badge = await mintTestBadge(homeBase);
  const res = await fetch(`${homeBase}${grantsRoute(canvasId)}`, { headers: badge.headers });
  return ((await res.json()) as { grants: Grant[] }).grants;
}

/** A badge that has never been anywhere: does the door let it at the canvas? */
async function strangerCanRead(canvasId: string): Promise<number> {
  const badge = await mintTestBadge(homeBase);
  const res = await fetch(`${homeBase}/api/projects/${canvasId}/canvas`, {
    headers: badge.headers,
  });
  return res.status;
}

describe("isocan share", () => {
  it("prints the address a person is sent, and says the link is on", async () => {
    const canvasId = await bornCanvas();

    const shown = await cli("share");
    expect(shown.code, shown.stderr).toBe(0);
    // The home's address, never the laptop's 127.0.0.1: people always enter
    // through the one origin, and a replica serves no pages at all.
    expect(shown.stdout).toContain(canvasUrl(homeBase, canvasId));
    expect(shown.stdout).toMatch(/link\s+on —/);
  }, 60_000);

  it("--link off closes the door AT THE HOME, and --link on opens it again", async () => {
    const canvasId = await bornCanvas();
    expect(await strangerCanRead(canvasId)).toBe(200);

    const off = await cli("share", "--link", "off");
    expect(off.code, off.stderr).toBe(0);
    expect(off.stdout).toMatch(/link\s+off —/);
    // The witness is the door, at the home, for a badge this test just minted.
    expect(await strangerCanRead(canvasId)).toBe(403);

    const on = await cli("share", "--link", "on");
    expect(on.code, on.stderr).toBe(0);
    expect(await strangerCanRead(canvasId)).toBe(200);

    // Two rows, not one resurrected: revocation is a tombstone, so the desk
    // remembers that the link was off and who turned it back on.
    const rows = await grantsAtHome(canvasId);
    expect(rows).toHaveLength(1); // the listing hides tombstones…
    expect(rows[0]!.id).not.toBe("");
  }, 60_000);

  it("turning the link off twice is not an error — the gesture is idempotent", async () => {
    await bornCanvas();
    expect((await cli("share", "--link", "off")).code).toBe(0);
    const again = await cli("share", "--link", "off");
    expect(again.code, again.stderr).toBe(0);
    expect(again.stdout).toMatch(/link\s+off —/);
  }, 60_000);

  it("refuses --link with anything that is not a rung, off, or on", async () => {
    await bornCanvas();
    const bad = await cli("share", "--link", "maybe");
    expect(bad.code).toBe(1);
    expect(bad.stderr).toMatch(/on, off, edit, read or view/);
    // `own` is a rung and not a link setting: a link that made owners of
    // strangers would be a link that could revoke itself.
    const owned = await cli("share", "--link", "own");
    expect(owned.code).toBe(1);
  }, 60_000);

  /** The roles ladder's verb half (roles phase 1): the same link row, at the
   * canvas rung. The mechanism is the home's (`view-only.test.ts` pins it);
   * what the CLI owes is the round trip and a status line that says which
   * rung the link is at — and that the rung reaches the home's own rows. */
  it("turns the link read-only with --link read, and edit is on by its ladder name", async () => {
    const canvasId = await bornCanvas();
    const reading = await cli("share", "--link", "read");
    expect(reading.code, reading.stderr).toBe(0);
    expect(reading.stdout).toMatch(/link\s+read-only —/);
    expect(reading.stdout).toMatch(/see the canvas/);
    const rows = await grantsAtHome(canvasId);
    expect(rows.find((g) => g.subject === "link")?.capability).toBe("read");
    // And the door at the home admits a stranger to read — 200, not 403.
    expect(await strangerCanRead(canvasId)).toBe(200);
    const widened = await cli("share", "--link", "edit");
    expect(widened.code, widened.stderr).toBe(0);
    expect(widened.stdout).toMatch(/link\s+on —/);
    expect((await grantsAtHome(canvasId)).find((g) => g.subject === "link")?.capability).toBeUndefined();
  }, 60_000);

  it("--as puts an invitation on a rung, and checks the word before asking the home", async () => {
    await bornCanvas();
    const typo = await cli("share", "jordan@example.com", "--as", "reader");
    expect(typo.code).toBe(1);
    expect(typo.stderr).toMatch(/own, edit, read or view/);
    // A rung with nobody to invite is a flag with nothing to say.
    const alone = await cli("share", "--as", "read");
    expect(alone.code).toBe(1);
    expect(alone.stderr).toMatch(/name somebody/);
    // A well-formed rung goes up: this home has no attester, so the refusal
    // is the home's about the ADDRESS and not the CLI's about the rung.
    const asked = await cli("share", "jordan@example.com", "--as", "read");
    expect(asked.code).toBe(1);
    expect(asked.stderr).toMatch(/verify an email/);
  }, 60_000);

  /** The #88 verb: the same link row, narrowed. The mechanism is the home's
   * (`view-only.test.ts` pins it); what the CLI owes is the round trip and a
   * status line that says which link is on. */
  it("turns the link view-only with --link view, and back on with --link on", async () => {
    await bornCanvas();
    const narrowed = await cli("share", "--link", "view");
    expect(narrowed.code, narrowed.stderr).toBe(0);
    expect(narrowed.stdout).toMatch(/link\s+view-only —/);
    expect(narrowed.stdout).toMatch(/change nothing/);
    const widened = await cli("share", "--link", "on");
    expect(widened.code, widened.stderr).toBe(0);
    expect(widened.stdout).toMatch(/link\s+on —/);
  }, 60_000);

  it("hands back the HOME's refusal for an email — a home with no attester, not a stub", async () => {
    await bornCanvas();
    const refused = await cli("share", "jordan@example.com");
    expect(refused.code).toBe(1);
    // Not a client-side "not yet": the request went up, and the message is the
    // one the API gives, so a later build that can satisfy the subject needs
    // no change here. Phase 9 made `email:` a real subject and moved the
    // refusal from "the phase has not happened" to "this home has borrowed
    // nowhere to verify it" — the verb did not have to be touched for either.
    expect(refused.stderr).toMatch(/verify an email/);
    expect(refused.stderr).toMatch(/borrowed/);
    expect(refused.stderr).toContain("jordan@example.com");
  }, 60_000);

  it("--revoke refuses loudly when nobody is granted that, rather than reporting nothing", async () => {
    await bornCanvas();
    // "Jordan is out" when Jordan was never in is the worst possible answer to
    // this gesture, and a mistyped address is the ordinary way to get it. The
    // verb takes the SENTENCE rather than a grant id, so a typo is exactly
    // what a person is most likely to hand it.
    const missed = await cli("share", "--revoke", "jordan@example.com");
    expect(missed.code).toBe(1);
    expect(missed.stderr).toContain("email:jordan@example.com");
    expect(missed.stderr).toMatch(/nothing on/);
  }, 60_000);

  it("--json carries the address and the live rows", async () => {
    const canvasId = await bornCanvas();
    const json = await cli("share", "--json");
    expect(json.code, json.stderr).toBe(0);
    const payload = JSON.parse(json.stdout) as { address: string; grants: Grant[] };
    expect(payload.address).toBe(canvasUrl(homeBase, canvasId));
    expect(payload.grants.map((g) => g.subject)).toEqual(["link"]);
    expect(payload.grants[0]!.canvasId).toBe(canvasId);
  }, 60_000);
});

/**
 * **`--revoke [--bar]`, `--bar`, `--unbar`** (roles phase 3; journey 3 steps
 * 3–4). The home here has borrowed an attester in configuration only, so an
 * address can be invited and barred; the proofs are written on its desk. The
 * door at the home is the witness, as above: a badge that has proved the
 * barred address is refused while a stranger walks in on the same link.
 */
describe("isocan share keeps people out", () => {
  beforeAll(() => {
    homeAuth = { project: "acme-test", apiKey: "test-key" };
  });
  afterAll(() => {
    homeAuth = null;
  });

  /** A badge at the home that has proved this address. */
  async function holderOf(email: string) {
    const badge = await mintTestBadge(homeBase);
    await homeDaemon.desk.attest(badge.badgeId, {
      attribute: `email:${email}`,
      verifiedVia: "magic-link",
      at: new Date().toISOString(),
    });
    return badge;
  }
  const enter = async (badge: { headers: Record<string, string> }, canvasId: string) =>
    (await fetch(`${homeBase}/api/projects/${canvasId}/canvas`, { headers: badge.headers })).status;

  it("--revoke says the link would still admit them, and --bar keeps them out in the same request", async () => {
    const canvasId = await bornCanvas();
    expect((await cli("share", "sam@example.com")).code).toBe(0);
    const sam = await holderOf("sam@example.com");
    expect(await enter(sam, canvasId)).toBe(200);

    const revoked = await cli("share", "--revoke", "sam@example.com");
    expect(revoked.code, revoked.stderr).toBe(0);
    expect(revoked.stdout).toContain("revoked email:sam@example.com");
    // The sentence, from the home's answer: withdrawing is not barring.
    expect(revoked.stdout).toContain("they can still enter by the link; `--bar` to keep them out");
    expect(await enter(sam, canvasId)).toBe(200);

    expect((await cli("share", "sam@example.com")).code).toBe(0);
    const barred = await cli("share", "--revoke", "sam@example.com", "--bar");
    expect(barred.code, barred.stderr).toBe(0);
    expect(barred.stdout).toMatch(/revoked email:sam@example\.com .* and kept out/);
    expect(barred.stdout).not.toContain("can still enter");
    const rows = await grantsAtHome(canvasId);
    expect(rows.filter((g) => g.subject === "email:sam@example.com")).toEqual([
      expect.objectContaining({ bars: true }),
    ]);
    // The door: Sam is refused, a stranger is admitted by the same link.
    expect(await enter(sam, canvasId)).toBe(403);
    expect(await strangerCanRead(canvasId)).toBe(200);

    // The table prints the bar as kept out, with when and by whom.
    const shown = await cli("share");
    expect(shown.code, shown.stderr).toBe(0);
    const line = shown.stdout.split("\n").find((l) => l.includes("email:sam@example.com"))!;
    expect(line).toMatch(/kept out\s+\d{4}-\d{2}-\d{2}\s+bdg_/);
    const json = await cli("share", "--json");
    const payload = JSON.parse(json.stdout) as { grants: Grant[] };
    expect(payload.grants.find((g) => g.subject === "email:sam@example.com")?.bars).toBe(true);
  }, 90_000);

  it("--bar writes the bar directly, --unbar lifts it, and both refuse what is not there", async () => {
    const canvasId = await bornCanvas();
    const nico = await holderOf("nico@example.com");
    expect(await enter(nico, canvasId)).toBe(200);

    const kept = await cli("share", "--bar", "nico@example.com");
    expect(kept.code, kept.stderr).toBe(0);
    expect(kept.stdout).toMatch(/kept out email:nico@example\.com/);
    expect(await enter(nico, canvasId)).toBe(403);

    // Revoking somebody who is kept out, not invited, points at --unbar.
    const wrong = await cli("share", "--revoke", "nico@example.com");
    expect(wrong.code).toBe(1);
    expect(wrong.stderr).toMatch(/--unbar/);

    const back = await cli("share", "--unbar", "nico@example.com");
    expect(back.code, back.stderr).toBe(0);
    expect(back.stdout).toMatch(/let email:nico@example\.com back in/);
    expect(await enter(nico, canvasId)).toBe(200);

    const nobody = await cli("share", "--unbar", "nico@example.com");
    expect(nobody.code).toBe(1);
    expect(nobody.stderr).toMatch(/nobody is kept out/);
    // A bare --bar with nobody to bar, and --bar <who> beside --revoke, are
    // refused rather than guessed at.
    expect((await cli("share", "--bar")).code).toBe(1);
    expect((await cli("share", "--revoke", "a@example.com", "--bar", "b@example.com")).code).toBe(1);
    // The link and the creator are the home's refusals, handed back whole.
    const link = await cli("share", "--bar", "link");
    expect(link.code).toBe(1);
  }, 90_000);
});
