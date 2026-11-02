export { namesFor, addressesActor, reasonFor, listensTo, answerPolicy, gateSetAside, speakersFor, turnedAway, dispatchReason, inboxOn, inboxNewestFirst, inboxLine } from "./inbox-routing.ts";
import type { Actor, Comment } from "./model.ts";
import type { ActorJoins } from "./identity.ts";
import type { RcPolicy } from "./protocol.ts";
import { sameActor } from "./identity.ts";
import { ago } from "./elapsed.ts";

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
 * **This file knows nothing about read state, and that is deliberate.**
 *
 * Version one was a LIST with no count at all, because the only seen-marks
 * were `localStorage` ones — per canvas per actor per BROWSER, so a count
 * would have meant "in this browser" and could not have seen a mention on a
 * canvas this browser had never opened, which is exactly the case an inbox is
 * for. There is a durable mark now (`seen.ts`, 12 Sep 2026: one row per person
 * per canvas, kept by the home, not an op) and `newSince` answers the count.
 *
 * It stays a SEPARATE function over the entries this one produces, rather than
 * a clause inside `reasonFor`. "Is this comment for me" has one definition and
 * `isocan wait` parks on it; folding "have I looked since" into it would make a
 * parked agent's summons depend on whether somebody had read a canvas.
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
  /** The originating comment operation, supplied by an authoritative home
   * while its log retains it. Older or imported comments may omit this. */
  seq?: number;
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
   *
   * A name may carry how long it lasts — `{ id, until }` beside the bare ids
   * every older gate is made of (`ListenEntry`, issue #272 phase 3). Read it
   * with `parseListen` / `listenGrants` rather than by hand; the union is
   * deliberate, so a reader that forgets is a type error rather than a gate
   * that quietly matches nobody.
   */
  listen?: ListenEntry[];
  /**
   * **Only what happens inside these areas** — area item ids (`wait --in`,
   * 11 Sep 2026). A narrowing like `items`, by geometry rather than by name:
   * an op touching an item whose centre is in the area, or a thread pinned
   * there. Composes with `ops` (both must hold) and pierces nothing: a
   * mention still wakes the agent wherever it is.
   */
  areas?: string[];
}

/** The `listen` spelling for "anyone" — `ops`'s idiom, one definition. */
export const LISTEN_ANYONE = "*";

/**
 * **How long a grant lasts, written into the name it grants to** (issue #272
 * phase 3, 11 Sep 2026).
 *
 * A timed grant needed somewhere to live, and there were two places it could
 * have gone: a sibling field on `AgentRules` (`until: { [id]: iso }`) or the
 * entry itself. The entry wins, and the reason is which way each one FAILS on
 * a reader that has never heard of expiry.
 *
 * `rulesOf` drops keys it does not know, deliberately — the record has
 * carried rules opaquely since phase 2. So a sibling `until` map would be
 * invisible to an older build, which would go on honouring a grant that
 * lapsed a month ago: a gate failing OPEN, on the one field whose whole job
 * is to decide who may spend somebody's tokens.
 *
 * **The expiry belongs to the name, so it is written on the name.** An entry
 * is a bare actor id — which is every gate written before today, unchanged —
 * or `{ id, until }`. Two reasons this rather than packing the date into the
 * string (`usr_dion until <ISO>`), which was the first shape and was wrong:
 *
 * - **The type system can enforce it.** With `ListenEntry[]`, a reader that
 *   treats an element as an id gets a type error; with `string[]`, the same
 *   reader compiles and silently matches nobody. A gate that fails by
 *   accident — in either direction — is exactly what this field exists to
 *   prevent, so the failure has to be one a compiler can see.
 * - **An older reader drops it cleanly.** `rulesOf` has always kept only
 *   strings in this list, so a build that has never heard of expiry does not
 *   see a listener id that is not an id: it sees no entry at all, the grant
 *   is absent, and the agent answers its owner alone. Fail closed, and
 *   nothing anywhere renders half a date as a person's name.
 *
 * There is no migration to write, because both shapes are read: a plain
 * string is a grant with no expiry, which is what every stored gate already
 * is, and `spellListen` still writes a bare string when nobody said how long
 * — so a gate that gains no expiry is byte-identical to what it was.
 *
 * `listen` staying a list on one field is what lets phase 3 be a field on
 * the record rather than a new op: the vocabulary stays at 33, and
 * `agent.enroll` carries this as it carried the gate before.
 */

