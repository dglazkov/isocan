import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  checkDesignCraft,
  craftBytes,
  craftHash,
  parseDesignCraftPacket
} from "./chunk-WLLT2M3X.mjs";
import {
  changeDesignRequest,
  publishDesignReceipt,
  readDesignRequestReference,
  readDesignRequests,
  readDesignWorkflow,
  startDesignRequest
} from "./chunk-VI2PGDZU.mjs";
import {
  CanvasGroups,
  DaemonClient,
  assertGroupDestination,
  automaticSourceClient,
  contextHome,
  copyFaces,
  designAuditPort,
  designRequestPort,
  readContextSummary,
  readDesignAudit,
  repairDesignItem,
  resolveCanvasGroupRef,
  transferCopyFaces
} from "./chunk-PHSGCIRG.mjs";
import {
  adoptIdentity,
  bindableRoot,
  findBinding,
  markerFile,
  paths_exports,
  readConfigFile,
  recordDir,
  stalenessOf,
  writeIdentityName,
  writeMarker
} from "./chunk-32NZJL2K.mjs";
import {
  publishDesignComparison,
  readDesignComparisonReference,
  readDesignComparisons,
  respondDesignComparison,
  submitDesignDecision
} from "./chunk-CSFNNBJP.mjs";
import {
  answerDesignQuestions,
  askDesignQuestions,
  classifyAutomaticSource,
  questionnaireFailureStatus,
  readDesignQuestions,
  readDesignReference
} from "./chunk-OQWKPAAY.mjs";
import {
  ApiError,
  DEFAULT_PORT,
  EXPORT_FORMAT,
  EXPORT_LAYOUT,
  actorNameIn,
  actorsAnswerTo,
  annotationsOf,
  blobFileName,
  blobsNamedBy,
  canvasIdOf,
  collectCanvasActors,
  collectCanvasNames,
  collectItemRefCandidates,
  contextPinDecoration,
  dispatchReason,
  elapsedLabel,
  extensionFor,
  extractItemRefs,
  extractMentions,
  filenameFromTitle,
  findArea,
  groupChildren,
  groupCopyAction,
  groupCopySource,
  groupDescendants,
  groupTransformClosure,
  isCanvasRecord,
  isGroupItem,
  itemKind,
  itemThread,
  itemsIn,
  mainThread,
  memoryLinks,
  namesFor,
  newCanvasId,
  newCommentId,
  newItemId,
  newOpId,
  newThreadId,
  newVersionId,
  normalizeHomeUrl,
  opsTouching,
  parseSourcePolicyHeader,
  prunedVersions,
  recentActivity,
  resolveActor,
  resolveGroupOperation,
  resolveSourcePinPiece,
  sourceOf,
  sourcePinPieces,
  sourcePolicyHeader,
  visualFaceOf
} from "./chunk-B7JOBMSP.mjs";

// packages/api/src/ctx.ts
import { promises as fs2 } from "node:fs";
import path2 from "node:path";

// packages/api/src/identity.ts
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";

// packages/api/src/harness.ts
var OWN_VAR = "ISOCAN_SESSION_ID";
var OWN_HARNESS_VAR = "ISOCAN_HARNESS";
var BUILTIN = [
  ["claude-code", "CLAUDE_CODE_SESSION_ID"],
  ["codex", "CODEX_THREAD_ID"],
  ["pi", "PI_SESSION_ID"],
  ["antigravity", "ANTIGRAVITY_CONVERSATION_ID"]
];
var builtinHarnesses = BUILTIN.map(([harness]) => harness);
var harnessVars = [OWN_VAR, OWN_HARNESS_VAR, ...BUILTIN.map(([, envVar]) => envVar)];
var VALID_VAR = /^[A-Za-z_][A-Za-z0-9_]*$/;
async function declaredVars(home) {
  const raw = await readConfigFile(home);
  return Object.entries(raw.harnessVars ?? {}).filter(
    ([harness, envVar]) => typeof envVar === "string" && VALID_VAR.test(envVar) && harness.length > 0
  );
}
async function varsFor(home, env) {
  const own = [[env[OWN_HARNESS_VAR]?.trim() || "isocan", OWN_VAR]];
  const seen = /* @__PURE__ */ new Set();
  return [...own, ...await declaredVars(home), ...BUILTIN].filter(([, envVar]) => {
    if (seen.has(envVar)) return false;
    seen.add(envVar);
    return true;
  });
}
async function harnessSessions(home, env = process.env) {
  const vars = await varsFor(home, env);
  return vars.flatMap(([harness, envVar]) => {
    const id = env[envVar]?.trim();
    return id ? [{ harness, id, key: `${harness}:${id}`, deliberate: envVar === OWN_VAR }] : [];
  });
}
async function harnessVarsFor(home, env = process.env) {
  return (await varsFor(home, env)).map(([, envVar]) => envVar);
}

