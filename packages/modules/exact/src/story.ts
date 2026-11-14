/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * **Tests are storyboards, the facts both surfaces share** (exact phase 5;
 * `docs/projects/exact/design.md` §9). Pure: no keys, no network, no node —
 * the CLI posts what the bridge printed, a paired browser lands what the
 * bridge answered, and both read and write a storyboard through these.
 *
 * - **A storyboard** is one `test` block of a `*.test.contract`, as a file
 *   of its own (`application/vnd.isocan.exact-storyboard+json`): the test's
 *   steps as written, and the last run on each host. Its versions are its
 *   runs: a run on a host is a new version carrying every host's latest run.
 * - **A run** is Exact's own `test <host>` on a copy of the one test with a
 *   `screenshot` after every step, so each step has the frame it acted on and
 *   the verdict is Exact's, not ours; a red run carries the failing step's
 *   reason (Exact's words), its frame, and the driver's `tree` at that moment
 *   (a cold `agent <host> --json` replay up to the step, one reply an
 *   operation).
 * - **Frames live inside the version** (`frames`, PNGs as data URLs keyed by
 *   their SHA-256): a blob named only by a property can be swept by garbage
 *   collection (exact phase 3's Open entry), and bytes inside a version never
 *   are. A frame two steps share is stored once.
 * - **A recording** (Drive mode's Record) is a test proposed from what a
 *   person pressed, its `expect` lines read off the `state` that changed
 *   between before and after; it becomes a core proposal item whose bytes are
 *   the test file with the test appended, and only the person's Keep writes
 *   it to disk.
 */

/** One step of a test, as written: its line in the file, the line's text, and the compiler's op. */
export interface StoryStep {
  line: number;
  text: string;
  op: string;
}

/** One row of the driver's `tree`, at the failing step: enough to see what was there instead. */
export interface TreeRow {
  depth: number;
  type: string;
  testId?: string;
  text?: string;
  label?: string;
  hidden?: boolean;
  inactive?: boolean;
}

export type StepState = "ok" | "fail" | "unreached";

/** One run on one host, as the storyboard keeps it. */
export interface StoryRun {
  host: string;
  /** When it ran (ISO). */
  at: string;
  /** Exact's verdict: `test "<name>": ok | FAIL | skipped`, or an error that kept it from running. */
  verdict: "ok" | "fail" | "skipped" | "error";
  /** What Exact said about the test, its own lines. */
  said: string[];
  /** Per step: how it went, and the frame it acted on (a key of `frames`), launch lines having none. */
  steps: Array<{ line: number; state: StepState; frame: string | null }>;
  /** The step that failed first: Exact's reason, the frame it acted on, and the driver's tree there. */
  failed: { line: number | null; reason: string; frame: string | null; tree: TreeRow[] | null; reply: unknown } | null;
  /** The frame after the last step (the run's end screen). */
  end: string | null;
  ms: number;
  error?: string;
}

export interface Storyboard {
  format: 1;
  app: { id: string; name: string };
  /** The test file, relative to the app. */
  file: string;
  test: { name: string; line: number; steps: StoryStep[] };
  /** The latest run on each host. */
  runs: Record<string, StoryRun>;
  /** Every frame a run refers to: SHA-256 → `data:image/png;base64,…`. */
  frames: Record<string, string>;
}

/** The ops a test may lead with: launch facts, not steps a frame shows. */
const LAUNCH_OPS = new Set(["at", "size", "seed", "locale", "time-zone", "epoch", "format-locale", "before-data", "fresh", "prefer", "fail-fetch"]);
export const isLaunchStep = (op: string) => LAUNCH_OPS.has(op);

/** One compiled test (`contract test`'s `tests[]`), as the bridge read it. */
export interface CompiledTest {
  name: string;
  steps: Array<{ op: string; line: number } & Record<string, unknown>>;
}

/**
 * **A storyboard from the test as written**: its steps (each one line, at the
 * line the compiler gave) and the `test` line above them. No runs yet.
 */
export function storyOf(app: { id: string; name: string }, file: string, fileText: string, test: CompiledTest): Storyboard {
  const lines = fileText.split("\n");
  const steps = test.steps.map((s) => ({ line: s.line, text: (lines[s.line - 1] ?? "").trim(), op: s.op }));
  const first = steps[0]?.line ?? 1;
  let line = first;
  for (let i = first - 1; i >= 1; i--) if (/^\s*test\s+"/.test(lines[i - 1] ?? "")) { line = i; break; }
  return { format: 1, app, file, test: { name: test.name, line, steps }, runs: {}, frames: {} };
}

/** Do two storyboards describe the same steps? Runs of other steps are not this test's any more. */
export function sameSteps(a: Storyboard, b: Storyboard): boolean {
  return a.test.name === b.test.name && JSON.stringify(a.test.steps.map((s) => [s.text, s.op])) === JSON.stringify(b.test.steps.map((s) => [s.text, s.op]));
}

/** The storyboard's bytes: stable key order, so the same runs are the same bytes and post no version. */
export function storyText(story: Storyboard): string {
  return `${JSON.stringify(story, null, 1)}\n`;
}

export function parseStory(text: string): Storyboard {
  const v = JSON.parse(text) as Storyboard;
  if (v?.format !== 1 || !v.test || !Array.isArray(v.test.steps)) throw new Error("not an Exact storyboard this build reads");
  return { ...v, runs: v.runs ?? {}, frames: v.frames ?? {} };
}

/** The canvas size of a storyboard: a column per step, a row per host. */
export function storySize(steps: number): { width: number; height: number } {
  return { width: Math.min(2600, 240 + Math.max(4, steps) * 132), height: 880 };
}

/**
 * **What the bridge's `run` reports** — the CLI posts from this, and a paired
 * browser lands it from the bridge's `/run` (where each frame's bytes ride
 * along as base64).
 */
export interface RunReport {
  ok: boolean;
  host: string;
  file: string;
  test: string;
  verdict: StoryRun["verdict"];
  said: string[];
  steps: Array<{ line: number; state: StepState; frame: { sha256: string; file?: string; png?: string } | null }>;
  failed: { line: number | null; reason: string; frame: { sha256: string; file?: string; png?: string } | null; tree: TreeRow[] | null; reply: unknown } | null;
  end: { sha256: string; file?: string; png?: string } | null;
  ms: number;
  error?: string;
}

/**
 * **A run, kept**: this host's run replaces its last, every other host's
 * stays, and the frames table keeps exactly what the runs refer to.
 * `bytesOf(frame)` gives a frame's base64 (from a file on the CLI, from the
 * bridge's answer in a browser).
 */
export function withRun(story: Storyboard, report: RunReport, bytesOf: (frame: { sha256: string; file?: string; png?: string }) => string | null, at: string): Storyboard {
  const frames: Record<string, string> = {};
  const keep = (f: { sha256: string; file?: string; png?: string } | null): string | null => {
    if (!f) return null;
    if (!frames[f.sha256]) {
      const known = story.frames[f.sha256];
      const b64 = known ? null : bytesOf(f);
      if (!known && !b64) return null;
      frames[f.sha256] = known ?? `data:image/png;base64,${b64}`;
    }
    return f.sha256;
  };
  const run: StoryRun = {
    host: report.host,
    at,
    verdict: report.verdict,
    said: report.said,
    steps: report.steps.map((s) => ({ line: s.line, state: s.state, frame: keep(s.frame) })),
    failed: report.failed ? { line: report.failed.line, reason: report.failed.reason, frame: keep(report.failed.frame), tree: report.failed.tree, reply: report.failed.reply } : null,
    end: keep(report.end),
    ms: report.ms,
    ...(report.error ? { error: report.error } : {}),
  };
  const runs = { ...story.runs, [report.host]: run };
  // The other hosts' frames, carried over.
  for (const r of Object.values(runs)) {
    if (r === run) continue;
    for (const k of [...r.steps.map((s) => s.frame), r.failed?.frame ?? null, r.end]) if (k && story.frames[k]) frames[k] = story.frames[k]!;
  }
  return { ...story, runs, frames };
}

/** A storyboard's steps carried onto new text (a save moved lines) with the runs dropped when the steps changed. */
export function rebased(old: Storyboard | null, next: Storyboard): Storyboard {
  if (!old || !sameSteps(old, next)) return next;
  // Same steps: keep the runs; the lines may have moved with the file.
  const runs: Record<string, StoryRun> = {};
  for (const [host, r] of Object.entries(old.runs)) {
    const at = (line: number | null) => { const i = old.test.steps.findIndex((s) => s.line === line); return i >= 0 ? next.test.steps[i]!.line : line; };
    runs[host] = { ...r, steps: r.steps.map((s) => ({ ...s, line: at(s.line)! })), failed: r.failed ? { ...r.failed, line: at(r.failed.line) } : null };
  }
  return { ...next, runs, frames: old.frames };
}

// ---------------------------------------------------------------- run requests over the canvas

/** What a browser whose door is shut asks for on a storyboard (`exact.run`): the hosts to run it on. */
export interface RunAsk { seq: number; by: string | null; hosts: string[] }
/** The answer (`exact.ran`): each host's verdict, the run itself being the storyboard's new version. */
export interface RunAnswer { seq: number; ok: boolean; hosts: Record<string, { verdict: StoryRun["verdict"]; line: number | null; reason: string | null }>; ms: number; error?: string }

export function parseRunAsk(text: string | undefined): RunAsk | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as RunAsk;
    if (!Number.isFinite(v?.seq) || !Array.isArray(v.hosts) || v.hosts.length === 0 || v.hosts.some((h) => typeof h !== "string")) return null;
    return { seq: v.seq, by: typeof v.by === "string" ? v.by : null, hosts: [...new Set(v.hosts)] };
  } catch {
    return null;
  }
}

export function parseRunAnswer(text: string | undefined): RunAnswer | null {
  if (!text) return null;
  try { const v = JSON.parse(text) as RunAnswer; return Number.isFinite(v?.seq) ? v : null; } catch { return null; }
}

/** `exact.verify` (on the index): Exact's `verify` on these hosts; `exact.verified` answers. */
export interface VerifyAsk { seq: number; by: string | null; hosts: string[] }
export interface VerifyAnswer {
  seq: number;
  ok: boolean;
  hosts: Record<string, { exit: number | null; problems: number | null; tests: { passed: number; failed: number; failing?: string[] } | null; posted: Array<{ itemId: string; status: string; shot: string }>; unmatched: Array<{ shot: string; why: string }>; error?: string }>;
  ms: number;
  error?: string;
}
export const parseVerifyAsk = (text: string | undefined): VerifyAsk | null => parseRunAsk(text);
export function parseVerifyAnswer(text: string | undefined): VerifyAnswer | null {
  if (!text) return null;
  try { const v = JSON.parse(text) as VerifyAnswer; return Number.isFinite(v?.seq) ? v : null; } catch { return null; }
}

// ---------------------------------------------------------------- recording (Drive mode's Record)

/** What a browser asks for when a recording stops (`exact.record`, on the screen it drove). */
export interface RecordAsk {
  seq: number;
  by: string | null;
  host: string;
  size: string;
  scheme: "light" | "dark";
  /** Where the drive started: the screen's shots. */
  shots: string;
  /** The drive's presses before Record was pressed, and the ones recorded. */
  before: string[];
  ops: string[];
  /** The test file it goes in, and the test's name. */
  file: string;
  name: string;
}

/** The answer (`exact.recorded`): the proposal item, its test text, the expect lines, or why not. */
export interface RecordAnswer { seq: number; ok: boolean; itemId: string | null; test: string | null; expects: string[]; ms: number; error?: string }

const DRIVE_OP = /^(?:tap [A-Za-z0-9_.:-]{1,80}|type [A-Za-z0-9_.:-]{1,80} "(?:[^"\\\n\r]|\\.){0,400}"|back)$/;
export const TEST_FILE = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,80}\.test\.contract$/;

