import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { waitForResolvedFeedback, type CanvasHandle, type ExplicitIdentity, type Home } from "@isocan/api";
import type { Actor } from "@isocan/core";

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
 * **Identity is per call.** Omitting a session keeps the API's ambient
 * identity. A collaborating agent deliberately claims a stable session key
 * and supplies it on subsequent calls. Resources use ambient identity; they
 * never borrow the most recently used tool session. No process-global actor
 * or environment switch exists here.
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
  /** A feedback call's signal must reach the connection's setup HTTP too. */
  home: (identity?: ExplicitIdentity, signal?: AbortSignal) => Promise<Home>;
  /** Explicit claim uses the same durable registry as CLI identity --session. */
  claim?: (identity: ExplicitIdentity, name: string) => Promise<Actor>;
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
  session: z.string().trim().min(1).max(256).optional().describe("An explicitly claimed caller session key. Omit to use the machine's ambient identity. Never inferred from clientInfo."),
  canvas: z
    .string()
    .optional()
    .describe(
      "Canvas id or a unique title prefix. Omit for the canvas bound to the directory the server was started in.",
    ),
};

/** The same admitted canvas JSON through tools and resources. */
async function canvasRead(handle: CanvasHandle, group?: string, recursive?: boolean) {
  const items = await handle.items({ in: group, recursive });
  return {
    canvas: { id: handle.record.id, title: handle.record.title },
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      kind: item.kind,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      containerId: item.containerId ?? null,
      ...(item.groupLayout ? { groupLayout: item.groupLayout } : {}),
    })),
  };
}

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

  const identityOf = (session?: string): ExplicitIdentity | undefined => session === undefined ? undefined : { session, harness: "mcp" };
  const canvasOf = async (ref?: string, session?: string) => (await deps.home(identityOf(session))).canvas(ref);

  server.registerTool(
    "list_canvases",
    {
      title: "List canvases",
      description:
        "The canvases discoverable to this caller, with id and title. Start here when you do not know which canvas the work is on.",
      inputSchema: { session: canvasArg.session },
    },
    async ({ session }) =>
      answering(async () => {
        const home = await deps.home(identityOf(session));
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
      inputSchema: { ...canvasArg, in: z.string().optional().describe("Read direct members of this canvas group (or legacy sheet)."), recursive: z.boolean().optional().describe("Include nested descendants of the named group.") },
    },
    async ({ canvas, session, in: group, recursive }) =>
      answering(async () => {
        const handle = await canvasOf(canvas, session);
        return canvasRead(handle, group, recursive);
      }),
  );

  server.registerTool("read_context", {
    title: "Read complete context",
    description: "The complete context manifest: hierarchy, original selected roots, included/excluded/unavailable counts and exact source/visual versions. Supply thread and comment to read a frozen request; otherwise read current roots or ambient pins. This never sends a message.",
    annotations: { readOnlyHint: true },
    inputSchema: { ...canvasArg, roots: z.array(z.string()).optional(), in: z.string().optional(), includeExcluded: z.boolean().optional(), thread: z.string().optional(), comment: z.string().optional() },
  }, async ({ canvas, session, roots, in: group, includeExcluded, thread, comment }) => answering(async () => {
    const handle = await canvasOf(canvas, session);
    if (thread !== undefined || comment !== undefined) {
      if (!thread || !comment) throw new Error("frozen context needs both thread and comment");
      if (roots !== undefined || group !== undefined || includeExcluded !== undefined) throw new Error("a saved request already fixes its roots and exclusion policy");
      return handle.contextOfComment(thread, comment);
    }
    return handle.context({ rootIds: roots, in: group, includeExcluded });
  }));

  server.registerTool("read_context_content", {
    title: "Read saved context content",
    description: "Read one exact version from a saved message's context, even after its live item changes or is deleted. Returns a bounded byte page with progress, exclusion/unavailability reasons, and UTF-8 or lossless base64. Follow nextOffset until null; source and visual are separate faces. Access refusal is an error, never reported as missing content.",
    annotations: { readOnlyHint: true },
    inputSchema: { ...canvasArg, thread: z.string(), comment: z.string(), item: z.string(), face: z.enum(["source", "visual"]).optional(), offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(262144).optional() },
  }, async ({ canvas, session, thread, comment, item, face, offset, limit }) => answering(async () => {
    return (await canvasOf(canvas, session)).contextItem(thread, comment, item, { face, offset, limit });
  }));

  server.registerTool(
    "read_item",
    {
      title: "Read an item",
      description:
        "One item's own content — the text of a note, the source of a document. Ids come from read_canvas.",
      inputSchema: { ...canvasArg, item: z.string().describe("The item id (itm_…).") },
    },
    async ({ canvas, session, item }) =>
      answering(async () => {
        const handle = await canvasOf(canvas, session);
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
    async ({ canvas, session }) =>
      answering(async () => {
        const handle = await canvasOf(canvas, session);
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
    async ({ canvas, session, limit }) =>
      answering(async () => {
        const handle = await canvasOf(canvas, session);
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
    async ({ canvas, session }) =>
      answering(async () => {
        const handle = await canvasOf(canvas, session);
        return { who: await handle.who() };
      }),
  );

  const summary = async (handle: CanvasHandle) => ({ layers: await handle.contextSummary(deps.version ? { guideVersion: deps.version } : {}) });
  server.registerTool("read_context_summary", {
    title: "Read layered context",
    description: "The live Context view: local and inherited sources, pins, exclusions, overrides, staleness and unavailable-source reasons. Distinct from item manifests and frozen request content; this poll marks nothing seen.",
    annotations: { readOnlyHint: true }, inputSchema: canvasArg,
  }, async ({ canvas, session }) => answering(async () => summary(await canvasOf(canvas, session))));

  server.registerTool("claim_agent", {
    title: "Claim an agent session",
    description: "Deliberately claim a name under a stable caller-supplied session key. Use that key on later calls; restarting MCP preserves the claim. A missing claim never falls back to the person's identity.",
    inputSchema: { session: canvasArg.session.unwrap(), name: z.string().trim().min(1).max(100) },
  }, async ({ session, name }) => answering(async () => {
    if (!deps.claim) throw new Error("This MCP connection does not support session claims.");
    return { session, actor: await deps.claim(identityOf(session)!, name) };
  }));
  const content = z.string().max(1_048_576).describe("Text/source content for this item, at most 1,048,576 characters.");
  const contextArgs = { roots: z.array(z.string()).optional(), in: z.string().optional(), includeExcluded: z.boolean().optional() };
  server.registerTool("create_item", {
    title: "Create an item",
    description: "Create an attributed item from text or source content. Supply your claimed session to act as that agent; optional group insertion remains one atomic canvas act.",
    inputSchema: { ...canvasArg, content, mime: z.string().min(1).default("text/markdown"), title: z.string().optional(), in: z.string().optional() },
  }, async ({ canvas, session, content, mime, title, in: group }) => answering(async () => (await canvasOf(canvas, session)).add({ content, mime, ...(title === undefined ? {} : { title }), ...(group === undefined ? {} : { in: group }) })));
  server.registerTool("edit_item", {
    title: "Edit an item",
    description: "Create a new attributed version of an existing item from text/source content. Prior versions remain available; supply your deliberate session key to write as that agent.",
    inputSchema: { ...canvasArg, item: z.string(), content, mime: z.string().optional() },
  }, async ({ canvas, session, item, content, mime }) => answering(async () => (await canvasOf(canvas, session)).edit(item, { content, ...(mime === undefined ? {} : { mime }) })));
  server.registerTool("post_comment", {
    title: "Post a comment",
    description: "Post an attributed comment on an item, or in the canvas Chat when item is omitted. Mentions use the shared CLI address rules; roots can freeze exact context for the request.",
    inputSchema: { ...canvasArg, ...contextArgs, item: z.string().optional(), message: z.string().min(1).max(65536) },
  }, async ({ canvas, session, item, message, roots, in: group, includeExcluded }) => answering(async () => {
    const handle = await canvasOf(canvas, session);
    const options = { rootIds: roots, in: group, includeExcluded };
    return item ? handle.comment(item, message, options) : handle.notify(message, options);
  }));
  server.registerTool("reply_comment", {
    title: "Reply in a thread",
    description: "Reply as the selected caller identity in an existing thread. Mentions and thread participation determine who receives feedback, using the same rules as CLI comments.",
    inputSchema: { ...canvasArg, ...contextArgs, thread: z.string(), message: z.string().min(1).max(65536) },
  }, async ({ canvas, session, thread, message, roots, in: group, includeExcluded }) => answering(async () => (await canvasOf(canvas, session)).reply(thread, message, { rootIds: roots, in: group, includeExcluded })));
  server.registerTool("wait_for_feedback", {
    title: "Wait for addressed feedback",
    description: "Wait up to 60 seconds for mentions, Chat messages or participating-thread replies addressed to this identity. Return and resume the cursor, including irrelevant traffic; timeout/cancellation ends the poll. Marks nothing seen and advertises no presence.",
    annotations: { readOnlyHint: true },
    inputSchema: { ...canvasArg, cursor: z.number().int().nonnegative().optional(), timeoutMs: z.number().int().min(1).max(60000).default(30000) },
  }, async ({ canvas, session, cursor, timeoutMs }, extra) => answering(() => waitForResolvedFeedback(async (signal) => {
    const home = await deps.home(identityOf(session), signal);
    signal.throwIfAborted();
    const handle = await home.canvas(canvas);
    signal.throwIfAborted();
    return { client: handle.ctx.client, canvasId: handle.id, actor: handle.ctx.actor };
  }, { ...(cursor === undefined ? {} : { since: cursor }), timeoutMs, signal: extra.signal })));

  for (const kind of ["canvas", "context"] as const) {
    const uriFor = (id: string) => `isocan://canvas/${encodeURIComponent(id)}${kind === "context" ? "/context" : ""}`;
    server.registerResource(kind, new ResourceTemplate(`isocan://canvas/{id}${kind === "context" ? "/context" : ""}`, {
      list: async () => ({ resources: (await (await deps.home()).ctx.client.listCanvases()).map((canvas) => ({ uri: uriFor(canvas.id), name: `${canvas.title} — ${kind}`, mimeType: "application/json" })) }),
    }), { mimeType: "application/json", description: `Current ${kind} JSON using ambient identity and ordinary canvas admission; explicit agent sessions are selected per tool call.` }, async (uri, { id }) => {
      if (typeof id !== "string") throw new Error("a single canvas id is required");
      const handle = await canvasOf(id);
      const value = kind === "context" ? await summary(handle) : await canvasRead(handle);
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(value, null, 2) }] };
    });
  }
  return server;
}
