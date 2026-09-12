import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeHandoff, PROVE_PATH_PREFIX, proveSegmentIn } from "@isocan/core";
import { harnessVars } from "@isocan/api";
import { startDaemon, type Daemon } from "@isocan/server";
import { proveInBrowser, summonedRefusal } from "../src/operator.ts";

/**
 * **The terminal's half of the operator proof** — operator phase 1.
 *
 * Three things are proved here and they are the three the CLI actually owns:
 *
 * 1. **The refusal inside a summoned session, before any browser opens** —
 *    journey 10, run against the real binary with `ISOCAN_SESSION_ID` set, so
 *    the assertion that nothing opened is a fact about a process rather than a
 *    claim about a code path.
 * 2. **The sentence a home with no operator gives the VERB** — journey 11 step
 *    2, against a real daemon, asserted as a process that exits. See that
 *    suite's own header for why a route-level proof of the same sentence was
 *    green while the verb hung.
 * 3. **The loopback dance**, with a fake browser standing in for a real one:
 *    the address is built, the summary is in it, a form POST to the loopback
 *    hands a token back, and a hand-over carrying the wrong `state` is not
 *    accepted and does not end the wait.
 *
 * What is NOT here, and cannot be: a real sign-in. The page, Identity
 * Platform and a person are the ⚑ half of this phase.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));

describe("refusing inside a summoned session", () => {
  it("says the sentence journey 10 prints, and names where to write", () => {
    const why = summonedRefusal({ ISOCAN_SESSION_ID: "Sonia" });
    expect(why).toMatch(/operator acts need the person who runs this home/);
    expect(why).toMatch(/proving it in a browser/);
    expect(why).toMatch(/\/terms/);
  });

  it("does not refuse a person's terminal", () => {
    expect(summonedRefusal({})).toBeNull();
    expect(summonedRefusal({ ISOCAN_SESSION_ID: "  " })).toBeNull();
  });

  it("reads the variable the rc sets, not a harness's own", () => {
    // The rc sets `ISOCAN_SESSION_ID` for the sessions it vends over ACP
    // (`acp.ts`, `adapterEnv`). A person driving two actors from one terminal
    // by exporting it is caught too, which is the right side to err on: they
    // can unset it, and the words tell them what the act needs.
    expect(summonedRefusal({ CLAUDE_CODE_SESSION_ID: "s-priya" })).toBeNull();
  });
});

describe("the real binary, in a summoned session", () => {
  let home: string;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-operator-cli-"));
  });

  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  /**
   * There is no daemon and no `ISOCAN_PORT` here, deliberately: the refusal
   * has to come before `ctxOf`, which would otherwise SPAWN one and wait
   * twenty seconds for it. So "it exited at all, in under a second" is half
   * the assertion, and "the prove address was never printed" is the other
   * half — that address is the one thing the verb prints before it waits.
   */
  const run = (args: string[], extra: NodeJS.ProcessEnv = {}) => {
    const env: NodeJS.ProcessEnv = { ...process.env, ISOCAN_HOME: home };
    // The ambient harness first, THEN what this test says. `harnessVars`
    // includes `ISOCAN_SESSION_ID` — it is the deliberate one — so clearing
    // after setting it would quietly delete the whole point of the test, and
    // the symptom is a verb that hangs waiting for a browser rather than a
    // failed assertion.
    for (const v of harnessVars) delete env[v];
    Object.assign(env, extra);
    const child = spawn(process.execPath, [cliBin, ...args], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c));
    child.stderr.on("data", (c) => (stderr += c));
    return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) =>
      child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
    );
  };

  it("refuses `operator show` before a browser opens, and says what to tell them", async () => {
    const out = await run(["operator", "show", "prj_reported1"], {
      ISOCAN_SESSION_ID: "Sonia",
      ISOCAN_HARNESS: "agent",
    });
    expect(out.code).toBe(1);
    expect(out.stderr).toMatch(/operator acts need the person who runs this home/);
    expect(out.stderr).toMatch(/\/terms/);
    // Nothing was opened and nothing was printed to open: the address is the
    // one thing this verb prints before it waits, so its absence is the proof
    // that the refusal came first.
    expect(out.stdout).not.toContain(PROVE_PATH_PREFIX);
  }, 30_000);

  it("refuses `operator log` the same way — the whole family, not one verb", async () => {
    const out = await run(["operator", "log"], { ISOCAN_SESSION_ID: "Sonia" });
    expect(out.code).toBe(1);
    expect(out.stderr).toMatch(/operator acts need the person who runs this home/);
  }, 30_000);
});

