/**
 * **Refuse at the door** — the shared half of
 * `docs/projects/operator/design.md`, "Refuse at the door" (operator phase 6;
 * journey 9).
 *
 * A home-scope refusal is a desk row naming one of four subjects the home
 * can actually tell apart, and it is the roles bar moved to home scope:
 *
 * | Subject         | Read at                              | Refuses                                   |
 * | --------------- | ------------------------------------ | ----------------------------------------- |
 * | `email:`/`repo:`| the door hook, `/api/attest`         | every canvas and create for a badge that  |
 * |                 |                                      | proved it; proving it at all              |
 * | `actor:`        | `actor.claim {as}`                   | resuming that actor — the name stops      |
 * |                 |                                      | coming back                               |
 * | `net:<cidr>`    | the mint meter                       | minting a badge from that network;        |
 * |                 |                                      | expires by default, 24 hours              |
 *
 * This file is the words, the codes, the row and the two pure rules every
 * surface would otherwise each invent — what a subject is, and whether an
 * address is inside a network. Everything here is data and pure functions;
 * the acting lives in `packages/server`, where the desk and the registry are.
 *
 * **What is deliberately NOT here:** the note. `HomeRefusal` carries it
 * because the DESK's row does, and the desk's row is innkeeper-private —
 * but {@link refusalSentence} never reads it, and the shape a surface is
 * handed (`RefusalNotice`) has no field for it. The reason category is shown;
 * the operator's note is his (design, "Words").
 */

import type { EndReach } from "./ended.ts";
import { TAKEDOWN_REASONS, takedownDate, type TakedownReason } from "./takedown.ts";
import { normalizeAttribute } from "./grants.ts";

/**
 * **The one word for a home-scope refusal**, wherever a refusal already
 * carries a word.
 *
 * As the `reason` beside `not-admitted` at the door and on a
 * `WS_NOT_ADMITTED` close, where `withdrawn`, `taken-down` and `ended` ride:
 * the same kind of fact about the same kind of moment, and every client that
 * branches on those is already looking in the right place. As the `code` at
 * `/api/attest` and at the door's mint, where there is no admission to be
 * refused and the refusal is the whole answer. And as the `OpValidationError`
 * code at `actor.claim`, so a terminal prints the sentence and stops rather
 * than reading `name-taken` and offering a pass.
 *
 * Short, for `TAKEN_DOWN`'s reason: a WebSocket close reason is capped at 123
 * bytes and throws rather than truncating, so the word travels on the socket
 * and the sentence is fetched by whoever renders it.
 */
export const REFUSED = "refused";

/** `POST /api/operator/refuse/:subject` — the subject a report names, in the
 * path, URL-encoded (a `net:` subject carries a slash). */
export const OPERATOR_REFUSE_ROUTE = "/api/operator/refuse/:subject";

/**
 * **A network refusal ends on its own, by default a day later**, because
 * addresses are shared and reassigned (journey 9 step 3). One constant, for
 * `OPERATOR_PROOF_WINDOW_MS`'s reason: it is a judgement about how long a
 * flood's network stays that flood's, and the day it changes it changes here.
 */
export const NET_REFUSAL_DEFAULT_MS = 24 * 60 * 60 * 1000;

/** The four kinds of subject. `email` and `repo` are the attested kinds a
 * badge proves; `actor` is a name; `net` is where a knock came from. */
export type RefusalKind = "email" | "repo" | "actor" | "net";

/**
 * **The desk's row** — `refusals/{subject}` on Firestore, a line type in the
 * file desk's log. One row per subject, rewritten by a lift rather than
 * deleted, for the takedown row's reason: "is this subject refused" is asked
 * on a request path and must not be a question two rows could both answer,
 * and the record of a refusal that was lifted is exactly what the operator
 * reads when the person writes back.
 *
 * **It is not the ledger.** The refuse act and the lift act are both in
 * `operator/`, each with its proof; this row is what they leave behind — the
 * standing state and the words the surfaces show.
 */
export interface HomeRefusal {
  /** Normalized: `email:sam@example.com`, `repo:github.com/acme/site`,
   * `actor:usr_…`, `net:203.0.113.0/24`. The registry's key. */
  subject: string;
  kind: RefusalKind;
  /** When it was refused, ISO. The date in the sentence. */
  at: string;
  reason: TakedownReason;
  /** The operator's own note — innkeeper-private, never on any surface an
   * affected person reads. `refusalSentence` cannot reach it. */
  note?: string;
  /** The attribute that was proved — `email:olu@example.test`: the operator
   * who ACTED, so a home with two operators sends the person to the one who
   * decided. */
  by: string;
  /** The ledger row (`opr_…`) that did it. */
  actId: string;
  /** When it stops being in force on its own, ISO. Always set on a `net:`
   * row; set on the others only by `--for`. */
  expiresAt?: string;
  /** Set by `--lift`; the row stays. A row with this set is not in force. */
  liftedAt?: string;
  liftedBy?: string;
  liftedActId?: string;
}

