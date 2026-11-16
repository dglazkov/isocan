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
 * **`@isocan/mcp` — the canvas as an MCP server** (#220, phase 2).
 *
 * `createServer` builds the server and takes its home as a dependency, so a
 * test drives every tool without a transport and without a subprocess.
 * `serveStdio` is the one line that attaches it to the transport an agent
 * manager launches it over; `isocan mcp` is that line with a command in front
 * of it.
 */
export { createServer, type ServerDeps } from "./server.ts";
export { serveStdio } from "./stdio.ts";
