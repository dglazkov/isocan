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