/**
 * **The verb, against a real home that has no operator.**
 *
 * This suite exists because the route's version of this was green while the
 * VERB hung. `packages/server/test/operator.test.ts` proves that
 * `GET /api/operator/…` answers the sentence, and it did, and none of it was
 * reachable: `operatorProof` opened a browser and sat on a loopback listener
 * before anything asked the home, so a person running `isocan operator show`
 * on a laptop got no output and a process that never returned. Found by
 * walking the verb rather than the route, which is the whole of what a walk
 * is for.
 *
 * So what is asserted here is the thing both documents actually name — the
 * verb: `phases.md`'s last acceptance sentence (*a local daemon with no
 * attester says why it has no operator*) and journey 11 step 2. A real
 * daemon, the real binary, and an assertion that it EXITS.
 */
describe("a real home with no operator, asked by the real verb", () => {
  let home: string;
  let work: string;
  let daemon: Daemon;

  const boot = async (options: Parameters<typeof startDaemon>[0]) => {
    daemon = await startDaemon({ port: 0, home: work, birthHome: null, ...options });
    const address = daemon.app.server.address();
    return typeof address === "object" && address ? address.port : 0;
  };

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-operator-cli-home-"));
    work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-operator-cli-work-"));
  });

  afterEach(async () => {
    await daemon?.close();
    daemon = undefined as unknown as Daemon;
    for (const dir of [home, work]) {
      await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  /**
   * The real binary, pointed at the daemon this test started.
   *
   * The witness is that the promise RESOLVES: this awaits `close`, so a verb
   * that opened the page and sat on its loopback listener fails the test by
   * timing out — which is exactly how the bug presented when the conductor
   * ran it by hand. The stdout assertion says the same thing in the other
   * direction, and says it legibly.
   */
  const cli = (args: string[], port: number) => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ISOCAN_HOME: home,
      ISOCAN_PORT: String(port),
    };
    for (const v of harnessVars) delete env[v];
    env.CLAUDE_CODE_SESSION_ID = "s-olu";
    const child = spawn(process.execPath, [cliBin, ...args], {
      cwd: work,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c));
    child.stderr.on("data", (c) => (stderr += c));
    return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) =>
      child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
    );
  };

  it("says why it has no operator, and EXITS — the phase's last acceptance sentence", async () => {
    const port = await boot({ auth: null, operators: [] });
    const out = await cli(["operator", "show", "prj_reported1"], port);
    expect(out.stderr).toMatch(/borrows no attester/);
    expect(out.stderr).toMatch(/ISOCAN_AUTH_PROJECT/);
    expect(out.stderr).toMatch(/ISOCAN_OPERATORS/);
    expect(out.code).toBe(1);
    // The regression, named: no page was opened, so nothing is waiting for a
    // sign-in this home could never verify.
    expect(out.stdout).not.toContain(PROVE_PATH_PREFIX);
  }, 25_000);

  it("says the OTHER sentence when the attester is there and the list is empty", async () => {
    // The case that would have hung in exactly the same way, and that the
    // route-level proof also covered while the verb could not reach it.
    const port = await boot({
      auth: { project: "isocan-io-dev", apiKey: "browser-key-not-a-secret" },
      operators: [],
    });
    const out = await cli(["operator", "log"], port);
    expect(out.stderr).toMatch(/names nobody as its operator/);
    expect(out.stderr).not.toMatch(/borrows no attester/);
    expect(out.code).toBe(1);
    expect(out.stdout).not.toContain(PROVE_PATH_PREFIX);
  }, 25_000);

  it("opens the page when the home DOES have an operator — the preflight is not a gate", async () => {
    /**
     * The other half of the fix, and the one a too-eager preflight would
     * break: a home that has an operator must still reach the browser. The
     * address is printed before the wait, so its presence on stdout is the
     * proof the flow got there — and the process is killed rather than waited
     * out, because waiting for a sign-in is exactly what it is supposed to be
     * doing.
     */
    const port = await boot({
      auth: { project: "isocan-io-dev", apiKey: "browser-key-not-a-secret" },
      operators: ["email:olu@example.test"],
    });
    const env: NodeJS.ProcessEnv = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port) };
    for (const v of harnessVars) delete env[v];
    env.CLAUDE_CODE_SESSION_ID = "s-olu";
    const child = spawn(process.execPath, [cliBin, "operator", "log"], {
      cwd: work,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const printed = await new Promise<string>((resolve) => {
      let out = "";
      child.stdout.on("data", (c) => {
        out += c;
        if (out.includes(PROVE_PATH_PREFIX)) resolve(out);
      });
      child.on("close", () => resolve(out));
    });
    child.kill("SIGKILL");
    expect(printed).toContain(`${PROVE_PATH_PREFIX}/`);
    expect(printed).toMatch(/open this to prove you run/);
  }, 25_000);
});