// packages/api/src/identity.ts
var HOME_CLAIM_KEY = "home:person";
async function readFrom(file) {
  try {
    const raw = JSON.parse(await fs.readFile(file, "utf8"));
    return raw.id && raw.name ? { id: raw.id, name: raw.name } : null;
  } catch {
    return null;
  }
}
async function readIdentity(home) {
  return readFrom(paths_exports.identityFile(home));
}
async function findSessionIdentity(client, home) {
  const present2 = await harnessSessions(home);
  if (present2.length === 0) return null;
  await client.ensureDaemon();
  const bindings = await legacyTolerant(client.actorBindings(present2.map((s) => s.key)));
  if (!bindings) return null;
  const newest = [...bindings].sort((a, b) => b.boundAt.localeCompare(a.boundAt))[0];
  if (!newest) return null;
  const harness = present2.find((s) => s.key === newest.key)?.harness ?? "unknown";
  return { actor: newest.actor, harness, key: newest.key };
}
async function claimSessionIdentity(client, home, options = {}) {
  const present2 = options.identity ? [{ key: `${options.identity.harness ?? "isocan"}:${options.identity.session}`, harness: options.identity.harness ?? "isocan", deliberate: true }] : await harnessSessions(home);
  if (present2.length === 0) {
    const looked = await harnessVarsFor(home);
    throw new Error(
      `no harness session in the environment \u2014 \`--session\` names the agent running this command, and nothing here says which one that is (looked for ${looked.join(", ")}). Export ISOCAN_SESSION_ID yourself, or add your harness's variable to config.json as \`{"harnessVars": {"<name>": "<VAR>"}}\`.`
    );
  }
  await client.ensureDaemon();
  const bindings = await legacyTolerant(client.actorBindings(present2.map((s) => s.key)));
  if (!bindings) {
    throw new Error(
      "the running daemon predates actor.claim and cannot name anyone \u2014 `isocan restart` brings up this build's, then try again"
    );
  }
  const bound = new Set(bindings.map((b) => b.key));
  const session = present2.find((s) => s.deliberate) ?? present2.find((s) => !bound.has(s.key)) ?? present2[0];
  const op = {
    type: "actor.claim",
    sessionKey: session.key,
    ...options.name !== void 0 ? { name: options.name } : {},
    ...options.fresh ? { fresh: true } : {},
    ...options.as !== void 0 ? { as: options.as } : {},
    ...options.canvasId !== void 0 ? { canvasId: options.canvasId } : {}
  };
  const { envelope } = await client.claimActor(op);
  return { actor: envelope.actor, harness: session.harness };
}
async function legacyTolerant(request) {
  try {
    const result = await request;
    return Array.isArray(result) ? result : null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
async function noIdentityHere(client, home) {
  const blank = 'no identity configured \u2014 run `isocan identity --name "Your Name" --session` first';
  let orphaned;
  try {
    const present2 = await harnessSessions(home);
    if (present2.length === 0) return blank;
    orphaned = await client.orphanedActors(present2.map((session) => session.key)) ?? [];
  } catch {
    return blank;
  }
  const mine = orphaned[0];
  if (!mine) return blank;
  const badgeId = await client.badgeId();
  return `no identity here \u2014 this machine's badge (${badgeId ?? "none"}) holds no claims, but this home has an actor on another badge: ${mine.actor.name} (${mine.actor.id}), named ${elapsedLabel(mine.boundAt, (/* @__PURE__ */ new Date()).toISOString())} ago. That is this conversation's own session key, so if it is you, come back with \`isocan identity --session --as ${mine.actor.id}\` \u2014 \`--name\` would make you somebody new and leave your history behind.`;
}
async function realPathOrResolved(p) {
  try {
    return await fs.realpath(p);
  } catch {
    const resolved = path.resolve(p);
    const parent = path.dirname(resolved);
    if (parent !== resolved) {
      try {
        return path.join(await fs.realpath(parent), path.basename(resolved));
      } catch {
        return resolved;
      }
    }
    return resolved;
  }
}
async function retireStrandedIdentities(cwd, home) {
  const isocanHome = await realPathOrResolved(home);
  const userHome = await realPathOrResolved(os.homedir());
  let dir = await realPathOrResolved(cwd);
  for (; ; ) {
    const dirIsocan = await realPathOrResolved(path.join(dir, ".isocan"));
    if (dir !== userHome && dirIsocan !== isocanHome) {
      const file = path.join(dir, ".isocan", "identity.json");
      const stranded = await readFrom(file);
      if (stranded) {
        try {
          await fs.rename(file, `${file}.retired`);
          console.error(
            `note: ${file} held a directory identity \u2014 "${stranded.name}" (${stranded.id}). A directory cannot tell one agent from another, so it no longer speaks for anyone; the file was renamed aside to keep the record. To be that actor again on purpose: isocan identity --as ${stranded.id} --name "${stranded.name}"`
          );
        } catch {
        }
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir || dir === userHome) return;
    dir = parent;
  }
}
async function resolveIdentity(client, home) {
  const session = await findSessionIdentity(client, home);
  const resolved = session ? {
    actor: session.actor,
    source: "session",
    file: paths_exports.actorsFile(home),
    harness: session.harness,
    key: session.key
  } : await readIdentity(home).then(
    (actor) => actor ? {
      actor,
      source: "home",
      file: paths_exports.identityFile(home),
      key: HOME_CLAIM_KEY
    } : null
  );
  if (resolved) client.reclaimWith(() => reclaimIdentity(client, resolved));
  return resolved;
}
async function resolveExplicitIdentity(client, home, identity) {
  const harness = identity.harness ?? "isocan";
  const key = `${harness}:${identity.session}`;
  await client.ensureDaemon();
  const bindings = await legacyTolerant(client.actorBindings([key]));
  const bound = bindings?.[0];
  if (!bound) return null;
  const resolved = {
    actor: bound.actor,
    source: "session",
    file: paths_exports.actorsFile(home),
    harness,
    key
  };
  client.reclaimWith(() => reclaimIdentity(client, resolved));
  return resolved;
}
async function reclaimIdentity(client, identity) {
  await client.claimActor({
    type: "actor.claim",
    sessionKey: identity.key,
    as: identity.actor.id,
    name: identity.actor.name
  });
}
async function adoptIdentity2(home, actor) {
  return adoptIdentity(home, actor);
}
async function writeIdentity(home, name, fresh = false) {
  return writeIdentityName(home, name, fresh);
}
async function requireIdentity(client, home) {
  const existing = await resolveIdentity(client, home);
  if (existing) return existing.actor;
  if (!process.stdin.isTTY) {
    throw new Error(await noIdentityHere(client, home));
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const name = (await rl.question("Welcome to isocan! What should we call you? ")).trim();
  rl.close();
  if (!name) throw new Error("a name is required");
  const actor = await writeIdentity(home, name);
  console.error(`Hi ${actor.name} \u2014 identity saved to ${paths_exports.identityFile(home)}`);
  return actor;
}

// packages/api/src/direct.ts
var DEFAULT_MODE = "daemon";
var DIRECT_VAR = "ISOCAN_DIRECT";
async function resolveDeclared(isocanHome) {
  const fromEnv = process.env[DIRECT_VAR]?.trim();
  if (fromEnv) {
    if (isFalsy(fromEnv)) return { mode: "daemon", at: null, from: "env" };
    if (isTruthy(fromEnv)) {
      return { mode: "direct", at: await configuredDirect(isocanHome), from: "env" };
    }
    return { mode: "direct", at: normalizeHomeUrl(fromEnv), from: "env" };
  }
  const at = await configuredDirect(isocanHome);
  return at ? { mode: "direct", at, from: "config" } : null;
}
async function configuredDirect(isocanHome) {
  const config = await readConfigFile(isocanHome);
  const configured = typeof config.direct === "string" ? config.direct.trim() : "";
  return configured ? normalizeHomeUrl(configured) : null;
}
var isTruthy = (value) => ["1", "true", "yes", "on"].includes(value.toLowerCase());
var isFalsy = (value) => ["0", "false", "no", "off"].includes(value.toLowerCase());
function refuseDaemonVerb(verb, at) {
  return new Error(
    `this machine is direct \u2014 it runs no daemon, and \`isocan ${verb}\` is about one. Commands here speak to ${at} itself, so there is nothing to ${verb}. \`isocan direct --clear\` gives this machine a daemon and a replica of its own.`
  );
}

// packages/api/src/ctx.ts
async function resolveBase(isocanHome, port, binding) {
  const declared = await resolveDeclared(isocanHome);
  if (declared?.mode === "direct") {
    const at = declared.at ?? binding?.home ?? null;
    if (at) return { base: at, direct: at };
    throw new Error(
      `${DIRECT_VAR} says this machine runs no daemon, but nothing says which home to speak to: it does not name an address, there is no \`direct\` in ${paths_exports.configFile(isocanHome)}, and no .isocan/project.json marker in this directory names one. Set the address itself (${DIRECT_VAR}=https://isocan.io), or run \`isocan setup <canvas address> --direct\` here.`
    );
  }
  return { base: `http://127.0.0.1:${port}`, direct: null };
}
async function baseForCwd(isocanHome, port) {
  return resolveBase(isocanHome, port, await findBinding(process.cwd(), isocanHome));
}
async function resolveCtx(options = {}) {
  options.signal?.throwIfAborted();
  const home = paths_exports.isocanHome();
  const port = options.port ?? Number(process.env.ISOCAN_PORT ?? DEFAULT_PORT);
  const binding = await findBinding(process.cwd(), home);
  const { base, direct } = await resolveBase(home, port, binding);
  options.signal?.throwIfAborted();
  const client = new DaemonClient(base, home, options.signal);
  await retireStrandedIdentities(process.cwd(), home);
  options.signal?.throwIfAborted();
  const known = options.identity ? await resolveExplicitIdentity(client, home, options.identity) : await resolveIdentity(client, home);
  const interactive = options.interactive ?? true;
  const actor = known?.actor ?? (interactive && !options.identity && process.stdin.isTTY ? await requireIdentity(client, home) : null);
  const harness = known?.harness ?? null;
  if (!direct) await client.ensureDaemon();
  const health = await client.healthz().catch(() => null);
  if (!direct) await warnIfStale(health, home);
  await warnIfBehind(health, home);
  const birthHome = health?.home ?? null;
  options.signal?.throwIfAborted();
  let record = null;
  const homes = () => record ??= readHomeRecord(client, birthHome);
  return {
    client,
    get actor() {
      if (!actor) {
        throw new Error(
          'no identity yet \u2014 `isocan identity --name "Your Name" --session` names this agent'
        );
      }
      return actor;
    },
    harness,
    home,
    binding,
    birthHome,
    homes,
    ...known ? { reclaimOn: (target) => target.reclaimWith(() => reclaimIdentity(target, known)) } : {},
    async homeOf(canvasId) {
      return homeAddressOf(await homes(), canvasId);
    },
    ...options.canvasRef !== void 0 ? { canvasRef: options.canvasRef } : {}
  };
}
async function readHomeRecord(client, birthHome) {
  const answer = await client.homes().catch(() => null);
  const rows = answer?.canvases ?? {};
  return {
    birth: answer ? answer.birth : birthHome,
    links: answer?.links ?? [],
    rows,
    legacy: answer === null,
    rowFor: (canvasId) => rows[canvasId]
  };
}
function homeAddressOf(record, canvasId) {
  if (record.legacy) return record.birth;
  return record.rowFor(canvasId) ?? null;
}
function refuseHomeDisagreement(binding, record, heldHere, base) {
  if (binding.home === void 0) return;
  const row = record.legacy ? record.birth : record.rowFor(binding.canvasId);
  if (row === void 0 && !heldHere) return;
  const recorded = row ?? base;
  if (normalizeHomeUrl(recorded) === normalizeHomeUrl(binding.home)) return;
  const mine = row === null || row === void 0 ? `the daemon at ${base} holds that canvas as its OWN (it is its home)` : `this machine has that canvas recorded as living at ${recorded}`;
  throw new Error(
    `this directory's canvas lives at ${binding.home} (${markerFile(binding.root)}), but ${mine}. Those cannot both be true, and nothing here will guess: moving a canvas between homes is re-homing, a deliberate act that carries the work and leaves the desk behind. Either the marker is stale and belongs corrected in git, or this machine's record is (\`isocan home\` shows every canvas and where it lives).`
  );
}
async function warnIfStale(health, home) {
  try {
    if (!health) return;
    const { stale, why } = stalenessOf(health);
    if (!stale) return;
    const marker = path2.join(home, ".stale-warned");
    const said = await fs2.readFile(marker, "utf8").catch(() => "");
    if (said.trim() === health.startedAt) return;
    await fs2.writeFile(marker, health.startedAt).catch(() => {
    });
    console.error(`note: ${why} \u2014 \`isocan restart\` to run this one.`);
  } catch {
  }
}
async function warnIfBehind(health, home) {
  try {
    const verdict = health?.upgrade;
    if (!verdict?.available) return;
    const pair = `${verdict.mine}->${verdict.homeCommit}`;
    const marker = path2.join(home, ".upgrade-noted");
    const said = await fs2.readFile(marker, "utf8").catch(() => "");
    if (said.trim() === pair) return;
    await fs2.writeFile(marker, pair).catch(() => {
    });
    const next = verdict.direction === "ahead" ? "your home is the older build" : "`isocan upgrade` catches up";
    console.error(`note: ${verdict.why} \u2014 ${next}.`);
  } catch {
  }
}
async function resolveCanvas(ctx, opts = {}) {
  if (ctx.canvasRef !== void 0) return resolveCanvasRef(ctx.client, ctx.canvasRef, ctx.sourceContext);
  const canvases = await ctx.client.listCanvases();
  if (ctx.binding) {
    await preflightCanvas(ctx.client, ctx.binding.canvasId, ctx.sourceContext, ctx.binding.home);
    let bound = canvases.find((p) => p.id === ctx.binding.canvasId);
    refuseHomeDisagreement(ctx.binding, await ctx.homes(), bound !== void 0, ctx.client.base);
    if (!bound) {
      try {
        bound = (await ctx.client.snapshot(ctx.binding.canvasId)).project;
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) throw err;
      }
    }
    if (bound) {
      await recordDir(ctx.home, ctx.binding.root, bound.id);
      return bound;
    }
    const fromHome = await fetchFromHome(ctx.client, ctx.birthHome, ctx.binding);
    if (fromHome) {
      await recordDir(ctx.home, ctx.binding.root, fromHome.id);
      return fromHome;
    }
    refuseOfflineBirth(ctx.binding);
    if (opts.create) return materializeBinding(ctx, ctx.binding);
    throw new Error(
      `this directory is bound to canvas ${ctx.binding.canvasId} (${markerFile(ctx.binding.root)}), which does not exist in this home yet \u2014 \`isocan session start\`, or any command that adds something, materializes it`
    );
  }
  const fallback = (await readConfigFile(ctx.home)).defaultProjectId;
  if (fallback !== void 0) {
    await preflightCanvas(ctx.client, fallback, ctx.sourceContext);
    return (await ctx.client.snapshot(fallback)).project;
  }
  if (canvases.length === 1) return canvases[0];
  if (opts.create) {
    const made = await bindFresh(ctx);
    if (made) return made;
  }
  throw new Error(
    canvases.length === 0 ? "no canvases yet \u2014 create one with `isocan canvas create <title>`" : "multiple canvases \u2014 pass --canvas <id|title>, or bind this directory to one with `isocan use <canvas>`"
  );
}
async function resolveCanvasRef(client, ref, sourceContext) {
  if (/^prj_[A-Za-z0-9_-]+$/.test(ref)) {
    await preflightCanvas(client, ref, sourceContext);
    return (await client.snapshot(ref)).project;
  }
  return matchRef(await client.listCanvases(), ref);
}
async function preflightCanvas(client, canvasId, context, statedHome) {
  if (!context) return null;
  context.signal?.throwIfAborted();
  const homes = await client.homes();
  context.signal?.throwIfAborted();
  const expectedHome = context.expectedHome ?? statedHome ?? homes.canvases[canvasId] ?? client.base;
  return client.sourceAccess({ canvasId, expectedHome, lookup: "entry", policy: context.policy }, context.signal);
}
async function sourceContextForCanvas(ctx, ref) {
  const context = ctx.sourceContext;
  context.signal?.throwIfAborted();
  const explicit = ref ?? ctx.canvasRef;
  let canvasId;
  if (explicit !== void 0) {
    canvasId = /^prj_[A-Za-z0-9_-]+$/.test(explicit) ? explicit : matchRef(await ctx.client.listCanvases(), explicit).id;
  } else if (ctx.binding) canvasId = ctx.binding.canvasId;
  else {
    const fallback = (await readConfigFile(ctx.home)).defaultProjectId;
    if (fallback !== void 0) canvasId = fallback;
    else {
      const canvases = await ctx.client.listCanvases();
      if (canvases.length !== 1) throw new Error(canvases.length === 0 ? "no canvases yet \u2014 create one with `isocan canvas create <title>`" : "multiple canvases \u2014 pass --canvas <id|title>, or bind this directory to one with `isocan use <canvas>`");
      canvasId = canvases[0].id;
    }
  }
  const homes = await ctx.client.homes();
  context.signal?.throwIfAborted();
  const statedHome = explicit === void 0 ? ctx.binding?.home : void 0;
  return Object.freeze({ ...context, expectedHome: context.expectedHome ?? statedHome ?? homes.canvases[canvasId] ?? ctx.client.base });
}
function matchRef(canvases, ref) {
  const byId = canvases.find((p) => p.id === ref);
  if (byId) return byId;
  const matches = canvases.filter((p) => p.title.toLowerCase().startsWith(ref.toLowerCase()));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(
      `ambiguous canvas "${ref}": ${matches.map((p) => `${p.id} (${p.title})`).join(", ")}`
    );
  }
  throw new Error(`no canvas matches "${ref}"`);
}
async function canvasById(client, id) {
  const canvas = (await client.listCanvases()).find((p) => p.id === id);
  if (!canvas) throw new Error(`canvas ${id} was created but the daemon cannot list it`);
  return canvas;
}
async function fetchFromHome(client, birthHome, binding) {
  const target = binding.home ?? birthHome;
  if (!target) return null;
  try {
    await client.joinFromHome(binding.canvasId, binding.home);
  } catch (err) {
    if (err instanceof ApiError && err.code === "not-a-replica") return null;
    if (err instanceof ApiError && err.code === "home-unreachable") {
      throw new Error(
        `${target} did not answer, so ${binding.canvasId} (${markerFile(binding.root)}) cannot be fetched: ${err.message}
Nothing was created here. That canvas lives at that address and this machine will not make a second one under its id \u2014 try again when the home is up.`
      );
    }
    if (err instanceof ApiError && err.status === 404) return null;
    throw new Error(
      `${target} would not hand this machine ${binding.canvasId} (${markerFile(binding.root)}): ${err.message}
If that canvas is yours, mint a pass from a session that is already on it (\`isocan pass\`) and run the command it prints here.`
    );
  }
  const deadline = Date.now() + 15e3;
  for (; ; ) {
    const here = (await client.listCanvases()).find((p) => p.id === binding.canvasId);
    if (here) return here;
    if (Date.now() > deadline) {
      throw new Error(
        `${target} let this machine onto ${binding.canvasId}, but the canvas has not arrived yet. It replicates in the background \u2014 try again in a moment.`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
function refuseOfflineBirth(binding) {
  if (binding.home === void 0) return;
  throw new Error(
    `${binding.canvasId} lives at ${binding.home} (${markerFile(binding.root)}) and this machine could not get it from there. Creating it here instead would make a SECOND canvas with that id \u2014 a twin, which is what offline birth means and which is not built yet. Nothing was created. Fix the reach to that home, or mint a pass there (\`isocan pass\`) and run the command it prints here.`
  );
}
async function materializeBinding(ctx, binding) {
  const title = binding.title ?? path2.basename(binding.root);
  await ctx.client.sendOp(null, ctx.actor, {
    type: "project.create",
    canvasId: binding.canvasId,
    title
  });
  await recordDir(ctx.home, binding.root, binding.canvasId);
  console.error(
    `note: materialized "${title}" (${binding.canvasId}) from ${markerFile(binding.root)}`
  );
  return canvasById(ctx.client, binding.canvasId);
}
async function bindFresh(ctx) {
  const root = await bindableRoot(process.cwd(), ctx.home);
  if (!root) return null;
  const canvasId = newCanvasId();
  const title = path2.basename(root);
  const birth = ctx.birthHome;
  await ctx.client.sendOp(
    null,
    ctx.actor,
    { type: "project.create", canvasId, title },
    void 0,
    birth ?? void 0
  );
  const marker = { canvasId, title, ...birth ? { home: birth } : {} };
  const file = await writeMarker(root, marker);
  await recordDir(ctx.home, root, canvasId);
  console.error(`note: created "${title}" (${canvasId}) for this directory \u2014 bound via ${file}`);
  ctx.binding = { root, ...marker };
  return canvasById(ctx.client, canvasId);
}
async function ensureDirBinding(client, home, actor, birthHome = null) {
  const binding = await findBinding(process.cwd(), home);
  if (binding) {
    const existing = (await client.listCanvases()).find((p) => p.id === binding.canvasId);
    refuseHomeDisagreement(
      binding,
      await readHomeRecord(client, birthHome),
      existing !== void 0,
      client.base
    );
    if (existing) {
      await recordDir(home, binding.root, existing.id);
      return { canvas: existing, root: binding.root, created: false };
    }
    const fromHome = await fetchFromHome(client, birthHome, binding);
    if (fromHome) {
      await recordDir(home, binding.root, fromHome.id);
      return { canvas: fromHome, root: binding.root, created: false };
    }
    refuseOfflineBirth(binding);
    const title2 = binding.title ?? path2.basename(binding.root);
    await client.sendOp(
      null,
      actor,
      { type: "project.create", canvasId: binding.canvasId, title: title2 },
      void 0,
      birthHome ?? void 0
    );
    await recordDir(home, binding.root, binding.canvasId);
    return {
      canvas: await canvasById(client, binding.canvasId),
      root: binding.root,
      created: true
    };
  }
  const root = await bindableRoot(process.cwd(), home);
  if (!root) return null;
  const canvasId = newCanvasId();
  const title = path2.basename(root);
  await client.sendOp(
    null,
    actor,
    { type: "project.create", canvasId, title },
    void 0,
    birthHome ?? void 0
  );
  await writeMarker(root, { canvasId, title, ...birthHome ? { home: birthHome } : {} });
  await recordDir(home, root, canvasId);
  return { canvas: await canvasById(client, canvasId), root, created: true };
}

// packages/api/src/questionnaire.ts
function questionnairePort(ctx) {
  return {
    get actorId() {
      return ctx.actor.id;
    },
    snapshot: (id, signal) => ctx.client.snapshot(id, signal),
    home: (id) => contextHome(ctx, id),
    blobBytes: (id, hash, signal) => ctx.client.downloadBlob(id, hash, signal),
    send: async (id, op, options) => {
      try {
        options.signal?.throwIfAborted();
        const receipt = await ctx.client.questionnaire(id, ctx.actor, op, options.opId);
        return { status: "accepted", receipt };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return { status: questionnaireFailureStatus(error), reason };
      }
    }
  };
}

// packages/api/src/design-decision.ts
function designDecisionPort(ctx) {
  return {
    ...designRequestPort(ctx),
    decisions: (id, signal) => ctx.client.designDecisions(id, signal),
    sendDecision: async (id, op, options) => {
      try {
        return { status: "accepted", receipt: await ctx.client.designDecision(id, ctx.actor, op, options.opId, options.signal) };
      } catch (error) {
        return { status: questionnaireFailureStatus(error), reason: error instanceof Error ? error.message : String(error), ...error && typeof error === "object" && "code" in error && typeof error.code === "string" ? { code: error.code } : {} };
      }
    }
  };
}

// packages/api/src/feedback.ts
async function waitForFeedback(client, canvasId, actor, options = {}) {
  return waitForResolvedFeedback(async () => ({ client, canvasId, actor }), options);
}
async function waitForResolvedFeedback(resolve, options = {}) {
  const timeoutMs = options.timeoutMs ?? 3e4;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 6e4) throw new Error("feedback timeout must be between 1 and 60000 milliseconds");
  if (options.since !== void 0 && (!Number.isSafeInteger(options.since) || options.since < 0)) throw new Error("feedback cursor must be a nonnegative integer");
  let cursor = options.since ?? 0;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const timer = setTimeout(cancel, timeoutMs);
  try {
    const { client, canvasId, actor } = await whileActive(() => resolve(controller.signal), controller.signal);
    if (options.since === void 0) cursor = (await whileActive(() => client.snapshot(canvasId, controller.signal), controller.signal)).lastSeq;
    while (!controller.signal.aborted) {
      const batch = await whileActive(() => client.watchLog({ only: [canvasId], cursors: { [canvasId]: cursor }, waitMs: Math.min(timeoutMs, 3e4) }, controller.signal), controller.signal);
      const snapshot = batch.entries.length ? await whileActive(() => client.snapshot(canvasId, controller.signal), controller.signal) : null;
      if (controller.signal.aborted) break;
      const entries = batch.entries.filter((entry) => dispatchReason(entry.envelope.op, entry.envelope.actor.id, {
        actorId: actor.id,
        names: namesFor(actor),
        ...snapshot?.joined ? { joined: snapshot.joined } : {}
      }, snapshot?.canvas) !== null);
      cursor = batch.cursors[canvasId] ?? cursor;
      if (entries.length) return { status: "feedback", cursor, entries };
    }
  } catch (err) {
    if (!controller.signal.aborted) throw err;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
  return { status: options.signal?.aborted ? "cancelled" : "timeout", cursor, entries: [] };
}
function whileActive(work, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cancel = () => reject(signal.reason);
    signal.addEventListener("abort", cancel, { once: true });
    Promise.resolve().then(() => {
      signal.throwIfAborted();
      return work();
    }).then(resolve, reject).finally(() => signal.removeEventListener("abort", cancel));
  });
}

// packages/api/src/canvas-context.ts
async function readContextItem(client, canvasId, threadId, commentId, itemId, options = {}) {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 16384;
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("content offset must be a non-negative integer");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 262144) throw new Error("content limit must be between 1 and 262144 bytes");
  const manifest = await client.commentContext(canvasId, threadId, commentId);
  const index = manifest.entries.findIndex((entry2) => entry2.itemId === itemId);
  if (index < 0) throw new Error(`item ${itemId} is not in this saved context`);
  const page = await client.contextContentPage(canvasId, { threadId, commentId, offset: index, limit: 1, face: options.face ?? "source" });
  const entry = page.entries[0];
  if (!entry || entry.itemId !== itemId || page.revision !== manifest.revision) throw new Error("saved context changed while its content was being read; read the request again");
  const result = { ...entry, canvasId, revision: page.revision, offset, bytesRead: 0, nextOffset: null };
  if (entry.status !== "available" || !entry.blob) return result;
  let bytes;
  try {
    const view = await client.downloadBlob(canvasId, entry.blob.blobHash);
    bytes = Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      const unavailable = { ...result, status: "unavailable", reason: "the saved version's bytes are no longer available at this home" };
      delete unavailable.url;
      return unavailable;
    }
    throw error;
  }
  if (offset > bytes.length) throw new Error(`content offset ${offset} exceeds ${bytes.length} bytes`);
  const chunk = bytes.subarray(offset, offset + limit);
  let encoding = "base64";
  let data = chunk.toString("base64");
  if (/^(text\/|application\/(?:json|[^;]+\+json|xml|javascript|[^;]+\+xml)(?:;|$))/.test(entry.blob.mimeType)) {
    try {
      data = new TextDecoder("utf-8", { fatal: true }).decode(chunk);
      encoding = "utf8";
    } catch {
    }
  }
  return { ...result, bytesRead: chunk.length, totalBytes: bytes.length, nextOffset: offset + chunk.length < bytes.length ? offset + chunk.length : null, encoding, data };
}

// packages/api/src/connect.ts
async function reaching(base, work) {
  try {
    return await work();
  } catch (err) {
    if (err instanceof TypeError) {
      const cause = err.cause?.message;
      throw new ApiError(0, `${base} did not answer: ${cause ?? err.message}`, "unreachable");
    }
    throw err;
  }
}
async function connect(options = {}) {
  const ctx = await resolveCtx({
    interactive: false,
    ...options.port !== void 0 ? { port: options.port } : {},
    ...options.identity !== void 0 ? { identity: options.identity } : {},
    ...options.signal !== void 0 ? { signal: options.signal } : {}
  });
  options.signal?.throwIfAborted();
  try {
    void ctx.actor;
  } catch {
    if (options.identity) {
      const harness = options.identity.harness ?? "isocan";
      throw new Error(
        `no actor is claimed under session "${harness}:${options.identity.session}" \u2014 claim it once: ISOCAN_HARNESS=${harness} ISOCAN_SESSION_ID=${options.identity.session} isocan identity --name "Your Name" --session`
      );
    }
    throw new Error(await noIdentityHere(ctx.client, ctx.home));
  }
  return new Home(ctx);
}
async function claimSession(options) {
  if (!options.identity.session.trim() || !options.name.trim()) throw new Error("a session key and agent name are required");
  const ctx = await resolveCtx({ interactive: false, ...options.port === void 0 ? {} : { port: options.port }, ...options.signal ? { signal: options.signal } : {}, identity: options.identity });
  options.signal?.throwIfAborted();
  const result = await claimSessionIdentity(ctx.client, ctx.home, { identity: options.identity, name: options.name, ...ctx.binding ? { canvasId: ctx.binding.canvasId } : {} });
  return result.actor;
}
var Home = class _Home {
  constructor(ctx) {
    this.ctx = ctx;
  }
  ctx;
  /** Who this connection speaks as. */
  get actor() {
    return this.ctx.actor;
  }
  /** Restrict one caller without changing the shared badge or any other tool's client. */
  withSourcePolicy(policy, signal) {
    signal?.throwIfAborted();
    if (policy.mode === "direct" && policy.actorId !== this.actor.id) throw new Error("Source policy must name this call's selected actor.");
    const sourceContext = Object.freeze({
      ...parseSourcePolicyHeader(sourcePolicyHeader({ policy })),
      ...signal ? { signal } : {}
    });
    return new _Home(this.sourceScoped(sourceContext));
  }
  sourceScoped(sourceContext) {
    const client = new DaemonClient(this.ctx.client.base, this.ctx.home, sourceContext.signal, sourceContext);
    this.ctx.reclaimOn?.(client);
    let record;
    const homes = () => record ??= readHomeRecord(client, this.ctx.birthHome);
    return { ...this.ctx, client, sourceContext, homes, homeOf: async (id) => homeAddressOf(await homes(), id) };
  }
  /**
   * A canvas to work: no ref means the directory's canvas resolved the way
   * every CLI command resolves it (marker walk, home default, only-one); a
   * ref is an id or unique title prefix, `--canvas`'s own matching.
   */
  async canvas(ref) {
    return reaching(this.ctx.client.base, async () => {
      const ctx = this.ctx.sourceContext ? this.sourceScoped(await sourceContextForCanvas(this.ctx, ref)) : this.ctx;
      const record = ref === void 0 ? await resolveCanvas(ctx) : await resolveCanvasRef(ctx.client, ref, ctx.sourceContext);
      return new CanvasHandle(ctx, record);
    });
  }
};
function postedComment(threadId, commentId, receipt) {
  const op = receipt.envelope.op;
  const context = op.type === "thread.create" || op.type === "thread.reply" ? op.comment.context : void 0;
  return { threadId, commentId, ...context ? { context } : {} };
}
function activityRows(snapshot, actors, limit) {
  return actors.flatMap(
    (actor) => recentActivity(snapshot.canvas, actor.id, limit).map((entry) => ({
      who: actorNameIn(snapshot.names, actor),
      ...entry
    }))
  ).sort((a, b) => a.at < b.at ? 1 : a.at > b.at ? -1 : 0).slice(0, limit);
}
function pause(ms, signal) {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", done);
  });
}
var DEFAULT_SIZE = { width: 480, height: 360 };
var CanvasHandle = class {
  constructor(ctx, record) {
    this.ctx = ctx;
    this.record = record;
  }
  ctx;
  record;
  get id() {
    return this.record.id;
  }
  get title() {
    return this.record.title;
  }
  /** Membership verbs share the CLI's typed canvas-group helper and atomic writer boundary. */
  get groups() {
    return new CanvasGroups(this.ctx.client, this.id, () => this.ctx.actor);
  }
  /** Copy a selected graph and both content faces in one writer act. */
  async copy(refs, options = {}) {
    return this.reach(async () => {
      const target = options.to ? matchRef(await this.ctx.client.listCanvases(), options.to) : this.record;
      return new CanvasGroups(this.ctx.client, target.id, () => this.ctx.actor).copyFrom(this.id, refs, options);
    });
  }
  snapshot() {
    return this.reach(() => this.ctx.client.snapshot(this.id));
  }
  /** Every network act on this handle throws `ApiError` — see {@link reaching}. */
  reach(work) {
    return reaching(this.ctx.client.base, work);
  }
  /** Every live item, each carrying its derived kind — `--json ls`. */
  async items(options = {}) {
    const { project, canvas } = await this.snapshot();
    let items = Object.values(canvas.items);
    if (options.in !== void 0) {
      if (project.groupMode === "groups") {
        const parent = resolveCanvasGroupRef(canvas, options.in, true);
        items = options.recursive ? groupDescendants(canvas, parent.id) : groupChildren(canvas, parent.id);
      } else {
        const area = findArea(canvas, options.in);
        if (!area) throw new Error(`no area called "${options.in}"`);
        items = itemsIn(canvas, area);
      }
    }
    return items.map((item) => ({ ...item, kind: itemKind(item) }));
  }
  /** Complete current hierarchy at one revision; omission reads ambient pins. */
  async context(options = {}) {
    return this.reach(async () => {
      if (options.in === void 0 && options.rootIds === void 0) {
        if (options.includeExcluded !== void 0 || options.expectedRevision !== void 0) throw new Error("includeExcluded and expectedRevision require explicit context roots or in");
        return this.ctx.client.contextManifest(this.id);
      }
      const snapshot = await this.snapshot();
      const roots = [...(options.rootIds ?? []).map((ref) => resolveCanvasGroupRef(snapshot.canvas, ref).id)];
      if (options.in !== void 0) roots.push(resolveCanvasGroupRef(snapshot.canvas, options.in, true).id);
      return this.ctx.client.contextManifest(this.id, { rootIds: [...new Set(roots)], ...options.includeExcluded !== void 0 ? { includeExcluded: options.includeExcluded } : {}, ...options.expectedRevision !== void 0 ? { expectedRevision: options.expectedRevision } : {} });
    });
  }
  contextOfComment(threadId, commentId) {
    return this.reach(() => this.ctx.client.commentContext(this.id, threadId, commentId));
  }
  /** Live ambient layers, distinct from a current item manifest or saved request. */
  contextSummary(extras = {}, options = {}) {
    return this.reach(() => readContextSummary(this.ctx, this.id, extras, options));
  }
  /** Parsed HTML diagnostics with per-screen governing provenance and explicit coverage. */
  designAudit(options = {}) {
    return this.reach(() => readDesignAudit(this.ctx, this.id, options));
  }
  /** Submit an explicitly authored, version-checked repair and retain its before/after audit evidence. */
  designRepair(itemId, request) {
    return this.reach(() => repairDesignItem(this.ctx, { ...request, canvasId: this.id, itemId }));
  }
  /** Shared run history recovers consumed reservations across native entrances and refreshes. */
  async designReview(requestId, runId) {
    const { readDesignReviews } = await import("./design-review-reader-M6V6ZACV.mjs");
    const { designReviewPort } = await import("./design-review-node-WTGHJIZO.mjs");
    return readDesignReviews(designReviewPort(this.ctx), { canvasId: this.id, ...requestId ? { requestId } : {}, ...runId ? { runId } : {} });
  }
  /** Prepare initial review reservation; callers persist the returned immutable envelope before sending it. */
  async designReviewStart(options) {
    const { prepareDesignReviewStart } = await import("./design-review-write-O7QZ3ZK2.mjs");
    const { designReviewPort } = await import("./design-review-node-WTGHJIZO.mjs");
    return prepareDesignReviewStart(designReviewPort(this.ctx), { ...options, canvasId: this.id });
  }
  /** Prepare one conditional record, repair reservation or finish append against the captured run version. */
  async designReviewStep(options) {
    const { prepareDesignReviewStep } = await import("./design-review-write-O7QZ3ZK2.mjs");
    const { designReviewPort } = await import("./design-review-node-WTGHJIZO.mjs");
    return prepareDesignReviewStep(designReviewPort(this.ctx), { ...options, canvasId: this.id });
  }
  /** Submit a previously persisted ordinary review envelope without replacing its actor or identity. */
  async designReviewSubmit(prepared, retry = false) {
    const { submitDesignReviewWrite } = await import("./design-review-write-O7QZ3ZK2.mjs");
    const { designReviewPort } = await import("./design-review-node-WTGHJIZO.mjs");
    if (prepared.canvasId !== this.id) throw new Error("The saved review belongs to a different canvas.");
    return submitDesignReviewWrite(designReviewPort(this.ctx), prepared, { retry });
  }
  /** Capture target metadata before editing an explicit standalone repair. */
  async designRepairBasis(itemId) {
    const { captureDesignRepair } = await import("./design-repair-reader-3X3FBMCJ.mjs");
    const { designReviewPort } = await import("./design-review-node-WTGHJIZO.mjs");
    return captureDesignRepair(designReviewPort(this.ctx), { canvasId: this.id, itemId });
  }
  /** Submit a stable prepared repair with full canonical acceptance and independent consistency. */
  async designRepairSubmit(prepared, retry = false) {
    const { submitDesignRepair } = await import("./design-repair-reader-3X3FBMCJ.mjs");
    const { designReviewPort } = await import("./design-review-node-WTGHJIZO.mjs");
    if (prepared.canvasId !== this.id) throw new Error("The saved repair belongs to a different canvas.");
    return submitDesignRepair(designReviewPort(this.ctx), prepared, { retry });
  }
  /** Structured discovery shares the dock's resolver and the writer's refusing acts. */
  designQuestions(options = {}) {
    return this.reach(() => readDesignQuestions(questionnairePort(this.ctx), this.id, options));
  }
  /** The saved intent owns its IDs so lost delivery can be retried without another question. */
  designAsk(request) {
    return this.reach(() => askDesignQuestions(questionnairePort(this.ctx), { ...request, canvasId: this.id }));
  }
  /** Submit as this connection's actor; the writer resolves respondent custody and current source. */
  designAnswer(request) {
    return this.reach(() => answerDesignQuestions(questionnairePort(this.ctx), { ...request, canvasId: this.id }));
  }
  /** Reads retained answer bytes by reference ID rather than silently opening a newer item version. */
  designReference(request) {
    return this.reach(() => readDesignReference(questionnairePort(this.ctx), this.id, request));
  }
  /** Eligibility comes from registry-backed writer classification, not the display-only agent map. */
  designRespondents() {
    return this.reach(() => this.ctx.client.questionnaireActors(this.id));
  }
  /** Read exact comparisons and authored decision history without changing the selected option. */
  designComparisons(filter = {}) {
    return this.reach(() => readDesignComparisons(designDecisionPort(this.ctx), { canvasId: this.id, filter }));
  }
  /** Publish one immutable comparison or an explicit linked reissue with stable source identities. */
  designCompare(request) {
    return this.reach(() => publishDesignComparison(designDecisionPort(this.ctx), { ...request, canvasId: this.id }));
  }
  /** Request revision, delegate, skip or dismiss without adopting output or inventing a human answer. */
  designRespond(request) {
    return this.reach(() => respondDesignComparison(designDecisionPort(this.ctx), { ...request, canvasId: this.id }));
  }
  /** Adopt the exact captured target and record its actual decision author in one undoable act. */
  designDecide(request) {
    return this.reach(() => submitDesignDecision(designDecisionPort(this.ctx), { ...request, canvasId: this.id }));
  }
  /** Open retained option bytes by exact comparison source, never by the latest item version. */
  designComparisonReference(request) {
    return this.reach(() => readDesignComparisonReference(designDecisionPort(this.ctx), { ...request, canvasId: this.id }));
  }
  /** One on-demand procedure and current next-step plan, using this canvas's shared rollout policy. */
  async designWorkflow(filter = {}) {
    const { designReviewPort } = await import("./design-review-node-WTGHJIZO.mjs");
    return this.reach(() => readDesignWorkflow(designReviewPort(this.ctx), { canvasId: this.id, filter }));
  }
  /** Read optional adapted craft guidance around this canvas's exact admitted request. */
  async designCraft(requestId, stage) {
    const { readDesignCraft } = await import("./design-craft-reader-QD5FXHKW.mjs");
    return this.reach(() => readDesignCraft(designRequestPort(this.ctx), { canvasId: this.id, requestId, stage }));
  }
  /** Read admitted briefs and evidence by request, source conversation or output identity. */
  designBrief(filter = {}) {
    return this.reach(() => readDesignRequests(designRequestPort(this.ctx), { canvasId: this.id, filter }));
  }
  /** Start carries stable caller-owned IDs; authenticated admission materializes the brief. */
  designStart(request) {
    return this.reach(() => startDesignRequest(designRequestPort(this.ctx), { ...request, canvasId: this.id }));
  }
  /** Conditional lifecycle changes preserve the captured brief identity and explicit resume reason. */
  designChange(request) {
    return this.reach(() => changeDesignRequest(designRequestPort(this.ctx), { ...request, canvasId: this.id }));
  }
  /** Saved receipts retain their authored check results alongside current input freshness. */
  async designReceipt(filter = {}) {
    const read = await this.designBrief(filter);
    return { receipts: read.requests.flatMap((request) => request.receipts), unavailable: read.unavailable };
  }
  /** Publish attributed evidence as its own versioned artifact after the brief completes. */
  designPublishReceipt(request) {
    return this.reach(() => publishDesignReceipt(designRequestPort(this.ctx), { ...request, canvasId: this.id }));
  }
  /** Open an exact request input or evidence version while preserving foreign-source permissions. */
  designRequestReference(request) {
    return this.reach(() => readDesignRequestReference(designRequestPort(this.ctx), { ...request, canvasId: this.id }));
  }
  /** Bounded addressed feedback with a caller-owned cursor; never marks work seen. */
  waitForFeedback(options = {}) {
    return this.reach(() => waitForFeedback(this.ctx.client, this.id, this.ctx.actor, options));
  }
  contextPage(options) {
    return this.reach(() => this.ctx.client.contextContentPage(this.id, options));
  }
  contextItem(threadId, commentId, itemId, options = {}) {
    return this.reach(() => readContextItem(this.ctx.client, this.id, threadId, commentId, itemId, options));
  }
  /** One item, by exact id, fresh from the store. */
  async item(itemId) {
    const { canvas } = await this.snapshot();
    const item = canvas.items[itemId];
    if (!item) throw new Error(`no item ${itemId} on ${this.record.title}`);
    return item;
  }
  /** Every comment thread — `--json comment list`. */
  async threads() {
    const { canvas } = await this.snapshot();
    return Object.values(canvas.threads);
  }
  /** Everyone who has touched this canvas, and whether they are here now —
   * `--json who --all`. */
  async who() {
    const sessions = await this.ctx.client.listSessions(this.id).catch(() => []);
    const { canvas, joined } = await this.snapshot();
    const known = /* @__PURE__ */ new Map();
    const add = (name, stamped, live) => {
      const id = resolveActor(joined, stamped);
      const key = name.toLowerCase();
      const prior = known.get(key);
      if (!prior) known.set(key, { name, id, live });
      else if (live) known.set(key, { ...prior, live: true });
    };
    for (const actor of [this.record.createdBy, this.record.updatedBy]) {
      add(actor.name, actor.id, false);
    }
    for (const candidate of collectCanvasNames(canvas)) add(candidate.name, candidate.id, false);
    for (const session of sessions) {
      add(session.actor.name, session.actor.id, true);
      if (session.label) add(session.label, session.actor.id, true);
    }
    return [...known.values()].sort(
      (a, b) => Number(b.live) - Number(a.live) || a.name.localeCompare(b.name)
    );
  }
  /** What everyone has been doing, newest first — `--json activity`. */
  async activity(limit = 10) {
    const snapshot = await this.snapshot();
    return activityRows(snapshot, collectCanvasActors(snapshot.canvas), limit);
  }
  /**
   * **The log as an iterator** (iso-api phase 3, journey 2): every entry that
   * lands on this canvas, in order, as an async iterator over the daemon's
   * long-poll — the same `watchLog` laps `isocan wait` lives on, without the
   * park row, the dispatch rules, or the self-filter. A raw tail: the caller
   * decides what an entry means.
   *
   * **The cursor stays with the caller.** `{ since }` in; each yielded entry
   * carries its `seq` out. A tail that dies resumes by handing back the last
   * seq it handled — the seq-cursor gesture every replica uses — and the
   * first entry the new tail yields is the one after it. Nothing here stores
   * anything: where "handled" is recorded is the caller's business.
   *
   * **A dropped connection is a pause, never an entry.** A daemon restart, an
   * upgrade, a laptop waking up — the poll fails at the connection level, the
   * cursor is unchanged, and the loop retries (starting the daemon again if
   * it is gone, `isocan wait`'s own gesture). Nothing is yielded for the
   * reconnect, so a consumer cannot mistake it for activity — the
   * auto-upgrade project's standing lesson, inherited. Ops written while the
   * connection was down are still in the log and arrive as themselves. The
   * daemon ANSWERING with a refusal is different: an `ApiError` means
   * somebody was there to say no, and it is thrown, not retried.
   */
  async *tail(options = {}) {
    const { signal } = options;
    let cursor = options.since;
    let offlineSince = null;
    let complained = false;
    for (; ; ) {
      if (signal?.aborted) return;
      let batch;
      try {
        batch = await this.ctx.client.watchLog(
          cursor === void 0 ? { only: [this.id] } : { cursors: { [this.id]: cursor }, waitMs: 3e4, only: [this.id] },
          signal
        );
      } catch (err) {
        if (signal?.aborted) return;
        if (err instanceof ApiError) throw err;
        if (offlineSince === null) offlineSince = Date.now();
        await pause(400, signal);
        if (signal?.aborted) return;
        await this.ctx.client.ensureDaemon().catch(() => {
        });
        if (!complained && Date.now() - offlineSince > 3e3) {
          complained = true;
          console.error(
            "tail: the daemon stopped answering \u2014 retrying, and starting it if it is gone. The cursor is unchanged; nothing that lands meanwhile is missed."
          );
        }
        continue;
      }
      if (offlineSince !== null) {
        const gap = Math.round((Date.now() - offlineSince) / 1e3);
        if (complained) console.error(`tail: daemon back after ${gap}s \u2014 still tailing, nothing missed`);
        offlineSince = null;
        complained = false;
      }
      cursor = batch.cursors[this.id] ?? cursor ?? 0;
      for (const entry of batch.entries) {
        yield { ...entry, opType: entry.envelope.op.type };
      }
    }
  }
  /**
   * A new item from content held in hand, returning the item the store now
   * holds — its version stack, its `blobHash`, its resolved position. The
   * call that created it is the call that hands it back, which is what lets
   * a publisher compare bytes next run without re-listing anything.
   */
  async add(spec) {
    return this.reach(async () => {
      const snapshot = await this.snapshot();
      const containerId = spec.in !== void 0 ? resolveCanvasGroupRef(snapshot.canvas, spec.in, true).id : spec.containerId;
      if (spec.cell && !containerId) throw new Error("a cell requires a destination group");
      const data = typeof spec.content === "string" ? Buffer.from(spec.content) : spec.content;
      const filename = spec.filename ?? defaultFilename(spec.title, spec.mime);
      const upload = await this.ctx.client.uploadBlob(this.id, data, spec.mime, filename);
      const itemId = newItemId();
      const { width, height } = spec.size ?? DEFAULT_SIZE;
      const placement = spec.at ?? this.defaultPlacement(snapshot);
      const accepted = await this.ctx.client.sendOp(this.id, this.ctx.actor, {
        type: "item.add",
        itemId,
        version: {
          id: newVersionId(),
          blobHash: upload.blobHash,
          mimeType: spec.mime,
          filename,
          size: upload.size
        },
        width,
        height,
        placement,
        ...containerId !== void 0 ? { containerId, groupPlacement: spec.groupPlacement ?? (spec.at ? "exact" : "auto") } : {},
        ...spec.cell ? { cell: spec.cell } : {},
        ...spec.title !== void 0 ? { title: spec.title } : {},
        ...spec.description !== void 0 ? { description: spec.description } : {},
        ...spec.properties && Object.keys(spec.properties).length > 0 ? { properties: spec.properties } : {}
      }, void 0, void 0, void 0, snapshot.project.groupMode ?? "legacy");
      const written = accepted.envelope.op;
      if (written.type === "group.change" && written.action.kind === "apply") {
        const created = written.action.change.writes.find((write) => write.kind === "create" && write.item.id === itemId);
        if (created?.kind === "create") return created.item;
      }
      return this.item(itemId);
    });
  }
  /** The CLI's default: left of the leftmost item, origin on an empty canvas. */
  defaultPlacement({ canvas }) {
    const leftmost = Object.values(canvas.items).reduce(
      (best, item) => best === null || item.x < best.x ? item : best,
      null
    );
    return leftmost ? { anchorItemId: leftmost.id } : { x: 0, y: 0 };
  }
  /**
   * A new version of an existing item, from content in hand. Mime and
   * filename default from the version being succeeded. Returns the item with
   * its grown stack — the new version is `currentVersionId`.
   */
  async edit(itemId, spec) {
    return this.reach(async () => {
      const snapshot = await this.snapshot();
      const before = snapshot.canvas.items[itemId];
      if (!before) throw new Error(`no item ${itemId} on ${this.record.title}`);
      const current = before.versions.find((v) => v.id === before.currentVersionId);
      const mime = spec.mime ?? current?.mimeType;
      const filename = spec.filename ?? current?.filename;
      if (!mime || !filename) {
        throw new Error(`item ${itemId} has no current version to inherit from`);
      }
      const data = typeof spec.content === "string" ? Buffer.from(spec.content) : spec.content;
      const upload = await this.ctx.client.uploadBlob(this.id, data, mime, filename);
      await this.ctx.client.sendOp(this.id, this.ctx.actor, {
        type: "item.addVersion",
        itemId,
        version: {
          id: newVersionId(),
          blobHash: upload.blobHash,
          mimeType: mime,
          filename,
          size: upload.size
        }
      }, void 0, void 0, void 0, snapshot.project.groupMode ?? "legacy");
      return this.item(itemId);
    });
  }
  /**
   * **Into the trash, not out of existence** — `item.delete` is the soft one,
   * so `isocan restore` and undo both still reach it.
   *
   * Added for the docket (#206 phase 2), which is the first consumer that had
   * to take something OFF a canvas: a question somebody has answered is no
   * longer a question, the run page keeps the record, and a card that stays
   * forever is the silting `docs/research/2026-08-30-repo-admin-canvas.md`
   * names as the way this goes wrong in week two. `add` and `edit` had been
   * enough for every earlier caller because a board only ever grew.
   */
  async remove(itemId) {
    return this.reach(async () => {
      await this.ctx.client.sendOp(this.id, this.ctx.actor, { type: "item.delete", itemId });
    });
  }
  /**
   * Keep only the newest `keep` versions of an item — `isocan version prune`.
   * Not undoable, which is why a script and not a person is the usual caller:
   * a generator that publishes a version per run is the thing that silts a
   * stack, and the same generator is the right place to keep it bounded.
   * Returns the item as it stands after; a stack already within the bound
   * sends no op at all.
   */
  async pruneVersions(itemId, keep) {
    return this.reach(async () => {
      const before = await this.item(itemId);
      if (prunedVersions(before, keep).length === 0) return before;
      await this.ctx.client.sendOp(this.id, this.ctx.actor, {
        type: "item.pruneVersions",
        itemId,
        keep
      });
      return this.item(itemId);
    });
  }
  /** Properties on, properties off, a resize — the slice of `isocan set` a
   * script reaches for. Same ops, so the same undo. */
  async set(itemId, patch) {
    const meta = {
      ...patch.properties && Object.keys(patch.properties).length > 0 ? { properties: patch.properties } : {},
      ...patch.removeProperties && patch.removeProperties.length > 0 ? { removeProperties: patch.removeProperties } : {}
    };
    let did = false;
    await this.reach(async () => {
      const snapshot = await this.snapshot();
      if (snapshot.project.groupMode === "groups") {
        if (!Object.keys(meta).length && !patch.size) throw new Error("nothing to change");
        await this.groups.update(itemId, { patch: meta, ...patch.size ? { size: patch.size } : {} });
        did = true;
        return;
      }
      if (Object.keys(meta).length > 0) {
        await this.ctx.client.sendOp(this.id, this.ctx.actor, {
          type: "item.update",
          itemId,
          patch: meta
        }, void 0, void 0, void 0, "legacy");
        did = true;
      }
      if (patch.size) {
        await this.ctx.client.sendOp(this.id, this.ctx.actor, {
          type: "item.resize",
          itemId,
          width: patch.size.width,
          height: patch.size.height
        }, void 0, void 0, void 0, "legacy");
        did = true;
      }
    });
    if (!did) throw new Error("nothing to change");
  }
  /** Move an item — and what is drawn on it travels with it, the same rule
   * the CLI's `mv` and the web app's drag follow. */
  async move(itemId, x, y) {
    await this.reach(async () => {
      const snapshot = await this.snapshot();
      if (snapshot.project.groupMode === "groups") {
        await this.groups.move(itemId, { at: { x, y } });
        return;
      }
      const { canvas } = snapshot;
      const item = canvas.items[itemId];
      if (!item) throw new Error(`no item ${itemId} on ${this.record.title}`);
      const dx = x - item.x;
      const dy = y - item.y;
      const marks = annotationsOf(canvas, itemId);
      const moves = [
        { itemId, x, y },
        ...marks.map((mark) => ({ itemId: mark.id, x: mark.x + dx, y: mark.y + dy }))
      ];
      await this.ctx.client.sendOp(
        this.id,
        this.ctx.actor,
        moves.length === 1 ? { type: "item.move", ...moves[0] } : { type: "items.move", moves },
        void 0,
        void 0,
        void 0,
        "legacy"
      );
    });
  }
  /**
   * Start a thread on an item — `isocan comment add --item`'s act. A bot
   * with something to say every commit says it HERE, on the panel it is
   * about, not in the Chat: on 3 Sep 2026 one board's 137 build notices
   * were a third of the request corpus and had made the Chat unusable as a
   * channel — it noticed itself, mid-run, that it had posted 80 of a
   * thread's 96 messages.
   */
  async comment(itemId, message, options = {}) {
    return this.reach(async () => {
      const snapshot = await this.snapshot();
      const comment = await this.newComment(snapshot, message, options);
      const threadId = newThreadId();
      const receipt = await this.ctx.client.sendOp(this.id, this.ctx.actor, {
        type: "thread.create",
        threadId,
        x: 0,
        y: 0,
        anchorItemId: itemId,
        comment
      }, void 0, void 0, void 0, snapshot.project.groupMode ?? "legacy");
      return postedComment(threadId, comment.id, receipt);
    });
  }
  /** Reply in a thread that exists — `isocan comment reply`'s act. */
  async reply(threadId, message, options = {}) {
    return this.reach(async () => {
      const snapshot = await this.snapshot();
      const comment = await this.newComment(snapshot, message, options);
      const receipt = await this.ctx.client.sendOp(this.id, this.ctx.actor, { type: "thread.reply", threadId, comment }, void 0, void 0, void 0, snapshot.project.groupMode ?? "legacy");
      return postedComment(threadId, comment.id, receipt);
    });
  }
  /**
   * Say something in the Chat — `isocan notify`'s act: the main thread gets
   * the reply, or is born from the first message, with `@Name` mentions and
   * `#Title` references resolved the way every comment resolves them.
   */
  async notify(message, options = {}) {
    return this.reach(async () => {
      const snapshot = await this.snapshot();
      const comment = await this.newComment(snapshot, message, options);
      const main = mainThread(snapshot.canvas);
      if (main) {
        const receipt2 = await this.ctx.client.sendOp(this.id, this.ctx.actor, {
          type: "thread.reply",
          threadId: main.id,
          comment
        }, void 0, void 0, void 0, snapshot.project.groupMode ?? "legacy");
        return postedComment(main.id, comment.id, receipt2);
      }
      const threadId = newThreadId();
      const receipt = await this.ctx.client.sendOp(this.id, this.ctx.actor, {
        type: "thread.create",
        threadId,
        x: 0,
        y: 0,
        anchorItemId: null,
        main: true,
        comment
      }, void 0, void 0, void 0, snapshot.project.groupMode ?? "legacy");
      return postedComment(threadId, comment.id, receipt);
    });
  }
  say(message, options = {}) {
    return this.notify(message, options);
  }
  async ask(question, options = {}) {
    const words = question.trim();
    if (!words) throw new Error("ask what?");
    const body = words.startsWith("/ask") ? words : `/ask ${words}`;
    if (options.itemId) {
      const snapshot = await this.snapshot();
      const existing = itemThread(snapshot.canvas, options.itemId);
      return existing ? this.reply(existing.id, body, options) : this.comment(options.itemId, body, options);
    }
    return this.notify(body, options);
  }
  newComment(snapshot, body, options = {}) {
    return buildComment(this.ctx.client, this.id, snapshot, body, options);
  }
};
async function buildComment(client, canvasId, snapshot, body, options = {}) {
  const candidates = actorsAnswerTo(
    collectCanvasActors(snapshot.canvas),
    snapshot.names,
    snapshot.joined
  );
  const sessions = await client.listSessions(canvasId).catch(() => []);
  for (const session of sessions) {
    candidates.push(session.actor);
    if (session.label) candidates.push({ id: session.actor.id, name: session.label });
  }
  const mentions = extractMentions(body, candidates);
  const items = [.../* @__PURE__ */ new Set([
    ...extractItemRefs(body, collectItemRefCandidates(snapshot.canvas)),
    ...(options.items ?? []).map((ref) => resolveCanvasGroupRef(snapshot.canvas, ref).id),
    ...(options.rootIds ?? []).map((ref) => resolveCanvasGroupRef(snapshot.canvas, ref).id),
    ...options.in !== void 0 ? [resolveCanvasGroupRef(snapshot.canvas, options.in, true).id] : []
  ])];
  const explicit = options.in !== void 0 || options.rootIds !== void 0 || options.includeExcluded !== void 0 || options.expectedRevision !== void 0;
  if (explicit && snapshot.project.groupMode !== "groups") throw new Error("group context requires a group-enabled canvas");
  return {
    id: newCommentId(),
    body,
    ...mentions.length > 0 ? { mentions } : {},
    ...items.length > 0 ? { items } : {},
    ...explicit ? { contextRequest: { rootIds: items, ...options.includeExcluded !== void 0 ? { includeExcluded: options.includeExcluded } : {}, ...options.expectedRevision !== void 0 ? { expectedRevision: options.expectedRevision } : {} } } : {}
  };
}
function defaultFilename(title, mime) {
  const fallback = `content.${extensionFor("", mime)}`;
  return title ? filenameFromTitle(title, fallback) : fallback;
}