/** One name in the gate, read: who, and — when the owner said how long —
 *  until when, as an ISO instant (absolute, so two machines in two timezones
 *  cannot read one grant two ways). */
interface ListenGrant {
  id: string;
  until?: string;
}

/** A name in the gate, stored: an actor id, or that id with how long the
 *  grant lasts. `LISTEN_ANYONE` is the one id that is not a person. */
export type ListenEntry = string | ListenGrant;

/** A stored entry, read. An `until` that is not a time is ignored rather
 *  than trusted: a gate must never widen because a value was malformed. */
export function parseListen(entry: ListenEntry): ListenGrant {
  if (typeof entry === "string") return { id: entry };
  const until = entry.until;
  return until !== undefined && Number.isFinite(Date.parse(until))
    ? { id: entry.id, until }
    : { id: entry.id };
}

/** The entry to store — the inverse of `parseListen`, here so the two
 *  spellings cannot drift apart. A grant with no expiry stays a bare string,
 *  so a gate that never gains one is byte-identical to what it always was
 *  and every older reader goes on reading it. */
export function spellListen(id: string, until?: string | null): ListenEntry {
  return until ? { id, until } : id;
}

/** Has this grant run out? A grant with no expiry never does. */
function grantLapsed(grant: ListenGrant, now: number = Date.now()): boolean {
  return grant.until !== undefined && Date.parse(grant.until) <= now;
}

/**
 * The gate's names, parsed and dated — what every surface that wants to SHOW
 * a gate reads, rather than each one learning the spelling. `lapsed` is kept
 * in the list rather than filtered out of it, because a grant that ran out is
 * the thing a refusal has to be able to name.
 */
export function listenGrants(
  listen: readonly ListenEntry[] | undefined,
  now: number = Date.now(),
): (ListenGrant & { lapsed: boolean })[] {
  return (listen ?? [])
    .filter((entry) => entry !== LISTEN_ANYONE)
    .map((entry) => {
      const grant = parseListen(entry);
      return { ...grant, lapsed: grantLapsed(grant, now) };
    });
}

/**
 * **The list a grant writes.** One name added to — or taken out of — the gate
 * that already STANDS, which is `RcPolicy.listen` and not the stored field:
 * a gate somebody other than the owner wrote has already been set aside
 * (`answerPolicy`), and appending to the stored value would quietly bring it
 * back. The owner's click says one thing; it must not also resurrect
 * somebody else's.
 *
 * `LISTEN_ANYONE` swallows the list, because "anyone" is not one more name —
 * it is the answer instead of the list — and taking it away leaves the names
 * that were there before it, which is the gate the owner last chose by hand.
 */
export function withListener(
  policy: RcPolicy,
  actorId: string,
  admit: boolean,
  opts?: { until?: string | null; joined?: ActorJoins; now?: number },
): ListenEntry[] {
  const joined = opts?.joined;
  const now = opts?.now ?? Date.now();
  const standing = policy.listen.filter((e) => e !== LISTEN_ANYONE);
  if (actorId === LISTEN_ANYONE) {
    if (!admit) return standing.filter((e) => !grantLapsed(parseListen(e), now));
    return [LISTEN_ANYONE];
  }
  const others = standing.filter((entry) => !sameActor(joined, parseListen(entry).id, actorId));
  const open = policy.listen.includes(LISTEN_ANYONE);
  if (!admit) return open ? [LISTEN_ANYONE] : others;
  // Naming somebody while the gate stands open is not a narrowing: the list
  // is already the whole room, and rewriting it to one name would be a
  // different decision than the one the click made.
  if (open) return [LISTEN_ANYONE];
  return [...others.filter((e) => !grantLapsed(parseListen(e), now)), spellListen(actorId, opts?.until)];
}

/** When this asker's grant ran out, if they had one and it did — so a
 *  refusal can say *lapsed* rather than repeating *never*. */
export function lapsedFor(
  policy: RcPolicy,
  actorId: string,
  joined?: ActorJoins,
  now: number = Date.now(),
): string | undefined {
  for (const grant of listenGrants(policy.listen, now)) {
    if (grant.lapsed && sameActor(joined, grant.id, actorId)) return grant.until;
  }
  return undefined;
}

/**
 * **How long, as a person says it** — `tonight`, `7d`, `30d`, `never`, or an
 * instant spelled out. Resolved to an absolute instant at the moment of the
 * grant, on the granter's clock, because a gate read on three machines in
 * three timezones must mean one moment.
 */
