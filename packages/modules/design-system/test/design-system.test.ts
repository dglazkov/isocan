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
import { promises as fs } from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import {
  CLIENT_FEATURES_HEADER,
  CURRENT_CLIENT_FEATURES,
  askTheDoor,
  bearerHeader,
  newCanvasId,
  type Actor,
  type StoredBadge,
} from "@isocan/core";
import { CREDENTIAL_REF_PROP } from "@isocan/core/keys";
import { modelFor } from "@isocan/core/models";
import { startDaemon, type Daemon } from "../../../server/src/daemon.ts";
import {
  DESIGN_CRITIQUE_ROUTE,
  DESIGN_MOCKUPS_ROUTE,
  DESIGN_PROPS,
  DESIGN_SYSTEM_MIME,
  DESIGN_SYSTEM_ROUTE,
  compileDesignMd,
  designSystemModule,
  parseDesignSystemSpec,
  type DesignCritiqueResponse,
  type DesignMockupsResponse,
  type DesignSystemResponse,
  type DesignSystemSpec,
} from "../src/core.ts";

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanup.length > 0) {
    await cleanup.pop()!();
  }
});

async function mkHome(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-design-system-test-"));
  cleanup.push(() => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return dir;
}

function daemonBase(d: Daemon): string {
  return `http://127.0.0.1:${(d.app.server.address() as AddressInfo).port}`;
}

async function boot(home: string, opts: Parameters<typeof startDaemon>[0] = {}): Promise<Daemon> {
  const d = await startDaemon({
    home,
    port: 0,
    contentPort: "off",
    gcIntervalMs: 0,
    blobCheckIntervalMs: 0,
    ...opts,
  });
  cleanup.push(() => d.close());
  return d;
}

function authHeaders(badge: StoredBadge): Record<string, string> {
  return {
    ...bearerHeader(badge),
    [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES,
    "Content-Type": "application/json",
  };
}

async function mintEditor(base: string, sessionKey = "test:acme-ds"): Promise<{ badge: StoredBadge; actor: Actor }> {
  const knocked = await askTheDoor(base);
  if (!("badge" in knocked)) throw new Error(`door refused: ${knocked.refused.error}`);
  const claimRes = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(knocked.badge),
    body: JSON.stringify({
      canvasId: null,
      actor: { id: "", name: "Acme Designer" },
      op: { type: "actor.claim", sessionKey, name: "Acme Designer" },
    }),
  });
  expect(claimRes.status).toBe(200);
  const claimed = (await claimRes.json()) as { envelope: { actor: Actor } };
  return { badge: knocked.badge, actor: claimed.envelope.actor };
}

async function createCanvas(base: string, badge: StoredBadge, actor: Actor): Promise<string> {
  const canvasId = newCanvasId();
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(badge),
    body: JSON.stringify({
      canvasId: null,
      actor,
      op: { type: "project.create", canvasId, title: "Acme Design System Canvas" },
    }),
  });
  expect(res.status).toBe(200);
  return canvasId;
}

describe("@isocan/design-system core", () => {
  it("compiles a DesignSystemSpec to clean DESIGN.md markdown and parses specs safely", () => {
    const spec: DesignSystemSpec = {
      name: "Acme Editorial",
      summary: "Warm print-inspired system for Acme products.",
      palette: [
        { name: "Ink", hex: "#141414", usage: "Primary text" },
        { name: "Paper", hex: "#FAF7F2", usage: "Page background" },
      ],
      typography: [
        { role: "Display", family: "Fraunces, serif", size: "36px", weight: "700" },
        { role: "Body", family: "Inter, sans-serif", size: "15px", weight: "400" },
      ],
      spacing: ["4px", "8px", "16px", "32px"],
      radii: ["4px", "12px"],
      principles: ["Let typography lead", "Keep contrast >= 7:1"],
    };

    const md = compileDesignMd(spec);
    expect(md).toContain("# Acme Editorial");
    expect(md).toContain("| Ink | `#141414` | Primary text |");
    expect(md).toContain("| Display | Fraunces, serif | 36px | 700 |");
    expect(md).toContain("## Spacing Scale");
    expect(md).toContain("- Let typography lead");

    expect(parseDesignSystemSpec(JSON.stringify(spec))).toEqual(spec);
    expect(parseDesignSystemSpec("not-json")).toBeNull();
  });
});