// packages/api/src/context-pin.ts
function resolveInheritanceLink(canvas, ref) {
  const links = memoryLinks(canvas);
  const list = links.map((item) => `  ${canvasIdOf(item)}  ${item.title}  (card ${item.id})`).join("\n");
  const exact = links.find((item) => item.id === ref || canvasIdOf(item) === ref);
  if (exact) return exact;
  const needle = ref.trim().toLowerCase();
  const starts = (value) => !!value && value.toLowerCase().startsWith(needle);
  const matches = needle ? links.filter((item) => starts(item.id) || starts(canvasIdOf(item)) || starts(item.title)) : [];
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) throw new Error(`no visible inherited source called ${JSON.stringify(ref)} here \u2014 this canvas inherits:
${list || "  nothing"}`);
  throw new Error(`ambiguous source ${JSON.stringify(ref)}; use a canvas ID:
${matches.map((item) => `  ${canvasIdOf(item)}  ${item.title}`).join("\n")}`);
}
async function readSource(io, link, home, signal) {
  const canvasId = canvasIdOf(link);
  if (!canvasId) throw new Error(`\u201C${link.title}\u201D has no source canvas address.`);
  const access = await classifyAutomaticSource(io, { canvasId, home, source: sourceOf(link) }, signal);
  if (access.kind !== "ordinary") throw new Error(access.refused);
  const request = { canvasId, expectedHome: access.expectedHome };
  const snapshot = await io.sourceSnapshot(request, signal);
  signal?.throwIfAborted();
  return { request, snapshot };
}
async function readPinSource(io, options) {
  const link = resolveInheritanceLink(options.canvas, options.from);
  const { request, snapshot } = await readSource(io, link, options.home, options.signal);
  return { itemId: link.id, canvasId: request.canvasId, title: snapshot.project.title, home: request.expectedHome, pieces: sourcePinPieces(snapshot.canvas) };
}
async function pinFromSource(io, request) {
  const { canvasId, home, actor, signal } = request;
  signal?.throwIfAborted();
  const before = assertGroupDestination(await io.snapshot(canvasId, signal), true);
  signal?.throwIfAborted();
  const link = resolveInheritanceLink(before.canvas, request.from);
  const { request: source, snapshot } = await readSource(io, link, home, signal);
  const chosen = resolveSourcePinPiece(sourcePinPieces(snapshot.canvas), request.piece);
  if (chosen.refused) throw new Error(`\u201C${chosen.title}\u201D cannot be copied: ${chosen.refused}`);
  const item = snapshot.canvas.items[chosen.itemId];
  const frozen = groupCopySource(source.canvasId, snapshot.canvas, [chosen.itemId]);
  const from = { home: source.expectedHome, canvasId: source.canvasId, canvasTitle: snapshot.project.title };
  const action = groupCopyAction(frozen, canvasId, {
    newItemId,
    newVersionId,
    containerId: null,
    ...request.at ? { at: request.at } : {},
    decorate: contextPinDecoration(from)
  });
  const provenance = { ...from, itemId: item.id, itemTitle: item.title, versionId: item.currentVersionId };
  const answer = { rootId: action.rootIds[0], itemIds: action.items.map((one) => one.id), count: action.items.length, title: chosen.title, source: provenance };
  const opId = newOpId();
  const stamp = { actor, ts: (/* @__PURE__ */ new Date()).toISOString(), opId };
  resolveGroupOperation(before, { type: "group.change", action }, stamp);
  if (request.dryRun) return { dryRun: true, ...answer };
  await transferCopyFaces(io.copyBytes(source, canvasId), copyFaces(frozen.items), { upload: true, ...signal ? { signal } : {} });
  signal?.throwIfAborted();
  const after = assertGroupDestination(await io.snapshot(canvasId, signal), true);
  signal?.throwIfAborted();
  const still = memoryLinks(after.canvas).find((one) => one.id === link.id && canvasIdOf(one) === source.canvasId);
  if (!still) throw new Error(`\u201C${link.title}\u201D is no longer a visible inherited source here \u2014 nothing was copied.`);
  resolveGroupOperation(after, { type: "group.change", action }, stamp);
  const { seq } = await io.submit(canvasId, actor, action, opId, after.project.groupMode ?? "legacy");
  return { dryRun: false, ...answer, ...seq === void 0 ? {} : { seq } };
}

