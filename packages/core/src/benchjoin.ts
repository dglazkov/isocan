import type { BenchAgent } from "./bench.ts";
import type { CanvasContents } from "./model.ts";
import type { MentionCandidate } from "./mentions.ts";
import { findMentionSpans } from "./mentions.ts";

/**
 * **`@Name join` — joining said in the channel you are already talking in**
 * (phase 2, journey 3).
 *
 * Everything below is about a BODY: the line a person types in the Chat, what
 * it resolves to, and what is said back. It is here rather than in the web app
 * for the reason `findCommandSpans` is in `mentions.ts` — a rule about a body
 * is a fact both surfaces read, and the one thing this phase must not have two
 * of is the refusal.
 *
 * **No new op.** A join from chat sends the same `agent.invite` the panel's
 * **Join** and `isocan bench join` send. Joining from a sentence and joining
 * from a button are the same act, and if they needed different ops the design
 * would be wrong.
 *
 * **Its own module rather than the bottom of `bench.ts`, and that is a
 * measurement rather than taste.** The Chat's composer is on the canvas page
 * and eager; `bench.ts` is not, and neither are its two panels — it builds
 * into a chunk of its own that a first visit never fetches. Written as four
 * more exports in `bench.ts`, the composer's single `benchJoinAsk` import
 * dragged the whole module into the entry chunk: **742,846 → 746,782 bytes**,
 * past a ceiling with a kilobyte of room in it. Split, the same feature costs
 * the entry only these hundred-odd lines, and `benchRows`, `roster()` and the
 * three reachability words stay where they were.
 *
 * That is `scripts/bundle-ceiling.mjs`'s `arrow.ts` lesson arriving a second
 * time: **a bundler merges a module imported both ways**, so the eager half
 * of a feature has to be a separate file from the lazy half — a boundary in
 * the import graph, not a boundary in the reader's head. The one link left is
 * `import type { BenchAgent }`, which is erased.
 */

/**
 * The verb that brings an agent from your bench to the canvas you are on.
 *
 * Spelled once so the composer's chip, the composer's refusal and any reader
 * of a body cannot disagree about what the line was. `findCommandSpans` owns
 * the same idea for `/verbs`; this is the mention-shaped one, and it is a
 * constant rather than a list because there is exactly one thing you can ask
 * of a name that is not here yet.
 */
export const BENCH_JOIN_VERB = "join";

/**
 * A bench row offered as a mention candidate, marked with the one thing that
 * distinguishes it from everybody else in the menu.
 *
 * `@Sian` has to resolve in the composer BEFORE Sian is on this canvas —
 * that is journey 3's whole premise — so the candidate list gains the asker's
 * bench beside the canvas's own actors. Which makes a lie possible: a name in
 * the menu reads as somebody who is here. `notHereYet` is what the composer
 * says instead, so nobody types a question at an agent that cannot read it.
 */
export interface BenchMention extends MentionCandidate {
  /** On your bench, and not standing on the canvas you are looking at. */
  notHereYet: boolean;
}

/**
 * The asker's bench as mention candidates, each marked against the canvas
 * being looked at.
 *
 * **Only the asker's.** There is no argument here for anybody else's bench and
 * there must never be one: a bench is a private canvas, and a candidate list
 * that could reach a second one would make `@Name` a probe for what is on it.
 */
export function benchMentions(
  bench: readonly BenchAgent[],
  canvas: CanvasContents | null,
): BenchMention[] {
  return bench.map((agent) => ({
    id: agent.actorId,
    name: agent.name,
    notHereYet: canvas?.agents?.[agent.actorId] === undefined,
  }));
}

/**
 * `@Name join`, found in a body — the request, and what it resolved to.
 *
 * `actorId` is null when the name resolved to nobody on the asker's bench.
 * That is the ONLY refusal there is, and the shape says so: there is no
 * "unknown" case beside it, because an unresolved name and a name that does
 * not exist anywhere are indistinguishable here BY CONSTRUCTION — the only
 * bench this function is ever given is the asker's own.
 */
