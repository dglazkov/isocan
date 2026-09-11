import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { connect } from "@isocan/api";
import { createServer } from "./server.ts";

/**
 * **Attach the server to stdio and stay up.**
 *
 * Stdio is how an agent manager launches a local MCP server: it spawns the
 * command and speaks JSON-RPC over the pipes. Two consequences shape this
 * file.
 *
 * **Nothing may be written to stdout that is not protocol.** A stray
 * `console.log` — ours or a dependency's — lands in the middle of a JSON-RPC
 * frame and the host disconnects with a parse error, which is a confusing
 * failure a long way from its cause. Anything this process wants to say goes
 * to stderr, where a host shows it as server output.
 *
 * **The connection is made per call, not here.** `connect()` resolves the
 * identity and reaches the daemon, and both can fail for reasons that are
 * fixed while the server is running — a daemon not started yet, a machine
 * with no name yet. Connecting once at startup would turn either into a
 * server that is up and permanently broken; connecting per tool call turns
 * them into a refusal the caller can read and act on, and a retry that works
 * the moment the cause is fixed.
 *
 * **Identity is the ambient walk, deliberately** — which is to say: whoever
 * this machine already is. A harness session in the environment makes it that
 * agent; with none, it is the machine's PERSON, exactly as the CLI behaves
 * with no session. An MCP client driving this is a person driving a tool
 * until it says otherwise, and `phases.md` records why that is the default
 * rather than a compromise.
 */
export async function serveStdio(options: { version?: string } = {}): Promise<void> {
  const server = createServer({
    home: () => connect(),
    ...(options.version !== undefined ? { version: options.version } : {}),
  });
  await server.connect(new StdioServerTransport());
}
