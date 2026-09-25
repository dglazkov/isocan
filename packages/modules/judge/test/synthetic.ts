import type { Actor, LogEntry, Operation } from "@isocan/core";
import { KEEP_BY_PROP, KEEP_PROP, WIRE_MARKER, WIRE_SCRIPT_ID } from "../src/wire-format.ts";

/**
 * **A synthetic canvas's oplog, written the way the wireframe flow writes
 * one** — every name made up. The composer's ops go out as the person who
 * asked, under the flow's id as their op group; round 1 turns a blueprint
 * into a screen by `item.addVersion`; a maybe carries `wireMaybe` on its
 * `item.add`; the flow's own picks are `item.update`s signed with the
 * answerer's name in the same group. A person's keep is signed with their
 * id, in a group of its own; an undo is the stored inverse, with `cause`.
 */

export const CANVAS = "prj_acme";
export const PERSON: Actor = { id: "act_acme_person", name: "Acme Person" };
export const COLLABORATOR: Actor = { id: "act_acme_collab", name: "Acme Collaborator" };

export interface SyntheticSpec {
  request: string;
  flow: string;
  archetype: string;
  title: string;
  need?: number;
  maybe?: true;
  variantOf?: string;
  by?: { answerer: string; model?: string };
  round?: number;
}

/** A wire's file, in the stored format: the marker, and the spec in its script. */
export function wireHtml(spec: SyntheticSpec): string {
  return `<!doctype html>\n${WIRE_MARKER}\n<html lang="en">\n<head>\n<title>${spec.title}</title>\n<script type="application/json" id="${WIRE_SCRIPT_ID}">${JSON.stringify({ v: 1, platform: "app", slots: [], ...spec })}</script>\n</head>\n<body class="screen"></body>\n</html>\n`;
}

export class SyntheticCanvas {
  readonly entries: LogEntry[] = [];
  readonly blobs = new Map<string, string>();
  private seq = 0;
  private clock = Date.UTC(2026, 8, 24, 12, 0, 0);

  /** Append one entry; returns its seq. */
  push(op: Operation, actor: Actor, opts: { group?: string; cause?: LogEntry["cause"] } = {}): number {
    this.seq += 1;
    this.clock += 60_000;
    this.entries.push({
      seq: this.seq,
      envelope: { id: `op_acme_${this.seq}`, canvasId: CANVAS, actor, ts: new Date(this.clock).toISOString(), op },
      inverse: null,
      ...(opts.group ? { group: opts.group } : {}),
      ...(opts.cause ? { cause: opts.cause } : {}),
    });
    return this.seq;
  }

  private version(spec: SyntheticSpec) {
    const hash = `blob_acme_${this.blobs.size + 1}`;
    this.blobs.set(hash, wireHtml(spec));
    return { id: `ver_acme_${this.blobs.size}`, blobHash: hash, mimeType: "text/html", filename: "acme.html", size: 1 };
  }

  /** `item.add` of a wire — its first version, in `group` when the flow drew it. Returns the add's seq. */
  add(itemId: string, spec: SyntheticSpec, actor: Actor, group: string | undefined, properties: Record<string, string> = {}): number {
    return this.push(
      { type: "item.add", itemId, version: this.version(spec), width: 390, height: 844, placement: { x: 0, y: 0 } as never, title: spec.title, properties: { fidelity: "wireframe", ...properties } },
      actor,
      group ? { group } : {},
    );
  }

  addVersion(itemId: string, spec: SyntheticSpec, actor: Actor, group?: string): number {
    return this.push({ type: "item.addVersion", itemId, version: this.version(spec) }, actor, group ? { group } : {});
  }

  keep(itemId: string, actor: Actor, who: string, group: string): number {
    return this.push({ type: "item.update", itemId, patch: { properties: { [KEEP_PROP]: "yes", [KEEP_BY_PROP]: who } } }, actor, { group });
  }

  unkeep(itemId: string, actor: Actor, group: string): number {
    return this.push({ type: "item.update", itemId, patch: { removeProperties: [KEEP_PROP, KEEP_BY_PROP] } }, actor, { group });
  }

