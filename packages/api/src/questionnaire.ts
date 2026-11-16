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
import { contextHome } from "./context-summary.ts";
import { questionnaireFailureStatus, type QuestionnairePort, type QuestionnaireReferencePort } from "./questionnaire-reader.ts";

/** The existing authority-bearing client remains the only Node transport. */
export function questionnairePort(ctx: Ctx): QuestionnairePort & QuestionnaireReferencePort {
  return {
    get actorId() { return ctx.actor.id; },
    snapshot: (id, signal) => ctx.client.snapshot(id, signal),
    home: (id) => contextHome(ctx, id),
    blobBytes: (id, hash, signal) => ctx.client.downloadBlob(id, hash, signal),
    send: async (id, op, options) => {
      try {
        options.signal?.throwIfAborted();
        const receipt = await ctx.client.questionnaire(id, ctx.actor, op, options.opId);
        return { status: "accepted", receipt };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return { status: questionnaireFailureStatus(error), reason };
      }
    },
  };
}
