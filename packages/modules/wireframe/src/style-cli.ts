import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import {
  newGroupId, newVersionId, parseDesign, selectDesignSystem,
  type CanvasContents, type CanvasSnapshotResponse, type Item,
} from "@isocan/core";
import type { CliHost } from "@isocan/cli/modulehost";
import { JEV_INPUT_PRICE, jevAnswerer, stubAnswerer, type Answerer, type JevRequest, type JevResponse } from "./answerer.ts";
import { wiresOn, type Ctx, type Screen } from "./compose-cli.ts";
import { keptFlowsOf, writePrototype } from "./links-cli.ts";
import { PROTOTYPE_PROP } from "./prototype.ts";
import { renderWire } from "./render.ts";
import { wireTitle, type WireSpec } from "./spec.ts";
import {
  DEFAULT_STYLE, ROLES, applyMapping, candidatesOf, mappingRequest, roleLine, sameStyle,
  type RoleChoice, type Role, type WireStyle,
} from "./theme.ts";

/**
 * **`isocan wire style`** — every wire in the design system that governs it
 * (design §9, journey scene 6).
 *
 * For each wire on the canvas: which `DESIGN.md` governs its place (a scoped
 * group's first, then the canvas's — core's `selectDesignSystem`), the
 * mapping of that system's tokens onto the wire's roles (asked of the
 * answerer once per system *version*, and not at all when a wire on the
 * canvas already carries the mapping for that version), and a new version of
 * every wire whose theme changed — in one op group, so one undo takes the
 * restyle back. A kept flow's prototype is rebuilt in the same group, so it
 * plays in the look its screens now have. `--default` restores the default
 * greys; `--check` writes nothing and lists the wires behind their system.
 */

/** One system version's mapping, and what it cost to learn. */
export interface Mapping {
  system: Item;
  versionId: string;
  /** 1-based, of how many — for people: "version 2 of 3". */
  version: number;
  versions: number;
  name: string;
  roles: Partial<Record<Role, RoleChoice>>;
  /** How it was found: asked the answerer, read off a wire already in it, or nothing to ask. */
  how: "asked" | "reused" | "nothing to ask";
  request?: JevRequest;
  response?: JevResponse;
  ms?: number;
  /** Who answered it, when anybody was asked. */
  by?: string;
}

function currentVersion(item: Item) {
  return item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[item.versions.length - 1];
}

/** The design system that governs this item's place, or null. */
export function governingSystem(canvas: CanvasContents, item: Item): Item | null {
  const selected = selectDesignSystem(canvas, { at: item });
  return selected.status === "selected" ? selected.item : null;
}

/**
 * **Mappings, once per system version.** Cached for the run; before asking,
 * any wire already on the canvas drawn from the same version lends its
 * mapping — so re-running `wire style` with nothing changed asks nothing.
 */
export class StyleResolver {
  readonly mappings = new Map<string, Mapping>();
  calls = 0;
  inputTokens = 0;
  by = "";
  private known: WireSpec[] | null = null;

  constructor(
    private ctx: Ctx,
    private canvasId: string,
    private answerer: Answerer,
    /** The wires already on the canvas, read only when a mapping is needed. */
    private loadKnown: () => Promise<readonly WireSpec[]>,
    private save?: string,
  ) {}

  async styleFor(system: Item | null): Promise<WireStyle> {
    if (!system) return DEFAULT_STYLE;
    const m = await this.mapping(system);
    return { source: "design-system", itemId: system.id, versionId: m.versionId, name: m.name, ...(m.by ? { by: m.by } : {}), roles: m.roles };
  }

  /** A mapping on the canvas may be lent to this run: anything Jev (or nobody) answered; a stub's only to the stub. */
  private lendable(style: WireStyle | undefined, system: Item, versionId: string): boolean {
    if (style?.source !== "design-system" || style.itemId !== system.id || style.versionId !== versionId) return false;
    return !style.by?.startsWith("stub") || this.answerer.name === "stub";
  }

