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

import type { ModuleRequest, ModuleResponse, ServerHost, ServerModule } from "@isocan/core";
import {
  LIVE_TOKEN_BAD_REQUEST,
  LIVE_TOKEN_ENDPOINT,
  LIVE_TOKEN_OWNER_ONLY,
  LIVE_TOKEN_RATE_LIMITED,
  LIVE_TOKEN_UNAVAILABLE,
  LIVE_TOKEN_UPSTREAM,
  type LiveTokenResponse,
} from "@isocan/core/keys";

/**
 * **Talk's server half: `POST /api/m/talk/token`** — a short-lived Gemini
 * Live token, minted with the home's key (keys phase 4; the module's own
 * route since Open Stitch phase 0.1, 19 Nov 2026 — it was
 * `packages/server/src/live-token.ts` and a block of `model-routes.ts`). The
 * dialog asks once per session and opens the Live socket with what comes
 * back, so the browser never holds a key.
 *
 * Google's ephemeral tokens (Live API, `v1alpha`): `POST
 * /v1alpha/auth_tokens` with the key in `x-goog-api-key` answers
 * `{ name: "auth_tokens/…" }`, which a browser presents as `access_token` on
 * the `BidiGenerateContentConstrained` socket. Minted with `uses: 1`, a
 * minute to start the session and half an hour for it to run — a token that
 * leaks is one conversation, not a key. The wire shape is the one
 * `@google/genai`'s `tokens.create` sends (read from its 2.x source on 2 Oct
 * 2026), spelled by hand so the home takes no SDK for one POST.
 *
 * The door — the canvas named and editable, whose key it is, the badge's
 * rate — is the home's, run before this is called. The key is scrubbed from
 * every word this sends back.
 */

/** A session per press: a handful a minute is a person reconnecting, more is a loop. */
const LIVE_TOKENS_PER_MINUTE = 6;
/** How long a token has to START its session. */
const NEW_SESSION_MS = 60_000;
/** How long a session started with it may run. */
const SESSION_MS = 30 * 60_000;

async function mint(_req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const key = await host.keyFor("gemini");
  if (!key) throw new Error("the voice token route has no key");
  const scrub = (text: string) => text.split(key).join("[key]");
  const now = host.now();
  const expireTime = new Date(now + SESSION_MS).toISOString();
  const newSessionExpireTime = new Date(now + NEW_SESSION_MS).toISOString();
  try {
    const res = await host.fetch(LIVE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ uses: 1, expireTime, newSessionExpireTime }),
    });
    const text = await res.text();
    if (!res.ok) {
      let said = text.slice(0, 300);
      try {
        said = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? said;
      } catch {
        // not JSON: the first words of it
      }
      return { status: 502, body: { error: scrub(`Google would not mint a voice token (${res.status}): ${said}`), code: LIVE_TOKEN_UPSTREAM } };
    }
    const name = (JSON.parse(text) as { name?: unknown }).name;
    if (typeof name !== "string" || !name || name.includes(key)) {
      return { status: 502, body: { error: "Google answered without a token", code: LIVE_TOKEN_UPSTREAM } };
    }
    return { status: 200, body: { token: name, expireTime, newSessionExpireTime } satisfies LiveTokenResponse };
  } catch (error) {
    return { status: 502, body: { error: scrub(`Google could not be reached for a voice token: ${(error as Error).message}`), code: LIVE_TOKEN_UPSTREAM } };
  }
}

export const talkServer: ServerModule = {
  name: "@isocan/talk",
  routes: [
    {
      method: "POST",
      path: "token",
      spend: "owner",
      provider: "gemini",
      rate: { perMinute: LIVE_TOKENS_PER_MINUTE },
      bodyLimit: 4096,
      says: {
        badRequest: { code: LIVE_TOKEN_BAD_REQUEST, error: "a voice token names the canvas it is for (`canvasId`)" },
        ownerOnly: LIVE_TOKEN_OWNER_ONLY,
        unavailable: { code: LIVE_TOKEN_UNAVAILABLE, error: "this home has no Gemini key — voice can't start here (`isocan keys set gemini`, or Model keys…, on the machine that holds this canvas)" },
        rateLimited: { code: LIVE_TOKEN_RATE_LIMITED, error: "this badge has started enough voice sessions this minute — wait a moment and press again" },
      },
      handler: mint,
    },
  ],
};

export default talkServer;
