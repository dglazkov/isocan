// Versioned timing receipts. File plans are resolved before launch; observations
// never invent the expected file set. No failure text or environment values here.
import { glob, realpath } from 'node:fs/promises';
import { relative, resolve, sep, isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
// @ts-check
/**
 * The checked slice owns these contracts; adopters execute this JavaScript directly.
 * @typedef { {isolation: string, concurrency: string, selection: string[], flagsHash: string, filtered: boolean} } ExecutionSettings
 * @typedef { {version: 1, available: true, invocationId: string, revision: string | null, scope: string, expectedFiles: string[], executionSettings: ExecutionSettings, commandHash: string, settingsHash: string} } AvailablePlan
 * @typedef { {version: 1, available: false, invocationId: string, reason: string, revision?: never, expectedFiles?: never, executionSettings?: never, commandHash?: never, settingsHash?: never} } UnavailablePlan
 * @typedef {AvailablePlan | UnavailablePlan} ReceiptPlan
 * @typedef { {file: string | null, durationMs: unknown, success: unknown, counts: Record<string, unknown> | undefined} } Summary
 * @typedef {Summary & {durationMs: number, success: boolean} } MeasuredSummary
 * @typedef {'pass' | 'fail' | 'inconclusive' | 'skip' | 'todo'} Outcome
 * @typedef { {file: string, testId: unknown, parentId: unknown, name: string, nesting: unknown, type: unknown, durationMs: unknown, outcome: Outcome} } TestNode
 * @typedef { {file: string, hierarchy: string[], occurrence: number, type: unknown, outcome: Outcome, durationMs: unknown} } InventoryEntry
 * @typedef { {version: 1, invocationId: string | null, revision: string | null, expectedFiles: string[], executionSettings: ExecutionSettings | null, settingsHash: string | null, commandHash: string | null, observedSummaries: Summary[], selectionComplete: boolean, observedInventory: InventoryEntry[], inventoryComplete: boolean, inventoryProblems: string[], gaps: string[]} } SuiteFields
 * @typedef {SuiteFields & ({complete: true, aggregate: MeasuredSummary} | {complete: false, aggregate: Summary | null})} SuiteReceipt
 * @typedef { {file: string, name: string, outcome: Outcome} } TestObservation
 * @typedef { {tests?: TestObservation[], from?: string, revision?: string, timedOut?: boolean, exitCode: number} } PlainRun
 * @typedef {PlainRun & {seed: number, stalls?: unknown[], paused: number} } StalledRun
 * @typedef { {version: 1, id: string, identity: {kind: 'stalls', scope: string, runner: 'node', configHash: string, flagsHash: string, target: {file: string, name: string} }, revision: string, clean: boolean, startedAt: string, completedAt: string, pinned: boolean, seed: number, verifiedInjected: boolean, pauses: number, complete: boolean, plain: Outcome, stalled: Outcome} } StallsReceipt
 */
/** @param {unknown} value @returns {value is Record<string, unknown>} */
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
/** @param {unknown} v @returns {unknown} */
const canonical = v => Array.isArray(v) ? v.map(canonical) : record(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k,canonical(v[k])])) : v;
/** @param {unknown} value */
export const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
/** @param {unknown} s @returns {s is string} */
export const safeFile = s => typeof s === 'string' && s.length <= 1024 && s !== '' && !isAbsolute(s) && !s.split(/[\\/]/).includes('..') && !/[\x00-\x1f]/.test(s);
/** @param {string} s */
const posix = s => s.split(sep).join('/');
/** @param {unknown} n @returns {n is number} */
const nonnegative = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
export const RECEIPT_LIMITS = Object.freeze({ files: 2000, tests: 20000, identityChars: 1000 });

/** A deliberately small literal Node script grammar. Shell programs are unknown.
 * @param { {root: string, cwd?: string, script: unknown, words: (script: string) => string[], flags: (words: string[]) => {words: string[]}[], revision?: string | null, invocationId?: string} } options
 * @returns {Promise<ReceiptPlan>}
 */