export function listenUntil(spec: string, now: number = Date.now()): string | null {
  const said = spec.trim().toLowerCase();
  if (said === "" || said === "never" || said === "forever") return null;
  if (said === "tonight") {
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return midnight.toISOString();
  }
  const days = /^(\d+)d$/.exec(said);
  if (days) return new Date(now + Number(days[1]) * 86_400_000).toISOString();
  const hours = /^(\d+)h$/.exec(said);
  if (hours) return new Date(now + Number(hours[1]) * 3_600_000).toISOString();
  const at = Date.parse(spec);
  if (Number.isFinite(at)) return new Date(at).toISOString();
  throw new Error(
    `"${spec}" is not a length of time — try tonight, 7d, 24h, never, or a date`,
  );
}

/** A grant's remaining life, in the clipped vocabulary the rosters use:
 *  *until tonight*, *for 6 days*, *lapsed 2h ago*. */
export function untilWords(until: string, now: number = Date.now()): string {
  const left = Date.parse(until) - now;
  if (!Number.isFinite(left)) return "";
  // The past is core's `ago`, not a fourth copy of it (cleanup DU-5,
  // 27 Sep 2026) — so a grant that lapsed 30 hours ago says "30h" here as on
  // every card, where this copy rounded it to "1d".
  if (left <= 0) return `lapsed ${ago(until, now)} ago`;
  if (left < 3_600_000) return `for ${Math.max(1, Math.round(left / 60_000))}m`;
  const tonight = new Date(now);
  tonight.setHours(24, 0, 0, 0);
  if (Date.parse(until) <= tonight.getTime()) return "until tonight";
  if (left < 86_400_000) return `for ${Math.round(left / 3_600_000)}h`;
  return `for ${Math.round(left / 86_400_000)}d`;
}

/** The stored rules field, read tolerantly — it has been opaque since
 * phase 2, and a malformed hand-me-down must cost the filter, not the
 * summons. */
