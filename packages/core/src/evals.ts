import type { CanvasContents, Comment, CommentThread } from "./model.ts";
import type { LogEntry } from "./ops.ts";
import { parseSlashCommand } from "./commands.ts";
import { undoneSeqs } from "./undone.ts";

/**
 * **The request corpus** — what people actually ask agents for, and what
 * happened next. Stage 1 of `docs/projects/evals/plan.md`.
 *
 * This is a READ over the oplog and the canvas snapshot. It stores nothing,
 * sends nothing, and writes to no canvas: the whole programme is meant to run
 * on one machine with no telemetry at all, and a report that needs a network
 * to be useful is a report that has already lost that argument.
 *
 * ## The join key the plan named does not exist
 *
 * The plan says `onThread` "is the join key the whole programme depends on:
 * it is what makes 'this ask produced these ops and that answer' a query
 * rather than a guess." It is not, and it cannot be. `onThread` lives on
 * `SessionState` — the presence plane, which `http.ts:2150` marks *ephemeral
 * — no oplog, no storage* — and the agent guide promises exactly that about
 * it: claiming a thread "costs no op, leaves no trace in the history, and
 * vanishes when you stop." Nothing about who was answering what survives the
 * session that said it.
 *
 * So the honest join is three weaker ones, and this file's central rule is
 * that **it says which of the three it used for every row**. `Attribution`
 * is not decoration:
 *
 * - `anchor` — the thread is pinned to the item (`thread.anchorItemId`).
 *   Durable canvas state, and as close to a fact as this gets.
 * - `reference` — the ask or its answer named the item (`comment.items`,
 *   which carries both the `#ref`s and whatever the author had selected).
 *   Also durable, also recorded at authoring time by the person who meant it.
 * - `window` — an op by the answering actor, after the ask and before the
 *   next thing anybody said in that thread. **This one is a guess.** It is
 *   included because excluding it would report zero for most real asks, and
 *   it is labelled because a guess that is counted alongside facts stops
 *   being distinguishable from one.
 *
 * A consumer that wants only the defensible half filters to `anchor` and
 * `reference`. That is why the field is on every op rather than a summary
 * statistic at the bottom.
 *
 * ## What is deliberately not here
 *
 * No score, and no ratio. The plan's own reason for the personas applies
 * exactly: a number computed over a handful of asks is noise wearing a
 * decimal point. This returns counts and rows; whoever reads them can see how
 * few there are.
 */

/** What became of an ask. */
type AskOutcome =
  /** Somebody other than the asker replied in the thread. */
  | "answered"
  /** The asker called it off — a `/cancel` later in the same thread. */
  | "cancelled"
  /** Nothing came back. The quiet half, and the one worth looking at. */
  | "silent";

/** How an op was tied to an ask. See the file comment: `window` is a guess. */
export type Attribution = "anchor" | "reference" | "window";

interface AttributedOp {
  seq: number;
  type: string;
  itemId?: string;
  how: Attribution;
  /** True when a person later reversed this op — implicit negative feedback,
   * already written down. Derived from the log's own undo entries by
   * `undoneSeqs`, NOT from `LogEntry.undoneBy`, which never crosses the wire
   * and would make this permanently false. */
  undone: boolean;
}

/**
 * **What kind of ask this is** — Stage 1's taxonomy, the categories that came
 * out of hand-labelling every human ask at one home on 3 September 2026
 * (`docs/research/2026-09-03-what-people-ask-agents-for.md`), not ones
 * brought to the data. Fifteen, and the first eleven are the work:
 *
 * - `create` — something that did not exist: a screen, an app, a deck, a
 *   card, a diagram, a wireframe, a drawing.
 * - `revise` — change a thing that exists: swap an image, reword, add a
 *   bullet, reorder, animate, a hover state.
 * - `restyle` — the look of a thing that exists: redesign, apply a design
 *   system, "make it pop".
 * - `variation` — several takes to choose between; diverge.
 * - `converge` — pick one, merge two, apply the chosen version.
 * - `critique` — compare, audit, judge, grill.
 * - `repair` — it is broken, or the last answer missed.
 * - `arrange` — tidy, format, rearrange, merge layers, delete.
 * - `document` — write it down: a README, a spec, a design system, an IA.
 * - `question` — explain, how does it work, what would happen.
 * - `orchestrate` — point an agent at work: a bare mention, "this one's for
 *   you", "are you there", running a sprint.
 * - `ops`, `cancel`, `social`, `probe` — the rest: deploy it; call it off;
 *   thanks and hello; a test canvas's echo.
 *
 * `categoriseAsk` is a classifier over words, calibrated against those hand
 * labels and reported with its agreement rather than trusted — the research
 * note carries the number. It exists so the distribution can be read for a
 * canvas nobody has labelled, with that caveat attached.
 */
