import { describe, expect, it } from "vitest";
import { agentRefusal, originLine, changedScreens, classificationLine, classify, preparedMarkdown, preparedRecord, releaseMarkdown, type DeployTable, type PrepareReport, type ReleaseRecord } from "../src/release.ts";

/** Exact's dry run for Acme Market (cbe553f6, 14 Nov 2026): a plan change over the air, and a grant that needs a binary. */
const table = (rows: DeployTable["rows"]): DeployTable => ({
  release: "r-1", snapshot: { id: "a".repeat(40), commit: "b".repeat(40), dirty: true }, app: { id: "dev.acme.market", name: "Acme Market" },
  channel: "internal", origin: { kind: "directory", location: "/o" }, dryRun: true, notes: ["UNCOMMITTED CHANGES … (--dirty)"], rows,
});

describe("the classification is Exact's", () => {
  it("sorts rows by Exact's own action, never by what changed", () => {
    const c = classify(table([
      { kind: "stream", platform: "ios", compatibilityId: "4e6df1a9c558bd32", action: "bundle", seq: 2, changes: [{ name: "app.plan", change: "changed" }] },
      { kind: "stream", platform: "ios", compatibilityId: "77aa00bb11cc22dd", action: "binary", reason: "grants changed: net.fetch" },
      { kind: "binary", platform: "macos", action: "binary", compatibilityId: "ffff", reason: "store.L=0: links no update store" },
    ]));
    expect(c.ota).toEqual([{ platform: "ios", stream: "4e6df1a9", seq: 2, changes: ["app.plan changed"] }]);
    expect(c.binary.map((b) => b.reason)).toEqual(["grants changed: net.fetch", "store.L=0: links no update store"]);
    expect(c.changes).toBe(1);
    expect(classificationLine(c)).toBe("1 change over the air (ios 4e6df1a9 → seq 2); 2 need a binary");
  });

  it("says nothing to ship when every stream is current", () => {
    const c = classify(table([{ kind: "stream", platform: "ios", compatibilityId: "4e6df1a9", action: "current", seq: 3 }]));
    expect(classificationLine(c)).toBe("nothing to ship: every stream is current");
  });

  it("writes a card that reads as a file, with the origin's digest either side", () => {
    const report: PrepareReport = { ok: true, channel: "internal", platform: "ios", lane: { format: 1, app: { id: "dev.acme.market", name: "Acme Market" }, platform: "ios", channels: [], baked: "internal", activate: null, interval: 10, signing: "k" },
      table: table([{ kind: "binary", platform: "ios", action: "binary", compatibilityId: "4e6df1a9", reason: "binary inputs changed" }]), originHash: { before: "c".repeat(64), after: "c".repeat(64) }, ms: 1 };
    const text = preparedMarkdown(preparedRecord(report, "Proposer", "2026-11-14T15:00:00Z"), "Acme Market");
    expect(text).toContain("## Needs a binary");
    expect(text).toContain("ios 4e6df1a9: binary inputs changed");
    expect(text).toContain("unchanged, nothing uploaded");
  });
});

describe("the origin line claims only what was hashed", () => {
  it("says nothing was measured when no directory was hashed, never \"unchanged\"", () => {
    const line = originLine({ channel: "internal", origin: "http://127.0.0.1:4790", originHash: { before: null, after: null } });
    expect(line).toBe("origin not hashed: internal names http://127.0.0.1:4790; set ISOCAN_EXACT_ORIGIN to the directory that host serves to prove nothing was uploaded");
    expect(line).not.toContain("unchanged");
  });
  it("says unchanged only when both digests exist and match", () => {
    expect(originLine({ channel: "internal", origin: "/o", originHash: { before: "c".repeat(64), after: "c".repeat(64) } })).toContain("unchanged, nothing uploaded");
    expect(originLine({ channel: "internal", origin: "/o", originHash: { before: "c".repeat(64), after: "d".repeat(64) } })).toContain("CHANGED");
  });
});

describe("only a person ships", () => {
  it("one sentence names the agent", () => {
    const s = agentRefusal("Proposer");
    expect(s.startsWith("Proposer is an agent")).toBe(true);
    expect(s.match(/[.!?](\s|$)/g)).toHaveLength(1);
  });
});

describe("a release card", () => {
  it("links the screens whose versions moved since the channel's previous release", () => {
    const now = { s1: { title: "place", version: "v2" }, s2: { title: "cart", version: "v5" } };
    expect(changedScreens(now, null)).toEqual([]);
    expect(changedScreens(now, { s1: "v1", s2: "v5" })).toEqual([{ itemId: "s1", title: "place", before: "v1", after: "v2" }]);
  });

  it("labels a roll back as a re-publish at a new sequence number", () => {
    const r: ReleaseRecord = { kind: "rollback", channel: "internal", release: "rollback-x", snapshot: "a".repeat(40), commit: "b".repeat(40), origin: "/o", by: "Acme Walker", at: "2026-11-14T15:00:00Z",
      heads: [{ platform: "ios", stream: "4e6df1a9", seq: 3, sha256: "d".repeat(64), previous: "e".repeat(64) }], refused: [], failed: [], classification: classify(table([])), of: "r-1",
      phased: { asked: false, note: null }, screens: {}, changed: [], ms: 1 };
    const text = releaseMarkdown(r, "Acme Market");
    expect(text).toContain("# Rolled back: Acme Market → internal");
    expect(text).toContain("the content of r-1 re-published at a new sequence number");
    expect(text).toContain("head seq 3");
  });
});
