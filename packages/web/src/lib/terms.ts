/**
 * **What the innkeeper owes a stranger, as data** (phase 13.7).
 *
 * [`docs/projects/multiuser/innkeeper.md`](../../../../docs/projects/multiuser/innkeeper.md) chose the
 * posture out loud — *an* innkeeper, never *the* innkeeper — and left one line
 * open under it: "who operates the default home, under what terms — a named
 * operator, a terms document, and pricing are product work this doc only
 * obligates". This module is that terms document, and the page that draws it is
 * the doc said plainly to somebody who has read nothing.
 *
 * **Here rather than in the JSX for the reason `lib/ledger.ts` is.** The right
 * column of the front page is a promise about the CLI and is checked against the
 * CLI; every paragraph here is a promise about the *home*, and its source is a
 * design doc in this same repo. So each section carries the sentence in
 * `innkeeper.md` it restates, and `packages/web/test/terms.test.ts` checks those
 * sentences are still in the doc — which makes the failure mode legible in the
 * direction it actually arrives from. Nobody edits this page and forgets the
 * design; somebody edits the design (a ledger stops being private, a replica
 * stops holding blobs) and this page goes on making the old promise to
 * strangers. The guard fails on the doc's edit, at the page.
 *
 * Deliberately **no command strings**, unlike the ledger. The front page's rows
 * are things a reader will paste within a minute; nothing here is, and a verb
 * printed on a terms page is one more copy that ages for no gain — the sentence
 * "the home is an ordinary isocan daemon" is the load-bearing claim, not its
 * spelling on a command line.
 *
 * **No legalese, no invented facts.** There is no company, no jurisdiction, no
 * arbitration clause and no entity here, because there is none: the operator is
 * a person, named, with an address that reaches him. Anything this page cannot
 * say honestly it does not say.
 */

export type TermsSection = {
  /** Stable key: the anchor a link can name, and what the guard reports by. */
  id: string;
  /** The obligation, as a heading somebody scanning would stop on. */
  heading: string;
  /** The paragraphs, in the order a reader meets them. */
  body: readonly string[];
  /**
   * The sentences in `docs/projects/multiuser/innkeeper.md` this section restates, verbatim
   * enough to survive the doc's line wrapping (the guard collapses whitespace
   * and strips markdown emphasis before looking). Never empty: a section with no
   * source is a claim this home made up.
   */
  sources: readonly string[];
};

/** The page's one-sentence promise about itself, before any obligation. */
export const TERMS_LEDE =
  "This is the plain version, and it is the only version — there is no second " +
  "document written in lawyer. What follows is what running this home actually " +
  "obliges, said the way the design it comes from says it.";

/**
 * **The sentence phase 13 deletes.**
 *
 * Sovereignty by replica is fact today; the *one command* that moves a canvas
 * to a different home is not built. `docs/projects/multiuser/phases.md`'s phase 13 says so in its
 * own Work — "re-homing's landing also retires the sovereignty caveat phase
 * 13.7 wrote into the terms — deleting that sentence is part of this phase's
 * outcome" — so it is written as one paragraph with its own name, findable by
 * grep from that sentence rather than buried mid-prose where a later session
 * would have to re-derive which half of the caveat expired.
 *
 * **Deleting it is the whole change.** Drop this constant and its line in
 * `SOVEREIGNTY`; the paragraphs on either side stand alone and stay true.
 */
export const RE_HOMING_NOT_YET =
  "What is not built yet is the one command that moves a canvas to a different " +
  "home. It is designed and it is planned; until it ships, leaving means " +
  "standing your work up at another home by hand rather than pressing a " +
  "button. This paragraph comes off this page the day that command lands.";

const SOVEREIGNTY: TermsSection = {
  id: "sovereignty",
  heading: "Your copy of the work",
  body: [
    "Sovereignty by replica is already fact, and it is what makes the paragraphs above survivable. A daemon's ~/.isocan holds the full store — the operation log and the files — so any canvas with at least one member running a daemon has a complete copy outside this operator's walls, kept current by ordinary sync. Nothing has to be exported, and nobody has to ask.",
    RE_HOMING_NOT_YET,
    "And a canvas that only ever lived in browser tabs has no such copy at all. The tab keeps a real replica — that is what lets it work with the network gone — but browser storage is the browser's to evict, it holds the working set rather than the whole store, and it cannot stand as the source a new home adopts from. If every member of a canvas is a browser tab, that canvas's sovereignty is only as good as this operator's. Run a daemon on the work you would mind losing.",
  ],
  sources: [
    "daemon's ~/.isocan holds the full store — oplog and blobs",
    "A browser-only canvas has no thick replica",
  ],
};

