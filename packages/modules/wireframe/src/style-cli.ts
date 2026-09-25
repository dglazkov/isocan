import { existsSync, readFileSync } from "node:fs";
import type { Command } from "commander";
import { moduleAsset, type CanvasContents, type Item } from "@isocan/core";
import { packagePath } from "@isocan/core/packageroot";
import type { CliHost } from "@isocan/cli/modulehost";
import { cliAnswerer, cliPort } from "./cli-port.ts";
import { mappingSaver } from "./compose-cli.ts";
import { wiresOn, type Screen } from "./flow.ts";
import { HOUSE, OWN_PRESETS, PACK_PRESETS, applyPreset, flowScreens, presetFile, presetOrSay, presetSummary, type WirePreset } from "./presets.ts";
import { wireframeModule } from "./record.ts";
import { StyleResolver, governingSystem, mappingLines, restyle, restyleSummary } from "./restyle.ts";
import { wireTitle, type WireSpec } from "./spec.ts";

/**
 * Where this module's files, and the design competition's, sit inside a copy
 * of isocan — written out, as design-competition's own `OWN_DIR` is, because
 * the bundled release CLI shares one `import.meta.url` across every module.
 * The release branch keeps every module's `assets/`.
 */
const OWN_DIR = "packages/modules/wireframe";
const PACKS_DIR = "packages/modules/design-competition";

/** A wire style's DESIGN.md, as text — or a refusal that says why it cannot be read here. */
export function presetText(preset: WirePreset): string {
  const rel = presetFile(preset);
  const where = preset.from === "own" ? moduleAsset(wireframeModule.name, rel) ?? packagePath(OWN_DIR, rel) : packagePath(PACKS_DIR, rel);
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

type CheckState = "current" | "behind" | "other system" | "not in it yet" | "no system governs";

function checkState(spec: WireSpec, system: Item | null): CheckState {
  const s = spec.style;
  if (!system) return s?.source === "design-system" ? "no system governs" : "current";
  if (s?.source !== "design-system") return "not in it yet";
  if (s.itemId !== system.id) return "other system";
  return s.versionId === system.currentVersionId ? "current" : "behind";
}

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

        if (opts.check) return check(canvas, screens.map((s) => ({ screen: s, item: canvas.items[s.item]! })), ctx.json, printJson, say);

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
  json: boolean,
  printJson: (v: unknown) => void,
  say: (line: string) => void,
): void {
  const rows = wires.map(({ screen, item }) => {
    const system = governingSystem(canvas, item);
    const state = checkState(screen.spec, system);
    const drawnBy = screen.spec.style?.source === "design-system" ? screen.spec.style : null;
    const drawnVersion = drawnBy ? canvas.items[drawnBy.itemId]?.versions.findIndex((v) => v.id === drawnBy.versionId) : undefined;
    return {
      itemId: item.id,
      title: wireTitle(screen.spec),
      state,
      governedBy: system ? { itemId: system.id, title: system.title, version: system.versions.findIndex((v) => v.id === system.currentVersionId) + 1, versions: system.versions.length } : null,
      drawnBy: drawnBy ? { itemId: drawnBy.itemId, version: drawnVersion !== undefined && drawnVersion >= 0 ? drawnVersion + 1 : null, name: drawnBy.name ?? null } : "default",
    };
  });
  if (json) return printJson({ wires: rows, behind: rows.filter((r) => r.state !== "current").length });
  const off = rows.filter((r) => r.state !== "current");
  for (const r of off) {
    const d = r.drawnBy;
    const was = typeof d === "string" ? "the default look" : `"${d.name ?? d.itemId}" version ${d.version ?? "?"}`;
    const is = r.governedBy ? `"${r.governedBy.title}" version ${r.governedBy.version} of ${r.governedBy.versions}` : "no system";
    say(`${r.itemId}  ${r.title} — ${r.state}: drawn in ${was}, governed by ${is}`);
  }
  say(off.length === 0
    ? `all ${rows.length} wires draw in the system that governs them — nothing to bring forward`
    : `${off.length} of ${rows.length} wires are not in the system that governs them — \`isocan wire style\` brings them forward`);
}
