// Sanitized production evidence only. An interrupted transaction is explicit recovery work.
import { constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, rename, rm, readdir, realpath } from 'node:fs/promises';
import { resolve, join, parse, sep } from 'node:path';
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const MAX_STATE_BYTES = 8 * 1024 * 1024;
export class ProductionError extends Error { constructor(message) { super(message); this.exitCode = 2; } }
export const fail = message => { throw new ProductionError(message); };
export async function safePath(path, create = false, directory = false) {
  path = resolve(path);
  if (process.platform === 'darwin') for (const alias of ['/tmp', '/var']) {
    if (path.startsWith(alias + '/') && await realpath(alias) === '/private' + alias) path = '/private' + path;
  }
  let current = parse(path).root;
  const parts = path.slice(current.length).split(sep);
  for (const [i, part] of parts.entries()) {
    current = join(current, part);
    const dir = i < parts.length - 1 || directory;
    let st;
    try { st = await lstat(current); } catch (e) {
      if (e.code !== 'ENOENT') fail('production path unavailable');
      if (create && dir) { await mkdir(current, { mode: 0o700 }).catch(e => { if (e.code !== 'EEXIST') throw e; }); st = await lstat(current); }
      else continue;
    }
    if (st && (st.isSymbolicLink() || (dir ? !st.isDirectory() : !st.isFile()))) fail('production refuses symlinks and nonregular paths');
  }
  return path;
}
export async function boundedJson(path, max = MAX_STATE_BYTES) {
  path = await safePath(path);
  const h = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    if ((await h.stat()).size > max) fail('production JSON exceeds byte bound');
    const buffer = Buffer.alloc(max + 1), { bytesRead } = await h.read(buffer, 0, buffer.length, 0);
    if (bytesRead > max) fail('production JSON exceeds byte bound');
    try { return JSON.parse(buffer.subarray(0, bytesRead).toString('utf8')); } catch { fail('production JSON malformed'); }
  } finally { await h.close(); }
}
export async function atomicJson(path, data) {
  const text = JSON.stringify(data);
  if (Buffer.byteLength(text) > MAX_STATE_BYTES) fail('production state bound reached; unresolved evidence retained');
  path = await safePath(path, true);
  const temp = path + '.' + randomUUID() + '.tmp';
  const h = await open(temp, 'wx', 0o600);
  try { await h.writeFile(text); await h.sync(); } finally { await h.close(); }
  await safePath(path); await rename(temp, path);
  if (process.platform !== 'win32') { const parent = await open(resolve(path,'..'),'r'); try {await parent.sync();} finally {await parent.close();} }
}
export const emptyState = () => ({ version: 1, sources: {}, incidents: {}, droppedWindows: 0, droppedReceipts: 0 });
const hash = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const time = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const count = v => Number.isSafeInteger(v) && v >= 0;
const token = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(v);
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const keys = (v, names, required = names) => object(v) && Object.keys(v).every(k => names.includes(k)) && required.every(k => Object.hasOwn(v,k));
const list = (v, test, max = 100000) => Array.isArray(v) && v.length <= max && v.every(test);
const gaps = v => list(v,x=>['input-coverage-incomplete','event-limit','provider-completeness-unproven','nightly-cadence-gap','timestamp-or-shape','event-coverage-incomplete','identity-unknown','malformed-or-unavailable-input','cli-unavailable','timeout','byte-limit','access-or-config','transient','provider-read-failed'].includes(x),20);
export function validVerification(v) {
  return keys(v,['state','gaps','revision','start','end','evidence'],['state','gaps','revision','start','end']) && (v.evidence === undefined || validVerificationEvidence(v.evidence, v.revision)) && ['verified','inconclusive','recurring'].includes(v.state) && /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(v.revision??'') && (v.start === null || time(v.start)) && (v.end === null || time(v.end)) && list(v.gaps,g=>['complete-window-required','post-error-ordered-window-required','recorded-deployment-required','live-revision-and-smokes-required','traffic-or-approved-equivalent-probe-required','probe-outside-window'].includes(g),10);
}
export function validProbe(p) {
  return keys(p,['version','id','scope','revision','site','path','startedAt','completedAt','smokeCount','origin']) && p.version===2 && hash(p.id) && hash(p.scope) && /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(p.revision??'') && typeof p.site==='string' && /^https:\/\/[A-Za-z0-9.-]+(?::\d+)?$/.test(p.site) && typeof p.path==='string' && /^\/[A-Za-z0-9_./-]{0,199}$/.test(p.path) && !p.path.includes('..') && time(p.startedAt) && time(p.completedAt) && p.startedAt <= p.completedAt && count(p.smokeCount) && p.smokeCount>0 && p.origin==='delivery.verify' && p.id===digest([p.scope,p.revision,p.site,p.path,p.startedAt,p.completedAt]);
}
// Only allowlisted proof metadata survives; provider/deployment response bodies never do.
function validVerificationEvidence(e, revision) {
  const origin = v => typeof v === 'string' && /^https:\/\/[A-Za-z0-9.-]+(?::\d+)?$/.test(v);
  return keys(e,['scope','checkedAt','window','probe','deployment','liveProbe']) && hash(e.scope) && time(e.checkedAt)
    && (e.window === null || (keys(e.window,['id','digest','coverage']) && hash(e.window.id) && hash(e.window.digest) && ['complete','partial','unavailable'].includes(e.window.coverage)))
    && [e.probe,e.liveProbe].every(p=>p === null || (validProbe(p) && p.scope===e.scope && p.revision===revision))
    && (e.deployment === null || (keys(e.deployment,['reference','site','revision','at']) && hash(e.deployment.reference) && origin(e.deployment.site) && e.deployment.revision===revision && time(e.deployment.at)));
}
export function retainVerification(incident, verification) {
  incident.verificationHistory ??= [];
  incident.verificationHistoryDropped ??= 0;
  if (!verification || incident.verificationHistory.some(v=>digest(v)===digest(verification))) return;
  incident.verificationHistory.push(structuredClone(verification));
  incident.verificationHistory.sort((a,b)=>(a.evidence?.checkedAt ?? '').localeCompare(b.evidence?.checkedAt ?? ''));
  while (incident.verificationHistory.length > 32) { incident.verificationHistory.shift(); incident.verificationHistoryDropped++; }
}
export function validateState(s) {
  if (!keys(s,['version','sources','incidents','droppedWindows','droppedReceipts']) || s.version !== 1 || !object(s.sources) || !object(s.incidents) || !count(s.droppedWindows) || !count(s.droppedReceipts) || Object.keys(s.sources).length > 64 || Object.keys(s.incidents).length > 10000) fail('incompatible production state');
  for (const [id, i] of Object.entries(s.incidents)) {
    if (!keys(i,['id','scope','source','type','locations','status','count','firstSeen','lastSeen','events','revisions','confidence','references','verification','lastVerification','verificationHistory','verificationHistoryDropped'],['id','scope','source','type','locations','status','count','firstSeen','lastSeen','events','revisions','confidence','references']) || !hash(id) || i.id !== id || !hash(i.scope) || !token(i.source) || !['Error','TypeError','RangeError','ReferenceError','SyntaxError','URIError','EvalError','AggregateError','AssertionError','TimeoutError'].includes(i.type) || !list(i.locations,hash,8) || !count(i.count) || i.count < 1 || !time(i.firstSeen) || !time(i.lastSeen) || i.firstSeen > i.lastSeen || !list(i.events,hash) || new Set(i.events).size !== i.count || i.events.length !== i.count || !list(i.revisions,hash,10000) || !['exact','lower-bound'].includes(i.confidence) || !['new','recurring','awaiting-fix','verified','regressed','ignored'].includes(i.status)) fail('invalid production incident');
    if (!list(i.references,ref=>keys(ref,['repo','number','url']) && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(ref.repo) && count(ref.number) && ref.number > 0 && ref.url === `https://github.com/${ref.repo}/issues/${ref.number}`,100)) fail('invalid production references');
    for(const k of ['verification','lastVerification']) if(i[k] !== undefined && !validVerification(i[k])) fail('invalid production verification');
    if ((i.verificationHistory !== undefined || i.verificationHistoryDropped !== undefined) && (!list(i.verificationHistory,v=>validVerification(v) && (!v.evidence || v.evidence.scope===i.scope),32) || !count(i.verificationHistoryDropped))) fail('invalid production verification history');
    for (const v of [i.verification,i.lastVerification]) if(v?.evidence && v.evidence.scope !== i.scope) fail('verification scope mismatch');
    if(i.status === 'verified' && i.verification?.state !== 'verified') fail('verified incident lacks evidence');
  }
  for (const [id,source] of Object.entries(s.sources)) {
    if (!token(id) || !keys(source,['scope','windows','watermark','probes','droppedProbes'],['scope','windows','watermark']) || !hash(source.scope) || !(source.watermark === null || time(source.watermark)) || !list(source.windows,w=>keys(w,['id','digest','start','end','coverage','gaps','incidents','events','traffic']) && hash(w.id) && hash(w.digest) && time(w.start) && time(w.end) && w.start < w.end && ['complete','partial','unavailable'].includes(w.coverage) && gaps(w.gaps) && (w.coverage !== 'complete' || !w.gaps.length) && list(w.incidents,x=>hash(x) && s.incidents[x]?.scope === source.scope,10000) && count(w.events) && w.traffic === null,64)) fail('invalid production source state');
    if(source.probes !== undefined && (!list(source.probes,p=>validProbe(p) && p.scope===source.scope,32) || !count(source.droppedProbes))) fail('invalid production probe evidence');
  }
  for(const i of Object.values(s.incidents)) if(s.sources[i.source]?.scope !== i.scope) fail('incident source mismatch');
  return s;
}
export async function readState(root) {
  const dir = await safePath(join(root, '.plates/production'), false, true);
  const pending = await lstat(join(dir, 'pending.json')).catch(e => { if (e.code !== 'ENOENT') throw e; return null; });
  if (pending) fail('production transaction interrupted; run production status --recover --yes');
  try { return validateState(await boundedJson(join(dir, 'state.json'))); }
  catch (e) { if (e.code === 'ENOENT') return emptyState(); throw e; }
}
export async function transaction(root, fn) {
  const dir = await safePath(join(root, '.plates/production'), true, true);
  const lock = join(dir, 'writer.lock');
  try { await mkdir(lock, { mode: 0o700 }); } catch { fail('production writer lock exists; inspect interrupted writer before recovery'); }
  try {
    await safePath(join(dir, '.gitignore'));
    const ignore = await open(join(dir, '.gitignore'), 'wx', 0o600).catch(e => { if (e.code !== 'EEXIST') throw e; return null; });
    if (ignore) { await ignore.writeFile('*\n'); await ignore.close(); }
    else if ((await readFile(join(dir, '.gitignore'), 'utf8')).trim() !== '*') fail('production ignore does not protect private state');
    const state = await readState(root);
    const result = await fn(state);
    validateState(state);
    await safePath(join(dir, 'observations'), true, true);
    const files = (await readdir(join(dir, 'observations'))).filter(f => /^\d+-[a-f0-9-]+\.json$/.test(f)).sort();
    const evicted = files.slice(0, Math.max(0, files.length - 63));
    state.droppedReceipts += evicted.length;
    const record = { version: 1, id: `${Date.now()}-${randomUUID()}`, at: new Date().toISOString(), state, digest: digest(state) };
    await atomicJson(join(dir, 'pending.json'), record);
    await atomicJson(join(dir, 'state.json'), state);
    // Immutable receipts survive fresh-checkout artifact retention; no raw events.
    await safePath(join(dir, 'observations'), true, true);
    await atomicJson(join(dir, 'observations', record.id + '.json'), { version: 1, id: record.id, at: record.at, digest: record.digest });
    await rm(join(dir, 'pending.json'));
    for (const file of evicted) await rm(await safePath(join(dir, 'observations', file)));
    return result;
  } finally { await rm(lock, { recursive: true, force: true }); }
}
export async function recoverState(root) {
  const dir = await safePath(join(root, '.plates/production'), false, true);
  // Never steal a writer lock: an operator must establish that its process is dead.
  if (await lstat(join(dir, 'writer.lock')).catch(() => null)) fail('writer lock remains; establish writer termination and remove only its lock first');
  const p = await boundedJson(join(dir, 'pending.json'));
  if (!keys(p,['version','id','at','state','digest']) || p.version !== 1 || !/^\d+-[a-f0-9-]{36}$/.test(p.id) || !time(p.at) || digest(p.state) !== p.digest) fail('invalid pending recovery');
  validateState(p.state);
  await mkdir(join(dir, 'writer.lock'));
  try { await atomicJson(join(dir, 'state.json'), p.state); await safePath(join(dir,'observations'),true,true); await atomicJson(join(dir,'observations',p.id+'.json'),{version:1,id:p.id,at:p.at,digest:p.digest}); await rm(join(dir, 'pending.json')); }
  finally { await rm(join(dir, 'writer.lock'), { recursive: true }); }
  return { state: 'recovered' };
}
