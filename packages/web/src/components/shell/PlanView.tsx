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

import "./HouseMeta.css";
import {
  parseHouseMeta,
  type HouseCommentMeta,
  type HousePlanMeta,
  type HousePlanStepState,
} from "@isocan/core/house-agent";
import { GoalStatus, ThoughtTrace } from "./ThoughtTrace.tsx";

const STEP_GLYPH: Record<HousePlanStepState, string> = {
  pending: "○",
  active: "◐",
  done: "✓",
  failed: "✕",
};

export interface PlanViewProps {
  plan: HousePlanMeta;
}

/** Structured plan step list rendered from `HouseCommentMeta.plan`. */
export function PlanView({ plan }: PlanViewProps) {
  return (
    <section className="house-plan-view" aria-label={plan.title}>
      <div className="house-plan-head">
        <span>{plan.title}</span>
      </div>
      <ol className="house-plan-steps">
        {plan.steps.map((step) => (
          <li
            key={step.id}
            className="house-plan-step"
            data-state={step.state}
          >
            <span aria-hidden="true">{STEP_GLYPH[step.state]}</span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Lazy renderer for all `HouseCommentMeta` fields parsed from a comment body. */
export function HouseCommentMetaView({
  body,
  meta: explicitMeta,
}: {
  body?: string | undefined;
  meta?: HouseCommentMeta | null | undefined;
}) {
  const meta = explicitMeta ?? (body ? parseHouseMeta(body).meta : null);
  if (!meta) return null;
  return (
    <div className="house-meta-wrap">
      {meta.goal && <GoalStatus goal={meta.goal} />}
      {meta.thoughtTrace && meta.thoughtTrace.length > 0 && (
        <ThoughtTrace thoughts={meta.thoughtTrace} />
      )}
      {meta.plan && <PlanView plan={meta.plan} />}
    </div>
  );
}

export default PlanView;
