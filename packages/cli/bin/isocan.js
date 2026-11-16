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

// Source-mode launcher: register tsx so we can import TypeScript directly, and
// point `@isocan/*` at the sibling sources — registered last so it resolves
// first, leaving tsx to transpile what it hands back.
import { register as registerLoader } from "node:module";
import { register } from "tsx/esm/api";
register();
registerLoader("./workspace-loader.mjs", import.meta.url);
await import("../src/main.ts");
