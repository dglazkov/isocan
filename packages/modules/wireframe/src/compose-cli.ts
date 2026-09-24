import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import type { CliHost } from "@isocan/cli/modulehost";
import { JEV_INPUT_PRICE, type JevResponse } from "./answerer.ts";
import { cliAnswerer, cliPort } from "./cli-port.ts";
import { answeredResponse, pendingRound, requestBlueprint, roundCalls, type RoundCall, type RoundFile } from "./compose.ts";
import { FlowCanvas, applyRound, composeFlow, costLine, flowsOn, pickFlow, startFlow, styleAt, type OnAsked } from "./flow.ts";
import { StyleResolver } from "./restyle.ts";
import { flagPack } from "./content/choose.ts";
import { wireSize, wireTitle } from "./spec.ts";

/**
 * **`isocan wire "<request>"` — a flow, composed in rounds, drawn in place.**
 *
 * The composer itself is `flow.ts`, run over the CLI's `WirePort`
 * (`cli-port.ts`); the web runs the same one over its own. What is here is
 * the terminal's half: flags, the answerer it picks, the lines it prints, and
 * the agent path — `wire questions` reads the flow's screens back (each
 * carries its spec, with the round it has reached) and prints the pending
 * round; `wire answer` applies a file of answers to it. The canvas is the
 * only state; nothing is kept on this machine between the two.
 */

export type { Ctx } from "@isocan/cli/modulehost";
export type { Screen } from "./flow.ts";
export { FlowCanvas, addVariations, wiresOn } from "./flow.ts";

/** `--save <dir>`: each round's requests and responses, as JSON files. */
function saver(dir: string | undefined): OnAsked | undefined {
  if (!dir) return undefined;
  return async (round: 1 | 2 | 3, calls: RoundCall[], responses: JevResponse[]) => {
    await mkdir(dir, { recursive: true });
    await Promise.all(calls.map(async (call, i) => {
      const name = `round-${round}.${i + 1}`;
      await writeFile(path.join(dir, `${name}.request.json`), JSON.stringify(call.request, null, 2));
      await writeFile(path.join(dir, `${name}.response.json`), JSON.stringify(responses[i]!, null, 2));
    }));
  };
}

/** `--save <dir>` for a style mapping: `style-<system>-<version>.{request,response}.json`. */
export function mappingSaver(dir: string | undefined): ConstructorParameters<typeof StyleResolver>[3] {
  if (!dir) return undefined;
  return async (system, versionId, request, response) => {
    await mkdir(dir, { recursive: true });
    const stem = path.join(dir, `style-${system.id}-${versionId}`);
    await writeFile(`${stem}.request.json`, JSON.stringify(request, null, 2));
    await writeFile(`${stem}.response.json`, JSON.stringify(response, null, 2));
  };
}

