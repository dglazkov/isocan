import type { Command } from "commander";
import type { CanvasContents, Item } from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import { cliAnswerer, cliPort } from "./cli-port.ts";
import { mappingSaver } from "./compose-cli.ts";
import { wiresOn, type Screen } from "./flow.ts";
import { StyleResolver, governingSystem, mappingLines, restyle, restyleSummary } from "./restyle.ts";
import { wireTitle, type WireSpec } from "./spec.ts";

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
    .description("Restyle every wire in the design system that governs it — Jev maps the system's tokens onto the wire's roles, once per system version; one op group, a version per changed wire. --default restores the greys; --check lists wires behind their system")
    .option("--canvas <canvas>")
    .option("--default", "back to the default wire look (the greys)")
    .option("--check", "write nothing: list the wires that are behind the system that governs them")
    .option("--flow <flow>", "only this flow's screens and their variations")
    .action(
      run(async (_local: unknown, cmd: Command) => {
        const opts = cmd.optsWithGlobals() as { default?: boolean; check?: boolean; flow?: string; answerer?: string; seed?: string; save?: string };
        if (opts.default && opts.check) throw new Error("--default writes and --check does not — say one");
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
