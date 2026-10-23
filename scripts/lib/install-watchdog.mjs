import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { constants } from "node:os";

/** No command names, arguments or environment: even an executable name can
 * carry private text. ps is separately bounded and a failed snapshot is unknown. */
export function processGroupSnapshot(group) {
  const read = spawnSync("ps", ["-axo", "pid=,ppid=,pgid=,stat="], {
    encoding: "utf8", timeout: 1000, maxBuffer: 1024 * 1024,
  });
  if (read.status !== 0) return { available: false, processes: [] };
  const processes = read.stdout.split("\n").flatMap((line) => {
    const fields = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+([A-Za-z+<>NslLEWX-]+)\s*$/.exec(line);
    if (!fields || Number(fields[3]) !== group) return [];
    return [{ pid: Number(fields[1]), parentPid: Number(fields[2]), group: Number(fields[3]), state: fields[4] }];
  });
  return { available: true, truncated: processes.length > 128, processes: processes.slice(0, 128) };
}

/** Supervise a real POSIX process group. The CLI deliberately supplies only
 * npm ci; command injection here is a test seam, not a user-facing option. */
export async function superviseInstall({ command, args, cwd, env = process.env,
  reportPath, metadata = {}, deadlineMs = 300_000, graceMs = 5000,
  heartbeatMs = 15_000, stdout = process.stdout, stderr = process.stderr }) {
  for (const value of [deadlineMs, graceMs, heartbeatMs]) {
    if (!Number.isSafeInteger(value) || value <= 0 || value > 900_000) throw new Error("invalid watchdog bound");
  }
  if (process.platform === "win32") throw new Error("suite install watchdog requires POSIX process groups");
  const started = Date.now();
  const record = { schema: 1, ...metadata, startedAt: new Date(started).toISOString(),
    deadlineMs, graceMs, heartbeatMs, lastHeartbeatMs: 0, lastOutputMs: null,
    status: "running", installer: { exitCode: null, signal: null }, snapshots: [] };
  let evidenceError = false;
  const write = () => {
    record.elapsedMs = Date.now() - started;
    const temporary = `${reportPath}.tmp-${process.pid}`;
    try {
      mkdirSync(path.dirname(reportPath), { recursive: true });
      writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
      renameSync(temporary, reportPath);
    } catch {
      try { rmSync(temporary, { force: true }); } catch { /* original failure is retained */ }
      evidenceError = true; stderr.write("install watchdog: diagnostic write failed\n");
    }
  };
  write();
  return await new Promise((resolve) => {
    let settled = false;
    let terminating = false;
    let graceTimer;
    let child;
    let completedCode;
    const forwardingCleanup = [];
    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadlineTimer);
      clearTimeout(graceTimer);
      clearInterval(heartbeat);
      process.removeListener("SIGTERM", onTerm);
      process.removeListener("SIGINT", onInt);
      for (const cleanup of forwardingCleanup) cleanup();
      record.completedAt = new Date().toISOString();
      if (evidenceError && code === 0) { code = 1; record.status = "evidence_failed"; }
      record.wrapperExitCode = code;
      write();
      if (evidenceError && code === 0) { code = 1; record.wrapperExitCode = 1; record.status = "evidence_failed"; write(); }
      resolve({ code, record });
    };
    const kill = (signal) => {
      if (!child.pid) return;
      try { process.kill(-child.pid, signal); }
      catch (error) { if (error.code !== "ESRCH") record.cleanupError = error.code ?? "unknown"; }
    };
    const terminate = (reason, code) => {
      if (terminating || settled) return;
      terminating = true;
      record.status = reason;
      record.snapshots.push({ phase: "before-term", elapsedMs: Date.now() - started, ...processGroupSnapshot(child.pid) });
      record.beforeTermEvidenceAt = new Date().toISOString();
      write(); // The diagnostic exists BEFORE either signal is sent.
      stderr.write(`install watchdog: ${reason}; elapsed=${record.elapsedMs}ms; last-output=${record.lastOutputMs ?? "unknown"}ms; sending TERM\n`);
      record.termSentAt = new Date().toISOString();
      kill("SIGTERM");
      graceTimer = setTimeout(() => {
        // Never clear this on leader exit: a TERM-resistant descendant may remain.
        record.snapshots.push({ phase: "before-kill", elapsedMs: Date.now() - started, ...processGroupSnapshot(child.pid) });
        record.killSentAt = new Date().toISOString();
        kill("SIGKILL");
        // Do not depend on pipe close: a descendant may retain a pipe after the
        // leader exits. Reap status when delivered, then stop our own pipe handles.
        setTimeout(() => {
          record.snapshots.push({ phase: "after-kill", elapsedMs: Date.now() - started, ...processGroupSnapshot(child.pid) });
          child.stdout?.destroy(); child.stderr?.destroy(); child.unref();
          finish(code);
        }, 50);
      }, graceMs);
    };
    const onTerm = () => terminate("cancelled", 143);
    const onInt = () => terminate("cancelled", 130);
    const heartbeat = setInterval(() => {
      record.lastHeartbeatMs = Date.now() - started;
      stderr.write(`install watchdog: elapsed=${record.lastHeartbeatMs}ms; last-output=${record.lastOutputMs ?? "unknown"}ms\n`);
      write();
    }, heartbeatMs);
    const deadlineTimer = setTimeout(() => terminate("timed_out", 124), deadlineMs);
    child = spawn(command, args, { cwd, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    record.processGroup = child.pid ?? null;
    process.on("SIGTERM", onTerm);
    process.on("SIGINT", onInt);
    const forward = (input, output) => {
      let blocked = false;
      const resume = () => {
        blocked = false;
        if (!settled) { input.resume(); pump(); }
      };
      const pump = () => {
        if (blocked || settled) return;
        let chunk;
        while ((chunk = input.read(Math.min(input.readableLength, 64 * 1024) || undefined)) !== null) {
          record.lastOutputMs = Date.now() - started;
          if (output.write(chunk) === false) {
            // A slow runner log must back up the child pipe, not accumulate an
            // unbounded queue in this wrapper. Timers remain independent of drain.
            blocked = true;
            input.pause();
            output.once("drain", resume);
            return;
          }
        }
      };
      // Pull mode also survives ChildProcess's automatic stdio resume on exit:
      // that flush must not enqueue another chunk while the destination is full.
      input.on("readable", pump);
      forwardingCleanup.push(() => {
        input.removeListener("readable", pump);
        output.removeListener?.("drain", resume);
      });
    };
    forward(child.stdout, stdout);
    forward(child.stderr, stderr);
    child.once("error", (error) => {
      record.status = "spawn_failed";
      record.spawnError = /^[A-Z0-9_]+$/.test(error.code ?? "") ? error.code : "unknown";
      finish(1);
    });
    child.once("exit", (code, signal) => {
      record.installer = { exitCode: code, signal };
      if (terminating) return;
      const group = processGroupSnapshot(child.pid);
      let groupExists = true;
      try { process.kill(-child.pid, 0); } catch (error) { groupExists = error.code !== "ESRCH"; }
      if (groupExists && (!group.available || group.processes.some((item) => !item.state.startsWith("Z")))) {
        terminate("orphaned_children", code || 1);
        return;
      }
      record.status = code === 0 ? "success" : "installer_failed";
      // POSIX signal exit convention, retaining the original signal separately.
      completedCode = code ?? (128 + (constants.signals[signal] ?? 1));
      // Preserve trailing output under backpressure. close follows pipe EOF;
      // a sink that never drains still hits the independent deadline above.
    });
    child.once("close", () => { if (!terminating && completedCode !== undefined) finish(completedCode); });
  });
}
