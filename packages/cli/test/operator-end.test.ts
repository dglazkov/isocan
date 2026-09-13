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
  type OperatorEndResponse,
} from "@isocan/core";
import { harnessVars } from "@isocan/api";
import { startDaemon, type Daemon } from "@isocan/server";

/**
 * **The CLI does not resume an actor after an end by the operator** —
 * operator phase 4; journey 7 step 4, walked with the real binary against a
 * real home that has an operator.
 *
 * The bug this closes was read in the design and is walked here for the first
 * time: a CLI meeting a 401 knocks for a new badge and sends `actor.claim
 * {as}`, which the engine allows when no live badge still claims that actor —
 * so a killed CLI came back as the same name within a second. Now the 401
 * carries the tombstone's reason, `DaemonRoutes.request` throws on
 * `operator` rather than knocking, and the verb prints the sentence and
 * stops. Asserted three ways: the exit and the words; the badge file, which
 * still holds the ended badge and no new one; and the desk, which holds no
 * live badge claiming the actor.
 *
 * The operator's end is sent over HTTP with a token this file signed — the
 * verb's own browser half is the ⚑ walk — because what is being proved is the
 * CLI on the ENDED side, not the operator's.
 *
 * Fixtures are synthetic: Acme, Sam, Olu.
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

describe("a CLI whose badge the operator ended", () => {
  let home: string;
  let work: string;
  let daemon: Daemon;
  let base: string;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-operator-end-cli-home-"));
    work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-operator-end-cli-work-"));
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

  /** The real binary, as a PERSON at a terminal: no harness variables. */
  const cli = (args: string[]) => {
    const env: NodeJS.ProcessEnv = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port };
    for (const v of harnessVars) delete env[v];
    const child = spawn(process.execPath, [cliBin, ...args], { cwd: work, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c));
    child.stderr.on("data", (c) => (stderr += c));
    return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) =>
      child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
    );
  };

  const identity = async () =>
    JSON.parse(await fs.readFile(path.join(home, "identity.json"), "utf8")) as {
      id: string;
      auth: Record<string, { badgeId: string }>;
    };

  it("prints the sentence and stops, and does not come back as the same name", async () => {
    expect((await cli(["identity", "--home", "--name", "Sam"])).code).toBe(0);
    const made = await cli(["canvas", "create", "Acme board"]);
    expect(made.code, made.stderr).toBe(0);
    const before = await identity();
    const samsBadge = Object.values(before.auth)[0]!.badgeId;

    // The operator's terminal: an ordinary badge, and the proof in one header.
    const door = await fetch(`${base}${DOOR_ROUTE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrier: "bearer" }),
    });
    const desk = (await door.json()) as DoorResponse;
    const res = await fetch(`${base}/api/operator/end/${encodeURIComponent(before.id)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${formatBadgeToken(desk.badgeId, desk.secret!)}`,
        "Content-Type": "application/json",
        [OPERATOR_PROOF_HEADER]: idToken(OLU),
      },
      body: JSON.stringify({ reason: "harassment" }),
    });
    expect(res.status, await res.clone().text()).toBe(200);
    expect(((await res.json()) as OperatorEndResponse).ended).toEqual([samsBadge]);

    // Step 4: the sentence, and a stop. Exit 1, not a quiet success as Sam.
    const out = await cli(["canvas", "list", "--all"]);
    expect(out.code).toBe(1);
    expect(out.stderr).toMatch(
      /This surface was ended by the operator of this home on \d+ \w+ \d{4}: harassment\. Write to olu@example\.test\./,
    );
    expect(out.stderr).toMatch(/will not knock for a new one under your name/);
    expect(out.stdout).not.toMatch(/Acme board/);

    // No re-badge happened: the file still holds the ended badge and nothing
    // else, and the desk holds no live badge claiming Sam.
    const after = await identity();
    expect(Object.values(after.auth).map((a) => a.badgeId)).toEqual([samsBadge]);
    expect(await daemon.desk.claimants(before.id)).toEqual([]);

    // And it stays stopped: a second command reads the same sentence.
    const again = await cli(["canvas", "list", "--all"]);
    expect(again.code).toBe(1);
    expect(again.stderr).toMatch(/ended by the operator of this home/);
  }, 60_000);
});
