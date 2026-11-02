import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { constants } from "node:os";
import { Writable } from "node:stream";

/** The CLI owns its process; library supervision must not destroy a caller's
 * stdout/stderr. Called only after the diagnostic and group cleanup finish. */
export function finishInstallProcess(code) {
  // Failure evidence is already on disk and the group has been cleaned. A
  // runner that stopped reading logs must not keep this CLI alive via a pending
  // stdout write. Success keeps normal flushing; never truncate successful logs.
  if (code !== 0) process.exit(code);
  process.exitCode = code;
}

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
  let logDiagnostic = () => {};
  const write = () => {
    record.elapsedMs = Date.now() - started;
    const temporary = `${reportPath}.tmp-${process.pid}`;
    try {
      mkdirSync(path.dirname(reportPath), { recursive: true });
      writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
      renameSync(temporary, reportPath);
    } catch {
      try { rmSync(temporary, { force: true }); } catch { /* original failure is retained */ }
      evidenceError = true; logDiagnostic("install watchdog: diagnostic write failed\n");
    }
  };
  return await new Promise((resolve) => {
    let settled = false;
    let terminating = false;
    let graceTimer;
    let child;
    let completedCode;
    let childClosed = false;
    const outputs = new Map();
    const forwardingCleanup = [];
    const cleanupOutputErrors = () => {
      if (!settled) return;
      for (const [output, state] of outputs) {
        if (state.cleanupScheduled || state.pending > 0) continue;
        // An asynchronous _destroy can delay error delivery beyond the write
        // callback and beyond supervision. Keep the listener until that event
        // (or close), rather than guessing how many event-loop turns it takes.
        if (state.broken && !state.errorSeen && !state.closed && typeof output.on === "function") continue;
        state.cleanupScheduled = true;
        setImmediate(() => {
          output.removeListener?.("error", state.onError);
          output.removeListener?.("close", state.onClose);
        });
      }
    };
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
      cleanupOutputErrors();
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
      logDiagnostic(`install watchdog: ${reason}; elapsed=${record.elapsedMs}ms; last-output=${record.lastOutputMs ?? "unknown"}ms; sending TERM\n`);
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
    const maybeFinish = () => {
      if (!terminating && childClosed && completedCode !== undefined && [...outputs.values()].every((state) => state.pending === 0)) finish(completedCode);
    };
    const outputFailed = (state, error) => {
      if (state.broken) return;
      state.broken = true;
      (record.outputFailures ??= []).push({ streams: [...state.names],
        code: /^[A-Z0-9_]+$/.test(error?.code ?? "") ? error.code : "unknown" });
      if (settled) return;
      child?.stdout?.pause(); child?.stderr?.pause();
      if (!child) { record.status = "output_failed"; write(); }
      else if (terminating) write(); // Preserve timeout/cancellation and its original cleanup clock.
      else terminate("output_failed", 1);
    };
    const outputWrite = (output, chunk) => {
      const state = outputs.get(output);
      if (settled || state.broken) return false;
      const tracked = output instanceof Writable;
      let completed = false;
      if (tracked) state.pending++;
      const complete = (error) => {
        if (completed) return;
        completed = true;
        state.pending--;
        if (error) outputFailed(state, error);
        maybeFinish();
        cleanupOutputErrors();
      };
      try { return tracked ? output.write(chunk, complete) : output.write(chunk); }
      catch (error) {
        if (tracked && !completed) { completed = true; state.pending--; }
        outputFailed(state, error);
        return false;
      }
    };
    for (const [name, output] of [["stdout", stdout], ["stderr", stderr]]) {
      if (outputs.has(output)) { outputs.get(output).names.push(name); continue; }
      const state = { names: [name], pending: 0, broken: false, errorSeen: false, closed: false, cleanupScheduled: false };
      state.onError = (error) => { state.errorSeen = true; outputFailed(state, error); cleanupOutputErrors(); };
      state.onClose = () => { state.closed = true; cleanupOutputErrors(); };
      outputs.set(output, state);
      output.on?.("error", state.onError);
      output.on?.("close", state.onClose);
    }
    logDiagnostic = (message) => outputWrite(stderr, message);
    const onTerm = () => terminate("cancelled", 143);
    const onInt = () => terminate("cancelled", 130);
    const heartbeat = setInterval(() => {
      record.lastHeartbeatMs = Date.now() - started;
      logDiagnostic(`install watchdog: elapsed=${record.lastHeartbeatMs}ms; last-output=${record.lastOutputMs ?? "unknown"}ms\n`);
      write();
    }, heartbeatMs);
    const deadlineTimer = setTimeout(() => terminate("timed_out", 124), deadlineMs);
    write();
    if (record.outputFailures?.length) { finish(1); return; }
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
        if (blocked || settled || record.outputFailures?.length) return;
        let chunk;
        while ((chunk = input.read(Math.min(input.readableLength, 64 * 1024) || undefined)) !== null) {
          record.lastOutputMs = Date.now() - started;
          const accepted = outputWrite(output, chunk);
          if (outputs.get(output).broken) return;
          if (accepted === false) {
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
    child.once("close", () => { childClosed = true; maybeFinish(); });
  });
}