describe("@isocan/design-system server routes", () => {
  it("generates system + DESIGN.md, critiques an item with parent provenance, and generates direction mockups", async () => {
    const home = await mkHome();
    const FAKE_KEY = "acme-ds-secret-key-999";
    const expectedModel = modelFor("utility").id;
    let callIndex = 0;

    const fakeFetch: typeof fetch = async () => {
      callIndex++;
      let text: string;
      if (callIndex === 1) {
        text = JSON.stringify({
          name: "Acme Daylight",
          summary: "Clean sunlit interface tokens for Acme.",
          palette: [
            { name: "Cobalt", hex: "#1D4ED8", usage: "Primary actions" },
            { name: "Sand", hex: "#FDFBF7", usage: "Surface" },
          ],
          typography: [{ role: "Title", family: "Inter", size: "24px", weight: "600" }],
          spacing: ["8px", "16px", "24px"],
          principles: ["Calm clarity"],
        });
      } else if (callIndex === 2) {
        text = "## Summary\nStrong hierarchy.\n\n## Concrete Fixes\n- Increase button padding to 12px.";
      } else {
        text = JSON.stringify({
          directions: [
            { title: "Acme Daylight — Editorial", html: "<!doctype html><html><body><h1>Editorial</h1></body></html>" },
            { title: "Acme Daylight — Compact", html: "<!doctype html><html><body><h1>Compact</h1></body></html>" },
            { title: "Acme Daylight — Bold", html: "<!doctype html><html><body><h1>Bold</h1></body></html>" },
          ],
        });
      }
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const daemon = await boot(home, {
      modules: {
        "design-system": { key: () => FAKE_KEY, fetch: fakeFetch },
      },
    });
    const base = daemonBase(daemon);
    const editor = await mintEditor(base);
    const canvasId = await createCanvas(base, editor.badge, editor.actor);

    // 1. POST /api/m/design-system/system
    const sysRes = await fetch(`${base}${DESIGN_SYSTEM_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge),
      body: JSON.stringify({ canvasId, prompt: "Sunlit editorial dashboard for Acme", actor: editor.actor }),
    });
    expect(sysRes.status).toBe(200);
    const sys = (await sysRes.json()) as DesignSystemResponse;
    expect(sys.model).toBe(expectedModel);
    expect(sys.credentialRef).toBe("env:gemini");
    expect(sys.designMd).toContain("# Acme Daylight");

    const snap1 = await daemon.engine.getSnapshot(canvasId);
    const sysItem = snap1.canvas.items[sys.systemItemId]!;
    const mdItem = snap1.canvas.items[sys.designMdItemId]!;
    expect(sysItem.versions[0]!.mimeType).toBe(DESIGN_SYSTEM_MIME);
    expect(sysItem.properties[DESIGN_PROPS.role]).toBe("system");
    expect(sysItem.properties[CREDENTIAL_REF_PROP]).toBe("env:gemini");
    expect(mdItem.properties.parent).toBe(sys.systemItemId);
    expect(designSystemModule.contextPieces?.(snap1.canvas)[0]?.size).toContain("Acme Daylight");

    // 2. POST /api/m/design-system/critique
    const critRes = await fetch(`${base}${DESIGN_CRITIQUE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge),
      body: JSON.stringify({
        canvasId,
        itemId: sys.designMdItemId,
        systemItemId: sys.systemItemId,
        actor: editor.actor,
      }),
    });
    expect(critRes.status).toBe(200);
    const crit = (await critRes.json()) as DesignCritiqueResponse;
    expect(crit.targetItemId).toBe(sys.designMdItemId);
    expect(crit.critique).toContain("Increase button padding");

    const snap2 = await daemon.engine.getSnapshot(canvasId);
    expect(snap2.canvas.items[crit.reviewItemId]!.properties.parent).toBe(sys.designMdItemId);
    expect(snap2.canvas.items[crit.reviewItemId]!.properties[DESIGN_PROPS.role]).toBe("critique");

    // 3. POST /api/m/design-system/mockups
    const mockRes = await fetch(`${base}${DESIGN_MOCKUPS_ROUTE}`, {
      method: "POST",
      headers: authHeaders(editor.badge),
      body: JSON.stringify({
        canvasId,
        systemItemId: sys.systemItemId,
        count: 3,
        prompt: "Acme home screen",
        actor: editor.actor,
      }),
    });
    expect(mockRes.status).toBe(200);
    const mock = (await mockRes.json()) as DesignMockupsResponse;
    expect(mock.mockupItemIds).toHaveLength(3);

    const snap3 = await daemon.engine.getSnapshot(canvasId);
    for (const id of mock.mockupItemIds) {
      expect(snap3.canvas.items[id]!.properties.parent).toBe(sys.systemItemId);
      expect(snap3.canvas.items[id]!.properties[DESIGN_PROPS.role]).toBe("mockup");
    }
  });
});
