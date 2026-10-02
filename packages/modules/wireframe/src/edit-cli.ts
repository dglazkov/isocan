import type { Command } from "commander";
import type { CliHost } from "@isocan/cli/modulehost";
import { cliAnswerer, cliPort, localTextKey } from "./cli-port.ts";
import {
  EDIT_KINDS,
  editWireOnCanvas,
  type EditKind,
  type EditOperation,
} from "./edit.ts";
import { wiresOn } from "./flow.ts";
import { resolveTextGenerator } from "./copy-schema.ts";
import { wireTitle } from "./spec.ts";
import { explainWireDecision } from "./why.ts";
import type { DensityLevel, TemplateId } from "./catalog/index.ts";

/**
 * **`isocan wire edit` and `isocan wire why` from the terminal** (Phase 11,
 * design §13).
 */

/** Register `isocan wire edit` and `isocan wire why` subcommands on `wire`. */
export function registerEditAndWhy(host: CliHost, wire: Command): void {
  const { run, ctxOf, resolveCanvas, printJson } = host;

  wire
    .command("edit [words...]")
    .description("Surgically edit a single slot or layout setting on an existing wireframe screen (`content`, `add`, `remove`, `variant`, `restyle`) in one op group, rebuilding its prototype automatically")
    .option("--canvas <canvas>")
    .option("--screen <item>", "target wireframe screen item id or title (default: Jev picks from the instruction)")
    .option("--kind <kind>", `explicit edit kind (${EDIT_KINDS.join(", ")})`)
    .option("--slot <slot>", "explicit target slot id (for example: main.1, main.2, header, nav)")
    .option("--block <block>", "replacement or added block id")
    .option("--density <density>", "spacing density override (compact, default, spacious)")
    .option("--template <template>", "multi-region layout template override")
    .option("--answerer <name>", "jev, home, or stub")
    .option("--seed <n>", "the stub's seed", "1")
    .action(
      run(
        async (
          words: string[],
          _local: unknown,
          cmd: Command,
        ) => {
          const opts = cmd.optsWithGlobals() as {
            screen?: string;
            kind?: string;
            slot?: string;
            block?: string;
            density?: string;
            template?: string;
            answerer?: string;
            seed?: string;
          };
          const ctx = await ctxOf(cmd);
          const say = (line: string) => {
            if (!ctx.json) console.log(line);
          };
          const p = await resolveCanvas(ctx);
          const port = cliPort(host, ctx, p.id);
          const all = await wiresOn(port, await port.canvas());
          if (all.length === 0) {
            throw new Error("no wireframe screens on this canvas — `isocan wire \"<request>\"` composes some");
          }

          let screenId = opts.screen;
          let instruction = words.join(" ").trim();
          if (!screenId && words.length > 1) {
            const firstMatch = all.find(
              (s) => s.item === words[0] || s.spec.title.toLowerCase() === words[0]!.toLowerCase(),
            );
            if (firstMatch) {
              screenId = firstMatch.item;
              instruction = words.slice(1).join(" ").trim();
            }
          }
          if (!instruction && !opts.kind) {
            throw new Error("what should change? `isocan wire edit [<screen>] \"<instruction>\"`");
          }

          let explicitEdit: EditOperation | undefined;
          if (opts.kind || opts.slot) {
            const kind = (opts.kind ?? (opts.density || opts.template ? "restyle" : "variant")) as EditKind;
            if (!EDIT_KINDS.includes(kind)) {
              throw new Error(`--kind must be one of ${EDIT_KINDS.join(", ")} — got "${opts.kind}"`);
            }
            if (kind === "content" && !instruction) {
              throw new Error("what should the words become? `isocan wire edit --kind content --slot <slot> \"<instruction>\"`");
            }
            const slot = opts.slot ?? "main.1";
            explicitEdit = {
              kind,
              slot,
              ...(opts.block ? { block: opts.block } : {}),
              ...(opts.density ? { density: opts.density as DensityLevel } : {}),
              ...(opts.template ? { template: opts.template as TemplateId } : {}),
              ...(kind === "content" && instruction ? { instruction } : {}),
            };
          }

          const seed = Number(opts.seed ?? "1");
          const answerer = cliAnswerer(ctx, p.id, opts.answerer, seed, say);
          const result = await editWireOnCanvas(port, instruction || `${explicitEdit?.kind ?? "edit"} ${explicitEdit?.slot ?? ""}`, answerer, {
            ...(screenId ? { screenId } : {}),
            ...(explicitEdit ? { edit: explicitEdit } : {}),
            // A content edit's words come from the text generator, as `wire copy --ai`'s do: the home's key, or the stub.
            generator: resolveTextGenerator({ seed, useStub: opts.answerer === "stub", text: localTextKey() }),
          });

          if (ctx.json) {
            return printJson({
              group: result.group,
              itemId: result.screen.item,
              title: wireTitle(result.screen.spec),
              edit: result.edit,
              by: result.by,
              prototype: result.prototype ?? null,
            });
          }
          const protoPart = result.prototype ? ` · prototype ${result.prototype.itemId} rebuilt` : "";
          say(
            `${result.screen.item}  ${wireTitle(result.screen.spec)} — edited ${result.edit.slot} (${result.edit.kind}${result.edit.block ? ` → ${result.edit.block}` : ""})${protoPart} · \`isocan undo\` takes it back`,
          );
        },
      ),
    );

  wire
    .command("why [words...]")
    .description("Explain why a wireframe screen's archetype, template, density, and slot blocks were chosen, citing recorded Jev probabilities and runner-up alternatives")
    .option("--canvas <canvas>")
    .option("--screen <item>", "wireframe screen item id or title (default: newest wireframe screen)")
    .action(
      run(async (words: string[], _local: unknown, cmd: Command) => {
        const opts = cmd.optsWithGlobals() as { screen?: string };
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const port = cliPort(host, ctx, p.id);
        const all = await wiresOn(port, await port.canvas());
        if (all.length === 0) {
          throw new Error("no wireframe screens on this canvas — `isocan wire \"<request>\"` composes some");
        }
        let screenId = opts.screen;
        let question = words.join(" ").trim();
        if (!screenId && words.length > 0) {
          const match = all.find(
            (s) => s.item === words[0] || s.spec.title.toLowerCase() === words[0]!.toLowerCase(),
          );
          if (match) {
            screenId = match.item;
            question = words.slice(1).join(" ").trim();
          }
        }
        const primary = all.filter((s) => !s.spec.variantOf);
        const target = screenId
          ? all.find((s) => s.item === screenId || s.spec.title.toLowerCase() === screenId!.toLowerCase())
          : (primary[primary.length - 1] ?? all[all.length - 1]);
        if (!target) {
          throw new Error(`no wireframe screen "${screenId}" on this canvas`);
        }
        const explanation = explainWireDecision(target.spec, question || undefined);
        if (ctx.json) {
          return printJson({
            itemId: target.item,
            ...explanation,
          });
        }
        for (const line of explanation.lines) console.log(line);
      }),
    );
}
