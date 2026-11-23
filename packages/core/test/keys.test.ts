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

import { describe, expect, it } from "vitest";
import {
  CREDENTIAL_REF_PROP,
  formatCredentialRef,
  parseCredentialRef,
  USER_KEYS_ROUTE,
} from "../src/keys.ts";

describe("credentialRef helpers (Open Stitch phase 0.3)", () => {
  it("exposes the canonical property name and per-user keys route", () => {
    expect(CREDENTIAL_REF_PROP).toBe("credentialRef");
    expect(USER_KEYS_ROUTE).toBe("/api/me/keys");
  });

  it("formats and parses env, home, and user credentialRefs cleanly", () => {
    const envRef = formatCredentialRef({ scope: "env", provider: "gemini" });
    expect(envRef).toBe("env:gemini");
    expect(parseCredentialRef(envRef)).toEqual({ scope: "env", provider: "gemini" });

    const homeRef = formatCredentialRef({ scope: "home", provider: "anthropic" });
    expect(homeRef).toBe("home:anthropic");
    expect(parseCredentialRef(homeRef)).toEqual({ scope: "home", provider: "anthropic" });

    const userRef = formatCredentialRef({ scope: "user", actorId: "usr_priya", provider: "gemini", version: 1 });
    expect(userRef).toBe("user:usr_priya:gemini:v1");
    expect(parseCredentialRef(userRef)).toEqual({ scope: "user", actorId: "usr_priya", provider: "gemini", version: 1 });

    const bumped = formatCredentialRef({ scope: "user", actorId: "usr_priya", provider: "openai", version: 12 });
    expect(bumped).toBe("user:usr_priya:openai:v12");
    expect(parseCredentialRef(bumped)).toEqual({ scope: "user", actorId: "usr_priya", provider: "openai", version: 12 });
  });

  it("round-trips user actorIds that contain colons (such as attested email attributes)", () => {
    const ref = formatCredentialRef({ scope: "user", actorId: "email:priya@acme.test", provider: "gemini", version: 3 });
    expect(ref).toBe("user:email:priya@acme.test:gemini:v3");
    expect(parseCredentialRef(ref)).toEqual({ scope: "user", actorId: "email:priya@acme.test", provider: "gemini", version: 3 });
  });

  it("rejects invalid parts on format and returns null for malformed refs on parse", () => {
    expect(() => formatCredentialRef({ scope: "env", provider: "unknown" as never })).toThrow(/unknown key provider/);
    expect(() => formatCredentialRef({ scope: "user", actorId: "  ", provider: "gemini", version: 1 })).toThrow(/actorId/);
    expect(() => formatCredentialRef({ scope: "user", actorId: "usr priya", provider: "gemini", version: 1 })).toThrow(/actorId/);
    expect(() => formatCredentialRef({ scope: "user", actorId: "usr_priya", provider: "gemini", version: 0 })).toThrow(/positive integer/);
    expect(() => formatCredentialRef({ scope: "user", actorId: "usr_priya", provider: "gemini", version: 1.5 })).toThrow(/positive integer/);

    for (const bad of [
      null,
      undefined,
      "",
      "env:",
      "env:unknown",
      "home:unknown",
      "user::gemini:v1",
      "user:usr_priya:unknown:v1",
      "user:usr_priya:gemini:v0",
      "user:usr_priya:gemini:1",
      "user:usr priya:gemini:v1",
      "other:gemini",
    ]) {
      expect(parseCredentialRef(bad), String(bad)).toBeNull();
    }
  });
});
