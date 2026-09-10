import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Home } from "@isocan/api";

/**
 * **The canvas, as tools an agent can call** (#220, phase 2).
 *
 * The fourth surface, and the first one isocan does not own the client of.
 * The daemon holds the state; the web app, the CLI and `@isocan/api` are
 * equal clients over one operation vocabulary, and this is that vocabulary
 * offered to an agent running somewhere isocan never installed itself —
 * a coding agent in an agent manager, an IDE panel, anything that speaks MCP.
 *
 * **Why this exists at all, given the CLI already does everything.** The CLI
 * requires an agent to be running on a machine where isocan is on the PATH
 * and the skill is in context. That is the harness case and it is solved. An
 * agent in Jetski or Antigravity looking at a canvas in the next tab has
 * neither, and today cannot read the canvas at all. Two designs asked for
 * this surface before the agent-manager question did — the context project's
 * stage 3 (*"point Hindsight at the canvas and let it index the record it
 * does not own"*) and the memory design's phase 4 — which is the argument for
 * building it: a surface two unrelated projects ask for independently is not
 * a feature, it is a missing edge of the isomorphism.
 *
 * **Read-only, on purpose, for now.** Every tool here answers a question and
 * changes nothing. The write verbs wait on nothing technical — `@isocan/api`
 * has `add`, `edit`, `reply` and the rest a few lines away — but on the thing
 * `phases.md` names: an agent that arrives over MCP is whoever the machine
 * already is, and by default that is the PERSON. Reading as the person costs
 * nothing and attributes nothing. Writing as them would put the person's face
 * on an agent's work, and the fix for that is addressability rather than a
 * refusal, so it is built deliberately rather than by extension.
 *
 * **Errors are answers, not exceptions.** A tool that throws gives the calling
 * model a stack trace; a tool that returns `isError` with a sentence gives it
 * something to act on. `@isocan/api` already types its refusals — an
 * unreachable daemon is an `ApiError` with a code rather than a bare
 * `TypeError` — so the sentence is available and this file's job is to pass
 * it through rather than to invent one.
 */

/** How a home is reached, injected so a test can hand over a live one without
 * this file knowing how a connection is made. Called per tool invocation
 * rather than held: a daemon that restarts under a long-lived MCP server must
 * not leave every tool broken until somebody notices. */
export interface ServerDeps {
  home: () => Promise<Home>;
  /** Reported on `initialize`, so a host can say which build it is talking
   * to. */
  version?: string;
}

/** The MCP-shaped answer for a value: JSON in a text block, which is what
 * every host can render and every model can read. `structuredContent` rides
 * along for hosts that prefer it — the same fact twice is the protocol's own
 * arrangement, not a duplication of ours. */
function ok(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>,
  };
}

/** A refusal the caller can act on. `isError` is what tells the model this is
 * a result to read rather than a value to use. */
function refused(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

/** Every tool's body runs inside this: one place that turns a typed refusal
 * into a readable one, so no handler carries its own try/catch and none can
 * forget to. */
async function answering(body: () => Promise<unknown>) {
  try {
    return ok(await body());
  } catch (err) {
    return refused(err);
  }
}

/**
 * The canvas a tool means.
 *
 * Absent is not an error and not "all of them": it is **this directory's
 * canvas**, resolved exactly the way every CLI command resolves it — the
 * marker walk, the home default, the only-one rule. An MCP server launched in
 * a project directory therefore answers about that project's canvas with no
 * argument at all, which is the case worth making free.
 */
const canvasArg = {
  canvas: z
    .string()
    .optional()
    .describe(
      "Canvas id or a unique title prefix. Omit for the canvas bound to the directory the server was started in.",
    ),
};

/**
 * Build the server, without attaching it to anything.
 *
 * Separate from `serveStdio` so the tools can be driven by a real MCP client
 * over an in-memory transport — no subprocess, no pipes — which is what
 * `test/tools.test.ts` does. A server that could only be reached by spawning
 * it would be tested through a keyhole, and the tool list, the JSON shape and
 * the refusals are exactly the things worth asserting directly.
 */
export function createServer(deps: ServerDeps): McpServer {
  const server = new McpServer({
    name: "isocan",
    version: deps.version ?? "0.1.0",
  });

  const canvasOf = async (ref?: string) => (await deps.home()).canvas(ref);

  server.registerTool(
    "list_canvases",
    {
      title: "List canvases",
      description:
        "Every canvas this home holds, with its id and title. Start here when you do not know which canvas the work is on.",
      inputSchema: {},
    },
    async () =>
      answering(async () => {
        const home = await deps.home();
        // `ctx` is the API's own public handle to the client; a listing is
        // the one read `Home` does not wrap, and reaching through it beats
        // widening the API surface for a single caller.
        const canvases = await home.ctx.client.listCanvases();
        return {
          you: home.actor.name,
          canvases: canvases.map((c) => ({ id: c.id, title: c.title })),
        };
      }),
  );

  server.registerTool(
    "read_canvas",
    {
      title: "Read a canvas",
      description:
        "What is on a canvas: every item with its id, title, kind and position. The map, not the contents — use read_item for one item's text.",
      inputSchema: canvasArg,
    },
    async ({ canvas }) =>
      answering(async () => {
        const handle = await canvasOf(canvas);
        const items = await handle.items();
        return {
          canvas: { id: handle.record.id, title: handle.record.title },
          items: items.map((item) => ({
            id: item.id,
            title: item.title,
            kind: item.kind,
            x: item.x,
            y: item.y,
          })),
        };
      }),
  );

  server.registerTool(
    "read_item",
    {
      title: "Read an item",
      description:
        "One item's own content — the text of a note, the source of a document. Ids come from read_canvas.",
      inputSchema: { ...canvasArg, item: z.string().describe("The item id (itm_…).") },
    },
    async ({ canvas, item }) =>
      answering(async () => {
        const handle = await canvasOf(canvas);
        return handle.item(item);
      }),
  );

  server.registerTool(
    "read_threads",
    {
      title: "Read the conversation",
      description:
        "The comment threads on a canvas — what people and agents have said, and what is still unanswered. This is where the reasoning lives; the items are only what it produced.",
      inputSchema: canvasArg,
    },
    async ({ canvas }) =>
      answering(async () => {
        const handle = await canvasOf(canvas);
        return { threads: await handle.threads() };
      }),
  );

  server.registerTool(
    "read_activity",
    {
      title: "What has been going on",
      description:
        "Recent activity on a canvas, newest first — who did what. Read this before starting work, to find out what happened while you were not here.",
      inputSchema: {
        ...canvasArg,
        limit: z.number().int().min(1).max(100).optional().describe("How many entries (default 10)."),
      },
    },
    async ({ canvas, limit }) =>
      answering(async () => {
        const handle = await canvasOf(canvas);
        return { activity: await handle.activity(limit ?? 10) };
      }),
  );

  server.registerTool(
    "who",
    {
      title: "Who is on this canvas",
      description:
        "The people and agents this canvas knows, and how to address them. Names here are what an @mention resolves against.",
      inputSchema: canvasArg,
    },
    async ({ canvas }) =>
      answering(async () => {
        const handle = await canvasOf(canvas);
        return { who: await handle.who() };
      }),
  );

  return server;
}
