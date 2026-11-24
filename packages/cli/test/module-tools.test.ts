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

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { BUILT_IN_TOOLS, moduleToolName } from "@isocan/mcp";
import { CLI_MODULES } from "../src/modules.ts";
import type { CliHost } from "../src/modulehost.ts";

/**
 * **A module's MCP tool is one of its verbs** (`docs/projects/modules/mcp.md`).
 *
 * The other half of "both surfaces" for agents: `test/modules.test.ts` holds
 * that a module is in the web list and the CLI list or neither; this holds
 * that a tool a module offers `isocan mcp` is a verb it also hangs on the
 * CLI — same name, same module, so the guide section that documents the verb
 * is the tool's manual. A tool with no verb is a feature only the MCP agent
 * has, which is the asymmetry the rule exists to forbid. And every name the
 * build would register is checked here once, so a collision is this test's
 * sentence rather than `isocan mcp` dying at startup under a manager.
 *
 * `isocan mcp` reads no list of its own: `main.ts` hands `serveStdio` the
 * CLI's `CLI_MODULES` and the runtime modules, filtered to those with tools.
 * That is asserted on the source, because the alternative is a third list.
 */
describe("module MCP tools", () => {
  /** A host that lets `register` hang its verbs and does nothing else. */
  const verbsOf = (register: (host: CliHost) => void): string[] => {
    const program = new Command();
    const host = new Proxy({ program } as unknown as CliHost, {
      get: (target, key) => (key in target ? (target as unknown as Record<PropertyKey, unknown>)[key] : () => () => {}),
    });
    register(host);
    const names: string[] = [];
    const walk = (cmd: Command) => {
      for (const sub of cmd.commands) {
        names.push(sub.name(), ...sub.aliases());
        walk(sub);
      }
    };
    walk(program);
    return names;
  };

  it("is declared by at least the module that proved it", () => {
    expect(CLI_MODULES.some((m) => (m.tools?.length ?? 0) > 0)).toBe(true);
  });

  for (const m of CLI_MODULES) {
    if (!m.tools?.length) continue;
    it(`${m.core.name} offers only verbs it registers, under names the build accepts`, () => {
      const verbs = verbsOf(m.register);
      for (const tool of m.tools!) {
        expect(verbs, `${m.core.name} declares the MCP tool "${tool.name}" and registers no verb of that name`).toContain(tool.name);
        const full = moduleToolName({ name: m.core.name, tools: m.tools! }, tool);
        expect(BUILT_IN_TOOLS, `${full} takes a built-in's name`).not.toContain(full);
        expect(tool.description.length, `${full} needs a description a model can act on`).toBeGreaterThan(30);
        expect(Object.keys(tool.inputSchema)).not.toContain("session");
        expect(Object.keys(tool.inputSchema)).not.toContain("canvas");
      }
    });
  }

  it("has no two modules claiming one tool name", () => {
    const all = CLI_MODULES.flatMap((m) => (m.tools ?? []).map((tool) => moduleToolName({ name: m.core.name, tools: m.tools! }, tool)));
    expect(new Set(all).size).toBe(all.length);
  });

  it("reaches isocan mcp from the CLI's own list, not a third one", () => {
    const main = readFileSync(fileURLToPath(new URL("../src/main.ts", import.meta.url)), "utf8");
    const start = main.indexOf('.command("mcp")');
    const action = main.slice(start, main.indexOf(".command(", start + 1));
    expect(action).toContain("CLI_MODULES");
    expect(action).toContain("runtimeModules");
    expect(action).toMatch(/serveStdio\(\{[^}]*modules/);
  });
});
