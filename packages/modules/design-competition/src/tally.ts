import type { CanvasContents, Item } from "@isocan/core";
import { DOT, MEDALS, MISS, TROPHY, bouts, entriesOf, P, type Bout } from "./bout.ts";

/**
 * **The tally, read from the record** (`design.md`, "The vote").
 *
 * A ballot is reactions — 🥇 🥈 🥉 a ranking, 🔴 a steal, ⛔ a miss, 🏆 the
 * decision — so there is nothing to store and nothing to trust but the log:
 * every mark carries the actor who placed it. This is the ONE fold both
 * surfaces call, so the terminal's `competition result` and the ballot tray
 * cannot disagree about who won.
 *
 * **People and agents are counted apart and never summed** — the sprint's
 * rule, carried over: an agent's opinion is shown, beside, and never mixed in.
 * A person ranks all N entries and a medal is worth N…1; a fighter ranks the
 * N−1 it did not make, worth N−1…1.
 *
 * **Three rules, and each refusal is said, not silent.** A fighter's medal on
 * its OWN entry is dropped. The same medal on two entries is dropped from
 * both — the verb moves a medal rather than adding one, so two means a hand
 * placed one, and picking which to keep would be the tally voting. And only
 * the Decider's 🏆 decides; anybody else's is shown as a vote for it.
 */

export interface EntryScore {
  entry: Item;
  packId: string;
  /** Borda from people. */
  people: number;
  /** Borda from agents — the fighters, and any other agent on the canvas. */
  agents: number;
  dots: number;
  misses: { people: number; agents: number };
  /** 🏆 from anybody who is not the Decider — a vote for it, not the result. */
  trophies: number;
}

export interface Dropped {
  actorId: string;
  itemId: string;
  mark: string;
  why: string;
}

export interface Tally {
  entries: EntryScore[];
  /** The entry the Decider's 🏆 is on, or the Brief's recorded winner. */
  decided: Item | null;
  dropped: Dropped[];
  voters: { people: number; agents: number };
}

const reactors = (item: Item, mark: string): readonly string[] => item.reactions?.[mark] ?? [];

export function competitionTally(bout: Bout, agentIds: ReadonlySet<string>): Tally {
  const entries = entriesOf(bout);
  const n = entries.length;
  const fighterOf = new Map(bout.lanes.flatMap((lane) => (lane.actorId ? [[lane.actorId, lane.packId] as const] : [])));
  const isAgent = (actor: string) => fighterOf.has(actor) || agentIds.has(actor);
  const scores = new Map<string, EntryScore>(
    entries.map((entry) => [
      entry.id,
      {
        entry,
        packId: entry.properties[P.fighter] ?? "",
        people: 0,
        agents: 0,
        dots: reactors(entry, DOT).length,
        misses: {
          people: reactors(entry, MISS).filter((a) => !isAgent(a)).length,
          agents: reactors(entry, MISS).filter(isAgent).length,
        },
        trophies: 0,
      },
    ]),
  );
  const dropped: Dropped[] = [];
  const voters = { people: new Set<string>(), agents: new Set<string>() };

  MEDALS.forEach((medal, index) => {
    const rank = index + 1;
    const byActor = new Map<string, Item[]>();
    for (const entry of entries) {
      for (const actor of reactors(entry, medal)) byActor.set(actor, [...(byActor.get(actor) ?? []), entry]);
    }
    for (const [actor, onEntries] of byActor) {
      if (onEntries.length > 1) {
        for (const entry of onEntries) {
          dropped.push({ actorId: actor, itemId: entry.id, mark: medal, why: `the same ${medal} on ${onEntries.length} entries — counted on neither` });
        }
        continue;
      }
      const entry = onEntries[0]!;
      const score = scores.get(entry.id)!;
      const agent = isAgent(actor);
      if (fighterOf.get(actor) === score.packId) {
        dropped.push({ actorId: actor, itemId: entry.id, mark: medal, why: "a fighter never ranks its own entry" });
        continue;
      }
      const ranks = agent && fighterOf.has(actor) ? n - 1 : n;
      const points = ranks - rank + 1;
      if (points <= 0) {
        dropped.push({ actorId: actor, itemId: entry.id, mark: medal, why: `there are only ${ranks} entries to rank` });
        continue;
      }
      if (agent) {
        score.agents += points;
        voters.agents.add(actor);
      } else {
        score.people += points;
        voters.people.add(actor);
      }
    }
  });

  let decided: Item | null = null;
  for (const entry of entries) {
    for (const actor of reactors(entry, TROPHY)) {
      if (actor === bout.decider) {
        if (decided && decided.id !== entry.id) {
          dropped.push({ actorId: actor, itemId: entry.id, mark: TROPHY, why: "the Decider's 🏆 on two entries — the recorded pick stands" });
        } else decided = entry;
      } else scores.get(entry.id)!.trophies += 1;
    }
  }
  if (bout.winner) decided = entries.find((e) => e.id === bout.winner) ?? decided;

  return {
    entries: [...scores.values()].sort((a, b) => b.people - a.people || b.agents - a.agents),
    decided,
    dropped,
    voters: { people: voters.people.size, agents: voters.agents.size },
  };
}

