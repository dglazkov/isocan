import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  CanvasHandle
} from "./chunk-QZBZBM5T.mjs";
import "./chunk-GLFPXY6L.mjs";
import "./chunk-7YNMPWOI.mjs";
import "./chunk-TYWDA5GB.mjs";
import {
  readDesignAudit
} from "./chunk-CT3ZCUMQ.mjs";
import "./chunk-23YWZGSS.mjs";
import "./chunk-K7FYWFKY.mjs";
import "./chunk-JF7OF6DS.mjs";
import "./chunk-PKQBK4R5.mjs";
import "./chunk-VLEENS5W.mjs";
import "./chunk-EMHSTYIZ.mjs";
import "./chunk-MTUDTMGH.mjs";
import "./chunk-U4ZPMZI4.mjs";
import "./chunk-MU5RUB2A.mjs";
import "./chunk-4CEDV3WZ.mjs";
import {
  SLOP_RULES,
  checkDesign,
  designSystem,
  proposalMarked
} from "./chunk-K4X2FIZO.mjs";
import "./chunk-GUY4UN4O.mjs";
import {
  parseDesign
} from "./chunk-K4TDP4L5.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/api/src/desk-check-reader.ts
var CRITIC_CARD = "critique.critic";
function screensOf(canvas, itemIds) {
  const all = itemIds ? itemIds.flatMap((id) => canvas.items[id] ? [canvas.items[id]] : []) : Object.values(canvas.items);
  return all.filter((item) => item.properties[CRITIC_CARD] === void 0 && !proposalMarked(item)).filter((item) => item.versions.find((v) => v.id === item.currentVersionId)?.mimeType === "text/html").sort((a, b) => a.y - b.y || a.x - b.x);
}
var settled = async (work, fallback) => {
  try {
    return await work();
  } catch {
    return fallback;
  }
};
async function readDeskCheck(port, canvas, opts = {}) {
  const screens = screensOf(canvas, opts.itemIds);
  const ids = screens.map((s) => s.id);
  const html = /* @__PURE__ */ new Map();
  await Promise.all(screens.map(async (s) => {
    const v = s.versions.find((x) => x.id === s.currentVersionId);
    const text = await settled(() => port.text(v.blobHash), null);
    if (text !== null) html.set(s.id, text);
  }));
  const audit = ids.length ? await settled(() => port.audit(ids), null) : null;
  const auditOut = audit && audit.audited > 0 ? {
    audited: audit.audited,
    offSystem: audit.offSystem,
    unavailable: audit.unavailable,
    worst: audit.items.flatMap((i) => i.status === "audited" && i.offSystem.length ? [{ title: i.title || i.itemId, count: i.offSystem.reduce((n, o) => n + o.count, 0) }] : []).sort((a, b) => b.count - a.count)
  } : null;
  const systems = /* @__PURE__ */ new Map();
  for (const s of screens) {
    const sys = designSystem(canvas, { at: s });
    if (sys) systems.set(sys.id, sys);
  }
  const docs = /* @__PURE__ */ new Map();
  await Promise.all([...systems.values()].map(async (sys) => {
    const v = sys.versions.find((x) => x.id === sys.currentVersionId);
    const text = v ? await settled(() => port.text(v.blobHash), null) : null;
    if (text === null) return;
    try {
      docs.set(sys.id, parseDesign(text));
    } catch {
    }
  }));
  const contrast = [...systems.values()].flatMap((sys) => {
    const doc = docs.get(sys.id);
    if (!doc) return [];
    return checkDesign(doc).filter((f) => /:1 against/.test(f.what)).map((f) => ({ system: doc.tokens.name || sys.title || "the design system", what: `${f.where} is ${f.what}` }));
  });
  const { copyDeck } = await import("./copy-deck-LE4SEQIL.mjs");
  const { lintCopy } = await import("./copy-lint-WQOEOLHB.mjs");
  const { voiceOf } = await import("./copy-voice-GCE26JCB.mjs");
  const firstSystem = screens[0] ? designSystem(canvas, { at: screens[0] }) : null;
  const firstDoc = firstSystem ? docs.get(firstSystem.id) : void 0;
  const voice = firstDoc ? voiceOf(firstDoc) : null;
  const lintable = screens.flatMap((s) => html.has(s.id) ? [{ itemId: s.id, title: s.title || s.id, deck: copyDeck(html.get(s.id)) }] : []);
  const findings = lintable.length ? lintCopy(lintable, voice, SLOP_RULES) : [];
  const [behind, stale] = await Promise.all([settled(() => port.wiresBehind(canvas), []), settled(() => port.staleReceipts(), [])]);
  return {
    screens: screens.map((s) => ({ itemId: s.id, title: s.title || s.id })),
    audit: auditOut,
    contrast,
    words: { count: findings.length, first: findings.map((f) => ({ title: f.title ?? "DESIGN.md", what: f.what })), voice: voice !== null },
    behind,
    stale
  };
}

