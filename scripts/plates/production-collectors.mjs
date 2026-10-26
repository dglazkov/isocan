import { setTimeout as delay } from 'node:timers/promises';
import { execFile } from 'node:child_process';
import { join, isAbsolute } from 'node:path';
import { boundedJson, digest, fail } from './production-store.mjs';
const token = s => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(s);
export const utc = s => typeof s === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().replace('.000Z','Z') === s.replace('.000Z','Z');
export function productionConfig(config) {
  const p = config?.production;
  if (!p) return { enabled: false, sources: [] };
  if (p.version !== 1 || typeof p.enabled !== 'boolean') fail('production requires version:1 and enabled:boolean');
  if (p.since !== undefined && !utc(p.since)) fail('production since requires a UTC start boundary');
  if (p.applicability === 'not-applicable') return { enabled: false, applicability: 'not-applicable', sources: [] };
  if (!p.enabled) return { enabled: false, sources: [] };
  if (!Array.isArray(p.sources) || !p.sources.length || p.sources.length > 8) fail('production requires 1–8 explicit sources');
  const ids = new Set();
  const sources = p.sources.map(s => {
    if (!s || !token(s.id) || ids.has(s.id) || ['constructor','prototype','__proto__'].includes(s.id) || !token(s.service) || s.environment !== 'production' || !['gcp','vercel','json'].includes(s.provider)) fail('invalid production source identity');
    ids.add(s.id);
    for (const [key, max] of Object.entries({ windowMinutes:1440, maxEvents:10000, maxBytes:4194304, timeoutMs:60000, threshold:10000 })) if (!Number.isSafeInteger(s[key]) || s[key] < 1 || s[key] > max) fail('production source requires bounded ' + key);
    if (s.provider !== 'json' && !token(s.project)) fail('production source requires project');
    if (s.provider === 'gcp' && !token(s.region)) fail('gcp source requires region');
    if (s.provider === 'vercel' && !token(s.scope)) fail('vercel source requires scope');
    if (s.provider === 'json' && (typeof s.input !== 'string' || isAbsolute(s.input) || s.input.split(/[\\/]/).includes('..'))) fail('json source requires confined input');
    if (s.dashboardUrl !== undefined && !/^https:\/\/vercel\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(s.dashboardUrl)) fail('dashboardUrl requires a Vercel team/project path');
    if (s.equivalentProbe !== undefined && (typeof s.equivalentProbe !== 'string' || !/^\/[A-Za-z0-9_./-]{0,199}$/.test(s.equivalentProbe) || s.equivalentProbe.includes('..') || !s.site)) fail('equivalentProbe requires a safe path and source site');
    if (s.site !== undefined) { let u; try { u = new URL(s.site); } catch {} if (!u || u.protocol !== 'https:' || u.origin !== s.site) fail('source site must be an HTTPS origin'); }
    return { ...s, scopeKey: digest([s.id,s.provider,s.project ?? null,s.scope ?? null,s.service,s.region ?? null,s.environment]) };
  });
  return { enabled:true, sources, since:p.since ?? null };
}
export function windowFor(source, { start, end, now = new Date() } = {}) {
  end ??= now.toISOString(); start ??= new Date(Date.parse(end) - source.windowMinutes * 60000).toISOString();
  if (!utc(start) || !utc(end) || Date.parse(start) >= Date.parse(end) || Date.parse(end) > now.getTime() || Date.parse(end)-Date.parse(start) > source.windowMinutes * 60000) fail('production requires a bounded past UTC window');
  return { start, end };
}
export function commandFor(s, w) {
  if (s.provider === 'gcp') return { command:'gcloud', args:['logging','read',`resource.type="cloud_run_revision" AND resource.labels.service_name="${s.service}" AND resource.labels.location="${s.region}" AND severity>=ERROR AND timestamp>="${w.start}" AND timestamp<="${w.end}"`, '--project',s.project,'--order=asc','--limit',String(s.maxEvents),'--format=json','--quiet'] };
  if (s.provider === 'vercel') return { command:'vercel', args:['logs','--project',s.project,'--scope',s.scope,'--environment','production','--since',w.start,'--until',w.end,'--limit',String(s.maxEvents),'--level','error','--level','fatal','--json'] };
  return null;
}
// stderr is used only to classify failure; never returned, persisted or printed.
export function providerEnv(command, env = process.env) {
  const result = {...env};
  delete result.VERCEL_API_TOKEN;
  if (command !== 'vercel') delete result.VERCEL_TOKEN;
  return result;
}
export const execute = (command, args, options) => new Promise(resolve => execFile(command, args,{ timeout:options.timeoutMs, maxBuffer:options.maxBytes, encoding:'utf8', cwd:options.root, env:providerEnv(command,options.env) }, (e,stdout,stderr) => {
  const reason = !e ? null : e.code === 'ENOENT' ? 'cli-unavailable' : e.killed ? 'timeout' : e.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? 'byte-limit' : /unauth|permission|forbidden|login|credential|invalid_grant|invalid.argument/i.test(stderr) ? 'access-or-config' : /429|503|temporar|rate.limit|ECONNRESET/i.test(stderr) ? 'transient' : 'provider-read-failed';
  resolve({ stdout: e ? '' : stdout, reason });
}));
const typeOf = raw => {
  const m = String(raw ?? '').match(/\b(?:TypeError|RangeError|ReferenceError|SyntaxError|URIError|EvalError|AggregateError|AssertionError|TimeoutError)\b/);
  return m?.[0] ?? 'Error';
};
export function providerTime(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000 ? new Date(value).toISOString() : null;
  if (typeof value !== 'string') return null;
  const m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/.exec(value);
  if (!m) return null;
  const normalized = m[1] + '.' + (m[2] ?? '').padEnd(3,'0').slice(0,3) + 'Z';
  return Number.isFinite(Date.parse(normalized)) && new Date(normalized).toISOString() === normalized ? normalized : null;
}
export function normalizeEvent(raw, s) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if ([raw.exceptionType,raw.message,raw.textPayload,raw.stack,raw.jsonPayload?.message,raw.jsonPayload?.stack].some(v=>v !== undefined && typeof v !== 'string')) return null;
  const timestamp = raw.timestamp ?? raw.time ?? raw.created;
  const time = providerTime(timestamp);
  if (!time) return null;
  const message = String(raw.exceptionType ?? raw.jsonPayload?.message ?? raw.textPayload ?? raw.message ?? '');
  const type = typeOf(message);
  // Preserve code locations as hashes: even a filename can contain a user ID.
  const locations = [...String(raw.stack ?? raw.jsonPayload?.stack ?? message).matchAll(/(?:[A-Za-z0-9_./-]+\.(?:[cm]?js|tsx?|py|go|rs)):\d+(?::\d+)?/g)].slice(0,8).map(m => digest(m[0]));
  const normalized = message.slice(0,16000).replace(/https?:\/\/\S+|\b[^\s@]+@[^\s@]+\b/g,'<private>').replace(/(['"`]).*?\1/g,'<value>').replace(/\b[0-9a-f]{8,}\b|\b\d+(?:\.\d+)*\b/gi,'#').replace(/\b(?:token|session|authorization|password|cookie|key)\s*[:=]\s*\S+/gi,'<private>');
  const route = typeof raw.requestPath === 'string' ? raw.requestPath.split(/[?#]/)[0].replace(/\b\d+\b|[0-9a-f]{8}-[0-9a-f-]+/gi,'#') : '';
  const httpShape = [digest(route), Number.isInteger(raw.responseStatusCode) ? raw.responseStatusCode : null, digest(String(raw.source ?? ''))];
  const signature = digest([s.scopeKey,type,locations.length ? locations : normalized,httpShape]);
  const identity = raw.insertId ?? raw.id ?? raw.requestId;
  const knownIdentity = (typeof identity === 'string' && identity.trim().length > 0) || Number.isSafeInteger(identity);
  const revision = raw.resource?.labels?.revision_name ?? raw.deploymentId ?? raw.revision;
  return { signature, type, locations, time:new Date(time).toISOString(), event:!knownIdentity ? null : digest([s.scopeKey,String(identity)]), revision:revision == null ? null : digest(String(revision)) };
}
// Vercel emits requests, with timestamp-less child logs. Count request/signature,
// not array positions: pagination and reordered children must remain replay-safe.
function requestEvents(row, source) {
  const children = Array.isArray(row?.logs) ? row.logs.filter(log=>['error','fatal'].includes(log?.level)) : [];
  const shapes = new Map();
  for (const child of children.length ? children : [null]) {
    const event = normalizeEvent(child ? {...row,message:child.message} : row,source);
    if (!event) return [];
    if (shapes.has(event.signature)) { shapes.get(event.signature).lowerBound = true; continue; }
    if (event.event) event.event = digest([event.event,event.signature]);
    shapes.set(event.signature,event);
  }
  return [...shapes.values()];
}
export async function collectSource(root, s, w, { runner = execute, env, sleep = delay } = {}) {
  let rows = [], gaps = [], attempts = 0;
  try {
    if (s.provider === 'json') {
      const input = await boundedJson(join(root,s.input),s.maxBytes);
      if (input.version !== 1 || input.source !== s.id || input.service !== s.service || input.environment !== s.environment || input.start !== w.start || input.end !== w.end || !Array.isArray(input.events)) throw new Error();
      rows = input.events;
      if (input.coverage !== 'complete' || input.sampled || input.truncated || input.nextPage || input.expired) gaps.push('input-coverage-incomplete');
    } else {
      const cmd = commandFor(s,w); let r;
      do { if (attempts) await sleep(100 * 2 ** (attempts - 1)); attempts++; r = await runner(cmd.command,cmd.args,{...s,root,env}); } while (r.reason === 'transient' && attempts < 3);
      if (r.reason) return { ...w, events:[], gaps:[r.reason], coverage:'unavailable', attempts, traffic:null };
      if (Buffer.byteLength(r.stdout) > s.maxBytes) throw new Error();
      if (s.provider === 'gcp') rows = JSON.parse(r.stdout);
      else rows = r.stdout.trim() ? r.stdout.trim().split(/\r?\n/).map(l => JSON.parse(l)) : [];
      if (!Array.isArray(rows)) throw new Error();
      // CLI results do not attest retention, sampling or ingestion completeness.
      gaps.push('provider-completeness-unproven');
      if (s.windowMinutes < 1440) gaps.push('nightly-cadence-gap');
    }
    if (rows.length >= s.maxEvents) gaps.push('event-limit');
    const events = [];
    for (const row of rows.slice(0,s.maxEvents)) {
      if (row?.sampled || row?.truncated || row?.nextPage || row?.expired || row?.messageTruncated || (Array.isArray(row?.logs) && row.logs.some(log=>log?.messageTruncated))) gaps.push('event-coverage-incomplete');
      let normalized; try { normalized = s.provider === 'vercel' ? requestEvents(row,s) : [normalizeEvent(row,s)]; } catch { normalized = []; }
      if (!normalized.length) gaps.push('timestamp-or-shape');
      for (const event of normalized) {
        if (!event || event.time < new Date(w.start).toISOString() || event.time > new Date(w.end).toISOString()) { gaps.push('timestamp-or-shape'); continue; }
        const previous = events.find(e=>e.signature===event.signature && (event.event ? e.event===event.event : !e.event && e.time===event.time));
        if (previous) { if(event.lowerBound) previous.lowerBound=true; continue; }
        if (events.length >= s.maxEvents) { gaps.push('event-limit'); continue; }
        events.push(event);
      }
    }
    if (events.some(e => !e.event)) gaps.push('identity-unknown');
    return { ...w, events, gaps:[...new Set(gaps)], coverage:gaps.length ? 'partial' : 'complete', attempts, traffic:null };
  } catch { return { ...w,events:[],gaps:['malformed-or-unavailable-input'],coverage:'unavailable',attempts,traffic:null }; }
}
