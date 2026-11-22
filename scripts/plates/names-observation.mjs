// Bounded data only. Validation establishes shape and internal consistency, not
// provider truth, runtime import-closure coverage, privacy, or authority to act.
// Producers allowlist generated regions; the verifier checks immutable sources,
// actual objects and attempt-specific provider facts independently.
import { createHash } from 'node:crypto';
import { inflateRawSync, crc32 } from 'node:zlib';
import { nameRow } from './names.mjs';

export const OBSERVATION_LIMITS = Object.freeze({ jsonBytes: 1048576, writes: 512, reads: 64,
  fragments: 128, fragmentBytes: 262144, archiveBytes: 8388608, sourceFiles: 128,
  listingPages: 20, listingPageSize: 100 });
export const WRITE_ROLES = Object.freeze(['health-report', 'bounds', 'night-record', 'working-plan', 'time-remeasurement', 'plan-publication', 'health-plan-section', 'night-pr', 'final-pr', 'brief-issue', 'closure-comment']);
export class NamesObservationError extends Error {
  constructor(code, path = '$') { super(`names observation: ${code} at ${path}`); this.name = 'NamesObservationError'; this.code = code; this.path = path; }
}
const fail = (code, path) => { throw new NamesObservationError(code, path); };
const check = (ok, path, code = 'invalid_metadata') => { if (!ok) fail(code, path); };
const hash = b => createHash('sha256').update(b).digest('hex');
const text = (v, p, re = /^[\x20-\x7e]+$/, max = 512) => check(typeof v === 'string' && v.length <= max && re.test(v), p);
const id = (v, p) => check(Number.isSafeInteger(v) && v > 0, p);
const bool = (v, p) => check(typeof v === 'boolean', p);
const sha = (v, p) => text(v, p, /^[a-f0-9]{40}$/);
const digest = (v, p) => text(v, p, /^[a-f0-9]{64}$/);
const artifactDigest = (v, p) => text(v, p, /^sha256:[a-f0-9]{64}$/);
const token = (v, p) => text(v, p, /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/, 128);
const nullable = (fn, v, p) => { if (v !== null) fn(v, p); };
const one = (v, values, p) => check(values.includes(v), p);
const date = (v, p) => { text(v, p, /^\d{4}-\d{2}-\d{2}$/); check(!Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, p); };
const timestamp = (v, p) => { text(v, p, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/); check(!Number.isNaN(Date.parse(v)) && new Date(v).toISOString() === v.replace(/(?<!\.\d{3})Z$/, '.000Z'), p); };
function path(v, p) {
  text(v, p, /^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/);
  check(v.split('/').every(s => s !== '.' && s !== '..'), p, 'unsafe_path');
}
function ref(v, p) {
  path(v, p); check(!v.includes('..') && !v.endsWith('.') && !v.split('/').some(s => s.startsWith('.') || s.endsWith('.lock')), p);
}
const fragmentPath = (v, p) => text(v, p, /^fragments\/[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}\.txt$/);
function shape(v, fields, p) {
  check(v !== null && typeof v === 'object' && !Array.isArray(v) && [null, Object.prototype].includes(Object.getPrototypeOf(v)), p);
  const keys = Reflect.ownKeys(v), allowed = fields.split(' ');
  check(keys.length === allowed.length && keys.every(k => typeof k === 'string' && allowed.includes(k)), p, 'unknown_or_missing_field');
  check(keys.every(k => { const d = Object.getOwnPropertyDescriptor(v, k); return d.enumerable && Object.hasOwn(d, 'value'); }), p, 'non_data_value');
}
function list(v, max, p, fn, identity) {
  check(Array.isArray(v) && v.length <= max, p, 'limit_exceeded');
  const seen = new Set();
  for (let i = 0; i < v.length; i++) {
    const d = Object.getOwnPropertyDescriptor(v, i); check(d && Object.hasOwn(d, 'value'), p, 'non_data_value');
    fn(v[i], `${p}[${i}]`);
    if (identity) { const key = identity(v[i]); check(!seen.has(key), p, 'duplicate_identity'); seen.add(key); }
  }
}
function repository(v, p) { shape(v, 'id fullName', p); id(v.id, `${p}.id`); text(v.fullName, `${p}.fullName`, /^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+$/, 200); }
function source(v, p, repo, commit) {
  shape(v, 'repositoryId commitSha path blobSha sha256', p);
  id(v.repositoryId, p); sha(v.commitSha, p); path(v.path, p); sha(v.blobSha, p); digest(v.sha256, p);
  if (repo !== undefined) check(v.repositoryId === repo, p, 'identity_mismatch');
  if (commit !== undefined) check(v.commitSha === commit, p, 'identity_mismatch');
}
function sourceFiles(v, p, repo, commit) {
  list(v, OBSERVATION_LIMITS.sourceFiles, p, (s, q) => source(s, q, repo, commit), s => s.path); check(v.length > 0, p);
}
function jobStep(v, p) {
  token(v.job, `${p}.job`); text(v.step, `${p}.step`, /^[a-zA-Z0-9][a-zA-Z0-9_.-]*\/[a-zA-Z0-9][a-zA-Z0-9_.-]*$/, 257);
  check(v.step.split('/')[0] === v.job, p, 'identity_mismatch');
}
function snapshot(v, p) {
  shape(v, 'state commitSha blobSha sha256 labelIds providerUpdatedAt', p); one(v.state, ['present', 'absent'], p);
  nullable(sha, v.commitSha, p); nullable(sha, v.blobSha, p); nullable(digest, v.sha256, p); nullable(timestamp, v.providerUpdatedAt, p);
  list(v.labelIds, 100, p, id, x => x);
  if (v.state === 'absent') check(v.blobSha === null && v.sha256 === null && v.labelIds.length === 0, p);
  else digest(v.sha256, p);
}
function target(v, p, repo) {
  check(v && typeof v === 'object', p);
  if (v.kind === 'git') { shape(v, 'kind repositoryId ref path', p); ref(v.ref, p); path(v.path, p); }
  else { shape(v, 'kind repositoryId id number headSha', p); one(v.kind, ['pr', 'issue', 'comment'], p); nullable(id, v.id, p); nullable(id, v.number, p); nullable(sha, v.headSha, p); }
  check(v.repositoryId === repo, p, 'identity_mismatch');
}
function association(v, kind, p) {
  if (v === null) return;
  if (kind === 'night') {
    shape(v, 'kind date branch leaseId preexisting preimageHeadSha prId prNumber headSha planPath planBlobSha', p);
    ref(v.branch, p); nullable(token, v.leaseId, p); bool(v.preexisting, p); nullable(sha, v.preimageHeadSha, p);
    nullable(id, v.prId, p); nullable(id, v.prNumber, p); nullable(sha, v.headSha, p); nullable(path, v.planPath, p); nullable(sha, v.planBlobSha, p);
    check((v.prId === null) === (v.prNumber === null), p);
  } else {
    shape(v, 'kind date nightBranch finalPrId finalPrNumber finalHeadSha briefIssueId briefIssueNumber', p);
    ref(v.nightBranch, p); nullable(id, v.finalPrId, p); nullable(id, v.finalPrNumber, p); nullable(sha, v.finalHeadSha, p);
    nullable(id, v.briefIssueId, p); nullable(id, v.briefIssueNumber, p);
    check((v.finalPrId === null) === (v.finalPrNumber === null) && (v.briefIssueId === null) === (v.briefIssueNumber === null), p);
  }
  check(v.kind === kind, p); date(v.date, p);
}
function utf8(b, max, p) {
  check(Buffer.isBuffer(b) || b instanceof Uint8Array, p); check(b.byteLength <= max, p, 'limit_exceeded');
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(b); } catch { fail('invalid_utf8', p); }
}
export function observationArtifactName(runId, runAttempt) {
  id(runId, '$.runId'); id(runAttempt, '$.runAttempt'); return `plates-names-observation-${runId}-${runAttempt}`;
}