describe("the loopback hand-over", () => {
  /** A browser that does what the prove page does: read the handoff out of the
   * address, and form-POST the token to the loopback with the state. */
  const browser = (
    reply: (handoff: { to: string; state: string; act: string }) => Record<string, string>,
  ) => {
    const seen: string[] = [];
    return {
      seen,
      open: (url: string) => {
        seen.push(url);
        const segment = proveSegmentIn(new URL(url).pathname);
        const handoff = segment ? decodeHandoff(segment) : null;
        if (!handoff) throw new Error(`no handoff in ${url}`);
        void fetch(handoff.to, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(reply(handoff)).toString(),
        });
      },
    };
  };

  it("opens the page with the act in it, and takes the token back", async () => {
    const fake = browser((handoff) => ({ idToken: "tok-abc", state: handoff.state }));
    const said: string[] = [];
    const proof = await proveInBrowser({
      home: "https://dev.isocan.test",
      act: "show prj_reported1",
      open: fake.open,
      say: (line) => said.push(line),
    });
    expect(proof.idToken).toBe("tok-abc");

    // The address is on a home, at the prove path, and carries the act — so
    // the page can say what the terminal asked for before it asks anything.
    const url = new URL(fake.seen[0]!);
    expect(url.origin).toBe("https://dev.isocan.test");
    const handoff = decodeHandoff(proveSegmentIn(url.pathname)!)!;
    expect(handoff.act).toBe("show prj_reported1");
    expect(handoff.to).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);

    // And it was PRINTED as well as opened: a machine with no browser session
    // must not leave a person looking at a silent terminal.
    expect(said.join("\n")).toContain(url.toString());
  }, 20_000);

  it("gives every invocation its own port and its own nonce", async () => {
    const one = browser((h) => ({ idToken: "a", state: h.state }));
    const two = browser((h) => ({ idToken: "b", state: h.state }));
    await proveInBrowser({ home: "https://h.test", act: "x", open: one.open, say: () => {} });
    await proveInBrowser({ home: "https://h.test", act: "x", open: two.open, say: () => {} });
    const first = decodeHandoff(proveSegmentIn(new URL(one.seen[0]!).pathname)!)!;
    const second = decodeHandoff(proveSegmentIn(new URL(two.seen[0]!).pathname)!)!;
    expect(first.state).not.toBe(second.state);
    expect(first.to).not.toBe(second.to);
  }, 20_000);

  it("ignores a hand-over with the wrong state, and keeps waiting for the right one", async () => {
    /**
     * The nonce is not the security of the token — that is a signature the
     * home checks — it is the security of THIS command: without it, anything
     * that could reach the port while it is open could make this terminal act
     * on somebody else's proof. And a wrong state must not END the wait
     * either, or the same reach becomes a way to cancel the command.
     */
    let handoffSeen: { to: string; state: string } | null = null;
    const proof = proveInBrowser({
      home: "https://h.test",
      act: "show prj_x",
      say: () => {},
      open: (url) => {
        const handoff = decodeHandoff(proveSegmentIn(new URL(url).pathname)!)!;
        handoffSeen = handoff;
        void (async () => {
          const wrong = await fetch(handoff.to, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ idToken: "stolen", state: "not-the-nonce" }).toString(),
          });
          expect(wrong.status).toBe(400);
          expect(await wrong.text()).toMatch(/not the one this terminal asked for/);
          await fetch(handoff.to, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ idToken: "the-real-one", state: handoff.state }).toString(),
          });
        })();
      },
    });
    expect((await proof).idToken).toBe("the-real-one");
    expect(handoffSeen).not.toBeNull();
  }, 20_000);

  it("gives up in words rather than hanging forever", async () => {
    await expect(
      proveInBrowser({
        home: "https://h.test",
        act: "show prj_x",
        timeoutMs: 50,
        say: () => {},
        open: () => {},
      }),
    ).rejects.toThrow(/nobody proved anything in time/);
  }, 20_000);

  it("answers a person who navigated to the loopback by hand, rather than a blank page", async () => {
    const answered = new Promise<{ status: number; body: string }>((resolve) => {
      void proveInBrowser({
        home: "https://h.test",
        act: "show prj_x",
        timeoutMs: 3_000,
        say: () => {},
        open: (url) => {
          const handoff = decodeHandoff(proveSegmentIn(new URL(url).pathname)!)!;
          void fetch(handoff.to).then(async (res) =>
            resolve({ status: res.status, body: await res.text() }),
          );
        },
      }).catch(() => {});
    });
    const got = await answered;
    expect(got.status).toBe(405);
    expect(got.body).toMatch(/terminal that asked/);
  }, 20_000);
});