// packages/api/src/operation-receipt.ts
function insertedItemBox(op, itemId) {
  if (op.type === "group.change" && op.action.kind === "apply") {
    const write = op.action.change.writes.find((entry) => entry.kind === "create" && entry.item.id === itemId);
    if (write?.kind === "create") return { x: write.item.x, y: write.item.y, width: write.item.width, height: write.item.height };
  }
  if (op.type === "item.add" && op.itemId === itemId && "x" in op.placement && "y" in op.placement) return { x: op.placement.x, y: op.placement.y, width: op.width, height: op.height };
  throw new Error(`writer receipt contains no creation geometry for ${itemId}`);
}

// packages/api/src/export.ts
import { promises as fs3 } from "node:fs";
import path3 from "node:path";
async function wholeLog(client, canvasId) {
  const archived = await client.getArchivedLog(canvasId);
  const live = await client.getLog(canvasId, 0);
  const bySeq = /* @__PURE__ */ new Map();
  for (const entry of [...archived, ...live]) bySeq.set(entry.seq, entry);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}
var pretty = (value) => JSON.stringify(value, null, 2) + "\n";
var lines = (entries) => entries.length === 0 ? "" : entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
async function writeInto(out, rel, data, written) {
  const file = path3.join(out, rel);
  await fs3.mkdir(path3.dirname(file), { recursive: true });
  await fs3.writeFile(file, data);
  written.push(rel);
}
async function present(file, size) {
  try {
    const stat = await fs3.stat(file);
    return stat.size === size || size === 0;
  } catch {
    return false;
  }
}
async function fetchBlob(client, canvasId, hash) {
  try {
    return await client.downloadBlob(canvasId, hash);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
async function exportCanvases(client, canvases, options) {
  const out = path3.resolve(options.out);
  const say = options.say ?? (() => {
  });
  const written = [];
  const rows = [];
  let names = null;
  for (const canvas of canvases) {
    const snapshot = await client.snapshot(canvas.id);
    const entries = (await wholeLog(client, canvas.id)).filter((entry) => entry.seq <= snapshot.lastSeq);
    if (!Number.isSafeInteger(snapshot.lastSeq) || snapshot.lastSeq < 0 || entries.length !== snapshot.lastSeq || entries.some((entry, index2) => entry.seq !== index2 + 1)) {
      throw new Error(`cannot export ${canvas.id} at revision ${snapshot.lastSeq}: incomplete operation history; retry after GC or restore the missing archive before making a native backup`);
    }
    names = { names: snapshot.names, colors: snapshot.colors };
    const named = blobsNamedBy(entries, { project: snapshot.project, canvas: snapshot.canvas });
    const dir = path3.join(EXPORT_LAYOUT.canvases, canvas.id);
    const index = {};
    const missing = [];
    let bytes = 0;
    if (!options.dryRun) {
      await writeInto(out, path3.join(dir, EXPORT_LAYOUT.record), pretty(snapshot.project), written);
      await writeInto(
        out,
        path3.join(dir, EXPORT_LAYOUT.snapshot),
        pretty({
          lastSeq: snapshot.lastSeq,
          items: snapshot.canvas.items,
          threads: snapshot.canvas.threads,
          agents: snapshot.canvas.agents ?? {},
          ...snapshot.canvas.groupCohorts ? { groupCohorts: snapshot.canvas.groupCohorts } : {}
        }),
        written
      );
      await writeInto(out, path3.join(dir, EXPORT_LAYOUT.trash), pretty(snapshot.canvas.trash), written);
      await writeInto(out, path3.join(dir, EXPORT_LAYOUT.oplog), lines(entries), written);
    }
    for (const [hash, meta] of named) {
      const file = blobFileName(hash, meta.filename, meta.mimeType);
      const rel = path3.join(dir, EXPORT_LAYOUT.blobs, file);
      if (options.dryRun) {
        bytes += meta.size;
        index[hash] = { file, ...meta };
        continue;
      }
      if (await present(path3.join(out, rel), meta.size)) {
        const stat = await fs3.stat(path3.join(out, rel));
        index[hash] = { file, mimeType: meta.mimeType, filename: meta.filename, size: stat.size };
        bytes += stat.size;
        continue;
      }
      const data = await fetchBlob(client, canvas.id, hash);
      if (data === null) {
        missing.push(hash);
        continue;
      }
      await writeInto(out, rel, data, written);
      index[hash] = { file, mimeType: meta.mimeType, filename: meta.filename, size: data.length };
      bytes += data.length;
    }
    if (!options.dryRun) {
      await writeInto(out, path3.join(dir, EXPORT_LAYOUT.blobIndex), pretty(index), written);
    }
    const row = {
      id: canvas.id,
      title: snapshot.project.title,
      entries: entries.length,
      lastSeq: entries.length > 0 ? entries[entries.length - 1].seq : 0,
      blobs: Object.keys(index).length,
      bytes,
      missing
    };
    rows.push(row);
    say(`${options.dryRun ? "would write" : "wrote"} ${row.title} (${row.id}): ${row.entries} ops, ${row.blobs} blobs`);
  }
  if (!options.dryRun) {
    if (names) await writeInto(out, EXPORT_LAYOUT.names, pretty(names), written);
    await writeManifest(out, client.base, options.by, rows, [], written);
  }
  return { out, from: client.base, dryRun: options.dryRun === true, canvases: rows, items: [], written };
}
async function exportItem(client, canvas, item, options) {
  const out = path3.resolve(options.out);
  const say = options.say ?? (() => {
  });
  const written = [];
  const entries = await wholeLog(client, canvas.id);
  const snapshot = await client.snapshot(canvas.id);
  const current = snapshot.canvas.items[item.id] ?? item;
  const selected = isGroupItem(current) ? groupTransformClosure(snapshot.canvas, [current.id]).map((id) => snapshot.canvas.items[id]) : [current];
  const rows = [];
  for (const item2 of selected) {
    const ops = opsTouching(entries, item2.id);
    const threads = Object.values(snapshot.canvas.threads).filter((t) => t.anchorItemId === item2.id);
    const dir = path3.join(EXPORT_LAYOUT.items, canvas.id, item2.id);
    const missing = [];
    if (!options.dryRun) {
      await writeInto(out, path3.join(dir, EXPORT_LAYOUT.item), pretty(item2), written);
      await writeInto(out, path3.join(dir, EXPORT_LAYOUT.itemOps), lines(ops), written);
      await writeInto(out, path3.join(dir, EXPORT_LAYOUT.itemThreads), pretty(threads), written);
      for (const [i, version] of item2.versions.entries()) {
        const data = await fetchBlob(client, canvas.id, version.blobHash);
        if (data === null) {
          missing.push(version.blobHash);
        }
        const name = `${String(i + 1).padStart(2, "0")}-${path3.basename(version.filename)}`;
        if (data !== null) await writeInto(out, path3.join(dir, EXPORT_LAYOUT.versions, name), data, written);
        const visual = visualFaceOf(version);
        if (visual.blobHash !== version.blobHash) {
          const visualData = await fetchBlob(client, canvas.id, visual.blobHash);
          if (visualData === null) missing.push(visual.blobHash);
          else await writeInto(out, path3.join(dir, EXPORT_LAYOUT.versions, `${String(i + 1).padStart(2, "0")}-visual-${path3.basename(visual.filename)}`), visualData, written);
        }
      }
    }
    const row = {
      canvasId: canvas.id,
      itemId: item2.id,
      title: item2.title,
      versions: item2.versions.length,
      ops: ops.length,
      missing
    };
    say(`${options.dryRun ? "would write" : "wrote"} ${row.title} (${row.itemId}): ${row.versions} versions, ${row.ops} ops`);
    rows.push(row);
  }
  if (!options.dryRun) await writeManifest(out, client.base, options.by, [], rows, written);
  return { out, from: client.base, dryRun: options.dryRun === true, canvases: [], items: rows, written };
}
async function writeManifest(out, from, by, canvases, items, written) {
  const existing = await readManifest(out);
  const canvasRows = new Map((existing?.canvases ?? []).map((r) => [r.id, r]));
  for (const row of canvases) canvasRows.set(row.id, row);
  const itemRows = new Map((existing?.items ?? []).map((r) => [`${r.canvasId}/${r.itemId}`, r]));
  for (const row of items) itemRows.set(`${row.canvasId}/${row.itemId}`, row);
  const manifest = {
    format: EXPORT_FORMAT,
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    from,
    ...by ? { by } : {},
    canvases: [...canvasRows.values()],
    items: [...itemRows.values()]
  };
  if (existing && pretty({ ...manifest, exportedAt: existing.exportedAt }) === pretty(existing)) return;
  await writeInto(out, EXPORT_LAYOUT.manifest, pretty(manifest), written);
}
async function readManifest(out) {
  try {
    const parsed = JSON.parse(await fs3.readFile(path3.join(out, EXPORT_LAYOUT.manifest), "utf8"));
    return parsed.format === EXPORT_FORMAT ? parsed : null;
  } catch {
    return null;
  }
}
async function exportedCanvasIds(dir) {
  try {
    const names = await fs3.readdir(path3.join(dir, EXPORT_LAYOUT.canvases), { withFileTypes: true });
    return names.filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => d.name).sort();
  } catch {
    return [];
  }
}
async function readLines(file) {
  const text = await fs3.readFile(file, "utf8");
  return text.split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line));
}
async function importExport(client, dir, options = {}) {
  const root = path3.resolve(dir);
  const say = options.say ?? (() => {
  });
  const ids = (await exportedCanvasIds(root)).filter((id) => !options.only || id === options.only);
  if (ids.length === 0) {
    throw new Error(
      options.only ? `${root} holds no canvas ${options.only} \u2014 \`ls ${path3.join(root, EXPORT_LAYOUT.canvases)}\` lists what it has` : `${root} is not an isocan export: no ${EXPORT_LAYOUT.canvases}/ directory with a canvas in it`
    );
  }
  const restored = [];
  const refused = [];
  for (const id of ids) {
    const canvasDir = path3.join(root, EXPORT_LAYOUT.canvases, id);
    const recordRaw = JSON.parse(await fs3.readFile(path3.join(canvasDir, EXPORT_LAYOUT.record), "utf8"));
    const title = isCanvasRecord(recordRaw) ? recordRaw.title : id;
    const entries = (await readLines(path3.join(canvasDir, EXPORT_LAYOUT.oplog))).sort((a, b) => a.seq - b.seq);
    let index = {};
    try {
      index = JSON.parse(await fs3.readFile(path3.join(canvasDir, EXPORT_LAYOUT.blobIndex), "utf8"));
    } catch {
      index = {};
    }
    const row = {
      id,
      title,
      entries: entries.length,
      blobs: Object.keys(index).length,
      uploaded: 0,
      failed: []
    };
    if (options.dryRun) {
      restored.push(row);
      say(`would restore ${title} (${id}): ${row.entries} ops, ${row.blobs} blobs`);
      continue;
    }
    try {
      await client.adopt(id, entries);
    } catch (err) {
      refused.push({ id, title, error: err.message });
      say(`refused ${title} (${id}): ${err.message}`);
      continue;
    }
    for (const [hash, meta] of Object.entries(index)) {
      try {
        const data = await fs3.readFile(path3.join(canvasDir, EXPORT_LAYOUT.blobs, meta.file));
        await client.uploadBlob(id, data, meta.mimeType, meta.filename);
        row.uploaded += 1;
      } catch (err) {
        row.failed.push({ hash, error: err.message });
      }
    }
    restored.push(row);
    say(`restored ${title} (${id}): ${row.entries} ops, ${row.uploaded}/${row.blobs} blobs`);
  }
  return { dir: root, to: client.base, dryRun: options.dryRun === true, restored, refused };
}

