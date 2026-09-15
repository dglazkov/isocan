/** Pinned study runtimes. Preparation never imports a model or reads deployment configuration. */
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STUDY_SOURCES = Object.freeze({ A: "304346276dbabd3b7c10dff3f55070dbcff10ab2", B: "08bbf1017213b2d7a24b269384e1861481958ae7", C: "08bbf1017213b2d7a24b269384e1861481958ae7" });
const builds = { [STUDY_SOURCES.A]: { entry: "index-k3a2TSzf.js", bytes: 762574, sha256: "75945c5fe067994f380c4dd265204ce1023bf728f0373c637fb89c9bf7b6c6cb" }, [STUDY_SOURCES.B]: { entry: "index-DEF98bII.js", bytes: 742315, sha256: "ca5c47e5d19ff5901d1c6e9b96e43240e4b2884ca87c2275cf9a21eb7de3cdaa" } };
export const studyHash = bytes => createHash("sha256").update(bytes).digest("hex");
export const studyJson = value => JSON.stringify(value, null, 2) + "\n";
/** Hash every regular file in an owned tree; links cannot substitute foreign runtime or evidence bytes. */
export async function studyTreeIdentity(root) {
  const files = [];
  async function visit(relative) {
    for (const entry of (await fs.readdir(path.join(root, relative), { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Owned tree contains a link: ${name}`);
      if (entry.isDirectory()) await visit(name);
      else if (entry.isFile()) { const bytes = await fs.readFile(path.join(root, name)); files.push({ path: name, bytes: bytes.length, sha256: studyHash(bytes) }); }
      else throw new Error(`Unsupported owned tree entry: ${name}`);
    }
  }
  await visit(""); return files;
}
/** Freeze the executable study boundary, independent assessment and actual MCP dependency resolution. */
export async function studyInstrumentationIdentity() {
  const names = ["../design-partner-execute.mjs", "design-partner-runtime.mjs", "design-partner-runtime-child.mjs", "design-partner-result-child.mjs", "design-partner-execution.mjs", "design-partner-native.mjs", "design-partner-tools.mjs", "design-partner-mcp.mjs", "design-partner-proxy.mjs", "design-partner-results.mjs", "design-partner-review.mjs", "design-partner-eval.mjs", "browser.mjs", "../../docs/projects/design-partner/study-tasks.json", "../../docs/projects/design-partner/partnership-study.md", "../../package-lock.json", "../../node_modules/@modelcontextprotocol/sdk/package.json"];
  return Promise.all(names.map(async name => { const filename = fileURLToPath(new URL(name, import.meta.url)); return { path: filename, sha256: studyHash(await fs.readFile(filename)) }; }));
}
const git = (repository, args) => execFileSync("git", args, { cwd: repository, maxBuffer: 64 * 1024 * 1024 });
const sourcePath = name => /^(?:LICENSE|README\.md|package(?:-lock)?\.json|index\.mjs|rc\.mjs|tsconfig[^/]*\.json)$/.test(name) || name === ".agents/skills/isocan-collab/SKILL.md" || /^(?:packages|scripts)\//.test(name) && !/(?:^|\/)(?:test|tests|dist|node_modules|\.env[^/]*|\.isocan)(?:\/|$)/.test(name);

/** Read exactly the public executable source tree at a named commit, never the working checkout. */
export function runtimeSourceFiles(repository, revision) {
  if (!Object.values(STUDY_SOURCES).includes(revision)) throw new Error("Unknown frozen runtime revision");
  const rows = git(repository, ["ls-tree", "-r", "--full-tree", revision]).toString().trim().split("\n");
  return rows.flatMap(line => {
    const match = line.match(/^(\d+) blob ([a-f0-9]+)\t(.+)$/);
    if (!match || !sourcePath(match[3])) return [];
    if (match[1] !== "100644" && match[1] !== "100755") throw new Error(`Unsupported source link: ${match[3]}`);
    return [{ path: match[3], gitObject: match[2], executable: match[1] === "100755" }];
  });
}

/** Create a new frozen source tree with correct local workspace links; building is an explicit separate step. */
export async function prepareRuntimeSource({ repository, revision, directory, dependencies }) {
  const files = runtimeSourceFiles(repository, revision);
  const lock = git(repository, ["show", `${revision}:package-lock.json`]);
  if (!lock.equals(await fs.readFile(path.join(dependencies, "package-lock.json")))) throw new Error("External dependency lock differs from the frozen runtime");
  await fs.mkdir(directory, { recursive: false });
  for (const file of files) {
    const bytes = git(repository, ["cat-file", "blob", file.gitObject]);
    await fs.mkdir(path.dirname(path.join(directory, file.path)), { recursive: true });
    await fs.writeFile(path.join(directory, file.path), bytes, { flag: "wx", mode: file.executable ? 0o755 : 0o644 });
  }
  const modules = path.join(directory, "node_modules"); await fs.mkdir(modules);
  for (const name of await fs.readdir(path.join(dependencies, "node_modules"))) {
    if (name === "@isocan") continue;
    await fs.symlink(path.join(dependencies, "node_modules", name), path.join(modules, name));
  }
  await fs.mkdir(path.join(modules, "@isocan"));
  for (const file of files.filter(file => /^packages\/(?:[^/]+|modules\/[^/]+)\/package\.json$/.test(file.path))) {
    const pkg = JSON.parse(await fs.readFile(path.join(directory, file.path), "utf8"));
    if (pkg.name?.startsWith("@isocan/")) await fs.symlink(path.join(directory, path.dirname(file.path)), path.join(modules, pkg.name));
  }
  return { sourceRevision: revision, directory: path.resolve(directory), files: files.length, build: "not-built", providerCalls: 0 };
}

/** Validate actual source bytes, workspace resolution and built entry against the immutable git source. */
export async function inspectRuntime({ repository, revision, directory }) {
  const files = runtimeSourceFiles(repository, revision), sourceFiles = [], workspaces = [];
  for (const file of files) {
    const filename = path.join(directory, file.path), stat = await fs.lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Runtime source is not a regular file: ${file.path}`);
    const bytes = await fs.readFile(filename), expected = git(repository, ["cat-file", "blob", file.gitObject]);
    if (!bytes.equals(expected)) throw new Error(`Runtime source differs from ${revision}: ${file.path}`);
    sourceFiles.push({ path: file.path, sha256: studyHash(bytes) });
    if (/^packages\/(?:[^/]+|modules\/[^/]+)\/package\.json$/.test(file.path)) {
      const pkg = JSON.parse(bytes);
      if (pkg.name?.startsWith("@isocan/")) {
        if (await fs.realpath(path.join(directory, "node_modules", pkg.name)) !== await fs.realpath(path.dirname(filename))) throw new Error(`Foreign workspace under runtime label: ${pkg.name}`);
        workspaces.push({ name: pkg.name, source: path.dirname(file.path) });
      }
    }
  }
  const html = await fs.readFile(path.join(directory, "packages/web/dist/index.html"));
  const entry = html.toString().match(/src="\/assets\/(index-[^"/]+\.js)"/)?.[1];
  if (!entry) throw new Error("Runtime has no built web entry");
  const bytes = await fs.readFile(path.join(directory, "packages/web/dist/assets", entry));
  const expectedBuild = builds[revision];
  if (entry !== expectedBuild.entry || bytes.length !== expectedBuild.bytes || studyHash(bytes) !== expectedBuild.sha256) throw new Error("Built entry differs from the independently verified frozen runtime");
  return { sourceRevision: revision, directory: await fs.realpath(directory), sourceFiles, sourceSha256: studyHash(JSON.stringify(sourceFiles)), dependencyLockSha256: studyHash(await fs.readFile(path.join(directory, "package-lock.json"))), workspaces, build: { entry, bytes: bytes.length, sha256: studyHash(bytes), indexSha256: studyHash(html), files: await studyTreeIdentity(path.join(directory, "packages/web/dist")) } };
}

/** A contained read refuses traversal and symlinks, including symlinked parent directories. */
export async function studyPath(root, relative, { missing = false } = {}) {
  if (typeof relative !== "string" || !relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => !part || part === "." || part === "..")) throw new Error("Expected a contained relative path");
  const base = await fs.realpath(root); let current = base;
  const parts = relative.split("/");
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error("Task paths cannot follow symbolic links"); }
    catch (error) { if (error.code === "ENOENT" && missing) continue; throw error; }
  }
  if (!current.startsWith(base + path.sep)) throw new Error("Path escaped owned data");
  return current;
}