export function parseRecordAsk(text: string | undefined): RecordAsk | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as RecordAsk;
    const ops = (x: unknown) => Array.isArray(x) && x.length <= 40 && x.every((o) => typeof o === "string" && DRIVE_OP.test(o));
    if (!Number.isFinite(v?.seq) || typeof v.host !== "string" || typeof v.shots !== "string" || !ops(v.before ?? []) || !ops(v.ops) || v.ops.length === 0) return null;
    if (typeof v.file !== "string" || !TEST_FILE.test(v.file) || typeof v.name !== "string" || !testName(v.name)) return null;
    return { seq: v.seq, by: typeof v.by === "string" ? v.by : null, host: v.host, size: typeof v.size === "string" ? v.size : "390x844", scheme: v.scheme === "dark" ? "dark" : "light", shots: v.shots, before: v.before ?? [], ops: v.ops, file: v.file, name: v.name.trim() };
  } catch {
    return null;
  }
}

export function parseRecordAnswer(text: string | undefined): RecordAnswer | null {
  if (!text) return null;
  try { const v = JSON.parse(text) as RecordAnswer; return Number.isFinite(v?.seq) ? v : null; } catch { return null; }
}

/** A test's name a recording may give: one line of plain words, no quotes or backslashes. */
export function testName(name: string): boolean {
  return /^[^"\\\n\r]{1,80}$/.test(name.trim()) && name.trim().length > 0;
}

/** On a recorded proposal (`exact.recording`): the file it appends to, the digest of the text it was written against, and the test. */
export interface Recording { file: string; base: string; test: string; host: string; seq: number }

export function parseRecording(text: string | undefined): Recording | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as Recording;
    return typeof v?.file === "string" && TEST_FILE.test(v.file) && /^[0-9a-f]{64}$/.test(v.base ?? "") && typeof v.test === "string" ? v : null;
  } catch {
    return null;
  }
}

