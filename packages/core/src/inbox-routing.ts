/** Inbox and agent dispatch routing. Browser status projections stay in inbox.ts. */
import type { Actor, CanvasContents, Comment, CommentThread } from "./model.ts";
import { isSystemActor } from "./model.ts";
import type { NewComment, Operation } from "./ops.ts";
import { collectCanvasNames, extractMentions, type MentionCandidate } from "./mentions.ts";
import { sameActor, type ActorJoins } from "./identity.ts";
import type { RcPolicy } from "./protocol.ts";
import { opMatchesFilters, opTouchesAreas } from "./touches.ts";
import { LISTEN_ANYONE, parseListen, listenGrants, ownersWord, mayWake, type InboxEntry, type AgentRules, type Keeping, type ListenEntry } from "./inbox.ts";
type InboxReason = InboxEntry["reason"];


/**
 * The names you answer to. Your identity name, plus any session label you are
 * wearing — an agent called "Percy" this run is @Percy to everybody on the
 * canvas, and `wait` has always looked for both.
 */
export function namesFor(actor: Actor, label?: string | null): MentionCandidate[] {
  const names: MentionCandidate[] = [actor];
  if (label && label !== actor.name) names.push({ id: actor.id, name: label });
  return names;
}

/**
 * Does this comment address you?
 *
 * Two ways, and both matter. `comment.mentions` is resolved at authoring time
 * against the actors the author could see — the durable, exact answer. The
 * body is re-read as well because older comments predate that field, and
 * because a name you answer to NOW (a session label) may not have been
 * resolvable when the comment was written.
 *
 * Ids are compared through `joined` (multi-identity phase 5): a mention of
 * `Dimitri 2` was resolved to `Dimitri 2`'s id when it was written, and that
 * id resolves to Dimitri now, so the thread is in Dimitri's inbox. Callers
 * that have no map compare ids as they always did.
 */
export function addressesActor(
  comment: NewComment | Comment,
  names: readonly MentionCandidate[],
  joined?: ActorJoins,
): boolean {
  const self = names[0]?.id;
  if (self && (comment.mentions ?? []).some((id) => sameActor(joined, id, self))) return true;
  return extractMentions(comment.body, names as MentionCandidate[]).length > 0;
}

/**
 * Does this comment explicitly address someone else (and not you)?
 *
 * A comment in the main Chat or a shared thread that @-mentions `@Dolly` is
 * a direct question to Dolly — not a broadcast to the room or a reply to
 * everyone who ever spoke in that thread (`agent-guide.md`: "comments for
 * others ... is ether and won't wake you").
 */
function addressesOthers(
  comment: NewComment | Comment,
  names: readonly MentionCandidate[],
  joined?: ActorJoins,
  candidates?: readonly MentionCandidate[],
): boolean {
  if (addressesActor(comment, names, joined)) return false;
  if ((comment.mentions ?? []).length > 0) return true;
  if (candidates && extractMentions(comment.body, candidates as MentionCandidate[]).length > 0) {
    return true;
  }
  return false;
}

/**
 * Everything on one canvas that is addressed to this actor, oldest first.
 *
 * **Your own words are never in your inbox.** Obvious once said, and the kind
 * of thing a filter forgets: you are in every thread you wrote in, so without
 * this every comment you ever left would come back to you.
 */
/**
 * Why one comment is yours, or null when it is ether. THE routing rule,
 * stated once: named — by id or a name you answer to — or (when not
 * addressed to someone else) the main thread, or a conversation you are
 * already in. `inboxOn` folds a canvas with it and `isocan wait` decides a
 * summons with it, so a parked agent and the inbox can never disagree about
 * what is for you — and a daemon that summons agents
 * (`docs/projects/on-demand/design.md`) asks this same function rather than
 * growing a third copy.
 *
 * The comment may be a `NewComment` (an op still in flight, no author yet);
 * skipping your own words is the caller's job, since only the caller knows
 * whose they are. A missing thread (an op racing its own snapshot) can still
 * mention you; it cannot be main or already yours.
 */
