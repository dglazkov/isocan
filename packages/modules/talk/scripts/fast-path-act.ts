/**
 * **The fast path acting, end to end on a daemon** (voice-agent phase 7,
 * proof 2; `docs/projects/voice-agent/fast-path.md`).
 *
 *   node --env-file=<secrets> --import tsx packages/modules/talk/scripts/fast-path-act.ts \
 *     [--answerer jev|stub] [--scratch <dir>] [--fixture <commands.json>] [--out <dir>] [--budget 0.50] [--only <id,id>]
 *
 * Starts a daemon of its own — a throwaway `ISOCAN_HOME` under `--scratch`
 * (default: the OS temp dir), its own port, run from that unbound directory,
 * so it can never touch a person's daemon or a real canvas — seeds the
 * scripted set's synthetic Acme canvas onto it with the fixture's own ids and
 * geometry, and then, for every one of the 197 commands:
 *
 * 1. the words go to `fastact.ts`'s controller — the code the browser runs —
 *    with the shipped `THRESHOLDS`, Jev on the real judgment client, and as
 *    its executor `web.tsx`'s own `runTool` over a host whose `send` posts
 *    each operation to the daemon (`/api/ops`) and whose `retract` is the
 *    daemon's actor-scoped undo — the same two doors the web host uses;
 * 2. the canvas is read back from the daemon and compared with the act the
 *    command MEANT (the fixture's `expect`): an act must be that act, on that
 *    item, and nothing else may have moved; an escalation must have written
 *    nothing at all;
 * 3. an act is then taken back with ONE retract, and the canvas must be the
 *    seeded one again — "say undo" is checked on every act, not assumed.
 *
 * Latency is measured from the last word (`heard`) to the daemon's answer to
 * the act's operation. The model path is NOT measured here: it needs a live
 * Gemini session and a voice. The microphone walk's record carries both
 * (`timing.firstCall` beside `fast.acted`).
 *
 * `--answerer stub` runs without a key: every proposal is uniform, nothing
 * clears a threshold, and the run proves only that escalations write nothing.
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { besideBox, newVersionId, type CanvasContents, type Operation, type WebHost } from "@isocan/core";
import { JEV_INPUT_PRICE, jevAnswerer, stubAnswerer, type Answerer } from "@isocan/core/jev";
import { QUIET_MS, createFastPath } from "../src/fastact.ts";
import { fastPathQuestions, sameAct, type CanonicalAct } from "../src/fastpath.ts";
import type { ShadowTurn } from "../src/shadow.ts";
import { MEASURED, THRESHOLDS } from "../src/thresholds.ts";
import { runTool, type PanelFacts } from "../src/web.tsx";
import { DEFAULT_FIXTURE, canvasFor, truthOf, type Fixture } from "./fast-path-eval.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..", "..");

type Box = { x: number; y: number; width: number; height: number };

function boxes(canvas: CanvasContents): Record<string, Box> {
  return Object.fromEntries(Object.values(canvas.items ?? {}).map((i) => [i.id, { x: i.x, y: i.y, width: i.width, height: i.height }]));
}

/** What changed between two readings of the canvas. */
function changed(before: Record<string, Box>, after: Record<string, Box>): string[] {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...ids].filter((id) => JSON.stringify(before[id]) !== JSON.stringify(after[id]));
}