// packages/api/src/design-system.ts
function designSystemPort(ctx) {
  const sourceClient = async (source, signal) => {
    if (source.mode === "inherited") return automaticSourceClient(ctx, source.expectedHome, signal);
    if (normalizeHomeUrl(await contextHome(ctx, source.canvasId)) !== normalizeHomeUrl(source.expectedHome)) throw new Error("The direct source authority changed.");
    return ctx.client;
  };
  return {
    ...designAuditPort(ctx),
    get actorId() {
      return ctx.actor.id;
    },
    snapshot: (id, signal) => ctx.client.snapshot(id, signal),
    home: (id) => contextHome(ctx, id),
    upload: async (source, text, filename, mimeType, signal) => (await sourceClient(source, signal)).uploadBlob(source.canvasId, Buffer.from(text), mimeType, filename, signal),
    edit: async (source, operation, opId, signal) => {
      const client = await sourceClient(source, signal);
      await client.snapshot(source.canvasId, signal);
      return client.sendOp(source.canvasId, ctx.actor, operation, void 0, void 0, void 0, void 0, void 0, opId);
    }
  };
}

// packages/api/src/design-recipes.ts
var catalogue = [
  { id: "receiving", title: "Receiving desk", surface: "operational", summary: "A compact shipment list and receiving form with saved receipts and corrections.", audience: "A warehouse operator checking an incoming delivery", primaryTask: "Record the quantities received and correct the same receipt", states: ["empty", "loading", "validation", "save-error", "saved", "correction", "long-label", "narrow", "keyboard"] },
  { id: "field-guide", title: "A field guide to slower streets", surface: "editorial", summary: "An authored long read with a clear contents rail, comfortable measure and a saved reading position.", audience: "A curious resident preparing for a neighbourhood street walk", primaryTask: "Read the guide, find a section and save a useful passage", states: ["long-content", "navigation", "saved-passage", "empty-saves", "narrow", "keyboard"] },
  { id: "campaign", title: "Make room for repair", surface: "persuasive", summary: "A specific repair-workshop invitation with supplied synthetic facts and a complete local reservation path.", audience: "A neighbour considering their first repair workshop", primaryTask: "Understand the offer and reserve an appropriate workshop place", states: ["evidence", "validation", "submitting", "save-error", "reserved", "correction", "no-imagery", "narrow", "keyboard"] }
];
function designRecipes() {
  return catalogue;
}
async function readDesignRecipe(id) {
  const summary = catalogue.find((recipe) => recipe.id === id);
  if (!summary) throw new Error(`Unknown design reference: ${id}`);
  const content = id === "receiving" ? await import("./receiving-55CFWJUN.mjs") : id === "field-guide" ? await import("./field-guide-BFWK6DDZ.mjs") : await import("./campaign-T6UFAUNB.mjs");
  return { ...summary, html: content.html, design: content.design, htmlFilename: `${id}.html`, designFilename: "DESIGN.md" };
}

