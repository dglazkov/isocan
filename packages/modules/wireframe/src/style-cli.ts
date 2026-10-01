import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { moduleAsset, type CanvasContents, type DesignDoc, type Item } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import { cliAnswerer, cliPort } from "./cli-port.ts";
import { mappingSaver } from "./compose-cli.ts";
import { wiresOn, type Screen } from "./flow.ts";
import { HOUSE, OWN_PRESETS, PACK_PRESETS, applyPreset, flowScreens, presetFile, presetOrSay, presetSummary, type WirePreset } from "./presets.ts";
import { wireframeModule } from "./record.ts";
import { checkWire, checkWords, readSystemDoc, restyleLabel, specKey, systemsToRead, type DocOf } from "./behind.ts";
import { wireDsOnCanvas } from "./ds.ts";
import { polishWireOnCanvas } from "./polish.ts";
import { StyleResolver, mappingLines, restyle, restyleSummary } from "./restyle.ts";
import { wireTitle } from "./spec.ts";

/**
 * Where this module's files, and the design competition's, sit inside a copy
 * of isocan — written out, as design-competition's own `OWN_DIR` is, because
 * the bundled release CLI shares one `import.meta.url` across every module.
 * The release branch keeps every module's `assets/`.
 */
const OWN_DIR = "packages/modules/wireframe";
const PACKS_DIR = "packages/modules/design-competition";

function rootPath(...parts: string[]): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let up = 0; up < 12; up++) {
    const manifest = path.join(dir, "package.json");
    if (existsSync(manifest)) {
      try {
        if ((JSON.parse(readFileSync(manifest, "utf8")) as { name?: string }).name === "isocan") {
          return path.join(dir, ...parts);
        }
      } catch {
        // continue walking up
      }
    }
    dir = path.dirname(dir);
  }
  return path.join(dir, ...parts);
}

/** A wire style's DESIGN.md, as text — or a refusal that says why it cannot be read here. */
export function presetText(preset: WirePreset): string {
  const rel = presetFile(preset);
  const where = preset.from === "own" ? moduleAsset(wireframeModule.name, rel) ?? rootPath(OWN_DIR, rel) : rootPath(PACKS_DIR, rel);
  if (!existsSync(where)) {
    throw new Error(preset.from === "pack"
      ? `the design competition's packs are not on this machine, so "${preset.id}" cannot be read — the module's own styles can (\`isocan wire style --list\`)`
      : `the ${preset.name} wire style's DESIGN.md is missing from this install (${rel})`);
  }
  return readFileSync(where, "utf8");
}

/** Can this style's file be read here? `--list` says which cannot. */
function readable(preset: WirePreset): boolean {
  try {
    presetText(preset);
    return true;
  } catch {
    return false;
  }
}

/**
 * **`isocan wire style`** — every wire in the design system that governs it
 * (design §9, journey scene 6). The restyle itself is `restyle.ts`, which the
 * web's `/wire style` runs too; here are the flags, the answerer the terminal
 * picks (Jev with a key here, the home's judge without one, the stub when
 * neither has a key), `--check`, and the lines it prints. `--default`
 * restores the greys; `--check` writes nothing and lists the wires behind
 * their system.
 */

export { StyleResolver, governingSystem, mappingLines, type Mapping } from "./restyle.ts";

