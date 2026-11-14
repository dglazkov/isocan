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

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loopbackOrigin, parseLocalToolCode } from "@isocan/core";
import { localToolShut } from "../src/lib/localTool.ts";
import { EXPERIMENTS } from "../src/lib/experiments.ts";

/**
 * **The local-tool door** (exact phase 2; `docs/projects/exact/design.md` §5):
 * a page on a hosted home never reaches this machine, the switch off means no
 * request at all, and a pairing code is a port and a one-use code.
 */
describe("the local-tool door", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("opens only on a home that is itself on this machine", () => {
    expect(loopbackOrigin("http://127.0.0.1:4443/p/prj_1")).toBe(true);
    expect(loopbackOrigin("http://localhost:4443/")).toBe(true);
    expect(loopbackOrigin("http://[::1]:4443/")).toBe(true);
    expect(loopbackOrigin("https://isocan.io/p/prj_1")).toBe(false);
    expect(loopbackOrigin("https://dev.isocan.io/")).toBe(false);
    expect(loopbackOrigin("http://127.0.0.1.evil.example/")).toBe(false);
    expect(loopbackOrigin("file:///tmp/x.html")).toBe(false);
    const on = ["exact", "exact.local"];
    expect(localToolShut("exact", "https://isocan.io/p/prj_1", on)).toMatch(/home is on this machine/);
    expect(localToolShut("exact", "http://127.0.0.1:4443/p/prj_1", on)).toBeNull();
  });

  it("is shut with the switch off, and then asks the network nothing", async () => {
    expect(localToolShut("exact", "http://127.0.0.1:4443/", ["exact"])).toMatch(/Live frames are off/);
    expect(localToolShut("exact", "http://127.0.0.1:4443/", [])).toMatch(/experiment is off/);
    // A door handed out while shut refuses before fetch is ever called.
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("location", { href: "https://isocan.io/p/prj_1" });
    const { localToolDoor } = await import("../src/lib/localTool.ts");
    const door = localToolDoor("exact");
    expect(door.shut).not.toBeNull();
    expect(door.paired()).toEqual([]);
    expect(door.frameUrl(47811, "/")).toBeNull();
    await expect(door.fetch(47811, "/hello")).rejects.toThrow();
    await expect(door.pair("47811-K3M9Q-7XW2P")).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reads the code the bridge prints: its port, then a one-use code", () => {
    expect(parseLocalToolCode("47811-K3M9Q-7XW2P")).toEqual({ port: 47811, code: "K3M9Q-7XW2P" });
    expect(parseLocalToolCode(" 47811 k3m9q7xw2p ")).toEqual({ port: 47811, code: "K3M9Q-7XW2P" });
    expect(parseLocalToolCode("K3M9Q-7XW2P")).toBeNull();
    expect(parseLocalToolCode("80-K3M9Q-7XW2P")).toBeNull();
  });

  it("is the experiment Settings calls Live frames, under Exact, ticked along with it", () => {
    const live = EXPERIMENTS.find((e) => e.id === "exact.local");
    expect(live?.name).toBe("Live frames");
    expect(live?.under).toBe("exact");
    expect(live?.withParent).toBe(true);
    const menu = readFileSync(fileURLToPath(new URL("../src/components/IdentityMenu.tsx", import.meta.url)), "utf8");
    expect(menu).toMatch(/child\.under === entry\.id && child\.withParent/);
  });

  it("keeps the token in this browser, never in an op: the door writes no operation", () => {
    const src = readFileSync(fileURLToPath(new URL("../src/lib/localTool.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/sendOp|sendEchoed|"item\.|"thread\./);
    expect(src).toMatch(/http:\/\/\$\{LOOPBACK\}:/);
  });
});
