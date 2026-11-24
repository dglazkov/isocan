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
 * **SessionDriver contract** (Open Stitch Phase 4).
 *
 * Pure, dependency-free types and URL heuristics shared between the canvas
 * shell, the CLI, and workbench session drivers (`antigravity`,
 * `gemini-cli`, `claude-code`, `pty`).
 */

type SessionEventKind =
  | "snapshot"
  | "turn"
  | "step"
  | "subagents"
  | "interaction"
  | "dev_server_ready"
  | "status"
  | "rewind"
  | "artifacts";

type SessionStatus =
  | "starting"
  | "running"
  | "waiting"
  | "paused"
  | "done"
  | "failed"
  | "stopped"
  | "cancelled";

/** Model advertised by a `SessionDriver`. */
export interface SessionModelInfo {
  id: string;
  label: string;
  provider?: string;
  default?: boolean;
}

/** Summary metadata of a running or past agent/terminal session. */
export interface SessionSummary {
  id: string;
  driver: string;
  title: string;
  workspace?: string;
  status: SessionStatus;
  model?: string;
  createdAt: string;
  updatedAt: string;
  handle?: string;
}

/** Artifact produced by a session for emission onto a canvas. */
export interface SessionArtifact {
  id: string;
  title: string;
  path?: string;
  mimeType: string;
  kind?: string;
  content?: string;
}

interface SessionInteraction {
  id: string;
  kind: "approval" | "question" | "input";
  prompt: string;
  options?: readonly string[];
  command?: string;
  resolved?: boolean;
  approved?: boolean;
}

/** Detected local dev server exposed by a running session. */
export interface DevServerInfo {
  url: string;
  port: number;
  host: string;
  label?: string;
}

/** Structured event streamed from a `SessionDriver` tail. */
export interface SessionEvent {
  kind: SessionEventKind;
  sessionId: string;
  at: string;
  turnId?: string;
  stepId?: string;
  status?: SessionStatus;
  text?: string;
  interaction?: SessionInteraction;
  devServer?: DevServerInfo;
  artifacts?: SessionArtifact[];
  data?: Readonly<Record<string, unknown>>;
}

/** Parameters for starting a new session through a `SessionDriver`. */
export interface SessionStartInput {
  workspace?: string;
  prompt?: string;
  command?: string;
  model?: string;
  title?: string;
  env?: Readonly<Record<string, string>>;
}

/** Driver-agnostic contract bridging local agent harnesses and terminals onto the canvas. */
export interface SessionDriver {
  readonly id: string;
  readonly label: string;
  available(): Promise<boolean>;
  models(): Promise<SessionModelInfo[]>;
  list(workspace?: string): Promise<SessionSummary[]>;
  start(input: SessionStartInput): Promise<SessionSummary>;
  send(sessionId: string, text: string): Promise<void>;
  approve(sessionId: string, interactionId: string, decision?: boolean | string): Promise<void>;
  cancel(sessionId: string): Promise<void>;
  tail(sessionId: string, onEvent: (event: SessionEvent) => void): () => void;
  artifacts(sessionId: string): Promise<SessionArtifact[]>;
  devServers(sessionId: string): Promise<DevServerInfo[]>;
}

/** Loopback ports used by internal RPC / daemon plumbing rather than UI dev servers. */
const IGNORED_DEV_SERVER_PORTS: ReadonlySet<number> = new Set([5387, 4441]);

const DEV_SERVER_URL_RE = /\bhttps?:\/\/(localhost|127\.0\.0\.1):(\d{2,5})(?:\/[^\s"'`<>)]*)?/gi;

/**
 * Extract loopback dev-server URLs (`http://localhost:<port>` /
 * `http://127.0.0.1:<port>`) from terminal or agent output, ignoring common
 * non-UI ports such as 5387 and 4441.
 */
export function detectDevServerUrls(text: string): DevServerInfo[] {
  if (!text) return [];
  const found: DevServerInfo[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(DEV_SERVER_URL_RE)) {
    const raw = match[0].replace(/[.,;:!?]+$/, "");
    const host = (match[1] ?? "localhost").toLowerCase();
    const port = Number(match[2]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) continue;
    if (IGNORED_DEV_SERVER_PORTS.has(port)) continue;

    let normalized = raw;
    try {
      const parsed = new URL(raw);
      normalized = parsed.pathname === "/" && !parsed.search && !parsed.hash
        ? `${parsed.protocol}//${parsed.host}`
        : parsed.href;
    } catch {
      continue;
    }

    if (seen.has(normalized)) continue;
    seen.add(normalized);
    found.push({ url: normalized, port, host });
  }

  return found;
}
