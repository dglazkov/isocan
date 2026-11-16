#!/usr/bin/env node

/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
