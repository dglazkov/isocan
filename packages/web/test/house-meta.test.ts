// @vitest-environment jsdom

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

import { afterEach, describe, expect, it } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { encodeHouseMeta, type HouseCommentMeta } from "@isocan/core/house-agent";
import { HouseCommentMetaView, PlanView } from "../src/components/shell/PlanView.tsx";
import { ThoughtTrace } from "../src/components/shell/ThoughtTrace.tsx";

const roots: Array<{ root: Root; el: HTMLElement }> = [];

afterEach(async () => {
  while (roots.length > 0) {
    const { root, el } = roots.pop()!;
    await act(async () => {
      root.unmount();
    });
    el.remove();
  }
});

async function mount(node: React.ReactElement): Promise<HTMLElement> {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  roots.push({ root, el });
  await act(async () => {
    root.render(node);
  });
  return el;
}

describe("HouseMeta lazy renderers", () => {
  it("renders ThoughtTrace and PlanView from encoded comment metadata", async () => {
    const meta: HouseCommentMeta = {
      thoughtTrace: ["Read context graph", "Selected free region"],
      plan: {
        title: "Build hero section",
        steps: [
          { id: "1", label: "Read canvas", state: "done" },
          { id: "2", label: "Add hero card", state: "active" },
          { id: "3", label: "Verify layout", state: "pending" },
        ],
      },
      goal: { state: "running", wave: 2 },
    };

    const body = encodeHouseMeta("I added the hero card.", meta);
    const el = await mount(h(HouseCommentMetaView, { body }));

    expect(el.querySelector(".house-goal-pill")?.getAttribute("data-state")).toBe("running");
    expect(el.textContent).toContain("wave 2");
    expect(el.textContent).toContain("Thought trace (2)");
    expect(el.textContent).toContain("Read context graph");
    expect(el.textContent).toContain("Build hero section");

    const steps = Array.from(el.querySelectorAll(".house-plan-step"));
    expect(steps).toHaveLength(3);
    expect(steps.map((s) => s.getAttribute("data-state"))).toEqual([
      "done",
      "active",
      "pending",
    ]);
  });

  it("renders standalone ThoughtTrace and PlanView components", async () => {
    const traceEl = await mount(
      h(ThoughtTrace, { thoughts: ["Step A", "Step B"], defaultOpen: true }),
    );
    expect(traceEl.querySelector("details")?.hasAttribute("open")).toBe(true);
    expect(traceEl.textContent).toContain("Step A");

    const planEl = await mount(
      h(PlanView, {
        plan: {
          title: "Fix contrast",
          steps: [{ id: "f1", label: "Check tokens", state: "failed" }],
        },
      }),
    );
    expect(planEl.querySelector(".house-plan-step")?.getAttribute("data-state")).toBe("failed");
  });
});