export function registerCompose(host: CliHost, wire: Command): void {
  const { run, ctxOf, resolveCanvas, printJson, placementFor } = host;

  // `wire` has options of its own now (`--at`, `--canvas`), and the program's
  // options are not positional, so `wire render x.json --at 1,2` hands `--at`
  // to `wire`, not `render`: a subcommand reads its flags with
  // `optsWithGlobals()`, which sees both.
  wire
    .argument("[request...]", "what the screens are for, in words — composes a flow")
    .option("--answerer <name>", "jev (needs TYPESAFE_API_KEY), home (Jev through the canvas's home, with its key), stub (random, seeded) or agent (you answer: `wire questions` / `wire answer`) — default jev when the key is set, else the home, else the stub")
    .option("--seed <n>", "the stub's seed", "1")
    .option("--save <dir>", "write each round's requests and responses there as JSON")
    .option("--canvas <canvas>")
    .option("--at <x,y>", "start the row at world coordinates (default: under everything on the canvas)")
    .option("--in <group>", "compose the flow inside this group — and in its design system, if it has one")
    .option("--flesh", "arrive fleshed: sample content from a pack Jev chooses for the request, instead of grey bars")
    .option("--pack <id>", "the content pack to flesh with, instead of asking (`wire flesh --packs` lists them)")
    .action(
      run(async (words: string[], opts: { answerer?: string; seed: string; save?: string; at?: string; in?: string; flesh?: boolean; pack?: string }, cmd: Command) => {
        const request = words.join(" ").trim();
        if (!request) {
          cmd.help();
          return;
        }
        const ctx = await ctxOf(cmd);
        const say = (line: string) => {
          if (!ctx.json) console.log(line);
        };
        const p = await resolveCanvas(ctx);
        const port = cliPort(host, ctx, p.id);
        const seed = Number(opts.seed);
        // Refused before anything is written: an unknown pack, or `--answerer jev` with no key, never leaves a blueprint behind.
        if (opts.pack !== undefined) flagPack(opts.pack);
        const answerer = opts.answerer === "agent" ? "agent" : cliAnswerer(ctx, p.id, opts.answerer, seed, say);
        const snapshot = await ctx.client.snapshot(p.id);
        const placement = opts.in !== undefined || opts.at
          ? placementFor(snapshot, { ...(opts.at ? { at: opts.at } : {}), ...(opts.in !== undefined ? { in: opts.in } : {}) }, wireSize(requestBlueprint(request, "flow"))) as Record<string, unknown>
          : undefined;
        const blueprintLine = (item: string, ms: number) => say(`${item}  "${request}" — a blueprint, on the canvas in ${ms} ms, before any answer`);
        if (answerer === "agent") {
          const t0 = Date.now();
          const { first, flow } = await startFlow(port, request, placement);
          const firstMs = Date.now() - t0;
          blueprintLine(first.item, firstMs);
          if (ctx.json) return printJson({ flow, items: [first.item], round: 1, answerer: "agent", firstBlueprintMs: firstMs });
          if (opts.flesh || opts.pack !== undefined) say("--flesh waits for the rounds: once the flow is drawn, `isocan wire flesh --flow " + flow + (opts.pack !== undefined ? " --pack " + opts.pack : "") + "` fills it");
          say(`flow ${flow} is waiting on round 1 of 3. Answer it yourself:\n  isocan wire questions > round.json    # Jev's request shape, one call per screen\n  (fill each call's "response" in Jev's response shape)\n  isocan wire answer round.json          # repeat until the flow is drawn`);
          return;
        }
        const who = answerer.name === "stub"
          ? `the stub (seed ${opts.seed})${process.env.TYPESAFE_API_KEY ? "" : " — no TYPESAFE_API_KEY here"}`
          : answerer.name === "home" ? "Jev through the canvas's home — no TYPESAFE_API_KEY here, so the home's key answers" : "Jev";
        const composed = await composeFlow(port, request, answerer, {
          ...(placement ? { placement } : {}),
          say,
          onBlueprint: (first, ms) => {
            blueprintLine(first.item, ms);
            say(`answering with ${who}`);
          },
          ...(saver(opts.save) ? { onAsked: saver(opts.save)!, onMappingAsked: mappingSaver(opts.save)! } : {}),
          ...(opts.flesh || opts.pack !== undefined ? { flesh: opts.pack !== undefined ? { pack: opts.pack } : {} } : {}),
        });
        const { mapper, tallies } = composed;
        if (ctx.json) {
          return printJson({
            flow: composed.flow,
            answerer: composed.by,
            firstBlueprintMs: composed.firstMs,
            totalMs: composed.totalMs,
            screens: composed.screens.map((s) => ({ itemId: s.item, title: s.spec.title, archetype: s.spec.archetype, platform: s.spec.platform, slots: s.spec.slots, ...(s.spec.varied ? { varied: s.spec.varied } : {}) })),
            variations: composed.variants.map((v) => ({ itemId: v.item, title: wireTitle(v.spec), variantOf: v.spec.variantOf, flip: v.spec.flip })),
            rounds: tallies,
            style: composed.style ?? { source: "default" },
            content: composed.pack ? { source: "pack", pack: composed.pack.pack, leaned: composed.pack.leaned, p: composed.pack.p, how: composed.pack.how } : null,
            styleCalls: mapper.calls,
            inputTokens: tallies.reduce((s, t) => s + t.inputTokens, 0) + mapper.inputTokens,
            cost: (tallies.reduce((s, t) => s + t.inputTokens, 0) + mapper.inputTokens) * JEV_INPUT_PRICE,
          });
        }
        say(costLine(tallies, composed.by, composed.screens.length) + ` · ${composed.totalMs} ms in all — \`isocan undo\` takes the whole flow back`);
      }),
    );
}

