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
import type { HouseGoalMeta } from "@isocan/core/house-agent";

export interface GoalStatusProps {
  goal: HouseGoalMeta;
}

/** Status pill for an agent's goal (`drafting`, `running`, `waiting`, `done`, `stalled`). */
export function GoalStatus({ goal }: GoalStatusProps) {
  return (
    <span className="house-goal-pill" data-state={goal.state} role="status">
      <span>{goal.state}</span>
      {goal.wave !== undefined && <span>· wave {goal.wave}</span>}
    </span>
  );
}

export interface ThoughtTraceProps {
  thoughts: readonly string[];
  defaultOpen?: boolean | undefined;
}

/** Collapsible thought trace rendered from `HouseCommentMeta.thoughtTrace`. */
export function ThoughtTrace({ thoughts, defaultOpen = false }: ThoughtTraceProps) {
  if (thoughts.length === 0) return null;
  return (
    <details className="house-thought-trace" open={defaultOpen}>
      <summary>Thought trace ({thoughts.length})</summary>
      <ul>
        {thoughts.map((line, idx) => (
          <li key={idx}>{line}</li>
        ))}
      </ul>
    </details>
  );
}

export default ThoughtTrace;
