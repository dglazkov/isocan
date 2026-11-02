import { describe, expect, it } from "vitest";
import {
  applyOperation,
  DESIGN_SYSTEM_ROLE,
  nodeCapabilitiesFor,
  resolveToken,
  type CanvasState,
  type Item,
} from "@isocan/core";
import type { DesignProjection, DesignSystemPort } from "@isocan/api/design-system";
import {
  applyTokenStudioPatch,
  computeGovernedScreensMatrix,
  saveDesignStudioProjection,
} from "../src/components/DesignSystemFocus.tsx";
import { resolveNodeFocus } from "../src/lib/focusRegistry.ts";

const SAMPLE_DESIGN_MD = `---
name: Acme System
version: 1.0.0
description: Synthetic design system for Acme tests
surface: raised
colors:
  primary: "#1e3a8a"
  surface: "#ffffff"
  neutral: "#f8fafc"
  accent: "#2563eb"
typography:
  heading:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
spacing:
  sm: 8px
  md: 16px
  lg: 24px
rounded:
  sm: 4px
  md: 8px
components:
  button-primary:
    background: "{colors.primary}"
    color: "{colors.surface}"
    radius: "{rounded.md}"
---

## Overview

Acme's design language balances clarity and high contrast.
`;

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function makeDesignItem(blobHash: string): Item {
  const version = {
    id: "ver_ds_1",
    blobHash,
    mimeType: "text/markdown",
    filename: "DESIGN.md",
    size: SAMPLE_DESIGN_MD.length,
    createdAt: "2026-10-15T00:00:00.000Z",
    createdBy: { id: "usr_test", name: "Test" },
  };
  return {
    id: "itm_design_sys",
    title: "Acme Design System",
    description: "",
    x: 0,
    y: 0,
    width: 520,
    height: 680,
    properties: { role: DESIGN_SYSTEM_ROLE },
    reactions: {},
    versions: [version],
    currentVersionId: version.id,
    createdAt: version.createdAt,
    createdBy: version.createdBy,
    updatedAt: version.createdAt,
    updatedBy: version.createdBy,
  };
}

function makeScreenItem(id: string, title: string): Item {
  const version = {
    id: `ver_${id}`,
    blobHash: "c".repeat(64),
    mimeType: "text/html",
    filename: `${id}.html`,
    size: 512,
    createdAt: "2026-10-15T00:00:00.000Z",
    createdBy: { id: "usr_test", name: "Test" },
  };
  return {
    id,
    title,
    description: "",
    x: 600,
    y: 0,
    width: 1200,
    height: 800,
    properties: {},
    reactions: {},
    versions: [version],
    currentVersionId: version.id,
    createdAt: version.createdAt,
    createdBy: version.createdBy,
    updatedAt: version.createdAt,
    updatedBy: version.createdBy,
  };
}