  async mapping(system: Item): Promise<Mapping> {
    const current = currentVersion(system);
    if (!current) throw new Error(`the design system "${system.title}" has no version to read`);
    const key = `${system.id}@${current.id}`;
    const cached = this.mappings.get(key);
    if (cached) return cached;
    const base = {
      system,
      versionId: current.id,
      version: system.versions.findIndex((v) => v.id === current.id) + 1,
      versions: system.versions.length,
    };
    this.known ??= [...(await this.loadKnown())];
    const lent = this.known.find((s) => this.lendable(s.style, system, current.id));
    const doc = parseDesign(Buffer.from(await this.ctx.client.downloadBlob(this.canvasId, current.blobHash)).toString("utf8"));
    const name = doc.tokens.name ?? system.title;
    if (lent?.style?.source === "design-system") {
      const m: Mapping = { ...base, name, roles: lent.style.roles, how: "reused", ...(lent.style.by ? { by: lent.style.by } : {}) };
      this.mappings.set(key, m);
      return m;
    }
    const candidates = candidatesOf(doc);
    const request = mappingRequest(doc, candidates);
    let response: JevResponse = { answers: {} };
    let ms: number | undefined;
    let by: string | undefined;
    const asking = Object.keys(request.questions).length > 0;
    if (asking) {
      const answered = await this.answerer.answer(request);
      response = answered.response;
      ms = answered.ms;
      by = answered.by;
      this.by = answered.by;
      this.calls += 1;
      this.inputTokens += response.usage?.input_tokens ?? 0;
      if (this.save) {
        await mkdir(this.save, { recursive: true });
        const stem = path.join(this.save, `style-${system.id}-${current.id}`);
        await writeFile(`${stem}.request.json`, JSON.stringify(request, null, 2));
        await writeFile(`${stem}.response.json`, JSON.stringify(response, null, 2));
      }
    }
    const m: Mapping = { ...base, name, roles: applyMapping(request, response, candidates), how: asking ? "asked" : "nothing to ask", request, response, ...(ms !== undefined ? { ms } : {}), ...(by ? { by } : {}) };
    this.mappings.set(key, m);
    return m;
  }

  /** Who answers — the versioned model once one has, else the answerer's name. */
  get who(): string {
    return this.by || this.answerer.name;
  }

  cost(): number {
    return this.inputTokens * JEV_INPUT_PRICE;
  }
}

/**
 * The answerer a mapping asks: `--answerer` if given (jev or stub — an agent
 * answers rounds, not this), else Jev when the key is set, else the stub —
 * whose flat distributions keep every asked role at the default, which is
 * the honest thing for a stand-in to do with a brand.
 */
export function mappingAnswerer(name: string | undefined, seed = 1): Answerer {
  const key = process.env.TYPESAFE_API_KEY;
  const chosen = name === undefined || name === "agent" ? (key ? "jev" : "stub") : name;
  if (chosen === "jev") return jevAnswerer({ key });
  if (chosen === "stub") return stubAnswerer(seed);
  throw new Error(`--answerer must be jev or stub for a style mapping — got: ${chosen}`);
}

/** A mapping, for a person: which system, how it was found, one line per role. */
export function mappingLines(m: Mapping, by: string): string[] {
  const how = m.how === "asked" ? `mapped by ${m.by ?? by}${m.ms !== undefined ? ` in ${m.ms} ms` : ""}` : m.how === "reused" ? `mapping (by ${m.by ?? "nobody — nothing to ask"}) reused from a wire already in this version — nothing asked` : "every role had one candidate or none — nothing asked";
  return [
    `"${m.name}" — ${m.system.id}, version ${m.version} of ${m.versions} · ${how}`,
    ...ROLES.map((role) => `  ${roleLine(role, m.roles[role])}`),
  ];
}

interface Target {
  screen: Screen;
  item: Item;
  system: Item | null;
  style: WireStyle;
}

type CheckState = "current" | "behind" | "other system" | "not in it yet" | "no system governs";

function checkState(spec: WireSpec, system: Item | null): CheckState {
  const s = spec.style;
  if (!system) return s?.source === "design-system" ? "no system governs" : "current";
  if (s?.source !== "design-system") return "not in it yet";
  if (s.itemId !== system.id) return "other system";
  return s.versionId === system.currentVersionId ? "current" : "behind";
}

