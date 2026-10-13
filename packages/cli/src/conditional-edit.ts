import { isOpId, type Item, type MetaPatch, type NewVersion, type Operation, type PostOpResponse } from "@isocan/core";

/**
 * **`isocan edit --if-version`: a new version only if nobody got there first.**
 *
 * Core has had the act since September — `item.edit`, which replaces an
 * item's content and patches its title and properties as one undoable op, and
 * is refused unless the item still stands where the writer last read it. The
 * design review and repair flows use it. The public CLI did not reach it, so
 * a generator that keeps one card current (keel's weekly Loop card, a "live
 * pulse") could only stack an unconditional version over whatever a person had
 * done to the card, or append a new card every run.
 *
 * What is here is the part of that verb that can be tested without a daemon:
 * reading the flags, building the op, and saying what happened.
 *
 * - **Stale is its own answer.** A changed version, or metadata a person
 *   edited, is `conflict` with exit {@link EXIT_CONFLICT}: nothing written,
 *   and the item's current version id handed back so the caller can re-read.
 * - **A retry is safe.** `--op-id` is the op's own name. The home answers a
 *   repeated id with the entry it already wrote, so a retry after a dropped
 *   connection reports `replayed` with the version that landed the first
 *   time, and "never arrived" simply applies.
 * - **An older home refuses.** `item.edit` is a distinct op type on purpose:
 *   a home that predates it answers `unknown-op`, which is `unsupported` with
 *   exit {@link EXIT_UNSUPPORTED}. This verb never falls back to an
 *   unconditional write.
 */

/** The item changed under the edit: nothing was written. */
export const EXIT_CONFLICT = 4;
/** The home does not know `item.edit`: nothing was written, and nothing else was tried. */
export const EXIT_UNSUPPORTED = 5;

/** The title and properties a conditional edit expects to find — what `--json` printed last time. */
export interface ExpectedMeta {
  title: string;
  properties: Record<string, string>;
}

/** What a caller of `edit --if-version --json` reads. */
export type ConditionalEditResult =
  | { status: "applied" | "replayed"; itemId: string; versionId: string; opId: string; seq: number; title: string; properties: Record<string, string> }
  | { status: "conflict"; itemId: string; currentVersionId: string; expectedVersionId: string; title: string; properties: Record<string, string>; reason: string }
  | { status: "unsupported"; itemId: string; reason: string };

/** `--if-meta '<json>'` → the exact title and properties expected, or a sentence saying what is wrong with it. */
export function parseExpectedMeta(raw: string): ExpectedMeta {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`--if-meta is not JSON — pass what a previous \`edit --if-version --json\` printed, e.g. '{"title":"Pulse","properties":{}}'`);
  }
  const v = value as { title?: unknown; properties?: unknown };
  if (!v || typeof v !== "object" || typeof v.title !== "string" || !v.properties || typeof v.properties !== "object" || Array.isArray(v.properties)) {
    throw new Error(`--if-meta needs a "title" string and a "properties" object`);
  }
  const properties: Record<string, string> = {};
  for (const [key, val] of Object.entries(v.properties as Record<string, unknown>)) {
    if (typeof val !== "string") throw new Error(`--if-meta property "${key}" is not a string`);
    properties[key] = val;
  }
  return { title: v.title, properties };
}

/** A caller's own op id, or a sentence saying what one looks like. */
export function parseOpId(raw: string): string {
  if (!isOpId(raw)) throw new Error(`--op-id "${raw}" is not an op id — "op_" and 6 to 32 of A–Z a–z 0–9 _ -, the same every retry of one edit`);
  return raw;
}

/** The one op a conditional edit sends. */
export function conditionalEditOp(itemId: string, version: NewVersion, expectedVersionId: string, patch: MetaPatch, expectedMetadata?: ExpectedMeta): Extract<Operation, { type: "item.edit" }> {
  return { type: "item.edit", itemId, version, patch, expectedVersionId, ...(expectedMetadata ? { expectedMetadata } : {}) };
}

/**
 * Before any bytes are uploaded: does the item still stand where the caller
 * read it? Null when it does. Skipped for a retry (`--op-id`), because a
 * retry of an edit that already landed finds the item changed — by itself —
 * and only the home can tell that from somebody else's change.
 */
export function staleBeforeSending(item: Item, expectedVersionId: string, expected?: ExpectedMeta): string | null {
  if (item.currentVersionId !== expectedVersionId) return `its current version is ${item.currentVersionId}, not ${expectedVersionId}`;
  if (!expected) return null;
  if (item.title !== expected.title) return "its title changed";
  const keys = new Set([...Object.keys(item.properties), ...Object.keys(expected.properties)]);
  for (const key of keys) if (item.properties[key] !== expected.properties[key]) return `its property "${key}" changed`;
  return null;
}

/**
 * What the home's answer means: the version we sent landed, or an earlier send
 * of this op id already had. `after` is the item re-read once the home has
 * answered, so the title and properties reported are what is there, not what
 * a patch was expected to produce.
 */
export function appliedResult(response: PostOpResponse, after: Item, sentVersionId: string, opId: string): ConditionalEditResult {
  const op = response.envelope.op;
  const landed = op.type === "item.edit" ? op.version.id : sentVersionId;
  return {
    status: landed === sentVersionId ? "applied" : "replayed",
    itemId: after.id,
    versionId: landed,
    opId,
    seq: response.seq,
    title: after.title,
    properties: after.properties,
  };
}

/** The refusal as a result. `current` is the item as it stands now, re-read after the refusal. */
export function conflictResult(current: Item, expectedVersionId: string, reason: string): ConditionalEditResult {
  return { status: "conflict", itemId: current.id, currentVersionId: current.currentVersionId, expectedVersionId, title: current.title, properties: current.properties, reason };
}

/** One line for a person, for each way it can end. */
export function conditionalEditSentence(result: ConditionalEditResult): string {
  if (result.status === "applied") return `new version ${result.versionId} of ${result.itemId} — it was still where you read it`;
  if (result.status === "conflict") return `not edited: ${result.itemId} changed — ${result.reason}. Nothing was written; it is at ${result.currentVersionId} now.`;
  if (result.status === "unsupported") return `not edited: ${result.reason}. Nothing was written, and no unconditional edit was tried.`;
  return `already applied: ${result.itemId} is at ${result.versionId} from an earlier send of ${result.opId}`;
}
