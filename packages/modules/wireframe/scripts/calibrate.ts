/**
 * **Is Jev any good at this? — the archetype question against Enrico**
 * (wireframes phase 6; research §4, *A calibration set that already exists*).
 *
 *   node --env-file=<secrets> --import tsx packages/modules/wireframe/scripts/calibrate.ts \
 *     --hierarchies <dir of <id>.json> --topics <design_topics.csv> --out <dir> \
 *     [--answerer jev|stub] [--options all|enrico] [--labels ids|words|described] [--sample N]
 *     [--limit N] [--concurrency N] [--budget 1.00] [--state-chars 6000]
 *
 * Enrico is 1,460 Android screens, each with a view hierarchy and a
 * person's topic label. Each screen becomes one question — *which archetype
 * is this screen?* — over every archetype id the catalog names, with a known
 * answer. The script maps Enrico's 20 topics onto those ids (`TOPIC_MAP`;
 * four topics have no archetype and are left out), flattens each hierarchy to
 * bounded text, asks, and reads the answers back as accuracy, a confusion
 * summary, and a reliability curve over `probabilities[choice]` — the
 * calibrated quantity (judge phase 0), never `confidence`.
 *
 * `--labels` is how the options read (24 Sep 2026): `ids` offers the ids
 * described by their recipes (phase 6's run), `words` offers
 * `ARCHETYPE_WORDS` as the options themselves and maps the answer back,
 * `described` keeps the ids and describes each in those words. `--sample N`
 * asks N screens spread evenly over the sorted set, so two runs of the same
 * N ask the same screens.
 *
 * Results are written as they arrive, one line per screen, to
 * `<out>/answers.<answerer>.<options>[.<labels>].jsonl` (no suffix for `ids`); a rerun skips every screen already answered, so a
 * crash never pays twice. `<out>/report.<answerer>.<options>.md` is rewritten from the whole file
 * at the end. The dataset stays wherever it was downloaded — nothing here
 * copies a screen into the repository.
 *
 * Nothing is sent before the projected spend is under `--budget`, and the run
 * stops asking the moment measured spend reaches it.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  ARCHETYPE_IDS, ARCHETYPE_WORDS, JEV_INPUT_PRICE, JEV_MODEL, RECIPE_BY_ID, describeRecipe, jevAnswerer, plainOptions, stubAnswerer,
  type Answerer, type JevRequest,
} from "../src/core.ts";

// ---------- the label map

/**
 * **Enrico's 20 topics, as archetype ids.** `primary` is the one answer
 * scored as strictly right; `accept` widens it where Enrico's topic is
 * coarser than the catalog (Enrico's `login` holds sign-up and verify
 * screens too; `news` is a feed or a blog). `null` is a topic with no
 * archetype at all — those screens are not asked.
 */
export const TOPIC_MAP: Record<string, { primary: string; accept: string[] } | null> = {
  list: { primary: "list", accept: ["list"] },
  tutorial: { primary: "onboarding", accept: ["onboarding", "welcome"] },
  gallery: { primary: "gallery", accept: ["gallery"] },
  login: { primary: "sign-in", accept: ["sign-in", "sign-up", "verify"] },
  form: { primary: "form", accept: ["form"] },
  settings: { primary: "settings", accept: ["settings"] },
  menu: { primary: "menu", accept: ["menu"] },
  modal: { primary: "confirm", accept: ["confirm"] },
  profile: { primary: "profile", accept: ["profile"] },
  news: { primary: "feed", accept: ["feed", "blog"] },
  terms: { primary: "legal", accept: ["legal"] },
  search: { primary: "search", accept: ["search"] },
  mediaplayer: { primary: "player", accept: ["player"] },
  editor: { primary: "editor", accept: ["editor"] },
  chat: { primary: "chat", accept: ["chat"] },
  maps: { primary: "map", accept: ["map"] },
  bare: null,
  other: null,
  camera: null,
  calculator: null,
};