/**
 * **Is this row in force right now** — the one question every reader asks,
 * and the one place the clock enters. A lifted row is history; an expired row
 * is history that nobody had to lift, which is the whole point of `--for`.
 */
export function refusalInForce(row: Pick<HomeRefusal, "liftedAt" | "expiresAt">, now: number): boolean {
  if (row.liftedAt !== undefined) return false;
  if (row.expiresAt !== undefined && Date.parse(row.expiresAt) <= now) return false;
  return true;
}

// ---- what a subject is ----

/**
 * **What somebody typed, as a refusal subject — or null.**
 *
 * Total and strict: an address is normalized the way grant subjects and
 * attestations are, so the door's equality is over two strings folded by the
 * same function; a network is parsed and re-spelled from its bits, so
 * `203.0.113.7/24` and `203.0.113.0/24` are one row; an actor id passes
 * through untouched because ids are case-sensitive. Anything else is null,
 * and {@link refusalSubjectRefusal} says why in words.
 */
export function refusalSubjectOf(raw: string): { subject: string; kind: RefusalKind } | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("email:")) {
    const address = trimmed.slice("email:".length).trim();
    if (!address.includes("@") || /\s/.test(address)) return null;
    return { subject: normalizeAttribute(`email:${address}`), kind: "email" };
  }
  if (trimmed.startsWith("repo:")) {
    const repo = trimmed.slice("repo:".length).trim();
    if (repo.split("/").length !== 3 || /\s/.test(repo)) return null;
    return { subject: normalizeAttribute(`repo:${repo}`), kind: "repo" };
  }
  if (trimmed.startsWith("actor:")) {
    const id = trimmed.slice("actor:".length).trim();
    if (!/^[A-Za-z0-9_-]+$/.test(id) || !id.includes("_")) return null;
    return { subject: `actor:${id}`, kind: "actor" };
  }
  if (trimmed.startsWith("net:")) {
    const cidr = parseCidr(trimmed.slice("net:".length).trim());
    if (!cidr) return null;
    return { subject: `net:${cidrText(cidr)}`, kind: "net" };
  }
  return null;
}

/** Why that is not a refusal subject, or null when it is. */
export function refusalSubjectRefusal(raw: string): string | null {
  if (refusalSubjectOf(raw)) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("net:")) {
    return `not a network: ${shown(trimmed.slice(4))} — say net:<address>/<prefix>, like net:203.0.113.0/24 or net:2001:db8::/32`;
  }
  if (trimmed.startsWith("actor:")) {
    return `not an actor id: ${shown(trimmed.slice(6))} — say actor:<id>, the usr_… or agt_… a report names`;
  }
  if (trimmed.startsWith("email:") || trimmed.startsWith("repo:")) {
    return `not an address: ${shown(trimmed)} — say email:<address> or repo:<host>/<owner>/<name>`;
  }
  return (
    `a refusal names one of four things: email:<address>, repo:<host>/<owner>/<name>, ` +
    `actor:<id>, or net:<cidr> — not ${shown(trimmed)}`
  );
}

/** Never echo an arbitrary string back into a sentence whole. */
function shown(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "nothing";
  return /^[\x20-\x7e]{1,80}$/.test(trimmed) ? `\`${trimmed}\`` : "something this home will not repeat";
}

// ---- networks ----

/** A parsed network: which family, its bits as one integer, and its prefix. */
export interface Cidr {
  version: 4 | 6;
  /** The network address, as bits — masked to the prefix. */
  bits: bigint;
  prefix: number;
}

/**
 * **A network, parsed and masked**, or null. `203.0.113.7/24` yields the
 * network `203.0.113.0/24`; a bare address is that address alone (`/32`,
 * `/128`). IPv6 is the compressed form a client presents in
 * `X-Forwarded-For`, and the one shape of it this needs to read.
 */
export function parseCidr(text: string): Cidr | null {
  const [address, rawPrefix, extra] = text.trim().split("/");
  if (!address || extra !== undefined) return null;
  const parsed = parseAddress(address);
  if (!parsed) return null;
  const width = parsed.version === 4 ? 32 : 128;
  let prefix = width;
  if (rawPrefix !== undefined) {
    if (!/^\d{1,3}$/.test(rawPrefix)) return null;
    prefix = Number(rawPrefix);
    if (prefix > width) return null;
  }
  return { version: parsed.version, bits: mask(parsed.bits, prefix, width), prefix };
}

