import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  ApiError,
  CLAIM_REFUSAL,
  PARK_ADOPTED_CODE,
  SYSTEM_ACTOR,
  actorNameIn,
  answerPolicy,
  canvasUrl,
  collectCanvasActors,
  dispatchReason,
  gateSetAside,
  isSystemActor,
  lapsedFor,
  mayWake,
  newId,
  ownersWord,
  policyWords,
  rulesOf,
  speakersFor,
  turnedAway,
  turnedAwayLine
} from "./chunk-SVVLIUYC.mjs";

// packages/rc/src/guards.ts
function gateTurn(state, hasPersonWord, limits, now) {
  if (!hasPersonWord && state.agentChain >= limits.agentChain) {
    const announce = state.held !== "cycle";
    state.held = "cycle";
    return { verdict: "hold-cycle", announce };
  }
  const hourAgo = now - 36e5;
  state.turnTimes = state.turnTimes.filter((t) => t > hourAgo);
  if (state.turnTimes.length >= limits.turnsPerHour) {
    const freesAt = state.turnTimes[0] + 36e5;
    const announce = state.held !== "ceiling";
    state.held = "ceiling";
    return {
      verdict: "hold-ceiling",
      announce,
      freesAt,
      retryAfter: Math.min(freesAt, now + 6e4)
    };
  }
  state.held = null;
  state.turnTimes.push(now);
  state.agentChain = hasPersonWord ? 0 : state.agentChain + 1;
  return { verdict: "dispatch" };
}

// packages/rc/src/helpers.ts
function itemCenter(item) {
  return { x: item.x + item.width / 2, y: item.y + item.height / 2 };
}
function threadLocus(snapshot, thread) {
  const anchor = thread.anchorItemId ? snapshot.canvas.items[thread.anchorItemId] : void 0;
  return anchor ? { x: anchor.x + thread.x, y: anchor.y + thread.y } : { x: thread.x, y: thread.y };
}
function actorNamesOn(snapshot) {
  const names = new Map(Object.entries(snapshot.names ?? {}));
  for (const actor of collectCanvasActors(snapshot.canvas)) {
    if (!names.has(actor.id)) names.set(actor.id, actorNameIn(snapshot.names, actor));
  }
  return names;
}
function nameResolver(snapshot) {
  const names = actorNamesOn(snapshot);
  return (actorId) => names.get(actorId);
}
var summonsPrompt = (canvasTitle, agentName, payload) => `You are ${agentName}, an agent enrolled on the isocan canvas "${canvasTitle}". This is a summons: activity addressed to you arrived while nothing was running for you. Work from this directory through the \`isocan\` CLI \u2014 \`isocan --agent-help\` is the full protocol if you need orientation, and \`isocan comment reply <threadId> "\u2026"\` answers a comment. For a designed screen, HTML node or connected app, run \`isocan design workflow\` for the shared procedure, canvas policy and existing work; precise edits and archive imports do not start a new interview. Address what the payload below carries, reply on its thread, and then simply finish your turn: do NOT run \`isocan wait\` \u2014 your session rests when you stop, and new activity summons you again.

The payload (the same shape \`isocan wait --json\` returns):
` + JSON.stringify(payload, null, 2);

