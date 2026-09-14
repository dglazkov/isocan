#!/usr/bin/env node
/**
 * **`voice-agent` — the command a person and the rc both use.**
 *
 * A shebang and a loader, on purpose: the argument parsing and both modes live
 * in `src/cli.ts`, where they are TypeScript, typed and testable. The trick is
 * the same one `packages/cli/bin/isocan.js` uses — register `tsx` so the
 * package's own sources import directly, with no build step between an edit and
 * a run.
 */
import { register } from "tsx/esm/api";

register();

const { main } = await import("../src/cli.ts");
try {
  await main();
} catch (err) {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