/** Structural validation is deliberately NOT a provider verification result. */
export function validateObservation(v, { expected, fragments } = {}) {
  shape(v, 'schema kind repository execution scope originatingNight association producers writes reads projections artifacts fragments gaps', '$');
  check(v.schema === 1, '$.schema'); one(v.kind, ['night', 'morning'], '$.kind'); repository(v.repository, '$.repository');
  const repo = v.repository.id, e = v.execution;
  shape(e, 'workflowPath runId runAttempt event headSha codeSha startedAt finishedAt codeIdentity', '$.execution');
  path(e.workflowPath, '$.execution.workflowPath'); check(/^\.github\/workflows\/[^/]+\.ya?ml$/.test(e.workflowPath), '$.execution.workflowPath');
  id(e.runId, '$.execution.runId'); id(e.runAttempt, '$.execution.runAttempt'); check(e.event === 'workflow_dispatch', '$.execution.event');
  sha(e.headSha, '$.execution.headSha'); sha(e.codeSha, '$.execution.codeSha'); timestamp(e.startedAt, '$.execution.startedAt'); nullable(timestamp, e.finishedAt, '$.execution.finishedAt');
  if (e.finishedAt !== null) check(Date.parse(e.finishedAt) >= Date.parse(e.startedAt), '$.execution.finishedAt');
  if (e.codeIdentity !== null) {
    const c = e.codeIdentity; shape(c, 'repository commitSha entrypoint files', '$.execution.codeIdentity'); repository(c.repository, '$.execution.codeIdentity.repository');
    sha(c.commitSha, '$.execution.codeIdentity.commitSha'); path(c.entrypoint, '$.execution.codeIdentity.entrypoint'); sourceFiles(c.files, '$.execution.codeIdentity.files', c.repository.id, c.commitSha);
    check(c.files.some(s => s.path === c.entrypoint), '$.execution.codeIdentity.entrypoint', 'missing_source');
  }
  shape(v.scope, 'workflow configuration runtime producers', '$.scope');
  source(v.scope.workflow, '$.scope.workflow', repo, e.headSha); check(v.scope.workflow.path === e.workflowPath, '$.scope.workflow', 'identity_mismatch');
  source(v.scope.configuration, '$.scope.configuration', repo, e.codeSha);
  shape(v.scope.runtime, 'codeSha sourceFiles', '$.scope.runtime'); check(v.scope.runtime.codeSha === e.codeSha, '$.scope.runtime', 'identity_mismatch');
  sourceFiles(v.scope.runtime.sourceFiles, '$.scope.runtime.sourceFiles', repo, e.codeSha);
  list(v.scope.producers, 128, '$.scope.producers', (s, p) => {
    shape(s, 'id job step source mode reason', p); token(s.id, p); jobStep(s, p); source(s.source, p);
    // Installed producers may point only to an exact file in the separately
    // validated code identity. This does not change checkout sources or the
    // repository association of any observed read, write or artifact.
    const installed = e.codeIdentity?.files.some(f => canonical(f) === canonical(s.source)) === true;
    if (!installed) source(s.source, p, repo, e.codeSha);
    one(s.mode, ['enabled', 'disabled', 'unsupported'], p); nullable(token, s.reason, p);
    if (s.mode !== 'enabled') token(s.reason, p);
  }, s => s.id);
  const declared = new Map(v.scope.producers.map(s => [s.id, s]));
  if (v.kind === 'night') check(v.originatingNight === null, '$.originatingNight');
  else {
    const n = v.originatingNight; shape(n, 'repositoryId runId runAttempt headSha artifactId artifactDigest', '$.originatingNight');
    check(n.repositoryId === repo, '$.originatingNight', 'identity_mismatch'); id(n.runId, '$.originatingNight'); id(n.runAttempt, '$.originatingNight');
    sha(n.headSha, '$.originatingNight'); id(n.artifactId, '$.originatingNight'); artifactDigest(n.artifactDigest, '$.originatingNight');
  }
  association(v.association, v.kind, '$.association');
  list(v.producers, 128, '$.producers', (s, p) => {
    shape(s, 'id job step outcome observedAt reason', p); token(s.id, p); jobStep(s, p);
    const d = declared.get(s.id); check(d && d.job === s.job && d.step === s.step, p, 'identity_mismatch');
    one(s.outcome, ['completed', 'failed', 'skipped', 'unfinished', 'unavailable'], p); timestamp(s.observedAt, p); nullable(token, s.reason, p);
  }, s => s.id);
  const meta = new Map(), used = new Set();
  list(v.fragments, OBSERVATION_LIMITS.fragments, '$.fragments', (f, p) => {
    shape(f, 'path bytes sha256 kind', p); fragmentPath(f.path, p); check(Number.isSafeInteger(f.bytes) && f.bytes >= 0 && f.bytes <= OBSERVATION_LIMITS.fragmentBytes, p, 'limit_exceeded');
    digest(f.sha256, p); one(f.kind, ['managed-fragment', 'projection'], p); meta.set(f.path, f);
  }, f => f.path);
  if (fragments !== undefined) {
    check(fragments instanceof Map && fragments.size === meta.size, '$.fragments', 'fragment_set_mismatch');
    for (const [name, b] of fragments) {
      const f = meta.get(name); check(f !== undefined, '$.fragments', 'fragment_set_mismatch');
      const content = utf8(b, OBSERVATION_LIMITS.fragmentBytes, '$.fragments');
      if (f.kind === 'projection') parseJSON(content);
      check(b.byteLength === f.bytes && hash(b) === f.sha256, '$.fragments', 'fragment_digest_mismatch');
    }
  }
  function fragment(name, kind, p) { fragmentPath(name, p); const f = meta.get(name); check(f && f.kind === kind, p, 'missing_fragment'); used.add(name); return f; }
  list(v.writes, OBSERVATION_LIMITS.writes, '$.writes', (w, p) => {
    shape(w, 'producerId role sequence operationId target outcome before intended after observedAt', p);
    one(w.role, WRITE_ROLES, `${p}.role`);
    check(declared.has(w.producerId), p, 'identity_mismatch'); id(w.sequence, p); nullable(token, w.operationId, p); target(w.target, p, repo);
    one(w.outcome, ['not-attempted', 'attempted-unknown', 'confirmed', 'no-change'], p);
    nullable(snapshot, w.before, `${p}.before`); nullable(snapshot, w.after, `${p}.after`); timestamp(w.observedAt, p);
    shape(w.intended, 'fragment sha256 names', `${p}.intended`); fragment(w.intended.fragment, 'managed-fragment', p); digest(w.intended.sha256, p);
    list(w.intended.names, 512, `${p}.intended.names`, (n, q) => {
      shape(n, 'rowId value', q); text(n.rowId, q); text(n.value, q);
      let row; try { row = nameRow(n.rowId); } catch { fail('unknown_name_identity', q); }
      check(n.value === row.keel || n.value === row.plates, q, 'name_identity_mismatch');
      if (fragments !== undefined) check(Buffer.from(fragments.get(w.intended.fragment)).toString('utf8').includes(n.value), q, 'missing_name_token');
    }, n => `${n.rowId}\0${n.value}`);
    if (['not-attempted', 'attempted-unknown'].includes(w.outcome)) check(w.after === null, p, 'uncertain_write_has_after');
    if (['confirmed', 'no-change'].includes(w.outcome)) {
      check(w.after?.state === 'present', p);
      if (w.target.kind !== 'git') { id(w.target.id, p); if (w.target.kind !== 'comment') id(w.target.number, p); }
    }
    // A confirmed transport may read back a mismatch. Retain it: verifier must
    // classify unknown, never silently overwrite or accept intended==actual.
    if (w.outcome === 'no-change') check(w.before !== null && canonical(w.before) === canonical(w.after), p, 'no_change_mismatch');
  }, w => `${w.producerId}/${w.sequence}`);
  list(v.reads, OBSERVATION_LIMITS.reads, '$.reads', (r, p) => {
    shape(r, 'consumer sourceKind repositoryId ref path commitSha blobSha sha256 state absence selected contributed outputSection outputProjection recordIds', p);
    one(r.consumer, ['morning-brief', 'morning-final', 'home'], p); one(r.sourceKind, ['plan', 'verify'], p); check(r.repositoryId === repo, p, 'identity_mismatch');
    ref(r.ref, p); path(r.path, p); nullable(sha, r.commitSha, p); nullable(sha, r.blobSha, p); nullable(digest, r.sha256, p);
    one(r.state, ['read', 'absent', 'unavailable', 'skipped'], p); one(r.absence, ['ref', 'path', null], p); bool(r.selected, p); bool(r.contributed, p); token(r.outputSection, p);
    shape(r.outputProjection, 'fragment sha256', `${p}.outputProjection`); const f = fragment(r.outputProjection.fragment, 'projection', p); digest(r.outputProjection.sha256, p); check(f.sha256 === r.outputProjection.sha256, p, 'fragment_digest_mismatch');
    list(r.recordIds, 512, p, token, x => x);
    if (r.state === 'read') { sha(r.commitSha, p); sha(r.blobSha, p); digest(r.sha256, p); check(r.absence === null, p); }
    else {
      check(!r.selected && !r.contributed && r.blobSha === null && r.sha256 === null && r.recordIds.length === 0, p);
      if (r.state === 'absent') { check(r.absence !== null, p); if (r.absence === 'ref') check(r.commitSha === null, p); else sha(r.commitSha, p); }
      else check(r.absence === null, p);
    }
  }, r => `${r.consumer}/${r.sourceKind}/${r.ref}/${r.path}/${r.outputSection}`);
  list(v.projections, 128, '$.projections', (r, p) => {
    shape(r, 'producerId kind fragment sha256', p); check(declared.has(r.producerId), p, 'identity_mismatch');
    check(r.kind === 'drain-queue', p); const f = fragment(r.fragment, 'projection', p); digest(r.sha256, p);
    check(f.sha256 === r.sha256, p, 'fragment_digest_mismatch');
  }, r => `${r.producerId}/${r.kind}`);
  list(v.artifacts, 128, '$.artifacts', (a, p) => {
    shape(a, 'id name runId runAttempt headSha digest expired step', p); id(a.id, p); text(a.name, p, /^[a-zA-Z0-9_.-]+$/); artifactDigest(a.digest, p); bool(a.expired, p);
    check(a.runId === e.runId && a.runAttempt === e.runAttempt && a.headSha === e.headSha, p, 'identity_mismatch');
    text(a.step, p, /^[a-zA-Z0-9][a-zA-Z0-9_.-]*\/[a-zA-Z0-9][a-zA-Z0-9_.-]*$/);
    check(!a.name.startsWith('plates-names-observation-'), p, 'self_certified_artifact');
  }, a => a.id);
  list(v.gaps, 512, '$.gaps', (g, p) => {
    shape(g, 'code producerId source', p); token(g.code, p); if (g.producerId !== null) check(declared.has(g.producerId), p, 'identity_mismatch');
    if (g.source !== null) source(g.source, p, repo);
  });
  check(used.size === meta.size, '$.fragments', 'unreferenced_fragment');
  if (expected !== undefined) {
    check(expected && typeof expected === 'object' && !Array.isArray(expected), '$.expected');
    check(Object.keys(expected).every(k => ['kind', 'repository', 'execution'].includes(k)), '$.expected', 'unknown_or_missing_field');
    if (Object.hasOwn(expected, 'kind')) check(v.kind === expected.kind, '$.expected.kind', 'identity_mismatch');
    if (Object.hasOwn(expected, 'repository')) { repository(expected.repository, '$.expected.repository'); check(canonical(expected.repository) === canonical(v.repository), '$.expected.repository', 'identity_mismatch'); }
    if (Object.hasOwn(expected, 'execution')) {
      const x = expected.execution; check(x && typeof x === 'object' && !Array.isArray(x), '$.expected.execution');
      check(Object.keys(x).every(k => Object.hasOwn(e, k)), '$.expected.execution', 'unknown_or_missing_field');
      for (const k of Object.keys(x)) check(canonical(x[k]) === canonical(e[k]), '$.expected.execution', 'identity_mismatch');
    }
  }
  check(Buffer.byteLength(canonical(v)) + 1 <= OBSERVATION_LIMITS.jsonBytes, '$', 'limit_exceeded');
  return v;
}