/** Waves 2 and 3 have no recipes yet, so their options are described in words. */
const LATER_WAVES: Record<string, string> = {
  storefront: "Storefront: a shop's front page — featured products, categories, promotions",
  cart: "Cart: the items chosen to buy, quantities, a subtotal and a checkout button",
  checkout: "Checkout: shipping, payment and order review before buying",
  "order-placed": "Order placed: confirmation that a purchase went through",
  pricing: "Pricing: plans side by side with prices and an upgrade button",
  landing: "Landing: a marketing page — hero, features, call to action",
  about: "About: who made this, what it is, version and credits",
  contact: "Contact: ways to get in touch, a message form, an address",
  blog: "Blog: a list of articles or one article to read",
  "master-detail": "Master-detail: a list beside the selected item's detail",
  chat: "Chat: a conversation — message bubbles and a compose field",
  notifications: "Notifications: a list of alerts and activity",
  player: "Player: media playback — artwork, a scrubber, play/pause and track controls",
  map: "Map: a map view with markers, maybe a search field or a list of places",
  editor: "Editor: a canvas or document being edited — a toolbar of tools and the thing itself",
  comments: "Comments: a thread of replies with a reply field",
};

/** Every id some Enrico topic can be scored as right against — the option set `--options enrico` asks over. */
export const ENRICO_IDS: string[] = ARCHETYPE_IDS.filter((id) => Object.values(TOPIC_MAP).some((m) => m?.accept.includes(id)));

/**
 * The archetype ids as options, wave 1 described by its own recipe. `all` is
 * every id the catalog names — what round 1 will choose among; `enrico` is
 * only the ids a topic can be right against, so a screen Enrico has no word
 * for (a home, a detail) cannot be picked and scored wrong for it.
 */
export function archetypeCriteria(options: "all" | "enrico" = "all", labels: Labels = "ids"): Record<string, string | null> {
  const ids = options === "all" ? ARCHETYPE_IDS : ENRICO_IDS;
  if (labels === "words") return plainOptions(ids).criteria;
  const out: Record<string, string> = {};
  for (const id of ids) {
    const r = RECIPE_BY_ID.get(id);
    out[id] = labels === "described" ? ARCHETYPE_WORDS[id as keyof typeof ARCHETYPE_WORDS] : r ? `${r.title}: ${describeRecipe(r)}` : LATER_WAVES[id] ?? id;
  }
  return out;
}

/** How a question's options read: ids described by recipes, plain words as the options, or ids described in plain words. */
export type Labels = "ids" | "words" | "described";

/** `n` items spread evenly over `xs` — the same n picks the same items every run. */
export function spread<T>(xs: readonly T[], n: number): T[] {
  if (n <= 0 || n >= xs.length) return [...xs];
  return Array.from({ length: n }, (_, i) => xs[Math.floor((i * xs.length) / n)]!);
}

// ---------- the flattener

interface Node {
  class?: string;
  componentLabel?: string;
  text?: string;
  iconClass?: string;
  textButtonClass?: string;
  bounds?: number[];
  children?: Node[];
}

/** Enrico's hierarchies are RICO's semantic ones; two are raw activity dumps, whose root sits under `activity.root`. */
export function rootOf(json: unknown): Node {
  const j = json as { activity?: { root?: Node } } & Node;
  return j.activity?.root ?? j;
}

/**
 * **A hierarchy as text**: one line per labelled element in document order,
 * indented by how many labelled elements contain it — its type, its icon
 * class, its text (first 80 characters), and where it sits down the screen
 * as a percentage. Unlabelled containers are walked through, not printed; a
 * raw dump has no labels, so its class's short name stands in. Bounded by
 * `maxChars` deterministically: lines are kept in order until the next one
 * would not fit, and the rest are counted, never sampled.
 */
