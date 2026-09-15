/**
 * **The voice harness, as a contract rather than a page.**
 *
 * The harness (merger's side) owns the microphone-to-model plumbing and the
 * key; this module is only the wire between a browser and it. Everything the
 * UI knows about the outside world is in this file:
 *
 *   GET  /state                       facts: canvas, daemon, home, agent, provider, model, version, updated, session
 *   POST /session/start|mute|unmute|end
 *   POST /key {key, provider}         the key is posted once and never stored in the page
 *   POST /key/test                    one authenticated call, the provider's answer verbatim
 *   GET  /log                         the tool-call log: call, operation minted, daemon's answer
 *   WS   /audio                       16 kHz PCM up (binary), 24 kHz PCM back (binary)
 *
 * `/harness` is a Vite dev proxy to 127.0.0.1:7654, so the page is same-origin
 * and the daemon needs no CORS header to work in dev or in a build behind it.
 */

export const HARNESS = "/harness";

export type SessionState = "idle" | "live" | "muted" | "ended";

export interface State {
  canvas?: { title?: string; id?: string };
  daemon?: string;
  home?: string;
  service?: string;
  agent?: { name?: string; id?: string; enrolled?: boolean };
  provider?: string;
  model?: string;
  keyPresent?: boolean;
  version?: string;
  updated?: string;
  session?: SessionState | { state?: SessionState };
  [k: string]: unknown;
}

export interface LogEntry {
  at?: string | undefined;
  tool?: string | undefined;
  args?: unknown;
  operation?: string | undefined;
  answered?: string | undefined;
  error?: string | undefined;
  event?: string | undefined;
  /** The page's own record (not the harness's), kept across the log poll. */
  own?: boolean;
  [k: string]: unknown;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(HARNESS + path, init);
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    // A refusal is the answer, not an error to swallow: an endpoint that does
    // not exist yet must say so in the log rather than render as a blank panel.
    throw new Error(`${path} answered ${response.status}: ${text.slice(0, 200)}`);
  }
}

export const state = () => json<State>("/state");

/**
 * **The provider's model list, and what a name has to say for itself.**
 *
 * `live` is read off `supportedGenerationMethods` containing
 * `bidiGenerateContent` — the Live API's own method name, measured on 13 Sep
 * 2026 (55 models listed, 7 of them Live) — so the page is repeating the
 * provider rather than holding a list of its own. The list cannot be the
 * validation: a beta name is exactly what it will not carry.
 */
export interface ProviderModel {
  name: string;
  displayName: string;
  description: string;
  methods: string[];
  live: boolean;
  /** Live AND a voice to talk WITH — the picker's filter (transcribe and
   * translate families are Live but refuse AUDIO responses). */
  conversational: boolean;
}

interface ModelList {
  ok: boolean;
  models: ProviderModel[];
  /** The provider's own words, or why there is no list. */
  answer: string;
}

/** The provider's list, through the harness — which is the one holding the key. */
export const models = () => json<ModelList>("/models");

/** Choose: the harness stores it, and the next session talks through it. */
export const useModel = (model: string) =>
  json<{ ok?: boolean; model?: string; source?: string; appliesTo?: string; error?: string }>("/model", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model }),
  });

/** Ask the provider about a name — the only validation a beta model can pass. */
export const testModel = (model: string) =>
  json<{ ok?: boolean; model?: string; answer?: string; why?: string }>("/model/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model }),
  });
export const log = () => json<LogReply>("/log");
export const startSession = () => json<{ ok?: boolean; error?: string }>("/session/start", { method: "POST" });
export const muteSession = () => json<{ ok?: boolean; error?: string }>("/session/mute", { method: "POST" });
export const unmuteSession = () => json<{ ok?: boolean; error?: string }>("/session/unmute", { method: "POST" });
export const endSession = () => json<{ ok?: boolean; error?: string }>("/session/end", { method: "POST" });
export const saveKey = (key: string, provider: string) =>
  json<{ ok?: boolean; error?: string }>("/key", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, provider }),
  });
export const testKey = () =>
  json<{ ok?: boolean; answer?: string; provider?: string }>("/key/test", { method: "POST" });

/** The entries in whatever shape the endpoint returns today. */
/**
 * **The harness's field names, mapped once, at the wire.**
 *
 * `GET /log` answers `{ timestamp, name, op, result }` and the page renders
 * `{ at, tool, operation, answered }`. Translating in the renderer is how the
 * log came out empty for hours while the endpoint was working: every field it
 * read was `undefined` and every row looked like a blank line.
 */
export function entriesFrom(reply: LogReply): LogEntry[] {
  const raw: RawEntry[] = Array.isArray(reply) ? reply : (reply.entries ?? reply.log ?? []);
  return raw.map((entry) => ({
    at: words(entry.at ?? entry.timestamp ?? entry.time),
    tool: words(entry.tool ?? entry.name ?? entry.toolName),
    args: entry.args ?? entry.arguments ?? entry.input,
    operation: words(entry.operation ?? entry.op ?? entry.operationId),
    answered: words(entry.answered ?? entry.result ?? entry.answer),
    error: words(entry.error ?? entry.failure),
    event: words(entry.event ?? entry.message),
  }));
}

/**
 * **The same field is a string in one build and an object in the next.**
 *
 * The harness's call log records an operation as `{ type, said }` and its
 * answer as `{ ok, answer }`; the session events log a plain string. A page
 * that hands the object to JSX throws "Objects are not valid as a React child"
 * and takes the whole route down — which is what this page did, in a real
 * browser, against a real harness, after the suite had passed. So the wire
 * answers a sentence or it answers nothing; never a shape the renderer has to
 * guess at.
 */
function words(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const held = value as Record<string, unknown>;
    const type = typeof held.type === "string" ? held.type : undefined;
    const said = typeof held.said === "string" ? held.said : undefined;
    if (type && said) return `${type} — ${said}`;
    if (said) return said;
    if (typeof held.answer === "string") return held.answer;
    if (typeof held.error === "string") return held.error;
    if (typeof held.reason === "string") return held.reason;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export interface RawEntry {
  at?: string;
  timestamp?: string;
  time?: string;
  tool?: string;
  name?: string;
  toolName?: string;
  args?: unknown;
  arguments?: unknown;
  input?: unknown;
  operation?: unknown;
  op?: unknown;
  operationId?: unknown;
  answered?: unknown;
  result?: unknown;
  answer?: unknown;
  error?: unknown;
  failure?: unknown;
  event?: unknown;
  message?: unknown;
}

export type LogReply = RawEntry[] | { entries?: RawEntry[]; log?: RawEntry[] };

/** `{ state: "live" }` or `"live"` — the harness has answered both ways. */
export function sessionFrom(reply: State | null | undefined): SessionState | undefined {
  const held = reply?.session as unknown;
  if (!held) return undefined;
  if (typeof held === "string") return held as SessionState;
  const state = (held as { state?: string }).state;
  return state as SessionState | undefined;
}

/** The broker door never opens a provider session; audio requires a separate act. */
export function audioSocket(brokerOnly = false): WebSocket {
  const url = new URL(HARNESS + (brokerOnly ? "/broker" : "/audio"), window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return new WebSocket(url);
}
