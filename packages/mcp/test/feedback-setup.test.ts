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

import { expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Home } from "@isocan/api";
import { createServer } from "../src/server.ts";

it("bounds identity setup and never resolves a canvas after the deadline", async () => {
  let finish!: (home: Home) => void;
  const canvas = vi.fn();
  const server = createServer({ home: () => new Promise((resolve) => { finish = resolve; }) });
  const host = new Client({ name: "acme-stalled-identity", version: "1" });
  const [c, s] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(s), host.connect(c)]);
  try {
    const pending = host.callTool({ name: "wait_for_feedback", arguments: { canvas: "prj_acme", cursor: 17, timeoutMs: 20 } });
    const result = await Promise.race([pending, new Promise<null>((resolve) => setTimeout(() => resolve(null), 300))]);
    expect(result).not.toBeNull();
    expect(JSON.parse((result!.content as Array<{ text: string }>)[0]!.text)).toEqual({ status: "timeout", cursor: 17, entries: [] });
    finish({ canvas } as unknown as Home);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(canvas).not.toHaveBeenCalled();
  } finally { await host.close(); await server.close(); }
});

it("cancels identity setup without advancing into canvas admission", async () => {
  let finish!: (home: Home) => void;
  const canvas = vi.fn();
  const home = vi.fn(() => new Promise<Home>((resolve) => { finish = resolve; }));
  const server = createServer({ home });
  const host = new Client({ name: "acme-cancelled-identity", version: "1" });
  const [c, s] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(s), host.connect(c)]);
  try {
    const controller = new AbortController();
    const pending = host.callTool({ name: "wait_for_feedback", arguments: { canvas: "prj_acme", timeoutMs: 60000 } }, undefined, { signal: controller.signal });
    const cancelled = expect(pending).rejects.toThrow();
    await expect.poll(() => home.mock.calls.length).toBe(1);
    controller.abort();
    await cancelled;
    finish({ canvas } as unknown as Home);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(canvas).not.toHaveBeenCalled();
  } finally { await host.close(); await server.close(); }
});
