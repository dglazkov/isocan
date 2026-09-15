/** Read final output through the selected runtime's actual API, with no model or daemon creation. */
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { studyHash, studyJson } from "./design-partner-runtime.mjs";
const chunks = []; for await (const chunk of process.stdin) chunks.push(chunk);
const config = JSON.parse(Buffer.concat(chunks).toString());
const { DaemonClient } = await import(pathToFileURL(path.join(config.source, "packages/api/src/client.ts")).href);
const client = new DaemonClient(config.base, config.home), snapshot = await client.snapshot(config.canvasId);
if (snapshot.project.id !== config.canvasId) throw new Error("Final capture addresses another canvas");
const item = snapshot.canvas.items[config.outputItemId];
if (!item || item.deleted) throw new Error("Final output is absent");
const version = item.versions.find(row => row.id === item.currentVersionId);
if (!version || version.mimeType !== "text/html") throw new Error("Final output is not a current HTML version");
const bytes = await client.downloadBlob(config.canvasId, version.blobHash);
if (studyHash(bytes) !== version.blobHash) throw new Error("Final byte hash differs from its actual version");
await fs.writeFile(config.outputFile, bytes, { flag: "wx" });
let reportedReceipts = [];
if (typeof client.designRequests === "function") {
  const result = await client.designRequests(config.canvasId);
  reportedReceipts = result.requests.flatMap(request => request.receipts).filter(row => row.receipt.output?.kind === "canvas" && row.receipt.output.artifact.itemId === item.id && row.receipt.output.artifact.versionId === version.id).map(row => ({ ref: row.ref, author: row.author, status: row.status, reasons: row.reasons, receipt: row.receipt }));
}
process.stdout.write(studyJson({ kind: "canvas-item", itemId: item.id, versionId: version.id, sha256: version.blobHash, blobSha256: version.blobHash, bytes: bytes.length, mimeType: version.mimeType, title: item.title, author: version.createdBy, reportedReceipts }));
