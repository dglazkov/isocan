import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Command } from "commander";
import type { CliHost } from "@isocan/cli/modulehost";
import { newGroupId } from "@isocan/core";
import type { CanvasContents } from "@isocan/core";
import { copyDeck, wireCopyFile, type CopyDeck, type CopyEdit } from "@isocan/core/copy-deck";
import {
  MAX_COPY_VARIANTS,
  checkCopyVariants,
  copyVariantsRequest,
  flowCopyDeck,
  placeholderCopyVariants,
  splitFlowEdits,
  type FlowDeckScreen,
} from "@isocan/core/copy-variants";
import { voiceOf, type CopyVoice } from "@isocan/core/copy-voice";
import { readSystemDoc } from "./behind.ts";
import { cliPort, localTextKey } from "./cli-port.ts";
import { writeWireCopy } from "./copy-write.ts";
import { resolveTextGenerator } from "./copy-schema.ts";
import { wiresOn, type Screen } from "./flow.ts";
import { rebuildPrototypes } from "./kept-flows.ts";
import { currentVersionOf, type WirePort } from "./port.ts";
import { flowScreens } from "./presets.ts";
import { governingSystem } from "./restyle.ts";
import { wireTitle } from "./spec.ts";

/**
 * **A voice for the flow** — `isocan wire voice` (copy-edit phase 5, journey
 * scene 5). After `wire flesh`, N voices for the WHOLE flow in one ask — the
 * flow's screens as one deck (`flowCopyDeck`), so one voice is one voice on
 * every screen and a button that goes to the same place says the same words
 * everywhere — previewed on the first two screens, and the chosen one
 * applied to every screen as one op group with the prototype rebuilt once.
 * Intents are untouched by construction: a voice is words only, through the
 * same writer `wire copy --apply` uses, which refuses an edit that touches a
 * hotspot.
 *
 * Two steps, because a model's answer is not reproducible: without `--pick`
 * the voices are written to a file and previewed; `--from <file> --pick <k>`
 * applies one. `--from` also takes voices an agent wrote itself, in the shape
 * `words vary --from` takes, with flow addresses `<screen>::<address>`.
 * Without a text key the voices are placeholder words, said as such — the
 * whole path can be walked and nobody mistakes the filler for copy.
 */

interface Voice {
  stance: string;
  why: string;
  edits: CopyEdit[];
}

/** The flow a reference names: every fleshed screen of it, in flow order, variations left out. */
async function flowOf(host: CliHost, port: WirePort, canvas: CanvasContents, all: Screen[], refs: string[], flow: string | undefined): Promise<{ screens: Screen[]; flow: string }> {
  let seed: Screen[];
  if (refs.length > 0) {
    seed = refs.map((ref) => {
      const item = host.resolveItem({ canvas } as never, ref) as { id: string; title: string };
      const found = all.find((s) => s.item === item.id);
      if (!found) throw new Error(`"${item.title}" is not a wireframe screen — \`isocan wire voice\` writes a flow's voices`);
      return found;
    });
  } else if (flow !== undefined) {
    seed = all.filter((s) => s.spec.flow === flow);
    if (seed.length === 0) throw new Error(`no wireframe in flow "${flow}" on this canvas`);
  } else {
    const flows = new Set(all.map((s) => s.spec.flow || s.item));
    if (flows.size !== 1) throw new Error(all.length === 0 ? "no wireframe on this canvas — `isocan wire \"<request>\"` composes some" : `${flows.size} flows on this canvas — name a screen of one, or --flow <flow>`);
    seed = all;
  }
  const screens = flowScreens(all, seed.map((s) => s.item)).filter((s) => !s.spec.variantOf || s.spec.variantOf === s.item);
  void port;
  return { screens, flow: screens[0]?.spec.flow || screens[0]?.item || "" };
}

/** The product's voice: the governing DESIGN.md's Voice section, or null. */
async function productVoice(port: WirePort, canvas: CanvasContents, screen: Screen): Promise<CopyVoice | null> {
  const item = canvas.items[screen.item];
  const system = item ? governingSystem(canvas, item) : null;
  if (!system) return null;
  const doc = await readSystemDoc(system, (hash) => port.readText(hash));
  return doc ? voiceOf(doc) : null;
}