export interface BenchJoinAsk {
  /** Index of the "@". */
  start: number;
  /** Index just past the verb. */
  end: number;
  /** The name as written, without the "@". */
  name: string;
  /** Who it named on the asker's bench, or null — see `benchJoinRefusal`. */
  actorId: string | null;
}

/**
 * **The join this body asks for, or null when it asks for none.**
 *
 * Composed from the two finders that already exist rather than parsed afresh:
 * the shape is `findCommandSpans`'s rule (a verb, at the start of a line) with
 * a name in front of it, and the name is resolved by `findMentionSpans`
 * against the candidates handed in — which is what gives `@Sian Vale join`,
 * `@sian join` and the first-name rule for free, and what keeps ONE answer to
 * "what does this name mean" across the whole app.
 *
 * The verb must END the line. `@Sian join us in the morning` is a sentence
 * about Sian, not a command, and a composer that joined an agent because
 * somebody wrote prose would be worse than one that never offered the line.
 *
 * **It returns an ask for a name that resolved to nobody**, rather than null,
 * and that is the whole point: silence at that moment reads as *no such
 * agent*, which is a claim about a canvas the speaker cannot see. The caller
 * refuses with `benchJoinRefusal`.
 */
export function benchJoinAsk(
  body: string,
  bench: readonly MentionCandidate[],
): BenchJoinAsk | null {
  let at = 0;
  for (const line of body.split("\n")) {
    const start = at;
    at += line.length + 1;
    const said = line.trimEnd();
    if (!said.startsWith("@") || !said.endsWith(BENCH_JOIN_VERB)) continue;
    const head = said.slice(0, said.length - BENCH_JOIN_VERB.length);
    // A space between the name and the verb, so "@Sianjoin" is a name and
    // "@Sian" on its own is not a command.
    if (!/\s$/.test(head)) continue;
    const named = head.trimEnd();
    const name = named.slice(1);
    if (!name) continue;
    // The span has to cover the WHOLE name written. A first name still
    // resolves — "@Sian join" finds a row called "Sian Vale", because that is
    // a name she answers to everywhere else — but "@Sian Vale join" must not
    // land on a row called only "Sian" by matching its first token and
    // leaving "Vale" as loose text nobody looked at.
    const hit = findMentionSpans(named, [...bench]).find(
      (span) => span.start === 0 && span.end === named.length,
    );
    return { start, end: start + said.length, name, actorId: hit?.actorId ?? null };
  }
  return null;
}

/**
 * **The refusal, which is an information leak if it is anything else.**
 *
 * Sian lives on a private canvas the speaker cannot read. A refusal that said
 * *"unknown name"* would be a claim about the contents of that canvas — and
 * worse, a refusal that DIFFERED between "exists on somebody else's bench" and
 * "exists nowhere" would let a stranger enumerate one name at a time.
 *
 * So the two cases are not told apart here; they cannot be. This function is
 * given the name as written and NOTHING ELSE — no canvas, no registry, no
 * second bench — so there is no input from which a difference could be drawn.
 * That is the guarantee, and it is structural rather than remembered:
 * `packages/core/test/benchjoin.test.ts` fails if the two ever diverge.
 *
 * Do not add an argument to this function.
 */
export function benchJoinRefusal(name: string): string {
  return `${name} is not on your bench`;
}

/**
 * **The one line the thread gets when a join lands, because the canvas is the
 * only channel.**
 *
 * A join asked for in the Chat has to be answered in the Chat: a toast is a
 * second channel, and the thread is where everybody else reading this canvas
 * finds out that somebody new can now hear them. It says what changed AND
 * what did not, for the reason the terminal's sentence does — a bench row
 * confers nothing, and a join confers standing here and nothing else.
 */
export function benchJoinWords(name: string): string {
  return `${name} answers on this canvas now, from a bench. Nothing else moved: no turn was started, no summons rule was written, and no other canvas changed.`;
}