/** Does the canvas after the act show the act the command MEANT — and only it? */
function showsMeant(truth: CanonicalAct, before: Record<string, Box>, after: Record<string, Box>): { ok: boolean; why: string } {
  const moved = changed(before, after);
  if (truth.act === "move-by") {
    if (moved.length !== 1 || moved[0] !== truth.subject) return { ok: false, why: `changed ${moved.join(", ") || "nothing"}, meant ${truth.subject}` };
    const b = before[truth.subject]!;
    const a = after[truth.subject]!;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
    const sameSize = a.width === b.width && a.height === b.height;
    return dir === truth.direction && sameSize ? { ok: true, why: "" } : { ok: false, why: `moved ${dir}, meant ${truth.direction}` };
  }
  if (truth.act === "move-beside") {
    const spot = besideBox(before[truth.subject]!, before[truth.target]!, truth.side);
    // Already there: the meant act changes nothing, and nothing may change.
    const there = before[truth.subject]!.x === spot.x && before[truth.subject]!.y === spot.y;
    if (there) return moved.length === 0 ? { ok: true, why: "already there — nothing to move" } : { ok: false, why: `changed ${moved.join(", ")}; the item was already there` };
    if (moved.length !== 1 || moved[0] !== truth.subject) return { ok: false, why: `changed ${moved.join(", ") || "nothing"}, meant ${truth.subject}` };
    const a = after[truth.subject]!;
    return a.x === spot.x && a.y === spot.y ? { ok: true, why: "" } : { ok: false, why: `landed at ${a.x},${a.y}; ${truth.side} of ${truth.target} is ${spot.x},${spot.y}` };
  }
  return { ok: false, why: `the fast path acted; the command meant ${truth.act}` };
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : "—");
const q = (xs: number[], f: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(f * s.length))]!) : 0;
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string, dflt?: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : dflt;
  };
  const which = flag("--answerer", "jev")!;
  const budget = Number(flag("--budget", "0.50"));
  const out = flag("--out", path.join(process.cwd(), "fast-path-act"))!;
  mkdirSync(out, { recursive: true });
  const fixture = JSON.parse(readFileSync(flag("--fixture", DEFAULT_FIXTURE)!, "utf8")) as Fixture;
  const only = flag("--only")?.split(",");
  const commands = only ? fixture.commands.filter((c) => only.includes(c.id)) : fixture.commands;

  const projected = commands.reduce((s, c) => {
    const g = fastPathQuestions(c.say, canvasFor(fixture, c));
    return s + (g.ok ? JSON.stringify(g.ask.request).length / 2.5 : 0);
  }, 0) * JEV_INPUT_PRICE;
  console.error(`${commands.length} commands; projected $${projected.toFixed(4)} (budget $${budget.toFixed(2)}); thresholds ${JSON.stringify(THRESHOLDS)}`);
  if (which === "jev" && projected > budget) {
    console.error("projection exceeds the budget — nothing sent");
    process.exit(3);
  }
  if (which === "jev" && !process.env.TYPESAFE_API_KEY) {
    console.error("no TYPESAFE_API_KEY in the environment — run with --env-file, or --answerer stub (which acts on nothing)");
    process.exit(2);
  }
  const answerer: Answerer = which === "stub" ? stubAnswerer(1) : jevAnswerer({ key: process.env.TYPESAFE_API_KEY, backoff: [500, 1000, 2000, 4000] });

  // ---------- a daemon of its own, from an unbound directory
  const scratch = flag("--scratch", tmpdir())!;
  mkdirSync(scratch, { recursive: true });
  const home = mkdtempSync(path.join(scratch, "isocan-fastact-"));
  const port = 21_000 + Math.floor(Math.random() * 8_000);
  const env = {
    ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port), ISOCAN_CONTENT_PORT: String(port + 1),
    ISOCAN_SESSION_ID: `acme-fastact-${port}`, ISOCAN_HARNESS: "test",
  } as Record<string, string>;
  delete env.ISOCAN_HOME_URL;
  const cli = path.join(ROOT, "packages/cli/bin/isocan.js");
  const daemon = spawn(process.execPath, [cli, "serve"], { cwd: home, env, stdio: ["ignore", "pipe", "pipe"] });
  try {
    await new Promise<void>((resolve, reject) => {
      let said = "";
      const t = setTimeout(() => reject(new Error(`daemon did not start:\n${said}`)), 60_000);
      const look = (c: Buffer) => {
        said += c;
        if (said.includes(`http://127.0.0.1:${port}`) && /started|running/i.test(said)) {
          clearTimeout(t);
          resolve();
        }
      };
      daemon.stdout.on("data", look);
      daemon.stderr.on("data", look);
      daemon.once("exit", (code) => reject(new Error(`daemon exited ${code}:\n${said}`)));
    });
    const run = (...a: string[]) => execFileSync(process.execPath, [cli, "--json", ...a], { cwd: home, env, encoding: "utf8", timeout: 60_000 });
    run("identity", "--name", `Acme Fast ${port}`, "--session");
    const created = JSON.parse(run("canvas", "new", "Acme fast path")) as { id?: string; canvasId?: string; project?: { id: string } };
    const canvasId = created.id ?? created.canvasId ?? created.project?.id;
    if (!canvasId) throw new Error("no canvas id from `canvas new`");
    Object.assign(process.env, env);
    const { connect } = await import("@isocan/api");
    const handle = await (await connect({ port })).canvas(canvasId);
    const { client, actor } = handle.ctx;

    // ---------- the fixture's canvas, with its own ids and geometry
    let snap = await client.snapshot(canvasId);
    const groups = snap.project.groupMode === "groups";
    for (const item of fixture.canvas.items) {
      const bytes = new TextEncoder().encode(`# ${item.title}\n\nAcme ${item.kind}.\n`);
      const blob = await client.uploadBlob(canvasId, bytes, "text/markdown", `${item.id}.md`);
      const op = {
        type: "item.add", itemId: item.id,
        version: { id: newVersionId(), blobHash: blob.blobHash, mimeType: "text/markdown", filename: `${item.id}.md`, size: blob.size },
        width: item.width, height: item.height, placement: { x: item.x, y: item.y }, title: item.title,
        ...(item.properties ? { properties: item.properties as Record<string, string> } : {}),
        ...(groups ? { containerId: null, groupPlacement: "exact" as const } : {}),
      } as Operation;
      await client.sendOp(canvasId, actor, op);
    }
    snap = await client.snapshot(canvasId);
    const seeded = boxes(snap.canvas);
    for (const item of fixture.canvas.items) {
      const b = seeded[item.id];
      if (!b || b.x !== item.x || b.y !== item.y || b.width !== item.width || b.height !== item.height) {
        throw new Error(`REFUSED: ${item.id} seeded at ${JSON.stringify(b)}, the fixture says ${JSON.stringify({ x: item.x, y: item.y, width: item.width, height: item.height })}`);
      }
    }
    console.error(`daemon on ${port}, home ${home}, canvas ${canvasId} (${groups ? "groups" : "legacy"}), ${fixture.canvas.items.length} items seeded at the fixture's geometry`);

    // ---------- the host: the web host's two doors, spoken over HTTP
    let sentOps = 0;
    let ackAt = 0;
    let retracts = 0;
    const host = {
      async send(ops: readonly Operation[], group?: string) {
        for (const op of ops) {
          await client.sendOp(canvasId, actor, op, undefined, undefined, group);
          sentOps++;
        }
        ackAt = performance.now();
      },
      async putBlob(bytes: Blob, filename: string) {
        const r = await client.uploadBlob(canvasId, new Uint8Array(await bytes.arrayBuffer()), bytes.type || "application/octet-stream", filename);
        return { blobHash: r.blobHash, size: r.size };
      },
      async retract() {
        retracts++;
        await client.undo(canvasId, actor);
      },
      viewer: { id: actor.id, name: actor.name },
      reveal: () => undefined,
      select: () => undefined,
      commands: () => [],
      runCommand: async () => {
        throw new Error("no commands on this canvas");
      },
      enrol: async () => {
        throw new Error("nobody is enrolled here");
      },
    } satisfies WebHost;

    /** `ok`: the mechanism held (one op, one undo restores; an escalation wrote nothing). `right`: an act was the act meant. */
    type Row = {
      id: string; say: string; meant: string; decision: string; ok: boolean; right?: boolean; why: string;
      lastWordToAck?: number; jevMs?: number; p?: number; undone?: boolean; ops: number; error?: string;
    };
    const rows: Row[] = [];
    let spent = 0;
    for (const c of commands) {
      const truth = truthOf(fixture, c);
      snap = await client.snapshot(canvasId);
      const before = boxes(snap.canvas);
      const facts: PanelFacts = { canvasId, canvas: snap.canvas, host, canEdit: true, groupMode: groups ? "groups" : "legacy", selection: c.selected ?? [] };
      const saved: ShadowTurn[] = [];
      sentOps = 0;
      ackAt = 0;
      let heardAt = 0;
      const fast = createFastPath({
        canvasId,
        thresholds: THRESHOLDS,
        ask: (request) => answerer.answer(request),
        // The question is asked about the fixture's projection (the selection
        // marked), the canvas phase 6 measured the thresholds on.
        items: () => canvasFor(fixture, c).items,
        ...(c.lastAct ? { lastAct: c.lastAct } : {}),
        runTool: (name, a) => runTool(name, a, facts),
        tell: () => undefined,
        save: (t) => void saved.push(t),
      });
      // The words arrive, then the model begins to answer; it makes no call
      // here — the fast path's own latency is what is measured.
      fast.heard(c.say);
      heardAt = performance.now();
      fast.modelBegan();
      // The quiet that says the words are done runs out on its own clock.
      await new Promise((r) => setTimeout(r, QUIET_MS + 20));
      await fast.flush();
      const turn = saved[0]!;
      spent += (turn.tokens ?? 0) * JEV_INPUT_PRICE;
      const after = boxes((await client.snapshot(canvasId)).canvas);
      const decision = turn.fast!.decision;
      const row: Row = {
        id: c.id, say: c.say, meant: truth.act, decision, ok: false, why: "", ops: sentOps,
        ...(turn.ms !== undefined ? { jevMs: turn.ms } : {}), ...(turn.p !== undefined ? { p: turn.p } : {}), ...(turn.error ? { error: turn.error } : {}),
      };
      if (decision === "act") {
        const shown = showsMeant(truth, before, after);
        const oneItem = changed(before, after).length <= 1;
        row.right = shown.ok && turn.proposed !== undefined && sameAct(turn.proposed, truth);
        row.why = shown.why;
        row.lastWordToAck = Math.round(ackAt - heardAt);
        // One retract, and the canvas must be the seeded one again.
        await host.retract();
        const back = boxes((await client.snapshot(canvasId)).canvas);
        row.undone = changed(before, back).length === 0;
        row.ok = sentOps === 1 && oneItem && row.undone;
        if (sentOps !== 1) row.why += `${row.why ? "; " : ""}${sentOps} operations`;
        if (!row.undone) row.why += `${row.why ? "; " : ""}one undo did not restore the canvas (${changed(before, back).join(", ")})`;
      } else {
        const moved = changed(before, after);
        row.ok = sentOps === 0 && moved.length === 0;
        row.why = row.ok ? "" : `an escalation wrote ${sentOps} operations and changed ${moved.join(", ")}`;
      }
      rows.push(row);
      if (!row.ok || decision === "act") console.error(`${c.id} ${decision} ${row.ok ? "mechanism ok" : "MECHANISM FAILED"}${row.right === false ? ", NOT the act meant" : ""} ${row.why} — "${c.say}"`);
      if (spent >= budget) {
        console.error(`measured spend $${spent.toFixed(4)} reached the budget — stopping`);
        break;
      }
    }

    // ---------- the report
    const acted = rows.filter((r) => r.decision === "act");
    const actedRight = acted.filter((r) => r.right);
    const actedSound = acted.filter((r) => r.ok);
    const escalated = rows.filter((r) => r.decision !== "act");
    const untouched = escalated.filter((r) => r.ok);
    const meantMoves = rows.filter((r) => r.meant === "move-by" || r.meant === "move-beside");
    const ack = acted.map((r) => r.lastWordToAck!).filter((n) => n > 0);
    const jev = rows.map((r) => r.jevMs).filter((n): n is number => n !== undefined);
    const lines = [
      "# The fast path acting — the scripted set on a local daemon",
      "",
      `Answerer: ${which}; thresholds ${JSON.stringify(THRESHOLDS)} (move: ${MEASURED.move?.date}, n ${MEASURED.move?.n}, ${MEASURED.move?.agreement} agreed)`,
      "",
      `- commands: **${rows.length}**; errors ${rows.filter((r) => r.error).length}`,
      `- acted: **${acted.length}** — the canvas showed the act meant: **${actedRight.length} of ${acted.length}** (${pct(actedRight.length, acted.length)}); one operation, one item, and one undo restored the canvas: **${actedSound.length} of ${acted.length}**`,
      `- meant moves the fast path did: ${acted.filter((r) => r.meant.startsWith("move")).length} of ${meantMoves.length} (the rest went to the model)`,
      `- escalated: **${escalated.length}** — wrote nothing: **${untouched.length} of ${escalated.length}**`,
      `- last word → act acknowledged by the daemon: p50 **${q(ack, 0.5)} ms**, p90 ${q(ack, 0.9)} ms, max ${ack.length ? Math.max(...ack) : 0} ms (includes the ${QUIET_MS} ms quiet that says the words are done)`,
      `- Jev's own round trip: p50 ${q(jev, 0.5)} ms, p90 ${q(jev, 0.9)} ms`,
      `- retracts: ${retracts}; spend $${spent.toFixed(4)}`,
      `- model path: **not measured here** — it needs a live session and a voice; the microphone walk's record has the model's first call beside the fast act`,
      "",
      "## Every act",
      "",
      "| id | said | meant | the act meant | one op, undone | last word → ack ms | p | why |",
      "|---|---|---|---|---|---|---|---|",
      ...acted.map((r) => `| ${r.id} | ${r.say.replace(/\|/g, "/")} | ${r.meant} | ${r.right ? "yes" : "**NO**"} | ${r.ok ? "yes" : "**NO**"} | ${r.lastWordToAck} | ${r.p?.toFixed(2) ?? "—"} | ${r.why || "—"} |`),
      "",
    ];
    const wrongEsc = escalated.filter((r) => !r.ok);
    if (wrongEsc.length) lines.push("## Escalations that wrote something", "", ...wrongEsc.map((r) => `- ${r.id}: ${r.why}`), "");
    const md = lines.join("\n");
    writeFileSync(path.join(out, `act.${which}.md`), md);
    writeFileSync(path.join(out, `act.${which}.jsonl`), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    console.log(md);
    // A wrong MEANING is Jev's error rate, which the threshold bounds at 5%
    // and the report shows; a broken MECHANISM is this phase's bug.
    if (acted.length !== actedSound.length || wrongEsc.length || rows.some((r) => r.error)) process.exitCode = 1;
  } finally {
    daemon.kill();
    if (!args.includes("--keep")) rmSync(home, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