  remove(itemId: string, actor: Actor, group: string): number {
    return this.push({ type: "item.delete", itemId }, actor, { group });
  }

  /** An undo: the stored inverse, by the undoer, pointing at what it reverses. Inverses carry no group. */
  undo(targetSeq: number, inverse: Operation, actor: Actor): number {
    return this.push(inverse, actor, { cause: { kind: "undo", targetSeq } });
  }

  /** The spec reader the CLI would run over these blobs. */
  readText(hash: string): string {
    const text = this.blobs.get(hash);
    if (text === undefined) throw new Error(`no blob ${hash}`);
    return text;
  }
}

/** A composed flow: the first screen born a blueprint (no `need`), every screen then versioned at round 1 with it. */
export function drawFlow(
  c: SyntheticCanvas,
  flow: string,
  request: string,
  screens: Array<{ itemId: string; archetype: string; title: string; need: number; variantOf?: string }>,
  opts: { by?: SyntheticSpec["by"]; autoKeep?: boolean; asker?: Actor } = {},
): Record<string, number> {
  const asker = opts.asker ?? PERSON;
  const adds: Record<string, number> = {};
  const base = { request, flow };
  for (const [i, s] of screens.entries()) {
    const maybe = !s.variantOf && s.need < 0.5 ? ({ maybe: true } as const) : {};
    const round1: SyntheticSpec = { ...base, archetype: s.archetype, title: s.title, need: s.need, ...maybe, ...(s.variantOf ? { variantOf: s.variantOf } : {}), ...(opts.by ? { by: opts.by } : {}), round: 1 };
    if (i === 0) {
      adds[s.itemId] = c.add(s.itemId, { ...base, archetype: s.archetype, title: request, round: 0 }, asker, flow);
      c.addVersion(s.itemId, round1, asker, flow);
      if (maybe.maybe) c.push({ type: "item.update", itemId: s.itemId, patch: { properties: { wireMaybe: s.need.toFixed(2) } } }, asker, { group: flow });
    } else {
      adds[s.itemId] = c.add(s.itemId, round1, asker, flow, maybe.maybe ? { wireMaybe: s.need.toFixed(2) } : {});
    }
    // Rounds 2 and 3 version the screen in place; `need` rides every version.
    c.addVersion(s.itemId, { ...round1, round: 3 }, asker, flow);
  }
  if (opts.autoKeep !== false) {
    const answerer = opts.by?.answerer === "stub" ? "stub" : "jev";
    for (const s of screens) if (!s.variantOf && s.need >= 0.5) adds[`keep:${s.itemId}`] = c.keep(s.itemId, asker, answerer, flow);
  }
  return adds;
}

export const FLOW = "grp_acme_desks";
export const REQUEST = "An Acme app for booking a desk";

/**
 * **The Acme canvas**: every case phase 1 names, and the ones a fold that
 * only handled those would get wrong (`corpus.test.ts` says which is which).
 */
