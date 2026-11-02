import { SLOP_RULES, checkDesign, designSystem, parseDesign, proposalMarked, type CanvasContents, type Item } from "@isocan/core";
import type { DeskCheckInput } from "@isocan/core/desk-check";
import type { CanvasDesignAudit } from "./design-audit-reader.ts";

/**
 * **What the desk check needs from a surface** (proactive-agent phase 8):
 * the bytes of a version, the design audit over some screens, the stale
 * receipts, and the wires behind their system. Each client already reads
 * all four its own way — the terminal through its daemon client, the
 * browser through its badge — so this file asks rather than reaches, and
 * says what was found the same way for both.
 */
export interface DeskCheckPort {
  text(blobHash: string): Promise<string>;
  audit(itemIds: readonly string[]): Promise<CanvasDesignAudit>;
  /** Design receipts whose inputs changed since they were written, titled by their output. */
  staleReceipts(): Promise<{ title: string; why: string }[]>;
  /** The wireframe module's reading of wires behind their system (`readWiresBehind`); empty without the module. */
  wiresBehind(canvas: CanvasContents): Promise<{ title: string; system: string }[]>;
}

const CRITIC_CARD = "critique.critic";

/** The screens a desk check reads: HTML items, never a critic's card or an open proposal — the person's work, not the room's. */
function screensOf(canvas: CanvasContents, itemIds?: readonly string[]): Item[] {
  const all = itemIds ? itemIds.flatMap((id) => (canvas.items[id] ? [canvas.items[id]!] : [])) : Object.values(canvas.items);
  return all
    .filter((item) => item.properties[CRITIC_CARD] === undefined && !proposalMarked(item))
    .filter((item) => item.versions.find((v) => v.id === item.currentVersionId)?.mimeType === "text/html")
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

const settled = async <T>(work: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await work();
  } catch {
    return fallback;
  }
};

/**
 * **Read the desk check** — everything but the critics, whom the room
 * module asks (the surface adds them). Every part that cannot be read is
 * left out rather than failing the share: the check reports, it never blocks.
 */
export async function readDeskCheck(port: DeskCheckPort, canvas: CanvasContents, opts: { itemIds?: readonly string[] } = {}): Promise<Omit<DeskCheckInput, "critics">> {
  const screens = screensOf(canvas, opts.itemIds);
  const ids = screens.map((s) => s.id);
  const html = new Map<string, string>();
  await Promise.all(screens.map(async (s) => {
    const v = s.versions.find((x) => x.id === s.currentVersionId)!;
    const text = await settled(() => port.text(v.blobHash), null);
    if (text !== null) html.set(s.id, text);
  }));

  const audit = ids.length ? await settled(() => port.audit(ids), null) : null;
  const auditOut = audit && audit.audited > 0
    ? {
        audited: audit.audited,
        offSystem: audit.offSystem,
        unavailable: audit.unavailable,
        worst: audit.items
          .flatMap((i) => (i.status === "audited" && i.offSystem.length ? [{ title: i.title || i.itemId, count: i.offSystem.reduce((n, o) => n + o.count, 0) }] : []))
          .sort((a, b) => b.count - a.count),
      }
    : null;

  // Each governing system once: its contrast, and the first one's Voice for the words.
  const systems = new Map<string, Item>();
  for (const s of screens) {
    const sys = designSystem(canvas, { at: s });
    if (sys) systems.set(sys.id, sys);
  }
  const docs = new Map<string, ReturnType<typeof parseDesign>>();
  await Promise.all([...systems.values()].map(async (sys) => {
    const v = sys.versions.find((x) => x.id === sys.currentVersionId);
    const text = v ? await settled(() => port.text(v.blobHash), null) : null;
    if (text === null) return;
    try {
      docs.set(sys.id, parseDesign(text));
    } catch {
      // A system that cannot be parsed has no contrast to report; its own check says why.
    }
  }));
  const contrast = [...systems.values()].flatMap((sys) => {
    const doc = docs.get(sys.id);
    if (!doc) return [];
    return checkDesign(doc).filter((f) => /:1 against/.test(f.what)).map((f) => ({ system: doc.tokens.name || sys.title || "the design system", what: `${f.where} is ${f.what}` }));
  });

  const { copyDeck } = await import("@isocan/core/copy-deck");
  const { lintCopy } = await import("@isocan/core/copy-lint");
  const { voiceOf } = await import("@isocan/core/copy-voice");
  const firstSystem = screens[0] ? designSystem(canvas, { at: screens[0] }) : null;
  const firstDoc = firstSystem ? docs.get(firstSystem.id) : undefined;
  const voice = firstDoc ? voiceOf(firstDoc) : null;
  const lintable = screens.flatMap((s) => (html.has(s.id) ? [{ itemId: s.id, title: s.title || s.id, deck: copyDeck(html.get(s.id)!) }] : []));
  const findings = lintable.length ? lintCopy(lintable, voice, SLOP_RULES) : [];

  const [behind, stale] = await Promise.all([settled(() => port.wiresBehind(canvas), []), settled(() => port.staleReceipts(), [])]);
  return {
    screens: screens.map((s) => ({ itemId: s.id, title: s.title || s.id })),
    audit: auditOut,
    contrast,
    words: { count: findings.length, first: findings.map((f) => ({ title: f.title ?? "DESIGN.md", what: f.what })), voice: voice !== null },
    behind,
    stale,
  };
}
