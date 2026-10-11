// Bounded, data-only recovery of the night ledger. No artifact supplies commands.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { inflateRawSync, crc32 } from 'node:zlib';
import { constants } from 'node:fs';
import { readFile, mkdir, lstat, realpath, open, rename, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isStallsReceipt } from './time-receipts.mjs';
import { gateWorkflowIn } from './lib.mjs';

const exec = promisify(execFile);
const MAX = Object.freeze({ discovery: 500, bytes: 256 * 1024 * 1024, records: 4000 });
const NAME = 'keel-test-runs', NIGHT = '.github/workflows/keel-night.yml';
const id = n => Number.isSafeInteger(n) && n > 0;
const sha = s => /^[a-f0-9]{40}$/.test(s ?? '');
const weekOf = value => {
  const d = new Date(value); d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
};
const diagnostic = (repo, branch, at) => ({ version: 1, repo, branch, at, selected: [], imported: 0, bytes: 0, gaps: [], complete: false });

// Check the entire central directory before inflating anything. ZIP64, encryption,
// links, traversal, duplicate names and unsupported encodings fail closed.
function archiveEntries(zip, remaining) {
  if (!Buffer.isBuffer(zip) || zip.length > MAX.bytes || zip.length < 22) throw new Error('invalid or oversized ZIP');
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50 && i + 22 + zip.readUInt16LE(i + 20) === zip.length) { end = i; break; }
  }
  if (end < 0 || zip.readUInt16LE(end + 4) || zip.readUInt16LE(end + 6)) throw new Error('unsupported ZIP directory');
  const count = zip.readUInt16LE(end + 10), size = zip.readUInt32LE(end + 12), offset = zip.readUInt32LE(end + 16);
  if (count > 5000 || count !== zip.readUInt16LE(end + 8) || offset + size !== end) throw new Error('invalid ZIP directory bounds');
  let p = offset, bytes = 0;
  const entries = [], names = new Set(), ranges = [];
  for (let i = 0; i < count; i++) {
    if (p + 46 > end || zip.readUInt32LE(p) !== 0x02014b50) throw new Error('invalid ZIP entry');
    const flags = zip.readUInt16LE(p + 8), method = zip.readUInt16LE(p + 10), crc = zip.readUInt32LE(p + 16);
    const compressed = zip.readUInt32LE(p + 20), length = zip.readUInt32LE(p + 24);
    const n = zip.readUInt16LE(p + 28), extra = zip.readUInt16LE(p + 30), comment = zip.readUInt16LE(p + 32);
    const mode = zip.readUInt32LE(p + 38) >>> 16, local = zip.readUInt32LE(p + 42);
    if (p + 46 + n + extra + comment > end || zip.readUInt16LE(p + 34) || (flags & ~0x808) || ![0, 8].includes(method)) throw new Error('unsupported ZIP entry');
    const name = zip.subarray(p + 46, p + 46 + n).toString('utf8');
    const safe = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,239}\.json$/.test(name) || ['.gitignore', 'usual', 'retention', 'recovery/', 'recovery/status.json'].includes(name);
    if (!safe || name.includes('..') || names.has(name) || ((mode & 0xf000) && ![0x8000, 0x4000].includes(mode & 0xf000)) || ((mode & 0xf000) === 0x4000 && name !== 'recovery/')) throw new Error('unsafe or duplicate archive path');
    names.add(name); bytes += length;
    if (bytes > remaining || length > 16 * 1024 * 1024) throw new Error('uncompressed byte bound exceeded');
    if (local + 30 > offset || zip.readUInt32LE(local) !== 0x04034b50 || zip.readUInt16LE(local + 6) !== flags || zip.readUInt16LE(local + 8) !== method) throw new Error('invalid ZIP local header');
    const ln = zip.readUInt16LE(local + 26), le = zip.readUInt16LE(local + 28), start = local + 30 + ln + le;
    if (start + compressed > offset || !zip.subarray(local + 30, local + 30 + ln).equals(zip.subarray(p + 46, p + 46 + n))) throw new Error('ZIP local path or bounds mismatch');
    ranges.push([local, start + compressed]);
    entries.push({ name, method, crc, length, start, compressed });
    p += 46 + n + extra + comment;
  }
  if (p !== end) throw new Error('ZIP directory length mismatch');
  ranges.sort((a, b) => a[0] - b[0]);
  if (ranges.some((r, i) => i && r[0] < ranges[i - 1][1])) throw new Error('overlapping ZIP entries');
  return { entries, bytes };
}
function unpack(zip, entry) {
  const input = zip.subarray(entry.start, entry.start + entry.compressed);
  const data = entry.method === 0 ? input : inflateRawSync(input, { maxOutputLength: Math.max(1, entry.length) });
  if (data.length !== entry.length || crc32(data) !== entry.crc) throw new Error('ZIP length or checksum mismatch');
  return data;
}
const onlyKeys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(k => allowed.includes(k));
function stallsWrapper(value) {
  const rows = value.stallsReceipts;
  return onlyKeys(value, ['kind','version','date','completed','tests','stallsReceipts','dir','config','flagsHash','commit']) &&
    value.version === 1 && value.completed === true && Number.isFinite(Date.parse(value.date)) && Array.isArray(value.tests) && !value.tests.length &&
    ['dir','config','flagsHash'].every(k => typeof value[k] === 'string') && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value.commit ?? '') &&
    Array.isArray(rows) && rows.length > 0 && rows.length <= 2000 && Buffer.byteLength(JSON.stringify(rows)) <= 1024 * 1024 && rows.every(r =>
      isStallsReceipt(r) && onlyKeys(r, ['version','id','identity','revision','clean','startedAt','completedAt','pinned','seed','verifiedInjected','pauses','complete','plain','stalled']) &&
      onlyKeys(r.identity, ['kind','scope','runner','configHash','flagsHash','target']) && onlyKeys(r.identity.target, ['file','name']));
}
async function ledgerDir(root) {
  let dir = await realpath(root); // Supports macOS /tmp -> /private/tmp.
  for (const part of ['.keel', 'test-runs', 'recovery']) {
    dir = join(dir, part);
    try { await mkdir(dir); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    const stat = await lstat(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('unsafe ledger destination');
  }
  return dir;
}
async function boundedRead(path) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { const s = await file.stat(); if (!s.isFile() || s.size > 16 * 1024 * 1024) throw new Error('invalid ledger file'); return await file.readFile(); }
  finally { await file.close(); }
}
export async function readTestHistory(root) {
  try {
    const value = JSON.parse(await boundedRead(join(root, '.keel/test-runs/recovery/status.json')));
    if (value?.version !== 1 || !Array.isArray(value.gaps) || !Array.isArray(value.selected) || typeof value.complete !== 'boolean') throw new Error();
    return value;
  } catch { return { ...diagnostic(null, null, null), gaps: [{ code: 'unavailable', detail: 'test history recovery diagnostic absent or unreadable' }] }; }
}

export async function recoverTestHistory({ root, repo, branch, at = new Date(), github, download, limits = {} }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo ?? '') || typeof branch !== 'string' || !branch || !Number.isFinite(new Date(at).getTime())) throw new Error('repository, default branch and report time required');
  at = new Date(at).toISOString();
  const cap = Object.fromEntries(Object.entries(MAX).map(([k, v]) => [k, Number.isSafeInteger(limits[k]) && limits[k] >= 0 ? Math.min(v, limits[k]) : v]));
  const dir = await ledgerDir(root), out = diagnostic(repo, branch, at);
  const gap = (code, detail, extra = {}) => {
    if (out.gaps.length < 1023) out.gaps.push({ code, detail, observedAt: at, ...extra });
    else if (out.gaps.length === 1023) out.gaps.push({ code: 'gap-limit', detail: 'additional coverage gaps omitted by diagnostic bound', observedAt: at });
  };
  const base = `repos/${repo}`;
  github ??= async path => JSON.parse((await exec(process.env.KEEL_GH || 'gh', ['api', path], { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 })).stdout);
  download ??= async artifactId => (await exec(process.env.KEEL_GH || 'gh', ['api', `${base}/actions/artifacts/${artifactId}/zip`], { encoding: 'buffer', timeout: 60000, maxBuffer: MAX.bytes })).stdout;
  const weeks = Array.from({ length: 8 }, (_, i) => weekOf(new Date(at).getTime() - i * 7 * 86400000));
  try {
    const repository = await github(base);
    if (!id(repository.id) || repository.full_name?.toLowerCase() !== repo.toLowerCase() || repository.default_branch !== branch) throw new Error('repository/default branch identity mismatch');
    const config = JSON.parse(await readFile(join(root, '.keel/keel.json'), 'utf8'));
    // The project's gate workflow, as improve finds it: the one .keel/keel.json names, else check.yml,
    // else the one that runs the check (a project that gates in pages.yml has no check.yml).
    const gate = await gateWorkflowIn(root, config);
    if (gate?.problem) throw new Error(gate.problem);
    if (gate && gate.name.length > 200) throw new Error('invalid CI workflow configuration');
    // A file is read by its file name; a name as GitHub shows it (gateWorkflow: "Check") must name exactly one workflow.
    const workflowOf = async name => {
      if (/\.ya?ml$/.test(name)) return github(`${base}/actions/workflows/${encodeURIComponent(name)}`);
      const list = await github(`${base}/actions/workflows?per_page=100`);
      const named = (Array.isArray(list?.workflows) ? list.workflows : []).filter(w => w?.name === name);
      if (named.length !== 1) throw new Error(`no single workflow is named ${JSON.stringify(name)}`);
      return named[0];
    };
    const workflows = new Map();
    if (!gate) gap('workflow-unavailable', 'ci: no workflow in .github/workflows runs the gate, and .keel/keel.json names no gateWorkflow');
    for (const [kind, name] of [['night', 'keel-night.yml'], ...(gate ? [['ci', gate.name]] : [])]) {
      try {
        const w = await workflowOf(name);
        if (!id(w.id) || !/^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/.test(w.path ?? '') || (kind === 'night' && w.path !== NIGHT) || workflows.has(w.id)) throw new Error('workflow identity unavailable or ambiguous');
        workflows.set(w.id, { kind, path: w.path });
      } catch (e) { gap('workflow-unavailable', `${kind}: ${e.message}`); }
    }
    const artifacts = [], seen = new Set();
    let total = Infinity;
    for (let page = 1; artifacts.length < cap.discovery && artifacts.length < total; page++) {
      const data = await github(`${base}/actions/artifacts?name=${NAME}&per_page=100&page=${page}`);
      if (!Number.isSafeInteger(data.total_count) || data.total_count < 0 || !Array.isArray(data.artifacts) || data.artifacts.length > 100) throw new Error('artifact discovery malformed');
      if (total !== Infinity && total !== data.total_count) gap('discovery-changed', 'artifact inventory changed during pagination');
      total = data.total_count;
      for (const a of data.artifacts) {
        if (artifacts.length >= cap.discovery) break;
        if (!id(a?.id) || seen.has(a.id)) throw new Error('duplicate or invalid artifact identity');
        seen.add(a.id); artifacts.push(a);
      }
      if (!data.artifacts.length) { if (artifacts.length < total) gap('discovery-incomplete', 'artifact page ended before reported total'); break; }
    }
    if (total > artifacts.length) gap('discovery-limit', `discovered ${artifacts.length} of ${total} artifacts`);
    const candidates = [], runs = new Map();
    for (const listed of artifacts) {
      try {
        if (listed.name !== NAME || !Number.isFinite(Date.parse(listed.created_at)) || Date.parse(listed.created_at) >= Date.parse(at)) throw new Error('artifact name/time invalid');
        if (!weeks.includes(weekOf(listed.created_at))) continue;
        if (listed.expired) throw new Error('artifact expired');
        const a = await github(`${base}/actions/artifacts/${listed.id}`);
        if (a.id !== listed.id || a.name !== NAME || a.created_at !== listed.created_at || a.expired !== false || !id(a.size_in_bytes) || a.size_in_bytes > MAX.bytes || !id(a.workflow_run?.id)) throw new Error('artifact identity/size mismatch');
        const rid = a.workflow_run.id;
        if (!runs.has(rid)) runs.set(rid, await github(`${base}/actions/runs/${rid}`));
        const r = runs.get(rid), workflow = workflows.get(r.workflow_id);
        if (!workflow || r.id !== rid || r.path !== workflow.path || r.repository?.id !== repository.id || r.head_repository?.id !== repository.id || r.repository?.full_name?.toLowerCase() !== repo.toLowerCase() || r.head_repository?.full_name?.toLowerCase() !== repo.toLowerCase() || r.head_branch !== branch || !sha(r.head_sha) || r.status !== 'completed' || !Number.isFinite(Date.parse(r.updated_at)) || Date.parse(r.updated_at) >= Date.parse(at) || !Array.isArray(r.pull_requests) || r.pull_requests.length || !(workflow.kind === 'night' ? ['schedule', 'workflow_dispatch'] : ['push']).includes(r.event)) throw new Error('run repository/branch/workflow/event identity mismatch');
        if (a.workflow_run.repository_id !== repository.id || a.workflow_run.head_repository_id !== repository.id || a.workflow_run.head_branch !== branch || a.workflow_run.head_sha !== r.head_sha || listed.workflow_run?.id !== rid) throw new Error('artifact/run binding mismatch');
        candidates.push({ a, r, kind: workflow.kind, week: weekOf(a.created_at) });
      } catch (e) { gap('artifact-rejected', e.message, { artifactId: listed.id }); }
    }
    candidates.sort((a, b) => Date.parse(b.a.created_at) - Date.parse(a.a.created_at) || b.a.id - a.a.id);
    const night = candidates.find(c => c.kind === 'night'), chosen = night ? [night] : [];
    if (!night) gap('night-missing', 'no verified cumulative night artifact in eight UTC weeks');
    for (const week of weeks) {
      const eligible = candidates.filter(c => c.kind === 'ci' && c.week === week);
      // One logical CI run per sample; duplicate uploads do not fill two slots.
      const unique = eligible.filter((c, i) => eligible.findIndex(x => x.r.id === c.r.id) === i);
      chosen.push(...unique.slice(0, 2));
      if (unique.length < 2) gap('ci-week-missing', `only ${unique.length} verified CI artifacts`, { week });
      if (eligible.length > 2) gap('ci-sampled', `${eligible.length - 2} artifacts omitted by weekly sample`, { week });
    }
    for (const { a, r, kind, week } of chosen) {
      out.selected.push({ artifactId: a.id, runId: r.id, workflowId: r.workflow_id, kind, week, headSha: r.head_sha });
      try {
        const zip = await download(a.id);
        if (a.digest != null && (!/^sha256:[a-f0-9]{64}$/.test(a.digest) || `sha256:${createHash('sha256').update(zip).digest('hex')}` !== a.digest)) throw new Error('archive digest mismatch');
        const archive = archiveEntries(zip, cap.bytes - out.bytes);
        out.bytes += archive.bytes;
        const records = []; let coverage = false;
        for (const entry of archive.entries) {
          const data = unpack(zip, entry);
          if (entry.name === 'recovery/status.json') {
            coverage = true;
            const prior = JSON.parse(data);
            if (kind === 'night') {
              if (prior?.version !== 1 || prior.repo?.toLowerCase() !== repo.toLowerCase() || prior.branch !== branch || !Array.isArray(prior.gaps) || prior.gaps.length > 1024 || typeof prior.complete !== 'boolean' || (!prior.complete && !prior.gaps.length)) {
                gap('inherited-unknown', 'cumulative night has invalid recovery coverage', { artifactId: a.id, observedAt: a.created_at });
              } else for (const g of prior.gaps) {
                // Preserve original provenance. Copying an old gap must never renew
                // its lifetime; a known week's loss expires with that week.
                const observedAt = g?.observedAt ?? prior.at ?? a.created_at;
                if (!Number.isFinite(Date.parse(observedAt)) || Date.parse(observedAt) >= Date.parse(at)) {
                  gap('inherited-unknown', 'cumulative gap has invalid time provenance', { artifactId: a.id, observedAt: a.created_at });
                  continue;
                }
                if (g.week ? !weeks.includes(g.week) : Date.parse(observedAt) < Date.parse(weeks.at(-1))) continue;
                gap('inherited-gap', String(g.detail ?? 'prior recovery gap').slice(0, 512), {
                  artifactId: a.id, sourceArtifactId: id(g.sourceArtifactId) ? g.sourceArtifactId : a.id,
                  sourceCode: String(g.sourceCode ?? g.code ?? 'unknown').slice(0, 80), observedAt,
                  ...(g.week ? { week: g.week } : {}),
                });
              }
            }
          } else if (entry.name === 'retention') {
            const value = JSON.parse(data);
            if (value?.version !== 1 || typeof value.sampled !== 'boolean' || !['retained','considered','omitted','pressureLosses','laneLosses','bytes'].every(k => Number.isSafeInteger(value[k]) && value[k] >= 0) || !Number.isFinite(Date.parse(value.at))) throw new Error('invalid retention coverage');
            if (value.omitted || value.pressureLosses || value.laneLosses) gap('retention-loss', `artifact retention omitted ${value.omitted} records; byte/count losses ${value.pressureLosses}; lane losses ${value.laneLosses}`, { artifactId: a.id, observedAt: value.at });
            // This is source coverage, not a new computed local retention verdict.
            if (kind === 'night') records.push({ name: entry.name, data });
          } else if (entry.name.endsWith('.json')) {
            const value = JSON.parse(data);
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ledger JSON is not a record');
            if ((value.kind === 'stalls' || Object.hasOwn(value, 'stallsReceipts')) && (value.kind !== 'stalls' || !stallsWrapper(value))) {
              gap('stalls-rejected', `invalid typed stalls wrapper: ${entry.name}`, { artifactId: a.id });
              continue;
            }
            if (value.kind === 'local-workaround' || value.identity?.kind === 'local-workaround') {
              gap('local-evidence-rejected', 'local workaround evidence cannot be recovered from artifacts', { artifactId: a.id });
              continue;
            }
            records.push({ name: entry.name, data });
          }
        }
        if (kind === 'night' && !coverage) gap('inherited-unknown', 'cumulative night predates recovery coverage diagnostics', { artifactId: a.id, observedAt: a.created_at });
        if (!records.length) gap('archive-empty', 'artifact contains no ledger records', { artifactId: a.id });
        if (out.imported + records.filter(r => r.name.endsWith('.json')).length > cap.records) throw new Error('record import bound exceeded');
        for (const record of records) {
          const destination = join(dir, '..', record.name);
          try {
            const file = await open(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
            try { await file.writeFile(record.data); if (record.name.endsWith('.json')) out.imported++; } finally { await file.close(); }
          } catch (e) {
            if (e.code !== 'EEXIST') throw e;
            if (!(await boundedRead(destination)).equals(record.data)) gap('record-conflict', `existing record differs: ${record.name}`, { artifactId: a.id });
          }
        }
      } catch (e) { gap('archive-rejected', e.message, { artifactId: a.id }); }
    }
  } catch (e) { gap('recovery-unavailable', e.message); }
  out.complete = out.gaps.length === 0;
  const status = join(dir, 'status.json');
  try { const s = await lstat(status); if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1) throw new Error('unsafe recovery status destination'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const temporary = join(dir, `status-${process.pid}-${Date.now()}.tmp`);
  const file = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await file.writeFile(JSON.stringify(out, null, 2) + '\n'); } finally { await file.close(); }
  try { await rename(temporary, status); } finally { await unlink(temporary).catch(() => {}); }
  return out;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), options = {};
  try {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--json') continue;
      if (!['--repo', '--branch'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || options[args[i]]) throw new Error('usage: test-history.mjs --repo owner/repo --branch default --json');
      options[args[i]] = args[++i];
    }
    console.log(JSON.stringify(await recoverTestHistory({ root: process.cwd(), repo: options['--repo'], branch: options['--branch'] })));
  }
  catch (e) { console.error(e.message); process.exitCode = 2; }
}
