/** Explicit native stdio MCP entry. Importing other study modules never starts this server. */
import { readFile } from "node:fs/promises";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createStudyTools, STUDY_TOOLS, studyToolContent } from "./design-partner-tools.mjs";

if (process.argv.length !== 3) throw new Error("The tool server requires its evaluator-owned configuration file");
const config = JSON.parse(await readFile(process.argv[2], "utf8"));
const tools = await createStudyTools(config), server = new Server({ name: "isocan-design-study", version: "1" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: STUDY_TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async request => {
  try { return { content: studyToolContent(await tools.invoke(request.params.name, request.params.arguments ?? {})) }; }
  catch (error) { return { isError: true, content: [{ type: "text", text: error.message }] }; }
});
const deadline = setTimeout(async () => { await tools.close(); await server.close(); }, Math.max(0, Date.parse(config.deadline) - Date.now()));
process.once("SIGTERM", async () => { clearTimeout(deadline); await tools.close(); await server.close(); });
process.stdin.once("end", async () => { clearTimeout(deadline); await tools.close(); await server.close(); });
await server.connect(new StdioServerTransport());
