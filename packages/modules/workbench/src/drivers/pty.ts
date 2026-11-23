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

import { spawn, type ChildProcess } from "node:child_process";
import { nanoid } from "nanoid";
import {
  detectDevServerUrls,
  type DevServerInfo,
  type SessionArtifact,
  type SessionDriver,
  type SessionEvent,
  type SessionModelInfo,
  type SessionStartInput,
  type SessionSummary,
} from "@isocan/core/session-driver";

interface PtySessionRecord {
  summary: SessionSummary;
  events: SessionEvent[];
  listeners: Set<(event: SessionEvent) => void>;
  servers: DevServerInfo[];
  process?: ChildProcess;
}

function emitEvent(record: PtySessionRecord, event: SessionEvent): void {
  record.events.push(event);
  if (record.events.length > 200) record.events.shift();
  for (const listener of record.listeners) {
    try {
      listener(event);
    } catch {
      // ignore listener errors
    }
  }
}

export class PtySessionDriver implements SessionDriver {
  readonly id = "pty";
  readonly label = "Terminal (PTY)";
  private readonly sessions = new Map<string, PtySessionRecord>();

  async available(): Promise<boolean> {
    return true;
  }

  async models(): Promise<SessionModelInfo[]> {
    return [];
  }

  async list(workspace?: string): Promise<SessionSummary[]> {
    const all = [...this.sessions.values()].map((r) => r.summary);
    return workspace ? all.filter((s) => s.workspace === workspace) : all;
  }

  async start(input: SessionStartInput): Promise<SessionSummary> {
    const id = `pty_${nanoid(10)}`;
    const now = new Date().toISOString();
    const command = input.command?.trim() || process.env["SHELL"] || "/bin/sh";
    const summary: SessionSummary = {
      id,
      driver: this.id,
      title: input.title?.trim() || command,
      ...(input.workspace ? { workspace: input.workspace } : {}),
      status: "running",
      createdAt: now,
      updatedAt: now,
    };

    const record: PtySessionRecord = {
      summary,
      events: [],
      listeners: new Set(),
      servers: [],
    };
    this.sessions.set(id, record);

    const child = spawn(command, [], {
      cwd: input.workspace || process.cwd(),
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...(input.env ?? {}) },
    });
    record.process = child;

    const handleOutput = (chunk: Buffer | string) => {
      const text = chunk.toString();
      const at = new Date().toISOString();
      record.summary.updatedAt = at;
      emitEvent(record, { kind: "turn", sessionId: id, at, text });
      for (const server of detectDevServerUrls(text)) {
        if (!record.servers.some((s) => s.url === server.url)) {
          record.servers.push(server);
          emitEvent(record, { kind: "dev_server_ready", sessionId: id, at, devServer: server });
        }
      }
    };

    child.stdout?.on("data", handleOutput);
    child.stderr?.on("data", handleOutput);
    child.on("exit", (code) => {
      const at = new Date().toISOString();
      record.summary.status = code === 0 ? "done" : "stopped";
      record.summary.updatedAt = at;
      emitEvent(record, { kind: "status", sessionId: id, at, status: record.summary.status });
    });
    child.on("error", (err) => {
      const at = new Date().toISOString();
      record.summary.status = "failed";
      record.summary.updatedAt = at;
      emitEvent(record, { kind: "status", sessionId: id, at, status: "failed", text: err.message });
    });

    if (input.prompt?.trim() && child.stdin?.writable) {
      child.stdin.write(`${input.prompt.trim()}\n`);
    }

    return summary;
  }

  async send(sessionId: string, text: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`pty session not found: ${sessionId}`);
    if (record.process?.stdin?.writable) {
      record.process.stdin.write(`${text}\n`);
    }
    const at = new Date().toISOString();
    record.summary.updatedAt = at;
    emitEvent(record, { kind: "turn", sessionId, at, text });
  }

  async approve(_sessionId: string, _interactionId: string, _decision?: boolean | string): Promise<void> {
    // PTY sessions have no structured interaction queue.
  }

  async cancel(sessionId: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`pty session not found: ${sessionId}`);
    record.process?.kill("SIGTERM");
    const at = new Date().toISOString();
    record.summary.status = "cancelled";
    record.summary.updatedAt = at;
    emitEvent(record, { kind: "status", sessionId, at, status: "cancelled" });
  }

  tail(sessionId: string, onEvent: (event: SessionEvent) => void): () => void {
    const record = this.sessions.get(sessionId);
    if (!record) return () => {};
    record.listeners.add(onEvent);
    for (const ev of record.events) {
      onEvent(ev);
    }
    return () => {
      record.listeners.delete(onEvent);
    };
  }

  async artifacts(_sessionId: string): Promise<SessionArtifact[]> {
    return [];
  }

  async devServers(sessionId: string): Promise<DevServerInfo[]> {
    return [...(this.sessions.get(sessionId)?.servers ?? [])];
  }
}

export const ptyDriver = new PtySessionDriver();