export function registerStyle(host: CliHost, wire: Command): void {
  const { run, ctxOf, resolveCanvas, sendOp, printJson } = host;

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
        const snapshot = await ctx.client.snapshot(p.id);
        const all = await wiresOn(ctx, p.id, snapshot);
        const screens = opts.flow === undefined ? all : all.filter((s) => s.spec.flow === opts.flow);
        if (screens.length === 0) {
          throw new Error(opts.flow === undefined ? "no wireframe on this canvas — `isocan wire \"<request>\"` composes some" : `no wireframe in flow "${opts.flow}" on this canvas`);
        }
        const itemOf = (s: Screen) => snapshot.canvas.items[s.item]!;

        if (opts.check) return check(snapshot, screens.map((s) => ({ screen: s, item: itemOf(s) })), ctx.json, printJson, say);

        const resolver = new StyleResolver(ctx, p.id, mappingAnswerer(opts.answerer, Number(opts.seed ?? 1)), async () => all.map((s) => s.spec), opts.save);
        const targets: Target[] = [];
        for (const s of screens) {
          const item = itemOf(s);
          const system = opts.default ? null : governingSystem(snapshot.canvas, item);
          targets.push({ screen: s, item, system, style: await resolver.styleFor(system) });
        }
        const group = newGroupId();
        const changed: Target[] = [];
        for (const t of targets) {
          if (sameStyle(t.screen.spec.style, t.style)) continue;
          const spec: WireSpec = { ...t.screen.spec, style: t.style };
          const html = renderWire(spec);
          const filename = t.item.versions.find((v) => v.id === t.item.currentVersionId)?.filename ?? "wireframe.html";
          const upload = await ctx.client.uploadBlob(p.id, Buffer.from(html, "utf8"), "text/html", filename);
          await sendOp(ctx, p.id, { type: "item.addVersion", itemId: t.item.id, version: { id: newVersionId(), blobHash: upload.blobHash, mimeType: "text/html", filename, size: upload.size } }, group);
          t.screen = { ...t.screen, spec };
          changed.push(t);
        }
        // A kept flow's prototype plays its screens' look: rebuilt in the same group when one of them changed.
        const prototypes: Array<{ itemId: string; what: string }> = [];
        const touched = new Set(changed.map((t) => t.screen.spec.flow));
        const now = all.map((s) => targets.find((t) => t.screen.item === s.item)?.screen ?? s);
        for (const flow of keptFlowsOf(snapshot, now)) {
          if (!touched.has(flow.flow)) continue;
          if (!Object.values(snapshot.canvas.items).some((i) => i.properties?.[PROTOTYPE_PROP] === flow.flow)) continue;
          const written = await writePrototype(host, ctx, p.id, snapshot, flow, group);
          prototypes.push({ itemId: written.itemId, what: written.what });
        }

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
        const tail = changed.length ? " — one op group: `isocan undo` takes the restyle back" : " — nothing written";
        say(`${changed.length} of ${targets.length} wires restyled · ${targets.length - changed.length} unchanged · ${resolver.calls === 0 ? "nothing asked" : `${resolver.calls} ${resolver.calls === 1 ? "call" : "calls"} to ${by} · ${resolver.inputTokens.toLocaleString("en-US")} input tokens · $${resolver.cost().toFixed(6)}`}${tail}`);
      }),
    );
}

function check(
  snapshot: CanvasSnapshotResponse,
  wires: Array<{ screen: Screen; item: Item }>,
  json: boolean,
  printJson: (v: unknown) => void,
  say: (line: string) => void,
): void {
  const rows = wires.map(({ screen, item }) => {
    const system = governingSystem(snapshot.canvas, item);
    const state = checkState(screen.spec, system);
    const drawnBy = screen.spec.style?.source === "design-system" ? screen.spec.style : null;
    const drawnVersion = drawnBy ? snapshot.canvas.items[drawnBy.itemId]?.versions.findIndex((v) => v.id === drawnBy.versionId) : undefined;
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
