import type { Actor, CanvasContents, Comment, CommentThread } from "./model.ts";
import type { NewComment, Operation } from "./ops.ts";
import type { MentionCandidate } from "./mentions.ts";
import type { ActorJoins } from "./identity.ts";
import type { RcPolicy } from "./protocol.ts";
import { extractMentions } from "./mentions.ts";
import { sameActor } from "./identity.ts";
import { isSystemActor } from "./model.ts";
import { opMatchesFilters } from "./touches.ts";

/**
 * **What is addressed to you, wherever it landed.**
 *
 * `docs/research/2026-08-29-the-inbox.md`, and the finding that shaped this
 * file: **`isocan wait` was already this rule.** It has decided "is this
 * comment for me" for weeks, across several canvases, and the app had no
 * equivalent — so a person could be @-mentioned on a canvas they were not
 * looking at and find out by chance.
 *
 * The rule lives here now rather than in the CLI, for the reason `itemThread`
 * moved: a rule one surface enforces and the other does not know is a habit,
 * not a rule. A second definition written for the person would be a second
 * answer to a question that has one, and the two would disagree silently —
 * which shows up as somebody not being told something.
 *
 * **No read state.** Version one is a LIST, not a count. Seen-marks live in
 * `localStorage` per canvas per actor, so a count would mean "in this browser"
 * and could not see a mention on a canvas this browser has never opened —
 * which is exactly the case an inbox is for. The research recommends a
 * per-canvas high-water mark as an operation when a count is wanted; until
 * then this reports what exists and lets the reader decide what is new.
 */

/** Why a comment is yours. Kept because the reasons are not equally urgent —
 *  a direct mention is somebody asking you; the Chat is the room being loud. */
type InboxReason = "mentioned" | "main-thread" | "in-your-thread";

export interface InboxEntry {
  canvasId: string;
  /** For saying where, without a second lookup. */
  canvasTitle?: string;
  threadId: string;
  comment: Comment;
  reason: InboxReason;
}

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

/**
 * Everything on one canvas that is addressed to this actor, oldest first.
 *
 * **Your own words are never in your inbox.** Obvious once said, and the kind
 * of thing a filter forgets: you are in every thread you wrote in, so without
 * this every comment you ever left would come back to you.
 */
/**
 * Why one comment is yours, or null when it is ether. THE routing rule,
 * stated once: named — by id or a name you answer to — or the main thread,
 * or a conversation you are already in. `inboxOn` folds a canvas with it and
 * `isocan wait` decides a summons with it, so a parked agent and the inbox
 * can never disagree about what is for you — and a daemon that summons
 * agents (`docs/projects/on-demand/design.md`) asks this same function
 * rather than growing a third copy.
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
): InboxReason | null {
  if (addressesActor(comment, names, joined)) return "mentioned";
  if (thread?.main) return "main-thread";
  if (thread && inYourThread(thread, actorId, names, joined)) return "in-your-thread";
  return null;
}

/**
 * **What a rule may say** (agents-on-demand phase 4, decided 2026-08-30):
 * today's filters, exactly — the items it names, the op types (or families,
 * `item.*`) it wants. This is the whole grammar, defined HERE so `wait`, the
 * inbox and the rc read one vocabulary; richer predicates ("the items Sian
 * owns") join this type in this file when something can actually write them,
 * never as a dialect one reader grows alone. Unknown keys in a stored rules
 * object are ignored, not errors: the record has carried rules opaquely
 * since phase 2, and a rule written by a newer build must not break an
 * older reader's routing.
 */
export interface AgentRules {
  /** Only changes touching these item ids. Empty/absent: any item. */
  items?: string[];
  /** Only these op types, `item.*` families allowed. Empty/absent with
   * `items` also empty: comments only — the enrolled default. `["*"]` is
   * everything, `wait --all-ops`'s spelling. */
  ops?: string[];
  /**
   * **Whose word wakes this agent** — actor ids, read at the rc that answers
   * for it by `answerPolicy`. Absent or empty means **its owner alone** — the
   * person whose machine answers — which is owner-only summons, the default
   * since 11 Sep 2026 (from 9 to 11 Sep it meant anyone admitted). A list
   * admits the owner and those people; `["*"]` admits everyone, what a team's
   * agent wants (`docs/research/2026-09-04-sheepdog.md`, "whom it listens
   * to").
   *
   * It is a gate on the SPEAKER, and `items`/`ops` are filters on what
   * changed — a different question, which is why it is a third field here
   * and an outer gate in `dispatchReason` rather than a third clause in
   * the composition. A mention pierces every filter, deliberately; it must
   * not pierce this one, or a pet agent its owner pays for answers every
   * stranger on a shared canvas.
   *
   * `["*"]` is the same spelling `ops` uses for "everything", said
   * explicitly so a person can turn a gate off without deleting a field.
   */
  listen?: string[];
}

/** The `listen` spelling for "anyone" — `ops`'s idiom, one definition. */
export const LISTEN_ANYONE = "*";

/** The stored rules field, read tolerantly — it has been opaque since
 * phase 2, and a malformed hand-me-down must cost the filter, not the
 * summons. */
