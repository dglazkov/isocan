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
 * **`import guide from "./agent-guide.md"` is that file's text.**
 *
 * The one declaration behind the rule `packages/cli/bin/workspace-loader.mjs`
 * implements for source mode, `scripts/release.mjs` and
 * `scripts/module-build.mjs` for their bundles, and `vitest.config.ts` for the
 * suite. It is here at the root and named by each package's tsconfig `include`
 * rather than copied into nine `src/` directories, because there is one rule.
 *
 * Why the rule exists: in the bundled release CLI every source file shares one
 * `import.meta.url` — the bundle's — so the `new URL("./agent-guide.md",
 * import.meta.url)` each guide used to be read by resolved to nothing
 * (`docs/projects/first-minute/design.md`, change 1).
 */
declare module "*.md" {
  const text: string;
  export default text;
}
