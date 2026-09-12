import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { AddressInfo } from "node:net";
import { provePath, type OperatorHandoff } from "@isocan/core";

/**
 * **The operator's half of the loopback proof** — the terminal end of
 * `docs/projects/operator/design.md`, "How the terminal gets one".
 *
 * The pattern every CLI that signs in through a browser uses, and the reason
 * it is the pattern is the one property the operator needs: **the proof is a
 * thing a person does, at a moment, for an act the page named.** A terminal
 * cannot sign anybody in. It can open a page, say what it wants, and wait for
 * the browser to hand back what the person proved.
 *
 * ```
 *   isocan operator show prj_…
 *     │  listen on 127.0.0.1:<random>
 *     │  open  https://home/operator/prove/<handoff>
 *     │                 │ the page says what was asked for, FIRST
 *     │                 │ the person signs in (signin.ts, unchanged)
 *     │  ◀──── POST ────┘ idToken + state, as a form, to the loopback
 *     └─ GET /api/operator/… with the token in one header
 * ```
 *
 * **Nothing is written down.** The token lives in one local variable for one
 * invocation and is dropped with the process — decision D2, expressed as the
 * absence of a file. There is no `~/.isocan/operator.json` to steal and no
 * refresh token to renew, which is the whole difference between a proof and a
 * credential.
 */

/**
 * **Refused inside a summoned session, before any browser opens** — journey
 * 10, and the sentence it prints.
 *
 * `ISOCAN_SESSION_ID` is what the rc sets for the sessions it vends over ACP
 * (`acp.ts`, `adapterEnv`). An agent that unset it would get past this line
 * and meet the two rules that actually hold: its badge has proved nothing, and
 * the proof is an act of a person at a sign-in page in a browser that shows
 * *this terminal asks to take down prj_…* before it asks anything.
 *
 * So this is **a courtesy that gets the words right, not the enforcement** —
 * stated here because a reader who mistook it for the enforcement would later
 * be tempted to make it stronger, and the strength is elsewhere by design. Its
 * value is that the agent asked to do this reads a sentence it can repeat to
 * the person who asked, rather than opening a browser on somebody's machine
 * and hanging for five minutes.
 */
export function summonedRefusal(env: NodeJS.ProcessEnv = process.env): string | null {
  const session = env["ISOCAN_SESSION_ID"]?.trim();
  if (!session) return null;
  return (
    "operator acts need the person who runs this home, proving it in a browser. " +
    "Tell them — the address is on /terms."
  );
}

/** What came back from the browser: the token, for one request, and nothing else. */
export interface OperatorProof {
  idToken: string;
}

export interface ProveOptions {
  /** The home to prove at — the origin the page is opened on. */
  home: string;
  /** The act, in the words the page shows first: `show prj_…`. */
  act: string;
  /** How long to wait for a person. Five minutes: long enough to find an
   * inbox, short enough that a forgotten terminal does not sit on a port. */
  timeoutMs?: number;
  /** Where to write the address, for the person whose browser did not open. */
  say?: (line: string) => void;
  /** Opening a browser is spawned rather than injected everywhere else in this
   * CLI; injectable here so a test can prove the whole dance without one. */
  open?: (url: string) => void;
}

/**
 * **Open the page, wait for the proof, hand it back.**
 *
 * The listener binds `127.0.0.1` explicitly rather than taking node's default,
 * which is every interface: a port on `0.0.0.0` waiting to be handed a live
 * credential is a machine on a café network offering to receive one. Port `0`
 * is a fresh port per invocation, so two operator commands at once do not
 * collide and nothing is ever listening between them.
 *
 * **The `state` is a 128-bit nonce checked on arrival.** It is not the
 * security of the token — the token is verified by the home, against a
 * signature — it is the security of THIS command: without it, anything that
 * could reach the loopback port during the few seconds it is open could feed
 * this process a token of its own choosing and have the command act on
 * somebody else's proof.
 */
export async function proveInBrowser(options: ProveOptions): Promise<OperatorProof> {
  const state = randomBytes(16).toString("base64url");
  const say = options.say ?? ((line: string) => console.log(line));

  let settle: (proof: OperatorProof) => void;
  let fail: (why: Error) => void;
  const handed = new Promise<OperatorProof>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });

  const server = createServer((req, res) => {
    void handle(req, res);
  });

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== "POST") {
      // A person who navigated here by hand, or a browser prefetching. Not an
      // error and not a hand-over: a sentence, so a blank page never happens.
      return page(res, 405, "This is the terminal that asked. Nothing to see here.");
    }
    const body = await readBody(req);
    const form = new URLSearchParams(body);
    if (form.get("state") !== state) {
      /**
       * Answered and NOT settled: a wrong state is somebody else's request, so
       * the command goes on waiting for the one it asked for. Failing here
       * would let anything that can reach the port end the command, which is
       * the denial-of-service version of the attack the nonce exists for.
       */
      return page(res, 400, "That sign-in was not the one this terminal asked for.");
    }
    const idToken = form.get("idToken") ?? "";
    if (!idToken) return page(res, 400, "That hand-over carried no sign-in.");
    page(res, 200, "Proved. Go back to your terminal — you can close this tab.");
    settle({ idToken });
  };

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const handoff: OperatorHandoff = {
      to: `http://127.0.0.1:${port}/`,
      state,
      act: options.act,
    };
    const url = `${options.home.replace(/\/+$/, "")}${provePath(handoff)}`;
    /**
     * Printed as well as opened, always. A browser that does not open — a
     * remote shell, a machine with no session — must not leave a person
     * looking at a silent terminal, and the address is the whole of what they
     * need. It is also what makes the flow inspectable: the summary is in the
     * link, so anybody can read what this terminal is about to ask for before
     * they go there.
     */
    say(`open this to prove you run ${options.home}:`);
    say(`  ${url}`);
    (options.open ?? openInBrowser)(url);
    return await Promise.race([
      handed,
      timeout(options.timeoutMs ?? 5 * 60_000, fail!),
    ]);
  } finally {
    server.close();
    // Any browser still holding the connection would keep the process alive.
    server.closeAllConnections?.();
  }
}

function timeout(ms: number, fail: (why: Error) => void): Promise<never> {
  return new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      const why = new Error(
        "nobody proved anything in time — the page was never completed, so nothing was done. " +
          "Run the command again when you are at the browser.",
      );
      fail(why);
      reject(why);
    }, ms);
    // The wait must not be what keeps this process alive once the proof lands.
    timer.unref?.();
  });
}

function openInBrowser(url: string): void {
  spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], {
    stdio: "ignore",
    detached: true,
  }).unref();
}

/** The tab's last page: plain text, no styling, nothing fetched. */
function page(res: ServerResponse, status: number, sentence: string): void {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    // This page is the end of a credential's journey. Nothing about it should
    // be kept, and nothing about it should be reachable from anywhere else.
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  res.end(`${sentence}\n`);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    // An ID token is a couple of kilobytes. A megabyte is a caller that is not
    // a browser finishing a form, and reading it all would be a courtesy to
    // whoever sent it.
    if (size > 1_000_000) break;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}
