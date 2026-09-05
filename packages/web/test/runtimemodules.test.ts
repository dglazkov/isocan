import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Runtime modules in the app, structurally** (`docs/projects/modules/design.md`,
 * phase 3): the host global is set before any module code is imported; the
 * import path is core's one spelling; a module that arrives after first
 * paint bumps the generation the slots read; the manifests ride the serving
 * fetch the app already makes; the palette reads module actions live.
 */
const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const runtime = read("../src/lib/runtimeModules.ts");
const modules = read("../src/modules.ts");
const contentBase = read("../src/lib/contentBase.ts");
const underlays = read("../src/components/ModuleUnderlays.tsx");
const itemView = read("../src/components/ItemView.tsx");
const actions = read("../src/lib/actions.ts");

describe("activating a runtime module", () => {
  it("hands over the app's own React and core before importing anything", () => {
    expect(runtime).toContain("globalThis.isocan ??= { React, jsxRuntime, core };");
    expect(runtime.indexOf("globalThis.isocan ??=")).toBeLessThan(runtime.indexOf("await import("));
    expect(runtime).toContain("moduleWebPath(m)");
    expect(runtime).not.toMatch(/["']\/modules\//);
  });

  it("registers every manifest's record first, so kinds are known before code runs", () => {
    expect(runtime.indexOf("registerModule(manifestRecord(m))")).toBeLessThan(runtime.indexOf("await import("));
  });

  it("rides the serving fetch the shell already makes, and bumps a generation the slots read", () => {
    expect(contentBase).toContain("activateRuntimeModules(serving.modules ?? [])");
    expect(modules).toContain("useUiStore.getState().bumpModules()");
    expect(underlays).toContain("useUiStore((s) => s.modulesGeneration)");
    expect(itemView).toContain("useUiStore((s) => s.modulesGeneration)");
  });

  it("does not let a runtime module shadow a build-time one, and reads module actions live", () => {
    expect(modules).toContain("if (LIST.some((m) => m.core.name === record.core.name)) return false;");
    expect(actions).toContain("const live = moduleActions();");
  });
});
