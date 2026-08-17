import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "test/**/*.test.ts"],
    // Runs in every worker, before every test file: see test/setup.ts for what
    // a run leaves behind without it.
    setupFiles: ["test/setup.ts"],
  },
});