export function rulesOf(raw: unknown): AgentRules {
  if (raw === null || typeof raw !== "object") return {};
  const strings = (value: unknown): string[] | undefined =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : undefined;
  const items = strings((raw as { items?: unknown }).items);
  const ops = strings((raw as { ops?: unknown }).ops);
  const listen = strings((raw as { listen?: unknown }).listen);
  return {
    ...(items ? { items } : {}),
    ...(ops ? { ops } : {}),
    ...(listen ? { listen } : {}),
  };
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
): boolean {
  const listen = rules?.listen ?? [];
  if (listen.length === 0 || listen.includes(LISTEN_ANYONE)) return true;
  return listen.some((id) => sameActor(joined, id, authorId));
}

/**
 * How a surface says a STORED gate when no rc is in sight to say its policy
 * (`policyWords` is the words once one is) — null when there is none to say,
 * so a caller can append it without asking whether there is anything to
 * append. With nobody answering, the stored list is all there is to read.
 *
 * `nameOf` resolves an actor id to the name that reader would show; ids are
 * the fallback, never a blank, because a gate nobody can read is the silent
 * gate wearing a different hat.
 */
export function listenWords(
  rules: AgentRules | null | undefined,
  nameOf: (actorId: string) => string | undefined,
): string | null {
  const listen = rules?.listen ?? [];
  if (listen.length === 0 || listen.includes(LISTEN_ANYONE)) return null;
  const names = listen.map((id) => nameOf(id) ?? id);
  if (names.length === 1) return `listens to ${names[0]}`;
  if (names.length === 2) return `listens to ${names[0]} and ${names[1]}`;
  return `listens to ${names[0]} and ${names.length - 1} others`;
}

/**
 * **Owner-only summons** (decided 11 Sep 2026; issue #238, the rc research
 * note's recommendation 6, agent-custody's open question).
 *
 * A summoned turn runs on the rc owner's machine and spends the rc owner's
 * tokens, and until this any member admitted to a shared canvas could start
 * one. `rc --sandbox` bounds what a turn may REACH; this bounds who may START
 * one, and a shared canvas makes it the sharper question of the two.
 *
 * **The owner** is the person whose machine answers: the rc's home identity
 * (`~/.isocan/identity.json`, the actor its badge holds under `home:person`).
 * Not whoever enrolled the agent — an agent can enrol an agent, and the web's
 * add is an ask the rc completes — but whose bill it is, which only the
 * machine can say. Compared through `actor.join`, so the same person under a
 * second, joined identity is the owner too.
 *
 * **The owner's hands** are every other actor the owner's machine speaks as —
 * the agents its rc runs, the person's own interactive sessions. Their word
 * counts as the owner's: they run on the owner's machine and the owner's
 * tokens already, a chain of them is bounded by the cycle guard, and without
 * it two agents on one laptop could no longer ask each other anything.
 *
 * **The default is the owner alone.** `listen` absent or empty now means
 * exactly that (it meant everyone from 9 to 11 Sep); a list admits the owner
 * AND those people; `["*"]` admits everyone, which is what a team's agent
 * wants and is now said out loud with `isocan rc listen <name> --to everyone`.
 *
 * **Only the owner's word widens.** The gate lives in a record every admitted
 * member can write, so the rc reads it only when `writtenBy` is the owner's
 * word; anybody else's enrolment reads as owner-only there. A stranger can
 * still make an agent do less (withdraw it, narrow nothing into something) —
 * the canvas may narrow; it may never spend.
 */
export interface Keeping {
  owner: Actor;
  /** Actor ids the owner's machine speaks as — `actorBindings()` on the rc's
   * badge, plus the agents it answers for. */
  hands?: readonly string[];
}

/** Is this actor the owner, or one of the owner's hands? */
export function ownersWord(keeping: Keeping, actorId: string, joined?: ActorJoins): boolean {
  if (sameActor(joined, actorId, keeping.owner.id)) return true;
  return (keeping.hands ?? []).some((id) => sameActor(joined, id, actorId));
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
  const others = listen.filter((id) => !sameActor(joined, id, keeping.owner.id));
  return { owner: keeping.owner, listen: [...new Set(others)] };
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
  return (rules?.listen ?? []).some((id) => !sameActor(joined, id, keeping.owner.id));
}

/** Does this policy admit that speaker? `hands` is the rc's own knowledge
 * and never crosses the wire; a reader without it asks about people. */