export type AskCategory =
  | "create"
  | "revise"
  | "restyle"
  | "variation"
  | "converge"
  | "critique"
  | "repair"
  | "arrange"
  | "document"
  | "question"
  | "orchestrate"
  | "ops"
  | "cancel"
  | "social"
  | "probe";

const COMMAND_CATEGORY: Record<string, AskCategory> = {
  cancel: "cancel",
  format: "arrange",
  variation: "variation",
  "design-audit": "critique",
  "grill-me": "critique",
  "design-system": "restyle",
  sprint: "orchestrate",
  ask: "question",
};

export function categoriseAsk(body: string, command: string | null): AskCategory {
  if (command !== null) return COMMAND_CATEGORY[command] ?? "question";
  const text = body.replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  // Strip the mentions; what is left is what was asked. Nothing left, or
  // next to nothing, is a person pointing an agent at the thing above.
  const words = lower.replace(/@[\w'’.-]+(?:\s+[\w'’.-]+)*?\s*🤖?/g, " ").replace(/[^\p{L}\p{N}?]+/gu, " ").trim();
  if (/^(thanks|thank you|amazing|awesome|nice|great|love it|hello|hi|hey)\b/.test(lower) && words.split(" ").length <= 6) return "social";
  if (words.split(" ").filter(Boolean).length <= 1) return "orchestrate";
  if (/^(probe\b|echo check)/.test(lower)) return "probe";
  if (/\b(this one'?s for you|this is for you|take (on|up) this|pick this up|can you work on this|are you (there|here)|read .* and do it|\^\^\^)/.test(lower)) return "orchestrate";
  if (/\b(github pages|deploy|host(ed|ing)?\b|make it public)/.test(lower)) return "ops";
  // Broken outranks the question it is often phrased as: "when I go full
  // screen it doesn't fill — can you fix that?" opens like a question and is
  // a repair.
  if (/\b(fix|broken|bug|doesn'?t work|isn'?t working|not working|don'?t see|still (broken|not)|looks broken)\b/.test(lower)) return "repair";
  if (/^(how|what|why|when|where|who|which|does|do|is|are|wait|can i|could i)\b/.test(lower) && !/\b(what would a .* (version|look)|what do you think about having)/.test(lower)) return "question";
  if (/\b(variations?|different (styles|designs|takes|versions)|\d+ (variations|versions|takes|options)|what would an? .* version look like|best shots?|your take)\b/.test(lower)) return "variation";
  if (/\b(merge (the|these|both) .*(take|version|best)|best of both|take the best|use this (one|version)|update the main .* to use)\b/.test(lower)) return "converge";
  if (/\b(critique|audit|which (one )?(is|do you think)|are these good|what do you think of|superior|grill)\b/.test(lower)) return "critique";
  if (/\b(tidy|rearrange|organi[sz]ed?|merge these into one|line (them )?up|clean up|delete the|remove the)\b/.test(lower)) return "arrange";
  if (/\b(readme|spec\b|design\.md|write up|write a doc|document(ation)?\b|information architecture|extract the .* design system)/.test(lower)) return "document";
  if (/\b(restyle|redesign|reimagine|reskin|look and feel|make it pop|glassmorphic|design system|font pairings?|fonts?\b|high end|modern (fonts|layout))/.test(lower)) return "restyle";
  if (/\b(change|update|replace|nudge|reorder|hover|animate[ds]?|integrate|swap|centered|sparkly|dark mode|light\/dark|sorted|add (another|a bullet|the image)|make (it|this|these|them|that)\b|space it out|moving around|flying out|explodes)/.test(lower)) return "revise";
  if (/\b(create|build|make|draw|sketch|wireframe|generate|design (a|an|me|two|three)|new screen|add a text node|greeting|card for|quiz|deck|diagrams?)\b/.test(lower)) return "create";
  return lower.endsWith("?") ? "question" : "revise";
}

interface AskEntry {
  threadId: string;
  commentId: string;
  at: string;
  askedBy: { id: string; name: string };
  /** Actor ids the comment @-mentioned, as resolved when it was written. */
  askedOf: string[];
  /** Landed in the Chat, which reaches every agent with no mention needed. */
  main: boolean;
  /** Whether somebody was named, or the Chat reached everybody. See `askKind`:
   * `broadcast` is an upper bound on a canvas with no enrolled agents. */
  kind: AskKind;
  /** The slash command it opened with, if it opened with one — `/design-audit`
   * and `/format` are asks with a known shape, and knowing which is most of
   * Stage 1's taxonomy for free. */
  command: string | null;
  /** What kind of ask, by `categoriseAsk` — a classifier's reading, not a
   * label. The research note reports how often it agrees with a person. */
  category: AskCategory;
  /** The words. Never leaves the machine: see `plan.md` Stage 6, which puts
   * comment text on the list of what is never sent on any setting. */
  body: string;
  outcome: AskOutcome;
  /** How long until somebody answered, in seconds. Only for `answered`. */
  answeredIn?: number;
  answeredBy?: string;
  produced: AttributedOp[];
}

interface CorpusSummary {
  asks: number;
  /** The two populations, apart. `addressed` is measured; `broadcast` is an
   * upper bound unless every agent here has been enrolled. */
  addressed: number;
  broadcast: number;
  /** True when `canvas.agents` is empty, so nothing could be excluded as an
   * agent's own reply. The reader needs this to know which number they hold. */
  broadcastUnfiltered: boolean;
  answered: number;
  cancelled: number;
  silent: number;
  /** Ops attributed at all, and the defensible subset. Reported apart so the
   * difference between "we know" and "we think" is visible without arithmetic. */
  opsAttributed: number;
  opsByAnchorOrReference: number;
  /** Attributed ops a person reversed. */
  opsUndone: number;
  /** Asks that opened with a slash command, by name, commonest first. */
  commands: { name: string; count: number }[];
  /** Asks by category, commonest first — the classifier's reading of every
   * row here, agent receipts included. Read with the caveat on `category`. */
  categories: { name: AskCategory; count: number; silent: number }[];
}

interface Corpus {
  summary: CorpusSummary;
  asks: AskEntry[];
}

/**
 * Is this comment an ask, and of which kind?
 *
 * Two populations, counted apart on purpose:
 *
 * - `addressed` — it @-mentions somebody. Recorded at authoring time by the
 *   person who meant it, so this is a fact.
 * - `broadcast` — it landed in the Chat, which reaches every agent with no
 *   mention needed. That is what makes the Chat the Chat, and it is why a
 *   parked agent wakes on all of it.
 *
 * **They are reported separately because `broadcast` overcounts, and the
 * canvas cannot always tell how much.** In the Chat an agent's own receipt
 * looks exactly like a question: same shape, same channel, and nothing in the
 * comment says which it is. Where somebody has run `agent.enroll` the canvas
 * DOES know — `canvas.agents` is a durable record of who answers here — and
 * an enrolled agent's own Chat comments are excluded below. Where nobody has
 * enrolled anybody, they are not, and the `broadcast` count is an upper bound
 * rather than a measurement.
 *
 * Measured on a real canvas the day this was written: 11 rows, of which 7
 * were an agent's own replies. That is the whole reason the split exists.
 * There is no `isAgent` bit on `Actor` to reach for instead, and inventing
 * one here would be a second opinion about identity; the roster owns that.
 */
type AskKind = "addressed" | "broadcast";

function askKind(
  comment: Comment,
  thread: CommentThread,
  agents: ReadonlySet<string>,
): AskKind | null {
  if ((comment.mentions ?? []).length > 0) return "addressed";
  // An enrolled agent talking in the Chat is answering, not asking. Outside
  // the Chat a comment mentioning nobody is ether that wakes nobody, so it is
  // not an ask either way.
  if (thread.main !== true) return null;
  return agents.has(comment.author.id) ? null : "broadcast";
}

/**
 * Every ask on this canvas, oldest first, with what followed it.
 *
 * `log` is the whole record — archive first, then live, exactly as
 * `buildRecap` takes it — because an ask from three weeks ago is the
 * interesting kind and `gc` may have compacted it.
 */
export function buildCorpus(canvas: CanvasContents, log: LogEntry[]): Corpus {
  const asks: AskEntry[] = [];
  const agents = new Set(Object.keys(canvas.agents ?? {}));

  // Ops that are worth attributing to an ask at all. Undo and redo entries are
  // excluded as SOURCES — an undo is a verdict on an op, and it is already
  // reported through `undone` on the op it reversed. Counting it as work an
  // ask produced would credit the ask twice and with the wrong sign.
  const work = log.filter((entry) => entry.cause === undefined);
  // Derived from the log rather than read off the entry: see `undoneSeqs`.
  const undone = undoneSeqs(log);

  for (const thread of Object.values(canvas.threads)) {
    for (const [index, comment] of thread.comments.entries()) {
      const kind = askKind(comment, thread, agents);
      if (kind === null) continue;

      const later = thread.comments.slice(index + 1);
      // The reply that closed it: the first thing said by anybody other than
      // the asker. The asker's own follow-ups do not close their own ask —
      // that is the same rule `/ask` uses for when a question stops being
      // open, and the two should not disagree.
      const answer = later.find((c) => c.author.id !== comment.author.id);
      // A cancel is the asker calling it off, so only their own later comments
      // count. Somebody else typing `/cancel` is cancelling their own thing.
      //
      // And it calls off the ask it follows, not every ask the person ever
      // made here. The first reading of this — "any later /cancel by the
      // asker" — was measured on 3 Sep 2026 and found to mark 16 asks on one
      // canvas cancelled because the person typed `/cancel` once, in the Chat,
      // after all of them. In the Chat every comment shares one thread, so
      // that reading turned a single withdrawal into a sixteen-fold one. The
      // cancel belongs to the asker's most recent ask before it: walk their
      // own later comments, and the first one decides — a `/cancel` cancels
      // this ask; anything else is a newer ask, and a cancel after that one is
      // its cancel, not this one's.
      const ownNext = later.find((c) => c.author.id === comment.author.id);
      const cancelled = ownNext !== undefined && parseSlashCommand(ownNext.body)?.name === "cancel";

      // The window closes at the next thing anybody said here, not at the
      // answer: an agent that posts its receipt and then keeps tidying is
      // still working on this ask, and the next person to speak is the first
      // moment a later op might belong to something else.
      const nextWord = later[0]?.createdAt;

      const outcome: AskOutcome = cancelled
        ? "cancelled"
        : answer
          ? "answered"
          : "silent";

      const referenced = new Set([
        ...(comment.items ?? []),
        ...(answer?.items ?? []),
      ]);
      const anchor = thread.anchorItemId;
      // Who to believe the work came from. In the Chat nobody is named, so the
      // answerer is the only candidate; outside it the mentioned agents are.
      const answerers = new Set(
        [answer?.author.id, ...(comment.mentions ?? [])].filter(
          (id): id is string => id !== undefined,
        ),
      );

      const produced: AttributedOp[] = [];
      for (const entry of work) {
        const ts = entry.envelope.ts;
        if (ts < comment.createdAt) continue;
        const itemId = itemOf(entry);

        // Strongest first, and each op is claimed once: an op on the anchored
        // item is `anchor` even when the reply also named it, because saying
        // `reference` there would understate what is known about it.
        let how: Attribution | null = null;
        if (itemId !== undefined && anchor !== null && itemId === anchor) how = "anchor";
        else if (itemId !== undefined && referenced.has(itemId)) how = "reference";
        else if (
          answerers.has(entry.envelope.actor.id) &&
          (nextWord === undefined || ts < nextWord)
        )
          how = "window";
        if (how === null) continue;

        produced.push({
          seq: entry.seq,
          type: entry.envelope.op.type,
          ...(itemId !== undefined ? { itemId } : {}),
          how,
          undone: undone.has(entry.seq),
        });
      }

      asks.push({
        threadId: thread.id,
        commentId: comment.id,
        at: comment.createdAt,
        askedBy: { id: comment.author.id, name: comment.author.name },
        askedOf: comment.mentions ?? [],
        main: thread.main === true,
        kind,
        command: parseSlashCommand(comment.body)?.name ?? null,
        category: categoriseAsk(comment.body, parseSlashCommand(comment.body)?.name ?? null),
        body: comment.body,
        outcome,
        ...(answer
          ? {
              answeredIn: Math.max(
                0,
                Math.round(
                  (Date.parse(answer.createdAt) - Date.parse(comment.createdAt)) / 1000,
                ),
              ),
              answeredBy: answer.author.name,
            }
          : {}),
        produced,
      });
    }
  }

  asks.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  const commands = new Map<string, number>();
  for (const ask of asks) {
    if (ask.command === null) continue;
    commands.set(ask.command, (commands.get(ask.command) ?? 0) + 1);
  }

  const categories = new Map<AskCategory, { count: number; silent: number }>();
  for (const ask of asks) {
    const row = categories.get(ask.category) ?? { count: 0, silent: 0 };
    row.count += 1;
    if (ask.outcome === "silent") row.silent += 1;
    categories.set(ask.category, row);
  }

  const every = asks.flatMap((a) => a.produced);
  return {
    summary: {
      asks: asks.length,
      addressed: asks.filter((a) => a.kind === "addressed").length,
      broadcast: asks.filter((a) => a.kind === "broadcast").length,
      broadcastUnfiltered: agents.size === 0,
      answered: asks.filter((a) => a.outcome === "answered").length,
      cancelled: asks.filter((a) => a.outcome === "cancelled").length,
      silent: asks.filter((a) => a.outcome === "silent").length,
      opsAttributed: every.length,
      opsByAnchorOrReference: every.filter((o) => o.how !== "window").length,
      opsUndone: every.filter((o) => o.undone).length,
      commands: [...commands]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1)),
      categories: [...categories]
        .map(([name, row]) => ({ name, ...row }))
        .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1)),
    },
    asks,
  };
}

