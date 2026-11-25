/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * **Voice choreography & co-listening** (Open Stitch Phase 6, OS1 ADR 0019 / 0279 / 0290).
 *
 * Pure, DOM-free contracts shared across `@isocan/core`, the talk module, and
 * CLI/voice surfaces:
 *
 * 1. `PendingCallGate`: holds Live tool function responses as "permission to
 *    speak" until the corresponding `paint.ack` / `visible` signal arrives (or
 *    timeout fallback), preventing the model from claiming something is on
 *    screen before it paints.
 * 2. `SpeechBudget`: tracks recent spoken summaries/utterances so an agent
 *    never narrates the same op or receipt twice.
 * 3. `AgentDisposition`: 5-axis tuning (`initiative`, `curiosity`,
 *    `divergence`, `depth`, `partnering` in `0..1`, default `0.5`) +
 *    `dispositionToPromptHint(d)`.
 * 4. `detectFollowMeIntent(transcript)`: pure phrase detector for "follow me",
 *    "look at this", "come look", etc.
 * 5. `MediaControlCommand`: pure ephemeral command schema for co-listening
 *    playback control (`play | pause | seek | rate | volume | status |
 *    find_by_transcript`) — never written to the oplog.
 */

/* -------------------------------------------------------------------------- */
/* 1. Held function responses (PendingCallGate, OS1 ADR 0019)                 */
/* -------------------------------------------------------------------------- */

type PendingCallReleaseReason = "paint_ack" | "visible" | "timeout" | "cancelled";

/** Input describing a tool call held until the canvas paints its effect. */
export interface PendingCallInput {
  callId: string;
  name: string;
  response: Record<string, unknown>;
  /** Work-visible past-tense summary reused across CLI, cards, and speech. */
  summary?: string;
  /** Optional oplog sequence number to match `paint.ack` monotone seqs. */
  seq?: number;
  /** Override default timeout in ms for this call. */
  timeoutMs?: number;
}

/** Release payload emitted once a held tool call paints or times out. */
export interface PendingCallRelease {
  callId: string;
  name: string;
  response: Record<string, unknown>;
  summary?: string;
  visible: boolean;
  reason: PendingCallReleaseReason;
  waitedMs: number;
}

/** Configuration for `PendingCallGate` fallback timeouts and test clocks. */
export interface PendingCallGateOptions {
  /** Fallback timeout before releasing if no paint ack arrives (default 1200ms). */
  timeoutMs?: number;
  /** Clock function for deterministic testing (default `Date.now`). */
  now?: () => number;
}

interface PendingCallEntry {
  callId: string;
  name: string;
  response: Record<string, unknown>;
  summary?: string;
  seq?: number;
  createdAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  resolve: (release: PendingCallRelease) => void;
}

const DEFAULT_PAINT_TIMEOUT_MS = 1200;

/**
 * Holds Live tool `functionResponse` payloads until the canvas surface
 * acknowledges paint (`ackPaint` / `markVisible`) or the fallback timeout fires.
 */
export class PendingCallGate {
  private readonly defaultTimeoutMs: number;
  private readonly now: () => number;
  private readonly pending = new Map<string, PendingCallEntry>();

  constructor(options: PendingCallGateOptions = {}) {
    this.defaultTimeoutMs = Math.max(0, options.timeoutMs ?? DEFAULT_PAINT_TIMEOUT_MS);
    this.now = options.now ?? Date.now;
  }

  /** Number of calls currently held waiting for paint. */
  pendingCount(): number {
    return this.pending.size;
  }

  /** True if any call is currently held. */
  hasPending(): boolean {
    return this.pending.size > 0;
  }

  /** True if `callId` is currently held. */
  isPending(callId: string): boolean {
    return this.pending.has(callId);
  }

