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

import { useEffect, useState, type ComponentType } from "react";
import type { RendererFacts, WebModule } from "@isocan/core";
import { SESSION_MIME, TERMINAL_MIME, WORKBENCH_PROPS, workbenchModule } from "./core.ts";

interface SessionPayload {
  driver?: string;
  sessionId?: string;
  title?: string;
  status?: string;
  handle?: string;
  workspace?: string;
  command?: string;
}

function useJsonPayload(readText: (hash: string) => Promise<string>, blobHash: string): SessionPayload | null {
  const [payload, setPayload] = useState<SessionPayload | null>(null);
  useEffect(() => {
    let cancelled = false;
    readText(blobHash)
      .then((text) => {
        if (cancelled) return;
        try {
          setPayload(JSON.parse(text) as SessionPayload);
        } catch {
          setPayload(null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [readText, blobHash]);
  return payload;
}

export function SessionCard({ item, blobHash, readText }: RendererFacts) {
  const payload = useJsonPayload(readText, blobHash);
  const driver = payload?.driver ?? item?.properties[WORKBENCH_PROPS.driver] ?? "session";
  const status = payload?.status ?? item?.properties[WORKBENCH_PROPS.status] ?? "running";
  const handle = payload?.handle ?? item?.properties["station.handle"];
  const workspace = payload?.workspace ?? item?.properties[WORKBENCH_PROPS.workspace];

  return (
    <div
      className="workbench-session-card"
      data-driver={driver}
      data-status={status}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 14,
        height: "100%",
        boxSizing: "border-box",
        background: "var(--surface-container, #1e1f22)",
        color: "var(--on-surface, #f2f2f2)",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
        <span style={{ opacity: 0.75 }}>{driver}</span>
        <span style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>{status}</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{payload?.title ?? item?.title ?? "Agent Session"}</div>
      {handle ? <div style={{ fontSize: 12, opacity: 0.8 }}>@{handle}</div> : null}
      {workspace ? (
        <div style={{ fontSize: 11, opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {workspace}
        </div>
      ) : null}
    </div>
  );
}

export function TerminalCard({ item, blobHash, readText }: RendererFacts) {
  const payload = useJsonPayload(readText, blobHash);
  const status = payload?.status ?? item?.properties[WORKBENCH_PROPS.status] ?? "running";
  const command = payload?.command ?? item?.title ?? "shell";

  return (
    <div
      className="workbench-terminal-card"
      data-status={status}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 12,
        height: "100%",
        boxSizing: "border-box",
        background: "#111315",
        color: "#d4d4d8",
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.7 }}>
        <span>pty</span>
        <span>{status}</span>
      </div>
      <div style={{ fontWeight: 600, color: "#fafafa" }}>$ {command}</div>
    </div>
  );
}

export const workbenchWeb: WebModule<never, ComponentType<RendererFacts>> = {
  core: workbenchModule,
  renderers: [
    { mimes: [SESSION_MIME], component: SessionCard },
    { mimes: [TERMINAL_MIME], component: TerminalCard },
  ],
};

export default workbenchWeb;