describe("Phase 4 — Rich Design System Focus (DESIGN.md)", () => {
  it("resolves builtin.design-system with { view: true, edit: true, enter: false, file: true }", () => {
    const ds = makeDesignItem("a".repeat(64));
    expect(resolveNodeFocus(ds)?.id).toBe("builtin.design-system");
    expect(nodeCapabilitiesFor(ds)).toEqual({
      view: true,
      edit: true,
      enter: false,
      file: true,
    });
  });

  it("updates {colors.*} component references live when a color swatch changes", () => {
    const updated = applyTokenStudioPatch(SAMPLE_DESIGN_MD, {
      colors: {
        primary: "#0f766e",
        surface: "#ffffff",
        neutral: "#f8fafc",
        accent: "#0d9488",
      },
    });

    expect(updated.doc.tokens.colors?.primary).toBe("#0f766e");
    // Component button-primary references "{colors.primary}" and resolves live to the new swatch
    const btnBgRef = updated.doc.tokens.components?.["button-primary"]?.background ?? "";
    expect(btnBgRef).toBe("{colors.primary}");
    expect(resolveToken(updated.doc.tokens, btnBgRef)).toBe("#0f766e");
    expect(updated.findings.filter((f) => f.severity === "error")).toHaveLength(0);
  });

  it("surfaces live WCAG AA contrast warnings when primary ink fails contrast on ground", () => {
    const lowContrast = applyTokenStudioPatch(SAMPLE_DESIGN_MD, {
      colors: {
        primary: "#cbd5e1", // light slate on #f8fafc ground -> fails 4.5:1 body contrast
        surface: "#ffffff",
        neutral: "#f8fafc",
        accent: "#e2e8f0",
      },
    });

    const primaryError = lowContrast.findings.find((f) => f.where === "colors.primary");
    expect(primaryError).toBeDefined();
    expect(primaryError?.severity).toBe("error");
    expect(primaryError?.what).toContain("body text needs 4.5:1");
  });

  it("computes the Governed Screens Matrix across canvas screens", () => {
    const ds = makeDesignItem("a".repeat(64));
    const cleanScreen = makeScreenItem("itm_clean", "Acme Clean Dashboard");
    const driftedScreen = makeScreenItem("itm_drifted", "Acme Drifted Checkout");
    const parsed = applyTokenStudioPatch(SAMPLE_DESIGN_MD, {});

    const canvas = {
      items: {
        [ds.id]: ds,
        [cleanScreen.id]: cleanScreen,
        [driftedScreen.id]: driftedScreen,
      },
      trash: [],
      threads: {},
    };

    const matrix = computeGovernedScreensMatrix(canvas, ds, parsed.doc.tokens, {
      [cleanScreen.id]: `<!doctype html><html><head><style>:root { --primary: #1e3a8a; } body { color: var(--primary); padding: 16px; border-radius: 8px; font-size: 16px; }</style></head><body><h1>Acme</h1></body></html>`,
      [driftedScreen.id]: `<!doctype html><html><head><style>body { color: #ff00ff; padding: 13px; border-radius: 19px; font-size: 21px; }</style></head><body><h1>Drifted</h1></body></html>`,
    });

    expect(matrix).toHaveLength(2);
    const cleanRow = matrix.find((r) => r.itemId === cleanScreen.id)!;
    const driftedRow = matrix.find((r) => r.itemId === driftedScreen.id)!;

    expect(cleanRow.status).toBe("pass");
    expect(cleanRow.warningCount).toBe(0);

    expect(driftedRow.status).toBe("warnings");
    expect(driftedRow.warningCount).toBeGreaterThan(0);
    expect(driftedRow.offSystemCount).toBeGreaterThan(0);
  });

  it("preserves conditional projection identity (expectedVersionId, expectedMetadata, opId, versionId) on save", async () => {
    const actor = { id: "usr_test", name: "Test" };
    const baseHash = await sha256Hex(SAMPLE_DESIGN_MD);
    const ds = makeDesignItem(baseHash);

    let state: CanvasState = {
      project: {
        id: "prj_acme",
        title: "Acme Canvas",
        description: "",
        properties: {},
        createdAt: "2026-10-15T00:00:00.000Z",
        createdBy: actor,
        updatedAt: "2026-10-15T00:00:00.000Z",
        updatedBy: actor,
      },
      canvas: {
        items: { [ds.id]: ds },
        trash: [],
        threads: {},
      },
    };

    const blobs = new Map<string, string>([[baseHash, SAMPLE_DESIGN_MD]]);
    const recordedEdits: Array<{ opId: string; expectedVersionId: string; versionId: string }> = [];

    const io: DesignSystemPort = {
      actorId: actor.id,
      home: async () => "http://localhost:7100",
      snapshot: async () => ({
        project: state.project,
        canvas: state.canvas,
        lastSeq: recordedEdits.length,
        colors: {},
        names: {},
        capability: "edit",
      }),
      sourceSnapshot: async () => ({
        project: state.project,
        canvas: state.canvas,
        lastSeq: recordedEdits.length,
        colors: {},
        names: {},
        capability: "edit",
      }),
      blobText: async (_source, hash) => {
        const found = blobs.get(hash);
        if (!found) throw new Error(`Missing blob ${hash}`);
        return found;
      },
      sourceBlobText: async (_source, hash) => {
        const found = blobs.get(hash);
        if (!found) throw new Error(`Missing blob ${hash}`);
        return found;
      },
      classifySource: async () => ({ kind: "ordinary" }),
      upload: async (_source, text) => {
        const h = await sha256Hex(text);
        blobs.set(h, text);
        return { blobHash: h, size: new TextEncoder().encode(text).byteLength };
      },
      edit: async (_source, operation, opId) => {
        recordedEdits.push({
          opId,
          expectedVersionId: operation.expectedVersionId,
          versionId: operation.version.id,
        });
        const envelope = {
          id: opId,
          canvasId: "prj_acme",
          ts: "2026-10-15T00:05:00.000Z",
          actor,
          op: operation,
        };
        state = applyOperation(state, envelope)!;
        return { seq: recordedEdits.length, opId, envelope };
      },
    };

    const projection: DesignProjection = {
      schemaVersion: 1,
      kind: "design-projection",
      source: {
        home: "http://localhost:7100",
        canvasId: "prj_acme",
        itemId: ds.id,
        versionId: "ver_ds_1",
        blobHash: baseHash,
      },
      destination: {
        canvasId: "prj_acme",
        home: "http://localhost:7100",
        target: { kind: "canvas" },
      },
      expectedMetadata: {
        title: ds.title,
        properties: { ...ds.properties },
      },
      filename: "DESIGN.md",
      mimeType: "text/markdown",
      baseText: SAMPLE_DESIGN_MD,
      baseHash,
      exempt: false,
    };

    const edited = applyTokenStudioPatch(SAMPLE_DESIGN_MD, {
      colors: {
        primary: "#1d4ed8",
        surface: "#ffffff",
        neutral: "#f8fafc",
        accent: "#3b82f6",
      },
    });

    const result = await saveDesignStudioProjection(io, projection, edited.text, {
      opId: "op_ds_save_01",
      versionId: "ver_ds_2",
    });

    expect(result.status).toBe("accepted");
    expect(recordedEdits).toEqual([
      {
        opId: "op_ds_save_01",
        expectedVersionId: "ver_ds_1",
        versionId: "ver_ds_2",
      },
    ]);
    expect(state.canvas.items[ds.id]!.currentVersionId).toBe("ver_ds_2");
  });
});