export function reasonFor(
  comment: NewComment | Comment,
  thread: CommentThread | undefined,
  actorId: string,
  names: readonly MentionCandidate[],
  /** The registry's joins, when the caller holds them — see `addressesActor`. */
  joined?: ActorJoins,
  /** Known actors on the canvas, so un-resolved text mentions of other actors are recognized as for others. */
  candidates?: readonly MentionCandidate[],
): InboxReason | null {
  /**
   * **A record reports; it never summons** — the same sentence the system
   * voice earns in `dispatchReason`, for the same reason, one rung lower so
   * a record posted by a PERSON gets it too.
   *
   * A voice session's transcript lands in the Chat when the session stops,
   * and the Chat wakes everybody by design. So every parked agent was handed
   * somebody's spoken half of a conversation with a different agent and read
   * it as an ask: the screenshot that filed this shows Scout beginning to
   * answer a transcript of a person talking to Enceladus.
   *
   * **Before the mention check, deliberately**, which is the one surprising
   * thing here. Speech is transcribed, transcription is full of names, and
   * "Scout should look at this" said out loud to a voice agent is not a
   * summons to Scout — it is a sentence about Scout. A record that could page
   * somebody by mention would page somebody on nearly every long session.
   * Addressing an agent stays a deliberate act: type it, or let the agent you
   * are talking to do it as its own comment.
   *
   * It is a de-escalation and can only ever silence its own author's comment,
   * so it is safe for ordinary input to carry — see `Comment.record`.
   */
  if ((comment as Comment).record) return null;
  if (addressesActor(comment, names, joined)) return "mentioned";
  if (addressesOthers(comment, names, joined, candidates)) return null;
  if (thread?.main) return "main-thread";
  if (thread && inYourThread(thread, actorId, names, joined)) return "in-your-thread";
  return null;
}

/**
 * **Does this agent's gate admit that speaker — with no owner in sight?**
 *
 * The reading of `listen` for a caller that answers for nobody else: a
 * `wait` park is its own session, run by the person at its keyboard, so it
 * has no owner to protect and absent still admits everyone there. The rc,
 * which spends somebody's tokens on somebody's machine, reads the same field
 * through `answerPolicy` instead, where absent means its owner alone.
 *
 * A gate one surface applied and another could not describe is the failure
 * the sheepdog design names first — *"a silent gate: a person mentions a
 * sheepdog that does not listen to them and nothing says so"* — which is why
 * the rc announces its policy with its hold and `policyWords` says it.
 */
export function listensTo(
  rules: AgentRules | null | undefined,
  authorId: string,
  /** The registry's joins, when the caller holds them — a gate naming
   * `Dimitri 2` must still admit Dimitri. */
  joined?: ActorJoins,
  now: number = Date.now(),
): boolean {
  const listen = rules?.listen ?? [];
  if (listen.length === 0 || listen.includes(LISTEN_ANYONE)) return true;
  return listenGrants(listen, now).some((g) => !g.lapsed && sameActor(joined, g.id, authorId));
}

/**
 * What a stored enrolment means at the rc that answers for it — the policy it
 * applies AND the one it announces with its hold, computed once so the two
 * cannot differ.
 */
