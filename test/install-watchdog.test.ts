import { it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// The dependency-free negative controls also run before npm ci exists. Keep
// them in the ordinary/CI suite union so a passing gate cannot omit them.
it("install watchdog and retry negative controls hold", () => {
  const run = spawnSync(process.execPath, ["--test", "scripts/install-watchdog.test.mjs"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8", timeout: 25_000,
    env: Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("NODE_TEST_"))),
  });
  expect(run.error, `${run.stdout}\n${run.stderr}`).toBeUndefined();
  expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
  expect(run.stdout).toMatch(/# pass 22|ℹ pass 22/);
});