/** Own the entire subprocess group and bound output/deadline; no shell interpolation or implicit retry. */
export function studyProcess(command, args, { cwd, env, input = null, milliseconds = 30_000, maxBytes = 4_194_304 } = {}) {
  return new Promise(resolve => {
    const child = spawn(command, args, { cwd, env, detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"] });
    const stdout = [], stderr = []; let size = 0, failure = null;
    const stop = reason => { failure ??= reason; if (child.exitCode !== null || child.signalCode !== null || !child.pid) return; try { process.platform === "win32" ? child.kill("SIGKILL") : process.kill(-child.pid, "SIGKILL"); } catch {} };
    const timer = setTimeout(() => stop("deadline"), milliseconds);
    const capture = target => bytes => { size += bytes.length; if (size > maxBytes) stop("output-bound"); else target.push(bytes); };
    child.stdout.on("data", capture(stdout)); child.stderr.on("data", capture(stderr)); child.stdin.on("error", () => {});
    child.on("error", error => { failure = error.code ?? "spawn-failed"; });
    child.on("close", (code, signal) => { clearTimeout(timer); resolve({ code, signal, failure, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") }); });
    child.stdin.end(input);
  });
}

/** Start one owned local fixture service and keep its deadline/cleanup attached to the returned handle. */
export async function startStudyService(command, args, { cwd, env, milliseconds = 60_000, input = null }) {
  const child = spawn(command, args, { cwd, env, detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"] });
  child.stdin.on("error", () => {}); child.stdin.end(input);
  const closed = new Promise(resolve => child.once("close", resolve)); let output = "", error = "";
  const kill = () => { if (child.exitCode !== null || child.signalCode !== null || !child.pid) return; try { process.platform === "win32" ? child.kill("SIGKILL") : process.kill(-child.pid, "SIGKILL"); } catch {} };
  const deadline = setTimeout(kill, milliseconds);
  try {
    const url = await new Promise((resolve, reject) => {
      const startup = setTimeout(() => reject(new Error("Fixture service startup deadline")), 10_000);
      const finish = (error, value) => { clearTimeout(startup); error ? reject(error) : resolve(value); };
      child.once("error", error => finish(error)); child.once("close", code => finish(new Error(`Fixture service exited ${code}: ${error}`)));
      child.stderr.on("data", bytes => { error += bytes; if (error.length > 1_048_576) kill(); });
      child.stdout.on("data", bytes => {
        output += bytes; if (output.length > 1_048_576) return kill();
        for (const line of output.split("\n")) { try { const value = JSON.parse(line); if (/^http:\/\/127\.0\.0\.1:\d+$/.test(value.url)) finish(null, value.url); } catch {} }
      });
    });
    return { url, async close() { clearTimeout(deadline); kill(); await closed; } };
  } catch (error) { clearTimeout(deadline); kill(); await closed; throw error; }
}

const ownedRuns = new WeakMap();
/** Provider launch requires this live owned runtime handle, not an arbitrary caller-supplied daemon URL. */
export function assertStudyRunRuntime(config, manifest) {
  const proof = ownedRuns.get(config);
  if (!proof || proof.config !== studyHash(JSON.stringify(config)) || proof.manifest !== studyHash(JSON.stringify(manifest))) throw new Error("Native execution requires an unchanged live owned runtime");
}

/** A generation starts from its own copy of the verified synthetic home and task files, never a prior output. */
export async function openStudyRunRuntime({ manifest, runId, directory }) {
  const plan = manifest.dry.runs.find(row => row.runId === runId); if (!plan) throw new Error("Unknown run");
  const arm = plan.condition === "A" ? "A" : "B", entry = manifest.materializations.find(row => row.condition === arm);
  const materialization = JSON.parse(await fs.readFile(entry.path, "utf8")), mapping = materialization.mappings.find(row => row.fixtureId === plan.fixtureId && row.entrance === plan.entrance);
  if (JSON.stringify(await studyTreeIdentity(path.join(materialization.home, "projects", mapping.canvasId))) !== JSON.stringify(mapping.persistedState)) throw new Error("Prepared canvas state changed after materialization");
  await fs.mkdir(directory, { recursive: false });
  const workspace = path.join(directory, "workspace");
  const home = path.join(directory, "home"); await fs.mkdir(path.join(home, "projects"), { recursive: true });
  // A run has one canvas, not a copy of the entire matched study. Only the
  // synthetic registry is shared; no other project, archive or evaluator file is copied.
  for (const name of ["actors.json", "actors.jsonl", "identity.json", "homes.json"]) await fs.copyFile(path.join(materialization.home, name), path.join(home, name));
  await fs.cp(path.join(materialization.home, "projects", mapping.canvasId), path.join(home, "projects", mapping.canvasId), { recursive: true, dereference: false, errorOnExist: true, force: false });
  await fs.cp(mapping.workspace, workspace, { recursive: true, dereference: false, errorOnExist: true, force: false });
  for (const resource of mapping.resources.filter(row => row.path !== "isocan --agent-help")) if (studyHash(await fs.readFile(await studyPath(workspace, resource.path))) !== resource.sha256) throw new Error("Fresh run source differs from its materialized input");
  const runtime = manifest.runtimes[arm], worker = fileURLToPath(new URL("./design-partner-runtime-child.mjs", import.meta.url));
  const service = await startStudyService(process.execPath, ["--import", path.join(runtime.directory, "node_modules/tsx/dist/loader.mjs"), worker], { cwd: runtime.directory, env: { PATH: process.env.PATH, HOME: process.env.HOME, ISOCAN_STORE: "file" }, milliseconds: manifest.limits.millisecondsPerRun + 30_000, input: JSON.stringify({ action: "serve", source: runtime.directory, directory, canvasId: mapping.canvasId, mapping }) });
  let repositoryService = null;
  try {
    if (mapping.repository) repositoryService = await startStudyService("npm", ["start"], { cwd: path.join(workspace, "repo"), env: { PATH: process.env.PATH, PORT: "0" }, milliseconds: manifest.limits.millisecondsPerRun + 30_000 });
    const prompt = plan.condition === "C" ? `${mapping.prompt}\n\nExplicit optional treatment: opt into isocan's adapted craft guidance with the actual design craft procedure for this task. This is isocan-craft-v1 adapted guidance, not the complete native Impeccable playbook. Read its preserved task context and keep any native-package limitation explicit.` : mapping.prompt;
    const config = { source: runtime.directory, workspace, home: path.join(directory, "home"), base: service.url, repositoryUrl: repositoryService?.url ?? null, canvasId: mapping.canvasId, condition: plan.condition, runId, fixtureId: plan.fixtureId, sessionId: "study-agent", actor: materialization.actors.agent, prompt, mapping };
    ownedRuns.set(config, { config: studyHash(JSON.stringify(config)), manifest: studyHash(JSON.stringify(manifest)) });
    return { config, async close() { ownedRuns.delete(config); await repositoryService?.close(); await service.close(); } };
  } catch (error) { await repositoryService?.close(); await service.close(); throw error; }
}

/** Materialize through a child which imports only the chosen source runtime; return its verified public map. */
export async function materializeStudyRuntime({ runtime, directory, fixtures, entrances = ["canvas-chat", "external-agent"] }) {
  await fs.mkdir(directory, { recursive: false });
  const command = { action: "materialize", source: runtime.directory, directory: path.resolve(directory), fixtures: path.resolve(fixtures), entrances, runtime };
  const worker = fileURLToPath(new URL("./design-partner-runtime-child.mjs", import.meta.url));
  const result = await studyProcess(process.execPath, ["--import", path.join(runtime.directory, "node_modules/tsx/dist/loader.mjs"), worker], { cwd: runtime.directory, env: { PATH: process.env.PATH, HOME: process.env.HOME, ISOCAN_STORE: "file" }, input: JSON.stringify(command), milliseconds: 180_000, maxBytes: 8_388_608 });
  if (result.code !== 0) throw new Error(`Runtime materialization failed: ${result.stderr}\n${result.stdout}`);
  return JSON.parse(result.stdout);
}