export function rulesOf(raw: unknown): AgentRules {
  if (raw === null || typeof raw !== "object") return {};
  const strings = (value: unknown): string[] | undefined =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : undefined;
  /* `listen` is the one list whose entries may be more than a name (#272
     phase 3). Kept tolerantly and by SHAPE: an id, or an object with a
     string id. Anything else is dropped, exactly as a string list drops a
     number — a gate must never admit somebody because a value was
     malformed. */
  const entries = (value: unknown): ListenEntry[] | undefined =>
    Array.isArray(value)
      ? value.filter(
          (v): v is ListenEntry =>
            typeof v === "string" ||
            (typeof v === "object" && v !== null && typeof (v as { id?: unknown }).id === "string"),
        )
      : undefined;
  const items = strings((raw as { items?: unknown }).items);
  const ops = strings((raw as { ops?: unknown }).ops);
  const listen = entries((raw as { listen?: unknown }).listen);
  const areas = strings((raw as { areas?: unknown }).areas);
  return {
    ...(items ? { items } : {}),
    ...(ops ? { ops } : {}),
    ...(listen ? { listen } : {}),
    ...(areas ? { areas } : {}),
  };
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
  now: number = Date.now(),
): string | null {
  const listen = rules?.listen ?? [];
  if (listen.length === 0 || listen.includes(LISTEN_ANYONE)) return null;
  // A grant that has run out is not a name this gate admits, so it is not a
  // name these words may say: reading "listens to Dion" of a gate that will
  // turn Dion away is the silent gate wearing the opposite hat.
  const names = listenGrants(listen, now)
    .filter((g) => !g.lapsed)
    .map((g) => nameOf(g.id) ?? g.id);
  if (names.length === 0) return "listens to nobody else — every grant has lapsed";
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

/** Does this policy admit that speaker? `hands` is the rc's own knowledge
 * and never crosses the wire; a reader without it asks about people. */
export function mayWake(
  policy: RcPolicy,
  authorId: string,
  joined?: ActorJoins,
  hands?: readonly string[],
  /** The clock a timed grant is read against — a parameter so a test can
   *  stand at a moment, and `Date.now()` because every real caller is at
   *  this one. */
  now: number = Date.now(),
): boolean {
  if (ownersWord({ owner: policy.owner, ...(hands ? { hands } : {}) }, authorId, joined)) return true;
  if (policy.listen.includes(LISTEN_ANYONE)) return true;
  return listenGrants(policy.listen, now).some((g) => !g.lapsed && sameActor(joined, g.id, authorId));
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
  now: number = Date.now(),
): string | null {
  if (policy.listen.includes(LISTEN_ANYONE)) return null;
  /**
   * **"you" always says who you are.** The bare word cost an hour on 15 Sep
   * 2026: a second machine had been set up with a plain address and so arrived
   * as its OWN person, and `listens only to you` was read three different wrong
   * ways by somebody who had assumed whose machine it was. Every wrong reading
   * — a silent no-op, a silent narrowing, replica lag — is available from that
   * sentence, and none of them survives naming the actor. The `--json` form was
   * unambiguous immediately, which is the tell: the words were carrying less
   * than the data.
   *
   * It stays "you" first, because whose gate it is matters more than what they
   * are called; the name is the disambiguation, in brackets, behind it.
   */
  const you = (id: string) => viewerId !== undefined && sameActor(joined, id, viewerId);
  const called = (id: string, fallback: string) => nameOf(id) ?? fallback;
  const said = (id: string, fallback: string) =>
    you(id) ? `you (${called(id, fallback)})` : called(id, fallback);
  const owner = said(policy.owner.id, policy.owner.name);
  // Only the grants that still stand are named: a lapsed one is a name this
  // gate will turn away, and the whole point of one wording is that what it
  // says and what dispatch does are the same sentence.
  const live = listenGrants(policy.listen, now).filter((g) => !g.lapsed);
  if (live.length === 0) return `listens only to ${owner}`;
  const others = live.map((g) => said(g.id, g.id));
  if (others.length === 1) return `listens to ${owner} and ${others[0]}`;
  return `listens to ${owner} and ${others.length} others`;
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
  now: number = Date.now(),
): { actorId: string; policy: RcPolicy; lapsed?: string }[] {
  if (!policies) return [];
  const out: { actorId: string; policy: RcPolicy; lapsed?: string }[] = [];
  for (const actorId of new Set(mentions ?? [])) {
    const policy = policies[actorId];
    if (!policy || mayWake(policy, authorId, joined, undefined, now)) continue;
    // Turned away WITH a grant that ran out is a different sentence from
    // turned away with none, and the difference is the asker's to know.
    const ran = lapsedFor(policy, authorId, joined, now);
    out.push({ actorId, policy, ...(ran ? { lapsed: ran } : {}) });
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
  /** When this asker's own grant ran out, if it did — the one clause a
   *  lapsed grant adds to the refusal a gate that never had it would give
   *  (issue #272 phase 3). */
  opts?: { lapsed?: string | undefined; now?: number },
): string {
  const now = opts?.now ?? Date.now();
  const owner = nameOf(policy.owner.id) ?? policy.owner.name;
  const gate = policyWords(policy, nameOf, undefined, undefined, now) ?? `listens only to ${owner}`;
  // `--to` replaces the list, so the suggestion carries who is already in —
  // by name and without their expiry, because it is a command to retype, and
  // without the lapsed, because re-granting what ran out is the owner's
  // decision to make again rather than one to smuggle into a suggestion.
  const names = [
    ...listenGrants(policy.listen, now)
      .filter((g) => !g.lapsed)
      .map((g) => nameOf(g.id) ?? g.id),
    asker,
  ];
  const to = names.join(",");
  const quoted = /[\s"'$`\\]/.test(to) ? `"${to.replace(/(["$`\\])/g, "\\$1")}"` : to;
  const ran = opts?.lapsed ? ` ${asker}'s access ${untilWords(opts.lapsed, now)}.` : "";
  return (
    `${agentName} ${gate} — ${turnedAwayMark(agentName)}${ran} ` +
    `${owner} can widen it: isocan rc listen ${/\s/.test(agentName) ? `"${agentName}"` : agentName} --to ${quoted}`
  );
}

/**
 * **The clause every refusal carries**, so a surface can RECOGNISE one it did
 * not write (issue #272 phase 1). The refusal lands in the thread as a system
 * comment and stays there forever; once the owner widens the gate, the words
 * above the reader are no longer true, and the only way to say so beside them
 * is to know which comment they are.
 *
 * A marker in the comment would have been the other way, and it would have
 * been a change to what a comment IS for one feature's benefit. The sentence
 * is already core's, written in one place; being able to read it back is the
 * same fact, not a new one.
 */
function turnedAwayMark(agentName: string): string {
  return `this did not wake ${agentName}, and spent nothing.`;
}

/** Does this comment body read as the refusal this agent got? The system
 *  voice is the only author that writes one, which the caller checks. */
export function readsAsTurnedAway(body: string, agentName: string): boolean {
  return body.includes(turnedAwayMark(agentName));
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
