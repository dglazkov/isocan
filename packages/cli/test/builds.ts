import { promises as fs } from "node:fs";
import path from "node:path";
import { paths } from "@isocan/server";

/**
 * A build tree in the shape `npm install --prefix` produces: `<dir>/
 * node_modules/isocan`, a manifest carrying the stamp `release.mjs` writes,
 * and a bin at the path every copy of isocan has it at.
 *
 * `claims` is how a build lies: the manifest says one commit and the running
 * process reports another. That pair is the whole reason the smoke test starts
 * the candidate instead of reading its manifest twice.
 */
export async function makeBuild(
  dir: string,
  sha: string,
  options: { claims?: string; broken?: boolean } = {},
): Promise<string> {
  const root = paths.buildRoot(dir);
  const bin = path.join(root, "packages", "cli", "bin");
  await fs.mkdir(bin, { recursive: true });
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: "isocan",
        version: "0.1.0",
        type: "module",
        bin: { isocan: "packages/cli/bin/isocan.js" },
        isocan: { commit: sha, builtAt: "2026-08-20T09:00:00.000Z" },
      },
      null,
      2,
    ),
  );
  const reports = options.claims ?? sha;
  await fs.writeFile(
    path.join(bin, "isocan.js"),
    `#!/usr/bin/env node
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const COMMIT = ${JSON.stringify(reports)};
const root = fileURLToPath(new URL("../../../", import.meta.url));
if (process.argv.includes("--version")) {
  console.log("0.1.0 (" + COMMIT + ")");
  process.exit(0);
}
if (!process.argv.includes("serve")) {
  console.log(COMMIT);
  process.exit(0);
}
${options.broken ? 'process.stderr.write("Error: cannot find module @isocan/server\\n");\nprocess.exit(1);' : ""}
const home = process.env.ISOCAN_HOME;
const startedAt = new Date().toISOString();
const server = http.createServer((req, res) => {
  const pathname = (req.url ?? "/").split("?")[0];
  if (pathname === "/healthz" || pathname === "/api/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      pid: process.pid,
      startedAt,
      version: "0.1.0",
      root: path.resolve(root),
      codeAt: startedAt,
      commit: COMMIT,
      builtAt: "2026-08-20T09:00:00.000Z",
    }));
    return;
  }
  res.writeHead(404).end("{}");
});
server.listen(Number(process.env.ISOCAN_PORT ?? 0), "127.0.0.1", async () => {
  await fs.mkdir(home, { recursive: true });
  await fs.writeFile(
    path.join(home, "daemon.json"),
    JSON.stringify({ pid: process.pid, port: server.address().port, startedAt }),
  );
});
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => process.exit(0));
`,
  );
  return root;
}