/** A drive's press as a test's step: `tap add` → `tap "add"`, `type name "Sam"` → `type "name" "Sam"`. */
export function testStep(op: string): string {
  const tap = /^tap ([A-Za-z0-9_.:-]+)$/.exec(op);
  if (tap) return `tap "${tap[1]}"`;
  const type = /^type ([A-Za-z0-9_.:-]+) ("(?:[^"\\\n\r]|\\.)*")$/.exec(op);
  if (type) return `type "${type[1]}" ${type[2]}`;
  if (op === "back") return "back";
  const clock = /^clock (settle|data|\+\d{1,6})$/.exec(op);
  if (clock) return `clock ${clock[1]}`;
  throw new Error(`a recording holds tap, type, back and clock steps, not ${JSON.stringify(op)}`);
}

/** Where a screen's shots start and the presses they hold, as test lines (`at "/place/2"` leads when not the start). */
export function shotsSteps(shots: string): string[] {
  const out: string[] = [];
  for (const raw of shots.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    const at = /^at\s+"([^"]*)"$/.exec(line);
    if (at) { if (at[1] !== "/") out.push(`at "${at[1]}"`); continue; }
    out.push(testStep(line));
  }
  return out;
}

type Bag = Record<string, unknown>;

/**
 * A value as `expect state` writes it — a number, a string, a bool, `none`
 * or `[]`, the literals Exact's tests take — or null when it is none of them.
 */