export async function nodePlan({ root, cwd = root, script, words, flags, revision = null, invocationId = randomUUID() }) {
  root = await realpath(root); cwd = await realpath(cwd);
  /** @param {string} reason @returns {UnavailablePlan} */
  const unavailable = reason => ({ version: 1, invocationId, available: false, reason });
  if (typeof script !== 'string' || /[;&|<>$`\n\r]/.test(script)) return unavailable('dynamic or compound test script');
  const ws = words(script);
  if (ws.shift() !== 'node' || !ws.includes('--test')) return unavailable('not a literal Node test script');
  const optionWords = flags(ws).flatMap(f => f.words), selected = [];
  let i = 0;
  // Flags must precede files; otherwise --test can be a script argument.
  while (i < ws.length && ws[i].startsWith('-')) {
    const f = flags(ws.slice(i))[0];
    if (!f || f.words.some(v => v === undefined)) return unavailable('unknown option');
    i += f.words.length;
  }
  selected.push(...ws.slice(i));
  if (!selected.length || selected.some(s => s.startsWith('-') || !safeFile(s))) return unavailable('no bounded literal file selection');
  const isolation = optionWords.find(s => s.startsWith('--test-isolation='))?.split('=')[1] ?? (optionWords.includes('--test-isolation') ? optionWords[optionWords.indexOf('--test-isolation') + 1] : 'process');
  const concurrency = optionWords.find(s => s.startsWith('--test-concurrency='))?.split('=')[1] ?? (optionWords.includes('--test-concurrency') ? optionWords[optionWords.indexOf('--test-concurrency') + 1] : 'default');
  const filtered = optionWords.some(s => /^--test-(name-pattern|skip-pattern|only|shard)(=|$)/.test(s));
  const found = [];
  for (const pattern of selected) {
    let n = 0;
    for await (const file of glob(pattern, { cwd })) {
      const absolute = await realpath(resolve(cwd, file));
      const rel = posix(relative(root, absolute));
      if (!safeFile(rel) || !/\.[cm]?[jt]sx?$/.test(rel)) return unavailable('selection outside project or unsupported test file');
      found.push(rel); n++;
      if (found.length > RECEIPT_LIMITS.files) return unavailable('file selection limit');
    }
    if (!n) return unavailable('declared selection matched no files');
  }
  if (new Set(found).size !== found.length) return unavailable('duplicate selected files');
  const executionSettings = { isolation, concurrency, selection: selected, flagsHash: digest(optionWords), filtered };
  return { version: 1, available: true, invocationId, revision, scope: posix(relative(root, cwd)) || '.', expectedFiles: found.sort(), executionSettings,
    commandHash: digest(script), settingsHash: digest(executionSettings) };
}

/** Node testId/parentId establish lineage; duplicate full names remain ambiguous.
 * @param { {root: string, plan: ReceiptPlan | null, flagsHash: string, sanitize?: (value: string) => string} } options
 */
export function suiteCollector({ root, plan, flagsHash, sanitize = value => value }) {
  /** @type {Summary[]} */
  const summaries = [];
  /** @type {Map<string, TestNode>} */
  const nodes = new Map();
  /** @type {string[]} */
  const problems = [];
  /** @type {Summary | null} */
  let aggregate = null;
  let aggregates = 0, truncated = false;
  /** @param {unknown} f */
  const fileOf = f => typeof f === 'string' ? posix(relative(root, resolve(f))) : null;
  return {
    /** @param {unknown} e */
    push(e) {
      if (!record(e)) return;
      const d = record(e.data) ? e.data : {}, file = fileOf(d.file);
      const details = record(d.details) ? d.details : {};
      if (e.type === 'test:summary') {
        const summary = { file, durationMs: d.duration_ms, success: d.success, counts: record(d.counts) ? d.counts : undefined };
        if (file) { if (summaries.length < RECEIPT_LIMITS.files) summaries.push(summary); else truncated = true; }
        else { aggregate = summary; aggregates++; }
      }
      if ((e.type !== 'test:pass' && e.type !== 'test:fail') || !file || !details.type || resolve(root, String(d.name)) === d.file) return;
      if (nodes.size >= RECEIPT_LIMITS.tests || typeof d.name !== 'string' || d.name.length > RECEIPT_LIMITS.identityChars) { truncated = true; return; }
      const safeName = sanitize(d.name);
      if (safeName !== d.name) problems.push('logical identity redacted; mapping unavailable');
      const id = `${file}:${d.testId}`;
      if (!Number.isInteger(d.nesting) || typeof d.nesting !== 'number' || d.nesting < 0) problems.push('logical nesting unavailable');
      if (!Number.isInteger(d.testId) || (typeof d.nesting === 'number' && d.nesting > 0 && !Number.isInteger(d.parentId)) || nodes.has(id)) problems.push('logical identity linkage unavailable');
      nodes.set(id, { file, testId: d.testId, parentId: d.parentId, name: safeName, nesting: d.nesting, type: details.type, durationMs: details.duration_ms,
        outcome: d.skip ? 'skip' : d.todo ? 'todo' : e.type === 'test:pass' ? 'pass' : 'fail' });
    },
    /** @returns {SuiteReceipt} */
    finish() {
      /** @type {InventoryEntry[]} */
      const observedInventory = [];
      for (const node of nodes.values()) {
        const hierarchy = [node.name], visited = new Set([node.testId]);
        let current = node;
        while (typeof current.nesting === 'number' && current.nesting > 0 && Number.isInteger(current.parentId)) {
          if (visited.has(current.parentId)) { problems.push('cyclic test linkage'); break; }
          visited.add(current.parentId);
          const parent = nodes.get(`${node.file}:${current.parentId}`);
          if (!parent) { problems.push('missing parent identity'); break; }
          current = parent;
          hierarchy.unshift(current.name);
        }
        observedInventory.push({ file: node.file, hierarchy, occurrence: 1, type: node.type, outcome: node.outcome, durationMs: node.durationMs });
      }
      if (aggregate && nodes.size !== (typeof aggregate.counts?.tests === 'number' ? aggregate.counts.tests : -1) + (typeof aggregate.counts?.suites === 'number' ? aggregate.counts.suites : -1)) problems.push('logical inventory count differs from aggregate');
      const keys = observedInventory.map(t => digest({file:t.file,hierarchy:t.hierarchy,occurrence:t.occurrence,type:t.type}));
      if (new Set(keys).size !== keys.length) problems.push('duplicate logical names are ambiguous');
      if (truncated) problems.push('inventory or summary limit exceeded');
      const expected = plan?.available === true ? plan.expectedFiles : [];
      const files = summaries.map(s => s.file);
      const selectionComplete = plan?.available === true && plan.executionSettings?.isolation === 'process' && !plan.executionSettings.filtered &&
        plan.executionSettings.flagsHash === flagsHash && aggregates === 1 && typeof aggregate?.success === 'boolean' && nonnegative(aggregate.durationMs) && expected.length > 0 &&
        files.length === expected.length && new Set(files).size === files.length && files.every(f => f !== null && expected.includes(f)) && summaries.every(s => typeof s.success === 'boolean' && nonnegative(s.durationMs));
      const complete = selectionComplete && measuredSummary(aggregate) && aggregate.success === true && summaries.every(s => s.success === true);
      /** @type {SuiteFields} */
      const fields = { version: 1, invocationId: plan?.invocationId ?? null, revision: plan?.revision ?? null, expectedFiles: expected,
        executionSettings: plan?.executionSettings ?? null, settingsHash: plan?.settingsHash ?? null, commandHash: plan?.commandHash ?? null,
        observedSummaries: summaries, selectionComplete, observedInventory,
        inventoryComplete: complete && !problems.length && !truncated, inventoryProblems: [...new Set(problems)],
        gaps: complete ? [] : [plan?.available === false ? plan.reason : 'expected files, settings or successful final summaries unavailable'] };
      return complete && measuredSummary(aggregate) ? {...fields, complete: true, aggregate} : {...fields, complete: false, aggregate};
    },
  };
}

/** @param {Summary | null} value @returns {value is MeasuredSummary} */
function measuredSummary(value) {
  return value !== null && typeof value.success === 'boolean' && nonnegative(value.durationMs);
}

/** Validate the external JSON boundary before exposing a plan to collectors.
 * @param {unknown} value @returns {value is ReceiptPlan}
 */
export function isReceiptPlan(value) {
  if (!record(value) || value.version !== 1 || typeof value.invocationId !== 'string') return false;
  if (value.available === false) return typeof value.reason === 'string' &&
    ['revision', 'expectedFiles', 'executionSettings', 'commandHash', 'settingsHash'].every(key => value[key] === undefined);
  const settings = value.executionSettings;
  return value.available === true && (value.revision === null || typeof value.revision === 'string') &&
    typeof value.scope === 'string' && Array.isArray(value.expectedFiles) && value.expectedFiles.every(safeFile) &&
    typeof value.commandHash === 'string' && typeof value.settingsHash === 'string' && record(settings) &&
    typeof settings.isolation === 'string' && typeof settings.concurrency === 'string' &&
    Array.isArray(settings.selection) && settings.selection.every(safeFile) &&
    typeof settings.flagsHash === 'string' && typeof settings.filtered === 'boolean';
}
/** @param {Record<string, string | undefined>} env @returns {Promise<ReceiptPlan | null>} */
export async function readReceiptPlan(env = process.env) {
  try {
    /** @type {unknown} */
    const value = JSON.parse(env.KEEL_SUITE_PLAN ?? 'null');
    return isReceiptPlan(value) ? value : null;
  } catch { return null; }
}

/** No transcript or error text. One receipt per matched top-level identity.
 * @param { {identity: {commit: string, dirty: boolean}, plain: PlainRun, stalled: StalledRun, pinned: boolean, startedAt: string, completedAt: string, configHash: string, flagsHash: string, scope?: string, sanitize?: (value: string) => string} } options
 * @returns {StallsReceipt[]}
 */
export function stallsEvidence({ identity, plain, stalled, pinned, startedAt, completedAt, configHash, flagsHash, scope = '.', sanitize = value => value }) {
  /** @type {StallsReceipt[]} */
  const receipts = [];
  const seen = new Set();
  for (const t of plain.tests ?? []) {
    const key = JSON.stringify([t.file, t.name]);
    const matches = (stalled.tests ?? []).filter(s => s.file === t.file && s.name === t.name);
    if (seen.has(key) || matches.length !== 1 || (plain.tests ?? []).filter(s => s.file === t.file && s.name === t.name).length !== 1 || !safeFile(t.file)) continue;
    seen.add(key);
    const name = sanitize(t.name);
    receipts.push({ version: 1, id: randomUUID(), identity: { kind: 'stalls', scope, runner: 'node', configHash, flagsHash, target: { file: t.file, name } },
      revision: identity.commit, clean: identity.dirty === false, startedAt, completedAt, pinned: pinned === true,
      seed: stalled.seed, verifiedInjected: (stalled.stalls ?? []).length > 0 && stalled.paused > 0, pauses: (stalled.stalls ?? []).length,
      complete: name === t.name && name.length<=1000 && (plain.from!=='ledger'||plain.revision===identity.commit) && !plain.timedOut && !stalled.timedOut && [0, 1].includes(stalled.exitCode) && (plain.from === 'ledger' || [0, 1].includes(plain.exitCode)),
      plain: t.outcome, stalled: matches[0].outcome });
  }
  return receipts;
}

/** @param {unknown} r @returns {r is StallsReceipt} */
export function isStallsReceipt(r) {
  if (!record(r) || !record(r.identity) || !record(r.identity.target)) return false;
  if (typeof r.revision !== 'string' || typeof r.startedAt !== 'string' || typeof r.completedAt !== 'string' ||
      typeof r.seed !== 'number' || typeof r.pauses !== 'number' || typeof r.plain !== 'string' || typeof r.stalled !== 'string') return false;
  const keys=['version','id','identity','revision','clean','startedAt','completedAt','pinned','seed','verifiedInjected','pauses','complete','plain','stalled'];
  return r && Object.keys(r).every(k=>keys.includes(k)) && Object.keys(r.identity??{}).every(k=>['kind','scope','runner','configHash','flagsHash','target'].includes(k)) && Object.keys(r.identity?.target??{}).every(k=>['file','name'].includes(k)) && r.version===1 && typeof r.id==='string' && r.id.length<=100 &&
    r.identity?.kind==='stalls' && typeof r.identity.scope==='string' && r.identity.runner==='node' &&
    typeof r.identity.configHash==='string' && typeof r.identity.flagsHash==='string' &&
    safeFile(r.identity.target?.file) && typeof r.identity.target?.name==='string' && r.identity.target.name.length<=1000 &&
    /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(r.revision??'') && typeof r.clean==='boolean' &&
    Number.isFinite(Date.parse(r.startedAt)) && Number.isFinite(Date.parse(r.completedAt)) && Date.parse(r.startedAt)<=Date.parse(r.completedAt) &&
    typeof r.pinned==='boolean' && typeof r.complete==='boolean' && typeof r.verifiedInjected==='boolean' &&
    Number.isInteger(r.seed) && r.seed>=0 && r.seed<=4294967295 && Number.isSafeInteger(r.pauses) && r.pauses>=0 &&
    ['pass','fail','inconclusive','skip','todo'].includes(r.plain) && ['pass','fail','inconclusive','skip','todo'].includes(r.stalled);
}
