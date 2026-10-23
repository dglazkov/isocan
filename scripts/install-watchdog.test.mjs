import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Writable } from "node:stream";
import { superviseInstall } from "./lib/install-watchdog.mjs";
import { installInputDigests } from "./lib/install-inputs.mjs";
import { installRetryPlan } from "./install-retry-plan.mjs";

const sink = { write() {} };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function fixture(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "isocan-install-watchdog-"));
  try { return await fn(dir); } finally {
    // Failure paths clean the fixture's own children even if the watchdog is
    // broken. A failed assertion must not leave a real detached process alive.
    const pids = ["leader.pid", "child.pid", "descendant.pid"].flatMap((file) => {
      try { const value = Number(readFileSync(path.join(dir, file), "utf8")); return Number.isSafeInteger(value) && value > 1 ? [value] : []; } catch { return []; }
    });
    try {
      const group = JSON.parse(readFileSync(path.join(dir, "report.json"), "utf8")).processGroup;
      if (Number.isSafeInteger(group) && group > 1) process.kill(-group, "SIGKILL");
    } catch { /* already exited or no spawn */ }
    for (const pid of pids) { try { process.kill(pid, "SIGKILL"); } catch { /* already exited */ } }
    await delay(50);
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
function run(dir, source, options = {}) {
  return superviseInstall({ command: process.execPath, args: ["-e", source], cwd: dir,
    reportPath: path.join(dir, "report.json"), deadlineMs: 1000, graceMs: 100,
    heartbeatMs: 100, stdout: sink, stderr: sink, ...options });
}
function live(pid) {
  try { process.kill(pid, 0); } catch (error) { if (error.code === "ESRCH") return false; throw error; }
  // A descendant's PID is NOT its process-group ID. Inspect that PID directly.
  const state = spawnSync("ps", ["-p", String(pid), "-o", "stat="], { encoding: "utf8", timeout: 1000, maxBuffer: 4096 });
  return state.status !== 0 || !state.stdout.trim().startsWith("Z");
}
async function gone(pid) {
  for (let i = 0; i < 50; i++) { if (!live(pid)) return; await delay(20); }
  assert.fail(`process ${pid} survived group cleanup`);
}

test("successful output and exit status remain unchanged; output is not retained in diagnostics", async () => fixture(async (dir) => {
  let output = "";
  const result = await run(dir, 'console.log("secret-output-marker")', { stdout: { write(data) { output += data; } } });
  assert.equal(result.code, 0);
  assert.equal(result.record.status, "success");
  assert.deepEqual(result.record.installer, { exitCode: 0, signal: null });
  assert.equal(output, "secret-output-marker\n");
  assert.ok(!readFileSync(path.join(dir, "report.json"), "utf8").includes("secret-output-marker"));
}));

test("stdout claiming success never masks nonzero installer exit", async () => fixture(async (dir) => {
  const result = await run(dir, 'console.log("success"); process.exit(23)');
  assert.equal(result.code, 23);
  assert.equal(result.record.installer.exitCode, 23);
  assert.equal(result.record.status, "installer_failed");
}));

test("output backpressure bounds buffering and cannot suspend the watchdog deadline", async () => fixture(async (dir) => {
  let writes = 0;
  let firstChunkBytes = 0;
  let release;
  const blocked = new Writable({ highWaterMark: 1, write(chunk, _encoding, callback) { writes++; firstChunkBytes = chunk.length; release = callback; } });
  try {
    const source = `const block=Buffer.alloc(65536,120);
      function pump(){while(process.stdout.write(block)){};process.stdout.once('drain',pump)}pump();`;
    const result = await run(dir, source, { stdout: blocked });
    assert.equal(result.code, 124);
    assert.equal(result.record.status, "timed_out");
    assert.equal(writes, 1, "the blocked destination receives only its first chunk until drain");
    assert.ok(firstChunkBytes > 0);
    assert.equal(blocked.writableLength, firstChunkBytes, "the wrapper must buffer only the first pipe chunk, whose size is platform-dependent");
    assert.ok(result.record.lastHeartbeatMs > 0, "backpressure must not stall heartbeat/deadline timers");
    assert.equal(blocked.listenerCount("drain"), 0, "cleanup must remove the pending resume listener");
    await gone(result.record.processGroup);
  } finally { release?.(); blocked.destroy(); }
}));

test("draining a slow output sink resumes forwarding without truncating successful output", async () => fixture(async (dir) => {
  const chunks = [];
  const slow = new Writable({ highWaterMark: 1, write(chunk, _encoding, callback) { chunks.push(chunk); setTimeout(callback, 10); } });
  try {
    const result = await run(dir, "process.stdout.write('x'.repeat(256 * 1024))", { stdout: slow });
    await new Promise((resolve, reject) => { slow.once("error", reject); slow.end(resolve); });
    assert.equal(result.code, 0);
    assert.equal(Buffer.concat(chunks).toString(), "x".repeat(256 * 1024));
    assert.equal(slow.listenerCount("drain"), 0);
  } finally { slow.destroy(); }
}));

async function outputFailureControl(mode) {
  return fixture(async (dir) => {
    const module = new URL("./lib/install-watchdog.mjs", import.meta.url).href;
    const childSource = mode === "late" ? "process.stdout.write('ready');" :
      `const fs=require('node:fs'); process.on('SIGTERM',()=>{});
       fs.writeFileSync('child.pid',String(process.pid));
       setInterval(()=>{${mode === "heartbeat" ? "" : "process.stdout.write('ready');"}},20);`;
    const script = `import {Writable} from 'node:stream';import {writeFileSync} from 'node:fs';
      import {superviseInstall} from ${JSON.stringify(module)};
      const error=()=>Object.assign(new Error('private-output-error-marker'),{code:'EPIPE'});
      let writes=0;
      const broken=${mode === "throw" ? "{write(){writes++;throw error()}}" :
        mode === "delayed-destroy" ? "new Writable({write(_chunk,_encoding,callback){writes++;setTimeout(()=>callback(error()),100)},destroy(error,callback){setTimeout(()=>callback(error),1000)}})" :
        "new Writable({write(_chunk,_encoding,callback){writes++;setTimeout(()=>callback(error()),100)}})"};
      const quiet={write(){}};
      process.on('uncaughtExceptionMonitor',()=>writeFileSync(${JSON.stringify(path.join(dir, "uncaught-error"))},'uncaught'));
      const result=await superviseInstall({command:process.execPath,args:['-e',${JSON.stringify(childSource)}],
        cwd:${JSON.stringify(dir)},reportPath:${JSON.stringify(path.join(dir, "report.json"))},
        stdout:${mode === "heartbeat" ? "quiet" : "broken"},stderr:${mode === "heartbeat" || mode === "throw" ? "broken" : "quiet"},
        deadlineMs:2000,graceMs:100,heartbeatMs:500});
      await import('node:fs').then(fs=>fs.writeFileSync(${JSON.stringify(path.join(dir, "wrapper-result.json"))},JSON.stringify({code:result.code,writes})));
      process.exitCode=result.code;`;
    writeFileSync(path.join(dir, "wrapper.mjs"), script);
    const wrapper = spawn(process.execPath, [path.join(dir, "wrapper.mjs")], { stdio: "ignore" });
    const timeout = setTimeout(() => wrapper.kill("SIGKILL"), 6000);
    let exited;
    try { exited = await new Promise((resolve) => wrapper.once("exit", (code, signal) => resolve({ code, signal }))); }
    finally { clearTimeout(timeout); wrapper.kill("SIGKILL"); }
    assert.deepEqual(exited, { code: 1, signal: null });
    assert.equal(existsSync(path.join(dir, "uncaught-error")), false, "output errors must stay handled even after supervision finishes");
    const reportText = readFileSync(path.join(dir, "report.json"), "utf8");
    const report = JSON.parse(reportText);
    assert.equal(report.status, "output_failed");
    assert.equal(report.wrapperExitCode, 1);
    assert.ok(report.completedAt && report.termSentAt && report.killSentAt);
    assert.ok(report.outputFailures.some((failure) => failure.code === "EPIPE"));
    assert.ok(!reportText.includes("private-output-error-marker"));
    const result = JSON.parse(readFileSync(path.join(dir, "wrapper-result.json"), "utf8"));
    assert.equal(result.code, 1);
    assert.equal(result.writes, 1, "a broken destination must not receive recursive diagnostic writes");
    if (mode === "late") assert.deepEqual(report.installer, { exitCode: 0, signal: null });
    else {
      assert.equal(report.installer.signal, "SIGKILL");
      await gone(Number(readFileSync(path.join(dir, "child.pid"), "utf8")));
    }
  });
}

test("output errors: async stdout EPIPE retains evidence and kills the child", () => outputFailureControl("stdout"));
test("output errors: heartbeat stderr EPIPE retains evidence and kills the child", () => outputFailureControl("heartbeat"));
test("output errors: synchronous throws do not recurse into broken stderr", () => outputFailureControl("throw"));
test("late output errors cannot turn an installer exit zero into wrapper success", () => outputFailureControl("late"));
test("output errors delayed by Writable destruction remain handled after supervision", () => outputFailureControl("delayed-destroy"));

test("real wrapper exits within the cleanup bound when its OS stdout pipe stays unread", async () => fixture(async (dir) => {
  const module = new URL("./lib/install-watchdog.mjs", import.meta.url).href;
  const childSource = `const fs=require('node:fs');process.on('SIGTERM',()=>{});
    fs.writeFileSync('child.pid',String(process.pid));const block=Buffer.alloc(65536,120);
    function pump(){while(process.stdout.write(block)){};process.stdout.once('drain',pump)}pump();`;
  const script = `import {superviseInstall,finishInstallProcess} from ${JSON.stringify(module)};
    const result=await superviseInstall({command:process.execPath,args:['-e',${JSON.stringify(childSource)}],
      cwd:${JSON.stringify(dir)},reportPath:${JSON.stringify(path.join(dir, "report.json"))},
      deadlineMs:1000,graceMs:100,heartbeatMs:100});
    await import('node:fs').then(fs=>fs.writeFileSync(${JSON.stringify(path.join(dir, "wrapper-result.json"))},JSON.stringify({code:result.code})));
    finishInstallProcess(result.code);`;
  writeFileSync(path.join(dir, "wrapper.mjs"), script);
  const wrapper = spawn(process.execPath, [path.join(dir, "wrapper.mjs")], { stdio: ["ignore", "pipe", "ignore"] });
  // Deliberately never attach a reader: unlike a synthetic Writable, this
  // leaves a real pending libuv write when the OS pipe fills.
  const timeout = setTimeout(() => wrapper.kill("SIGKILL"), 6000);
  let exited;
  try { exited = await new Promise((resolve) => wrapper.once("exit", (code, signal) => resolve({ code, signal }))); }
  finally { clearTimeout(timeout); wrapper.kill("SIGKILL"); wrapper.stdout.destroy(); }
  assert.equal(JSON.parse(readFileSync(path.join(dir, "wrapper-result.json"))).code, 124, "supervision itself must finish before wrapper exit");
  assert.deepEqual(exited, { code: 124, signal: null });
  const report = JSON.parse(readFileSync(path.join(dir, "report.json")));
  assert.equal(report.status, "timed_out");
  assert.equal(report.wrapperExitCode, 124);
  assert.ok(report.completedAt && report.killSentAt);
  assert.equal(report.installer.signal, "SIGKILL");
  await gone(Number(readFileSync(path.join(dir, "child.pid"), "utf8")));
}));

test("an installer signal retains the actual signal and nonzero wrapper status", async () => fixture(async (dir) => {
  const result = await run(dir, 'process.kill(process.pid, "SIGTERM")');
  assert.equal(result.code, 143);
  assert.deepEqual(result.record.installer, { exitCode: null, signal: "SIGTERM" });
}));

test("a noisy non-exiting child hits the absolute deadline, with evidence before TERM", async () => fixture(async (dir) => {
  const result = await run(dir, `const fs=require('node:fs');
    process.on('SIGTERM',()=> { const record=JSON.parse(fs.readFileSync('report.json'));
      fs.writeFileSync('term-proof.json', JSON.stringify(record)); process.exit(0); });
    setInterval(()=>console.log('output-does-not-reset-the-deadline'),20);`);
  assert.equal(result.code, 124);
  assert.equal(result.record.status, "timed_out");
  // Three bounded ps probes can each take up to one second on a busy host.
  assert.ok(result.record.elapsedMs >= 1000 && result.record.elapsedMs < 5500);
  assert.equal(result.record.installer.exitCode, 0); // handler success cannot erase timeout
  const before = JSON.parse(readFileSync(path.join(dir, "term-proof.json"), "utf8"));
  assert.equal(before.status, "timed_out");
  assert.equal(before.snapshots[0].phase, "before-term");
  // A heartbeat may rewrite the report before the child handles TERM. The
  // immutable pre-signal timestamp and snapshot must already exist either way.
  assert.ok(Number.isFinite(Date.parse(before.beforeTermEvidenceAt)));
  assert.ok(Date.parse(before.beforeTermEvidenceAt) <= Date.parse(result.record.termSentAt));
  assert.ok(before.lastHeartbeatMs > 0 && before.lastOutputMs > 0);
}));

test("TERM-resistant group descendants are killed even after the leader exits", async () => fixture(async (dir) => {
  const descendant = `const fs=require('node:fs'); process.on('SIGTERM',()=>{}); fs.writeFileSync('descendant.pid',String(process.pid)); setInterval(()=>{},1000)`;
  const source = `const {spawn}=require('node:child_process'); const fs=require('node:fs');
    fs.writeFileSync('leader.pid',String(process.pid));
    spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:'ignore'}).unref();
    const ready=setInterval(()=>{ if(fs.existsSync('descendant.pid')&&fs.existsSync('allow-exit')){clearInterval(ready);process.exit(0)} },10);`;
  const running = run(dir, source);
  for (let i = 0; i < 100 && !existsSync(path.join(dir, "descendant.pid")); i++) await delay(10);
  const pid = Number(readFileSync(path.join(dir, "descendant.pid"), "utf8"));
  assert.equal(live(pid), true, "the liveness probe must see a real surviving descendant");
  writeFileSync(path.join(dir, "allow-exit"), "");
  const result = await running;
  assert.equal(result.code, 1);
  assert.equal(result.record.status, "orphaned_children");
  assert.equal(result.record.installer.exitCode, 0);
  assert.ok(result.record.killSentAt);
  await gone(pid);
}));

test("redacted process snapshots contain only identifiers and state, never arguments or environment", async () => fixture(async (dir) => {
  const result = await run(dir, "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)", {
    env: { ...process.env, PRIVATE_INSTALL_TEST: "secret-env-marker" }, deadlineMs: 1000,
  });
  assert.equal(result.code, 124);
  assert.equal(result.record.installer.signal, "SIGKILL");
  const json = readFileSync(path.join(dir, "report.json"), "utf8");
  assert.ok(!json.includes("secret-env-marker") && !json.includes("setInterval"));
  for (const snapshot of result.record.snapshots) {
    for (const process of snapshot.processes) assert.deepEqual(Object.keys(process).sort(), ["group", "parentPid", "pid", "state"]);
  }
  if (process.env.ISOCAN_TEST_REQUIRE_PROCESS_SNAPSHOT === "1") {
    assert.equal(result.record.snapshots[0].available, true);
    assert.ok(result.record.snapshots[0].processes.some((p) => p.pid === result.record.processGroup));
  }
  if (!result.record.snapshots[0].available) console.log("process-table access unavailable; snapshot absence is explicit");
}));

test("spawn and evidence-write failures cannot pass", async () => fixture(async (dir) => {
  const absent = await run(dir, "", { command: path.join(dir, "missing") });
  assert.equal(absent.code, 1);
  assert.equal(absent.record.status, "spawn_failed");
  assert.equal(absent.record.spawnError, "ENOENT");
  const denied = await run(dir, "", { reportPath: dir });
  assert.equal(denied.code, 1);
  assert.equal(denied.record.wrapperExitCode, 1);
}));

test("cancelling the wrapper kills the entire group and retains cancellation", async () => fixture(async (dir) => {
  const module = new URL("./lib/install-watchdog.mjs", import.meta.url).href;
  const script = `import {superviseInstall} from ${JSON.stringify(module)};
    const result=await superviseInstall({command:process.execPath,args:['-e',"const fs=require('node:fs');process.on('SIGTERM',()=>{});fs.writeFileSync('child.pid',String(process.pid));setInterval(()=>{},1000)"],cwd:${JSON.stringify(dir)},reportPath:${JSON.stringify(path.join(dir, "report.json"))},deadlineMs:10000,graceMs:100,heartbeatMs:100});process.exitCode=result.code;`;
  writeFileSync(path.join(dir, "wrapper.mjs"), script);
  const child = spawn(process.execPath, [path.join(dir, "wrapper.mjs")], { stdio: "ignore" });
  const closed = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  try {
    for (let i = 0; i < 100 && !existsSync(path.join(dir, "child.pid")); i++) await delay(10);
    assert.ok(existsSync(path.join(dir, "child.pid")));
    child.kill("SIGTERM");
    assert.deepEqual(await closed, { code: 143, signal: null });
    assert.equal(JSON.parse(readFileSync(path.join(dir, "report.json"))).status, "cancelled");
    await gone(Number(readFileSync(path.join(dir, "child.pid"), "utf8")));
  } finally { child.kill("SIGKILL"); }
}));

const inputs = { clean: true, head: "a".repeat(40), tree: "b".repeat(40), ...installInputDigests(),
  runtime: { node: "v24.22.1", npm: "11.8.0", platform: "linux", arch: "x64" }, flags: ["ci"] };
function retryEvidence() {
  const common = { runId: "42", attempt: 1, inputs, startedAt: "2026-10-22T00:00:00Z", completedAt: "2026-10-22T00:05:01Z" };
  return JSON.parse(JSON.stringify({ schema: 1, repository: "dglazkov/isocan", original: { runId: "42", attempt: 1, inputs },
    candidate: { runId: "42", attempt: 2, parentAttempt: 1, inputs }, expectedStages: ["checks", "suite-1", "suite-2", "suite-3", "suite-4"],
    jobs: [{ ...common, stage: "checks", jobId: "71", conclusion: "success" },
      { ...common, stage: "suite-1", jobId: "72", conclusion: "failure", failedStep: "install", productStepsStarted: false,
        operatorClassification: "transient-setup-only", provenance: { source: "github-actions-artifact", artifactId: "99", runId: "42", attempt: 1, jobId: "72", stage: "suite-1" },
        diagnostic: { schema: 1, status: "timed_out", wrapperExitCode: 124, inputs,
          installer: { exitCode: null, signal: "SIGTERM" },
          run: { id: "42", attempt: 1, stage: "suite-1" }, snapshots: [{ phase: "before-term" }], killSentAt: "2026-10-22T00:05:00Z" } },
      ...[2, 3, 4].map((n) => ({ ...common, stage: `suite-${n}`, jobId: String(72 + n), conclusion: "success" })) ] }));
}

test("retry proposal retains original success timestamps and one attempt parent, without executing", () => {
  const evidence = retryEvidence();
  const before = JSON.stringify(evidence);
  const result = installRetryPlan(evidence);
  assert.equal(result.eligible, true);
  assert.equal(result.recommendationOnly, true);
  assert.deepEqual(result.retainedSuccesses, evidence.jobs.filter((job) => job.conclusion === "success"));
  assert.deepEqual(result.retries, [{ stage: "suite-1", jobId: "72", runId: "42", parentAttempt: 1, nextAttempt: 2, diagnosticArtifactId: "99" }]);
  assert.equal(JSON.stringify(evidence), before);
  evidence.jobs[0].rawLog = "private-log-marker";
  evidence.jobs[0].inputs.rawEnvironment = "private-env-marker";
  const safe = JSON.stringify(installRetryPlan(evidence));
  assert.ok(!safe.includes("private-log-marker") && !safe.includes("private-env-marker"));
});

test("retry proposal refuses changed or unknown immutable inputs", () => {
  for (const key of Object.keys(inputs)) {
    for (const value of [null, "changed"]) {
      const evidence = retryEvidence(); evidence.candidate.inputs[key] = value;
      assert.equal(installRetryPlan(evidence).eligible, false, key);
    }
  }
});

test("retry proposal refuses product failures, missing stages/provenance, and any second retry", () => {
  const mutations = [
    (e) => { e.jobs[1].failedStep = "test"; }, (e) => { e.jobs[1].productStepsStarted = true; },
    (e) => { e.jobs[1].diagnostic.status = "installer_failed"; },
    (e) => { e.jobs[1].operatorClassification = null; }, (e) => { e.jobs[1].provenance = null; },
    (e) => { e.jobs[1].diagnostic.run.attempt = 2; }, (e) => { e.jobs[1].diagnostic.inputs.head = "f".repeat(40); },
    (e) => { e.jobs.pop(); }, (e) => { e.jobs[0].stage = "suite-1"; },
    (e) => { e.jobs[0].completedAt = null; }, (e) => { e.jobs[0].inputs.clean = false; },
    (e) => { e.jobs.pop(); e.expectedStages.pop(); },
    (e) => { e.jobs[1].diagnostic.snapshots = {}; },
    (e) => { e.jobs[1].provenance.jobId = "73"; },
    (e) => { e.jobs[1].diagnostic.installer = { exitCode: 23, signal: null }; },
    (e) => { e.jobs[1].jobId = e.jobs[0].jobId; },
    (e) => { e.candidate.inputs.runtime.node = "unknown"; },
    (e) => { for (const value of [e.original.inputs, e.candidate.inputs, ...e.jobs.map((j) => j.inputs), e.jobs[1].diagnostic.inputs]) value.manifest = "f".repeat(64); },
    (e) => { e.original.attempt = 2; e.candidate.attempt = 3; },
  ];
  for (const mutate of mutations) { const evidence = retryEvidence(); mutate(evidence); assert.equal(installRetryPlan(evidence).eligible, false); }
});

test("shared PR/release setup preserves four-shard union and retains bounded install diagnostics", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const action = readFileSync(path.join(root, ".github/actions/suite-setup/action.yml"), "utf8");
  const cli = readFileSync(path.join(root, "scripts/install-watchdog.mjs"), "utf8");
  assert.match(cli, /finishInstallProcess\(result.code\)/);
  assert.doesNotMatch(cli, /process\.exitCode/);
  assert.match(action, /run: node scripts\/install-watchdog.mjs/);
  assert.match(action, /if: always\(\) && steps.install.outputs.artifact-name != ''/);
  assert.match(action, /path: \.isocan\/install-diagnostics.json/);
  assert.match(action, /if-no-files-found: error/);
  assert.doesNotMatch(action, /continue-on-error/);
  for (const workflow of ["pr", "release"]) {
    const source = readFileSync(path.join(root, `.github/workflows/${workflow}.yml`), "utf8");
    assert.match(source, /shard: \[1, 2, 3, 4\]/);
    assert.match(source, /npm run test:ci -- --shard=\$\{\{ matrix.shard \}\}\/4/);
    assert.match(source, /stage: suite-\$\{\{ matrix.shard \}\}/);
    assert.match(source, /stage: checks/);
  }
});
