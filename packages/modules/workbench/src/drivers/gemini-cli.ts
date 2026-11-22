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

import { execFile } from "node:child_process";
import { promisify } from "node:util";
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

const execFileAsync = promisify(execFile);

interface CliSessionRecord {
  summary: SessionSummary;
  events: SessionEvent[];
  listeners: Set<(event: SessionEvent) => void>;
  servers: DevServerInfo[];
}

export class GeminiCliSessionDriver implements SessionDriver {
  readonly id = "gemini-cli";
  readonly label = "Gemini CLI";
  private readonly sessions = new Map<string, CliSessionRecord>();

  async available(): Promise<boolean> {
    try {
      await execFileAsync("which", ["gemini"], { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  async models(): Promise<SessionModelInfo[]> {
    return [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "google", default: true },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google" },
    ];
  }

  async list(workspace?: string): Promise<SessionSummary[]> {
    const all = [...this.sessions.values()].map((r) => r.summary);
    return workspace ? all.filter((s) => s.workspace === workspace) : all;
  }

  async start(input: SessionStartInput): Promise<SessionSummary> {
    const id = `gem_${nanoid(10)}`;
    const now = new Date().toISOString();
    const summary: SessionSummary = {
      id,
      driver: this.id,
      title: input.title?.trim() || input.prompt?.slice(0, 60) || "Gemini CLI session",
      ...(input.workspace ? { workspace: input.workspace } : {}),
      ...(input.model ? { model: input.model } : {}),
      status: "running",
      createdAt: now,
      updatedAt: now,
    };
    const record: CliSessionRecord = {
      summary,
      events: [{ kind: "snapshot", sessionId: id, at: now, status: "running", ...(input.prompt ? { text: input.prompt } : {}) }],
      listeners: new Set(),
      servers: [],
    };
    this.sessions.set(id, record);
    return summary;
  }

  async send(sessionId: string, text: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`gemini-cli session not found: ${sessionId}`);
    const at = new Date().toISOString();
    record.summary.updatedAt = at;
    const ev: SessionEvent = { kind: "turn", sessionId, at, text };
    record.events.push(ev);
    for (const listener of record.listeners) listener(ev);
    for (const server of detectDevServerUrls(text)) {
      if (!record.servers.some((s) => s.url === server.url)) {
        record.servers.push(server);
        const srvEv: SessionEvent = { kind: "dev_server_ready", sessionId, at, devServer: server };
        record.events.push(srvEv);
        for (const listener of record.listeners) listener(srvEv);
      }
    }
  }

  async approve(sessionId: string, interactionId: string, decision: boolean | string = true): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`gemini-cli session not found: ${sessionId}`);
    const at = new Date().toISOString();
    const ev: SessionEvent = {
      kind: "interaction",
      sessionId,
      at,
      interaction: {
        id: interactionId,
        kind: "approval",
        prompt: "Resolved",
        resolved: true,
        approved: decision !== false && decision !== "deny",
      },
    };
    record.events.push(ev);
    for (const listener of record.listeners) listener(ev);
  }

  async cancel(sessionId: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`gemini-cli session not found: ${sessionId}`);
    const at = new Date().toISOString();
    record.summary.status = "cancelled";
    record.summary.updatedAt = at;
    const ev: SessionEvent = { kind: "status", sessionId, at, status: "cancelled" };
    record.events.push(ev);
    for (const listener of record.listeners) listener(ev);
  }

  tail(sessionId: string, onEvent: (event: SessionEvent) => void): () => void {
    const record = this.sessions.get(sessionId);
    if (!record) return () => {};
    record.listeners.add(onEvent);
    for (const ev of record.events) onEvent(ev);
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

export const geminiCliDriver = new GeminiCliSessionDriver();