export function flatten(json: unknown, maxChars = 6000): { text: string; elements: number; dropped: number } {
  const root = rootOf(json);
  const height = root.bounds?.[3] && root.bounds[3] > 0 ? root.bounds[3] : 2560;
  const labelled = (n: Node): boolean => !!n && (!!n.componentLabel || (n.children ?? []).some(labelled));
  const raw = !labelled(root);
  const lines: string[] = [];
  const walk = (n: Node, depth: number) => {
    if (!n || typeof n !== "object") return;
    const label = n.componentLabel ?? (raw && (n.text || !n.children?.length) ? n.class?.split(".").pop() : undefined);
    let next = depth;
    if (label) {
      const bits = [label];
      const icon = n.iconClass ?? n.textButtonClass;
      if (icon) bits.push(`(${icon})`);
      const text = typeof n.text === "string" ? n.text.replace(/\s+/g, " ").trim() : "";
      if (text) bits.push(JSON.stringify(text.length > 80 ? `${text.slice(0, 80)}…` : text));
      if (n.bounds && n.bounds.length === 4) bits.push(`@${Math.max(0, Math.min(100, Math.round((n.bounds[1]! / height) * 100)))}%`);
      lines.push(`${"  ".repeat(depth)}${bits.join(" ")}`);
      next = depth + 1;
    }
    for (const c of n.children ?? []) walk(c, next);
  };
  walk(root, 0);
  let text = "";
  let kept = 0;
  for (const line of lines) {
    if (text.length + line.length + 1 > maxChars) break;
    text += `${line}\n`;
    kept++;
  }
  const dropped = lines.length - kept;
  if (dropped > 0) text += `… ${dropped} more elements\n`;
  if (lines.length === 0) text = "(no labelled elements)\n";
  return { text, elements: lines.length, dropped };
}

export const INSTRUCTIONS =
  "Which archetype is this mobile app screen? The screen is given as its view hierarchy flattened to text: one line per element, indented by nesting, with the element's type, icon, its text in quotes, and how far down the screen it starts. Choose the one archetype the whole screen is.";

export function screenRequest(screen: string, criteria: Record<string, string | null> = archetypeCriteria()): JevRequest {
  return {
    model: JEV_MODEL,
    state: { screen },
    questions: { archetype: { type: "choice", instructions: INSTRUCTIONS, criteria } },
  };
}

// ---------- the reading

export interface Row {
  id: string;
  topic: string;
  truth: string;
  accept: string[];
  choice: string;
  p: number;
  top3: Array<[string, number]>;
  /** The whole distribution as Jev returned it (rows from before it was kept have only `top3`). */
  distribution?: Record<string, number>;
  ms: number;
  tokens: number;
  by: string;
  dropped: number;
}

export interface Bin { lo: number; hi: number; n: number; meanP: number; accuracy: number }

/** Ten equal-width bins of `p` against how often the choice was right, and the count-weighted gap (ECE). */
export function reliability(points: Array<{ p: number; right: boolean }>, bins = 10): { bins: Bin[]; ece: number } {
  const acc = Array.from({ length: bins }, (_, i) => ({ lo: i / bins, hi: (i + 1) / bins, n: 0, sumP: 0, right: 0 }));
  for (const pt of points) {
    const b = acc[Math.min(bins - 1, Math.max(0, Math.floor(pt.p * bins)))]!;
    b.n++;
    b.sumP += pt.p;
    if (pt.right) b.right++;
  }
  const out = acc.map((b) => ({ lo: b.lo, hi: b.hi, n: b.n, meanP: b.n ? b.sumP / b.n : 0, accuracy: b.n ? b.right / b.n : 0 }));
  const total = points.length || 1;
  const ece = out.reduce((s, b) => s + (b.n / total) * Math.abs(b.accuracy - b.meanP), 0);
  return { bins: out, ece };
}