// packages/rc/src/room.ts
var RoomHold = class extends Error {
  constructor(line, retryAfter) {
    super(line);
    this.line = line;
    this.retryAfter = retryAfter;
    this.name = "RoomHold";
  }
  line;
  retryAfter;
};
function mapState(map = /* @__PURE__ */ new Map()) {
  return {
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, value);
    },
    delete: async (key) => {
      map.delete(key);
    }
  };
}
var keys = {
  guard: (actorId) => `guard:${actorId}`,
  session: (actorId) => `session:${actorId}`,
  origins: (actorId) => `origins:${actorId}`,
  gateSaid: (canvasId, key) => `said:${canvasId}:gate:${key}`,
  turnedAwaySaid: (canvasId, key) => `said:${canvasId}:turned-away:${key}`,
  /** An agent another badge holds: its cursor was refused `not-your-actor`,
   * and that was said. Deleted when a later start parks it. */
  notHeldSaid: (canvasId, actorId) => `said:${canvasId}:not-held:${actorId}`
};
var NOT_YOUR_ACTOR = "not-your-actor";
var heldElsewhere = (err) => err instanceof ApiError && err.code === "name-taken" && err.reason === CLAIM_REFUSAL.heldElsewhere;
function runRoom(deps) {
  const life = new AbortController();
  let announcement = null;
  const stop = async () => {
    life.abort();
    const announced = announcement;
    announcement = null;
    await Promise.all([
      deps.routes.rcRelease?.({ canvasId: deps.canvas.id }).catch(() => {
      }),
      announced ? deps.routes.endSession(deps.canvas.id, announced.sessionId).catch(() => {
      }) : void 0
    ]);
  };
  const done = room(deps, life.signal, (made) => {
    announcement = made;
  });
  return { stop, done };
}
async function room(deps, life, announce) {
  const { routes, rows, state, clock } = deps;
  const p = deps.canvas;
  const narrate = deps.narrate;
  const sleep = (ms) => deps.sleep(ms, life);
  const rosterOf = async () => {
    const snapshot = await routes.snapshot(p.id);
    return snapshot.canvas.agents ?? {};
  };
  const rcCwd = deps.cwd;
  const reap = async (roster) => {
    for (const row of await rows.list()) {
      if (row.canvasId === p.id && !roster[row.actorId]) await rows.remove(p.id, row.actorId);
    }
  };
  const reconcile = async (roster) => {
    for (const record of Object.values(roster)) {
      if (notHeld.has(record.actor.id)) continue;
      await rows.adopt({
        canvasId: p.id,
        actorId: record.actor.id,
        name: record.actor.name,
        harness: null,
        cwd: rcCwd,
        sessionId: null
      });
    }
    await reap(roster);
  };
  const known = /* @__PURE__ */ new Map();
  const opening = await rosterOf();
  for (const [id, row] of Object.entries(opening)) known.set(id, row.actor.name);
  const dispatches = /* @__PURE__ */ new Map();
  const notHeld = /* @__PURE__ */ new Set();
  const sayNotHeld = async (actorId) => {
    const key = keys.notHeldSaid(p.id, actorId);
    if (await state.get(key)) return;
    await state.set(key, true);
    const name = known.get(actorId) ?? actorId;
    narrate(`${name} is not held by this machine \u2014 a pass from whoever holds ${name} hands it over`);
  };
  const standDownNotHeld = async (actorId) => {
    dispatches.delete(actorId);
    notHeld.add(actorId);
    await sayNotHeld(actorId);
  };
  const enrolSeqs = /* @__PURE__ */ new Map();
  for (const entry of await routes.getLog(p.id, 0)) {
    if (entry.envelope.op.type === "agent.enroll") {
      enrolSeqs.set(entry.envelope.op.agent.id, entry.seq);
    }
  }
  const parkAgent = async (actorId, own, seedAt) => {
    if (dispatches.has(actorId)) return "held";
    if (notHeld.has(actorId)) return "not-held";
    const name = known.get(actorId);
    if (own && name !== void 0) {
      let elsewhere = false;
      await deps.agentKey(name).then((sessionKey) => routes.claimActor({ type: "actor.claim", sessionKey, as: actorId })).catch((err) => {
        elsewhere = heldElsewhere(err);
      });
      if (elsewhere) {
        notHeld.add(actorId);
        return "not-held";
      }
    }
    try {
      const floor = seedAt ?? enrolSeqs.get(actorId);
      const claim = await routes.parkClaim({
        canvasId: p.id,
        actorId,
        ...floor !== void 0 ? { seedAt: floor } : {}
      });
      dispatches.set(actorId, {
        parkId: claim.parkId,
        cursor: claim.cursor,
        redeliverUpTo: claim.redeliverUpTo,
        pending: [],
        scannedTip: claim.cursor,
        busy: false,
        retryAfter: 0
      });
      await state.delete(keys.notHeldSaid(p.id, actorId));
      return "held";
    } catch (err) {
      if (err instanceof ApiError && err.code === NOT_YOUR_ACTOR) {
        notHeld.add(actorId);
        return "not-held";
      }
      return { error: err };
    }
  };
  const couldNotHold = (actorId, error) => narrate(`could not hold ${known.get(actorId) ?? actorId}'s cursor \u2014 ${error.message}`);
  const ownRow = async (actorId) => (await rows.list()).some((r) => r.canvasId === p.id && r.actorId === actorId);
  const openingSays = [];
  {
    const mine = new Set((await rows.list()).filter((r) => r.canvasId === p.id).map((r) => r.actorId));
    for (const actorId of Object.keys(opening)) {
      const parked = await parkAgent(actorId, mine.has(actorId));
      if (parked === "not-held") openingSays.push(() => sayNotHeld(actorId));
      else if (parked !== "held") openingSays.push(async () => couldNotHold(actorId, parked.error));
    }
  }
  await reconcile(opening);
  const owner = { id: deps.owner.id, name: deps.owner.name };
  const keeping = { owner, hands: [owner.id] };
  let handsAt = 0;
  const refreshHands = async () => {
    if (clock.now() - handsAt < 1e4) return;
    handsAt = clock.now();
    const bound = await routes.actorBindings().catch(() => []);
    const mine = await rows.list().catch(() => []);
    keeping.hands = [.../* @__PURE__ */ new Set([owner.id, ...mine.map((r) => r.actorId), ...bound.map((b) => b.actor.id)])];
  };
  await refreshHands();
  const policyState = {
    roster: opening,
    joined: void 0,
    nameOf: (id) => known.get(id)
  };
  {
    const first = await routes.snapshot(p.id).catch(() => null);
    policyState.joined = first?.joined;
    if (first) policyState.nameOf = nameResolver(first);
  }
  const policyOf = (record) => answerPolicy(rulesOf(record.rules), keeping, record.writtenBy?.id, policyState.joined);
  const policyLine = (record) => policyWords(policyOf(record), (id) => known.get(id) ?? policyState.nameOf(id), owner.id, policyState.joined) ?? "listens to everyone";
  const sayPolicy = async (record) => {
    const key = keys.gateSaid(
      p.id,
      `${record.actor.id} ${record.writtenBy?.id ?? ""} ${JSON.stringify(rulesOf(record.rules).listen ?? null)}`
    );
    if (await state.get(key)) return;
    await state.set(key, true);
    if (gateSetAside(rulesOf(record.rules), keeping, record.writtenBy?.id, policyState.joined)) {
      narrate(
        `${record.actor.name}'s gate was last written by ${record.writtenBy?.name ?? "somebody else"}, not you \u2014 answering only you until you say otherwise: isocan rc listen ${record.actor.name} --to <names|everyone>`
      );
    }
  };
  const announced = await routes.createSession(p.id, deps.owner, void 0, void 0, "rc").catch(() => null);
  if (announced && life.aborted) {
    await routes.endSession(p.id, announced.sessionId).catch(() => {
    });
    return;
  }
  announce(announced);
  narrate(`answering on "${p.title}" \u2014 ${canvasUrl(deps.origin, p.id)}`);
  const enrolledCount = Object.keys(opening).length;
  narrate(
    enrolledCount === 0 ? "nobody is enrolled yet \u2014 Add an agent in the tray at that address; this rc picks it up without a restart" : `${enrolledCount} ${enrolledCount === 1 ? "agent" : "agents"} enrolled (\`isocan who\` names them) \u2014 quiet until something arrives (Ctrl-C stops answering)`
  );
  if (enrolledCount > 0) {
    const byWords = /* @__PURE__ */ new Map();
    for (const record of Object.values(opening)) {
      if (notHeld.has(record.actor.id)) continue;
      const words = policyLine(record);
      byWords.set(words, [...byWords.get(words) ?? [], record.actor.name]);
      await sayPolicy(record);
    }
    for (const [words, names] of byWords) {
      const narrowed = words !== "listens to everyone";
      narrate(
        `${names.join(", ")} ${names.length === 1 ? words : words.replace(/^listens/, "listen")}` + (narrowed ? " \u2014 `isocan rc listen <name> --to <names|everyone>` widens one" : "")
      );
    }
  }
  for (const say of openingSays) await say();
  const guardOf = async (actorId) => await state.get(keys.guard(actorId)) ?? { turnTimes: [], agentChain: 0, held: null };
  const originsOf = async (actorId) => {
    const said = await state.get(keys.origins(actorId));
    return said ? new Set(said) : void 0;
  };
  const TURNS_PER_HOUR = deps.limits.turnsPerHour;
  const AGENT_CHAIN = deps.limits.agentChain;
  const sayInThread = async (threadId, body) => {
    if (!threadId) return;
    await routes.sendOp(p.id, SYSTEM_ACTOR, {
      type: "thread.reply",
      threadId,
      comment: { id: newId("cmt"), body }
    }).catch(() => {
    });
  };
  const threadOf = (entries) => {
    const comment = entries.find(
      (e) => e.envelope.op.type === "thread.create" || e.envelope.op.type === "thread.reply"
    );
    return comment ? comment.envelope.op.threadId : null;
  };
  const withdrawnHere = async (actorId) => {
    const snapshot = await routes.snapshot(p.id).catch(() => null);
    return snapshot !== null && !snapshot.canvas.agents?.[actorId];
  };
  const holdOnce = () => {
    const actorIds = [...dispatches.keys()];
    const policies = {};
    for (const actorId of actorIds) {
      const record = policyState.roster[actorId];
      if (record) policies[actorId] = policyOf(record);
    }
    return routes.rcHold({ canvasId: p.id, actorIds, waitMs: 1e4, owner, policies }, life);
  };
  let holdRefusedSaid = false;
  const holdAfterRefusal = async () => {
    const mine = (await rows.list().catch(() => [])).filter(
      (r) => r.canvasId === p.id && dispatches.has(r.actorId)
    );
    for (const row of mine) {
      const name = known.get(row.actorId) ?? row.name;
      let elsewhere = false;
      await deps.agentKey(name).then((sessionKey) => routes.claimActor({ type: "actor.claim", sessionKey, as: row.actorId })).catch((err) => {
        elsewhere = heldElsewhere(err);
      });
      if (elsewhere) await standDownNotHeld(row.actorId);
    }
    try {
      return await holdOnce();
    } catch (again) {
      if (life.aborted) return null;
      if (!holdRefusedSaid) {
        holdRefusedSaid = true;
        const why = again.message;
        const named = [...dispatches.keys()].find((id) => why.includes(id));
        const who = named ? known.get(named) ?? named : [...dispatches.keys()].map((id) => known.get(id) ?? id).join(", ");
        narrate(`could not hold ${who}'s cursor \u2014 ${why}`);
      }
      await sleep(1e4);
      return null;
    }
  };
  void (async () => {
    while (!life.aborted) {
      try {
        let held;
        try {
          held = await holdOnce();
        } catch (err) {
          if (!(err instanceof ApiError && err.code === NOT_YOUR_ACTOR) || life.aborted) throw err;
          held = await holdAfterRefusal();
        }
        if (!held) continue;
        holdRefusedSaid = false;
        for (const ask of held.asks ?? []) {
          if (!ownersWord(keeping, ask.from.id, policyState.joined)) {
            narrate(`${ask.from.name} asked from the canvas to add ${ask.name} \u2014 this rc takes that only from you; nothing enrolled`);
            continue;
          }
          const via = ask.template ? ` from the template ${ask.template}` : "";
          narrate(`${ask.from.name} asked from the canvas to add ${ask.name}${via} \u2014 enrolling here`);
          try {
            await deps.enrol(ask);
          } catch (err) {
            narrate(`could not enrol ${ask.name} \u2014 ${err.message}`);
          }
        }
      } catch {
        if (life.aborted) return;
        await sleep(400);
      }
    }
  })();
  const runSummons = async (record, dispatch) => {
    const entries = dispatch.pending.splice(0);
    const tip = dispatch.scannedTip;
    try {
      await runSummonsInner(record, dispatch, entries, tip);
    } catch (err) {
      dispatch.pending.unshift(...entries);
      throw err;
    }
  };
  const runSummonsInner = async (record, dispatch, entries, tip) => {
    const flagged = dispatch.redeliverUpTo === null ? entries : entries.map((e) => e.seq <= dispatch.redeliverUpTo ? { ...e, redelivered: true } : e);
    dispatch.redeliverUpTo = null;
    const summoned = flagged.some(
      (e) => e.envelope.op.type === "thread.create" || e.envelope.op.type === "thread.reply"
    );
    const reason = summoned ? "summons" : "change";
    const from = flagged[0]?.envelope.actor.name ?? "someone";
    const authors = flagged.map((e) => e.envelope.actor.id);
    const carried = /* @__PURE__ */ new Map();
    for (const id of new Set(authors)) carried.set(id, await originsOf(id));
    await state.set(keys.origins(record.actor.id), [...speakersFor(authors, (id) => carried.get(id))]);
    const say = (line) => narrate(`${record.actor.name} \xB7 ${line}`);
    try {
      await routes.claimActor({
        type: "actor.claim",
        sessionKey: await deps.agentKey(record.actor.name),
        as: record.actor.id
      });
    } catch (err) {
      if (!heldElsewhere(err)) throw err;
      await standDownNotHeld(record.actor.id);
      return;
    }
    say(`${reason} from ${from}, ${flagged.length} ${flagged.length === 1 ? "entry" : "entries"} \u2014 starting a session`);
    try {
      await routes.parkDelivered({
        canvasId: p.id,
        actorId: record.actor.id,
        parkId: dispatch.parkId,
        tip
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === PARK_ADOPTED_CODE) {
        narrate(`another park adopted ${record.actor.name}'s cursor \u2014 standing down for it`);
        dispatches.delete(record.actor.id);
        return;
      }
      throw err;
    }
    const row = (await rows.list()).find((r) => r.canvasId === p.id && r.actorId === record.actor.id) ?? {
      canvasId: p.id,
      actorId: record.actor.id,
      name: record.actor.name,
      harness: null,
      cwd: rcCwd,
      sessionId: null
    };
    const harness = await deps.adapterFor({ ...row, name: record.actor.name });
    const firstComment = flagged.find(
      (e) => e.envelope.op.type === "thread.create" || e.envelope.op.type === "thread.reply"
    );
    const face = await routes.createSession(p.id, record.actor, void 0, harness.harness).catch(() => null);
    const threadId = firstComment ? firstComment.envelope.op.threadId : null;
    const changedItemId = (flagged[0]?.envelope.op).itemId ?? null;
    let working = null;
    if (face) {
      const snapshot = await routes.snapshot(p.id).catch(() => null);
      const thread = threadId ? snapshot?.canvas.threads[threadId] : void 0;
      const item = !threadId && changedItemId ? snapshot?.canvas.items[changedItemId] : void 0;
      working = threadId ? { kind: "working", threadId } : item ? { kind: "working", itemId: item.id } : null;
      await routes.updateSession(p.id, face.sessionId, {
        status: threadId ? "reading your comment\u2026" : "looking at what changed\u2026",
        statusSource: "lifecycle",
        ...working ? { activity: working } : {},
        ...threadId ? { onThread: threadId } : {},
        ...snapshot && thread ? { cursor: threadLocus(snapshot, thread) } : {},
        ...item ? { cursor: itemCenter(item) } : {}
      }).catch(() => {
      });
    }
    const beat = (patch) => {
      if (!face) return;
      void routes.updateSession(p.id, face.sessionId, { actor: record.actor, ...patch }).catch(() => {
      });
    };
    const heartbeat = new AbortController();
    const endHeartbeat = () => heartbeat.abort();
    life.addEventListener("abort", endHeartbeat, { once: true });
    void (async () => {
      for (; ; ) {
        await deps.sleep(6e4, heartbeat.signal);
        if (heartbeat.signal.aborted) return;
        beat({});
      }
    })();
    let agent = null;
    try {
      agent = await harness.open({
        canvasId: p.id,
        agent: record.actor,
        owner,
        face: face?.sessionId ?? null,
        threadId,
        narrate: say
      });
      const storedSession = await state.get(keys.session(record.actor.id));
      const session = await agent.ensureSession(row.cwd, row.sessionId ?? storedSession ?? null);
      await state.set(keys.session(record.actor.id), session.sessionId);
      await rows.setSessionId(p.id, record.actor.id, session.sessionId);
      say(`session ${session.resumed ? "resumed" : "started"} in ${row.cwd}`);
      let lastToolBeat = 0;
      const turn = await agent.prompt(
        session.sessionId,
        summonsPrompt(p.title, record.actor.name, { reason, entries: flagged }),
        (event) => {
          if (event.kind === "permission") say(`permission ${event.detail}`);
          if (event.kind === "tool" && event.detail && clock.now() - lastToolBeat >= 2e3) {
            lastToolBeat = clock.now();
            const title = event.detail.length > 80 ? `${event.detail.slice(0, 79)}\u2026` : event.detail;
            beat({
              status: title,
              statusSource: "inferred",
              ...working ? { activity: working } : {}
            });
          }
        }
      );
      if (!dispatches.has(record.actor.id) || turn.stopReason !== "end_turn" && await withdrawnHere(record.actor.id)) {
        say(`turn stopped \u2014 ${record.actor.name} was withdrawn`);
        return;
      }
      say(`turn ended \u2014 ${turn.stopReason}`);
      await routes.parkAdvance({ canvasId: p.id, actorId: record.actor.id, parkId: dispatch.parkId, to: tip }).then(() => {
        dispatch.cursor = tip;
      }).catch(() => {
      });
    } finally {
      endHeartbeat();
      life.removeEventListener("abort", endHeartbeat);
      if (agent) await agent.close();
      if (face) await routes.endSession(p.id, face.sessionId).catch(() => {
      });
    }
  };
  let cursors = { [p.id]: 0 };
  const lapFrom = () => {
    let from = startTip;
    for (const d of dispatches.values()) if (d.scannedTip < from) from = d.scannedTip;
    return from;
  };
  const takeUp = async (roster) => {
    for (const record of Object.values(roster)) {
      if (dispatches.has(record.actor.id) || notHeld.has(record.actor.id)) continue;
      known.set(record.actor.id, record.actor.name);
      const parked = await parkAgent(record.actor.id, await ownRow(record.actor.id));
      if (parked === "not-held") {
        await sayNotHeld(record.actor.id);
        continue;
      }
      const adopted = await rows.adopt({
        canvasId: p.id,
        actorId: record.actor.id,
        name: record.actor.name,
        harness: null,
        cwd: rcCwd,
        sessionId: null
      });
      if (adopted) narrate(`${record.actor.name} \xB7 where and how supplied \u2014 ${rcCwd}`);
      if (parked !== "held") couldNotHold(record.actor.id, parked.error);
    }
  };
  const startTip = (await routes.watchLog({ only: [p.id] })).cursors[p.id] ?? 0;
  const settled = await rosterOf();
  policyState.roster = settled;
  for (const [id, row] of Object.entries(settled)) known.set(id, row.actor.name);
  await reap(settled);
  for (const actorId of [...dispatches.keys()]) if (!settled[actorId]) dispatches.delete(actorId);
  for (const actorId of [...notHeld]) if (!settled[actorId]) notHeld.delete(actorId);
  await takeUp(settled);
  cursors = { [p.id]: lapFrom() };
  let lastRoster = settled;
  let offlineSince = null;
  while (!life.aborted) {
    let batch;
    try {
      const eager = [...dispatches.values()].some((d) => d.busy || d.pending.length > 0);
      batch = await routes.watchLog({ cursors, waitMs: eager ? 2e3 : 3e4, only: [p.id] }, life);
      if (offlineSince !== null) {
        narrate(`daemon back after ${Math.round((clock.now() - offlineSince) / 1e3)}s \u2014 nothing missed`);
        offlineSince = null;
      }
    } catch (err) {
      if (life.aborted) return;
      if (err instanceof ApiError) throw err;
      if (offlineSince === null) {
        offlineSince = clock.now();
        narrate("the daemon stopped answering \u2014 retrying, and starting it if it is gone");
      }
      await sleep(400);
      continue;
    }
    cursors = batch.cursors;
    if (announced) {
      await routes.updateSession(p.id, announced.sessionId, {}).catch(async () => {
        const again = await routes.createSession(p.id, deps.owner, void 0, void 0, "rc").catch(() => null);
        if (again) {
          announced.sessionId = again.sessionId;
          announce(announced);
        }
      });
    }
    const lapTip = batch.cursors[p.id] ?? 0;
    const snapshot = batch.entries.length > 0 || dispatches.size === 0 ? await routes.snapshot(p.id) : null;
    if (snapshot) {
      lastRoster = snapshot.canvas.agents ?? {};
      policyState.roster = lastRoster;
      policyState.joined = snapshot.joined;
      policyState.nameOf = nameResolver(snapshot);
      for (const [id, row] of Object.entries(lastRoster)) known.set(id, row.actor.name);
      if (batch.entries.some((e) => !ownersWord(keeping, e.envelope.actor.id, snapshot.joined))) {
        await refreshHands();
      }
    }
    const roster = lastRoster;
    await takeUp(roster);
    for (const entry of batch.entries) {
      const op = entry.envelope.op;
      const by = entry.envelope.actor;
      if (op.type === "agent.enroll") {
        known.set(op.agent.id, op.agent.name);
        if (entry.seq > startTip) {
          const parked = await parkAgent(op.agent.id, await ownRow(op.agent.id), entry.seq);
          if (parked === "not-held") {
            await sayNotHeld(op.agent.id);
            continue;
          }
          const record = roster[op.agent.id];
          narrate(`${by.name} enrolled ${op.agent.name} \u2014 answerable here${record ? ` \xB7 ${policyLine(record)}` : ""}`);
          if (record) await sayPolicy(record);
          const adopted = await rows.adopt({
            canvasId: p.id,
            actorId: op.agent.id,
            name: op.agent.name,
            harness: null,
            cwd: rcCwd,
            sessionId: null
          });
          if (adopted) narrate(`${op.agent.name} \xB7 where and how supplied \u2014 ${rcCwd}`);
          if (parked !== "held") couldNotHold(op.agent.id, parked.error);
        }
        continue;
      }
      if (op.type === "agent.withdraw" && entry.seq > startTip && notHeld.delete(op.actorId)) {
        continue;
      }
      if (op.type === "agent.withdraw" && entry.seq > startTip) {
        const name = known.get(op.actorId) ?? op.actorId;
        narrate(`${by.name} dismissed ${name} \u2014 no longer answering here`);
        await rows.remove(p.id, op.actorId);
        dispatches.delete(op.actorId);
        await state.delete(keys.session(op.actorId));
        continue;
      }
      for (const record of Object.values(roster)) {
        const dispatch = dispatches.get(record.actor.id);
        if (!dispatch || entry.seq <= dispatch.scannedTip) continue;
        const joined = snapshot?.joined;
        const carried = await originsOf(by.id);
        const agent = {
          actorId: record.actor.id,
          names: [{ id: record.actor.id, name: record.actor.name }],
          rules: rulesOf(record.rules),
          policy: policyOf(record),
          hands: keeping.hands,
          ...joined ? { joined } : {},
          ...carried && carried.size > 0 ? { onBehalfOf: [...carried] } : {}
        };
        const reason = dispatchReason(op, by.id, agent, snapshot?.canvas ?? null);
        if (reason) {
          dispatch.pending.push(entry);
          continue;
        }
        if (turnedAway(op, by.id, agent) && (op.type === "thread.create" || op.type === "thread.reply")) {
          const key = keys.turnedAwaySaid(p.id, `${op.threadId} ${by.id} ${record.actor.id}`);
          if (await state.get(key)) continue;
          await state.set(key, true);
          const nameOf = snapshot ? nameResolver(snapshot) : (id) => known.get(id);
          const askers = agent.onBehalfOf ? agent.onBehalfOf.filter((id) => !mayWake(agent.policy, id, joined, keeping.hands)).map((id) => nameOf(id) ?? id) : [by.name];
          const asker = askers.join(",") || by.name;
          const askerIds = agent.onBehalfOf ?? [by.id];
          const ran = askerIds.map((id) => lapsedFor(agent.policy, id, joined)).find((at) => at !== void 0);
          const line = turnedAwayLine(record.actor.name, agent.policy, nameOf, asker, { lapsed: ran });
          const already = snapshot?.canvas.threads[op.threadId]?.comments.some(
            (c) => isSystemActor(c.author.id) && c.body === line
          );
          const who = agent.onBehalfOf ? `${by.name}, for ${askers.join(" and ")},` : by.name;
          narrate(`${record.actor.name} \xB7 ${who} asked; ${policyLine(record)} \u2014 said so in the thread, nothing started`);
          if (!already) await sayInThread(op.threadId, line);
        }
      }
    }
    for (const [actorId, dispatch] of dispatches) {
      const before = dispatch.scannedTip;
      dispatch.scannedTip = Math.max(dispatch.scannedTip, lapTip);
      if (!dispatch.busy && dispatch.pending.length === 0 && dispatch.scannedTip > before) {
        await routes.parkAdvance({ canvasId: p.id, actorId, parkId: dispatch.parkId, to: dispatch.scannedTip }).then(() => {
          dispatch.cursor = dispatch.scannedTip;
        }).catch(() => {
        });
      }
    }
    for (const [actorId, dispatch] of dispatches) {
      if (dispatch.busy || dispatch.pending.length === 0) continue;
      if (clock.now() < dispatch.retryAfter) continue;
      const record = roster[actorId];
      if (!record) continue;
      const enrolledIds = new Set(Object.keys(roster));
      const hasPersonWord = dispatch.pending.some(
        (e) => !enrolledIds.has(e.envelope.actor.id) && !isSystemActor(e.envelope.actor.id)
      );
      const guard = await guardOf(actorId);
      const wasHeld = guard.held !== null;
      const verdict = gateTurn(guard, hasPersonWord, { turnsPerHour: TURNS_PER_HOUR, agentChain: AGENT_CHAIN }, clock.now());
      await state.set(keys.guard(actorId), guard);
      if (verdict.verdict === "hold-cycle") {
        if (verdict.announce) {
          const line = `${record.actor.name} paused after ${guard.agentChain} agent-to-agent ${guard.agentChain === 1 ? "turn" : "turns"} with no person in the conversation \u2014 a human word resumes it.`;
          narrate(`${line}`);
          await sayInThread(threadOf(dispatch.pending), line);
        }
        continue;
      }
      if (verdict.verdict === "hold-ceiling") {
        dispatch.retryAfter = verdict.retryAfter;
        if (verdict.announce) {
          const line = `${record.actor.name} is at its ceiling \u2014 ${TURNS_PER_HOUR} turns in the past hour. This summons waits (about ${Math.max(1, Math.round((verdict.freesAt - clock.now()) / 6e4))} min).`;
          narrate(`${line}`);
          await sayInThread(threadOf(dispatch.pending), line);
        }
        continue;
      }
      if (wasHeld) {
        narrate(`${record.actor.name}'s hold lifted \u2014 dispatching what waited`);
      }
      const failedThread = threadOf(dispatch.pending);
      dispatch.busy = true;
      void runSummons(record, dispatch).catch(async (err) => {
        if (await withdrawnHere(actorId)) {
          dispatch.pending.length = 0;
          narrate(`${record.actor.name} \xB7 turn stopped \u2014 ${record.actor.name} was withdrawn`);
          return;
        }
        if (err instanceof RoomHold) {
          narrate(`${record.actor.name} \xB7 turn held \u2014 ${err.line}`);
          await sayInThread(failedThread, err.line);
          dispatch.retryAfter = err.retryAfter;
          return;
        }
        const why = err.message;
        narrate(`${record.actor.name} \xB7 turn FAILED \u2014 ${why} (retrying in 60s)`);
        await sayInThread(
          failedThread,
          `${record.actor.name} couldn't answer \u2014 ${why}. The summons is held and will be retried; \`isocan rc\`'s log has the detail.`
        );
        dispatch.retryAfter = clock.now() + 6e4;
      }).finally(() => {
        dispatch.busy = false;
      });
    }
  }
}

// packages/rc/src/skill.ts
var COLLAB_SKILL = '---\nname: isocan-collab\ndescription: Collaborate on an isocan canvas as a visible agent \u2014 address comments, build/edit items, and run the wait-driven feedback loop via the isocan CLI. Use when asked to work on a canvas, address canvas comments, "park" and wait for feedback, or run a canvas session. Triggers on "isocan", "canvas comments", "park on the canvas", "address my comments".\n---\n\n# Collaborating on an isocan canvas\n\nisocan is an infinite shared canvas. A local daemon owns the state; the web\napp (which the human watches) and the `isocan` CLI (you) are equal clients \u2014\nevery operation you run appears on their screen live, and your presence\nrenders as a named cursor.\n\n**The instructions live in the tool.** Run this first, once per session, and\nfollow what it says:\n\n```sh\nisocan --agent-help     # the whole protocol: your name, presence, the lap,\n                        # parking on `wait`, the practices that earn trust\n```\n\nIt ships inside the CLI, so it describes the build you are actually running \u2014\nthis file cannot fall behind it. `isocan --help` is the command-by-command\nreference alongside it, and is also written for you.\n\n## If `isocan` isn\'t there\n\nThis skill can arrive without the tool (`npx skills add dglazkov/isocan`\ninstalls this file alone). If `isocan --version` fails, one command installs\nit and sets up the directory you are in \u2014 the repo is the package, no registry\ninvolved:\n\n```sh\nnpx github:dglazkov/isocan#release setup   # CLI on PATH, skill, daemon, app\n```\n\nIt is idempotent \u2014 run it whenever you land somewhere new \u2014 and it puts\n`isocan` on your PATH itself, so `isocan --agent-help` works right after.\n\nKeep the `#release` on the spec \u2014 without it npm installs nothing usable.\nSetup\'s report says where the CLI landed, and if your shell cannot see it (a\nnon-login subshell often can\'t see nvm\'s or asdf\'s directories) that line\ncarries the `export PATH=\u2026` that reaches it. Prefixing every command with\n`npx github:dglazkov/isocan#release` also works, with no install at all.\n\n## The one rule to carry in\n\n**The canvas is the channel that keeps.** The human is watching the web app,\nand so is everyone else here \u2014 what you put on the canvas is the record, and\nanything you say only in your own conversation is invisible to all of them.\nSo every lap of work ends parked on `isocan wait`, never on a summary typed\nat a person, however attentive that person is.\n\nIf somebody IS reading your terminal \u2014 you are in an IDE or an agent manager,\nand your conversation is a window they have open \u2014 then you have two channels\nand they are a team room and a DM, not two chats to keep in sync. The guide\'s\n"Who is at your terminal" says which belongs where, and how to tell which\nmode you are in. `isocan --agent-help` is how you do all of this properly; go\nread it.\n';

export {
  gateTurn,
  itemCenter,
  threadLocus,
  actorNamesOn,
  nameResolver,
  summonsPrompt,
  RoomHold,
  mapState,
  runRoom,
  COLLAB_SKILL
};