/** What one voice changes on the first two screens — the preview the scene asks for. */
export function previewLines(voice: Voice, screens: ReadonlyArray<FlowDeckScreen>, perScreen = 3): string[] {
  const byScreen = splitFlowEdits(voice.edits);
  const out: string[] = [];
  for (const s of screens.slice(0, 2)) {
    const edits = byScreen.get(s.itemId) ?? [];
    if (edits.length === 0) continue;
    out.push(`  ${s.title}:`);
    for (const e of edits.slice(0, perScreen)) out.push(`    ${JSON.stringify(e.text)} → ${JSON.stringify(e.to)}`);
    if (edits.length > perScreen) out.push(`    … and ${edits.length - perScreen} more`);
  }
  return out;
}

/** The voice `--pick` names: a 1-based number, or a stance (case-insensitive). */
export function pickVoice(voices: readonly Voice[], pick: string): Voice {
  const n = Number(pick);
  if (Number.isInteger(n) && n >= 1 && n <= voices.length) return voices[n - 1]!;
  const found = voices.find((v) => v.stance.toLowerCase() === pick.trim().toLowerCase());
  if (!found) throw new Error(`--pick ${JSON.stringify(pick)} names no voice — pick 1–${voices.length} or a stance: ${voices.map((v) => JSON.stringify(v.stance)).join(", ")}`);
  return found;
}