// packages/api/src/design-craft-files.ts
import { promises as fs4 } from "node:fs";
import path4 from "node:path";

// packages/api/src/craft/package-pin.ts
var impeccablePackageFiles = [
  {
    "path": "SKILL.md",
    "bytes": 11658,
    "gitBlob": "f000bc443eaaa933a0268c0206b48ffc25688d72",
    "sha256": "38c2e839e130008b6da814ab9c16f3fcbbedfdf721a9638eebd31a9e65341a7a"
  },
  {
    "path": "agents/impeccable_asset_producer.toml",
    "bytes": 7296,
    "gitBlob": "30f49ab65fff68050f4a7ba6cc389bc8ae840636",
    "sha256": "37080ea5e5b381adb7eae7a427231b0ad0dee0f0916fc1d6b673b7101a5b425b"
  },
  {
    "path": "agents/impeccable_documenter.toml",
    "bytes": 3203,
    "gitBlob": "45203ec73dc5d2509d0bd4f13e0eccbe51b4366e",
    "sha256": "2feb3768125ba6469c92a50d516727e6d42f44579165ddfd33409948e2a3803d"
  },
  {
    "path": "agents/impeccable_finish_reviewer.toml",
    "bytes": 15297,
    "gitBlob": "cdecfe4dc2bef1990ca255cdcd99c54ade23d2e9",
    "sha256": "869fa5390b84bfd00d072f5280a9002ea3e3936edf5985241be641a87f03ff7b"
  },
  {
    "path": "agents/impeccable_manual_edit_applier.toml",
    "bytes": 7032,
    "gitBlob": "469dd2da6512966a110b94e20abd18283d3689e7",
    "sha256": "6c9ce3e27ec4520ead001da3aad2a2ebba481c4e5cd22873db8890259ee579fe"
  },
  {
    "path": "agents/openai.yaml",
    "bytes": 235,
    "gitBlob": "ee6cae7726ef85d3744c1b978608668a07aefeef",
    "sha256": "cbd8bd68fa00935dd0f179adb169252629cf7ee443ea9dc7db77e7ef2cf77446"
  },
  {
    "path": "reference/adapt.md",
    "bytes": 11301,
    "gitBlob": "85f7c022f5c65baebdd8df16b996898a4f520e3a",
    "sha256": "871a8e4d749b807c693ebabd83defbd6c76e1bd2a0f53a28a460cb1308ba8634"
  },
  {
    "path": "reference/adapt.native.md",
    "bytes": 3910,
    "gitBlob": "88975b36f38bc6b709eec052d398ce8996d55d19",
    "sha256": "6acc0bf221a4ddc6e5c6438348920b2ca2393b29c4314dbde2cdc23f2b1a9639"
  },
  {
    "path": "reference/android.md",
    "bytes": 4093,
    "gitBlob": "1f67a6bb574960cccb1692f460cc5432baebad65",
    "sha256": "058f81f256134841875fd3183e06b37a023de0c877fd2b9eecd97011640791fe"
  },
  {
    "path": "reference/animate.md",
    "bytes": 5236,
    "gitBlob": "c8fb9e038bb74a125646b64c49bc39711f63e8f4",
    "sha256": "d658c48ffbe0031e8e3b318996cad6ceafe29e40aa50d5bb25e4bf1d6839dc7c"
  },
  {
    "path": "reference/audit.md",
    "bytes": 8528,
    "gitBlob": "0af13e165f6768d7b20e1d03dbd64ce36a2704ab",
    "sha256": "d5f83912eda93d42f93522bb74aeff0ea04d9c559577ec52fcccc130dd03166d"
  },
  {
    "path": "reference/audit.native.md",
    "bytes": 8364,
    "gitBlob": "321847a79680fd61908fced1ddab0ac20581aeb7",
    "sha256": "960cb922bc934adbf9192e9428ff6bec1f382038166f02a785939c93b7391067"
  },
  {
    "path": "reference/bolder.md",
    "bytes": 3564,
    "gitBlob": "0ea9bcc0eb5f94d06bb3c3b52c5079eb1d0ca22a",
    "sha256": "f964506c0fae87b3c2c1db7016ddc9be9ef970bbcf5548d684b997b5d5991586"
  },
  {
    "path": "reference/clarify.md",
    "bytes": 4590,
    "gitBlob": "4506a31c95e02b2ad918367a0ef4461643d51532",
    "sha256": "173dd66abe65633910dcb04a51f40d6ff2a793f87088f022a02fc4cad24dd133"
  },
  {
    "path": "reference/colorize.md",
    "bytes": 4537,
    "gitBlob": "02fa661efac9229d6e869a20ef8ee928d4b986a0",
    "sha256": "bc5f71f1129d0f2c310d913d07c8dc609a1d25644121bd78c308f42d52a0b9e9"
  },
  {
    "path": "reference/craft-floor.md",
    "bytes": 5500,
    "gitBlob": "ae213ce801ebb2085033b309b4144e8d7e9996ba",
    "sha256": "e802e4f7bdc89050a9c0f2ca506e1d493a2316e6e810c0336c57aa073717ef3e"
  },
  {
    "path": "reference/craft.md",
    "bytes": 555,
    "gitBlob": "dbbc9402c07cdab21f2b6eb69279b8435fecfd7f",
    "sha256": "9205e222bc6565b37fb504ceec93233c2d2a456802b69d16e6b1c44723907c4c"
  },
  {
    "path": "reference/critique.md",
    "bytes": 45944,
    "gitBlob": "c1285ca137d9aa1280e538601a0e84140246fe56",
    "sha256": "cb8caddbb3919e5bf7f252143b519fb16db28a244642d937b186cb89962d9201"
  },
  {
    "path": "reference/degraded/asset-producer.md",
    "bytes": 7458,
    "gitBlob": "903b977764fd1a6e864e0862a7d1d695a7c4a6e8",
    "sha256": "a8547c8565979894f0c07f92a96ac2a38e681a31fbf155ffeefc7566e185d9c2"
  },
  {
    "path": "reference/degraded/documenter.md",
    "bytes": 3325,
    "gitBlob": "e9dfb799bcece32233386bf9702bc3141d56d196",
    "sha256": "bcc05ea92faebb5c74037a9d4263a5ce9a56f5ab07c8ab3c59ee704d8cade745"
  },
  {
    "path": "reference/degraded/finish-reviewer.md",
    "bytes": 15397,
    "gitBlob": "b5a131005b3bb617dbdfec584ac79100e17af02f",
    "sha256": "5f24c5a97b4ffcabc7c432b064cfdd04c7a2ad52f52e765be648dc0aadab8f38"
  },
  {
    "path": "reference/degraded/manual-edit-applier.md",
    "bytes": 7196,
    "gitBlob": "ef5095b924623ce04e02188a6790ebd98a273bcd",
    "sha256": "5fae7f8a2fc3ddd49ad0a413446dc44daedef5b6b7de5eb935bd2fbfad646d58"
  },
  {
    "path": "reference/delight.md",
    "bytes": 3716,
    "gitBlob": "60a8e83ee48d50901acfa886d3ec4bc72b40ec6f",
    "sha256": "098a891028ce59c212b747d3c70468dd750aff7053a703d1336045ed31e0da7c"
  },
  {
    "path": "reference/distill.md",
    "bytes": 5717,
    "gitBlob": "13f6cd5840c2030406c8fa59b70cb5fa86c239ab",
    "sha256": "ea8432c90c30ecb0426662a681ead5c0941113079704e1a766cda09e85b15b4f"
  },
  {
    "path": "reference/doctor.md",
    "bytes": 5481,
    "gitBlob": "2d41282821fab74e95165d0277d9d561e32311b9",
    "sha256": "a98b397cedeeaa1da57f3395b3d9b6c1fc477f4247fb9dc13e4da3da588283ff"
  },
  {
    "path": "reference/document.md",
    "bytes": 27521,
    "gitBlob": "83abb54b8ea773577a464f08ab78beaa411f4c70",
    "sha256": "3673248740bcdd1122ccc610093ba2fe52f3943a61ce0b7170b74dc49e5b6098"
  },
  {
    "path": "reference/extract.md",
    "bytes": 3433,
    "gitBlob": "7e98bd04605aaa8e6e7200deff5fe5cd5cc28841",
    "sha256": "31b90048c0b540daec46762a10c2b6b6434737a89af005054d8b848d829d003b"
  },
  {
    "path": "reference/harden.md",
    "bytes": 9450,
    "gitBlob": "124742e1cca3caff2c495009a8f408382e73e7d1",
    "sha256": "16ba7fca1973c5faf53dd2ca523559129c0fe9e5f8d50b645f527afa78186cd2"
  },
  {
    "path": "reference/hooks.md",
    "bytes": 13312,
    "gitBlob": "bf297ed66bc9242760177d7375e921d0302e267c",
    "sha256": "12fefe52d80d25014e5f7e2f9b278275a675653d3d99ae8f0ecf344cdb9abbe6"
  },
  {
    "path": "reference/init.md",
    "bytes": 11536,
    "gitBlob": "0612fdde8a82dfe585a0a84eaaee833a5f0b146a",
    "sha256": "bb069b43c09109d7031b0374e31955749fec657b252d39782f11e8985aca2b51"
  },
  {
    "path": "reference/ios.md",
    "bytes": 3812,
    "gitBlob": "c6244dfe32176e5718d86211b7d1eb5601eb0860",
    "sha256": "40c87038b5f75147a5952a96237acf312a327bf70c1bcd8e0a5f064625ae9668"
  },
  {
    "path": "reference/layout.md",
    "bytes": 5161,
    "gitBlob": "aa547c742fc373bc459bdbb7977683441aa48ec0",
    "sha256": "0bc7d7971b3edf2acd0580e847458dc6d84129d90715b452799ace3bed815c7c"
  },
  {
    "path": "reference/live-setup.md",
    "bytes": 8186,
    "gitBlob": "6e10f00f7f2a789da582f38cdaef89de39ead266",
    "sha256": "2b5b2fbf5f658f34ea1997fb1aeebe01604d05187f75c6a4f1f55a5bc78520a4"
  },
  {
    "path": "reference/live.md",
    "bytes": 36490,
    "gitBlob": "fb85b3fdd99f94c78752da4c4d2d2c06bdaa1439",
    "sha256": "68c5636a7858dd0b5137a9229c15e25fdc2ee40a0f8a4e9d809f78e809256262"
  },
  {
    "path": "reference/new-work.md",
    "bytes": 52769,
    "gitBlob": "cd2a22b98eac53ddfe5c2d61b4a31be693e58fe4",
    "sha256": "85b9c2d051de94ee9129c58be111946f73035ca62bbd2a3936f4fa48768fe5cf"
  },
  {
    "path": "reference/onboard.md",
    "bytes": 7740,
    "gitBlob": "90e33916ef348f050681d400a67e5745bfdb6d41",
    "sha256": "ef2dde00030580ed2765cbf7be9b2ea4a6f64cb915b804fd6f6abcf38051c7b9"
  },
  {
    "path": "reference/operate.md",
    "bytes": 4145,
    "gitBlob": "524f2c3ae9fa497284e9699f3ca5320cce5d05cf",
    "sha256": "a9d2203acd45ca33a13d5c68b02b23ed512425ac15f0e8438318ed124b43729d"
  },
  {
    "path": "reference/optimize.md",
    "bytes": 7614,
    "gitBlob": "fc56c22376854d77e8099b925232bba25001e5e6",
    "sha256": "f672ef8251a3ed4051a053d30819664951b17540b2899acd27d20e500c234abc"
  },
  {
    "path": "reference/overdrive.md",
    "bytes": 9178,
    "gitBlob": "34dface28cb99425f4153ee08447220ea1839b79",
    "sha256": "fce6688138d2ceb1e3d2cde5231f54b1d8dc8748b4c95a7919aa83b6f924cf96"
  },
  {
    "path": "reference/polish.md",
    "bytes": 6646,
    "gitBlob": "f93170f773cac058f51e289603aed7575d62a6a2",
    "sha256": "81666fc7f783b4e3514db6554e713dc0479bd9cdedb06e93d15f8b579aae869a"
  },
  {
    "path": "reference/quieter.md",
    "bytes": 4952,
    "gitBlob": "870ea86599bebf65509291df22533e4b5c3d4ceb",
    "sha256": "190a4e642ca362d7499f3c3ab123e21f18f75457d11f072b545a183f296e6495"
  },
  {
    "path": "reference/routing.md",
    "bytes": 3257,
    "gitBlob": "6d48b47a02dece1f9edf2f071dba9f674433c8ba",
    "sha256": "ef0b8eca20e1321cf7216fd0bda41ce54b0cca197cfd1b075eb51f3436f59059"
  },
  {
    "path": "reference/shape.md",
    "bytes": 3547,
    "gitBlob": "90a74ae813331cbce8fff6beb498ced77970fadf",
    "sha256": "a55f016c046cb6a27c55bd7f346375aeb506a755c4fbca19a5f92dbd42309c23"
  },
  {
    "path": "reference/typeset.md",
    "bytes": 5256,
    "gitBlob": "6f117f429cdefe60c0a07cbd5f02f72a40eb8a7d",
    "sha256": "442749aed338f51c1a3ccfb182c6ade9b74b90590b67984062ac94a5b100e914"
  },
  {
    "path": "reference/visualize.md",
    "bytes": 11757,
    "gitBlob": "f4dc6613eff861e34aa9123392afc9e59b0ca3a2",
    "sha256": "896da399bafcffb0623bdd81bb18709d6eab25c9d5917e739c8798f31ff0d076"
  },
  {
    "path": "scripts/VERSION",
    "bytes": 6,
    "gitBlob": "9faa1b7a7339db85692f91ad4b922554624a3ef7",
    "sha256": "800cf1c0392b24de7c0a1c6ea6778ecb433dec71c49a150bce96a98477527b2f"
  },
  {
    "path": "scripts/command-metadata.json",
    "bytes": 7934,
    "gitBlob": "dad8ef2e0ca304f6a0fe48c0c6b90880df93e01b",
    "sha256": "6bdbc3f745ceee15e10b050f109ce42bbeb53ab3c3b5239257de1d596654dee7"
  },
  {
    "path": "scripts/data/font-index-failures.json",
    "bytes": 2437,
    "gitBlob": "1aca67220413ef163570c75405b444d7a27a32be",
    "sha256": "835f19a0a3812f3652dd6979a2ce5597f654fd01f26e1b420b92d5f42b997ce4"
  },
  {
    "path": "scripts/data/font-index.json",
    "bytes": 1100013,
    "gitBlob": "9d2029971df232a72ff6584d264c104490521742",
    "sha256": "47edbdfaf27073c47033d1ac7dfee881be49e2dcbda7671d1157300481dde6da"
  },
  {
    "path": "scripts/impeccable",
    "bytes": 8514,
    "gitBlob": "eb60f8667dd6924bc6271e9e1a0761ea5f945751",
    "sha256": "39d9600489073e227e4f4d55c451ce4252a6632ed7ae37923efbbcbc91f16d07"
  },
  {
    "path": "scripts/impeccable.cmd",
    "bytes": 8472,
    "gitBlob": "7ebe419bfe5b58c6214e39e8ce566181c72781d2",
    "sha256": "759bab1d8adc071fdde2efcf6e2157aa4026f3c2b4f3c342a8070bf328011616"
  },
  {
    "path": "scripts/live-browser-dom.js",
    "bytes": 4917,
    "gitBlob": "e85c95c43ead132f04fe61dc3d0bf90b04e22d37",
    "sha256": "de1b7404f4cdfd7b515196afb17b74b1980f0bc88cb8681ae93a76ca48ec7bdb"
  },
  {
    "path": "scripts/live-browser-ignores.js",
    "bytes": 10346,
    "gitBlob": "1c8514c7bcd8b8d889a1763965326fb6adec24a1",
    "sha256": "c1cb6877ca99a0c1b38ba0c7d59f32702d3022f6821d8045f7133f7c40b6362f"
  },
  {
    "path": "scripts/live-browser-session.js",
    "bytes": 4090,
    "gitBlob": "1514bf472a5bb6dffdec1c67176713e3fab47af6",
    "sha256": "edddeb3fad88adec9a055b1bf9d5c75418cbe97a13b1a7f6765e73249e482563"
  },
  {
    "path": "scripts/live-browser.js",
    "bytes": 522871,
    "gitBlob": "ac6f185861ed917d88f039a696b0602a1b7ad9f2",
    "sha256": "7af0a8665057c83b39bca2c8c7427ef2343734f70d4128c377113a6726a1e3b1"
  },
  {
    "path": "scripts/modern-screenshot.umd.js",
    "bytes": 29290,
    "gitBlob": "a9c5208f6b141d3bafdb8eb843d6fcbdcf23e370",
    "sha256": "bb36665889124a0b6e15f16045265737449c3bdcf2712cdb08af3cfa01563e2b"
  }
];

