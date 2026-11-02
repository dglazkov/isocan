/** A browser-wide owned proxy. Network containment does not depend on one page's CDP interception. */
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { studyPath } from "./design-partner-runtime.mjs";

const mimes = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".csv": "text/csv", ".txt": "text/plain" };
/** Only contained task files and the fixed connected task service are browser destinations. Canvas state is accessed through the authenticated CLI. */
export function studyNetworkRequest(raw, method, config, fileOrigin) {
  const url = new URL(raw);
  if (url.protocol !== "http:" || url.username || url.password) throw new Error("Only owned HTTP task services are available");
  if (url.origin === fileOrigin) {
    if (method !== "GET" || !url.pathname.startsWith("/task/")) throw new Error("Unknown task file route");
    return { kind: "file", relative: decodeURIComponent(url.pathname.slice(6)), url };
  }
  if (url.origin === config.repositoryUrl) {
    if (method !== "GET") throw new Error("The supplied connected fixture exposes read-only HTTP; no new backend is available");
    return { kind: "forward", url };
  }
  throw new Error("Interactive canvas UI and other origins are unavailable; use the bound CLI for canvas state");
}

/** Every Chrome target uses this proxy; redirects are revalidated and tunnels/upgrades are refused.
 * @param {object} config
 * @param {(denial: {method: string, url: string, reason: string}) => unknown} [onDenied]
 */
export async function startStudyProxy(config, onDenied = async () => {}) {
  const sockets = new Set(); let origin;
  const server = http.createServer(async (request, response) => {
    try {
      const raw = request.url.startsWith("/") ? origin + request.url : request.url;
      const destination = studyNetworkRequest(raw, request.method, config, origin);
      if (destination.kind === "file") {
        const filename = await studyPath(config.workspace, destination.relative), stat = await fs.stat(filename);
        if (!stat.isFile() || stat.size > 8_388_608) throw new Error("Task file unavailable");
        response.writeHead(200, { "Content-Type": mimes[path.extname(filename).toLowerCase()] ?? "application/octet-stream", "X-Content-Type-Options": "nosniff" }); response.end(await fs.readFile(filename)); return;
      }
      const headers = { ...request.headers }; delete headers["proxy-connection"]; delete headers.authorization; delete headers.cookie;
      headers.host = destination.url.host;
      const upstream = http.request(destination.url, { method: "GET", headers }, result => { response.writeHead(result.statusCode, result.headers); result.pipe(response); });
      upstream.setTimeout(10_000, () => upstream.destroy(new Error("Owned request deadline")));
      upstream.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end("Owned task service unavailable"); }); upstream.end();
    } catch (error) { await onDenied({ method: request.method, url: request.url, reason: error.message }); response.writeHead(403, { "Content-Type": "text/plain" }); response.end("Outside owned study browser scope"); }
  });
  server.on("connect", (request, socket) => { void onDenied({ method: "CONNECT", url: request.url, reason: "TLS tunnels are unavailable" }); socket.end("HTTP/1.1 403 Forbidden\r\n\r\n"); });
  server.on("upgrade", (request, socket) => { void onDenied({ method: "UPGRADE", url: request.url, reason: "WebSockets are unavailable" }); socket.end("HTTP/1.1 403 Forbidden\r\n\r\n"); });
  server.on("connection", socket => {
    sockets.add(socket); socket.on("close", () => sockets.delete(socket));
    // Chrome can reset a refused CONNECT or an owned socket during shutdown.
    // That transport closure is not an uncaught instrumentation exception.
    socket.on("error", () => {});
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, fileUrl: relative => `${origin}/task/${relative.split("/").map(encodeURIComponent).join("/")}`, async close() { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); } };
}