/** `isocan wire questions` — the pending round, as a file in Jev's request shape. */
export async function questions(host: CliHost, opts: { flow?: string }, cmd: Command): Promise<void> {
  const { ctxOf, resolveCanvas } = host;
  const ctx = await ctxOf(cmd);
  const p = await resolveCanvas(ctx);
  const port = cliPort(host, ctx, p.id);
  const { flow, screens, round } = pickFlow(await flowsOn(port, await port.canvas()), opts.flow);
  const file: RoundFile = { flow, round, calls: roundCalls(round, screens) };
  console.log(JSON.stringify(file, null, 2));
}

/** `isocan wire answer <file>` — a round's answers, checked against the canvas's own questions and applied. */
export async function answer(host: CliHost, file: string, cmd: Command): Promise<void> {
  const { ctxOf, resolveCanvas, printJson } = host;
  let answered: RoundFile;
  try {
    answered = JSON.parse(await readFile(file, "utf8")) as RoundFile;
  } catch (error) {
    throw new Error(`${file} is not a JSON file this can read: ${(error as Error).message}`);
  }
  const ctx = await ctxOf(cmd);
  const say = (line: string) => {
    if (!ctx.json) console.log(line);
  };
  const p = await resolveCanvas(ctx);
  const port = cliPort(host, ctx, p.id);
  const { flow, screens, round } = pickFlow(await flowsOn(port, await port.canvas()), answered.flow);
  if (answered.round !== round) throw new Error(`${file} answers round ${answered.round}, but flow ${flow} is waiting on round ${round} — \`isocan wire questions\` prints it`);
  // The questions are asked again from the canvas, not trusted from the file: an
  // answer is checked against the question this flow actually poses.
  const calls = roundCalls(round, screens);
  const responses = calls.map((call) => {
    const mine = (answered.calls ?? []).find((c) => c.item === call.item);
    if (!mine) throw new Error(`${file} has no call for ${call.item} — every screen in round ${round} needs its answers`);
    if (Object.keys(call.request.questions).length === 0) return { answers: {} } as JevResponse;
    return answeredResponse({ ...call, response: mine.response! }, `${file}'s call for ${call.item}`);
  });
  const canvas = new FlowCanvas(port, flow);
  // An agent's flow arrives in the governing system too. Round 1 asks for the mapping (Jev with a
  // key, else the home's judge, else the stub, whose flat answers keep the default); later rounds
  // read it off the screens.
  const mapper = new StyleResolver(port, cliAnswerer(ctx, p.id, undefined, 1, say), async () => screens.map((s) => s.spec));
  const styled = await styleAt(port, screens[0]!.item, mapper);
  canvas.style = styled.system ? styled.style : undefined;
  if (round === 1) for (const line of styled.lines) say(line);
  const after = await applyRound(canvas, round, screens, calls, responses, say);
  const next = pendingRound(after.map((s) => s.spec));
  if (ctx.json) return printJson({ flow, round, items: after.map((s) => s.item), next });
  say(next ? `round ${round} applied — round ${next} is next: \`isocan wire questions\`` : `round 3 applied — flow ${flow} is drawn; \`isocan undo\` takes the whole flow back`);
}
