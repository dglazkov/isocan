import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { openInBrowser } from "./browser.ts";
import { randomBytes } from "node:crypto";
import { AddressInfo } from "node:net";
import type { Command } from "commander";
import {
  provePath,
  type OperatorHandoff,
  inForce,
  LINK,
  normalizeHomeUrl as normalizeAddress,
  normalizeSubject,
  grantSubjectOf,
  NO_OPERATOR,
  NO_OPERATOR_PROOF,
  operatorLookUrl,
  REFUSAL_LIMIT,
  refusalSubjectOf,
  refusalSubjectRefusal,
  refusalUntil,
  TAKEDOWN_REASONS,
  takedownReasonList,
  takedownSentence,
  type EndedSurface,
  type OperatorEndReach,
  type OperatorRefuseResponse,
  type PurgeCounts,
  type SweepReport,
} from "@isocan/core";
import { ApiError, DaemonClient, DaemonRoutes } from "@isocan/api";
import type { Ctx } from "./ctx.ts";
import { formatBytes, printJson, printKeyValues, printTable } from "./output.ts";
import { run } from "./run.ts";

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

// ---------- the operator (docs/projects/operator/design.md, phase 1) ----------
//
// **The CLI is the operator's surface.** Abuse mail is read by a person at a
// desk, the reach and the purge horizon read best as lines, and the loopback
// proof is a pattern people already know from `gcloud` and `gh`.
//
// **This is the one feature that is deliberately half by the AGENTS.md rule** —
// done on both surfaces, and reachable by only one kind of hand. Every verb
// here needs a person at a sign-in page in a browser, so an agent holding this
// CLI cannot use them however well it is told about them. The agent guide names
// them anyway, and says exactly that, because the useful thing to tell an agent
// asked to take a canvas down is the sentence it should reply with.
//
// **It lives here rather than in `main.ts`** because `main.ts` is the registry
// of verbs every feature has to edit, and an operator phase should not have
// to queue at that door (`node scripts/measure.mjs registry-lines`). The
// family arrives as one call, `registerOperator(program, ctxOf)`, at the
// place in `main.ts` where it used to be registered, so `isocan --help`
// lists it where it always has.

/**
 * **Where to prove**, and it is a HOME rather than this daemon.
 *
 * `isocan operator show prj_…` is run from a laptop and acts on the home that
 * hosts the canvas — journey 1's whole setting. So the address is, in order:
 * what `--home` says, then where that canvas actually lives (`ctx.homeOf`,
 * off `GET /api/homes`), then this machine's birth default, then the local
 * daemon.
 *
 * The order matters in the one case that bites: a canvas bound to
 * dev.isocan.io, on a laptop whose birth default is somewhere else. Asking the
 * birth default first would open a prove page on a home that has never heard
 * of the canvas — the cheerful wrong address, in the one string a person is
 * about to sign in at.
 */
async function operatorHome(ctx: Ctx, canvasId: string | null, stated?: string): Promise<string> {
  if (stated) return normalizeAddress(stated);
  if (canvasId) {
    const where = await ctx.homeOf(canvasId).catch(() => null);
    if (where) return where;
  }
  return ctx.birthHome ?? ctx.client.base;
}

/**
 * **The first line of every operator verb**, before a context is resolved.
 *
 * Journey 10 says *refused before any browser opens*, and the honest reading
 * of that is stronger than it sounds: before anything at all. `ctxOf` starts a
 * daemon if none is running and waits up to twenty seconds for it — so a
 * refusal that came after it would leave an agent sitting for twenty seconds
 * before reading a sentence it could have read at once, and would have spawned
 * a process on somebody's machine on the way. Found by the test that runs the
 * real binary: it timed out rather than refusing.
 */
function refuseInSession(): void {
  const refusal = summonedRefusal();
  if (refusal) throw new Error(refusal);
}

