// Bounded hygiene readers, shipped by night. Observations are not authority to
// change PRs, delete worktrees, or issue robot work. Unknown never means zero.
import { open, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { githubRead, quotaGuard, rememberQuota } from './quota.mjs';

export const HYGIENE_DEFAULTS = Object.freeze({ draftHours: 24, longFileLines: 1500, worktreeDays: 7 });
export function hygieneOptions(config = {}) {
  const raw = config.hygiene === undefined ? {} : config.hygiene;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('hygiene must be an object');
  const result = { ...HYGIENE_DEFAULTS };
  for (const key of Object.keys(result)) if (Object.hasOwn(raw, key)) {
    if (typeof raw[key] !== 'number' || !Number.isFinite(raw[key]) || raw[key] <= 0) throw new Error(`hygiene.${key} must be a positive finite number`);
    result[key] = raw[key];
  }
  return result;
}

export const DRAFT_QUERY = `query($owner:String!,$name:String!) {
  rateLimit { cost remaining resetAt }
  repository(owner:$owner,name:$name) {
    pullRequests(first:100,states:[OPEN],orderBy:{field:CREATED_AT,direction:DESC}) {
      pageInfo { hasNextPage }
      nodes { number title url isDraft state createdAt updatedAt }
    }
  }
}`;
const MAX_DRAFT_BYTES = 1024 * 1024;
const command = (bin, args, { input, rejectStderr = false, filterTree = false, ...opts } = {}) => new Promise((resolve, reject) => {
  let deadline;
  const grouped = filterTree && process.platform !== 'win32';
  const stopFilters = () => { if (grouped && child.pid) try { process.kill(-child.pid, 'SIGKILL'); } catch { /* process group already exited */ } };
  const child = execFile(bin, args, { encoding: 'utf8', timeout: 15000, maxBuffer: MAX_DRAFT_BYTES, ...opts, ...(grouped ? {detached:true} : {}) },
    (error, stdout, stderr) => {
      clearTimeout(deadline);
      stopFilters();
      if (error || (rejectStderr && stderr.trim())) {
        const e = new Error(String(stderr || error?.message).trim().slice(0, 500));
        e.stdout = stdout;
        reject(e);
      } else resolve(stdout);
    });
  // hash-object must consume the already observed bytes, never reread a path.
  // A failed process may close stdin before its callback reports the failure.
  if (grouped) deadline = setTimeout(stopFilters, opts.timeout ?? 15000);
  child.stdin.on('error', () => {});
  child.stdin.end(input);
});
const stamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,19) === value.slice(0,19);
const pullUrl = (value, repo, number) => {
  if (typeof value !== 'string') return false;
  const m = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/([1-9]\d*)$/i.exec(value);
  return !!m && m[1].toLowerCase() === repo.toLowerCase() && m[2] === String(number);
};
const payloadBound = value => {
  if (Buffer.byteLength(JSON.stringify(value) ?? '') > MAX_DRAFT_BYTES) throw new Error('draft PR response exceeds byte bound');
};
const quotaOf = r => {
  const q = r?.data?.rateLimit;
  return q && Number.isFinite(q.cost) && q.cost >= 0 && Number.isFinite(q.remaining) && q.remaining >= 0 && stamp(q.resetAt) ? q : null;
};
function draftProjection(response, repo) {
  payloadBound(response);
  if (response?.errors !== undefined && (!Array.isArray(response.errors) || response.errors.length)) throw new Error('draft PR query returned GraphQL errors');
  const c = response?.data?.repository?.pullRequests;
  if (!quotaOf(response) || !Array.isArray(c?.nodes) || typeof c?.pageInfo?.hasNextPage !== 'boolean' || c.nodes.length > 100) throw new Error('draft PR query returned malformed or unavailable data');
  const seen = new Set();
  for (const n of c.nodes) {
    if (!Number.isSafeInteger(n?.number) || n.number < 1 || seen.has(n.number) || n.state !== 'OPEN' || typeof n.isDraft !== 'boolean' || typeof n.title !== 'string' || n.title.length > 1000 || !pullUrl(n.url, repo, n.number) || !stamp(n.createdAt) || !stamp(n.updatedAt)) throw new Error('draft PR query returned a malformed or duplicate PR');
    seen.add(n.number);
  }
  return { prs: c.nodes, quota: quotaOf(response), coverage: { complete: !c.pageInfo.hasNextPage, gaps: c.pageInfo.hasNextPage ? ['open PR connection truncated at 100; older drafts may be omitted'] : [] } };
}