/**
 * **A person's ballot as an ordering** — the ranked entries in medal order,
 * then the unranked. What a ranking IS to the evals project: N·(N−1)/2
 * preference pairs, labelled by who, about entries built from one brief.
 */
function ballotsOf(bout: Bout, agentIds: ReadonlySet<string>): { voter: string; order: string[]; ranked: number }[] {
  const entries = entriesOf(bout);
  const fighters = new Set(bout.lanes.flatMap((lane) => (lane.actorId ? [lane.actorId] : [])));
  const voters = new Set<string>();
  for (const entry of entries) for (const medal of MEDALS) for (const a of reactors(entry, medal)) voters.add(a);
  const out: { voter: string; order: string[]; ranked: number }[] = [];
  for (const voter of voters) {
    if (fighters.has(voter) || agentIds.has(voter)) continue;
    const ranked: string[] = [];
    for (const medal of MEDALS) {
      const on = entries.filter((e) => reactors(e, medal).includes(voter));
      if (on.length === 1 && !ranked.includes(on[0]!.id)) ranked.push(on[0]!.id);
    }
    const rest = entries.map((e) => e.id).filter((id) => !ranked.includes(id));
    out.push({ voter, order: [...ranked, ...rest], ranked: ranked.length });
  }
  return out;
}

/** Below this many bouts, a fighter has a record and no rating: one win in
 *  one bout is not a standing. Design Arena hides a model under fifteen
 *  comparisons; a canvas's bouts are rarer and each is a full ranking. */
export const MIN_BOUTS = 3;

export interface Standing {
  packId: string;
  bouts: number;
  wins: number;
  meanBorda: number;
  /** Bradley–Terry on the arenas' 400·log₁₀ scale around 1500, or null
   *  below `MIN_BOUTS`. */
  rating: number | null;
}

/**
 * **Standings, derived, never stored** — every bout's record, and a
 * Bradley–Terry rating fitted over every pairwise preference the people's
 * ballots imply (the method the arenas use), by the minorisation–maximisation
 * iteration: small, exact enough, and no dependency.
 */
export function standings(canvas: CanvasContents, agentIds: ReadonlySet<string>): Standing[] {
  const record = new Map<string, { bouts: number; wins: number; borda: number }>();
  const wins = new Map<string, number>();
  const games = new Map<string, number>();
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const bout of bouts(canvas)) {
    const entries = entriesOf(bout);
    if (entries.length < 2) continue;
    const tally = competitionTally(bout, agentIds);
    const packOf = new Map(entries.map((e) => [e.id, e.properties[P.fighter] ?? ""]));
    for (const score of tally.entries) {
      const r = record.get(score.packId) ?? { bouts: 0, wins: 0, borda: 0 };
      r.bouts += 1;
      r.borda += score.people;
      if (tally.decided?.id === score.entry.id) r.wins += 1;
      record.set(score.packId, r);
    }
    for (const ballot of ballotsOf(bout, agentIds)) {
      for (let i = 0; i < ballot.ranked; i++) {
        for (let j = i + 1; j < ballot.order.length; j++) {
          const winner = packOf.get(ballot.order[i]!)!;
          const loser = packOf.get(ballot.order[j]!)!;
          wins.set(winner, (wins.get(winner) ?? 0) + 1);
          games.set(key(winner, loser), (games.get(key(winner, loser)) ?? 0) + 1);
        }
      }
    }
  }
  const packs = [...record.keys()];
  const strength = new Map(packs.map((p) => [p, 1]));
  for (let iteration = 0; iteration < 100; iteration++) {
    for (const i of packs) {
      let denominator = 0;
      for (const j of packs) {
        if (i === j) continue;
        const n = games.get(key(i, j)) ?? 0;
        if (n > 0) denominator += n / (strength.get(i)! + strength.get(j)!);
      }
      // A pack that has never been preferred keeps a floor, so the scale
      // stays finite; its rating says "bottom", not "minus infinity".
      if (denominator > 0) strength.set(i, Math.max(1e-3, (wins.get(i) ?? 0) / denominator));
    }
    const mean = Math.exp(packs.reduce((s, p) => s + Math.log(strength.get(p)!), 0) / Math.max(1, packs.length));
    for (const p of packs) strength.set(p, strength.get(p)! / mean);
  }
  return packs
    .map((packId) => {
      const r = record.get(packId)!;
      return {
        packId,
        bouts: r.bouts,
        wins: r.wins,
        meanBorda: Math.round((r.borda / r.bouts) * 10) / 10,
        rating: r.bouts >= MIN_BOUTS ? Math.round(1500 + 400 * Math.log10(strength.get(packId)!)) : null,
      };
    })
    .sort((a, b) => (b.rating ?? -Infinity) - (a.rating ?? -Infinity) || b.wins - a.wins || b.meanBorda - a.meanBorda);
}