/**
 * **Ask the home whether it has an operator at all, before opening anything.**
 *
 * Journey 11 step 2 and the phase's last acceptance sentence both name the
 * VERB: *a local daemon with no attester says why it has no operator.* Without
 * this the verb could not say it. The home's refusal was built and reachable —
 * the door hook answers `no-operator` for the whole `/api/operator/` prefix —
 * but `operatorProof` opened a browser and sat on a loopback listener first, so
 * **the home that would say the sentence was never asked.** Found by the
 * conductor walking the verb rather than the route: no output, and a hang until
 * it was killed. A check nobody's surface can reach is not a check.
 *
 * The preflight is free by construction rather than by care: the prefix is
 * refused *before* anything looks at a proof, so a request carrying none is a
 * complete answer to "does this home have an operator" and nothing is written
 * down — `proveAct` records a ledger row only after a token verifies, and there
 * is no token here.
 *
 * Three answers and each is a different thing to do:
 *
 * - **`no-operator`** — this home has no attester, or an empty list. The
 *   sentence is the home's own, printed verbatim, because the words come from
 *   the home rather than from this file (design, "Not an op").
 * - **`no-operator-proof`** — this home has an operator and wants one proved.
 *   Go and open the page.
 * - **anything else** — an older home that has never heard of these routes, or
 *   a home that is not answering. Said plainly rather than turned into a
 *   browser nobody can complete.
 *
 * And a 200 is refused loudly: a home that answers an operator read to a caller
 * who proved nothing is a home whose proof is not being checked, and a CLI that
 * shrugged at that would be the worst possible place to be quiet.
 */
async function requireOperatorHome(client: DaemonRoutes, home: string): Promise<void> {
  try {
    await client.operatorLog("");
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    if (err.code === NO_OPERATOR_PROOF) return;
    if (err.code === NO_OPERATOR) throw new Error(err.message);
    if (err.status === 404) {
      throw new Error(
        `${home} does not answer operator acts — it is running a build older than this CLI, ` +
          "so there is nothing to prove to yet.",
      );
    }
    throw err;
  }
  throw new Error(
    `${home} answered an operator read to a caller that proved nothing. That home is not ` +
      "checking operator proofs; do not act on it, and tell whoever runs it.",
  );
}

/**
 * The proof, for one act, or the refusal that stops before a browser opens.
 *
 * Two refusals, in the order a person meets them. `refuseInSession` is re-asked
 * here as well as at the top of each verb — one spelling called twice rather
 * than two rules, so a phase-2 verb that forgot the early call still refuses
 * before a browser opens. Then the home is asked, because a browser opened at a
 * home with no operator is a page nobody can complete.
 */
async function operatorProof(client: DaemonRoutes, home: string, act: string): Promise<string> {
  refuseInSession();
  await requireOperatorHome(client, home);
  const { idToken } = await proveInBrowser({ home, act });
  return idToken;
}

/** A client for a home that is not necessarily this machine's daemon. The
 * badge is per-base already (`readBadge(home, base)`), so this knocks on that
 * home's door by itself on its first 401 — which is what carries the badge
 * through the door unchanged, beside the proof. */
function clientAt(ctx: Ctx, home: string): DaemonClient {
  return home === ctx.client.base ? ctx.client : new DaemonClient(home, ctx.home);
}

/** What a purge erased, in one line both `purge` and `show` print — the
 * numbers the operator pastes into the reply, so they are spelled once. */
function erasedLine(gone: PurgeCounts): string {
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  return (
    `${n(gone.files, "file", "files")} (${formatBytes(gone.bytes)}), ` +
    `${n(gone.ops, "log entry", "log entries")}, ` +
    `${n(gone.objects, "stored object", "stored objects")}`
  );
}

/**
 * **The reach of an end, as lines** — printed before the act and again after
 * it, because the verb lists what the id reaches before it acts (journey 7
 * step 2) and the same lines are what the operator pastes into the reply.
 */
