import type { PresenceSession } from "@isocan/core";
import { collect, spawnCli, type CliOptions, type Run } from "./cli.ts";

/**
 * **A parked `isocan wait`, ready to be woken** — for a test that parks an
 * agent and then does the act that should wake it.
 *
 * Two races lived in the copy this replaces (`goodnight.test.ts` and
 * `explain.test.ts`, proactive-agent phases 2 and 4), and CI found both:
 *
 * - **The output is collected at spawn.** A woken park exits quickly; a
 *   test that called `collect` only after its own act returned was attaching
 *   a listener to a child that, on a loaded runner, had already exited — so
 *   it waited for a `close` that had come and gone, until vitest's deadline
 *   (`collect.ts` now refuses that by name).
 * - **It returns when the daemon shows the park waiting, not after a fixed
 *   sleep.** The park's cursor is claimed before it says "waiting for you…",
 *   so from that moment anything said reaches it. A sleep of 1.5 s was a bet
 *   that a cold CLI start, a snapshot, a seed and a claim fit in it; on a
 *   loaded runner they need not, and a park that claims after the act was
 *   said has a cursor past it and never wakes.
 *
 * The session list is what the person's canvas shows, so "parked" here is the
 * same fact the room sees — and it needs the agent to have a session first
 * (`session start`), which is what a real agent does before it parks.
 */
export async function parkedWait(options: {
  /** The daemon, as `http://127.0.0.1:<port>`. */
  base: string;
  /** A badge's headers that may read the canvas's sessions. */
  headers: Record<string, string>;
  canvas: string;
  /** Whose park: the actor the session belongs to. */
  actorId: string;
  cli: CliOptions;
  /** `--timeout` for the wait itself, in seconds. */
  timeoutSecs?: number;
}): Promise<{ run: Promise<Run> }> {
  const { base, headers, canvas, actorId, cli, timeoutSecs = 30 } = options;
  const run = collect(spawnCli(["--canvas", canvas, "wait", "--json", "--timeout", String(timeoutSecs)], cli));
  let ended: string | null = null;
  void run.then(
    (r) => (ended = `exit ${r.code}: ${r.stderr.trim() || r.stdout.trim()}`),
    (error: Error) => (ended = error.message),
  );
  const deadline = Date.now() + 20_000;
  for (;;) {
    if (ended) throw new Error(`the park ended before it showed as waiting (${ended})`);
    const res = await fetch(`${base}/api/projects/${encodeURIComponent(canvas)}/sessions`, { headers });
    if (res.ok) {
      const sessions = (await res.json()) as PresenceSession[];
      if (sessions.some((s) => s.actor.id === actorId && s.status?.includes("waiting"))) return { run };
    }
    if (Date.now() > deadline) {
      throw new Error(`the park never showed as waiting on ${canvas} (sessions: HTTP ${res.status})`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}