export function answerPolicy(
  rules: AgentRules | null | undefined,
  keeping: Keeping,
  /** `EnrolledAgent.writtenBy`'s id; undefined for a row older than the
   * stamp, which is taken as it stands. */
  writtenBy: string | undefined,
  joined?: ActorJoins,
): RcPolicy {
  const trusted = writtenBy === undefined || ownersWord(keeping, writtenBy, joined);
  const listen = trusted ? (rules?.listen ?? []) : [];
  if (listen.includes(LISTEN_ANYONE)) return { owner: keeping.owner, listen: [LISTEN_ANYONE] };
  // The owner is always in; naming them (`--to me`) adds nothing, and must
  // not make the words say "listens to Nico and Nico".
  const others = listen.filter((entry) => !sameActor(joined, parseListen(entry).id, keeping.owner.id));
  // Deduplicated by WHO rather than by entry, so a name granted twice with
  // two expiries is one grant — the longer one, because the owner widening a
  // grant they already gave is widening it.
  const byId = new Map<string, ListenEntry>();
  for (const entry of others) {
    const { id, until } = parseListen(entry);
    const had = byId.get(id);
    if (had === undefined) byId.set(id, entry);
    else if (until === undefined) byId.set(id, entry);
    else {
      const kept = parseListen(had).until;
      if (kept !== undefined && Date.parse(until) > Date.parse(kept)) byId.set(id, entry);
    }
  }
  // Lapsed grants are KEPT here rather than swept: the rc's refusal reads
  // this list to say *your access lapsed* instead of *you never had any*,
  // and `mayWake` is the thing that decides, not the presence of a name.
  return { owner: keeping.owner, listen: [...byId.values()] };
}

/** Whether a gate was set aside because somebody other than the owner wrote
 * it — so the rc can SAY why it answers only its owner, rather than seeming
 * to ignore a gate everybody can read. */
export function gateSetAside(
  rules: AgentRules | null | undefined,
  keeping: Keeping,
  writtenBy: string | undefined,
  joined?: ActorJoins,
): boolean {
  if (writtenBy === undefined || ownersWord(keeping, writtenBy, joined)) return false;
  return (rules?.listen ?? []).some((e) => !sameActor(joined, parseListen(e).id, keeping.owner.id));
}

/** The gate as dispatch applies it: the author, or — when the author is
 * carrying somebody's word (`onBehalfOf`) — any one of those speakers. */
function admits(
  policy: RcPolicy,
  authorId: string,
  agent: { joined?: ActorJoins | undefined; hands?: readonly string[] | undefined; onBehalfOf?: readonly string[] | undefined },
): boolean {
  const speakers = agent.onBehalfOf && agent.onBehalfOf.length > 0 ? agent.onBehalfOf : [authorId];
  return speakers.some((id) => mayWake(policy, id, agent.joined, agent.hands));
}

/**
 * **Whose word an agent's turn carries** — the provenance `onBehalfOf`
 * reads. For each author of the entries that started the turn: an agent the
 * rc runs contributes the speakers ITS turn carried (followed as far as the
 * rc has seen), anybody else contributes themselves. An agent with nothing
 * recorded — started by its owner's machine, or before this rc began —
 * speaks for itself, which is its owner's hand.
 */
export function speakersFor(
  authorIds: readonly string[],
  carried: (agentId: string) => ReadonlySet<string> | undefined,
): Set<string> {
  const out = new Set<string>();
  for (const id of authorIds) {
    const through = carried(id);
    if (through && through.size > 0) for (const s of through) out.add(s);
    else out.add(id);
  }
  return out;
}

/**
 * **Did the gate turn away a direct ask?** Only a MENTION is answered in
 * words: somebody asked this agent by name and deserves to know why nothing
 * came. The Chat being loud, or a reply in a thread the agent was once in,
 * is the room talking, and an agent narrating every sentence it did not
 * answer would be the noise the gate exists to spare.
 */
export function turnedAway(
  op: Operation,
  authorId: string,
  agent: {
    actorId: string;
    names: readonly MentionCandidate[];
    policy: RcPolicy;
    hands?: readonly string[];
    joined?: ActorJoins | undefined;
    onBehalfOf?: readonly string[] | undefined;
  },
): boolean {
  if (op.type !== "thread.create" && op.type !== "thread.reply") return false;
  // A record asked nobody for anything, so there is no refusal to narrate —
  // and an rc posting "Scout couldn't answer" under a transcript would be
  // answering a question that was never put.
  if (op.comment.record) return false;
  if (isSystemActor(authorId) || sameActor(agent.joined, authorId, agent.actorId)) return false;
  if (admits(agent.policy, authorId, agent)) return false;
  return addressesActor(op.comment, agent.names, agent.joined);
}