function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
}
export function encodeObservation(value, options) {
  check(options?.fragments instanceof Map, '$.fragments', 'fragment_bytes_required');
  validateObservation(value, options); return Buffer.from(`${canonical(value)}\n`);
}
// JSON.parse alone discards duplicate keys. Parse with bounded depth and reject
// duplicates (including escaped aliases) before shape validation can lose them.
function parseJSON(s) {
  let i = 0;
  const ws = () => { while (/[\t\r\n ]/.test(s[i] ?? '\0')) i++; };
  function string() {
    const start = i++; let escaped = false;
    while (i < s.length) { const c = s[i++]; if (c === '"' && !escaped) { try { return JSON.parse(s.slice(start, i)); } catch { fail('invalid_json'); } } if (c === '\\' && !escaped) escaped = true; else escaped = false; }
    fail('invalid_json');
  }
  function value(depth) {
    check(depth <= 64, '$', 'limit_exceeded'); ws(); const c = s[i];
    if (c === '"') return string();
    if (c === '{' || c === '[') {
      const object = c === '{', out = object ? Object.create(null) : [], end = object ? '}' : ']'; i++; ws();
      if (s[i] === end) { i++; return out; }
      for (;;) {
        ws(); let key;
        if (object) { check(s[i] === '"', '$', 'invalid_json'); key = string(); check(!Object.hasOwn(out, key), '$', 'duplicate_key'); ws(); check(s[i++] === ':', '$', 'invalid_json'); }
        const v = value(depth + 1); if (object) out[key] = v; else out.push(v);
        ws(); if (s[i] === end) { i++; return out; } check(s[i++] === ',', '$', 'invalid_json');
      }
    }
    const m = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(s.slice(i));
    check(m !== null, '$', 'invalid_json'); i += m[0].length; return JSON.parse(m[0]);
  }
  const out = value(0); ws(); check(i === s.length, '$', 'invalid_json'); return out;
}
export function decodeObservation(bytes, options) {
  return validateObservation(parseJSON(utf8(bytes, OBSERVATION_LIMITS.jsonBytes, '$')), options);
}
export function observationFiles(value, fragments) {
  check(fragments instanceof Map, '$.fragments');
  const json = encodeObservation(value, { fragments });
  check(json.length + [...fragments.values()].reduce((n, b) => n + b.byteLength, 0) <= OBSERVATION_LIMITS.archiveBytes, '$', 'limit_exceeded');
  return new Map([['observation.json', json], ...[...fragments].sort(([a], [b]) => a.localeCompare(b)).map(([p, b]) => [p, Buffer.from(b)])]);
}

