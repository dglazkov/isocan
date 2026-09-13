import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { createSign, generateKeyPairSync } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DOOR_ROUTE,
  formatBadgeToken,
  OPERATOR_PROOF_HEADER,
  type DoorResponse,
  type OperatorAct,
  type OperatorLogResponse,
  type OperatorRevokeResponse,
} from "@isocan/core";
import { harnessVars } from "@isocan/api";
import { markerFile, startDaemon, type Daemon } from "@isocan/server";

/**
 * **`isocan share` reads a grant the operator turned off, and the owner
 * turns it back on from the terminal** — operator phase 5; journey 8 step 3,
 * walked with the real binary against a real home that has an operator.
 *
 * Two things only the verb can prove: that the sentence the home hands over
 * in `turnedOff` is what `isocan share` prints where the link's status goes,
 * instead of the plain *off* — and that the owner's `isocan share --link on`
 * afterwards is the ordinary grant write it always was, with no proof asked
 * and no row in the operator's ledger. The operator's revoke itself is sent
 * over HTTP with a token this file signed — the verb's browser half is the ⚑
 * walk — because what is being proved is the OWNER's side.
 *
 * And the verb refuses inside a summoned session before any browser opens,
 * as every operator verb does (journey 10).
 *
 * Fixtures are synthetic: Acme, Priya, Olu.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const PROJECT = "isocan-io-dev";
const auth = { project: PROJECT, apiKey: "browser-key-not-a-secret" };
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const keys = { kid_1: publicKey.export({ type: "spki", format: "pem" }) as string };
const OLU = "olu@example.test";

function idToken(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url");
  const head = b64({ alg: "RS256", kid: "kid_1", typ: "JWT" });
  const body = b64({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: `uid_${email}`,
    iat: now - 60,
    exp: now + 3600,
    email,
    email_verified: true,
    auth_time: now - 30,
  });
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${body}`);
  return `${head}.${body}.${signer.sign(privateKey).toString("base64url")}`;
}

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function spawnCli(args: string[], env: NodeJS.ProcessEnv, cwd?: string): Promise<Run> {
  const child = spawn(process.execPath, [cliBin, ...args], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c) => (stdout += c));
  child.stderr.on("data", (c) => (stderr += c));
  return new Promise((resolve) => child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })));
}

describe("the owner's terminal, after the operator turned the link off", () => {
  let home: string;
  let work: string;
  let daemon: Daemon;
  let base: string;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-operator-revoke-cli-home-"));
    work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-operator-revoke-cli-work-"));
    daemon = await startDaemon({
      port: 0,
      home: work,
      birthHome: null,
      auth,
      operators: [`email:${OLU}`],
      signingKeys: async () => keys,
    });
    const address = daemon.app.server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });

  afterEach(async () => {
    await daemon?.close();
    daemon = undefined as unknown as Daemon;
    for (const dir of [home, work]) {
      await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  /** The real binary, as Priya at a terminal. The ambient harness is cleared
   * and one session variable set, as `share.test.ts` does, because `identity
   * --session` is the shortest way to a canvas bound in `work` — it is not
   * `ISOCAN_SESSION_ID`, so nothing here reads as summoned. */
  const cli = (...args: string[]) => {
    const env: NodeJS.ProcessEnv = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port };
    for (const v of harnessVars) delete env[v];
    env.CLAUDE_CODE_SESSION_ID = "s-priya";
    return spawnCli(args, env, work);
  };

  /** The operator's terminal: an ordinary badge through the door, the proof
   * in one header. */
  async function operatorHeaders(): Promise<Record<string, string>> {
    const door = await fetch(`${base}${DOOR_ROUTE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrier: "bearer" }),
    });
    const desk = (await door.json()) as DoorResponse;
    return {
      Authorization: `Bearer ${formatBadgeToken(desk.badgeId, desk.secret!)}`,
      "Content-Type": "application/json",
      [OPERATOR_PROOF_HEADER]: idToken(OLU),
    };
  }

  /** The ledger, minus the rows that reading it writes. */
  async function ledger(headers: Record<string, string>): Promise<OperatorAct[]> {
    const res = await fetch(`${base}/api/operator/log`, { headers });
    return ((await res.json()) as OperatorLogResponse).acts.filter((row) => row.act !== "log");
  }

  it("prints the sentence where the link's status goes, then turns it back on with no proof and no ledger row", async () => {
    expect((await cli("identity", "--home", "--name", "Priya")).code).toBe(0);
    const born = await cli("identity", "--session");
    expect(born.code, born.stderr).toBe(0);
    const { projectId } = JSON.parse(await fs.readFile(markerFile(work), "utf8")) as { projectId: string };

    const headers = await operatorHeaders();
    const res = await fetch(`${base}/api/operator/revoke/${encodeURIComponent(projectId)}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ subject: "link", reason: "spam" }),
    });
    expect(res.status, await res.clone().text()).toBe(200);
    const answer = (await res.json()) as OperatorRevokeResponse;
    expect(answer.grant.revokedVia).toBe("operator");

    // Step 3, in the terminal: the link is off, and the line says whose act
    // it was and why — the row's sentence, not a badge id — and that it is
    // Priya's to undo.
    const shown = await cli("share");
    expect(shown.code, shown.stderr).toBe(0);
    expect(shown.stdout).toMatch(
      /link\s+off — Turned off by the operator of this home on \d+ \w+ \d{4}: spam\. Write to olu@example\.test\./,
    );
    expect(shown.stdout).toMatch(/You can turn it back on: `isocan share --link on`/);
    const asJson = await cli("share", "--json");
    expect(asJson.code).toBe(0);
    const parsed = JSON.parse(asJson.stdout) as { turnedOff?: { id: string; revokedVia?: string }[] };
    expect(parsed.turnedOff?.map((g) => g.id)).toEqual([answer.grant.id]);

    // She turns it back on. An ordinary owner's write: no browser, no proof.
    const before = await ledger(headers);
    expect(before.map((row) => row.act)).toEqual(["revoke"]);
    const on = await cli("share", "--link", "on");
    expect(on.code, on.stderr).toBe(0);
    expect(on.stdout).toMatch(/link\s+on — anyone with the address can enter/);
    expect(on.stdout).not.toMatch(/Turned off by the operator/);

    // The owner's act is the owner's: the ledger holds the operator's row and
    // not hers.
    const after = await ledger(headers);
    expect(after.map((row) => row.id)).toEqual(before.map((row) => row.id));
  }, 60_000);
});

describe("the real binary, in a summoned session", () => {
  let home: string;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-operator-revoke-session-"));
  });

  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("refuses `operator revoke` before a browser opens, as every operator verb does", async () => {
    // No daemon and no `ISOCAN_PORT`, deliberately: the refusal has to come
    // before `ctxOf`, which would otherwise spawn one. See `operator.test.ts`.
    const env: NodeJS.ProcessEnv = { ...process.env, ISOCAN_HOME: home };
    for (const v of harnessVars) delete env[v];
    Object.assign(env, { ISOCAN_SESSION_ID: "Sonia", ISOCAN_HARNESS: "agent" });
    const started = Date.now();
    const out = await spawnCli(["operator", "revoke", "prj_reported1", "link", "--reason", "spam"], env);
    expect(out.code).not.toBe(0);
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(out.stderr).toMatch(/operator acts need the person who runs this home/);
    expect(out.stdout).not.toMatch(/operator\/prove/);
  }, 20_000);
});
