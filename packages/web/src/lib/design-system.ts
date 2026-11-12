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

import { SOURCE_POLICY_HEADER, sourcePolicyHeader, type Actor } from "@isocan/core";
import type { DesignSystemPort, DesignSystemSource } from "@isocan/api/design-system";
import { designAuditIO } from "./design-audit.ts";
import { authoritativeHome } from "./personal.ts";
import { getSnapshot, postOp, uploadBlob } from "./api.ts";
import { canEditNow } from "./capability.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";

const headers = (source: DesignSystemSource): Record<string, string> | undefined => source.mode === "inherited" ? { [SOURCE_POLICY_HEADER]: sourcePolicyHeader({ policy: { mode: "exclude" }, expectedHome: source.expectedHome }) } : undefined;

/** Direct edits retain caller authority; inherited edits reassert source policy on both actual writes. */
export function designSystemIO(actor: Actor): DesignSystemPort {
  const writable = () => { if (useCanvasStore.getState().past || !canEditNow()) throw new Error("Return to an editable current view before changing the design document."); };
  return {
    ...designAuditIO, actorId: actor.id, snapshot: getSnapshot, home: authoritativeHome,
    upload: async (source, text, filename, mimeType, signal) => { writable(); return uploadBlob(source.canvasId, new Blob([text], { type: mimeType }), filename, { headers: headers(source), signal }); },
    edit: async (source, operation, opId, signal) => { writable(); return postOp(source.canvasId, actor, operation, opId, undefined, undefined, undefined, { headers: headers(source), signal }); },
  };
}
