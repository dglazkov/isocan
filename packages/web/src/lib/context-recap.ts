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

import { recapHeadRoute, sourcePolicyHeader, SOURCE_POLICY_HEADER, type RecapHeadResponse, type SourceClassificationRequest } from "@isocan/core";
import { request } from "./api.ts";

/** Recent work belongs to the lazy Context view, with exclusion retained through door recovery. */
export function sourceRecap(source: SourceClassificationRequest, signal?: AbortSignal): Promise<RecapHeadResponse> {
  const headers = { [SOURCE_POLICY_HEADER]: sourcePolicyHeader({ policy: { mode: "exclude" }, expectedHome: source.expectedHome }) };
  return request("GET", recapHeadRoute(source.canvasId), undefined, signal, "identity", headers);
}
