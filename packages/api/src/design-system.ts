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
import { normalizeHomeUrl } from "@isocan/core";
import type { DesignSystemPort, DesignSystemSource } from "./design-system-reader.ts";

/** Node keeps the original source authority on upload and conditional edit, including inherited systems. */
export function designSystemPort(ctx: Ctx): DesignSystemPort {
  const sourceClient = async (source: DesignSystemSource, signal?: AbortSignal) => {
    if (source.mode === "inherited") return automaticSourceClient(ctx, source.expectedHome, signal);
    if (normalizeHomeUrl(await contextHome(ctx, source.canvasId)) !== normalizeHomeUrl(source.expectedHome)) throw new Error("The direct source authority changed.");
    return ctx.client;
  };
  return {
    ...designAuditPort(ctx),
    get actorId() { return ctx.actor.id; },
    snapshot: (id, signal) => ctx.client.snapshot(id, signal),
    home: id => contextHome(ctx, id),
    upload: async (source, text, filename, mimeType, signal) => (await sourceClient(source, signal)).uploadBlob(source.canvasId, Buffer.from(text), mimeType, filename, signal),
    edit: async (source, operation, opId, signal) => {
      const client = await sourceClient(source, signal);
      // This snapshot also gives the transport its actual group mode before mutation.
      await client.snapshot(source.canvasId, signal);
      return client.sendOp(source.canvasId, ctx.actor, operation, undefined, undefined, undefined, undefined, undefined, opId);
    },
  };
}