/**
 * **Preference pairs, harvested from version stacks** — the plan's "what to do
 * first" #2, and the thing it calls the single highest-leverage item in the
 * document.
 *
 * The claim being tested: `/variation` produces N alternatives and
 * `item.setCurrentVersion` records which one won, so a canvas in ordinary use
 * generates human-labelled comparison data for free.
 *
 * **A pair only exists when there was a choice.** Promoting the only version
 * on a stack is not a preference, and neither is promoting the newest one that
 * has just arrived — those are a no-op and a save. What counts is somebody
 * making an EARLIER version current again while later ones existed: that is a
 * person looking at N things and keeping one, which is the expensive kind of
 * label. Counting every `setCurrentVersion` would inflate the number with
 * saves, and an inflated count here would be read as "Stage 4's calibration
 * problem is solved" when it is not.
 */
interface PreferencePair {
  itemId: string;
  title: string;
  /** The version made current. */
  chosen: string;
  chosenAt: string;
  chosenBy: string;
  /** Every version that existed at that moment and was not chosen. */
  against: string[];
}

export function harvestPreferences(
  canvas: CanvasContents,
  log: LogEntry[],
): PreferencePair[] {
  const pairs: PreferencePair[] = [];
  // Which versions existed by the time each promotion happened. Replaying the
  // log is what makes "and was not chosen" mean *at the time* rather than
  // *now* — a version added afterwards was never in the running.
  const seen = new Map<string, string[]>();

  for (const entry of log) {
    const op = entry.envelope.op;
    if (op.type === "item.add") {
      seen.set(op.itemId, [op.version.id]);
      continue;
    }
    if (op.type === "item.addVersion") {
      const stack = seen.get(op.itemId) ?? [];
      seen.set(op.itemId, [...stack, op.version.id]);
      continue;
    }
    if (op.type !== "item.setCurrentVersion") continue;

    const stack = seen.get(op.itemId) ?? [];
    const at = stack.indexOf(op.versionId);
    // Unknown version, or the newest one — a save, not a choice. See above.
    if (at === -1 || at === stack.length - 1) continue;
    const against = stack.filter((id) => id !== op.versionId);
    if (against.length === 0) continue;

    pairs.push({
      itemId: op.itemId,
      title: canvas.items[op.itemId]?.title ?? op.itemId,
      chosen: op.versionId,
      chosenAt: entry.envelope.ts,
      chosenBy: entry.envelope.actor.name,
      against,
    });
  }

  return pairs;
}

/**
 * The item an op is about, when it is about one.
 *
 * Deliberately narrow, and `itemId` is the whole rule: `item.add` carries one,
 * so a creation is attributable like any other op. What is left out is
 * `items.move` — one op carrying MANY items, which is the shape a paste and a
 * `format` both take. Attributing it to one ask would credit that ask with
 * every item in the gesture, so it falls through to the window instead, where
 * it is labelled a guess.
 */
function itemOf(entry: LogEntry): string | undefined {
  const op = entry.envelope.op;
  if ("itemId" in op && typeof op.itemId === "string") return op.itemId;
  return undefined;
}