export function registerStyle(host: CliHost, wire: Command): void {
  const { run, ctxOf, resolveCanvas, printJson } = host;

  wire
    .command("style")
    .description("Restyle every wire in the design system that governs it — Jev maps the system's tokens onto the wire's roles, once per system version; one op group, a version per changed wire. --preset <name> chooses a named wire style for the flows (material, shadcn, glass, ios, fluent, carbon, brutalist, a design-competition pack, or house for the greys); --list names them; --default restores the greys; --check lists wires behind their system")
    .argument("[screens...]", "only these screens' flows (ids, titles or #refs) — every wire when none")
    .option("--canvas <canvas>")
    .option("--preset <name>", "a wire style: its DESIGN.md placed beside the flow and made its group's (or the canvas's) design system, and the flow restyled — one op group; house returns to the greys and lets the style's file go")
    .option("--list", "write nothing: name the wire styles --preset takes, and say which cannot be read here")
    .option("--default", "back to the default wire look (the greys)")
    .option("--check", "write nothing: list the wires that are behind the system that governs them")
    .option("--flow <flow>", "only this flow's screens and their variations")
    .action(
      run(async (refs: string[], _local: unknown, cmd: Command) => {
        const opts = cmd.optsWithGlobals() as { default?: boolean; check?: boolean; flow?: string; preset?: string; list?: boolean; answerer?: string; seed?: string; save?: string };
        if (opts.default && opts.check) throw new Error("--default writes and --check does not — say one");
        if (opts.preset !== undefined && (opts.default || opts.check)) throw new Error("--preset chooses a look; --default and --check do other things — say one (--preset house is the greys)");
        const ctx = await ctxOf(cmd);
        const say = (line: string) => {
          if (!ctx.json) console.log(line);
        };
        if (opts.list) return listPresets(ctx.json, printJson, say);
        const choice = opts.preset === undefined ? undefined : presetOrSay(opts.preset);
        const p = await resolveCanvas(ctx);
        const port = cliPort(host, ctx, p.id);
        const canvas = await port.canvas();
        const all = await wiresOn(port, canvas);
        const named = (refs ?? []).map((ref) => {
          const item = host.resolveItem({ canvas } as never, ref) as { id: string; title: string };
          if (!all.some((s) => s.item === item.id)) throw new Error(`"${item.title}" is not a wireframe screen — \`isocan wire "<request>"\` composes some`);
          return item.id;
        });
        const inFlow = opts.flow === undefined ? all : all.filter((s) => s.spec.flow === opts.flow);
        const screens = named.length ? flowScreens(inFlow, named) : inFlow;
        if (screens.length === 0) {
          throw new Error(opts.flow === undefined && !named.length ? "no wireframe on this canvas — `isocan wire \"<request>\"` composes some" : `no wireframe in ${named.length ? "those screens' flows" : `flow "${opts.flow}"`} on this canvas`);
        }

        if (choice !== undefined) {
          const text = choice === HOUSE ? null : presetText(choice);
          const answerer = cliAnswerer(ctx, p.id, opts.answerer === "agent" ? undefined : opts.answerer, Number(opts.seed ?? 1), say);
          const resolver = new StyleResolver(port, answerer, async () => all.map((s) => s.spec), mappingSaver(opts.save));
          const r = await applyPreset(port, all, screens, choice, text, resolver);
          if (ctx.json) {
            return printJson({
              group: r.group,
              preset: r.name,
              placed: r.placed,
              restyled: r.restyled.changed.map((t) => ({ itemId: t.item.id, title: wireTitle(t.screen.spec) })),
              unchanged: r.restyled.targets.filter((t) => !r.restyled.changed.includes(t)).map((t) => t.item.id),
              prototypes: r.restyled.prototypes,
              calls: resolver.calls,
              cost: resolver.cost(),
            });
          }
          for (const m of resolver.mappings.values()) for (const line of mappingLines(m, resolver.who)) say(line);
          for (const pl of r.placed) say(`${pl.itemId} — ${pl.what === "added" ? "placed beside the flow and made" : pl.what === "versioned" ? "a new version of" : pl.what === "removed" ? "moved to the trash; no longer" : "already"} the design system of ${pl.scope ? `group ${pl.scope}` : "the canvas"}`);
          for (const pr of r.restyled.prototypes) say(`prototype ${pr.itemId} — ${pr.what === "versioned" ? "rebuilt as a new version" : pr.what}`);
          say(presetSummary(r).replace("one undo takes", "`isocan undo` takes"));
          return;
        }

        if (opts.check) {
          // Each governing system's current file, read once: behind means something a wire draws from moved (`stillDraws`).
          const read = new Map<string, DesignDoc | null>();
          for (const system of systemsToRead(canvas, (hash) => all.find((s) => specKey(canvas.items[s.item]!) === hash)?.spec)) read.set(system.id, await readSystemDoc(system, (h) => port.readText(h)));
          return check(canvas, screens.map((s) => ({ screen: s, item: canvas.items[s.item]! })), (system) => read.get(system.id), ctx.json, printJson, say);
        }

        // An agent answers rounds, not a mapping: `--answerer agent` maps with whatever this machine has.
        const answerer = cliAnswerer(ctx, p.id, opts.answerer === "agent" ? undefined : opts.answerer, Number(opts.seed ?? 1), say);
        const resolver = new StyleResolver(port, answerer, async () => all.map((s) => s.spec), mappingSaver(opts.save));
        const result = await restyle(port, canvas, all, screens, resolver, { toDefault: Boolean(opts.default) });
        const { targets, changed, prototypes, group } = result;

        const mappings = [...resolver.mappings.values()];
        const by = resolver.who;
        if (ctx.json) {
          return printJson({
            group,
            style: opts.default ? "default" : "design-system",
            systems: mappings.map((m) => ({ itemId: m.system.id, versionId: m.versionId, version: m.version, name: m.name, how: m.how, roles: m.roles, wires: targets.filter((t) => t.system?.id === m.system.id).length })),
            restyled: changed.map((t) => ({ itemId: t.item.id, title: wireTitle(t.screen.spec), style: t.style.source === "design-system" ? t.style.itemId : "default" })),
            unchanged: targets.filter((t) => !changed.includes(t)).map((t) => t.item.id),
            prototypes,
            calls: resolver.calls,
            inputTokens: resolver.inputTokens,
            cost: resolver.cost(),
            answerer: by,
          });
        }
        for (const m of mappings) {
          const governed = targets.filter((t) => t.system?.id === m.system.id);
          for (const line of mappingLines(m, by)) say(line);
          say(`  governs ${governed.length} wire${governed.length === 1 ? "" : "s"}`);
        }
        const inDefault = targets.filter((t) => t.style.source === "default").length;
        if (inDefault) say(`${inDefault} wire${inDefault === 1 ? "" : "s"} in the default look${opts.default ? "" : " — no design system governs where they sit"}`);
        for (const pr of prototypes) say(`prototype ${pr.itemId} — ${pr.what === "versioned" ? "rebuilt as a new version" : pr.what}`);
        say(restyleSummary(result).replace("one undo takes", "`isocan undo` takes"));
      }),
    );

  wire
    .command("ds [request...]")
    .description("Synthesize a WCAG AA contrast-repaired DESIGN.md with Jev, make it govern the flow's scope, and restyle all screens and prototype in one op group")
    .option("--canvas <canvas>")
    .option("--flow <flow>", "only this flow's screens")
    .option("--name <name>", "explicit name for the synthesized design system")
    .option("--surface <surface>", "override surface mode: flat | raised | glass | bold")
    .action(
      run(async (words: string[], _local: unknown, cmd: Command) => {
        const opts = cmd.optsWithGlobals() as {
          flow?: string;
          name?: string;
          surface?: "flat" | "raised" | "glass" | "bold";
          answerer?: string;
          seed?: string;
        };
        const ctx = await ctxOf(cmd);
        const say = (line: string) => {
          if (!ctx.json) console.log(line);
        };
        const p = await resolveCanvas(ctx);
        const port = cliPort(host, ctx, p.id);
        const canvas = await port.canvas();
        const all = await wiresOn(port, canvas);
        const screens = opts.flow === undefined ? all : all.filter((s) => s.spec.flow === opts.flow);
        if (screens.length === 0) {
          throw new Error(opts.flow === undefined ? "no wireframe on this canvas — `isocan wire \"<request>\"` composes some" : `no wireframe in flow "${opts.flow}" on this canvas`);
        }
        const answerer = cliAnswerer(ctx, p.id, opts.answerer === "agent" ? undefined : opts.answerer, Number(opts.seed ?? 1), say);
        const r = await wireDsOnCanvas(port, all, screens, words.join(" "), answerer, {
          ...(opts.name ? { name: opts.name } : {}),
          ...(opts.surface ? { surface: opts.surface } : {}),
        });
        if (ctx.json) {
          return printJson({
            group: r.group,
            dsItemId: r.dsItemId,
            what: r.what,
            direction: r.synthesized.direction.id,
            surface: r.synthesized.surface,
            density: r.synthesized.density,
            repairs: r.synthesized.repairs,
            restyled: r.restyled.changed.map((t) => ({ itemId: t.item.id, title: wireTitle(t.screen.spec) })),
            prototypes: r.restyled.prototypes,
          });
        }
        say(`${r.dsItemId}  ${r.synthesized.name} (${r.synthesized.direction.id} · surface:${r.synthesized.surface} · density:${r.synthesized.density} · p ${r.synthesized.p.toFixed(2)})`);
        if (r.synthesized.repairs.length > 0) {
          say(`  repaired ${r.synthesized.repairs.length} contrast pair${r.synthesized.repairs.length === 1 ? "" : "s"} to ≥ 4.5:1 AA`);
        }
        say(`${r.restyled.changed.length} of ${r.restyled.targets.length} wires restyled — \`isocan undo\` takes it back`);
      }),
    );

  wire
    .command("polish [screens...]")
    .description("Apply Jev-budgeted visual refinement patches (0 | 4 | 8 | 12) guarded by verifyWireContract in one op group")
    .option("--canvas <canvas>")
    .option("--flow <flow>", "only this flow's screens")
    .option("--intensity <n>", "override polish_intensity (0–1)")
    .option("--clear", "remove polish patches from target screens")
    .action(
      run(async (refs: string[], _local: unknown, cmd: Command) => {
        const opts = cmd.optsWithGlobals() as {
          flow?: string;
          intensity?: string;
          clear?: boolean;
          answerer?: string;
          seed?: string;
        };
        const ctx = await ctxOf(cmd);
        const say = (line: string) => {
          if (!ctx.json) console.log(line);
        };
        const p = await resolveCanvas(ctx);
        const port = cliPort(host, ctx, p.id);
        const canvas = await port.canvas();
        const all = await wiresOn(port, canvas);
        const named = (refs ?? []).map((ref) => {
          const item = host.resolveItem({ canvas } as never, ref) as { id: string; title: string };
          const found = all.find((s) => s.item === item.id);
          if (!found) throw new Error(`"${item.title}" is not a wireframe screen`);
          return found;
        });
        const screens = named.length ? named : opts.flow === undefined ? all : all.filter((s) => s.spec.flow === opts.flow);
        if (screens.length === 0) {
          throw new Error("no wireframe on this canvas — `isocan wire \"<request>\"` composes some");
        }
        const answerer = cliAnswerer(ctx, p.id, opts.answerer === "agent" ? undefined : opts.answerer, Number(opts.seed ?? 1), say);
        const r = await polishWireOnCanvas(port, canvas, all, screens, answerer, {
          ...(opts.intensity !== undefined ? { intensity: Number(opts.intensity) } : {}),
          ...(opts.clear ? { clear: true } : {}),
        });
        if (ctx.json) {
          return printJson({
            group: r.group,
            by: r.by,
            changed: r.changed.map((c) => ({
              itemId: c.itemId,
              title: c.title,
              intensity: c.intensity,
              budget: c.budget,
              patches: c.patches,
            })),
            prototypes: r.prototypes,
          });
        }
        for (const c of r.changed) {
          say(`${c.itemId}  ${c.title} — ${c.patches.length} polish patch${c.patches.length === 1 ? "" : "es"} (intensity ${c.intensity}, budget ${c.budget})`);
        }
        say(`${r.changed.length} of ${screens.length} wire${screens.length === 1 ? "" : "s"} ${opts.clear ? "unpolished" : "polished"} (${r.by})${r.prototypes.length ? ", prototype rebuilt" : ""} — \`isocan undo\` takes it back`);
      }),
    );
}

