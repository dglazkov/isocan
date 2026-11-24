# Module MCP tools — a module's verbs reach an agent that speaks MCP

*Open Stitch phase 0.5, 19 Nov 2026. Design note; the walk is
[`phases.md`](phases.md), the manual is [`authoring.md`](authoring.md).*

## The debt

AGENTS.md's rule is "done on both surfaces": a canvas for people AND agents,
and an agent's hands are the CLI. Modules honoured it — every module with a
gesture ships the verb (`sticker drop`, `map add`) — and the rule had a hole
the Open Stitch analysis found by grep: `packages/mcp/src` never read the
module registry. `isocan mcp` offered sixteen built-in tools, and an agent in
a manager that reaches the canvas only over MCP could create an item, read a
thread and claim a name, but could not drop a sticker, add a map node or run
a sandbox. The verbs existed for the agent holding the CLI and not for the
agent holding a tool list — the one-surface feature, with the surfaces
swapped. Removing a module took its verbs away; adding one never gave MCP
anything.

## The mechanism

**One field, on the half that already is the agent's.** `CliModule` gains
`tools?: readonly McpTool[]` (module API 0.2.12). A tool is
`{ name, title?, description, inputSchema, readOnly?, run(args, host) }`:
the verb half of its name, a zod shape for its own arguments (the built-ins'
form), and the act. It is declared in the same `cli.ts` as the verb, beside
it, so the two are read together and reviewed together.

**The server prefixes, splices and guards.** `createServer({ modules })`
registers each as `<module>_<verb>` — `stickers_drop` — after the sixteen
built-ins. It adds the built-ins' `session` and `canvas` arguments in front of
the tool's own, so a module cannot forget them and cannot redefine them. A
name that collides with a built-in, with another module's tool, or with the
two reserved arguments is refused when the server is built, not discovered by
a model mid-call. The built-in sixteen are unchanged and tested unchanged.

**The same door.** `run` is handed `{ canvas(), home(), session, signal }`:
the API's own `CanvasHandle`, opened through the same `canvasOf` every
built-in uses — the call's explicit session or the machine's ambient
identity, under the same source policy (ambient excludes personal text; a
claimed session reads as that actor). A tool body is the verb's body through
`@isocan/api` instead of `CliHost.sendOp`, and the op it sends is the op the
verb sends: the stickers proof is one `item.add` with the same mime, size and
title either way. Its refusals come back as `isError` answers, inside the
same `answering` as the built-ins.

**No third list.** `isocan mcp` hands `serveStdio` the CLI's own registry —
`CLI_MODULES` and the runtime modules `isocan module add` loaded — filtered
to those declaring tools. The MCP tool list is the CLI verb list by
construction, not a twin kept in step; the only place a module is named is
still the two lists, and `test/modules.test.ts` goes on holding that.

## What it refuses

- **A tool with no verb, or a verb with no tool an agent would need.** The
  field is beside `register` so the asymmetry is visible in one file; a
  listing verb whose answer is in the guide (`sticker ls`) needs no tool.
- **A second identity path.** No tool receives a raw client to pick an actor
  with; identity is applied before the handle is handed over, exactly as for
  `create_item`.
- **Resources, prompts, server-level anything.** A module contributes tools
  and nothing else to this surface; the two resource templates stay the
  server's.
- **Names outside the prefix.** A module cannot register `create_item` or
  another module's name; the prefix is derived from the package name, not
  chosen.
- **A separate `McpModule` package half.** The agent's half is `cli.ts`;
  adding `mcp.ts` would be a third thing to keep in both-or-neither.

## Proof

`packages/mcp/test/module-tools.test.ts` drives a synthetic module over the
SDK's in-memory transport: the name, the spliced arguments, attribution under
an explicit session, the collision refusals. `packages/mcp/test/stdio-module-tools.test.ts`
spawns `isocan mcp` the way a manager does and calls `stickers_drop`, then
reads the item back as the CLI would: the sticker mime, the title, the size.
