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
import type { Item } from "@isocan/core";
import { resolveNodeFocus } from "../src/lib/focusRegistry.ts";

function makeScreenItem(id: string, properties: Record<string, string> = {}): Item {
  const version = {
    id: `${id}_v1`,
    blobHash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    mimeType: "text/html",
    filename: "acme-screen.html",
    size: 512,
    createdAt: "2026-10-15T00:00:00.000Z",
    createdBy: { id: "u_test", name: "Test" },
  };
  return {
    id,
    title: "Acme Screen",
    description: "",
    x: 0,
    y: 0,
    width: 1280,
    height: 800,
    properties,
    reactions: {},
    versions: [version],
    currentVersionId: version.id,
    createdAt: "2026-10-15T00:00:00.000Z",
    createdBy: { id: "u_test", name: "Test" },
    updatedAt: "2026-10-15T00:00:00.000Z",
    updatedBy: { id: "u_test", name: "Test" },
  };
}

describe("Wireframe Focus shell dispatch (node-focus phase 5)", () => {
  it("resolves wireframe screens to module.wireframe (priority 20) and skips prototype items", () => {
    const wire = makeScreenItem("it_wire", { fidelity: "wireframe" });
    const facet = resolveNodeFocus(wire);
    expect(facet?.id).toBe("module.wireframe");
    expect(facet?.priority).toBe(20);

    const proto = makeScreenItem("it_proto", {
      fidelity: "wireframe",
      wirePrototype: "flow_acme",
    });
    expect(resolveNodeFocus(proto)?.id).toBe("builtin.screen");
  });

  it("falls back cleanly to builtin.screen when fidelity is absent", () => {
    const plain = makeScreenItem("it_plain", {});
    expect(resolveNodeFocus(plain)?.id).toBe("builtin.screen");
  });
});
