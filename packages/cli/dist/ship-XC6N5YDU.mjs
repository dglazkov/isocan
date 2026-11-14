import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  grantedWrite
} from "./chunk-D2TJMLLO.mjs";
import {
  core
} from "./chunk-QSPCCLE6.mjs";
import "./chunk-JYOOXWJZ.mjs";

// packages/modules/exact/src/release.ts
var EXACT_LANE_MIME = "application/vnd.isocan.exact-lane+json";
var agentRefusal = (name) => `${name} is an agent, and only a person ships: an agent may prepare a release, and a person on this machine confirms and ships it.`;
var grantRefusal = (name) => `${name} has read scope on this machine, and only its owner or someone it granted (ISOCAN_EXACT_GRANT) ships: ${name} may prepare a release, and the owner confirms and ships it.`;
var PHASED_NOTE = "app.json asks for a phased rollout; Exact's publisher stages none (deploy.phased is schema only), so every device on this channel takes it at its next check";
var OTA_CHANGE = (c) => `${c.name} ${c.change}${c.note ? ` (${c.note})` : ""}`;
function classify(table) {
  const out = { ota: [], binary: [], current: [], unavailable: [], changes: 0 };
  for (const r of table.rows) {
    const platform = r.platform ?? (r.kind === "origin" ? "web root" : "?");
    const stream = r.compatibilityId ? r.compatibilityId.slice(0, 8) : "";
    if (r.kind === "origin") {
      const f = r.files ?? { new: [], changed: [], current: [] };
      const moved = [...f.new.map((n) => `${n} new`), ...f.changed.map((n) => `${n} changed`), ...(f.removed ?? []).map((n) => `${n} removed`)];
      if (r.action === "publish") {
        out.ota.push({ platform, stream: "web root", seq: null, changes: moved });
        out.changes += moved.length;
      } else if (r.action === "unavailable") out.unavailable.push({ platform, reason: r.reason ?? "unavailable" });
      continue;
    }
    if (r.action === "bundle") {
      const changes = (r.changes ?? []).map(OTA_CHANGE);
      out.ota.push({ platform, stream, seq: r.seq ?? null, changes });
      out.changes += changes.length;
    } else if (r.action === "binary") out.binary.push({ platform, stream: stream || null, reason: r.reason ?? "Exact gave no reason" });
    else if (r.action === "current") out.current.push({ platform, stream, seq: r.seq ?? r.head?.seq ?? null });
    else out.unavailable.push({ platform, reason: r.reason ?? r.action });
  }
  return out;
}
function classificationLine(c) {
  const parts = [];
  if (c.ota.length) parts.push(`${c.changes} change${c.changes === 1 ? "" : "s"} over the air (${c.ota.map((o) => `${o.platform}${o.stream ? ` ${o.stream}` : ""}${o.seq != null ? ` \u2192 seq ${o.seq}` : ""}`).join(", ")})`);
  if (c.binary.length) parts.push(`${c.binary.length} need${c.binary.length === 1 ? "s" : ""} a binary`);
  if (!c.ota.length && !c.binary.length) parts.push("nothing to ship: every stream is current");
  if (c.unavailable.length) parts.push(`${c.unavailable.length} unavailable`);
  return parts.join("; ");
}
function preparedMarkdown(r, appName) {
  const c = r.classification;
  const lines = [
    `# Prepared: ${appName} \u2192 ${r.channel}`,
    "",
    `Exact's dry run (\`deploy.mjs --json\`), ${r.at.slice(0, 16).replace("T", " ")} for ${r.by}: release ${r.release}, snapshot ${r.snapshot.slice(0, 12)}${r.dirty ? " (DIRTY)" : ""}, origin ${r.origin}. Nothing was uploaded.`,
    "",
    `**${classificationLine(c)}**`,
    ""
  ];
  if (c.ota.length) {
    lines.push("## Over the air", "");
    for (const o of c.ota) lines.push(`- ${o.platform}${o.stream ? ` stream ${o.stream}` : ""}${o.seq != null ? `, as seq ${o.seq}` : ""}: ${o.changes.join(", ") || "no change"}`);
    lines.push("");
  }
  if (c.binary.length) {
    lines.push("## Needs a binary", "");
    for (const b of c.binary) lines.push(`- ${b.platform}${b.stream ? ` ${b.stream}` : ""}: ${b.reason}`);
    lines.push("");
  }
  if (c.current.length) lines.push(`Current: ${c.current.map((x) => `${x.platform} ${x.stream}${x.seq != null ? ` at seq ${x.seq}` : ""}`).join(", ")}.`, "");
  for (const u of c.unavailable) lines.push(`Unavailable: ${u.platform} \u2014 ${u.reason}`);
  for (const n of r.notes) lines.push(`> ${n}`);
  lines.push("", `${originLine(r)}.`);
  return lines.join("\n") + "\n";
}
function originLine(r) {
  const { before, after } = r.originHash;
  if (before === null || after === null) return `origin not hashed: ${r.channel} names ${r.origin}; set ISOCAN_EXACT_ORIGIN to the directory that host serves to prove nothing was uploaded`;
  return `origin ${before.slice(0, 16)} before, ${after.slice(0, 16)} after \u2014 ${before === after ? "unchanged, nothing uploaded" : "CHANGED"}`;
}
var KIND_WORD = { ship: "Shipped", promote: "Promoted", rollback: "Rolled back" };
function releaseMarkdown(r, appName) {
  const lines = [
    `# ${KIND_WORD[r.kind]}: ${appName} \u2192 ${r.channel}`,
    "",
    r.kind === "rollback" ? `A roll back: the content of ${r.of} re-published at a new sequence number (Exact has no publisher rollback; a client's anti-rollback floor only moves forward).` : r.kind === "promote" ? `The content of ${r.of}, promoted to ${r.channel}.` : `Signed and published by Exact's \`deploy.mjs --yes\` with the keys on ${r.by}'s machine.`,
    "",
    `Release ${r.release}, snapshot ${r.snapshot.slice(0, 12)}, by ${r.by}, ${r.at.slice(0, 19).replace("T", " ")}; origin ${r.origin}.`,
    ""
  ];
  for (const h of r.heads) lines.push(`- ${h.platform} stream ${h.stream}: head seq ${h.seq} (${h.sha256.slice(0, 12)}), previous ${h.previous ? h.previous.slice(0, 12) : "none"}`);
  for (const x of r.refused) lines.push(`- ${x.platform}: refused, needs a binary \u2014 ${x.reason}`);
  for (const f of r.failed) lines.push(`- FAILED: ${f}`);
  if (!r.heads.length && !r.refused.length && !r.failed.length) lines.push("- nothing written: every stream was current");
  if (r.phased.asked) lines.push("", `Phased: ${r.phased.note}.`);
  if (r.changed.length) {
    lines.push("", "## Screens it changed", "");
    for (const s of r.changed) lines.push(`- ${s.title}: ${s.before ? `version ${s.before} \u2192 ` : ""}version ${s.after}`);
  }
  return lines.join("\n") + "\n";
}
function changedScreens(now, previous) {
  if (!previous) return [];
  return Object.entries(now).filter(([itemId, s]) => previous[itemId] !== void 0 && previous[itemId] !== s.version).map(([itemId, s]) => ({ itemId, title: s.title, before: previous[itemId] ?? null, after: s.version }));
}
var parse = (raw, ok) => {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && ok(v) ? v : null;
  } catch {
    return null;
  }
};
var parsePrepared = (raw) => parse(raw, (v) => typeof v.channel === "string" && typeof v.snapshot === "string" && !!v.classification);
var parseRelease = (raw) => parse(raw, (v) => typeof v.channel === "string" && typeof v.release === "string" && Array.isArray(v.heads));
var parseShipAsk = (raw) => parse(raw, (v) => typeof v.seq === "number" && typeof v.channel === "string" && ["ship", "promote", "rollback"].includes(v.kind));
var parseShipAnswer = (raw) => parse(raw, (v) => typeof v.seq === "number" && typeof v.ok === "boolean");
var parsePrepareAsk = (raw) => parse(raw, (v) => typeof v.seq === "number" && typeof v.channel === "string");
var parsePrepareAnswer = (raw) => parse(raw, (v) => typeof v.seq === "number" && typeof v.ok === "boolean");
var parseLane = (text) => parse(text, (v) => v.format === 1 && Array.isArray(v.channels));
function preparedRecord(r, by, at) {
  const t = r.table;
  return {
    channel: r.channel,
    release: t.release,
    snapshot: t.snapshot.id,
    commit: t.snapshot.commit,
    dirty: t.snapshot.dirty,
    origin: t.origin.location,
    classification: classify(t),
    // Exact's notes, bounded: its --dirty note lists the ignored files it captured.
    notes: t.notes.map((n) => n.length > 400 ? `${n.slice(0, 400)}\u2026` : n),
    originHash: r.originHash,
    by,
    at,
    ms: r.ms
  };
}
var LANE_SIZE = (channels) => ({ width: 380, height: 120 + ROW * Math.max(1, channels) });
var ROW = 320;
var CARD = { width: 520, height: 300 };
function cardAt(lane, row, index) {
  return { x: Math.round(lane.x + 420 + index * (CARD.width + 40)), y: Math.round(lane.y + 100 + row * ROW) };
}