function printEndReach(reach: OperatorEndReach): void {
  const line = (s: EndedSurface) =>
    `${s.badgeId} (${s.kind}) — ${s.actors.map((a) => a.name || a.id).join(", ") || "speaks as nobody"}` +
    `, in ${s.canvases} ${s.canvases === 1 ? "canvas" : "canvases"}, seen ${s.lastSeen.slice(0, 10)}`;
  printKeyValues({
    target: `${reach.target.id} (by ${reach.target.kind})`,
    badges: reach.badges.length === 0 ? "none live" : String(reach.badges.length),
  });
  for (const s of reach.badges) console.log(`  ${line(s)}`);
  console.log(`enrolments: ${reach.enrolments.length === 0 ? "none" : String(reach.enrolments.length)}`);
  for (const s of reach.enrolments) console.log(`  ${line(s)}`);
  console.log(`passes outstanding: ${reach.passes}`);
}

/**
 * **What a refusal reached, as counts** (operator phase 6) — the reach first,
 * then the honest limit, in the words the design gives the verb. Refusing an
 * address ends every badge that proved it; a name stops it coming back; a
 * network is refused at the mint meter and ends on its own.
 */
function printRefuse(answer: OperatorRefuseResponse, lifting: boolean): void {
  const { refusal, reach } = answer;
  const shown = refusal.subject.replace(/^(email|repo|actor|net):/, "");
  if (lifting) {
    console.log(`${shown} is not refused any more. This home will admit it again.`);
    console.log(
      "\nEvery badge the refusal ended STAYS ended — a lift is not an un-end. Both acts are in\n" +
        `the ledger — \`isocan operator log --target ${refusal.subject}\`.`,
    );
    return;
  }
  const pairs: Record<string, string> = { refused: refusal.subject, why: TAKEDOWN_REASONS[refusal.reason] };
  if (reach.kind === "email" || reach.kind === "repo") {
    pairs["badges ended"] = reach.ended.length === 0 ? "none had proved it" : reach.ended.join(", ");
    pairs["tabs and daemons closed"] = `${reach.reached.sockets} here`;
    pairs["waits ended"] = String(reach.reached.waits);
    pairs["swept from their canvases"] = sweptLine(reach.swept);
  } else if (reach.kind === "actor") {
    pairs["holders now"] =
      reach.holders === 0
        ? "none — the name is free, and stays refused"
        : `${reach.holders} — a refusal stops the name coming back; \`isocan operator end actor:${shown}\` ends these`;
  } else {
    pairs["refuses"] = "minting a badge from that network";
  }
  pairs["ends"] = refusal.expiresAt ? `on its own, ${refusalUntil(refusal.expiresAt)}` : "when you lift it";
  printKeyValues(pairs);
  if (answer.sentence) console.log(`\nThe person reads, from this home:\n  ${answer.sentence}`);
  console.log(`\n${REFUSAL_LIMIT}`);
  console.log(`\nThe record is in the ledger — \`isocan operator log --target ${refusal.subject}\`.`);
}

/** What a sweep did, in one line both this verb and `share` print. */
export function sweptLine(swept: SweepReport): string {
  if (swept.expelled === 0 && swept.rerooted === 0) return "nobody was expelled";
  const parts = [`${swept.expelled} expelled`];
  // Named even when it is zero would be noise; named when it is not is the
  // half nobody expects — somebody stayed, because another grant still covers
  // them, which is the design's whole point about not expelling the invited.
  if (swept.rerooted > 0) parts.push(`${swept.rerooted} kept by another grant`);
  return parts.join(", ");
}

/** `isocan operator` and its eight verbs, registered on `program` at the point
 * `main.ts` calls this — which is what keeps their place in `isocan --help`. */