/** The accuracy above each cut of `p`: how much is kept, and how often what is kept is right. */
export function cuts(points: Array<{ p: number; right: boolean }>, at: number[]): Array<{ cut: number; kept: number; accuracy: number }> {
  return at.map((cut) => {
    const kept = points.filter((pt) => pt.p >= cut);
    return { cut, kept: kept.length, accuracy: kept.length ? kept.filter((k) => k.right).length / kept.length : 0 };
  });
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function report(rows: Row[], meta: { removed: Record<string, number>; unreadable: string[]; wallMs?: number; answerer: string; options: number }): string {
  const strict = rows.map((r) => ({ p: r.p, right: r.choice === r.truth }));
  const lenient = rows.map((r) => ({ p: r.p, right: r.accept.includes(r.choice) }));
  const acc = (pts: Array<{ right: boolean }>) => (pts.length ? pts.filter((x) => x.right).length / pts.length : 0);
  const rel = reliability(strict);
  const relL = reliability(lenient);
  const tokens = rows.reduce((s, r) => s + r.tokens, 0);
  const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
  const q = (f: number) => ms[Math.min(ms.length - 1, Math.floor(f * ms.length))] ?? 0;
  const wave1 = new Set(RECIPE_BY_ID.keys());
  const w1 = rows.filter((r) => wave1.has(r.truth));

  const lines: string[] = [];
  lines.push(`# Jev against Enrico — the archetype question`, "");
  lines.push(`Answerer: ${meta.answerer}; options: ${meta.options}; model(s): ${[...new Set(rows.map((r) => r.by))].join(", ")}`, "");
  lines.push(`- screens asked: **${rows.length}** (wave-1 truth: ${w1.length}; later-wave truth: ${rows.length - w1.length})`);
  lines.push(`- left out, no archetype: ${Object.entries(meta.removed).map(([t, n]) => `${t} ${n}`).join(", ")} (${Object.values(meta.removed).reduce((a, b) => a + b, 0)} screens); unreadable files: ${meta.unreadable.length}`);
  lines.push(`- accuracy, strict (the primary id): **${pct(acc(strict))}**; lenient (any accepted id): **${pct(acc(lenient))}**; wave-1 truth only, strict: ${pct(acc(w1.map((r) => ({ right: r.choice === r.truth }))))}`);
  lines.push(`- chance over ${meta.options} options: ${pct(1 / meta.options)}; majority class (${mode(rows.map((r) => r.truth))}): ${pct(majority(rows.map((r) => r.truth)))}`);
  lines.push(`- ECE over probabilities[choice], 10 bins: strict **${rel.ece.toFixed(3)}**, lenient ${relL.ece.toFixed(3)}`);
  lines.push(`- tokens: ${tokens.toLocaleString("en-US")} input; spend $${(tokens * JEV_INPUT_PRICE).toFixed(4)}; latency p50 ${q(0.5)}ms, p90 ${q(0.9)}ms${meta.wallMs ? `; wall ${(meta.wallMs / 1000).toFixed(1)}s` : ""}`);
  lines.push(`- states truncated to fit: ${rows.filter((r) => r.dropped > 0).length}`, "");

  lines.push(`## Reliability (strict)`, "", "| p(choice) | n | mean p | accuracy | lenient accuracy |", "|---|---|---|---|---|");
  rel.bins.forEach((b, i) => lines.push(`| ${b.lo.toFixed(1)}–${b.hi.toFixed(1)} | ${b.n} | ${b.n ? b.meanP.toFixed(3) : "—"} | ${b.n ? pct(b.accuracy) : "—"} | ${relL.bins[i]!.n ? pct(relL.bins[i]!.accuracy) : "—"} |`));
  lines.push("", `## Cuts on p(choice)`, "", "| cut | kept | share kept | strict accuracy of kept | lenient |", "|---|---|---|---|---|");
  const cs = cuts(strict, [0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
  const cl = cuts(lenient, [0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
  cs.forEach((c, i) => lines.push(`| ≥ ${c.cut.toFixed(1)} | ${c.kept} | ${pct(c.kept / (rows.length || 1))} | ${pct(c.accuracy)} | ${pct(cl[i]!.accuracy)} |`));

  lines.push("", `## Per archetype (by truth)`, "", "| topic → archetype | n | strict | lenient | mean p | most often chosen instead |", "|---|---|---|---|---|---|");
  const byTruth = groupBy(rows, (r) => `${r.topic} → ${r.truth}`);
  for (const [k, rs] of [...byTruth].sort((a, b) => b[1].length - a[1].length)) {
    const wrong = rs.filter((r) => r.choice !== r.truth).map((r) => r.choice);
    const top = [...groupBy(wrong, (x) => x)].sort((a, b) => b[1].length - a[1].length).slice(0, 3).map(([c, xs]) => `${c} ${xs.length}`).join(", ");
    lines.push(`| ${k} | ${rs.length} | ${pct(acc(rs.map((r) => ({ right: r.choice === r.truth }))))} | ${pct(acc(rs.map((r) => ({ right: r.accept.includes(r.choice) }))))} | ${(rs.reduce((s, r) => s + r.p, 0) / rs.length).toFixed(2)} | ${top || "—"} |`);
  }

  lines.push("", `## What Jev chose (by choice)`, "", "| chosen | n | precision (strict) |", "|---|---|---|");
  for (const [c, rs] of [...groupBy(rows, (r) => r.choice)].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`| ${c} | ${rs.length} | ${pct(rs.filter((r) => r.truth === c).length / rs.length)} |`);
  }

  lines.push("", `## Top confusions (truth → chosen)`, "", "| truth → chosen | n | mean p |", "|---|---|---|");
  const conf = groupBy(rows.filter((r) => r.choice !== r.truth), (r) => `${r.truth} → ${r.choice}`);
  for (const [k, rs] of [...conf].sort((a, b) => b[1].length - a[1].length).slice(0, 15)) {
    lines.push(`| ${k} | ${rs.length} | ${(rs.reduce((s, r) => s + r.p, 0) / rs.length).toFixed(2)} |`);
  }
  const inTop3 = rows.filter((r) => r.top3.some(([id]) => id === r.truth)).length;
  lines.push("", `Truth in Jev's top 3: ${pct(inTop3 / (rows.length || 1))}.`, "");
  return lines.join("\n");
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
}
function mode(xs: string[]): string {
  return [...groupBy(xs, (x) => x)].sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? "—";
}
function majority(xs: string[]): number {
  return xs.length ? (groupBy(xs, (x) => x).get(mode(xs))?.length ?? 0) / xs.length : 0;
}

/** `screen_id,topic` — Enrico's `design_topics.csv`. */
export function readTopics(csv: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const line of csv.split(/\r?\n/).slice(1)) {
    const [id, topic] = line.split(",").map((s) => s.trim());
    if (id && topic) m.set(id, topic);
  }
  return m;
}

// ---------- the run

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string, dflt?: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : dflt;
  };
  const dir = flag("--hierarchies");
  const topicsFile = flag("--topics");
  const out = flag("--out");
  if (!dir || !topicsFile || !out) {
    console.error("usage: calibrate.ts --hierarchies <dir> --topics <design_topics.csv> --out <dir> [--answerer jev|stub] [--options all|enrico] [--limit N] [--concurrency N] [--budget 1.00] [--state-chars 6000]");
    process.exit(2);
  }
  const which = flag("--answerer", "jev")!;
  const options = flag("--options", "all") as "all" | "enrico";
  if (options !== "all" && options !== "enrico") throw new Error("--options is all or enrico");
  const labels = flag("--labels", "ids") as Labels;
  if (!["ids", "words", "described"].includes(labels)) throw new Error("--labels is ids, words or described");
  const sample = Number(flag("--sample", "0"));
  const limit = Number(flag("--limit", "0"));
  const concurrency = Number(flag("--concurrency", "12"));
  const budget = Number(flag("--budget", "1.00"));
  const stateChars = Number(flag("--state-chars", "6000"));
  const answerer: Answerer = which === "stub" ? stubAnswerer(1) : jevAnswerer({ key: process.env.TYPESAFE_API_KEY, backoff: [500, 1000, 2000, 4000, 8000] });

  const topics = readTopics(readFileSync(topicsFile, "utf8"));
  const removed: Record<string, number> = {};
  const unreadable: string[] = [];
  const todo: Array<{ id: string; topic: string; truth: string; accept: string[]; request: JevRequest; dropped: number }> = [];
  const criteria = archetypeCriteria(options, labels);
  const idOf = labels === "words" ? plainOptions(options === "all" ? ARCHETYPE_IDS : ENRICO_IDS).idOf : (o: string) => o;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const id = f.replace(/\.json$/, "");
    const topic = topics.get(id);
    if (!topic) {
      unreadable.push(`${f}: no topic`);
      continue;
    }
    const map = TOPIC_MAP[topic];
    if (map === undefined) throw new Error(`topic "${topic}" is not in TOPIC_MAP`);
    if (map === null) {
      removed[topic] = (removed[topic] ?? 0) + 1;
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
    } catch {
      unreadable.push(f);
      continue;
    }
    const flat = flatten(json, stateChars);
    todo.push({ id, topic, truth: map.primary, accept: map.accept, request: screenRequest(flat.text, criteria), dropped: flat.dropped });
  }

  mkdirSync(out, { recursive: true });
  const suffix = `${which}.${options}${labels === "ids" ? "" : `.${labels}`}`;
  const answersFile = path.join(out, `answers.${suffix}.jsonl`);
  const asked = sample > 0 ? spread(todo, sample) : todo;
  const done = new Map<string, Row>();
  if (existsSync(answersFile)) {
    for (const line of readFileSync(answersFile, "utf8").split("\n")) if (line.trim()) {
      const r = JSON.parse(line) as Row;
      done.set(r.id, r);
    }
  }
  let pending = asked.filter((t) => !done.has(t.id));
  if (limit > 0) pending = pending.slice(0, limit);

  // The projection: a token is taken as 2.5 characters of the request as sent — measured ~2.4, so it errs high.
  const projected = pending.reduce((s, t) => s + JSON.stringify(t.request).length / 2.5, 0) * JEV_INPUT_PRICE;
  console.error(`${todo.length} screens usable, ${done.size} already answered, ${pending.length} to ask; projected $${projected.toFixed(4)} (budget $${budget.toFixed(2)})`);
  if (which === "jev" && projected > budget) {
    console.error("projection exceeds the budget — nothing sent");
    process.exit(3);
  }

  const t0 = Date.now();
  let spent = [...done.values()].reduce((s, r) => s + r.tokens, 0) * JEV_INPUT_PRICE;
  let next = 0;
  let failed = 0;
  let stopped = false;
  // Rate: at most 15 starts a second, under Jev's 1,200 a minute.
  let lastStart = 0;
  const gate = async () => {
    if (which !== "jev") return;
    const wait = lastStart + 67 - Date.now();
    lastStart = Math.max(Date.now(), lastStart + 67);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  };
  const worker = async () => {
    while (!stopped && next < pending.length) {
      const t = pending[next++]!;
      await gate();
      try {
        const a = await answerer.answer(t.request);
        const ans = a.response.answers.archetype;
        if (!ans || ans.type !== "choice") throw new Error("no choice came back");
        // Read back as ids, whatever the options said.
        const distribution = Object.fromEntries(Object.entries(ans.probabilities).map(([o, p]) => [idOf(o), p]));
        const choice = idOf(ans.choice);
        const top3 = Object.entries(distribution).sort((x, y) => y[1] - x[1]).slice(0, 3) as Array<[string, number]>;
        const tokens = a.response.usage?.input_tokens ?? 0;
        const row: Row = { id: t.id, topic: t.topic, truth: t.truth, accept: t.accept, choice, p: distribution[choice] ?? 0, top3, distribution, ms: a.ms, tokens, by: a.by, dropped: t.dropped };
        appendFileSync(answersFile, `${JSON.stringify(row)}\n`);
        done.set(t.id, row);
        spent += tokens * JEV_INPUT_PRICE;
        if (spent >= budget) {
          stopped = true;
          console.error(`measured spend $${spent.toFixed(4)} reached the budget — stopping`);
        }
        if (done.size % 100 === 0) console.error(`${done.size} answered, $${spent.toFixed(4)} spent`);
      } catch (e) {
        failed++;
        console.error(`screen ${t.id}: ${(e as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  const wallMs = Date.now() - t0;

  const rows = asked.map((t) => done.get(t.id)).filter((r): r is Row => !!r);
  const md = report(rows, { removed, unreadable, wallMs, answerer: which, options: Object.keys(criteria).length });
  writeFileSync(path.join(out, `report.${suffix}${sample > 0 ? `.n${sample}` : ""}.md`), md);
  console.log(md);
  console.error(`calls this run: ${pending.length - failed} answered, ${failed} failed; wall ${(wallMs / 1000).toFixed(1)}s; total spend $${spent.toFixed(4)}`);
  if (failed > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