/**
 * **Is this address inside that network** — the mint meter's whole question,
 * asked with the key the meter already computed. An address of the other
 * family is never inside; an address that does not parse is never inside,
 * which is the safe direction: a refusal cannot be widened by a malformed
 * header.
 */
export function cidrContains(cidr: Cidr, address: string): boolean {
  const parsed = parseAddress(address.trim());
  if (!parsed || parsed.version !== cidr.version) return false;
  const width = cidr.version === 4 ? 32 : 128;
  return mask(parsed.bits, cidr.prefix, width) === cidr.bits;
}

/** The network as the row spells it: `203.0.113.0/24`, `2001:db8::/32`.
 * Not exported: `refusalSubjectOf` is the one caller, and the spelling a row
 * carries must come from that one place. */
function cidrText(cidr: Cidr): string {
  return `${cidr.version === 4 ? v4Text(cidr.bits) : v6Text(cidr.bits)}/${cidr.prefix}`;
}

function mask(bits: bigint, prefix: number, width: number): bigint {
  if (prefix === 0) return 0n;
  const keep = ((1n << BigInt(prefix)) - 1n) << BigInt(width - prefix);
  return bits & keep;
}

function parseAddress(text: string): { version: 4 | 6; bits: bigint } | null {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (v4) {
    const parts = v4.slice(1).map(Number);
    if (parts.some((n) => n > 255)) return null;
    return { version: 4, bits: parts.reduce((acc, n) => (acc << 8n) | BigInt(n), 0n) };
  }
  // IPv4-mapped IPv6 (`::ffff:203.0.113.7`) is the v4 address it wraps: a
  // dual-stack socket reports one, and a refusal of a v4 network must reach
  // it.
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(text);
  if (mapped) return parseAddress(mapped[1]!);
  if (!text.includes(":") || /[^0-9a-fA-F:]/.test(text)) return null;
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const groups = halves.length === 2 ? [...head, ...Array(8 - head.length - tail.length).fill("0"), ...tail] : head;
  if (groups.length !== 8 || groups.some((g) => g === "" || g.length > 4)) return null;
  return { version: 6, bits: groups.reduce((acc, g) => (acc << 16n) | BigInt(parseInt(g, 16)), 0n) };
}

function v4Text(bits: bigint): string {
  return [24n, 16n, 8n, 0n].map((shift) => String((bits >> shift) & 0xffn)).join(".");
}

function v6Text(bits: bigint): string {
  const groups: string[] = [];
  for (let i = 7; i >= 0; i -= 1) groups.push(((bits >> BigInt(i * 16)) & 0xffffn).toString(16));
  // Compress the longest run of zero groups, as the compressed form does.
  let best = { at: -1, len: 0 };
  for (let i = 0; i < 8; ) {
    if (groups[i] !== "0") {
      i += 1;
      continue;
    }
    let j = i;
    while (j < 8 && groups[j] === "0") j += 1;
    if (j - i > best.len) best = { at: i, len: j - i };
    i = j;
  }
  if (best.len < 2) return groups.join(":");
  const before = groups.slice(0, best.at).join(":");
  const after = groups.slice(best.at + best.len).join(":");
  return `${before}::${after}`;
}

// ---- durations ----

/**
 * **`--for 24h`, as milliseconds**, or null for anything that is not a
 * duration. `30s`, `10m`, `24h`, `7d` — one unit, a whole number, no spaces:
 * the shapes `elapsedLabel` already prints, read back. Zero is not a duration
 * (a refusal for no time is not a refusal) and neither is a bare number,
 * because a number with no unit is a number somebody will read in the wrong
 * unit.
 */
export function parseRefusalDuration(text: string): number | null {
  const match = /^(\d+)(s|m|h|d)$/.exec(text.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  if (amount <= 0) return null;
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as "s" | "m" | "h" | "d"];
  return amount * unit;
}

// ---- what a surface is handed ----

/**
 * **What a surface is handed**, thinner than the row for `TakedownNotice`'s
 * reason: no note and no act id, because this crosses the wire to the person
 * it happened to.
 */
export interface RefusalNotice {
  subject: string;
  kind: RefusalKind;
  at: string;
  reason: TakedownReason;
  /** The operator's address, for the sentence's *Write to …*. */
  by: string;
  expiresAt?: string;
  /** The sentence itself, rendered by the HOME. */
  sentence: string;
}