export function registerOperator(program: Command, ctxOf: (cmd: Command) => Promise<Ctx>): void {
  const operatorCommand = program
    .command("operator")
    .description(
      "For the person who runs this home. Needs their sign-in in a browser, for each act, and " +
        "refuses inside an agent session",
    )
    .addHelpText(
      "after",
      `
An operator act is not a canvas act. It is refused unless a person proves, in
a browser, that their address is one this home's configuration names — freshly,
for the act the page shows them before it asks anything. Nothing is stored: no
token on disk, no standing on any badge, nothing an agent could inherit.

Every act is written into this home's ledger before it answers, and
\`isocan operator log\` is how the operator reads it back.`,
    );

  operatorCommand
    .command("show <canvas>")
    .description("What this home holds under that id — counts, the maker, and nothing else. Changes nothing")
    .option("--home <url>", "the home to prove at; by default, where that canvas lives")
    .action(
      run(async (canvasId: string, opts: { home?: string }, cmd: Command) => {
        refuseInSession();
        const ctx = await ctxOf(cmd);
        const home = await operatorHome(ctx, canvasId, opts.home);
        const client = clientAt(ctx, home);
        const proof = await operatorProof(client, home, `show ${canvasId}`);
        const { reach, takedown } = await client.operatorShow(canvasId, proof);
        if (ctx.json) return printJson({ reach, ...(takedown ? { takedown } : {}) });
        printKeyValues({
          canvas: `${reach.title} (${reach.canvasId})`,
          made: `${reach.madeBy.name || reach.madeBy.id} on ${reach.at.slice(0, 10)}`,
          link: reach.link ? `on, at ${reach.link}` : "off",
          grants: String(reach.grants),
          badges: `${reach.badges} admitted`,
          sockets: `${reach.sockets} open here`,
          files: `${reach.files} — ${formatBytes(reach.bytes)}`,
          replicas: reach.replicas.length === 0 ? "none relaying now" : `${reach.replicas.length} relaying now`,
        });
        /**
         * **Whether this home is serving it, and why not** (operator phase 2,
         * closing phase 1's open finding that `show` on a canvas that is not
         * servable was a 404 with nothing to say).
         *
         * The note is printed here and nowhere else in this CLI: this is the one
         * surface whose reader is the operator, and the note is the thing he
         * wrote to his future self about a report.
         */
        if (takedown) {
          console.log(
            `\n${inForce(takedown) ? "TAKEN DOWN" : "taken down, and lifted"} — ` +
              `the people on it read:\n  ${takedownSentence(takedown)}` +
              (takedown.note ? `\nyour note: ${takedown.note}` : "") +
              (takedown.liftedAt ? `\nlifted on ${takedown.liftedAt.slice(0, 10)}` : ""),
          );
          /**
           * **And whether the bytes are gone** (operator phase 3). The tombstone
           * still says who made it and when; this says what was erased and
           * that nothing can come back — `show` after a purge is the read the
           * operator makes when somebody asks what happened to that id, on
           * either backing, and it must say something true on both.
           */
          if (takedown.purgedAt) {
            const gone = takedown.purged;
            console.log(
              `PURGED on ${takedown.purgedAt.slice(0, 10)}` +
                (gone ? ` — ${erasedLine(gone)} erased from this home` : "") +
                ". The id stays taken; nothing can be adopted, teleported or created under it.",
            );
          }
        }
        console.log(
          "\nNothing was changed, and this look is in this home's ledger — `isocan operator log`.",
        );
      }),
    );

  operatorCommand
    .command("look <canvas>")
    .description(
      "Open that canvas read-only in a browser for an hour, to judge a report. Nobody on it is " +
        "told; the ledger is",
    )
    .requiredOption("--reason <why>", "why you are looking — it goes in the ledger")
    .option("--home <url>", "the home to prove at; by default, where that canvas lives")
    .action(
      run(async (canvasId: string, opts: { reason: string; home?: string }, cmd: Command) => {
        refuseInSession();
        const ctx = await ctxOf(cmd);
        const home = await operatorHome(ctx, canvasId, opts.home);
        const client = clientAt(ctx, home);
        const proof = await operatorProof(client, home, `look at ${canvasId}`);
        const { until, token, reach } = await client.operatorLook(canvasId, proof, {
          reason: opts.reason,
        });
        const url = operatorLookUrl(home, canvasId, token);
        if (ctx.json) return printJson({ until, url, reach });
        /**
         * **The reach first, then the address** — every operator verb prints its
         * reach before acting, and here the acting is a person opening a page.
         * A look is read-only and changes nothing, so the reach is what tells
         * him whether this is the canvas the report was about before he spends
         * an hour of admission on it.
         */
        printKeyValues({
          canvas: `${reach.title} (${reach.canvasId})`,
          made: `${reach.madeBy.name || reach.madeBy.id} on ${reach.at.slice(0, 10)}`,
          link: reach.link ? `on, at ${reach.link}` : "off",
          until: `${until.slice(11, 16)} — an hour from now`,
        });
        console.log(`\nopen this, once:\n  ${url}`);
        console.log(
          "\nRead-only, and nobody on the canvas is told you arrived: a view connection is not in\n" +
            "presence, which is the rule for every viewer. The look is in this home's ledger with\n" +
            "the reason you gave — `isocan operator log`. After an hour the tab shows the refusal\n" +
            "any stranger gets.",
        );
        openInBrowser(url);
      }),
    );

  operatorCommand
    .command("takedown <canvas>")
    .description(
      "Stop this home serving that canvas. Nothing is erased and every replica keeps its copy; " +
        "--lift brings it back",
    )
    .option("--reason <category>", `why, from: ${takedownReasonList()}`)
    .option("--note <text>", "your own note — recorded, and shown to nobody")
    .option("--lift", "bring back a canvas that was taken down")
    .option("--home <url>", "the home to prove at; by default, where that canvas lives")
    .action(
      run(
        async (
          canvasId: string,
          opts: { reason?: string; note?: string; lift?: boolean; home?: string },
          cmd: Command,
        ) => {
          refuseInSession();
          const ctx = await ctxOf(cmd);
          const home = await operatorHome(ctx, canvasId, opts.home);
          const client = clientAt(ctx, home);
          const lifting = opts.lift === true;
          const proof = await operatorProof(
            client,
            home,
            lifting ? `lift the takedown on ${canvasId}` : `take down ${canvasId}`,
          );
          const answer = await client.operatorTakedown(canvasId, proof, {
            ...(opts.reason ? { reason: opts.reason } : {}),
            ...(opts.note ? { note: opts.note } : {}),
            ...(lifting ? { lift: true } : {}),
          });
          if (ctx.json) return printJson(answer);
          if (lifting) {
            console.log(`${canvasId} is served again. Nothing had been erased, so nothing is lost.`);
            console.log(
              "\nTabs reload into it. A replica that stopped dialling re-dials within ten seconds\n" +
                "and syncs. Both rows are in the ledger — `isocan operator log --target " +
                `${canvasId}\`.`,
            );
            return;
          }
          const { reach, takedown, cdn } = answer;
          /**
           * **What happened, as counts** — journey 3 step 2, written to be
           * pasted into the reply to whoever reported it. Counts and not prose:
           * *two tabs closed, one wait ended, one replica told* is a thing that
           * can be checked, and "it has been handled" is not.
           */
          printKeyValues({
            canvas: canvasId,
            reason: takedown.reason,
            "tabs and daemons closed": `${reach.sockets} here`,
            "waits ended": String(reach.waits),
            "agent parks ended": String(reach.holds),
            "replicas relaying": `${reach.relays} — each keeps its copy`,
            files: `${reach.files} — ${formatBytes(reach.bytes)}, refused at the content origin from now`,
          });
          console.log(`\nThe people on it read, from this home:\n  ${takedownSentence(takedown)}`);
          if (cdn) {
            console.log(
              `\nOne thing this home cannot do for you: a copy at the edge may be served for up to\n` +
                `${Math.round(cdn.horizonSeconds / 60)} more minutes. To clear it now, run:\n  ${cdn.command}`,
            );
          }
          console.log(
            "\nNothing has been erased. Every replica keeps its copy — the operator cannot reach a\n" +
              `laptop — and \`isocan operator takedown ${canvasId} --lift\` brings it all back.`,
          );
        },
      ),
    );

  operatorCommand
    .command("purge <canvas>")
    .description(
      "Erase what this home holds under a canvas it has taken down. Cannot be lifted; " +
        "says what survives, and for how long",
    )
    .option("--force", "say that you mean it — a purge is refused without this")
    .option("--home <url>", "the home to prove at; by default, where that canvas lives")
    .action(
      run(async (canvasId: string, opts: { force?: boolean; home?: string }, cmd: Command) => {
        refuseInSession();
        /**
         * **Refused before a browser opens, and before a ledger row**: a person
         * who has not said `--force` has not asked for an erasure yet, and a
         * proof spent on a refusal would put a row in the ledger for an act
         * nobody meant. The route asks for the same word, so a caller who
         * reaches it by hand is refused there too — that refusal IS recorded,
         * because it arrived with a proof.
         */
        if (!opts.force) {
          throw new Error(
            `a purge erases what the home holds under ${canvasId} and cannot be lifted. ` +
              `\`isocan operator purge ${canvasId} --force\` says you mean it.`,
          );
        }
        const ctx = await ctxOf(cmd);
        const home = await operatorHome(ctx, canvasId, opts.home);
        const client = clientAt(ctx, home);
        const proof = await operatorProof(client, home, `purge ${canvasId} — erase it`);
        const answer = await client.operatorPurge(canvasId, proof, { force: true });
        if (ctx.json) return printJson(answer);
        const { erased, survives, takedown } = answer;
        /**
         * **What is gone and what is not, in numbers** — journey 6 step 2,
         * written to be pasted into the reply. The four horizons come from the
         * home, in the words of the backing that knows them; this surface adds
         * nothing to them and drops nothing from them.
         */
        printKeyValues({
          canvas: canvasId,
          "taken down": `${takedown.at.slice(0, 10)} — ${takedown.reason}`,
          "erased from this home": erasedLine(erased),
        });
        console.log("\nWhat still exists, and for how long:");
        for (const horizon of survives) {
          console.log(`  - ${horizon.sentence}${horizon.days === null ? "" : ` (${horizon.days} days)`}`);
        }
        console.log(
          `\nThe id stays taken: nothing can be adopted, teleported or created under ${canvasId}\n` +
            "at this home again, and the people who were on it still read the sentence. The\n" +
            `record stays — \`isocan operator log --target ${canvasId}\`. There is no --lift.`,
        );
      }),
    );

  operatorCommand
    .command("end <target>")
    .description(
      "End a surface, and mean it: a badge id, an actor id, or email:<address>. Lists what the " +
        "id reaches before acting; the person can still knock again as a stranger",
    )
    .option("--reason <category>", `why, from: ${takedownReasonList()}`)
    .option("--note <text>", "your own note — recorded, and shown to nobody")
    .option(
      "--with-enrolments",
      "also end the badges those surfaces enrolled by pass, which would otherwise outlive them",
    )
    .option("--yes", "act without asking (the enrolments are left unless --with-enrolments)")
    .option("--home <url>", "the home to prove at; by default, this machine's")
    .action(
      run(
        async (
          target: string,
          opts: { reason?: string; note?: string; withEnrolments?: boolean; yes?: boolean; home?: string },
          cmd: Command,
        ) => {
          refuseInSession();
          const ctx = await ctxOf(cmd);
          const home = await operatorHome(ctx, null, opts.home);
          const client = clientAt(ctx, home);
          const proof = await operatorProof(client, home, `end ${target}`);
          const request = {
            ...(opts.reason ? { reason: opts.reason } : {}),
            ...(opts.note ? { note: opts.note } : {}),
          };
          /**
           * **The reach first, then the question, then the act** (journey 7
           * step 2). One proof, two requests: the preview is an act in the
           * ledger too — somebody with a proof asked what an address reaches —
           * and the second request is the one that ends anything.
           */
          const preview = await client.operatorEnd(target, proof, { ...request, preview: true });
          if (!ctx.json) {
            printEndReach(preview.reach);
            console.log();
          }
          if (preview.reach.badges.length === 0) {
            throw new Error(
              `${target} names no live badge at ${home} — it was never here, or it is already ended. ` +
                `\`isocan operator log --target ${target}\` says which.`,
            );
          }
          let withEnrolments = opts.withEnrolments === true;
          if (
            !withEnrolments &&
            preview.reach.enrolments.length > 0 &&
            !opts.yes &&
            !ctx.json &&
            process.stdin.isTTY &&
            process.stdout.isTTY
          ) {
            const readline = await import("node:readline/promises");
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            try {
              const answer = await rl.question(
                `End the ${preview.reach.enrolments.length} enrolment(s) too? They outlive their ` +
                  "creating badge otherwise. [y/N] ",
              );
              withEnrolments = /^y(es)?$/i.test(answer.trim());
            } finally {
              rl.close();
            }
          }
          const answer = await client.operatorEnd(target, proof, { ...request, withEnrolments });
          if (ctx.json) return printJson(answer);
          printKeyValues({
            ended: answer.ended.length === 0 ? "nothing" : answer.ended.join(", "),
            "tabs and daemons closed": `${answer.reached.sockets} here`,
            "waits ended": String(answer.reached.waits),
            "swept from their canvases": sweptLine(answer.swept),
            "passes refused from now": String(answer.reach.passes),
            enrolments: withEnrolments
              ? "ended with them"
              : preview.reach.enrolments.length === 0
                ? "none"
                : `${preview.reach.enrolments.length} left standing — \`--with-enrolments\` ends them`,
          });
          if (answer.sentence) console.log(`\nThe people on them read, from this home:\n  ${answer.sentence}`);
          console.log(
            "\nEnding is not refusing: they can knock again and be a stranger, with none of these\n" +
              `claims. The record is in the ledger — \`isocan operator log --target ${target}\`.`,
          );
        },
      ),
    );

  /**
   * **`isocan operator revoke <canvas|space> <subject>`** (operator phase 5;
   * journey 8): the owner's `isocan share --revoke` and `--link off` with the
   * proof in place of `own`. The subject is spelled as `share` spells it —
   * `link`, an address, `repo:…`, or `group:<id>` — so the two verbs cannot
   * disagree about what a row is called. The reach is the answer's: which
   * scope, how many canvases the sweep walked, and who lost the canvas.
   */
  operatorCommand
    .command("revoke <target> <subject>")
    .description(
      "Turn off one grant on a canvas or a space: `link`, an email, `repo:…` or `group:<id>`. " +
        "The owner is shown why, and can turn it back on; --bar keeps the subject out as well",
    )
    .option("--reason <category>", `why, from: ${takedownReasonList()}`)
    .option("--note <text>", "your own note — recorded, and shown to nobody")
    .option("--bar", "write a bar too: refused at the door whatever the link allows, until an owner lifts it")
    .option("--home <url>", "the home to prove at; by default, where that canvas lives")
    .action(
      run(
        async (
          target: string,
          who: string,
          opts: { reason?: string; note?: string; bar?: boolean; home?: string },
          cmd: Command,
        ) => {
          refuseInSession();
          const ctx = await ctxOf(cmd);
          const isSpace = target.startsWith("spc_");
          const home = await operatorHome(ctx, isSpace ? null : target, opts.home);
          const client = clientAt(ctx, home);
          // `link` is a subject, not an address: `grantSubjectOf` would read it
          // as a repo. Groups go by id here — the operator is reading a report,
          // and a name is unique only among one owner's groups.
          const subject = who.trim() === LINK ? LINK : normalizeSubject(grantSubjectOf(who));
          const proof = await operatorProof(client, home, `turn off ${subject} on ${target}`);
          const answer = await client.operatorRevoke(target, proof, {
            subject,
            ...(opts.reason ? { reason: opts.reason } : {}),
            ...(opts.note ? { note: opts.note } : {}),
            ...(opts.bar ? { bar: true } : {}),
          });
          if (ctx.json) return printJson(answer);
          printKeyValues({
            [answer.target.kind]: answer.target.id,
            subject,
            "was granted": `${answer.grant.at.slice(0, 10)} by ${answer.grant.grantedBy}`,
            reached: answer.reached === 1 ? "1 canvas" : `${answer.reached} canvases`,
            swept: sweptLine(answer.swept),
            "kept out": answer.bar ? `yes — until an owner lifts it (${answer.bar.id})` : "no — `--bar` would",
          });
          console.log(`\nThe owner reads, in Share and in \`isocan share\`:\n  ${answer.sentence}`);
          console.log(
            "\nThe owner can turn it back on — a revoke they can undo is a request. If it has to\n" +
              `stay off, the order is \`isocan operator takedown\`. The record is in the ledger — ` +
              `\`isocan operator log --target ${target}\`.`,
          );
        },
      ),
    );

  /**
   * **`isocan operator refuse <email:…|repo:…|actor:…|net:…>`** (operator phase
   * 6; journey 9): the home-scope refusal — the roles bar moved to home scope.
   * Refusing an address ends every badge that proved it, in the same act; a
   * name stops coming back; a network is refused at the mint meter and expires
   * on its own. `--for` sets a horizon on any subject; `--lift` ends one early.
   */
  operatorCommand
    .command("refuse <subject>")
    .description(
      "Refuse a subject at the door: email:<address>, repo:<host>/<owner>/<name>, actor:<id> or " +
        "net:<cidr>. Refusing an address ends every badge that proved it; --for expires it; --lift ends it",
    )
    .option("--reason <category>", `why, from: ${takedownReasonList()}`)
    .option("--note <text>", "your own note — recorded, and shown to nobody")
    .option("--for <duration>", "how long, like 10m, 24h or 7d (a network defaults to 24h)")
    .option("--lift", "end a refusal that is in force")
    .option("--home <url>", "the home to prove at; by default, this machine's")
    .action(
      run(
        async (
          subject: string,
          opts: { reason?: string; note?: string; for?: string; lift?: boolean; home?: string },
          cmd: Command,
        ) => {
          refuseInSession();
          // Fail before a browser opens on a subject the home cannot parse: a
          // person who typed `net:garbage` should read why here, not after
          // signing in — the same reason the home refuses no operator up front.
          if (!refusalSubjectOf(subject)) {
            throw new Error(refusalSubjectRefusal(subject) ?? `not a refusal subject: ${subject}`);
          }
          const ctx = await ctxOf(cmd);
          const home = await operatorHome(ctx, null, opts.home);
          const client = clientAt(ctx, home);
          const lifting = opts.lift === true;
          const proof = await operatorProof(
            client,
            home,
            lifting ? `lift the refusal on ${subject}` : `refuse ${subject}`,
          );
          const answer = await client.operatorRefuse(subject, proof, {
            ...(opts.reason ? { reason: opts.reason } : {}),
            ...(opts.note ? { note: opts.note } : {}),
            ...(opts.for ? { for: opts.for } : {}),
            ...(lifting ? { lift: true } : {}),
          });
          if (ctx.json) return printJson(answer);
          printRefuse(answer, lifting);
        },
      ),
    );

  operatorCommand
    .command("log")
    .description("This home's operator ledger, newest first — every act, with what proved it")
    .option("--home <url>", "the home to prove at; by default, this machine's")
    .option("--target <id>", "one canvas, badge, actor or address")
    .option("--limit <n>", "how many rows", "50")
    .action(
      run(async (opts: { home?: string; target?: string; limit?: string }, cmd: Command) => {
        refuseInSession();
        const ctx = await ctxOf(cmd);
        const home = await operatorHome(ctx, opts.target ?? null, opts.home);
        const client = clientAt(ctx, home);
        const proof = await operatorProof(
          client,
          home,
          opts.target ? `log for ${opts.target}` : "read the log",
        );
        const { acts } = await client.operatorLog(proof, {
          ...(opts.target ? { target: opts.target } : {}),
          ...(opts.limit ? { limit: Number(opts.limit) } : {}),
        });
        if (ctx.json) return printJson(acts);
        if (acts.length === 0) return console.log("no operator act has been taken at this home.");
        printTable(
          acts.map((row) => ({
            when: row.at.slice(0, 19).replace("T", " "),
            act: row.act,
            target: row.target ?? "—",
            who: row.proof.attribute.replace(/^email:/, ""),
            outcome: row.outcome,
          })),
        );
      }),
    );
}