/**
 * **THE routing composition, stated once** (agents-on-demand phase 4).
 * `reasonFor` is the is-this-for-me predicate; this is the whole rule a
 * park or a dispatcher applies to one op:
 *
 * - your own ops never wake you — otherwise an agent that writes what it
 *   watches for wakes itself, forever;
 * - a speaker outside the gate is not here at all: `listen` is applied
 *   BEFORE everything below, so an op from outside it is neither a summons
 *   nor a change, and never reaches the ceiling to be counted against it;
 * - a comment for you (`reasonFor`) is a SUMMONS, and it comes through any
 *   filter — the human reaching you is never the noise you asked to be
 *   spared;
 * - everything else is a CHANGE, taken only when the rules ask for it:
 *   filters narrow, an empty rule set means comments-only.
 *
 * It lived as loose composition in `wait`'s loop (`main.ts` checked the
 * summons before the filters ever ran); it lives here so the rc importing
 * the rule and the park applying it cannot drift — the piercing that must
 * never differ between them is one function's control flow.
 */
/**
 * **A critic hears only its name** (critique phase 3). An agent whose
 * enrolment row on this canvas carries the `note` ceiling is a critic here,
 * asked for one thing at a time: the Chat being loud, a "thanks" in a thread
 * it was asked in, a change to an item — none of it is a critique, and each
 * used to spend a turn of its budget. So for it only `mentioned` routes.
 * Read off the canvas the op lands on, so the rc, `wait` and the inbox say
 * one thing; an uncapped agent is untouched.
 */
function mentionsOnly(canvas: CanvasContents | null | undefined, actorId: string): boolean {
  return canvas?.agents?.[actorId]?.ceiling === "note";
}

export function dispatchReason(
  op: Operation,
  authorId: string,
  agent: {
    actorId: string;
    names: readonly MentionCandidate[];
    rules?: AgentRules | null | undefined;
    /** The registry's joins, when the caller holds them — see `addressesActor`. */
    joined?: ActorJoins | undefined;
    /**
     * Whose word wakes it, from the rc that answers for it (`answerPolicy`).
     * When present it IS the gate, and the default it carries is the owner
     * alone; absent — a `wait` park, which answers for itself — the gate is
     * `rules.listen` read by `listensTo`.
     */
    policy?: RcPolicy | null | undefined;
    /** The owner's hands (`Keeping.hands`), when the caller is the rc. */
    hands?: readonly string[] | undefined;
    /**
     * **Whose word the author is carrying** — when the author is an agent
     * the rc runs and its turn was started by somebody's ask, the people
     * whose asks those were (`speakersFor`). The gate reads THEM, not the
     * agent: otherwise a stranger turned away by an agent that listens only
     * to its owner reaches it anyway, one hop later, through a sibling that
     * listens to everyone. Absent: the author speaks for itself.
     */
    onBehalfOf?: readonly string[] | undefined;
  },
  canvas: CanvasContents | null | undefined,
): InboxReason | "change" | null {
  if (sameActor(agent.joined, authorId, agent.actorId)) return null;
  // The system voice reports outcomes; it never summons. Without this,
  // "Sian couldn't answer" landing in Sian's own thread would re-summon
  // Sian — the failure message waking the failure, forever (phase 5).
  if (isSystemActor(authorId)) return null;
  // A record wakes nobody under ANY rule. `reasonFor` already makes it no
  // summons, but it was still a change, so an `--all-ops` agent took a
  // transcript as work — and two agents' roll-call hellos ("Percy is here")
  // as work for each other, which is a loop.
  if ((op as { comment?: Comment }).comment?.record) return null;
  // The speaker gate, outside the composition and before it. Order is the
  // whole point: a mention pierces every filter below, and the one thing it
  // must not pierce is whose word this agent answers to.
  const admitted = agent.policy
    ? admits(agent.policy, authorId, agent)
    : listensTo(agent.rules, authorId, agent.joined);
  if (!admitted) return null;
  const capped = mentionsOnly(canvas, agent.actorId);
  if (op.type === "thread.create" || op.type === "thread.reply") {
    const thread = canvas?.threads[op.threadId];
    const candidates = canvas ? collectCanvasNames(canvas) : undefined;
    const reason = reasonFor(op.comment, thread, agent.actorId, agent.names, agent.joined, candidates);
    if (reason && (!capped || reason === "mentioned")) return reason;
  }
  if (op.type === "questionnaire.ask" || op.type === "questionnaire.answer") {
    const thread = canvas?.threads[op.threadId];
    const comment = thread?.comments.find((c) => c.id === op.commentId);
    const candidates = canvas ? collectCanvasNames(canvas) : undefined;
    const reason = comment && reasonFor(comment, thread, agent.actorId, agent.names, agent.joined, candidates);
    if (reason && (!capped || reason === "mentioned")) return reason;
  }
  if (capped) return null;
  const rules = agent.rules;
  if (!rules) return null;
  const items = rules.items ?? [];
  const ops = rules.ops ?? [];
  const areas = rules.areas ?? [];
  if (items.length === 0 && ops.length === 0 && areas.length === 0) return null; // comments only
  if (!opMatchesFilters(op, { items, types: ops }, canvas ?? null)) return null;
  // An area narrows what the other two let through, by where it happened.
  if (areas.length > 0 && !opTouchesAreas(op, areas, canvas ?? null)) return null;
  return "change";
}

