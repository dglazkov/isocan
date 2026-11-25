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

import { describe, expect, it } from "vitest";
import { detectDevServerUrls } from "../src/session-driver.ts";
import {
  OPEN_NODE_MAX_EDGES,
  OPEN_NODE_MAX_NODES,
  OPEN_NODE_MAX_PATCHES,
  TRUSTED_WORKBENCH_PRODUCER,
  parseOpenNodeSpec,
} from "../src/open-node-spec.ts";

describe("detectDevServerUrls", () => {
  it("extracts localhost and 127.0.0.1 URLs and ignores non-UI ports", () => {
    const out = [
      "RPC listening on http://127.0.0.1:5387",
      "Bridge ready at http://localhost:4441/health",
      "VITE v6.0.0  ready in 140 ms",
      "  ➜  Local:   http://localhost:5173/",
      "  ➜  API:     http://127.0.0.1:3000/app",
      "Duplicate: http://localhost:5173/",
    ].join("\n");

    expect(detectDevServerUrls(out)).toEqual([
      { url: "http://localhost:5173", port: 5173, host: "localhost" },
      { url: "http://127.0.0.1:3000/app", port: 3000, host: "127.0.0.1" },
    ]);
  });
});

describe("parseOpenNodeSpec", () => {
  it("accepts v1 and v2 envelopes and strips terminal.command for untrusted producers", () => {
    const parsed = parseOpenNodeSpec({
      $schema: "openstitch.node.v2",
      upsertBySourceRef: true,
      nodes: [
        { id: "n1", kind: "markdown", title: "Plan", content: "# Hello", sourceRef: "plan-1" },
        { id: "n2", kind: "terminal", title: "Shell", command: "rm -rf /tmp/test" },
      ],
      edges: [{ from: "n1", to: "n2", label: "runs" }],
      patches: [{ target: "n1", title: "Updated Plan" }],
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.spec.nodes[1]?.command).toBeUndefined();
    expect(parsed.spec.upsertBySourceRef).toBe(true);
    expect(parsed.spec.edges).toHaveLength(1);
    expect(parsed.spec.patches).toHaveLength(1);
  });

  it("preserves terminal.command when trustedProducer is workbench_driver", () => {
    const parsed = parseOpenNodeSpec(
      {
        $schema: "openstitch.node.v1",
        nodes: [{ kind: "terminal", title: "Dev", command: "npm run dev" }],
      },
      { trustedProducer: TRUSTED_WORKBENCH_PRODUCER },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.spec.nodes[0]?.command).toBe("npm run dev");
  });

  it("rejects javascript: and file: URLs", () => {
    const js = parseOpenNodeSpec({
      $schema: "openstitch.node.v1",
      nodes: [{ kind: "site", url: "javascript:alert(1)" }],
    });
    expect(js.ok).toBe(false);

    const file = parseOpenNodeSpec({
      $schema: "openstitch.node.v1",
      nodes: [{ kind: "site", url: "file:///etc/passwd" }],
    });
    expect(file.ok).toBe(false);
  });

  it("enforces node, edge, and patch bounds", () => {
    const tooManyNodes = parseOpenNodeSpec({
      $schema: "openstitch.node.v1",
      nodes: Array.from({ length: OPEN_NODE_MAX_NODES + 1 }, () => ({ kind: "sticky", content: "x" })),
    });
    expect(tooManyNodes.ok).toBe(false);

    const tooManyEdges = parseOpenNodeSpec({
      $schema: "openstitch.node.v1",
      edges: Array.from({ length: OPEN_NODE_MAX_EDGES + 1 }, (_, i) => ({ from: `a${i}`, to: `b${i}` })),
    });
    expect(tooManyEdges.ok).toBe(false);

    const tooManyPatches = parseOpenNodeSpec({
      $schema: "openstitch.node.v1",
      patches: Array.from({ length: OPEN_NODE_MAX_PATCHES + 1 }, (_, i) => ({ target: `a${i}` })),
    });
    expect(tooManyPatches.ok).toBe(false);
  });
});
