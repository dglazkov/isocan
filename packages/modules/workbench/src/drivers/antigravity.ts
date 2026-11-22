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

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
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

export function antigravityBrainDir(): string {
  const override = process.env["ISOCAN_ANTIGRAVITY_BRAIN_DIR"]?.trim();
  return override || path.join(os.homedir(), ".gemini", "antigravity", "brain");
}

interface AntigravitySessionRecord {
  summary: SessionSummary;
  events: SessionEvent[];
  listeners: Set<(event: SessionEvent) => void>;
  servers: DevServerInfo[];
  artifacts: SessionArtifact[];
}

export class AntigravitySessionDriver implements SessionDriver {
  readonly id = "antigravity";
  readonly label = "Antigravity";
  private readonly sessions = new Map<string, AntigravitySessionRecord>();

  async available(): Promise<boolean> {
    return existsSync(antigravityBrainDir());
  }

  async models(): Promise<SessionModelInfo[]> {
    return [
      { id: "gemini-3-pro", label: "Gemini 3 Pro", provider: "google", default: true },
      { id: "gemini-3-flash", label: "Gemini 3 Flash", provider: "google" },
    ];
  }

  async list(workspace?: string): Promise<SessionSummary[]> {
    const dir = antigravityBrainDir();
    const summaries: SessionSummary[] = [...this.sessions.values()].map((r) => r.summary);
    if (existsSync(dir)) {
      for (const entry of readdirSync(dir)) {
        if (entry.startsWith(".") || this.sessions.has(entry)) continue;
        const full = path.join(dir, entry);
        try {
          const stat = statSync(full);
          if (!stat.isDirectory()) continue;
          const ts = stat.mtime.toISOString();
          summaries.push({
            id: entry,
            driver: this.id,
            title: `Antigravity (${entry.slice(0, 8)})`,
            status: "waiting",
            createdAt: ts,
            updatedAt: ts,
          });
        } catch {
          // ignore unreadable entry
        }
      }
    }
    return workspace ? summaries.filter((s) => !s.workspace || s.workspace === workspace) : summaries;
  }

  async start(input: SessionStartInput): Promise<SessionSummary> {
    const id = `ag_${nanoid(10)}`;
    const now = new Date().toISOString();
    const summary: SessionSummary = {
      id,
      driver: this.id,
      title: input.title?.trim() || input.prompt?.slice(0, 60) || "Antigravity session",
      ...(input.workspace ? { workspace: input.workspace } : {}),
      ...(input.model ? { model: input.model } : {}),
      status: "running",
      createdAt: now,
      updatedAt: now,
    };

    const record: AntigravitySessionRecord = {
      summary,
      events: [
        {
          kind: "snapshot",
          sessionId: id,
          at: now,
          status: "running",
          ...(input.prompt ? { text: input.prompt } : {}),
        },
      ],
      listeners: new Set(),
      servers: [],
      artifacts: [],
    };
    this.sessions.set(id, record);
    return summary;
  }

  async send(sessionId: string, text: string): Promise<void> {
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error(`antigravity session not found: ${sessionId}`);
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
    if (!record) throw new Error(`antigravity session not found: ${sessionId}`);
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
    if (!record) throw new Error(`antigravity session not found: ${sessionId}`);
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

  async artifacts(sessionId: string): Promise<SessionArtifact[]> {
    const record = this.sessions.get(sessionId);
    if (record && record.artifacts.length > 0) return [...record.artifacts];
    const dir = path.join(antigravityBrainDir(), sessionId);
    if (!existsSync(dir)) return [];
    const out: SessionArtifact[] = [];
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".md")) continue;
      const full = path.join(dir, name);
      try {
        out.push({
          id: name,
          title: name,
          path: full,
          mimeType: "text/markdown",
          content: readFileSync(full, "utf8"),
        });
      } catch {
        // ignore unreadable artifact
      }
    }
    return out;
  }

  async devServers(sessionId: string): Promise<DevServerInfo[]> {
    return [...(this.sessions.get(sessionId)?.servers ?? [])];
  }
}

export const antigravityDriver = new AntigravitySessionDriver();