  /**
   * Hold a function response until `ackPaint`, `markVisible`, `cancel`, or
   * timeout. Returns a Promise that resolves with the released response.
   */
  hold(input: PendingCallInput): Promise<PendingCallRelease> {
    if (this.pending.has(input.callId)) {
      this.cancel(input.callId);
    }

    const createdAt = this.now();
    const timeoutMs = Math.max(0, input.timeoutMs ?? this.defaultTimeoutMs);

    return new Promise<PendingCallRelease>((resolve) => {
      const entry: PendingCallEntry = {
        callId: input.callId,
        name: input.name,
        response: input.response,
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.seq !== undefined ? { seq: input.seq } : {}),
        createdAt,
        timer: null,
        resolve,
      };

      if (timeoutMs > 0) {
        entry.timer = setTimeout(() => {
          this.releaseEntry(entry, "timeout", false);
        }, timeoutMs);
        if (typeof entry.timer === "object" && entry.timer !== null && "unref" in entry.timer) {
          (entry.timer as { unref?: () => void }).unref?.();
        }
      }

      this.pending.set(input.callId, entry);

      if (timeoutMs === 0) {
        this.releaseEntry(entry, "timeout", false);
      }
    });
  }

  /**
   * Signal that the canvas has painted up to `paintedSeq` (number) or a
   * specific `callId` (string). Returns the number of held calls released.
   */
  ackPaint(seqOrCallId: number | string): number {
    if (typeof seqOrCallId === "string") {
      const entry = this.pending.get(seqOrCallId);
      if (!entry) return 0;
      this.releaseEntry(entry, "paint_ack", true);
      return 1;
    }

    if (!Number.isFinite(seqOrCallId)) return 0;
    let count = 0;
    for (const entry of [...this.pending.values()]) {
      if (entry.seq === undefined || entry.seq <= seqOrCallId) {
        this.releaseEntry(entry, "paint_ack", true);
        count++;
      }
    }
    return count;
  }

  /** Mark a specific `callId` as visible on screen and release it. */
  markVisible(callId: string): boolean {
    const entry = this.pending.get(callId);
    if (!entry) return false;
    this.releaseEntry(entry, "visible", true);
    return true;
  }

  /** Cancel a held call without marking it visible. */
  cancel(callId: string): boolean {
    const entry = this.pending.get(callId);
    if (!entry) return false;
    this.releaseEntry(entry, "cancelled", false);
    return true;
  }

  /** Cancel all held calls and clear timers. */
  clear(): void {
    for (const entry of [...this.pending.values()]) {
      this.releaseEntry(entry, "cancelled", false);
    }
  }

  private releaseEntry(
    entry: PendingCallEntry,
    reason: PendingCallReleaseReason,
    visible: boolean,
  ): void {
    if (!this.pending.delete(entry.callId)) return;
    if (entry.timer !== null) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    const waitedMs = Math.max(0, this.now() - entry.createdAt);
    const enrichedResponse: Record<string, unknown> = {
      ...entry.response,
      visible,
      ...(entry.summary !== undefined && !("summary" in entry.response)
        ? { summary: entry.summary }
        : {}),
    };
    entry.resolve({
      callId: entry.callId,
      name: entry.name,
      response: enrichedResponse,
      ...(entry.summary !== undefined ? { summary: entry.summary } : {}),
      visible,
      reason,
      waitedMs,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* 2. Speech budget & anti-double-narration (SpeechBudget)                    */
/* -------------------------------------------------------------------------- */

interface SpeechBudgetEntry {
  text: string;
  normalized: string;
  key?: string;
  spokenAt: number;
}

/** Configuration for `SpeechBudget` deduplication window and capacity. */
export interface SpeechBudgetOptions {
  /** Deduplication window in ms (default 30_000ms). */
  windowMs?: number;
  /** Maximum retained entries (default 100). */
  maxEntries?: number;
  /** Clock function for deterministic testing (default `Date.now`). */
  now?: () => number;
}

/** Result of attempting to claim a spoken utterance in `SpeechBudget`. */
export interface SpeechClaimResult {
  allowed: boolean;
  reason?: "empty" | "duplicate_key" | "duplicate_text";
}

function normalizeUtterance(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, " ")
    .replace(/[.!?]+$/g, "");
}

/**
 * Tracks recent spoken summaries/utterances and op/receipt keys so an agent
 * never narrates the same operation or receipt twice.
 */
export class SpeechBudget {
  private readonly windowMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private entries: SpeechBudgetEntry[] = [];

  constructor(options: SpeechBudgetOptions = {}) {
    this.windowMs = Math.max(0, options.windowMs ?? 30_000);
    this.maxEntries = Math.max(1, options.maxEntries ?? 100);
    this.now = options.now ?? Date.now;
  }

  /** Check whether `text` (and optional `key`) can be spoken without duplicating recent speech. */
  canSpeak(text: string, key?: string): boolean {
    return this.evaluate(text, key).allowed;
  }

  /**
   * Attempt to claim the speech budget for `text` (and optional `key`).
   * Records the utterance if allowed.
   */
  claim(text: string, key?: string): SpeechClaimResult {
    const verdict = this.evaluate(text, key);
    if (!verdict.allowed) return verdict;

    const now = this.now();
    this.prune(now);
    this.entries.push({
      text: text.trim(),
      normalized: normalizeUtterance(text),
      ...(key !== undefined && key.trim() ? { key: key.trim() } : {}),
      spokenAt: now,
    });
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(this.entries.length - this.maxEntries);
    }
    return { allowed: true };
  }

  /** Convenience boolean wrapper around {@link claim}. */
  record(text: string, key?: string): boolean {
    return this.claim(text, key).allowed;
  }

  /** Recent active entries within the deduplication window. */
  recent(): ReadonlyArray<{ text: string; key?: string; spokenAt: number }> {
    this.prune(this.now());
    return this.entries.map((e) => ({
      text: e.text,
      ...(e.key !== undefined ? { key: e.key } : {}),
      spokenAt: e.spokenAt,
    }));
  }

  clear(): void {
    this.entries = [];
  }

  private evaluate(text: string, key?: string): SpeechClaimResult {
    const normalized = normalizeUtterance(text);
    if (!normalized) return { allowed: false, reason: "empty" };

    const now = this.now();
    this.prune(now);

    const trimmedKey = key?.trim();
    if (trimmedKey && this.entries.some((e) => e.key === trimmedKey)) {
      return { allowed: false, reason: "duplicate_key" };
    }
    if (this.entries.some((e) => e.normalized === normalized)) {
      return { allowed: false, reason: "duplicate_text" };
    }
    return { allowed: true };
  }

  private prune(now: number): void {
    if (this.windowMs <= 0) {
      this.entries = [];
      return;
    }
    const cutoff = now - this.windowMs;
    this.entries = this.entries.filter((e) => e.spokenAt > cutoff);
  }
}

/* -------------------------------------------------------------------------- */
/* 3. Disposition axes (AgentDisposition, OS1 ADR 0279)                       */
/* -------------------------------------------------------------------------- */

/** Five normalized `[0, 1]` axes tuning how a live voice agent collaborates. */
export interface AgentDisposition {
  /** 0 = reactive (ask first), 0.5 = collaborative, 1 = proactive (act at once). */
  initiative: number;
  /** 0 = decisive (pick defaults), 0.5 = balanced, 1 = exploratory (ask clarifying questions). */
  curiosity: number;
  /** 0 = convergent (one clear direction), 0.5 = balanced, 1 = divergent (varied alternatives). */
  divergence: number;
  /** 0 = concise (1 short sentence), 0.5 = standard, 1 = thorough (walk through reasoning). */
  depth: number;
  /** 0 = candid (direct critique), 0.5 = neutral, 1 = encouraging (warm, constructive). */
  partnering: number;
}

/** Balanced midpoint defaults (`0.5` on every axis) for `AgentDisposition`. */
export const DEFAULT_AGENT_DISPOSITION: Readonly<AgentDisposition> = Object.freeze({
  initiative: 0.5,
  curiosity: 0.5,
  divergence: 0.5,
  depth: 0.5,
  partnering: 0.5,
});

function clampUnit(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

type PartialAgentDisposition = {
  [K in keyof AgentDisposition]?: AgentDisposition[K] | undefined;
};

/** Normalize partial or out-of-range disposition values into `[0, 1]`. */
export function normalizeAgentDisposition(
  raw?: PartialAgentDisposition | null,
  base: AgentDisposition = DEFAULT_AGENT_DISPOSITION,
): AgentDisposition {
  return {
    initiative: clampUnit(raw?.initiative, clampUnit(base.initiative, 0.5)),
    curiosity: clampUnit(raw?.curiosity, clampUnit(base.curiosity, 0.5)),
    divergence: clampUnit(raw?.divergence, clampUnit(base.divergence, 0.5)),
    depth: clampUnit(raw?.depth, clampUnit(base.depth, 0.5)),
    partnering: clampUnit(raw?.partnering, clampUnit(base.partnering, 0.5)),
  };
}

const LOW_THRESHOLD = 0.35;
const HIGH_THRESHOLD = 0.65;

/**
 * Convert a 5-axis `AgentDisposition` into a compact prompt hint for Live
 * voice sessions. Returns `""` when all axes are in the balanced middle band.
 */
export function dispositionToPromptHint(d: PartialAgentDisposition | AgentDisposition): string {
  const norm = normalizeAgentDisposition(d);
  const clauses: string[] = [];

  if (norm.initiative < LOW_THRESHOLD) clauses.push("ask before starting canvas changes");
  else if (norm.initiative > HIGH_THRESHOLD) clauses.push("act at once on plausible intent");

  if (norm.curiosity < LOW_THRESHOLD) clauses.push("pick sensible defaults without asking");
  else if (norm.curiosity > HIGH_THRESHOLD) clauses.push("ask brief clarifying questions on gaps");

  if (norm.divergence < LOW_THRESHOLD) clauses.push("converge on one clear direction");
  else if (norm.divergence > HIGH_THRESHOLD) clauses.push("offer varied creative directions");

  if (norm.depth < LOW_THRESHOLD) clauses.push("keep spoken replies to 1 short sentence");
  else if (norm.depth > HIGH_THRESHOLD) clauses.push("walk through key reasoning clearly");

  if (norm.partnering < LOW_THRESHOLD) clauses.push("give direct, unvarnished critique without hedging");
  else if (norm.partnering > HIGH_THRESHOLD) clauses.push("keep tone warm and encouraging");

  if (clauses.length === 0) return "";
  return `[disposition] ${clauses.join("; ")}.`;
}

/* -------------------------------------------------------------------------- */
/* 4. "Follow me" voice intent detector                                       */
/* -------------------------------------------------------------------------- */

const FOLLOW_ME_PATTERNS: readonly RegExp[] = [
  /\bfollow\s+me\b/i,
  /\blook\s+at\s+this\b/i,
  /\bcome\s+look\b/i,
  /\blook\s+here\b/i,
  /\bcome\s+over\s+here\b/i,
  /\bcheck\s+this\s+out\b/i,
  /\bsee\s+what\s+i(?:'m|\s+am)\s+looking\s+at\b/i,
  /\blook\s+at\s+what\s+i(?:'m|\s+am)\s+looking\s+at\b/i,
  /\bjoin\s+my\s+view\b/i,
];

/**
 * Pure phrase detector for "follow me" viewport-handoff intent in spoken
 * transcripts ("follow me", "look at this", "come look", etc.).
 */
export function detectFollowMeIntent(transcript: string): boolean {
  if (typeof transcript !== "string") return false;
  const trimmed = transcript.trim();
  if (!trimmed) return false;
  return FOLLOW_ME_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/* -------------------------------------------------------------------------- */
/* 5. Co-listening media control (MediaControlCommand)                        */
/* -------------------------------------------------------------------------- */

/** Allowed ephemeral media playback control verbs for co-listening. */
export const MEDIA_CONTROL_ACTIONS = [
  "play",
  "pause",
  "seek",
  "rate",
  "volume",
  "status",
  "find_by_transcript",
] as const;

/** Union of ephemeral co-listening media control actions. */
export type MediaControlAction = (typeof MEDIA_CONTROL_ACTIONS)[number];

/**
 * Ephemeral playback control command for video/audio canvas items.
 * Never written to the oplog.
 */
export interface MediaControlCommand {
  action: MediaControlAction;
  /** Target canvas item id (optional when `find_by_transcript` or active item). */
  itemId?: string;
  /** Target playback timestamp in seconds (for `seek`). */
  timeSec?: number;
  /** Playback rate multiplier (for `rate`, e.g. 0.5..2.0). */
  rate?: number;
  /** Volume level in `0..1` (for `volume`). */
  volume?: number;
  /** Spoken/transcript search query (for `find_by_transcript`). */
  query?: string;
}

/** Validate and normalize an untrusted object into a `MediaControlCommand`, or `null`. */
export function parseMediaControlCommand(raw: unknown): MediaControlCommand | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.action !== "string" || !(MEDIA_CONTROL_ACTIONS as readonly string[]).includes(r.action)) {
    return null;
  }
  const action = r.action as MediaControlAction;
  const cmd: MediaControlCommand = { action };

  if (typeof r.itemId === "string" && r.itemId.trim()) cmd.itemId = r.itemId.trim();
  if (typeof r.timeSec === "number" && Number.isFinite(r.timeSec)) cmd.timeSec = Math.max(0, r.timeSec);
  if (typeof r.rate === "number" && Number.isFinite(r.rate)) cmd.rate = Math.max(0.25, Math.min(4, r.rate));
  if (typeof r.volume === "number" && Number.isFinite(r.volume)) cmd.volume = Math.max(0, Math.min(1, r.volume));
  if (typeof r.query === "string" && r.query.trim()) cmd.query = r.query.trim();

  if (action === "seek" && cmd.timeSec === undefined) return null;
  if (action === "rate" && cmd.rate === undefined) return null;
  if (action === "volume" && cmd.volume === undefined) return null;
  if (action === "find_by_transcript" && !cmd.query) return null;

  return cmd;
}