export function acmeCanvas(): SyntheticCanvas {
  const c = new SyntheticCanvas();
  drawFlow(c, FLOW, REQUEST, [
    { itemId: "itm_acme_list", archetype: "list", title: "Acme List", need: 0.82 },
    { itemId: "itm_acme_detail", archetype: "detail", title: "Acme Detail", need: 0.41 },
    { itemId: "itm_acme_settings", archetype: "settings", title: "Acme Settings", need: 0.35 },
    { itemId: "itm_acme_home", archetype: "home", title: "Acme Home", need: 0.9 },
    { itemId: "itm_acme_search", archetype: "search", title: "Acme Search", need: 0.33 },
    { itemId: "itm_acme_profile", archetype: "profile", title: "Acme Profile", need: 0.45 },
    { itemId: "itm_acme_form", archetype: "form", title: "Acme Form", need: 0.7 },
    { itemId: "itm_acme_form_v", archetype: "form", title: "Acme Form · card", need: 0.7, variantOf: "itm_acme_form" },
    { itemId: "itm_acme_cart", archetype: "cart", title: "Acme Cart", need: 0.55 },
    { itemId: "itm_acme_about", archetype: "about", title: "Acme About", need: 0.38 },
  ], { by: { answerer: "jev", model: "jev-1.13.0" } });

  // Flow-kept, then the person's unkeep: taken out.
  c.unkeep("itm_acme_list", PERSON, "grp_acme_g1");
  // A maybe, then the person's keep: kept — and the maybe property lies about P, which must not matter.
  c.push({ type: "item.update", itemId: "itm_acme_detail", patch: { properties: { wireMaybe: "0.99" } } }, COLLABORATOR, { group: "grp_acme_g2" });
  c.keep("itm_acme_detail", PERSON, PERSON.id, "grp_acme_g3");
  // Settings: untouched. Home: the answerer's keep alone.
  // A collaborator's keep: no label.
  c.keep("itm_acme_search", COLLABORATOR, COLLABORATOR.id, "grp_acme_g4");
  // A keep signed by an answerer, sent outside the flow's group by the person's own client: still the machine's.
  c.keep("itm_acme_profile", PERSON, "agent", "grp_acme_g5");
  // A swap: Jev's pick out, its variation in — the row stays in the prototype, so no label on need.
  c.unkeep("itm_acme_form", PERSON, "grp_acme_g6");
  c.keep("itm_acme_form_v", PERSON, PERSON.id, "grp_acme_g6");
  // Deleted by the person: taken out.
  c.remove("itm_acme_cart", PERSON, "grp_acme_g7");
  // Kept, then the keep undone: they ended where the flow did.
  const kept = c.keep("itm_acme_about", PERSON, PERSON.id, "grp_acme_g8");
  c.undo(kept, { type: "item.update", itemId: "itm_acme_about", patch: { removeProperties: ["wireKeep", "wireKeepBy"] } }, PERSON);

  // A flow from before `need`: kept by the person, and not in the corpus.
  c.add("itm_acme_old", { request: "An Acme app, before", flow: "grp_acme_old", archetype: "list", title: "Acme Old", round: 3 }, PERSON, "grp_acme_old");
  c.keep("itm_acme_old", PERSON, PERSON.id, "grp_acme_g9");

  // A flow undone whole: its screens are withdrawn, not taken out.
  const undone = drawFlow(c, "grp_acme_undone", "An Acme app, undone", [
    { itemId: "itm_acme_gone", archetype: "list", title: "Acme Gone", need: 0.6 },
  ], { by: { answerer: "stub", model: "stub (seed 4)" } });
  c.undo(undone["keep:itm_acme_gone"]!, { type: "item.update", itemId: "itm_acme_gone", patch: { removeProperties: ["wireKeep", "wireKeepBy"] } }, PERSON);
  c.undo(undone.itm_acme_gone!, { type: "item.delete", itemId: "itm_acme_gone" }, PERSON);

  // A spec with `need`, rendered by hand rather than drawn by a flow here.
  c.add("itm_acme_hand", { request: "An Acme app, by hand", flow: "grp_acme_hand", archetype: "list", title: "Acme Hand", need: 0.5 }, PERSON, "grp_acme_g10");

  // A basic flow (nothing auto-kept), drawn before `by` landed: a sure screen the person keeps.
  drawFlow(c, "grp_acme_basic", "An Acme app, basic", [
    { itemId: "itm_acme_basic", archetype: "list", title: "Acme Basic", need: 0.77 },
  ], { autoKeep: false });
  c.keep("itm_acme_basic", PERSON, PERSON.id, "grp_acme_g11");

  // A flow the person never opened: every row none, and not engaged.
  drawFlow(c, "grp_acme_ignored", "An Acme app, never opened", [
    { itemId: "itm_acme_quiet", archetype: "list", title: "Acme Quiet", need: 0.66 },
    { itemId: "itm_acme_quieter", archetype: "detail", title: "Acme Quieter", need: 0.31 },
  ], { by: { answerer: "stub", model: "stub (seed 2)" } });
  return c;
}
