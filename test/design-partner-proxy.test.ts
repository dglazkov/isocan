import http from "node:http";
import net from "node:net";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { startStudyProxy } from "../scripts/lib/design-partner-proxy.mjs";

it("routes only contained files and the fixed fixture runtime; redirects, generic ops, sibling canvases and tunnels stay blocked", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-study-proxy-"));
  const requests: string[] = [], server = http.createServer((req, res) => { requests.push(req.url!); res.end("owned"); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as net.AddressInfo).port}`;
  const daemon = "http://127.0.0.1:2";
  const denied: any[] = [], proxy = await startStudyProxy({ workspace, base: daemon, canvasId: "prj_acme", repositoryUrl: base }, row => { denied.push(row); });
  const request = (url: string, method = "GET") => new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.request(proxy.origin, { method, path: url }, res => { let body = ""; res.on("data", bytes => body += bytes); res.on("end", () => resolve({ status: res.statusCode!, body })); }); req.on("error", reject); req.end();
  });
  try {
    await fs.writeFile(path.join(workspace, "screen.html"), "<p>Acme</p>"); await fs.symlink(path.dirname(workspace), path.join(workspace, "outside"));
    expect(await request(proxy.fileUrl("screen.html"))).toMatchObject({ status: 200, body: "<p>Acme</p>" });
    expect((await request(`${base}/api/stock`)).status).toBe(200);
    for (const [url, method] of [[`${daemon}/api/projects/prj_acme/snapshot`, "GET"], [`${daemon}/api/projects/prj_sibling/snapshot`, "GET"], [`${daemon}/api/ops`, "POST"], [`${daemon}/api/projects`, "GET"], ["http://127.0.0.1:1/private", "GET"], [proxy.fileUrl("outside/secret"), "GET"], [`${proxy.origin}/task/%2e%2e%2fsecret`, "GET"]]) expect((await request(url, method)).status).toBe(403);
    const connect = await new Promise<string>((resolve, reject) => { const socket = net.connect(new URL(proxy.origin).port as unknown as number, "127.0.0.1"); let text = ""; socket.on("connect", () => socket.write(`CONNECT 127.0.0.1:1 HTTP/1.1\r\nHost: 127.0.0.1:1\r\n\r\n`)); socket.on("data", bytes => text += bytes); socket.on("end", () => resolve(text)); socket.on("error", reject); socket.setTimeout(1000, () => socket.destroy(new Error("test tunnel deadline"))); });
    expect(connect).toContain("403"); expect(requests).toEqual(["/api/stock"]); expect(denied.length).toBe(8);
  } finally { await proxy.close(); await new Promise<void>(resolve => server.close(() => resolve())); await fs.rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});