/** A row, as a surface may see it. */
export function refusalNoticeOf(row: HomeRefusal): RefusalNotice {
  return {
    subject: row.subject,
    kind: row.kind,
    at: row.at,
    reason: row.reason,
    by: addressOf(row.by),
    ...(row.expiresAt !== undefined ? { expiresAt: row.expiresAt } : {}),
    sentence: refusalSentence(row),
  };
}

/**
 * **The sentence** (journey 9 step 2, and design, "The record": the date,
 * the reason category, and the address):
 *
 * > This home will not admit sam@example.com — its operator refused the
 * > address on 12 September 2026: harassment. Write to olu@example.com.
 *
 * For a network, the same sentence says when it ends, because it always
 * does; for a name, it says *the name*. Rendered here rather than in each
 * surface, for the takedown sentence's reason: three spellings of one
 * sentence is three sentences, and the one that drifts is the one somebody
 * reads. The date is UTC and absolute; this is quoted in an email later.
 */
export function refusalSentence(
  row: Pick<HomeRefusal, "subject" | "kind" | "at" | "reason" | "by" | "expiresAt">,
): string {
  const what = row.kind === "net" ? "the network" : row.kind === "actor" ? "the name" : "the address";
  const until = row.expiresAt !== undefined ? `, until ${refusalUntil(row.expiresAt)}` : "";
  return (
    `This home will not admit ${subjectShown(row)} — its operator refused ${what} on ` +
    `${takedownDate(row.at)}: ${TAKEDOWN_REASONS[row.reason]}${until}. Write to ${addressOf(row.by)}.`
  );
}

/** `2026-09-13T09:15:00Z` → `13 September 2026 09:15 UTC`: a refusal that
 * ends in ten minutes needs the minute, not just the day. */
export function refusalUntil(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  const hh = String(at.getUTCHours()).padStart(2, "0");
  const mm = String(at.getUTCMinutes()).padStart(2, "0");
  return `${takedownDate(iso)} ${hh}:${mm} UTC`;
}

/** The subject as the sentence names it: the bare address, the repo, the id,
 * the network. */
export function subjectShown(row: Pick<HomeRefusal, "subject" | "kind">): string {
  return row.subject.replace(/^(email|repo|actor|net):/, "");
}

/** `email:olu@example.com` → `olu@example.com`: the reader is about to write
 * an email. */
function addressOf(attribute: string): string {
  return attribute.replace(/^email:/, "");
}

// ---- what the operator's verb sends and is answered ----

/** What `isocan operator refuse` sends. One shape for both directions: a
 * lift is the same act with `lift`, not a second verb. */
export interface OperatorRefuseRequest {
  /** Why, from `TAKEDOWN_REASONS`: the category the refused person is shown.
   * Required to refuse; not read on a lift. */
  reason?: string;
  /** The operator's own note — recorded, shown to nobody. */
  note?: string;
  /** How long, as `parseRefusalDuration` reads it: `10m`, `24h`, `7d`. Absent means
   * a day for a network and no end for anything else. */
  for?: string;
  /** Lift the refusal in force rather than making one. */
  lift?: boolean;
}

/** What refusing reached, counted at the moment of acting. */
export interface RefusalReach {
  kind: RefusalKind;
  /** The badges ended because they had proved a refused address — every
   * one, in the same act (design: *refusing an address ends every badge that
   * proved it*). Empty for a name or a network. */
  ended: string[];
  /** The sockets closed and waits woken, summed over the badges ended. */
  reached: EndReach;
  /** What the sweeps of their rooms did to everybody else. */
  swept: { expelled: number; rerooted: number };
  /** For a name: how many live badges still speak as it right now. A refusal
   * stops the name coming BACK; `isocan operator end` is what stops the
   * badges holding it now, and the verb says so with this number. */
  holders: number;
}

/** What the route answers: the row as it now stands, what the act reached,
 * and the sentence the refused person reads — null on a lift. */
export interface OperatorRefuseResponse {
  refusal: HomeRefusal;
  reach: RefusalReach;
  sentence: string | null;
}

/**
 * **The honest limit, printed by the verb once** (journey 9 step 4; design,
 * "Refuse at the door"). A badge is free and a link admits strangers who prove
 * nothing; a stranger cannot be refused by who they are, because they are
 * nobody yet. What stops them on a canvas is the link, which is the revoke.
 */
export const REFUSAL_LIMIT =
  "a stranger who proves nothing and enters by a link cannot be refused by who they are; " +
  "turn the link off.";
