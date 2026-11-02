import { recapHeadRoute, sourcePolicyHeader, SOURCE_POLICY_HEADER, type RecapHeadResponse, type SourceClassificationRequest } from "@isocan/core";
import { request } from "./api.ts";

/** Recent work belongs to the lazy Context view, with exclusion retained through door recovery. */
export function sourceRecap(source: SourceClassificationRequest, signal?: AbortSignal): Promise<RecapHeadResponse> {
  const headers = { [SOURCE_POLICY_HEADER]: sourcePolicyHeader({ policy: { mode: "exclude" }, expectedHome: source.expectedHome }) };
  return request("GET", recapHeadRoute(source.canvasId), undefined, signal, "identity", headers);
}
