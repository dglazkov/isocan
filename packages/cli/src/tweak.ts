import type { Command } from "commander";
import {
  UI_PIECES,
  UI_TWEAKS_PROP,
  compileUiTweaksCss,
  findUiKnob,
  findUiPiece,
  knobsForPiece,
  parseUiTweaks,
  resetUiTweaks,
  serializeUiTweaks,
  setUiTweak,
} from "@isocan/core/ui-tweaks";
import type { Ctx } from "./ctx.ts";
import { printJson, printTable } from "./output.ts";
import { onCanvas } from "./run.ts";

/**
 * **`isocan tweak` — live UI Devtools from the terminal** (both surfaces rule).
 *
 * Reads and writes the same `canvas.properties["ui.tweaks"]` payload that the
 * browser's per-piece Devtools (`⌥D`, right-click `"Tweak <Piece>…"`, `⌖ Pick`)
 * saves via `project.update`. Every browser on the canvas sees the update live.
 */
export function registerTweak(program: Command, ctxOf: (cmd: Command) => Promise<Ctx>): void {
  const tweak = program
    .command("tweak")
    .description("Customize any UI piece on the canvas (glass, toolbar, rail, zoom, minimap, dock, items, layers, colors)")
    .option("--canvas <canvas>")
    .addHelpText(
      "after",
      `
Every UI piece has knobs for opacity, size, radius, z-index, spacing, and color.
Changes write \`canvas.properties["ui.tweaks"]\` via \`project.update\`, so one
undo step takes a tweak back and every connected browser updates live.

  isocan tweak                                   # list pieces and active tweaks
  isocan tweak ls glass                          # list knobs for Floating Glass
  isocan tweak set glass.opacity=82 toolbar.height=52
  isocan tweak reset glass                       # reset one piece (or one knob)
  isocan tweak reset --all                       # reset every UI tweak on this canvas
  isocan tweak css                               # print compiled CSS overrides`,
    );

  tweak
    .command("ls [piece]", { isDefault: true })
    .description("List UI pieces and knobs, with defaults and active canvas values")
    .option("--canvas <canvas>")
    .action(
      onCanvas(ctxOf, async (handle, ctx, args) => {
        const pieceArg = typeof args[0] === "string" ? args[0].trim() : "";
        const active = parseUiTweaks(handle.record.properties?.[UI_TWEAKS_PROP]);

        if (pieceArg) {
          const piece = findUiPiece(pieceArg);
          if (!piece) {
            throw new Error(
              `unknown UI piece "${pieceArg}". Valid pieces: ${UI_PIECES.map((p) => p.id).join(", ")}`,
            );
          }
          const knobs = knobsForPiece(piece.id).map((k) => ({
            key: k.key,
            label: k.label,
            value: active[k.key] ?? k.defaultValue,
            default: k.defaultValue,
            unit: k.unit ?? "",
            range: k.kind === "number" ? `${k.min}..${k.max}` : "hex",
            tweaked: active[k.key] !== undefined ? "yes" : "no",
          }));
          if (ctx.json) {
            printJson({ canvasId: handle.id, piece, knobs });
            return;
          }
          console.log(`${piece.name} (${piece.id}) — ${piece.summary}\n`);
          printTable(
            knobs.map((k) => ({
              key: k.key,
              label: k.label,
              value: String(k.value),
              default: String(k.default),
              unit: k.unit,
              range: k.range,
              tweaked: k.tweaked,
            })),
          );
          return;
        }

        const pieces = UI_PIECES.map((p) => {
          const knobs = knobsForPiece(p.id);
          const changed = knobs.filter((k) => active[k.key] !== undefined).length;
          return {
            piece: p.id,
            name: p.name,
            knobs: knobs.length,
            active: changed > 0 ? `${changed} tweaked` : "default",
            selector: p.selector,
          };
        });

        if (ctx.json) {
          printJson({ canvasId: handle.id, tweaks: active, pieces });
          return;
        }
        printTable(
          pieces.map((p) => ({
            piece: p.piece,
            name: p.name,
            knobs: String(p.knobs),
            active: p.active,
            selector: p.selector,
          })),
        );
        const activeKeys = Object.keys(active);
        if (activeKeys.length > 0) {
          console.log("\nActive tweaks:");
          for (const key of activeKeys) {
            const knob = findUiKnob(key);
            console.log(`  ${key} = ${active[key]}${knob?.unit ?? ""} (default ${knob?.defaultValue}${knob?.unit ?? ""})`);
          }
        } else {
          console.log("\nNo custom UI tweaks on this canvas (`isocan tweak ls <piece>` shows knobs).");
        }
      }),
    );

  tweak
    .command("set <assignments...>")
    .description("Set one or more UI knobs (`key=value`, e.g. `glass.opacity=82 toolbar.height=52`)")
    .option("--canvas <canvas>")
    .action(
      onCanvas(ctxOf, async (handle, ctx, args) => {
        const assignments = args[0] as string[];
        let next = parseUiTweaks(handle.record.properties?.[UI_TWEAKS_PROP]);

        for (const pair of assignments) {
          const eq = pair.indexOf("=");
          if (eq <= 0) {
            throw new Error(`invalid assignment "${pair}". Expected <key>=<value> (e.g. glass.opacity=82).`);
          }
          const key = pair.slice(0, eq).trim();
          const rawValue = pair.slice(eq + 1).trim();
          const res = setUiTweak(next, key, rawValue);
          if (res.error) throw new Error(res.error);
          next = res.tweaks;
        }

        const serialized = serializeUiTweaks(next);
        await ctx.client.sendOp(handle.id, ctx.actor, {
          type: "project.update",
          patch: serialized ? { properties: { [UI_TWEAKS_PROP]: serialized } } : { removeProperties: [UI_TWEAKS_PROP] },
        });

        if (ctx.json) {
          printJson({ canvasId: handle.id, tweaks: next });
          return;
        }
        const count = Object.keys(next).length;
        console.log(
          count > 0
            ? `updated UI tweaks on ${handle.id} (${count} active knob${count === 1 ? "" : "s"})`
            : `reset UI tweaks on ${handle.id} to defaults`,
        );
      }),
    );

  tweak
    .command("reset [target]")
    .description("Reset one knob (`glass.opacity`), one piece (`glass`), or `--all`")
    .option("--all", "reset every UI tweak on this canvas")
    .option("--canvas <canvas>")
    .action(
      onCanvas(ctxOf, async (handle, ctx, args) => {
        const target = typeof args[0] === "string" ? args[0].trim() : "";
        const opts = (args[1] ?? {}) as { all?: boolean };
        const current = parseUiTweaks(handle.record.properties?.[UI_TWEAKS_PROP]);

        if (!opts.all && !target) {
          throw new Error("pass a knob key (`glass.opacity`), a piece id (`glass`), or `--all`");
        }
        if (target && !findUiPiece(target) && !findUiKnob(target)) {
          throw new Error(
            `unknown tweak target "${target}". Pass a piece (${UI_PIECES.map((p) => p.id).join(", ")}) or knob key.`,
          );
        }

        const next = opts.all ? resetUiTweaks(current) : resetUiTweaks(current, target);
        const serialized = serializeUiTweaks(next);
        await ctx.client.sendOp(handle.id, ctx.actor, {
          type: "project.update",
          patch: serialized ? { properties: { [UI_TWEAKS_PROP]: serialized } } : { removeProperties: [UI_TWEAKS_PROP] },
        });

        if (ctx.json) {
          printJson({ canvasId: handle.id, reset: opts.all ? "all" : target, tweaks: next });
          return;
        }
        console.log(
          opts.all
            ? `reset all UI tweaks on ${handle.id}`
            : `reset ${target} on ${handle.id} (${Object.keys(next).length} active knob${Object.keys(next).length === 1 ? "" : "s"} remaining)`,
        );
      }),
    );

  tweak
    .command("css")
    .description("Print the compiled CSS overrides for this canvas's active UI tweaks")
    .option("--canvas <canvas>")
    .action(
      onCanvas(ctxOf, async (handle, ctx) => {
        const tweaks = parseUiTweaks(handle.record.properties?.[UI_TWEAKS_PROP]);
        const css = compileUiTweaksCss(tweaks);
        if (ctx.json) {
          printJson({ canvasId: handle.id, tweaks, css });
          return;
        }
        if (!css) {
          console.log("/* No custom UI tweaks on this canvas. */");
          return;
        }
        console.log(css);
      }),
    );
}
