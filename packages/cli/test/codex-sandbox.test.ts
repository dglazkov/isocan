import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { codexSandboxAsked, codexSandboxSpec, supportsCodexSandbox } from "../src/codex-sandbox.ts";

describe("Codex native sandbox opt-in", () => {
  it("is off unless asked, preserves unrelated overrides and admits only exact configured hosts", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "isocan-native-"));
    try {
      expect(await codexSandboxAsked(home, {})).toBe(false);
      await writeFile(path.join(home, "config.json"), JSON.stringify({ codexSandbox: true, codexSandboxDomains: ["github.com", "registry.npmjs.org"] }));
      expect(await codexSandboxAsked(home, {})).toBe(true);
      expect(await codexSandboxAsked(home, { unsandboxed: true })).toBe(false);
      for (const platform of ["darwin", "linux"] as const) {
        const spec = await codexSandboxSpec({ harness: "codex", command: "bridge", args: [], env: { CODEX_CONFIG: '{"model":"test-model"}' } }, home, "http://127.0.0.1:4443", platform);
        const config = JSON.parse(spec.env!.CODEX_CONFIG!);
        expect(config.model).toBe("test-model");
        expect(config.features.network_proxy).toMatchObject({ enabled: true, allow_local_binding: false, domains: { "127.0.0.1": "allow", "github.com": "allow", "registry.npmjs.org": "allow" } });
        expect(Object.keys(config.features.network_proxy.domains)).toHaveLength(3);
        expect(spec.nativeCodexSandbox).toBe(true);
        expect(spec.sessionDirectories).toEqual([home]);
        expect(spec.env!.INITIAL_AGENT_MODE).toBe("read-only");
      }
      await expect(codexSandboxSpec({ harness: "codex", command: "bridge", args: [] }, home, "https://example.com", "win32")).rejects.toThrow("WSL2");
      await writeFile(path.join(home, "config.json"), JSON.stringify({ codexSandboxDomains: ["*"] }));
      await expect(codexSandboxSpec({ harness: "codex", command: "bridge", args: [] }, home, "http://localhost")).rejects.toThrow("exact hostnames");
    } finally { await rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });
  it("requires the bridge contract, and never treats an unknown version as compatible", () => {
    expect(supportsCodexSandbox("1.11.0")).toBe(true);
    expect(supportsCodexSandbox("1.12.1")).toBe(true);
    for (const version of [undefined, "", "1.10.9", "garbage"]) expect(supportsCodexSandbox(version)).toBe(false);
  });
});
