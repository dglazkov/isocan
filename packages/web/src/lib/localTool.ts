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

import { loopbackOrigin, parseLocalToolCode, type LocalToolDoor } from "@isocan/core";
import { useUiStore } from "../stores/uiStore.ts";

/**
 * **The local-tool door** (exact phase 2; `docs/projects/exact/design.md` §5):
 * the one way a module's code in this browser reaches a process on this
 * machine — Exact's bridge today. A product change, reviewed as one, and kept
 * narrow on purpose:
 *
 * - **No new op, route, message or store.** The browser talks to the bridge
 *   directly on loopback; the home never hears of it.
 * - **Only on a home that is itself on this machine** (`loopbackOrigin`). A
 *   hosted HTTPS canvas meets Private Network Access and mixed content, and
 *   waits for Exact's relay (exact phase 8): shut, with a sentence.
 * - **Only while the person's switch is on**: the experiment `<tool>.local`
 *   (Settings → Experiments → Exact → Live frames), per browser. Shut means
 *   no request and no frame — `fetch` throws before the network, `frameUrl`
 *   answers null — so "off" is observable in a network log as nothing.
 * - **Paired once per machine**: the code the bridge printed, one use, two
 *   minutes; the token it answers lives in this browser's storage (wrapped:
 *   a private window has none, and then pairing lasts the tab) and never in
 *   an item, a property or an op.
 */

const KEY = (tool: string) => `isocan.localTool.${tool}`;
const LOOPBACK = "127.0.0.1";

interface Pairing { port: number; token: string; at: number }

/** Pairings kept for this tab when storage refuses (a private window). */
const memory = new Map<string, Pairing[]>();
const listeners = new Map<string, Set<() => void>>();

function read(tool: string): Pairing[] {
  try {
    const raw = localStorage.getItem(KEY(tool));
    if (raw) {
      const list = JSON.parse(raw) as Pairing[];
      if (Array.isArray(list)) return list.filter((p) => Number.isInteger(p?.port) && typeof p?.token === "string");
    }
  } catch { /* storage refused: the tab's memory below */ }
  return memory.get(tool) ?? [];
}

function write(tool: string, list: Pairing[]): void {
  memory.set(tool, list);
  try { localStorage.setItem(KEY(tool), JSON.stringify(list)); } catch { /* kept for the tab */ }
  for (const l of listeners.get(tool) ?? []) l();
}

/** Why the door is shut for this tool here, or null. Read fresh on every call: the switch can move under a mounted frame. */
export function localToolShut(tool: string, href = typeof location === "undefined" ? "" : location.href, experiments = useUiStore.getState().experiments): string | null {
  if (!loopbackOrigin(href)) return "Live frames need a canvas whose home is on this machine (127.0.0.1); a hosted canvas shows captures until Exact's relay lands.";
  if (!experiments.includes(tool)) return `The ${tool} experiment is off in Settings.`;
  if (!experiments.includes(`${tool}.local`)) return "Live frames are off in Settings → Experiments, so this browser opens no connection to your machine; screens are captures.";
  return null;
}

/** The door for one tool, as `RendererFacts.localTool` and `WebHost.localTool` hand it to a module. */
export function localToolDoor(tool: string): LocalToolDoor {
  const shut = localToolShut(tool);
  const tokenOf = (port: number) => read(tool).find((p) => p.port === port)?.token ?? null;
  const refuse = () => { throw new Error(shut ?? "not paired"); };
  return {
    shut,
    paired: () => (shut ? [] : read(tool).sort((a, b) => b.at - a.at).map((p) => p.port)),
    async pair(text: string) {
      if (shut) refuse();
      const parsed = parseLocalToolCode(text);
      if (!parsed) throw new Error("A pairing code looks like 47811-K3M9Q-7XW2P — the bridge prints it when `isocan exact live` starts.");
      const r = await fetch(`http://${LOOPBACK}:${parsed.port}/pair`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: parsed.code }) });
      const answer = (await r.json().catch(() => null)) as { token?: string; error?: string } | null;
      if (!r.ok || typeof answer?.token !== "string") throw new Error(answer?.error ?? `the bridge on port ${parsed.port} refused the code (${r.status})`);
      write(tool, [...read(tool).filter((p) => p.port !== parsed.port), { port: parsed.port, token: answer.token, at: Date.now() }]);
      return { port: parsed.port };
    },
    async fetch(port, path, init) {
      if (shut) refuse();
      const token = tokenOf(port);
      if (!token || !path.startsWith("/")) refuse();
      return fetch(`http://${LOOPBACK}:${port}${path}`, {
        method: init?.method ?? "GET",
        headers: { authorization: `Bearer ${token}`, ...(init?.body !== undefined ? { "content-type": "application/json" } : {}) },
        ...(init?.body !== undefined ? { body: init.body } : {}),
        ...(init?.signal ? { signal: init.signal } : {}),
      });
    },
    frameUrl(port, path) {
      if (shut || !Number.isInteger(port) || port < 1024 || port > 65535 || !path.startsWith("/") || path.startsWith("//")) return null;
      return `http://${LOOPBACK}:${port}${path}`;
    },
    forget(port) {
      write(tool, read(tool).filter((p) => p.port !== port));
    },
    watch(listener) {
      const set = listeners.get(tool) ?? new Set();
      set.add(listener);
      listeners.set(tool, set);
      // The switch is the experiments list: a flip in Settings is a change too.
      const off = useUiStore.subscribe((s, prev) => { if (s.experiments !== prev.experiments) listener(); });
      return () => { set.delete(listener); off(); };
    },
  };
}
