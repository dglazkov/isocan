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
import { describe, expect, it } from "vitest";
import { relayArgs } from "../src/cli-run.ts";
import { CAPTURED_ONLY, parseRelayCode, wireRefusal } from "../src/relay.ts";

describe("a teammate's code through the relay (exact phase 8)", () => {
  it("reads the wire's relay name and Tamber's code as the bridge prints them", () => {
    expect(parseRelayCode("https://2bfc6f1d264b-tool.acme.relay.localhost MYK0F-NHTFG")).toEqual({ tool: "https://2bfc6f1d264b-tool.acme.relay.localhost", code: "MYK0F-NHTFG" });
    expect(parseRelayCode("  https://ab12-tool.acme.relay.example.com/  myk0fnhtfg ")).toEqual({ tool: "https://ab12-tool.acme.relay.example.com", code: "MYK0F-NHTFG" });
  });

  it("takes only a tool name over https: a canvas name, plain http, a path or a bridge's own code is not one", () => {
    expect(parseRelayCode("https://ab12-canvas.acme.relay.localhost MYK0F-NHTFG")).toBeNull();
    expect(parseRelayCode("http://ab12-tool.acme.relay.localhost MYK0F-NHTFG")).toBeNull();
    expect(parseRelayCode("https://ab12-tool.acme.relay.localhost/x MYK0F-NHTFG")).toBeNull();
    expect(parseRelayCode("47811-K3M9Q-7XW2P")).toBeNull();
  });

  it("quotes the wire's refusal in its own words", () => {
    expect(wireRefusal(403, JSON.stringify({ error: { message: "scrub needs `write` scope; this client has `read`", scope: "read", needs: "write" } })))
      .toBe("refused on Tamber's wire (403): scrub needs `write` scope; this client has `read`");
    expect(wireRefusal(502, "bad gateway")).toBe("refused on Tamber's wire (502): bad gateway");
  });

  it("says captured only in one sentence", () => {
    expect((CAPTURED_ONLY.match(/[.!?](\s|$)/g) ?? []).length).toBe(1);
  });

  it("names the relay in the environment, so `isocan exact live`'s startup does not grow", () => {
    expect(relayArgs({})).toEqual([]);
    expect(relayArgs({ ISOCAN_EXACT_RELAY: "relay.localhost:8453", ISOCAN_EXACT_RELAY_ACCOUNT: "acme" })).toEqual(["--relay", "relay.localhost:8453", "--relay-account", "acme"]);
    expect(relayArgs({ ISOCAN_EXACT_RELAY: "r.example", ISOCAN_EXACT_RELAY_ACCOUNT: "acme", ISOCAN_EXACT_RELAY_CERT: "/c.pem", ISOCAN_EXACT_RELAY_KEY: "/k.pem" })).toEqual(["--relay", "r.example", "--relay-account", "acme", "--relay-cert", "/c.pem", "--relay-key", "/k.pem"]);
    expect(() => relayArgs({ ISOCAN_EXACT_RELAY: "r.example" })).toThrow(/ACCOUNT/);
    expect(() => relayArgs({ ISOCAN_EXACT_RELAY: "r.example", ISOCAN_EXACT_RELAY_ACCOUNT: "acme", ISOCAN_EXACT_RELAY_CERT: "/c.pem" })).toThrow(/go together/);
  });

  it("mints the teammate's code at read, and hands the dev loop the sandboxed client's door (scripts/exact-live.mjs)", () => {
    const live = readFileSync(new URL("../../../../scripts/exact-live.mjs", import.meta.url), "utf8");
    expect(live).toContain('method: "pair-code", scope: "read", name: "teammate"');
    expect(live).toContain('"--allow-plugin-origin"');
    expect(live).not.toMatch(/scope: "(propose|write)", name: "teammate"/);
  });
});
