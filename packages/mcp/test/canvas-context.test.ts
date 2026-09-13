import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CanvasHandle, type Home, type Ctx } from "@isocan/api";
import { groupFixture } from "../../api/test/group-fixture.ts";
import { createServer } from "../src/server.ts";

it("serves full frozen manifests and bounded original bytes through the real MCP protocol without writes", async () => {
  const f = groupFixture();
  const handle = new CanvasHandle({ client: f.client, actor: f.actor } as unknown as Ctx, f.state.project);
  const group = (await f.api.new("Acme scope")).itemId!;
  const card = await handle.add({ title: "Acme card", content: "Original text", mime: "text/markdown", in: group });
  const excluded = await handle.add({ title: "Acme excluded", content: "Excluded bytes", mime: "text/markdown", in: group, properties: { context: "excluded" } });
  const posted = await handle.say("Read scope", { rootIds: [group, card.id] });
  await handle.edit(card.id, { content: "Changed text" });
  await handle.remove(group);
  const count = f.writes.length;
  const reader = new CanvasHandle({ client: f.client, get actor() { throw new Error("reads must not demand identity"); } } as unknown as Ctx, f.state.project);
  const server = createServer({ home: async () => ({ canvas: async () => reader }) as unknown as Home });
  const host = new Client({ name: "acme-host", version: "1" });
  const [c, s] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(s), host.connect(c)]);
  try {
    const tools = await host.listTools();
    expect(tools.tools.find((tool) => tool.name === "read_context")?.annotations?.readOnlyHint).toBe(true);
    const payload = async (name: string, args: Record<string, unknown>) => {
      const response = await host.callTool({ name, arguments: args });
      expect(response.isError).toBeUndefined();
      return JSON.parse((response.content as Array<{ text: string }>)[0]!.text);
    };
    const manifest = await payload("read_context", { thread: posted.threadId, comment: posted.commentId });
    expect(manifest.rootIds).toEqual([group, card.id]);
    expect(manifest.expandedIds).toEqual([group, card.id, excluded.id]);
    expect(manifest.counts).toEqual({ included: 2, excluded: 1, unavailable: 0 });
    const first = await payload("read_context_content", { thread: posted.threadId, comment: posted.commentId, item: card.id, limit: 8 });
    expect(first).toMatchObject({ versionId: card.currentVersionId, data: "Original", nextOffset: 8, bytesRead: 8, totalBytes: 13 });
    expect(await payload("read_context_content", { thread: posted.threadId, comment: posted.commentId, item: card.id, offset: 8 })).toMatchObject({ data: " text", nextOffset: null });
    expect(await payload("read_context_content", { thread: posted.threadId, comment: posted.commentId, item: excluded.id })).toMatchObject({ status: "excluded", bytesRead: 0, nextOffset: null });
    const refusal = await host.callTool({ name: "read_context", arguments: { thread: posted.threadId } });
    expect(refusal.isError).toBe(true);
    expect((refusal.content as Array<{ text: string }>)[0]!.text).toContain("both thread and comment");
    expect(f.writes).toHaveLength(count);
  } finally { await host.close(); await server.close(); }
});
