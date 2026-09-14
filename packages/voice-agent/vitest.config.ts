import { defineConfig } from "vitest/config";

/**
 * **This package's own test scope.**
 *
 * The root config's include glob picks these tests up too, so `npm test` at the
 * repo root still runs them — but that run also hands them the root
 * `setupFiles` (daemon guard, replica home) and `globalSetup` (Firestore
 * emulator): infrastructure for tests that spawn processes and talk to a
 * daemon. The page's tests load an HTML file, drive a DOM and check DSP
 * arithmetic. The harness's tests DO start a real daemon — but they start their
 * own, on port 0, in a temp home, and they were written to run without the
 * root's rig (`packages/cli/test` is where they lived).
 *
 * So `npm test -w @isocan/voice-agent` is the package's own scope, and the root
 * run is the union that CI already knows how to make.
 *
 * `environment` is left at vitest's default (node): it is right for the DSP,
 * the harness and the stylesheet tests, and the ones that need a DOM say so in
 * their own `// @vitest-environment jsdom` docblock — where a reader of the
 * test finds it, rather than here.
 *
 * The timeouts match the root config's, and for the same reason: these are not
 * tests that assert on elapsed time, and a machine under load must not decide
 * whether the page works.
 */
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