// packages/modules/exact/src/ship.ts
var id = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
var P = () => core.EXACT_PROPS;
var currentVersion = (item) => item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1);
var isAgent = (snapshot, actorId) => !!snapshot.canvas.agents?.[actorId];
function laneItemOf(snapshot, appId) {
  return Object.values(snapshot.canvas.items).find((i) => core.appIdOf(i) === appId && currentVersion(i)?.mimeType === EXACT_LANE_MIME) ?? null;
}
function cardsOf(snapshot, appId) {
  const items = Object.values(snapshot.canvas.items).filter((i) => core.appIdOf(i) === appId);
  const prepared = items.flatMap((i) => {
    const r = parsePrepared(i.properties?.[P().classification]);
    return r ? [{ item: i, record: r }] : [];
  }).sort((a, b) => a.record.at.localeCompare(b.record.at));
  const releases = items.flatMap((i) => {
    const r = parseRelease(i.properties?.[P().release]);
    return r ? [{ item: i, record: r }] : [];
  }).sort((a, b) => a.record.at.localeCompare(b.record.at));
  return { prepared, releases };
}
function screensNow(snapshot, appId) {
  const pick = Object.values(snapshot.canvas.items).filter((i) => core.appIdOf(i) === appId && i.properties?.[P().route] && !i.properties?.[P().branch] && (i.properties?.[P().device] ?? "phone") === "phone" && (i.properties?.[P().scheme] ?? "light") === "light");
  return Object.fromEntries(pick.flatMap((i) => {
    const v = currentVersion(i);
    return v ? [[i.id, { title: i.title, version: v.id }]] : [];
  }));
}
async function upsertLane(kit, host, ctx, canvasId, lane) {
  const snapshot = await ctx.client.snapshot(canvasId);
  const existing = laneItemOf(snapshot, lane.app.id);
  const mine = Object.values(snapshot.canvas.items).filter((i) => core.appIdOf(i) === lane.app.id && !parseRelease(i.properties?.[P().release]) && !parsePrepared(i.properties?.[P().classification]));
  const right = mine.length ? Math.max(...mine.map((i) => i.x + i.width)) : 0;
  const top = mine.length ? Math.min(...mine.map((i) => i.y)) : 0;
  const facts = { format: 1, app: lane.app, platform: lane.platform, channels: lane.channels, baked: lane.baked, activate: lane.activate, interval: lane.interval, signing: lane.signing };
  const size = LANE_SIZE(lane.channels.length);
  const { itemId } = await kit.upsert(
    host,
    ctx,
    canvasId,
    snapshot,
    existing,
    { bytes: Buffer.from(JSON.stringify(facts, null, 2) + "\n", "utf8"), mime: EXACT_LANE_MIME, filename: "release-lane.exact-lane.json" },
    { title: `${lane.app.name} \u2014 releases`, ...size, properties: { [P().app]: JSON.stringify({ id: lane.app.id }) }, at: { x: Math.round(right + 600), y: Math.round(top) } },
    id("exact-lane")
  );
  return (await ctx.client.snapshot(canvasId)).canvas.items[itemId];
}
async function postCard(host, ctx, canvasId, lane, laneFacts, channel, text, filename, title, properties) {
  const snapshot = await ctx.client.snapshot(canvasId);
  const row = Math.max(0, laneFacts.channels.findIndex((c) => c.name === channel));
  const { prepared, releases } = cardsOf(snapshot, laneFacts.app.id);
  const inRow = [...prepared, ...releases].filter((c) => c.record.channel === channel).length;
  const put = await ctx.client.uploadBlob(canvasId, Buffer.from(text, "utf8"), "text/markdown", filename);
  const itemId = id("itm");
  await host.sendOp(ctx, canvasId, {
    type: "item.add",
    itemId,
    version: { id: id("ver"), blobHash: put.blobHash, mimeType: "text/markdown", filename, size: put.size },
    width: CARD.width,
    height: CARD.height,
    placement: cardAt(lane, row, inRow),
    title,
    properties: { [P().app]: JSON.stringify({ id: laneFacts.app.id }), ...properties },
    ...snapshot.project.groupMode === "groups" ? { containerId: null, groupPlacement: "exact" } : {}
  }, id("exact-card"));
  return itemId;
}
async function prepareOn(kit, host, ctx, canvasId, app, channel, by, platform) {
  const report = await kit.bridge(host, "prepare", ["--app", app, "--channel", channel, ...platform ? ["--platform", platform] : []], "Exact's dry run", true);
  if (!report.ok || !report.table) return { report, record: null, itemId: null };
  const lane = await upsertLane(kit, host, ctx, canvasId, report.lane);
  const record = preparedRecord(report, by, (/* @__PURE__ */ new Date()).toISOString());
  const itemId = await postCard(host, ctx, canvasId, lane, report.lane, channel, preparedMarkdown(record, report.lane.app.name), `prepared-${channel}-${record.release}.md`, `Prepared \u2192 ${channel}: ${classificationLine(record.classification)}`, { [P().classification]: JSON.stringify(record) });
  return { report, record, itemId };
}
function shipPlan(snapshot, appId, kind, channel, from) {
  const { prepared, releases } = cardsOf(snapshot, appId);
  const onChannel = releases.filter((r) => r.record.channel === channel && r.record.heads.length);
  const latestPrepared = prepared.filter((p) => p.record.channel === channel).at(-1) ?? null;
  if (kind === "rollback") {
    if (onChannel.length < 2) return { prepared: null, of: null, error: `${channel} has ${onChannel.length ? "one release" : "no release"} on this canvas; a roll back re-publishes the one before the latest` };
    return { prepared: null, of: onChannel.at(-2), error: null };
  }
  if (!latestPrepared) return { prepared: null, of: null, error: `nothing is prepared for ${channel}: prepare first, and confirm what it shows` };
  if (kind === "promote") {
    const source = releases.filter((r) => r.record.channel === from && r.record.heads.length).at(-1) ?? null;
    if (!source) return { prepared: latestPrepared, of: null, error: `${from} has no release on this canvas to promote` };
    if (source.record.commit !== latestPrepared.record.commit) return { prepared: latestPrepared, of: source, error: `the ${channel} prepare is of ${latestPrepared.record.commit.slice(0, 12)}, but ${source.record.release} on ${from} is ${source.record.commit.slice(0, 12)}: promote ships what ${from} has \u2014 check that commit out and prepare ${channel} again` };
    return { prepared: latestPrepared, of: source, error: null };
  }
  return { prepared: latestPrepared, of: null, error: null };
}
var releaseId = (kind, of) => {
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return kind === "ship" ? `r-${stamp}` : `${kind}-${stamp}${of ? `-of-${of}`.slice(0, 80) : ""}`;
};
async function shipOn(kit, host, ctx, canvasId, app, ask) {
  const started = Date.now();
  let snapshot = await ctx.client.snapshot(canvasId);
  const lane0 = await kit.bridge(host, "lane", ["--app", app], "the release lane", true);
  const plan = shipPlan(snapshot, lane0.app.id, ask.kind, ask.channel, ask.from);
  if (plan.error) return { ok: false, itemId: null, record: null, error: plan.error, report: null };
  const of = plan.of?.record.release ?? null;
  const release = releaseId(ask.kind, of);
  const args = [
    "--app",
    app,
    "--channel",
    ask.channel,
    "--release",
    release,
    ...ask.kind === "rollback" ? ["--commit", plan.of.record.commit] : ["--expect", plan.prepared.record.commit]
  ];
  let report;
  try {
    report = await kit.bridge(host, "ship", args, "Exact's publisher", true);
  } catch (err) {
    return { ok: false, itemId: null, record: null, error: err.message, report: null };
  }
  const t = report.table;
  if (!t || !t.published) return { ok: false, itemId: null, record: null, error: report.error ?? "Exact published nothing and said why on stderr", report };
  const want = ask.kind === "rollback" ? plan.of.record.commit : plan.prepared.record.commit;
  const heads = t.published.filter((p) => p.kind === "stream" && p.action === "published" && p.head).map((p) => ({ platform: p.platform ?? "?", stream: (p.compatibilityId ?? "").slice(0, 8), seq: p.head.seq, sha256: p.head.sha256, previous: p.previous ?? null }));
  snapshot = await ctx.client.snapshot(canvasId);
  const lane = laneItemOf(snapshot, lane0.app.id) ?? await upsertLane(kit, host, ctx, canvasId, report.lane);
  const now = screensNow(snapshot, lane0.app.id);
  const previous = cardsOf(snapshot, lane0.app.id).releases.filter((r) => r.record.channel === ask.channel).at(-1)?.record.screens ?? null;
  const phasedAsked = report.lane.channels.find((c) => c.name === ask.channel)?.phased ?? false;
  const record = {
    kind: ask.kind,
    channel: ask.channel,
    release: t.release,
    snapshot: t.snapshot.id,
    commit: t.snapshot.commit,
    origin: t.origin.location,
    by: ask.by,
    at: (/* @__PURE__ */ new Date()).toISOString(),
    heads,
    refused: (t.refused ?? []).map((r) => ({ platform: r.platform ?? "?", reason: r.reason })),
    failed: (t.failed ?? []).map((f) => `${f.platform ?? f.kind ?? "?"}: ${f.error}`),
    classification: classify(t),
    of,
    phased: { asked: phasedAsked, note: phasedAsked ? PHASED_NOTE : null },
    screens: Object.fromEntries(Object.entries(now).map(([k, v]) => [k, v.version])),
    changed: changedScreens(now, previous),
    ms: Date.now() - started
  };
  const commitOk = t.snapshot.commit === want;
  if (!commitOk) record.failed.push(`Exact snapshotted ${t.snapshot.commit.slice(0, 12)}, not the confirmed ${want.slice(0, 12)}`);
  const word = ask.kind === "ship" ? "Shipped" : ask.kind === "promote" ? "Promoted" : "Rolled back";
  const itemId = await postCard(
    host,
    ctx,
    canvasId,
    lane,
    report.lane,
    ask.channel,
    releaseMarkdown(record, report.lane.app.name),
    `release-${ask.channel}-${t.release}.md`,
    `${word} \u2192 ${ask.channel}: ${heads.map((h) => `seq ${h.seq}`).join(", ") || "nothing written"}${ask.kind === "rollback" ? ` (content of ${of})` : ""}`,
    { [P().release]: JSON.stringify(record) }
  );
  const ok = report.ok && commitOk && !record.failed.length;
  return { ok, itemId, record, error: ok ? null : record.failed.join("; ") || report.error || null, report };
}
function printClassification(r) {
  const c = r.classification;
  console.log(`channel ${r.channel} \xB7 release ${r.release} \xB7 snapshot ${r.snapshot.slice(0, 12)} (commit ${r.commit.slice(0, 12)})${r.dirty ? " \xB7 DIRTY (ignored files only)" : ""} \xB7 origin ${r.origin}`);
  console.log(`  ${classificationLine(c)}`);
  for (const o of c.ota) console.log(`  over the air  ${o.platform}${o.stream ? ` ${o.stream}` : ""}${o.seq != null ? ` \u2192 seq ${o.seq}` : ""}: ${o.changes.join(", ")}`);
  for (const b of c.binary) console.log(`  needs a binary  ${b.platform}${b.stream ? ` ${b.stream}` : ""}: ${b.reason}`);
  for (const x of c.current) console.log(`  current  ${x.platform} ${x.stream}${x.seq != null ? ` at seq ${x.seq}` : ""}`);
  for (const u of c.unavailable) console.log(`  unavailable  ${u.platform}: ${u.reason}`);
  console.log(`  ${originLine(r)}`);
}
async function prepareVerb(kit, host, given, opts, cmd, app) {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  const channel = opts.channel ?? (await kit.bridge(host, "lane", ["--app", app], "the release lane", true)).baked;
  if (!channel) throw new Error(`which channel? --channel <name> (app.json's deploy.channels)`);
  if (!ctx.json) console.error(`preparing ${given} for ${channel}: Exact's dry run snapshots, bakes and classifies \u2014 nothing is uploaded (a minute or more)\u2026`);
  const { report, record, itemId } = await prepareOn(kit, host, ctx, canvas.id, app, channel, ctx.actor.name, opts.platform);
  if (ctx.json) return host.printJson({ ok: report.ok, itemId, record, error: report.error ?? null });
  if (!record) throw new Error(`not prepared: ${report.error}`);
  printClassification(record);
  console.log(`${itemId}  the card, in ${channel}'s row of the lane`);
}
async function refuseAgents(ctx, canvasId) {
  const snapshot = await ctx.client.snapshot(canvasId);
  if (isAgent(snapshot, ctx.actor.id)) throw new Error(agentRefusal(ctx.actor.name));
}
async function shipVerb(kit, host, kind, given, opts, cmd, app) {
  const ctx = await host.ctxOf(cmd);
  const canvas = await host.resolveCanvas(ctx);
  await refuseAgents(ctx, canvas.id);
  const from = kind === "promote" ? opts.from ?? "internal" : null;
  const channel = kind === "promote" ? opts.to ?? "production" : opts.channel;
  if (!channel) throw new Error(`which channel? --channel <name> (app.json's deploy.channels)`);
  const appId = (await kit.appOf(app)).id;
  const verbWord = kind === "ship" ? `ship ${given} --channel ${channel}` : kind === "promote" ? `promote ${given} --from ${from} --to ${channel}` : `rollback ${given} --channel ${channel}`;
  if (!opts.yes) {
    if (kind === "rollback") {
      const plan2 = shipPlan(await ctx.client.snapshot(canvas.id), appId, kind, channel, null);
      if (plan2.error) throw new Error(plan2.error);
      const r = plan2.of.record;
      console.log(`roll back ${channel}: re-publish the content of ${r.release} (commit ${r.commit.slice(0, 12)}, ${r.at.slice(0, 16)}) at a new sequence number \u2014 Exact has no publisher rollback, so this is a new release, labelled so`);
      console.log(`isocan exact ${verbWord} --yes   does it, with the keys on this machine`);
      return;
    }
    if (!ctx.json) console.error(`preparing ${given} for ${channel} first, so you can see what you would ship\u2026`);
    const { report, record, itemId } = await prepareOn(kit, host, ctx, canvas.id, app, channel, ctx.actor.name);
    if (!record) throw new Error(`not prepared: ${report.error}`);
    printClassification(record);
    console.log(`${itemId}  the card`);
    if (kind === "promote") {
      const plan2 = shipPlan(await ctx.client.snapshot(canvas.id), appId, kind, channel, from);
      if (plan2.error) throw new Error(plan2.error);
      console.log(`promotes ${plan2.of.record.release} (${from}) to ${channel}${record.classification.binary.length ? "; the rows that need a binary are refused by Exact and named on the card" : ""}`);
    }
    if (!record.classification.ota.length) {
      console.log("nothing goes over the air: nothing to ship");
      return;
    }
    console.log(`isocan exact ${verbWord} --yes   ships these ${record.classification.changes} change${record.classification.changes === 1 ? "" : "s"} to ${channel}, signed with the keys on this machine`);
    return;
  }
  const plan = shipPlan(await ctx.client.snapshot(canvas.id), appId, kind, channel, from);
  if (plan.error) throw new Error(plan.error);
  if (plan.prepared && !ctx.json) {
    console.log(`confirmed by ${ctx.actor.name}:`);
    printClassification(plan.prepared.record);
  }
  if (plan.of && !ctx.json) console.log(`${kind === "rollback" ? "re-publishing the content of" : "promoting"} ${plan.of.record.release} (commit ${plan.of.record.commit.slice(0, 12)})`);
  if (!ctx.json) console.error(`${kind === "rollback" ? "rolling back" : kind === "promote" ? "promoting" : "shipping"} to ${channel}: Exact snapshots, bakes, signs and publishes\u2026`);
  const done = await shipOn(kit, host, ctx, canvas.id, app, { kind, channel, by: ctx.actor.name, from });
  if (ctx.json) return host.printJson({ ok: done.ok, itemId: done.itemId, record: done.record, error: done.error });
  if (!done.record) throw new Error(`not shipped: ${done.error}`);
  for (const h of done.record.heads) console.log(`  ${h.platform} stream ${h.stream}: head seq ${h.seq} (${h.sha256.slice(0, 12)}), previous ${h.previous?.slice(0, 12) ?? "none"}`);
  for (const r of done.record.refused) console.log(`  ${r.platform}: refused, needs a binary \u2014 ${r.reason}`);
  if (done.record.phased.asked) console.log(`  phased: ${done.record.phased.note}`);
  console.log(`${done.itemId}  ${done.record.release} on ${channel}${done.record.changed.length ? `, ${done.record.changed.length} screens changed` : ""}`);
  if (!done.ok) throw new Error(done.error ?? "not every row published");
}
function propertiesWritten(op, itemId) {
  const o = op;
  if (o.type === "item.update") return o.itemId === itemId ? o.patch?.properties ?? null : null;
  if (o.type !== "group.change") return null;
  const writes = (o.action?.change?.writes ?? []).filter((w) => w.itemId === itemId && w.content?.properties);
  return writes.length ? Object.assign({}, ...writes.map((w) => w.content.properties)) : null;
}
function pendingLaneAsks(entries, snapshot, appId) {
  const lane = laneItemOf(snapshot, appId);
  const prepares = [];
  const ships = [];
  if (!lane) return { prepares, ships };
  for (const e of entries) {
    const touched = propertiesWritten(e.envelope.op, lane.id);
    if (!touched) continue;
    if (P().prepare in touched) {
      const ask = parsePrepareAsk(lane.properties?.[P().prepare]);
      const answered = parsePrepareAnswer(lane.properties?.[P().prepared]);
      if (ask && (!answered || answered.seq < ask.seq) && !prepares.length) prepares.push({ item: lane, seq: e.seq });
    }
    if (P().ship in touched) {
      const ask = parseShipAsk(lane.properties?.[P().ship]);
      const answered = parseShipAnswer(lane.properties?.[P().shipped]);
      if (ask && (!answered || answered.seq < ask.seq)) {
        ships.length = 0;
        ships.push({ item: lane, seq: e.seq, actor: e.envelope.actor });
      }
    }
  }
  return { prepares, ships };
}
async function answerPrepare(kit, host, ctx, canvasId, app, lane, say) {
  const ask = parsePrepareAsk(lane.properties?.[P().prepare]);
  if (!ask) return null;
  say(`prepare ${ask.channel}${ask.by ? `, for ${ask.by}` : ""}`);
  try {
    const { report, record, itemId } = await prepareOn(kit, host, ctx, canvasId, app, ask.channel, ask.by || ctx.actor.name);
    say(`prepare ${ask.channel}: ${record ? classificationLine(record.classification) : report.error}`);
    return { seq: ask.seq, ok: !!record, itemId, ...record ? {} : { error: report.error ?? "not prepared" } };
  } catch (err) {
    return { seq: ask.seq, ok: false, itemId: null, error: err.message };
  }
}
async function answerShip(kit, host, ctx, canvasId, app, lane, actor, say) {
  const ask = parseShipAsk(lane.properties?.[P().ship]);
  if (!ask) return null;
  const snapshot = await ctx.client.snapshot(canvasId);
  if (isAgent(snapshot, actor.id)) {
    const sentence = agentRefusal(actor.name);
    say(`refused a ${ask.kind} to ${ask.channel} written by ${actor.name}: ${sentence}`);
    return { seq: ask.seq, ok: false, itemId: null, error: sentence, refused: true };
  }
  if (!grantedWrite(actor, ctx.actor, process.env.ISOCAN_EXACT_GRANT)) {
    const sentence = grantRefusal(actor.name);
    say(`refused a ${ask.kind} to ${ask.channel} written by ${actor.name}: ${sentence}`);
    return { seq: ask.seq, ok: false, itemId: null, error: sentence, refused: true };
  }
  const appId = core.appIdOf(lane);
  const plan = shipPlan(snapshot, appId, ask.kind, ask.channel, ask.kind === "promote" ? ask.from : null);
  if (plan.error) return { seq: ask.seq, ok: false, itemId: null, error: plan.error };
  if (ask.kind !== "rollback" && (plan.prepared.item.id !== ask.prepared || plan.prepared.record.classification.changes !== ask.changes)) {
    return { seq: ask.seq, ok: false, itemId: null, error: "what is prepared is not what was confirmed (a newer prepare, or another change count): confirm again" };
  }
  say(`${ask.kind} to ${ask.channel}, confirmed by ${actor.name}`);
  const done = await shipOn(kit, host, ctx, canvasId, app, { kind: ask.kind, channel: ask.channel, by: actor.name, from: ask.kind === "promote" ? ask.from : null });
  say(`${ask.kind} to ${ask.channel}: ${done.record ? `${done.record.release}, ${done.record.heads.map((h) => `seq ${h.seq}`).join(", ") || "nothing written"}` : done.error}`);
  return { seq: ask.seq, ok: done.ok, itemId: done.itemId, ...done.error ? { error: done.error } : {} };
}
export {
  answerPrepare,
  answerShip,
  laneItemOf,
  parseLane,
  pendingLaneAsks,
  prepareOn,
  prepareVerb,
  shipOn,
  shipPlan,
  shipVerb
};