/** `wire style --list`: house, the module's own styles, the packs — and a pack this install cannot read, said. */
function listPresets(json: boolean, printJson: (v: unknown) => void, say: (line: string) => void): void {
  const rows = [
    { id: HOUSE, name: "House", about: "the default greys — lets go of a wire style's DESIGN.md", from: "house", readable: true },
    ...[...OWN_PRESETS, ...PACK_PRESETS].map((p) => ({ ...p, readable: readable(p) })),
  ];
  if (json) return printJson({ presets: rows });
  for (const r of rows) say(`${r.id.padEnd(10)} ${r.about}${r.readable ? "" : " — not readable on this machine"}`);
  say("`isocan wire style --preset <name> [screens…]` — one op group; `isocan undo` takes it back");
}

function check(
  canvas: CanvasContents,
  wires: Array<{ screen: Screen; item: Item }>,
  docOf: DocOf,
  json: boolean,
  printJson: (v: unknown) => void,
  say: (line: string) => void,
): void {
  // The canvas's "behind" mark and its Restyle to <system> read this same check (`behind.ts`), in the same words.
  const rows = wires.map(({ screen, item }) => ({ ...checkWire(canvas, item, screen.spec, docOf), title: wireTitle(screen.spec) }));
  if (json) return printJson({ wires: rows, behind: rows.filter((r) => r.state !== "current").length });
  const off = rows.filter((r) => r.state !== "current");
  for (const r of off) say(`${r.itemId}  ${r.title} — ${checkWords(r)}${r.state === "behind" ? ` · ${restyleLabel(r)}: \`isocan wire style ${r.itemId}\`` : ""}`);
  say(off.length === 0
    ? `all ${rows.length} wires draw in the system that governs them — nothing to bring forward`
    : `${off.length} of ${rows.length} wires are not in the system that governs them — \`isocan wire style\` brings them forward`);
}