export function mayWake(
  policy: RcPolicy,
  authorId: string,
  joined?: ActorJoins,
  hands?: readonly string[],
): boolean {
  if (ownersWord({ owner: policy.owner, ...(hands ? { hands } : {}) }, authorId, joined)) return true;
  if (policy.listen.includes(LISTEN_ANYONE)) return true;
  return policy.listen.some((id) => sameActor(joined, id, authorId));
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
 * How every surface says a policy: *listens only to Nico*, *listens only to
 * you*, *listens to Nico and Usama*, *listens to Nico and 2 others* — or null
 * for everyone, when there is nothing to qualify. The same vocabulary as
 * `listenWords`, so a tray, `isocan who` and a refusal in a thread all say
 * one thing one way.
 */
export function policyWords(
  policy: RcPolicy,
  nameOf: (actorId: string) => string | undefined,
  /** Who is reading, so the owner reads *you* rather than their own name. */
  viewerId?: string,
  joined?: ActorJoins,
): string | null {
  if (policy.listen.includes(LISTEN_ANYONE)) return null;
  const you = (id: string) => viewerId !== undefined && sameActor(joined, id, viewerId);
  const owner = you(policy.owner.id) ? "you" : (nameOf(policy.owner.id) ?? policy.owner.name);
  if (policy.listen.length === 0) return `listens only to ${owner}`;
  const others = policy.listen.map((id) => (you(id) ? "you" : (nameOf(id) ?? id)));
  if (others.length === 1) return `listens to ${owner} and ${others[0]}`;
  return `listens to ${owner} and ${others.length} others`;
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
  if (isSystemActor(authorId) || sameActor(agent.joined, authorId, agent.actorId)) return false;
  if (admits(agent.policy, authorId, agent)) return false;
  return addressesActor(op.comment, agent.names, agent.joined);
}

/**
 * The same question asked by a CLIENT, before or just after it posts: which
 * of the agents this comment names will the answering rc turn away? Read
 * against the policies the rcs announced (`RcAnsweringResponse.policies`),
 * so the CLI's note and the web's line say what the rc will do rather than
 * guessing at it. Agents with no announced policy are nobody's to predict.
 */
export function refusedMentions(
  mentions: readonly string[] | undefined,
  authorId: string,
  policies: Readonly<Record<string, RcPolicy>> | undefined,
  joined?: ActorJoins,
): { actorId: string; policy: RcPolicy }[] {
  if (!policies) return [];
  const out: { actorId: string; policy: RcPolicy }[] = [];
  for (const actorId of new Set(mentions ?? [])) {
    const policy = policies[actorId];
    if (policy && !mayWake(policy, authorId, joined)) out.push({ actorId, policy });
  }
  return out;
}

/**
 * The sentence a turned-away asker reads — the rc's system voice in the
 * thread, the CLI's note after a comment, the web under it. It names the
 * owner, because the owner is the only person who can change the answer, and
 * it names the exact gesture, because "ask them to widen it" with no verb is
 * a riddle.
 */
export function turnedAwayLine(
  agentName: string,
  policy: RcPolicy,
  nameOf: (actorId: string) => string | undefined,
  asker: string,
): string {
  const owner = nameOf(policy.owner.id) ?? policy.owner.name;
  const gate = policyWords(policy, nameOf) ?? `listens only to ${owner}`;
  // `--to` replaces the list, so the suggestion carries who is already in.
  const names = [...policy.listen.map((id) => nameOf(id) ?? id), asker];
  const to = names.join(",");
  const quoted = /[\s"'$`\\]/.test(to) ? `"${to.replace(/(["$`\\])/g, "\\$1")}"` : to;
  return (
    `${agentName} ${gate} — this did not wake ${agentName}, and spent nothing. ` +
    `${owner} can widen it: isocan rc listen ${/\s/.test(agentName) ? `"${agentName}"` : agentName} --to ${quoted}`
  );
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
  // The speaker gate, outside the composition and before it. Order is the
  // whole point: a mention pierces every filter below, and the one thing it
  // must not pierce is whose word this agent answers to.
  const admitted = agent.policy
    ? admits(agent.policy, authorId, agent)
    : listensTo(agent.rules, authorId, agent.joined);
  if (!admitted) return null;
  if (op.type === "thread.create" || op.type === "thread.reply") {
    const thread = canvas?.threads[op.threadId];
    const reason = reasonFor(op.comment, thread, agent.actorId, agent.names, agent.joined);
    if (reason) return reason;
  }
  const rules = agent.rules;
  if (!rules) return null;
  const items = rules.items ?? [];
  const ops = rules.ops ?? [];
  if (items.length === 0 && ops.length === 0) return null; // comments only
  return opMatchesFilters(op, { items, types: ops }, canvas ?? null) ? "change" : null;
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
  const out: InboxEntry[] = [];
  for (const thread of Object.values(canvas.threads ?? {})) {
    for (const comment of thread.comments) {
      if (sameActor(joined, comment.author.id, actor.id)) continue;
      const reason = reasonFor(comment, thread, actor.id, names, joined);
      if (!reason) continue;
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

/** How many, by why — so a surface can say "2 mentions" without counting the
 *  room being loud as somebody asking you. */
export function inboxTally(entries: readonly InboxEntry[]): Record<InboxReason, number> {
  const tally: Record<InboxReason, number> = {
    mentioned: 0,
    "main-thread": 0,
    "in-your-thread": 0,
  };
  for (const entry of entries) tally[entry.reason] += 1;
  return tally;
}

/** One line, the same on every surface. */
export function inboxLine(entry: InboxEntry): string {
  const where = entry.canvasTitle ?? entry.canvasId;
  const first = entry.comment.body.split("\n").find((l) => l.trim() !== "") ?? "";
  return `${entry.comment.author.name} · ${where} — ${first.slice(0, 90)}`;
}