export function registerVoice(host: CliHost, wire: Command): void {
  const { run, ctxOf, resolveCanvas, printJson } = host;

  wire
    .command("voice [screens...]")
    .description("N voices for a whole flow's words, previewed on its first two screens and saved to a file; --from <file> --pick <k> applies one voice to every screen as one op group, prototype rebuilt. Words only; intents untouched")
    .option("--canvas <canvas>")
    .option("--flow <flow>", "this flow's screens (default: the flow the named screen is in, or the canvas's only flow)")
    .option("--n <n>", "how many voices (default 3)")
    .option("--brief <text>", "what the voices are for — \"warmer, for first-time buyers\"")
    .option("--from <file>", "voices already written — this command's own file, or an agent's: { \"variants\": [{ \"stance\", \"why\", \"edits\": [{ \"address\": \"<screen>::<string>\", \"to\" }] }] }")
    .option("--pick <k>", "apply this voice — its number (1-based) or its stance — to every screen of the flow")
    .option("--save <file>", "where to write the voices (default: a file under the temp directory, named in the receipt)")
    .option("--by <name>", "who wrote the words, with --from (recorded on each screen's spec; default agent)")
    .option("--answerer <name>", "stub: placeholder voices without a text model, said as such")
    .action(
      run(async (refs: string[], _local: unknown, cmd: Command) => {
        const opts = cmd.optsWithGlobals() as { flow?: string; n?: string; brief?: string; from?: string; pick?: string; save?: string; by?: string; answerer?: string };
        const ctx = await ctxOf(cmd);
        const p = await resolveCanvas(ctx);
        const port = cliPort(host, ctx, p.id);
        const canvas = await port.canvas();
        const all = await wiresOn(port, canvas);
        const { screens, flow } = await flowOf(host, port, canvas, all, refs, opts.flow);

        const n = opts.n === undefined ? undefined : Number(opts.n);
        if (n !== undefined && (!Number.isInteger(n) || n < 1 || n > MAX_COPY_VARIANTS)) throw new Error(`--n must be a whole number from 1 to ${MAX_COPY_VARIANTS} — got: ${opts.n}`);

        // Each screen's deck from its file; a screen still drawing bars has no words and is left out.
        const decks: FlowDeckScreen[] = [];
        const htmlOf = new Map<string, string>();
        for (const s of screens) {
          const item = canvas.items[s.item];
          const v = item ? currentVersionOf(item) : undefined;
          if (!v) continue;
          const html = await port.readText(v.blobHash);
          const deck: CopyDeck = copyDeck(html);
          if (deck.unfleshed || deck.strings.length === 0) continue;
          htmlOf.set(s.item, html);
          decks.push({ itemId: s.item, title: wireTitle(s.spec), deck });
        }
        if (decks.length === 0) throw new Error(`the flow's ${screens.length} screen${screens.length === 1 ? "" : "s"} draw bars — \`isocan wire flesh --flow ${flow}\` gives them words first`);
        const deck = flowCopyDeck(decks);
        const voice = await productVoice(port, canvas, screens.find((s) => s.item === decks[0]!.itemId)!);

        // The voices: a file, else one call for all N, else placeholders said as such.
        let raw: unknown;
        let by = opts.by ?? "agent";
        let placeholder = false;
        if (opts.from) {
          try {
            raw = JSON.parse(await readFile(opts.from, "utf8"));
          } catch (error) {
            throw new Error(`${opts.from}: ${(error as Error).message}`);
          }
          // This command's own file says who wrote the voices; an agent's file says nothing and is the agent's.
          const said = raw && typeof raw === "object" ? (raw as { by?: unknown; placeholder?: unknown }) : {};
          if (!opts.by && typeof said.by === "string" && said.by) by = said.by;
          if (said.placeholder === true) placeholder = true;
        } else {
          const asked = n ?? 3;
          const text = opts.answerer === "stub" ? undefined : localTextKey();
          if (text) {
            const generator = resolveTextGenerator({ text });
            const { prompt, schema } = copyVariantsRequest(deck, asked, opts.brief, voice, { screens: decks.length, titles: decks.map((d) => d.title) });
            raw = await generator.generateJson(prompt, schema);
            by = generator.name;
          } else {
            raw = placeholderCopyVariants(deck, asked);
            by = "placeholder words";
            placeholder = true;
            if (opts.answerer !== "stub") console.error("no text model on this machine (no ISOCAN_TEXT_API_KEY, and no key from `isocan keys set anthropic`) — these are PLACEHOLDER voices, not written copy");
          }
        }
        const checked = checkCopyVariants(deck, raw, opts.from && n === undefined ? undefined : (n ?? 3), voice);
        if (!checked.ok) throw new Error(`${opts.from ?? "the text model's answer"}: ${checked.reason}`);
        const voices: Voice[] = checked.variants;

        // No pick: preview and save, and say how to pick.
        if (!opts.pick) {
          const file = opts.save ?? (opts.from && !opts.save ? opts.from : path.join(tmpdir(), `isocan-voices-${flow.replace(/[^A-Za-z0-9_-]/g, "")}-${Date.now()}.json`));
          if (file !== opts.from) await writeFile(file, JSON.stringify({ flow, screens: decks.map((d) => d.itemId), by, placeholder, variants: voices }, null, 2));
          if (ctx.json) return printJson({ flow, screens: decks.map((d) => d.itemId), by, placeholder, voice: voice !== null, file, variants: voices.map((v) => ({ stance: v.stance, why: v.why, changed: v.edits.length })) });
          voices.forEach((v, i) => {
            console.log(`${i + 1}. ${v.stance} — ${v.why} (${v.edits.length} string${v.edits.length === 1 ? "" : "s"} across ${splitFlowEdits(v.edits).size} screen${splitFlowEdits(v.edits).size === 1 ? "" : "s"})`);
            for (const line of previewLines(v, decks)) console.log(line);
          });
          console.log(
            `${voices.length} voice${voices.length === 1 ? "" : "s"} for ${decks.length} screen${decks.length === 1 ? "" : "s"} by ${by}${placeholder ? " (placeholder)" : ""}${voice ? ", held to DESIGN.md's Voice" : ""} — saved to ${file}; ` +
              `\`isocan wire voice --from ${file} --pick <1–${voices.length}>\` applies one to every screen`,
          );
          return;
        }

        // A pick: every screen's share of that voice, one version each, one group, the prototype once.
        const chosen = pickVoice(voices, opts.pick);
        const byScreen = splitFlowEdits(chosen.edits);
        const group = newGroupId();
        const changed: Array<{ item: string; title: string; spec: Screen["spec"]; strings: number }> = [];
        for (const s of screens) {
          const edits = byScreen.get(s.item);
          const html = htmlOf.get(s.item);
          if (!edits || !html) continue;
          const file = wireCopyFile(html, edits);
          if (!file.ok) throw new Error(`"${wireTitle(s.spec)}": ${file.reason}`);
          const r = await writeWireCopy(port, canvas, all, s, file.file, by, undefined, { group, rebuild: false });
          if (r.changed) changed.push({ item: s.item, title: wireTitle(r.next), spec: r.next, strings: file.changed.length });
        }
        const prototypes = changed.length ? await rebuildPrototypes(port, canvas, all, changed.map((c) => ({ item: c.item, spec: c.spec })), group) : [];
        if (ctx.json) return printJson({ flow, stance: chosen.stance, by, placeholder, group, changed: changed.map((c) => ({ itemId: c.item, title: c.title, strings: c.strings })), prototypes });
        if (changed.length === 0) return void console.log(`the flow already speaks in "${chosen.stance}" — nothing written`);
        for (const c of changed) console.log(`${c.item}  ${c.title} — ${c.strings} string${c.strings === 1 ? "" : "s"}`);
        console.log(`"${chosen.stance}" applied to ${changed.length} of ${decks.length} screen${decks.length === 1 ? "" : "s"} by ${by}${placeholder ? " (placeholder)" : ""}${prototypes.length ? ", prototype rebuilt" : ""} — one op group; \`isocan undo\` takes it all back`);
      }),
    );
}
