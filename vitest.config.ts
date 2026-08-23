import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "test/**/*.test.ts"],
    // Runs in every worker, before every test file: see test/setup.ts for what
    // a run leaves behind without it.
    setupFiles: ["test/setup.ts"],
    // Runs ONCE, in the main process, before any worker exists — which is the
    // only place a Firestore emulator can be started and have every worker
    // inherit its address. See test/emulator.ts for the three tiers and for
    // what happens on a machine that has none.
    globalSetup: ["test/emulator.ts"],
  },
});
