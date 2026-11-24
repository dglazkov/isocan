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

import type { z } from "zod";
import type { CanvasHandle, Home } from "@isocan/api";

/**
 * **A module's verb, as an MCP tool** (`docs/projects/modules/mcp.md`).
 *
 * The CLI is an agent's hands only when the agent has the CLI. An agent that
 * reaches the canvas over `isocan mcp` had the sixteen built-ins and nothing a
 * module added — `sticker drop` existed for a terminal and not for a manager
 * — which is the web-only feature AGENTS.md forbids, with the surfaces
 * swapped. A module that gives a verb to the CLI gives the same act here: a
 * tool, declared beside the verb in the same `cli.ts`, named
 * `<module>_<verb>` by the server, carrying the built-ins' own `session` and
 * `canvas` arguments without having to declare them.
 *
 * **The same door as the built-ins.** `run` is handed the API's own
 * `CanvasHandle`, opened as the call's identity under the same source policy
 * every built-in tool applies — ambient identity excludes personal text; a
 * claimed session reads as that actor. A tool cannot choose a different
 * identity, register a resource, or name itself outside its module's prefix.
 * Its body is the same kind of code the CLI verb runs, against the same API,
 * so the op it sends is the op the verb sends.
 */
export interface McpToolHost {
  /** The canvas the call named — or the directory's — resolved the way every
   *  CLI command and built-in tool resolves it, as the call's identity. */
  canvas: () => Promise<CanvasHandle>;
  /** The home, for a tool that is not about one canvas. */
  home: () => Promise<Home>;
  /** The explicitly claimed session key the caller supplied, or `undefined`
   *  for the machine's ambient identity. Informational: identity is already
   *  applied to `canvas()` and `home()`. */
  session: string | undefined;
  /** The host's cancellation, as the built-ins receive it. */
  signal: AbortSignal;
}

export interface McpTool<Shape extends z.ZodRawShape = z.ZodRawShape> {
  /** The verb half — `drop`. The server registers `<module>_<verb>`. */
  name: string;
  title?: string;
  /** What a model reads before calling it. Say what it does and what it needs. */
  description: string;
  /** The verb's own arguments, as a zod shape — the built-ins' form. `session`
   *  and `canvas` are the server's and a tool that redeclares them is refused
   *  at registration. */
  inputSchema: Shape;
  /** Reads only: advertised to the host as `readOnlyHint` and opened with
   *  read intent. */
  readOnly?: boolean;
  /** The act. Throw to refuse — the server turns it into an `isError` answer
   *  the model can read, as it does for the built-ins. The returned value is
   *  the tool's JSON answer. */
  run(args: z.output<z.ZodObject<Shape>>, host: McpToolHost): Promise<unknown>;
}

/** A module as the server sees it: its package name and the tools it offers. */
export interface McpModule {
  /** The package name — `@isocan/<name>` — whose unscoped part prefixes
   *  every tool. */
  name: string;
  tools: readonly McpTool[];
}

/** The sixteen built-in tool names. A module tool may not take one. */
export const BUILT_IN_TOOLS: readonly string[] = Object.freeze([
  "list_canvases",
  "read_canvas",
  "read_context",
  "read_context_content",
  "read_item",
  "read_threads",
  "read_activity",
  "who",
  "read_context_summary",
  "read_personal_context",
  "claim_agent",
  "create_item",
  "edit_item",
  "post_comment",
  "reply_comment",
  "wait_for_feedback",
]);

/** `@isocan/<name>` → `<name>`; `@acme/Design Lab` → `design-lab`. The
 *  protocol allows `[A-Za-z0-9_-]` and 64 characters for a tool name. */
export function moduleToolPrefix(packageName: string): string {
  return packageName
    .replace(/^@[^/]+\//, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The full tool name, or the sentence saying why there cannot be one. */
export function moduleToolName(module: McpModule, tool: McpTool): string {
  const prefix = moduleToolPrefix(module.name);
  if (!prefix) throw new Error(`module "${module.name}" has no usable name to prefix its MCP tools with`);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(tool.name)) throw new Error(`module ${module.name} declares an MCP tool named "${tool.name}" — a tool name is lowercase letters, digits, _ and -`);
  const name = `${prefix}_${tool.name}`;
  if (name.length > 64) throw new Error(`module tool ${name} is longer than the 64 characters MCP allows for a tool name`);
  return name;
}