// packages/api/src/design-craft-files.ts
async function boundedFile(root, relative, max) {
  let file = root;
  for (const part of ["", ...relative.split("/")]) {
    if (part) file = path4.join(file, part);
    const stat2 = await fs4.lstat(file);
    if (stat2.isSymbolicLink()) throw new Error(`Refusing symbolic link ${relative}.`);
    if (file !== path4.join(root, relative) && !stat2.isDirectory()) throw new Error(`Invalid file directory ${relative}.`);
  }
  const stat = await fs4.stat(file);
  if (!stat.isFile() || stat.size > max) throw new Error(`File ${relative} exceeds its regular-file bound.`);
  const bytes = await fs4.readFile(file);
  if (bytes.length > max) throw new Error(`File ${relative} changed beyond its bound.`);
  return bytes;
}
async function inspectDesignCraftPackage(directory) {
  const root = path4.resolve(directory), files = [];
  try {
    const stat = await fs4.lstat(root);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Package path must be a real directory.");
  } catch (error) {
    return { status: error.code === "ENOENT" ? "absent" : "drifted", directory: root, variant: "Codex skill 4.3.1", native: "unsupported/not-run", files, reason: error instanceof Error ? error.message : String(error) };
  }
  for (const expected of impeccablePackageFiles) {
    try {
      const bytes = await boundedFile(root, expected.path, expected.bytes + 1);
      files.push({ path: expected.path, status: bytes.length === expected.bytes && await craftHash(bytes) === expected.sha256 ? "verified" : "drifted" });
    } catch (error) {
      files.push({ path: expected.path, status: error.code === "ENOENT" ? "missing" : "drifted", reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return { status: files.some((file) => file.status === "drifted") ? "drifted" : files.some((file) => file.status === "missing") ? "incomplete" : "verified", directory: root, variant: "Codex skill 4.3.1", native: "unsupported/not-run", files };
}
async function exportDesignCraft(directory, value) {
  const packet = await parseDesignCraftPacket(value), root = path4.resolve(directory);
  await fs4.mkdir(root);
  for (const file of packet.files) {
    const destination = path4.join(root, file.path);
    await fs4.mkdir(path4.dirname(destination), { recursive: true });
    await fs4.writeFile(destination, craftBytes(file), { flag: "wx" });
  }
  await fs4.writeFile(path4.join(root, "CRAFT.manifest.json"), JSON.stringify(packet, null, 2) + "\n", { flag: "wx" });
  return { directory: root, packetId: packet.packetId, files: [...packet.files.map((file) => file.path), "CRAFT.manifest.json"] };
}
async function checkDesignCraftDirectory(io, options) {
  const directory = path4.resolve(options.directory);
  const packet = await parseDesignCraftPacket(JSON.parse(new TextDecoder().decode(await boundedFile(directory, "CRAFT.manifest.json", 12 * 1024 * 1024))));
  const consistency = await checkDesignCraft(io, { canvasId: options.canvasId, requestId: options.requestId, packet, ...options.signal ? { signal: options.signal } : {} });
  const files = [];
  for (const file of packet.files) {
    try {
      files.push({ path: file.path, status: await craftHash(await boundedFile(directory, file.path, 2 * 1024 * 1024)) === file.sha256 ? "unchanged" : "modified" });
    } catch (error) {
      files.push({ path: file.path, status: "unavailable", reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return { directory, ...consistency, files, notes: "Working PRODUCT/surface edits are proposed context, not canonical facts. DESIGN changes use the original projection and design reconcile. This check preserves all working files and original bases." };
}

export {
  builtinHarnesses,
  harnessVars,
  harnessSessions,
  harnessVarsFor,
  HOME_CLAIM_KEY,
  readIdentity,
  findSessionIdentity,
  claimSessionIdentity,
  noIdentityHere,
  retireStrandedIdentities,
  resolveIdentity,
  resolveExplicitIdentity,
  reclaimIdentity,
  adoptIdentity2 as adoptIdentity,
  writeIdentity,
  requireIdentity,
  DEFAULT_MODE,
  DIRECT_VAR,
  resolveDeclared,
  refuseDaemonVerb,
  resolveBase,
  baseForCwd,
  resolveCtx,
  readHomeRecord,
  homeAddressOf,
  resolveCanvas,
  resolveCanvasRef,
  sourceContextForCanvas,
  matchRef,
  ensureDirBinding,
  questionnairePort,
  designDecisionPort,
  waitForFeedback,
  waitForResolvedFeedback,
  connect,
  claimSession,
  Home,
  activityRows,
  CanvasHandle,
  buildComment,
  readPinSource,
  pinFromSource,
  insertedItemBox,
  wholeLog,
  exportCanvases,
  exportItem,
  readManifest,
  exportedCanvasIds,
  importExport,
  designSystemPort,
  designRecipes,
  readDesignRecipe,
  inspectDesignCraftPackage,
  exportDesignCraft,
  checkDesignCraftDirectory
};
