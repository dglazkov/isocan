/** Instrumentation process: every product import resolves inside the selected immutable source tree. */
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadCorpus } from "./design-partner-eval.mjs";
import { studyHash, studyJson, studyProcess, startStudyService, studyTreeIdentity } from "./design-partner-runtime.mjs";

const chunks = []; for await (const chunk of process.stdin) chunks.push(chunk);
const config = JSON.parse(Buffer.concat(chunks).toString());
const at = relative => pathToFileURL(path.join(config.source, relative)).href;
const { startDaemon } = await import(at("packages/server/src/daemon.ts"));
const { DaemonClient } = await import(at("packages/api/src/client.ts"));
const { CanvasHandle } = await import(at("packages/api/src/connect.ts"));
const { summonsPrompt } = await import(at("packages/rc/src/helpers.ts"));
const { harnessVars } = await import(at("packages/api/src/harness.ts"));
const home = path.join(config.directory, "home"); await fs.mkdir(home, { recursive: true });
const daemon = await startDaemon({ port: 0, home, birthHome: null, host: "127.0.0.1", auth: null, contentPort: "off" });
const base = `http://127.0.0.1:${daemon.app.server.address().port}`;
const client = new DaemonClient(base, home);
const id = (prefix, key) => `${prefix}_${studyHash(key).slice(0, 24)}`;
async function claim(sessionKey, name) {
  await client.claimActor({ type: "actor.claim", sessionKey, name });
  return (await client.actorBindings([sessionKey]))[0].actor;
}
const person = await claim("cli:study-person", "Acme Evaluator"), agent = await claim("claude:study-agent", "Acme Designer");
const ctx = actor => ({ client, actor, home, harness: "claude", birthHome: null, binding: null, homeOf: async () => null, homes: async () => ({ birth: null, links: [], rows: {}, legacy: false, rowFor: () => null }) });
async function cli(canvasId, args, cwd) {
  const env = { ...process.env }; for (const key of Object.keys(env)) if (key.startsWith("ISOCAN_") || harnessVars.includes(key)) delete env[key];
  Object.assign(env, { ISOCAN_HOME: home, ISOCAN_DIRECT: base, ISOCAN_DEFAULT_HOME_URL: "", ISOCAN_HARNESS: "claude", ISOCAN_SESSION_ID: "study-agent" });
  const result = await studyProcess(process.execPath, [path.join(config.source, "packages/cli/bin/isocan.js"), "--canvas", canvasId, ...args], { cwd, env, milliseconds: 30_000 });
  assert.equal(result.code, 0, `${args.join(" ")}: ${result.stderr}`); return result.stdout;
}
try {
  if (config.action === "serve") {
    const snapshot = await client.snapshot(config.canvasId);
    assert.equal(snapshot.project.id, config.canvasId);
    assert.equal(studyHash(studyJson(snapshot.canvas)), config.mapping.seed.canvasSha256, "Fresh canvas differs from the actual recorded seed");
    assert.deepEqual(snapshot.project.properties, config.mapping.seed.properties);
    assert.equal(snapshot.project.title, config.mapping.seed.title);
    for (const item of config.mapping.items) assert.equal(studyHash(await client.downloadBlob(config.canvasId, item.blobSha256)), item.blobSha256);
    process.stdout.write(JSON.stringify({ url: base, canvasId: config.canvasId, actor: agent }) + "\n");
    await new Promise(resolve => { process.once("SIGTERM", resolve); process.once("SIGINT", resolve); });
  } else {
  if (config.action !== "materialize") throw new Error("Unknown instrumentation action");
  const corpus = await loadCorpus(config.fixtures), mappings = [];
  const served = await fetch(base + "/"); assert.equal(served.status, 200);
  assert((await served.text()).includes(config.runtime.build.entry));
  assert.equal(studyHash(Buffer.from(await (await fetch(`${base}/assets/${config.runtime.build.entry}`)).arrayBuffer())), config.runtime.build.sha256);
  for (const task of corpus.tasks) for (const entrance of config.entrances) {
    const key = `${task.id}/${entrance}`, canvasId = id("prj", key), workspace = path.join(config.directory, "workspaces", task.id, entrance);
    await fs.mkdir(workspace, { recursive: true });
    await client.sendOp(null, person, { type: "project.create", canvasId, title: task.title, groupMode: "groups" });
    await client.sendOp(canvasId, person, { type: "project.update", patch: { properties: { "design.workflow": "adaptive-v1" } } });
    const canvas = new CanvasHandle(ctx(person), (await client.snapshot(canvasId)).project), groups = {}, items = [], resources = [];
    for (const [index, group] of task.snapshot.groups.entries()) {
      const created = await canvas.groups.new(group.title, { at: { x: index * 2400, y: 0 }, size: { width: 2100, height: 2400 } }); groups[group.id] = created.itemId;
    }
    for (const seed of task.snapshot.items) {
      const bytes = Buffer.from(task.inputs[seed.path]);
      const uploaded = await client.uploadBlob(canvasId, bytes, seed.mime, path.basename(seed.path));
      const itemId = id("itm", `${task.id}/${seed.id}`), versionId = id("ver", `${task.id}/${seed.versionId}`);
      await client.sendOp(canvasId, person, { type: "item.add", itemId, version: { id: versionId, blobHash: uploaded.blobHash, size: uploaded.size, mimeType: seed.mime, filename: path.basename(seed.path) }, title: path.basename(seed.path), width: 600, height: 480, placement: { x: 40, y: 80 }, containerId: groups[seed.scope], groupPlacement: "auto", ...(seed.properties ? { properties: seed.properties } : {}) }, undefined, undefined, undefined, "groups");
      items.push({ fixtureItemId: seed.id, fixtureVersionId: seed.versionId, itemId, versionId, blobSha256: task.hashes[seed.path], path: seed.path, scope: seed.scope, groupId: groups[seed.scope] });
    }
    for (const [name, contents] of Object.entries(task.inputs)) {
      if (["task.json", "snapshot.json"].includes(name)) continue;
      await fs.mkdir(path.dirname(path.join(workspace, name)), { recursive: true });
      await fs.writeFile(path.join(workspace, name), contents, { flag: "wx" });
      resources.push({ path: name, sha256: studyHash(contents), delivery: "available-on-demand" });
    }
    const selectedItemIds = task.snapshot.selectedItemIds.map(seed => items.find(item => item.fixtureItemId === seed).itemId);
    const entry = task.entryPoints[entrance];
    for (const decision of task.snapshot.decisions) {
      const target = items.find(item => item.fixtureItemId === decision.selectedItemId);
      await canvas.comment(target.itemId, `Accepted direction: ${decision.reason}\nSelected exact version: ${target.versionId}. Recorded by the requesting person through ${decision.recordedEntrance}.`);
    }
    const request = await canvas.notify(task.instruction, { items: selectedItemIds });
    const snapshot = await client.snapshot(canvasId);
    for (const item of items) {
      const actual = snapshot.canvas.items[item.itemId]; assert.equal(actual.containerId, item.groupId);
      assert.equal(actual.currentVersionId, item.versionId); assert.equal(actual.versions[0].blobHash, item.blobSha256);
      assert.equal(studyHash(await client.downloadBlob(canvasId, item.blobSha256)), item.blobSha256);
    }
    const read = JSON.parse(await cli(canvasId, ["ls", "--json"], workspace));
    assert(items.every(item => JSON.stringify(read).includes(item.itemId)), "Actual source CLI lists all prepared items");
    const guide = await cli(canvasId, ["--agent-help"], workspace);
    assert(guide.includes("isocan") && guide.length > 10_000, "The actual CLI provides its full rendered guide");
    const last = (await client.getLog(canvasId, snapshot.lastSeq - 1)).find(entry => entry.seq === snapshot.lastSeq);
    assert(last?.envelope.op.comment?.id === request.commentId, "Actual summons carries the canonical request operation");
    const payload = { reason: "activity", entries: [{ ...last, canvasId, canvasTitle: task.title }] };
    const sourcePrompt = entrance === "canvas-chat" ? summonsPrompt(task.title, agent.name, payload) : task.instruction;
    const notice = "Harness discovery: the source-bound collaboration skill is available at .agents/skills/isocan-collab/SKILL.md. Read it with read_file, and read CONTEXT.json for the supplied canvas and task context. The cli tool runs this canvas's actual isocan CLI; browser and file tools operate only on this task. Use question when you need the person. The browser can open task:<relative-file> or the fixed connected fixture runtime URL. The interactive canvas UI is unavailable in this isolated browser; read and change canvas state with cli. No shell, external network, image generator or extra agent is available. Mark any final review or finding-driven repair you elect to perform with review_phase; at most two repair rounds are available. finish may explicitly report that no review occurred. At the end, write RESULT.json containing {\"outputItemId\":\"the final canvas item ID\",\"ready\":false}, or {\"repository\":true,\"ready\":false} for the connected fixture. Set ready to true only when you claim the output is ready; that remains a reported claim until separately evaluated.";
    const prompt = `${notice}\n\n${sourcePrompt}`;
    const publicContext = { knownFacts: task.knownFacts, references: task.references.map(ref => ref.kind === "local" ? { ...ref, itemId: items.find(item => item.fixtureItemId === ref.itemId).itemId, versionId: items.find(item => item.fixtureItemId === ref.itemId).versionId } : ref), selectedItemIds, targetGroupId: groups[entry.targetGroupId], deliveryType: task.deliveryType, viewports: task.viewports };
    await fs.writeFile(path.join(workspace, "CONTEXT.json"), studyJson(publicContext));
    await fs.mkdir(path.join(workspace, ".agents/skills/isocan-collab"), { recursive: true });
    const skill = await fs.readFile(path.join(config.source, ".agents/skills/isocan-collab/SKILL.md"));
    await fs.writeFile(path.join(workspace, ".agents/skills/isocan-collab/SKILL.md"), skill);
    resources.push({ path: "CONTEXT.json", sha256: studyHash(studyJson(publicContext)), delivery: "available-on-demand" }, { path: ".agents/skills/isocan-collab/SKILL.md", sha256: studyHash(skill), delivery: "ordinary-doorway" }, { path: "isocan --agent-help", sha256: studyHash(guide), delivery: "available-on-demand" });
    let repositoryPreparation = null;
    if (task.snapshot.repository) {
      const service = await startStudyService("npm", ["start"], { cwd: path.join(workspace, "repo"), env: { PATH: process.env.PATH, PORT: "0" }, milliseconds: 30_000 });
      let browser;
      try {
        const all = await (await fetch(service.url + "/api/stock")).json(), found = await (await fetch(service.url + "/api/stock?q=BTL-20")).json();
        assert.equal(found.length, 1); assert.equal(found[0].available, 24); assert.equal(all.length, 2);
        const { browser: openBrowser, until } = await import(at("scripts/lib/browser.mjs"));
        browser = await openBrowser(); await browser.send("Page.navigate", { url: service.url });
        await until(browser, 'document.querySelector("#count")?.textContent === "2 stock lines available"', "actual initial repository stock state");
        assert.equal(await browser.ev('customElements.get("acme-card") !== undefined'), true);
        repositoryPreparation = { status: "passed", runtime: "actual npm start", sourceFiles: task.snapshot.repository.files.map(name => ({ path: name.slice(5), sha256: task.hashes[name] })), checks: ["Actual stock API filters BTL-20 and returns quantity 24", "Initial rendered component displays two stock lines"], scope: "Existing fixture preparation only; requested new stock lookup remains unimplemented", browser: (await browser.send("Browser.getVersion")).product };
      } finally { await browser?.close(); await service.close(); }
    }
    const mapping = { fixtureId: task.id, entrance, canvasId, groups, items, selectedItemIds, request, workspace, prompt, promptSha256: studyHash(prompt), sourcePromptSha256: studyHash(sourcePrompt), harnessNoticeSha256: studyHash(notice), resources, initialSnapshotSha256: studyHash(studyJson(snapshot)), policy: { property: "design.workflow", original: null, seeded: "adaptive-v1", baselineBehavior: "Unknown property ignored by the preserved A runtime" }, repository: task.snapshot.repository, repositoryPreparation, unavailableReferences: task.references.filter(ref => ref.kind === "url"), verification: { api: true, cli: true, generatedDesign: false } };
    mapping.seed = { canvasSha256: studyHash(studyJson(snapshot.canvas)), properties: snapshot.project.properties, title: snapshot.project.title };
    mappings.push(mapping);
  }
  const report = { schemaVersion: 1, kind: "design-partner-materialization", sourceRevision: config.runtime.sourceRevision, runtime: config.runtime, directory: config.directory, home, actors: { person, agent }, mappings, providerCalls: 0, qualityEvidence: false };
  for (const mapping of mappings) mapping.persistedState = await studyTreeIdentity(path.join(home, "projects", mapping.canvasId));
  await fs.writeFile(path.join(config.directory, "materialization.json"), studyJson(report), { flag: "wx" });
  process.stdout.write(studyJson(report));
  }
} finally { daemon.app.server.closeAllConnections(); await daemon.close(); }