function literal(v: unknown): string | null {
  if (v === null) return "none";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return String(v);
  if (typeof v === "string") return v.length <= 80 && !/[\n\r"\\]/.test(v) ? JSON.stringify(v) : null;
  if (Array.isArray(v) && v.length === 0) return "[]";
  return null;
}

/** The lines one moved value is written as: itself, a short list by its entries (`cart.0`), or a record's moved fields. */
function linesFor(path: string, was: unknown, value: unknown, depth: number): string[] {
  const lit = literal(value);
  if (lit !== null) return [`expect state ${path} == ${lit}`];
  if (Array.isArray(value)) {
    if (value.length > 3 || value.some((x) => literal(x) === null || Array.isArray(x))) return [];
    return value.map((x, i) => `expect state ${path}.${i} == ${literal(x)}`);
  }
  if (depth > 0 || !value || typeof value !== "object") return [];
  const before = (was && typeof was === "object" && !Array.isArray(was) ? was : {}) as Bag;
  const out: string[] = [];
  for (const [field, v] of Object.entries(value as Bag)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field) || JSON.stringify(before[field]) === JSON.stringify(v)) continue;
    if (literal(v) !== null) out.push(`expect state ${path}.${field} == ${literal(v)}`);
  }
  return out;
}

/**
 * **The `expect` lines a recording proposes, from the state that changed**
 * (design §9): `state` read before the recorded presses and after them; each
 * slot, then each derive, whose value moved is written as Exact's tests take
 * it — `expect state sheetOpen == true`, a short list by its entries
 * (`expect state cart.0 == "1"`), a record's moved fields one level down
 * (`expect state nav.tab == "saved"`). A list of records, or anything longer,
 * is left to the person.
 */
