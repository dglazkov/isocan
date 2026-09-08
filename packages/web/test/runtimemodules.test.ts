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
  /** Where a module's own code is fetched — the thing the host object must
   *  exist before. Named, because there is a second dynamic import in this
   *  file now and "the first one" stopped meaning this one. */
  const MODULE_IMPORT = "await import(/* @vite-ignore */ url)";

  it("hands over the app's own React and core before a module's code is fetched", () => {
    /**
     * The invariant, asserted against the import it is ABOUT.
     *
     * This read `indexOf("await import(")` — the first dynamic import in the
     * file — which was the module's, and then stopped being: core is fetched
     * dynamically now (it was 51.5% of the entry chunk as a namespace import),
     * so the first `await import(` became core's own and the guard failed on a
     * file that was still correct. **A position is not an invariant**, and the
     * fix is to name the import rather than count them.
     */
    expect(runtime).toContain("globalThis.isocan ??= { React, jsxRuntime, core };");
    expect(runtime).toContain(MODULE_IMPORT);
    expect(runtime.indexOf("globalThis.isocan ??=")).toBeLessThan(runtime.indexOf(MODULE_IMPORT));
    expect(runtime).toContain("moduleWebPath(m)");
    expect(runtime).not.toMatch(/["']\/modules\//);
  });

  it("fetches the core namespace only when a module actually needs it", () => {
    /* `import * as core` asks for every export, so nothing in `@isocan/core`
       could be dropped and all of it — `recap.ts`, `evals.ts`, `deckexport.ts`
       included, which this app never calls — was pinned into the first paint.
       Paid by everybody for a feature that returns early on any canvas with no
       runtime module on it. */
    expect(runtime).not.toMatch(/^import \* as core from/m);
    expect(runtime).toContain('const core = await import("@isocan/core")');
    expect(runtime.indexOf("if (withWeb.length === 0) return;")).toBeLessThan(
      runtime.indexOf('const core = await import("@isocan/core")'),
    );
  });

  it("registers every manifest's record first, so kinds are known before code runs", () => {
    expect(runtime.indexOf("registerModule(manifestRecord(m))")).toBeLessThan(runtime.indexOf(MODULE_IMPORT));
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