// Inspect EVERY member before inflating ANY member. No extraction or paths on
// disk. Unknown metadata and ZIP64 are unsupported, rather than guessed safe.
function zipMembers(b) {
  check(Buffer.isBuffer(b) && b.length >= 22 && b.length <= OBSERVATION_LIMITS.archiveBytes, '$.archive', 'limit_exceeded');
  const need = (at, n) => check(Number.isSafeInteger(at) && at >= 0 && n >= 0 && at + n <= b.length, '$.archive', 'invalid_archive');
  let end = -1;
  for (let at = b.length - 22; at >= Math.max(0, b.length - 65557); at--) {
    if (b.readUInt32LE(at) === 0x06054b50 && at + 22 + b.readUInt16LE(at + 20) === b.length) { end = at; break; }
  }
  check(end >= 0, '$.archive', 'invalid_archive');
  const count = b.readUInt16LE(end + 10), size = b.readUInt32LE(end + 12), offset = b.readUInt32LE(end + 16);
  check(b.readUInt16LE(end + 4) === 0 && b.readUInt16LE(end + 6) === 0 && count === b.readUInt16LE(end + 8) && b.readUInt16LE(end + 20) === 0, '$.archive', 'unsupported_archive');
  check(count >= 1 && count <= OBSERVATION_LIMITS.fragments + 2 && size !== 0xffffffff && offset !== 0xffffffff && offset + size === end, '$.archive', 'limit_exceeded');
  function extras(at, n) {
    const stop = at + n, seen = new Set(); need(at, n);
    while (at < stop) {
      check(at + 4 <= stop, '$.archive', 'invalid_archive'); const tag = b.readUInt16LE(at), len = b.readUInt16LE(at + 2); at += 4;
      check(at + len <= stop, '$.archive', 'invalid_archive');
      check(!seen.has(tag), '$.archive', 'duplicate_archive_metadata'); seen.add(tag);
      // Only inert timestamp/UID fields. Alternate paths, ZIP64 and all other
      // extensions are refused. These bytes confer no ownership authority.
      check((tag === 0x5455 && [1, 5, 9, 13].includes(len)) || (tag === 0x7875 && len >= 3 && len <= 19), '$.archive', 'unsupported_archive_metadata');
      if (tag === 0x5455) {
        const flags = b[at], fields = (flags & 1) + ((flags >> 1) & 1) + ((flags >> 2) & 1);
        check((flags & ~7) === 0 && (len === 1 + fields * 4 || (len === 5 && (flags & 1))), '$.archive', 'unsupported_archive_metadata');
      }
      if (tag === 0x7875) {
        check(b[at] === 1 && [1, 2, 4, 8].includes(b[at + 1]), '$.archive', 'unsupported_archive_metadata');
        const gid = at + 2 + b[at + 1]; check(gid < at + len && [1, 2, 4, 8].includes(b[gid]) && gid + 1 + b[gid] === at + len, '$.archive', 'unsupported_archive_metadata');
      }
      at += len;
    }
  }
  let at = offset, expanded = 0; const members = [], names = new Set();
  for (let i = 0; i < count; i++) {
    need(at, 46); check(b.readUInt32LE(at) === 0x02014b50, '$.archive', 'invalid_archive');
    const made = b.readUInt16LE(at + 4), version = b.readUInt16LE(at + 6), flags = b.readUInt16LE(at + 8), method = b.readUInt16LE(at + 10);
    const crc = b.readUInt32LE(at + 16), compressed = b.readUInt32LE(at + 20), bytes = b.readUInt32LE(at + 24);
    const nl = b.readUInt16LE(at + 28), xl = b.readUInt16LE(at + 30), cl = b.readUInt16LE(at + 32), disk = b.readUInt16LE(at + 34), attr = b.readUInt32LE(at + 38), local = b.readUInt32LE(at + 42);
    check([0, 3].includes(made >> 8) && [10, 20].includes(version) && (flags & ~0x808) === 0 && [0, 8].includes(method) && disk === 0 && cl === 0, '$.archive', 'unsupported_archive');
    need(at + 46, nl + xl + cl); const name = utf8(b.subarray(at + 46, at + 46 + nl), 512, '$.archive');
    if (name !== 'observation.json' && name !== 'fragments/') fragmentPath(name, '$.archive');
    check(!names.has(name), '$.archive', 'duplicate_archive_name'); names.add(name);
    const directory = name === 'fragments/', type = (attr >>> 16) & 0xf000;
    check(type === 0 || type === (directory ? 0x4000 : 0x8000), '$.archive', 'unsafe_archive_mode');
    check((attr & 0x10) === 0 || directory, '$.archive', 'unsafe_archive_mode');
    check(bytes <= (name === 'observation.json' ? OBSERVATION_LIMITS.jsonBytes : OBSERVATION_LIMITS.fragmentBytes) && compressed <= OBSERVATION_LIMITS.archiveBytes, '$.archive', 'limit_exceeded');
    if (directory) check(bytes === 0 && compressed === 0 && method === 0 && crc === 0, '$.archive', 'invalid_archive');
    expanded += bytes; check(expanded <= OBSERVATION_LIMITS.archiveBytes, '$.archive', 'limit_exceeded');
    extras(at + 46 + nl, xl);
    need(local, 30); check(local < offset && b.readUInt32LE(local) === 0x04034b50, '$.archive', 'invalid_archive');
    const lnl = b.readUInt16LE(local + 26), lxl = b.readUInt16LE(local + 28), start = local + 30 + lnl + lxl;
    need(local + 30, lnl + lxl); need(start, compressed);
    check(b.readUInt16LE(local + 4) === version && b.readUInt16LE(local + 6) === flags && b.readUInt16LE(local + 8) === method && b.subarray(local + 30, local + 30 + lnl).equals(b.subarray(at + 46, at + 46 + nl)), '$.archive', 'archive_header_mismatch');
    extras(local + 30 + lnl, lxl);
    let stop = start + compressed;
    const lc = b.readUInt32LE(local + 14), lz = b.readUInt32LE(local + 18), lu = b.readUInt32LE(local + 22);
    if (flags & 8) {
      check((lc === 0 || lc === crc) && (lz === 0 || lz === compressed) && (lu === 0 || lu === bytes), '$.archive', 'archive_header_mismatch');
      need(stop, 12); if (b.readUInt32LE(stop) === 0x08074b50) { stop += 4; need(stop, 12); }
      check(b.readUInt32LE(stop) === crc && b.readUInt32LE(stop + 4) === compressed && b.readUInt32LE(stop + 8) === bytes, '$.archive', 'archive_header_mismatch'); stop += 12;
    } else check(lc === crc && lz === compressed && lu === bytes, '$.archive', 'archive_header_mismatch');
    check(stop <= offset, '$.archive', 'archive_overlap');
    members.push({ name, local, start, stop, compressed, bytes, method, crc, directory }); at += 46 + nl + xl + cl;
  }
  check(at === end && names.has('observation.json'), '$.archive', 'invalid_archive');
  let stop = 0;
  for (const m of [...members].sort((a, b) => a.local - b.local)) { check(m.local === stop, '$.archive', 'archive_overlap'); stop = m.stop; }
  check(stop === offset, '$.archive', 'archive_overlap');
  return members;
}
/** artifact is normalized by the caller ONLY after fresh name/run/jobs checks.
 * GitHub raw metadata does not intrinsically contain runAttempt. */
