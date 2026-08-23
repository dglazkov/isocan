import { describe, expect, it } from "vitest";
import {
  IDENTITY_COLORS,
  actorColor,
  applyActorColor,
  bindName,
  emptyActorRegistry,
  isIdentityColor,
  type ActorSetColorOp,
} from "../src/index.ts";

const setColor = (actorId: string, color: string | null): ActorSetColorOp => ({
  type: "actor.setColor",
  actorId,
  color,
});

describe("actorColor", () => {
  it("derives a stable color from the id when nobody has chosen one", () => {
    const first = actorColor("usr_alice");
    expect(first).toBe(actorColor("usr_alice"));
    expect(IDENTITY_COLORS.some((c) => c.value === first)).toBe(true);
  });

  it("never derives graphite — the neutral is a choice, not a fate", () => {
    const derived = new Set(
      Array.from({ length: 400 }, (_, i) => actorColor(`usr_${i}`)),
    );
    expect(derived.has("#6b7280")).toBe(false);
  });

  it("prefers the chosen color, and ignores one that is not a color", () => {
    expect(actorColor("usr_alice", { usr_alice: "#7a3fd0" })).toBe("#7a3fd0");
    expect(actorColor("usr_alice", { usr_alice: "javascript:alert(1)" })).toBe(actorColor("usr_alice"));
  });
});

describe("applyActorColor", () => {
  it("records a choice and takes it back", () => {
    let registry = applyActorColor(emptyActorRegistry(), setColor("usr_alice", "#3a7d2c"));
    expect(registry.colors).toEqual({ usr_alice: "#3a7d2c" });
    registry = applyActorColor(registry, setColor("usr_alice", null));
    expect(registry.colors).toEqual({});
  });

  it("refuses anything that is not a hex color", () => {
    expect(() => applyActorColor(emptyActorRegistry(), setColor("usr_alice", "red"))).toThrow(
      /not a color/,
    );
  });

  it("leaves the names alone", () => {
    const claimed = bindName(emptyActorRegistry(), {
      actor: { id: "usr_alice", name: "Alice" },
      ts: "2026-01-01T00:00:00.000Z",
    });
    const colored = applyActorColor(claimed, setColor("usr_alice", "#c93a55"));
    expect(colored.names).toEqual(claimed.names);
  });

  it("keeps a color whose actor nobody speaks as — the color belongs to the actor", () => {
    // A comment written a year ago still has to be painted in its author's
    // color, long after the session that wrote it stopped existing.
    const registry = applyActorColor(emptyActorRegistry(), setColor("usr_ghost", "#b26a00"));
    const rebound = bindName(registry, {
      actor: { id: "usr_alice", name: "Alice" },
      ts: "2026-01-01T00:00:00.000Z",
    });
    expect(rebound.colors).toEqual({ usr_ghost: "#b26a00" });
  });
});

describe("isIdentityColor", () => {
  it("takes #rgb and #rrggbb, and nothing else", () => {
    expect(isIdentityColor("#fff")).toBe(true);
    expect(isIdentityColor("#0F8A80")).toBe(true);
    expect(isIdentityColor("rgb(1,2,3)")).toBe(false);
    expect(isIdentityColor('" onload="x')).toBe(false);
  });
});
