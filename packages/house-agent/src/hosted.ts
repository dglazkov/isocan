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

/**
 * **Hosted custody contract** (Open Stitch Phase 2B, `durable-agents`).
 *
 * Clean interface for a home-owned runner (`summon`, `status`, `release`) with
 * a per-canvas turn and token budget guard. Zero cloud resources are
 * provisioned here; `createInMemoryHostedHouseRunner` provides the local
 * budget-enforcing implementation for tests and future Cloud Run / sidecar
 * custody.
 */

import { describeFailure, type PlainFailure } from "@isocan/core";

/** What woke a hosted house-agent turn. */
export interface HostedHouseTrigger {
  threadId: string;
  commentId?: string | undefined;
  prompt: string;
  actorId?: string | undefined;
  estimatedTokens?: number | undefined;
}

/** Per-canvas turn and token budget limits. */
export interface HostedBudgetLimits {
  maxTurns: number;
  maxTokens: number;
}

/** Live custody state and budget usage for one canvas. */
export interface HostedHouseStatus {
  canvasId: string;
  state: "idle" | "running" | "released" | "budget-exceeded";
  turnsUsed: number;
  tokensUsed: number;
  maxTurns: number;
  maxTokens: number;
  lastTriggerAt?: string | undefined;
}

/** Result of summoning the hosted house runner for one canvas turn. */
export type HostedSummonResult =
  | { status: "completed"; turnsUsed: number; tokensUsed: number }
  | { status: "budget-exceeded"; failure: PlainFailure; turnsUsed: number; tokensUsed: number };

/**
 * Contract for hosted house-agent custody (summoned by comment or mention,
 * holding a session the way `rc` holds one, with per-canvas budget guards).
 */
export interface HostedHouseRunner {
  summon(canvasId: string, trigger: HostedHouseTrigger): Promise<HostedSummonResult>;
  status(canvasId: string): Promise<HostedHouseStatus>;
  release(canvasId: string): Promise<{ released: boolean }>;
}

export const DEFAULT_HOSTED_BUDGET: HostedBudgetLimits = {
  maxTurns: 25,
  maxTokens: 200_000,
};

export interface InMemoryHostedRunnerOptions {
  budget?: Partial<HostedBudgetLimits> | undefined;
  onSummon?: (canvasId: string, trigger: HostedHouseTrigger) => Promise<{ tokensUsed?: number } | void>;
}

/**
 * Reference `HostedHouseRunner` that enforces per-canvas turn and token
 * budgets without provisioning any cloud resources.
 */
export function createInMemoryHostedHouseRunner(
  options: InMemoryHostedRunnerOptions = {},
): HostedHouseRunner {
  const maxTurns = options.budget?.maxTurns ?? DEFAULT_HOSTED_BUDGET.maxTurns;
  const maxTokens = options.budget?.maxTokens ?? DEFAULT_HOSTED_BUDGET.maxTokens;
  const records = new Map<string, HostedHouseStatus>();

  function getOrCreate(canvasId: string): HostedHouseStatus {
    let rec = records.get(canvasId);
    if (!rec) {
      rec = {
        canvasId,
        state: "idle",
        turnsUsed: 0,
        tokensUsed: 0,
        maxTurns,
        maxTokens,
      };
      records.set(canvasId, rec);
    }
    return rec;
  }

  return {
    async summon(canvasId: string, trigger: HostedHouseTrigger): Promise<HostedSummonResult> {
      const rec = getOrCreate(canvasId);
      const projectedTokens = rec.tokensUsed + (trigger.estimatedTokens ?? 0);
      if (rec.turnsUsed >= rec.maxTurns || projectedTokens > rec.maxTokens) {
        rec.state = "budget-exceeded";
        return {
          status: "budget-exceeded",
          failure: describeFailure({
            kind: "quota",
            code: "hosted-budget-exceeded",
            message:
              rec.turnsUsed >= rec.maxTurns
                ? `Hosted house-agent turn budget reached (${rec.turnsUsed}/${rec.maxTurns} turns) for canvas ${canvasId}.`
                : `Hosted house-agent token budget reached (${projectedTokens}/${rec.maxTokens} tokens) for canvas ${canvasId}.`,
          }),
          turnsUsed: rec.turnsUsed,
          tokensUsed: rec.tokensUsed,
        };
      }

      rec.state = "running";
      rec.lastTriggerAt = new Date().toISOString();
      try {
        const result = await options.onSummon?.(canvasId, trigger);
        rec.turnsUsed += 1;
        rec.tokensUsed += result?.tokensUsed ?? trigger.estimatedTokens ?? 0;
        rec.state = "idle";
        return {
          status: "completed",
          turnsUsed: rec.turnsUsed,
          tokensUsed: rec.tokensUsed,
        };
      } catch (err) {
        rec.state = "idle";
        throw err;
      }
    },

    async status(canvasId: string): Promise<HostedHouseStatus> {
      return { ...getOrCreate(canvasId) };
    },

    async release(canvasId: string): Promise<{ released: boolean }> {
      const existing = records.get(canvasId);
      if (!existing) return { released: false };
      existing.state = "released";
      return { released: true };
    },
  };
}