export const TERMS: readonly TermsSection[] = [
  {
    id: "operator",
    heading: "Who runs this home",
    body: [
      "This home is run by Dimitri Glazkov, an individual — not a company. There is no legal entity behind this page, no support desk, and nobody else on rotation.",
      "Questions, takedown requests and abuse reports all go to dimitri@glazkov.com. One address, read by the person who operates the home.",
      "It is worth knowing, before you put work here, that this is a young project run by one person. Most of the rest of this page is about what to do about that.",
    ],
    sources: ["a named operator"],
  },
  {
    id: "reads",
    heading: "The home reads everything it hosts",
    body: [
      "Not hedged, and not an oversight: the home applies your operations through the same reducer every other isocan client runs. That is what makes it a home rather than a disk — it has to understand a canvas to order it, to merge two people writing at once, and to hand the result to whoever opens it next.",
      "So end-to-end encryption of canvas content is off the table by design. The operator can read your canvas: the items on it, the files you drop on it, the comments you write on it, and who was working there.",
      "The honest form of that is not a promise never to look. It is this page telling you the ability exists by construction, before you decide what to put here.",
    ],
    sources: ["the home reads everything it hosts"],
  },
  {
    id: "own-home",
    heading: "If that is unacceptable, run your own home",
    body: [
      "The protocol was built so you can. The home is an ordinary isocan daemon — the same program you already run on your own machine, started somewhere with an address — and nothing but the marker's address binds a canvas to a home.",
      "There is no layer here holding anything hostage. A team that wants its own home runs the daemon on a machine it owns and gives new canvases that address; one machine can hold work at more than one home at the same time, and choosing a different home for one canvas moves none of the others. This home has to earn being chosen.",
    ],
    sources: [
      "if that is unacceptable, run your own home — the protocol was built so you can",
      "The home is an ordinary isocan daemon",
      "Nothing but the marker's address binds a canvas to a home",
    ],
  },
  {
    id: "ledgers",
    heading: "Two ledgers, and the line between them",
    body: [
      "What this home holds falls in two piles, and they have different rules.",
      "Canvas state — the operation log, the snapshots, the files dropped on the canvas, and the public face of the actor registry: ids, names, colours — replicates to every badge admitted to that canvas. The home's copy is authoritative for order, not the only copy.",
      "The desk's ledgers — badges, the claims saying who may speak as which actor, attestations (which means email addresses), grants, provenance, and the log of which badge performed which operation — are innkeeper-private and are never replicated to any client, thick or thin. No holder ever syncs another holder's secrets.",
    ],
    sources: ["Replicated to every admitted badge", "Innkeeper-private, never replicated"],
  },
  SOVEREIGNTY,
  {
    id: "uptime",
    heading: "Uptime is a promise about liveness, never about your data",
    body: [
      "A dead home stops live cursors, summonses and thin guests — anyone working from a browser alone. It loses nothing a daemon's replica holds: daemons queue and reconnect, because being offline is not an error state here.",
      "There is no service level beyond what one person can watch, and that is exactly why the paragraph above matters. What is answered for is liveness; a replica is what makes an outage a pause rather than a loss.",
    ],
    sources: ["A dead home stops cursors, summonses, and thin guests"],
  },
  {
    id: "abuse",
    heading: "Abuse, and taking things down",
    body: [
      "What the operator can do, and will: kill a badge, revoke a grant — which sweeps everything that grant let in — delete a canvas and the files under it, and refuse somebody at the door.",
      "Write to dimitri@glazkov.com. Say which canvas and what is on it. Content that is illegal, or that exists to hurt somebody, comes down. There is no appeals process, because there is no process — there is one person reading the mail, and he will tell you what he did.",
    ],
    sources: ["Kill a badge, revoke a grant (provenance sweep), delete a canvas, refuse the door"],
  },
];

/**
 * What this page is, restated where a reader lands after all of it — and the
 * one thing a terms page usually lies about. This one is a file in a public
 * repository, so what it said last month is recoverable by anybody, which is a
 * stronger promise than "we may update these terms from time to time" and costs
 * nothing to keep.
 */
export const TERMS_HISTORY =
  "This page changes when the home's obligations change. It lives in the same " +
  "open-source tree as the rest of isocan, so what it said last month is in the " +
  "history with the reason beside it.";