export function inboxOn(
  canvas: CanvasContents,
  actor: Actor,
  names: readonly MentionCandidate[],
  canvasId: string,
  canvasTitle?: string,
  /** The registry's joins, when the caller holds them — see `addressesActor`. */
  joined?: ActorJoins,
): InboxEntry[] {
  const candidates = collectCanvasNames(canvas);
  const capped = mentionsOnly(canvas, actor.id);
  const out: InboxEntry[] = [];
  for (const thread of Object.values(canvas.threads ?? {})) {
    for (const comment of thread.comments) {
      if (sameActor(joined, comment.author.id, actor.id)) continue;
      const reason = reasonFor(comment, thread, actor.id, names, joined, candidates);
      if (!reason || (capped && reason !== "mentioned")) continue;
      out.push({
        canvasId,
        ...(canvasTitle ? { canvasTitle } : {}),
        threadId: thread.id,
        comment,
        reason,
      });
    }
  }
  return out.sort((a, b) => a.comment.createdAt.localeCompare(b.comment.createdAt));
}

/**
 * Newest first, across canvases — the order an inbox is read in.
 *
 * Sorted here rather than by each caller, because "newest" is the one thing
 * every surface must agree on and it is exactly the sort somebody reimplements
 * slightly differently.
 */
export function inboxNewestFirst(entries: readonly InboxEntry[]): InboxEntry[] {
  return [...entries].sort((a, b) => b.comment.createdAt.localeCompare(a.comment.createdAt));
}

/** One line, the same on every surface. */
export function inboxLine(entry: InboxEntry): string {
  const where = entry.canvasTitle ?? entry.canvasId;
  const first = entry.comment.body.split("\n").find((l) => l.trim() !== "") ?? "";
  return `${entry.comment.author.name} · ${where} — ${first.slice(0, 90)}`;
}


/** Are you already in this conversation — did you write in it, or were you
 *  named in it? A reply to a thread you are part of is for you even when it
 *  does not repeat your name. */
function inYourThread(
  thread: CommentThread,
  actorId: string,
  names: readonly MentionCandidate[],
  joined?: ActorJoins,
): boolean {
  return thread.comments.some(
    (c) => sameActor(joined, c.author.id, actorId) || addressesActor(c, names, joined),
  );
}