export function proposeExpects(before: { slots?: Bag | null; derives?: Bag | null }, after: { slots?: Bag | null; derives?: Bag | null }, max = 6): string[] {
  // A record's fields come after every whole value: a slot that moved says more than a router's counter.
  const whole: string[] = [], fields: string[] = [];
  for (const part of ["slots", "derives"] as const) {
    const a = before[part] ?? {};
    const b = after[part] ?? {};
    for (const [name, value] of Object.entries(b)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || JSON.stringify(a[name]) === JSON.stringify(value)) continue;
      const record = !!value && typeof value === "object" && !Array.isArray(value);
      (record ? fields : whole).push(...linesFor(name, a[name], value, 0));
    }
  }
  return [...whole, ...fields].slice(0, max);
}

/** The recorded test, as it will read in the file: the start, every press each followed by `clock settle`, then the expects. */
export function recordedTest(name: string, shots: string, before: readonly string[], ops: readonly string[], expects: readonly string[]): string {
  const steps = [...shotsSteps(shots), ...[...before, ...ops].flatMap((op) => [testStep(op), "clock settle"]), ...expects];
  return [`test "${name.trim()}"`, ...steps.map((s) => `  ${s}`)].join("\n");
}

/** The file's text with a test appended: one blank line between, and a newline at the end. */
export function appendTest(fileText: string, test: string): string {
  const head = fileText.replace(/\s*$/, "");
  return `${head ? `${head}\n\n` : ""}${test}\n`;
}

/** The lines a recorded test may hold — the ones `recordedTest` writes, and nothing else reaches the disk. */
const RECORDED_LINE = [
  /^test "[^"\\\n\r]{1,80}"$/,
  /^ {2}at "\/[^"\s\\]*"$/,
  /^ {2}tap "[A-Za-z0-9_.:-]{1,80}"$/,
  /^ {2}type "[A-Za-z0-9_.:-]{1,80}" "(?:[^"\\\n\r]|\\.){0,400}"$/,
  /^ {2}back$/,
  /^ {2}clock (?:settle|data|\+\d{1,6})$/,
  /^ {2}expect state [A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)? == (?:-?\d+(?:\.\d+)?|true|false|none|\[\]|"[^"\\\n\r]{0,80}")$/,
];

/**
 * **What a kept recording adds to the file**, or why it may not reach the
 * disk: the kept text must be the text it was recorded against with one test
 * appended, every line of which is a line a recording writes. Anything else —
 * an edit to the rest of the file, a line of another kind — is refused.
 */
export function appendedTest(base: string, kept: string): { test: string } | { refused: string } {
  const head = base.replace(/\s*$/, "");
  const prefix = head ? `${head}\n\n` : "";
  if (!kept.startsWith(prefix)) return { refused: "the kept text changes the file above the recorded test, which a recording never does" };
  const test = kept.slice(prefix.length).replace(/\n$/, "");
  const lines = test.split("\n");
  if (lines.length < 2 || !/^test "/.test(lines[0]!)) return { refused: "the kept text appends no test" };
  const bad = lines.find((l) => !RECORDED_LINE.some((re) => re.test(l)));
  if (bad !== undefined) return { refused: `the kept text holds a line a recording does not write: ${JSON.stringify(bad.slice(0, 80))}` };
  return { test };
}

/** The answer on a test file when a kept recording reached the disk (`exact.written`), or why it did not. */
export interface Written { version: string; ok: boolean; sha256: string | null; test: string | null; at: string; error?: string }
export function parseWritten(text: string | undefined): Written | null {
  if (!text) return null;
  try { const v = JSON.parse(text) as Written; return typeof v?.version === "string" ? v : null; } catch { return null; }
}