/** One cache/quota-controlled query. Age is recalculated from creation on each read. */
export async function draftsWaiting({ config = {}, env = process.env, now = Date.now(), graphql, guard, fresh = false } = {}) {
  const { draftHours } = hygieneOptions(config);
  const facts = { schema: 1, observedAt: new Date(now).toISOString(), draftHours, ageBasis: 'createdAt while currently draft; not continuous time in draft', prs: [], coverage: { complete: false, gaps: [] }, github: { readAt: null, cached: false, cost: 0, queries: 0, remaining: null, resetAt: null } };
  if (!config.repo) return { na: 'no repo for draft PRs', facts: { ...facts, coverage: { complete: false, gaps: ['no repo'] } } };
  if (!/^[\w.-]+\/[\w.-]+$/.test(config.repo)) throw new Error('draft PRs require owner/repo');
  const [owner, name] = config.repo.split('/');
  try {
    const result = await githubRead(env, `hygiene-drafts-v1-${createHash('sha256').update(config.repo.toLowerCase()).digest('hex')}`, async () => {
      let raw;
      try {
        raw = await (graphql ? graphql({ query: DRAFT_QUERY, owner, name }) : command(env.PLATES_GH || 'gh', ['api', 'graphql', '-f', `query=${DRAFT_QUERY}`, '-f', `owner=${owner}`, '-f', `name=${name}`], { env }));
      } catch (e) {
        // gh may return a nonzero exit alongside a charged GraphQL response.
        if (!e.stdout) throw e;
        try { raw = JSON.parse(e.stdout); } catch { throw e; }
        raw = { ...raw, errors: [{ message: e.message }] };
      }
      const size = typeof raw === 'string' ? Buffer.byteLength(raw) : Buffer.byteLength(JSON.stringify(raw) ?? '');
      if (size > MAX_DRAFT_BYTES) throw new Error('draft PR response exceeds byte bound');
      const response = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const quota = quotaOf(response);
      facts.github.queries = 1;
      facts.github.readAt = new Date(now).toISOString();
      if (quota) {
        Object.assign(facts.github, { cost: quota.cost, remaining: quota.remaining, resetAt: quota.resetAt });
        await rememberQuota(env, quota, now);
      }
      return draftProjection(response, config.repo);
    }, { now, fresh, guard: guard ?? (() => quotaGuard(env)) });
    const data = result.value;
    payloadBound(data);
    // Cached observations are validated too; old/malformed cache data is not zero.
    draftProjection({ data: { rateLimit: data.quota, repository: { pullRequests: { nodes: data.prs, pageInfo: { hasNextPage: !data.coverage?.complete } } } } }, config.repo);
    facts.github = { readAt: result.at, cached: result.cached, cost: result.cached ? 0 : data.quota.cost, queries: result.cached ? 0 : 1, remaining: data.quota.remaining, resetAt: data.quota.resetAt };
    facts.coverage = data.coverage;
    if (data.prs.some(p => Date.parse(p.createdAt) > now || Date.parse(p.updatedAt) > now || Date.parse(p.updatedAt) < Date.parse(p.createdAt))) throw new Error('draft PR timestamps are inconsistent with observation');
    facts.prs = data.prs.filter(p => p.isDraft && now - Date.parse(p.createdAt) > draftHours * 3600000)
      .map(p => ({ ...p, ageHours: (now - Date.parse(p.createdAt)) / 3600000 }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.number - b.number);
    if (!facts.coverage.complete) return { na: facts.coverage.gaps.join('; '), facts };
    return { value: facts.prs.length, detail: `${facts.prs.length} open drafts older than ${draftHours}h since creation (not continuous draft age); ${facts.github.cached ? 'cached' : 'live'} read ${facts.github.readAt}; ${facts.github.queries} queries, ${facts.github.cost} points`, facts };
  } catch (e) {
    facts.coverage = { complete: false, gaps: [String(e.message).slice(0, 500)] };
    return { na: `draft PRs unavailable: ${facts.coverage.gaps[0]}`, facts };
  }
}

export const LONG_FILE_LIMITS = Object.freeze({ files: 20000, fileBytes: 2 * 1024 * 1024, totalBytes: 64 * 1024 * 1024, listBytes: 4 * 1024 * 1024, historyFiles: 10, historyCommits: 5, findings: 100, ms: 15000 });
const SOURCE = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.py', '.rb', '.go', '.rs', '.c', '.h', '.cc', '.cpp', '.hpp', '.cs', '.java', '.kt', '.swift', '.php', '.vue', '.svelte', '.sh', '.bash', '.zsh', '.css', '.scss', '.sql']);
const EXCLUDE = /(?:^|\/)(?:node_modules|vendor|vendors|vendored|third_party|third-party|fixture|fixtures|__fixtures__|testdata|__snapshots__|generated|__generated__|dist|build|coverage|\.git|\.next|\.cache|\.claude)(?:\/|$)/i;
export const sourcePath = path => typeof path === 'string' && path.length <= 4096 && !/[\x00-\x1f\x7f]/.test(path) && !path.startsWith('/') && !path.split('/').some(p => !p || p === '.' || p === '..') && SOURCE.has(extname(path).toLowerCase()) && !EXCLUDE.test(path) && !/\.(?:min|generated|g)\.[^.]+$/i.test(path) && !/\.d\.ts$/i.test(path);
export const lineCount = text => text.length ? (text.match(/\n/g)?.length ?? 0) + (text.endsWith('\n') ? 0 : 1) : 0;
/** Only leading comment headers count; later prose is ordinary source evidence. */
export function generatedSource(text) {
  let head = text.slice(0, 4096).replace(/^\uFEFF/, '');
  if (head.startsWith('#!')) head = head.slice(head.indexOf('\n') < 0 ? head.length : head.indexOf('\n') + 1);
  // Recognize a marker at the start of a header comment line, not descriptions
  // such as "value generated by the API", even within the leading comments.
  // Explicit file/code declarations, not a search for "generated" in prose.
  // This covers generator families (bindgen, protoc, C# tools) without naming
  // individual tools. Bare "Code generated" still requires Go's closing marker.
  const markers = [
    /^(?:@generated\b|DO NOT EDIT\b)/i,
    /^(?:auto[- ]?|automatically\s+)generated\b/i,
    /^generated\s+(?:by|from)\b/i,
    /^(?:NOTE:\s*)?This\s+(?:file|code|class)\s+(?:is|was)\s+(?:automatically\s+|auto[- ]?)?generated(?:\s+(?:by|from)\b|[.!]?\s*$)/i,
    /^Code generated [^\r\n]* DO NOT EDIT\./i,
    /^<auto-generated\s*\/?>/i,
  ];
  const marked = line => markers.some(marker => marker.test(line));
  while ((head = head.trimStart())) {
    if (head.startsWith('/*')) {
      const end = head.indexOf('*/', 2);
      if (end < 0) return false; // truncated headers cannot establish generatedness
      if (head.slice(2, end).split(/\r?\n/).some(line => marked(line.replace(/^\s*\*?\s*/, '')))) return true;
      head = head.slice(end + 2);
    } else if (head.startsWith('//') || head.startsWith('#')) {
      const end = head.indexOf('\n');
      const line = end < 0 ? head : head.slice(0, end);
      if (marked(line.replace(/^(?:\/\/|#)\s*/, ''))) return true;
      head = end < 0 ? '' : head.slice(end + 1);
    } else break; // never scan beyond the first executable/source token
  }
  return false;
}

/** Column-zero declarations/section comments, not a parser: displayed as hints. */
export function largestSections(text) {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  const points = [];
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i];
    const declaration = /^(?:(?:export|default|async|public|private|abstract|final)\s+)*(?:function\*?|class|interface|enum|namespace|def|async def|fn|func|struct|impl|trait|module)\s+([\w$]+)/.exec(s);
    const variable = /^(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*=/.exec(s);
    const section = /^(?:\/\/|#)\s*[-=]{3,}\s*(\S.*?)\s*[-=]*\s*$/.exec(s);
    if (declaration || variable || section) points.push({ name: (declaration?.[1] ?? variable?.[1] ?? section?.[1]).slice(0, 120), start: i + 1 });
  }
  return points.map((p, i) => ({ ...p, end: (points[i + 1]?.start ?? lines.length + 1) - 1, lines: (points[i + 1]?.start ?? lines.length + 1) - p.start }))
    .sort((a, b) => b.lines - a.lines || a.start - b.start).slice(0, 5);
}

// Never follow a symlink component, including a replaced parent directory.
async function localBytes(root, path, max) {
  let full = root;
  const parts = path.split('/');
  for (let i = 0; i < parts.length; i++) {
    full = join(full, parts[i]);
    const s = await lstat(full);
    if (s.isSymbolicLink() || (i < parts.length - 1 && !s.isDirectory())) throw new Error('symlink or non-directory source component');
  }
  if (await realpath(full) !== full) throw new Error('source escaped canonical root');
  const file = await open(full, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await file.stat();
    if (!before.isFile() || before.size > max) throw new Error('source is not a regular file within byte bound');
    const buffer = Buffer.alloc(Math.min(max + 1, before.size + 1));
    let used = 0;
    while (used < buffer.length) {
      const { bytesRead } = await file.read(buffer, used, buffer.length - used, used);
      if (!bytesRead) break;
      used += bytesRead;
    }
    const after = await file.stat();
    if (used > max || before.size !== after.size || before.mtimeMs !== after.mtimeMs || used !== before.size) throw new Error('source changed during bounded read');
    return buffer.subarray(0, used);
  } finally { await file.close(); }
}
/** Canonical repository blob, including path-based EOL conversion and clean filters.
 * No object is written. Callers provide checked bytes and their remaining budget.
 */
export async function canonicalSourceBlob({ root, path, bytes, env = process.env, timeout = 3000 }) {
  if (!sourcePath(path) || !Buffer.isBuffer(bytes) || bytes.length > LONG_FILE_LIMITS.fileBytes) throw new Error('canonical source input exceeds bounds');
  if (!Number.isFinite(timeout) || timeout <= 0) throw new Error('canonical source hash reached time bound');
  const blob = (await command(env.PLATES_GIT || 'git', ['hash-object', `--path=${path}`, '--stdin'],
    { cwd: root, env, input: bytes, timeout: Math.min(3000, timeout), maxBuffer: 1024, rejectStderr: true, filterTree: true })).trim();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(blob)) throw new Error('canonical source blob identity unavailable');
  return blob;
}

/** Tracked canonical working source only; bounded history is evidence, never acceptance. */
export async function longFiles({ root, config = {}, env = process.env, now = Date.now(), limits = {} } = {}) {
  const { longFileLines } = hygieneOptions(config);
  const cap = { ...LONG_FILE_LIMITS, ...limits }, start = Date.now();
  const facts = { schema: 1, observedAt: new Date(now).toISOString(), longFileLines, source: 'tracked canonical working-tree source', sectionMethod: 'column-zero declarations and section comments; heuristic, not a parser', files: [], coverage: { complete: false, gaps: [], tracked: 0, scanned: 0, excluded: 0, bytes: 0 }, limits: cap };
  const gaps = facts.coverage.gaps;
  const git = (args, maxBuffer = cap.listBytes) => {
    const remaining = cap.ms - (Date.now() - start);
    if (remaining <= 0) throw new Error('long-file observation reached time bound');
    return command(env.PLATES_GIT || 'git', args, { cwd: root, env, timeout: Math.max(1, Math.min(3000, remaining)), maxBuffer });
  };
  try {
    root = await realpath(root);
    const top = (await git(['rev-parse', '--show-toplevel'])).trim();
    if (await realpath(top) !== root) throw new Error('project root is not its own Git worktree; parent Git is not a source');
    facts.head = (await git(['rev-parse', '--verify', 'HEAD'])).trim();
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(facts.head)) throw new Error('HEAD identity unavailable');
    const raw = await git(['ls-files', '--stage', '-z']);
    if (raw && !raw.endsWith('\0')) throw new Error('tracked file list truncated');
    const entries = raw.split('\0').filter(Boolean);
    facts.coverage.tracked = entries.length;
    if (entries.length > cap.files) throw new Error('tracked file count exceeds bound');
    let managed = new Set();
    try {
      const lock = JSON.parse((await localBytes(root, '.plates/lock.json', cap.fileBytes)).toString('utf8'));
      if (!lock?.files || typeof lock.files !== 'object' || Array.isArray(lock.files)) throw new Error('malformed managed file inventory');
      managed = new Set(Object.keys(lock.files));
    } catch (e) { if (e.code !== 'ENOENT') throw new Error(`managed file inventory unavailable: ${e.message}`); }
    const seen = new Set();
    for (const entry of entries) {
      if (Date.now() - start >= cap.ms) throw new Error('long-file observation reached time bound');
      const match = /^(\d{6}) ([a-f0-9]{40}|[a-f0-9]{64}) ([0-3])\t([\s\S]+)$/.exec(entry);
      if (!match) throw new Error('malformed tracked source entry');
      const [, mode, , stage, path] = match;
      if (!sourcePath(path) || (managed.has(path) && !path.startsWith('practices/')) || !['100644', '100755'].includes(mode)) { facts.coverage.excluded++; continue; }
      if (stage !== '0' || seen.has(path)) { gaps.push(`${path}: unmerged or duplicate index entry`); continue; }
      seen.add(path);
      try {
        const bytes = await localBytes(root, path, Math.min(cap.fileBytes, cap.totalBytes - facts.coverage.bytes));
        facts.coverage.bytes += bytes.length;
        if (bytes.includes(0)) { facts.coverage.excluded++; continue; }
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        if (generatedSource(text)) { facts.coverage.excluded++; continue; }
        facts.coverage.scanned++;
        const lines = lineCount(text);
        if (lines > longFileLines) {
          if (facts.files.length >= cap.findings) throw new Error('long-file finding count exceeds output bound');
          const blob = await canonicalSourceBlob({root,path,bytes,env,timeout:cap.ms - (Date.now() - start)});
          facts.files.push({ path, lines, blob, rawDigest: createHash('sha256').update(bytes).digest('hex'), largestSections: largestSections(text), history: { complete: false, gaps: ['history not read'], entries: [] } });
        }
      } catch (e) { gaps.push(`${path}: ${e.message}`); if (gaps.length >= 30) throw new Error('source gap count exceeds output bound'); }
    }
    facts.files.sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path));
    let shallow = true;
    try { shallow = (await git(['rev-parse', '--is-shallow-repository'])).trim() !== 'false'; } catch { /* history remains explicitly incomplete */ }
    for (const [i, file] of facts.files.entries()) {
      if (i >= cap.historyFiles) { file.history.gaps = ['history file count bound']; continue; }
      const history = { complete: false, gaps: [], entries: [] };
      file.history = history;
      try {
        const log = await git(['log', `-n${cap.historyCommits + 1}`, '--format=%H%x09%cI', facts.head, '--', file.path], 64 * 1024);
        const records = log.trim() ? log.trim().split('\n') : [];
        if (shallow) history.gaps.push('shallow history');
        if (records.length > cap.historyCommits) history.gaps.push(`history truncated to ${cap.historyCommits} revisions`);
        if (!records.length) history.gaps.push('no committed history for this path');
        for (const row of records.slice(0, cap.historyCommits)) {
          const [commit, date] = row.split('\t');
          if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit) || !Number.isFinite(Date.parse(date))) throw new Error('malformed history revision');
          const r = { commit, date, blob: null, lines: null };
          history.entries.push(r);
          try {
            // cat-file addresses an immutable object; no filesystem symlink traversal.
            const identity = (await git(['rev-parse', '--verify', `${commit}:${file.path}`], 1024)).trim();
            if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(identity)) throw new Error('history blob identity unavailable');
            r.blob = identity;
            const bytes = await git(['cat-file', 'blob', identity], cap.fileBytes);
            r.lines = lineCount(bytes);
          } catch (e) { history.gaps.push(`${commit}: ${e.message}`); }
        }
        history.complete = !history.gaps.length;
      } catch (e) { history.gaps.push(e.message); }
    }
    facts.coverage.complete = !gaps.length;
    if (gaps.length) return { na: `long-file coverage incomplete: ${gaps.join('; ')}`, facts };
    return { value: facts.files.length, detail: `${facts.files.length} tracked source files over ${longFileLines} lines; ${facts.files.slice(0, 5).map(f => `${f.path} (${f.lines})`).join(', ') || 'none'}; split points are heuristics; ${facts.files.filter(f => !f.history.complete).length} histories incomplete`, facts };
  } catch (e) {
    gaps.push(String(e.message).slice(0, 500));
    return { na: `long-file coverage incomplete: ${gaps.join('; ')}`, facts };
  }
}