// packages/core/src/desk-check.ts
var plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
function deskCheckSections(input) {
  const n = input.screens.length;
  const out = [];
  const a = input.audit;
  out.push(
    !a ? { key: "audit", heading: "Design audit", ok: true, lines: [n ? "no screen here is governed by a design system to audit against" : "no screens to audit"] } : a.offSystem === 0 ? { key: "audit", heading: "Design audit", ok: true, lines: [`${plural(a.audited, "screen")}, every value from the system${a.unavailable ? ` (${a.unavailable} could not be read)` : ""}`] } : { key: "audit", heading: "Design audit", ok: false, lines: [`${plural(a.offSystem, "value")} the system never named`, ...a.worst.slice(0, 3).map((w2) => `\u201C${w2.title}\u201D: ${plural(w2.count, "off-system value")}`)] }
  );
  out.push(input.contrast.length ? { key: "contrast", heading: "Contrast", ok: false, lines: input.contrast.slice(0, 3).map((c) => `${c.system}: ${c.what}`) } : { key: "contrast", heading: "Contrast", ok: true, lines: ["the design system's ink and accent clear their grounds"] });
  const w = input.words;
  out.push(w.count ? { key: "words", heading: "Words", ok: false, lines: [`${plural(w.count, "finding")}${w.voice ? ", held to DESIGN.md's Voice" : ""}`, ...w.first.slice(0, 3).map((f) => `\u201C${f.title}\u201D: ${f.what}`)] } : { key: "words", heading: "Words", ok: true, lines: [n ? `nothing to fix${w.voice ? " against DESIGN.md's Voice" : " (no Voice section to hold them to)"}` : "no screens' words to read"] });
  out.push(input.behind.length ? { key: "behind", heading: "Wires behind the design system", ok: false, lines: input.behind.slice(0, 4).map((b) => `\u201C${b.title}\u201D was drawn from an older ${b.system}`) } : { key: "behind", heading: "Wires behind the design system", ok: true, lines: ["none"] });
  out.push(input.stale.length ? { key: "stale", heading: "Stale receipts", ok: false, lines: input.stale.slice(0, 4).map((s) => `\u201C${s.title}\u201D: ${s.why}`) } : { key: "stale", heading: "Stale receipts", ok: true, lines: ["none"] });
  out.push(input.critics.length ? {
    key: "critics",
    heading: "Critics before you share",
    ok: true,
    lines: input.critics.map((c) => c.asked ? `${c.agentName} \u2014 asked to read ${n === 1 ? "it" : `these ${n} screens`}; its notes land as pins` : `${c.agentName} waits: ${c.why ?? "nothing can wear it here"}`)
  } : { key: "critics", heading: "Critics before you share", ok: true, lines: ["none set to before I share"] });
  return out;
}
function deskCheckSummary(sections) {
  const look = sections.filter((s) => !s.ok).length;
  return `Desk check before you share: ${look ? `${plural(look, "thing")} to look at` : "nothing to look at"} \u2014 it reports; it never blocks.`;
}
var DESK_CHECK_WALK = 'Not part of this check: a walk \u2014 `isocan walk <flow> --task "\u2026"` \u2014 walks it as someone else (simulations, never a gate).';
function deskCheckFindings(sections) {
  return sections.filter((s) => !s.ok).map((s) => `${s.heading}: ${s.lines.join("; ")}.`);
}

// packages/cli/src/desk-check.ts
async function deskCheck(ctx, deps, canvas, snapshot, itemIds) {
  try {
    const handle = new CanvasHandle(ctx, canvas);
    const found = await readDeskCheck(
      {
        text: async (hash) => (await ctx.client.downloadBlob(canvas.id, hash)).toString("utf8"),
        audit: (ids) => readDesignAudit(ctx, canvas.id, { itemIds: [...ids] }, snapshot),
        staleReceipts: async () => {
          const rows = (await handle.designBrief({})).requests;
          return rows.flatMap((row) => row.receipts.filter((r) => r.status === "stale").map((r) => {
            const out = r.receipt.output.kind === "canvas" ? snapshot.canvas.items[r.receipt.output.artifact.itemId]?.title : void 0;
            return { title: out || row.brief.primaryTask || row.brief.requestId, why: r.reasons[0] ?? "its inputs changed since it was written" };
          }));
        },
        wiresBehind: async (c) => {
          const read = async (hash) => (await ctx.client.downloadBlob(canvas.id, hash)).toString("utf8");
          const parts = deps.modules.flatMap((m) => m.deskCheck?.behind ? [m.deskCheck.behind] : []);
          return (await Promise.all(parts.map((behind) => behind(c, read).catch(() => [])))).flat();
        }
      },
      snapshot.canvas,
      itemIds ? { itemIds } : {}
    );
    const bare = deskCheckSections({ ...found, critics: [] });
    const asks = deps.modules.flatMap((m) => m.deskCheck?.critics ? [m.deskCheck.critics] : []);
    const critics = (await Promise.all(asks.map((ask) => ask(deps.host, ctx, canvas, snapshot, found.screens.map((s) => s.itemId), deskCheckFindings(bare)).catch((err) => [{ agentName: "The critics", asked: false, why: err instanceof Error ? err.message : String(err) }])))).flat();
    const input = { ...found, critics };
    const sections = deskCheckSections(input);
    return { input, sections, summary: deskCheckSummary(sections) };
  } catch (err) {
    return { failed: err instanceof Error ? err.message : String(err) };
  }
}
function printDeskCheck(check) {
  if ("failed" in check) {
    console.log(`Desk check could not run (${check.failed}) \u2014 the share goes ahead; it never blocks.`);
    return;
  }
  console.log(check.summary);
  for (const s of check.sections) {
    const [first, ...rest] = s.lines;
    console.log(`  ${s.key === "critics" ? "\xB7" : s.ok ? "\u2713" : "!"} ${s.heading}: ${first ?? ""}`);
    for (const line of rest) console.log(`      ${line}`);
  }
  console.log(`  \xB7 ${DESK_CHECK_WALK}`);
  console.log("");
}
export {
  deskCheck,
  printDeskCheck
};
