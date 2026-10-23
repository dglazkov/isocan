#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { superviseInstall, finishInstallProcess } from "./lib/install-watchdog.mjs";
import { installInputDigests } from "./lib/install-inputs.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const token = (value) => /^[a-zA-Z0-9_.-]{1,100}$/.test(value ?? "") ? value : null;
const git = (...args) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", timeout: 2000 });
  return result.status === 0 && /^[a-f0-9]{40,64}$/.test(result.stdout.trim()) ? result.stdout.trim() : null;
};

try {
  const stage = token(process.env.ISOCAN_SETUP_STAGE);
  if (!stage) throw new Error("missing or invalid setup stage");
  const npmVersion = spawnSync("npm", ["--version"], { cwd: root, encoding: "utf8", timeout: 5000 });
  if (npmVersion.status !== 0 || !/^\d+\.\d+\.\d+\s*$/.test(npmVersion.stdout)) throw new Error("npm version unavailable");
  const run = { id: token(process.env.GITHUB_RUN_ID), attempt: Number(process.env.GITHUB_RUN_ATTEMPT) || null,
    job: token(process.env.GITHUB_JOB), stage };
  const clean = spawnSync("git", ["-c", "core.fsmonitor=false", "status", "--porcelain", "--untracked-files=normal"], { cwd: root, encoding: "utf8", timeout: 2000 });
  const metadata = { run, inputs: {
    clean: clean.status === 0 && clean.stdout.trim() === "",
    head: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"),
    ...installInputDigests(root), runtime: { node: process.version, npm: npmVersion.stdout.trim(), platform: process.platform, arch: process.arch },
    flags: ["ci"],
  } };
  const artifact = `install-${run.id ?? "local"}-${run.attempt ?? 1}-${run.job ?? "local"}-${stage}`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `artifact-name=${artifact}\n`);
  const result = await superviseInstall({ command: "npm", args: ["ci"], cwd: root,
    reportPath: path.join(root, ".isocan/install-diagnostics.json"), metadata });
  finishInstallProcess(result.code);
} catch {
  // Errors can contain paths/arguments. Keep the configuration failure explicit,
  // but do not turn it into an arbitrary diagnostic-data disclosure.
  console.error("install watchdog: preflight or evidence failure; installation did not succeed");
  finishInstallProcess(1);
}
