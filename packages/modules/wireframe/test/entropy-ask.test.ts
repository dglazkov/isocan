import { describe, expect, it } from "vitest";
import type { CanvasContents, Operation } from "@isocan/core";
import {
  applyPinnedToSpecs,
  composeFlow,
  formatAskComment,
  gateFlowDecision,
  JEV_MODEL,
  parsePinFlags,
  ROOT_GATE_KEYS,
  stubAnswerer,
  type JevRequest,
  type JevResponse,
  type RootGateKey,
  type RootGateQuestion,
  type WirePort,
  type WireSpec,
} from "../src/core.ts";

function memoryPort(): WirePort {
  const items = new Map<
    string,
    {
      id: string;
      title: string;
      properties: Record<string, string>;
      x: number;
      y: number;
      width: number;
      height: number;
      currentVersionId: string;
      versions: Array<{ id: string; blobHash: string; mimeType: string; filename?: string }>;
    }
  >();
  const blobs = new Map<string, string>();
  return {
    canvasId: "c-test",
    actor: { id: "u-test", name: "Test" },
    async put(text: string) {
      const blobHash = `blob-${blobs.size + 1}`;
      blobs.set(blobHash, text);
      return { blobHash, size: text.length };
    },
    async send(op: Operation) {
      if (op.type === "item.add") {
        const at = op.placement as { x: number; y: number };
        items.set(op.itemId, {
          id: op.itemId,
          title: op.title ?? "",
          properties: op.properties ?? {},
          x: at.x,
          y: at.y,
          width: op.width,
          height: op.height,
          currentVersionId: op.version.id,
          versions: [op.version],
        });
      } else if (op.type === "item.addVersion") {
        const item = items.get(op.itemId)!;
        item.versions.push(op.version);
        item.currentVersionId = op.version.id;
      } else if (op.type === "item.update") {
        const item = items.get(op.itemId)!;
        if (op.patch.title !== undefined) item.title = op.patch.title;
        if (op.patch.properties) {
          for (const [k, v] of Object.entries(op.patch.properties)) {
            if (v === null) delete item.properties[k];
            else item.properties[k] = v;
          }
        }
      }
    },
    async canvas(): Promise<CanvasContents> {
      return {
        items: Object.fromEntries(items.entries()) as unknown as CanvasContents["items"],
      } as CanvasContents;
    },
    async readText(blobHash: string): Promise<string> {
      return blobs.get(blobHash) ?? "";
    },
  };
}

describe("entropy-gated /ask on root flow decisions (Phase 10)", () => {
  it("parses --pin key=value flags and rejects malformed entries", () => {
    const k: RootGateKey = ROOT_GATE_KEYS[0];
    expect(k).toBe("platform");
    expect(parsePinFlags(["platform=web", "density=compact"])).toEqual({
      platform: "web",
      density: "compact",
    });
    expect(parsePinFlags(undefined)).toEqual({});
    expect(() => parsePinFlags(["platform"])).toThrow(/key=value/);
    expect(() => parsePinFlags(["=web"])).toThrow(/key=value/);
  });

  it("gates high-entropy root decisions and formats /ask comments", () => {
    const req: JevRequest = {
      model: JEV_MODEL,
      state: { request: "A courier dispatch portal" },
      questions: {
        platform: {
          type: "choice",
          instructions: "Platform?",
          criteria: { app: "Mobile", web: "Web", site: "Site" },
        },
        pack: {
          type: "choice",
          instructions: "Pack?",
          criteria: { courier: "Courier", commerce: "Commerce", SaaS: "SaaS", fintech: "Fintech" },
        },
      },
    };
    const res: JevResponse = {
      answers: {
        platform: {
          type: "choice",
          choice: "app",
          probabilities: { app: 0.36, web: 0.34, site: 0.30 },
        },
        pack: {
          type: "choice",
          choice: "courier",
          probabilities: { courier: 0.90, commerce: 0.05, SaaS: 0.03, fintech: 0.02 },
        },
      },
    };

    const gated = gateFlowDecision(req, res);
    expect(gated.asks).toHaveLength(1);
    const q: RootGateQuestion = gated.asks[0]!;
    expect(q.key).toBe("platform");
    expect(q.entropy).toBeGreaterThan(1.0);
    expect(q.options.map((o) => o.value)).toEqual(["app", "web", "site"]);

    const comment = formatAskComment(q);
    expect(comment).toContain("/ask Which platform should this flow target?");
    expect(comment).toContain("app (36%) · web (34%) · site (30%)");

    // When pinned or noAsk is set, no /ask is emitted
    const pinnedGate = gateFlowDecision(req, res, { pinned: { platform: "web" } });
    expect(pinnedGate.asks).toHaveLength(0);
    expect(pinnedGate.resolved.platform).toBe("web");

    const silentGate = gateFlowDecision(req, res, { noAsk: true });
    expect(silentGate.asks).toHaveLength(0);
    expect(silentGate.resolved.platform).toBe("app");
  });

  it("applies pinned platform, template, and density to specs", () => {
    const base: WireSpec = {
      v: 1,
      request: "Acme ops",
      flow: "f-1",
      title: "Overview",
      archetype: "home",
      platform: "app",
      slots: [{ slot: "main.1", block: "stats-row", props: {} }],
    };
    const updated = applyPinnedToSpecs([base], {
      platform: "web",
      template: "dashboard",
      density: "compact",
    });
    expect(updated[0]?.platform).toBe("web");
    expect(updated[0]?.template).toBe("dashboard");
    expect(updated[0]?.density).toBe("compact");
    expect(updated[0]?.pinned).toEqual({
      platform: "web",
      template: "dashboard",
      density: "compact",
    });
  });

  it("wires pinned decisions and onGateAsk through composeFlow", async () => {
    const port = memoryPort();
    const askedQuestions: string[] = [];
    const composed = await composeFlow(port, "Acme operations console", stubAnswerer(3), {
      flesh: false,
      pinned: { density: "compact", template: "dashboard" },
      onGateAsk: (ask) => {
        askedQuestions.push(ask.key);
        return ask.key === "platform" ? "web" : undefined;
      },
    });
    expect(composed.screens.length).toBeGreaterThan(0);
    for (const s of composed.screens) {
      expect(s.spec.density).toBe("compact");
      expect(s.spec.template).toBe("dashboard");
      expect(s.spec.pinned?.density).toBe("compact");
    }
    if (askedQuestions.includes("platform")) {
      expect(composed.screens[0]?.spec.platform).toBe("web");
    }
  });
});
