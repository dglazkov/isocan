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
 * **Honest presence action verbs, deterministic `@handles`, and OKLCH colour
 * assignment** (Open Stitch Phase 2A, OS1 ADRs 0272 & 0273).
 *
 * Every agent gets a memorable, collision-free `@handle` from a deterministic
 * pool and an 8-colour OKLCH accent derived via FNV-1a. Presence pills report
 * an explicit verb (`@ada · writing`) instead of invented cursor wandering.
 */

/** Explicit, honest action verbs an agent session can declare on its cursor. */
export const AGENT_ACTION_VERBS = [
  "thinking",
  "reading",
  "writing",
  "generating",
  "coding",
  "verifying",
  "coordinating",
  "idle",
  "done",
] as const;

/** One of {@link AGENT_ACTION_VERBS}. */
export type AgentActionVerb = (typeof AGENT_ACTION_VERBS)[number];

const ACTION_VERB_SET: ReadonlySet<string> = new Set(AGENT_ACTION_VERBS);

/** Narrow an unknown string to an {@link AgentActionVerb}. */
export function isAgentActionVerb(value: unknown): value is AgentActionVerb {
  return typeof value === "string" && ACTION_VERB_SET.has(value);
}

/** Deterministic pool of 16 readable agent handles (OS1 ADR 0272). */
export const HANDLE_POOL = [
  "ada",
  "newton",
  "maya",
  "euler",
  "hopper",
  "noether",
  "turing",
  "curie",
  "lovelace",
  "tesla",
  "galileo",
  "darwin",
  "faraday",
  "gauss",
  "meitner",
  "ramanujan",
] as const;

/** Handles that cannot be claimed by a single actor (`@all` broadcasts to the room). */
const RESERVED_HANDLES: ReadonlySet<string> = new Set(["all"]);

/** Maximum length of a normalized agent handle (without leading `@`). */
const MAX_HANDLE_LENGTH = 24;

/** 8-colour perceptually balanced OKLCH palette for collaborator cursors and halos. */
export const HANDLE_PALETTE_OKLCH = [
  "oklch(0.62 0.19 255)", // cobalt blue
  "oklch(0.62 0.19 155)", // emerald
  "oklch(0.64 0.19 40)",  // warm coral
  "oklch(0.60 0.20 305)", // violet
  "oklch(0.63 0.17 195)", // teal
  "oklch(0.66 0.18 75)",  // amber
  "oklch(0.61 0.20 350)", // rose
  "oklch(0.60 0.17 125)", // moss green
] as const;

/** Deterministic unsigned 32-bit FNV-1a hash. */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Normalize a raw handle string into a lowercase, URL-safe handle of at most
 * 24 characters. Strips a leading `@`, collapses non-alphanumeric runs to `-`,
 * and rejects reserved handles such as `@all` by returning `null`.
 */
export function normalizeHandle(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, MAX_HANDLE_LENGTH)
    .replace(/[-_]+$/g, "");
  if (!cleaned || RESERVED_HANDLES.has(cleaned)) return null;
  return cleaned;
}

/**
 * Assign a deterministic handle from {@link HANDLE_POOL} for `actorId`,
 * avoiding any handle already present in `taken`. Falls back to `<base>-2`,
 * `<base>-3`, … once all 16 pool slots are occupied.
 */
export function handleForActor(
  actorId: string,
  taken?: ReadonlySet<string> | readonly string[],
): string {
  const used = new Set<string>();
  if (taken) {
    for (const entry of taken) {
      const norm = normalizeHandle(entry);
      if (norm) used.add(norm);
    }
  }
  const start = fnv1a32(actorId) % HANDLE_POOL.length;
  for (let offset = 0; offset < HANDLE_POOL.length; offset++) {
    const candidate = HANDLE_POOL[(start + offset) % HANDLE_POOL.length]!;
    if (!used.has(candidate)) return candidate;
  }
  const base = HANDLE_POOL[start]!;
  let suffix = 2;
  for (;;) {
    const tail = `-${suffix}`;
    const candidate = `${base.slice(0, MAX_HANDLE_LENGTH - tail.length)}${tail}`;
    if (!used.has(candidate)) return candidate;
    suffix += 1;
  }
}

/** Pick one of the 8 OKLCH collaborator accents deterministically via FNV-1a. */
export function colorForHandle(handleOrActorId: string): string {
  const key = normalizeHandle(handleOrActorId) ?? handleOrActorId.trim().toLowerCase();
  return HANDLE_PALETTE_OKLCH[fnv1a32(key) % HANDLE_PALETTE_OKLCH.length]!;
}

/** Render the counter-scaled cursor pill text: `@handle · verb`. */
export function formatAgentPill(handle: string, action: AgentActionVerb): string {
  const bare = normalizeHandle(handle) ?? handle.replace(/^@+/, "");
  return `@${bare} · ${action}`;
}