export function decodeObservationArchive(zip, { expected, artifact } = {}) {
  shape(artifact, 'id name repositoryId runId runAttempt headSha digest expired', '$.artifact');
  id(artifact.id, '$.artifact'); id(artifact.repositoryId, '$.artifact'); sha(artifact.headSha, '$.artifact'); artifactDigest(artifact.digest, '$.artifact'); bool(artifact.expired, '$.artifact');
  check(!artifact.expired, '$.artifact', 'expired_artifact');
  check(artifact.name === observationArtifactName(artifact.runId, artifact.runAttempt), '$.artifact', 'identity_mismatch');
  check(Buffer.isBuffer(zip) && zip.length <= OBSERVATION_LIMITS.archiveBytes, '$.archive', 'limit_exceeded');
  check(`sha256:${hash(zip)}` === artifact.digest, '$.artifact', 'artifact_digest_mismatch');
  const entries = zipMembers(zip), files = new Map();
  for (const m of entries) {
    if (m.directory) continue;
    let bytes; const compressed = zip.subarray(m.start, m.start + m.compressed);
    if (m.method === 0) bytes = Buffer.from(compressed);
    else {
      try {
        const result = inflateRawSync(compressed, { maxOutputLength: Math.max(1, m.bytes), info: true });
        check(result.engine.bytesWritten === compressed.length, '$.archive', 'invalid_deflate'); bytes = result.buffer;
      } catch (e) { if (e instanceof NamesObservationError) throw e; fail('invalid_deflate', '$.archive'); }
    }
    check(bytes.length === m.bytes && crc32(bytes) === m.crc, '$.archive', 'archive_content_mismatch'); files.set(m.name, bytes);
  }
  const json = files.get('observation.json'); files.delete('observation.json');
  const observation = decodeObservation(json, { expected, fragments: files }), e = observation.execution;
  check(observation.repository.id === artifact.repositoryId && e.runId === artifact.runId && e.runAttempt === artifact.runAttempt && e.headSha === artifact.headSha, '$.artifact', 'identity_mismatch');
  return { observation, fragments: files };
}
