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

import type { Ctx } from "./ctx.ts";
import { automaticSourceClient, contextHome } from "./context-summary.ts";
import { designAuditPort } from "./design-audit.ts";
import { questionnaireFailureStatus } from "./questionnaire-reader.ts";
import type { DesignRequestReadPort, DesignRequestWritePort } from "./design-request-reader.ts";

/** Node keeps existing actor custody, home routing and source policy on every request read/write. */
export function designRequestPort(ctx: Ctx): DesignRequestReadPort & DesignRequestWritePort {
  return {
    ...designAuditPort(ctx),
    // Read-only discovery must remain available before an agent has named itself.
    get actorId() { try { return ctx.actor.id; } catch { return undefined; } },
    snapshot: (id, signal) => ctx.client.snapshot(id, signal),
    home: id => contextHome(ctx, id),
    requests: (id, signal) => ctx.client.designRequests(id, signal),
    decisions: (id, signal) => ctx.client.designDecisions(id, signal),
    decisionActors: id => ctx.client.questionnaireActors(id),
    blobBytes: (id, hash, signal) => ctx.client.downloadBlob(id, hash, signal),
    sourceBlobBytes: (source, hash, signal) => automaticSourceClient(ctx, source.expectedHome, signal).downloadBlob(source.canvasId, hash, signal),
    send: async (id, op, options) => {
      try {
        options.signal?.throwIfAborted();
        return { status: "accepted", receipt: await ctx.client.designRecord(id, ctx.actor, op, options.opId) };
      } catch (error) { return { status: questionnaireFailureStatus(error), reason: error instanceof Error ? error.message : String(error) }; }
    },
  };
}
