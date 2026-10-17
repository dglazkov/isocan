import { isMain } from './lib.mjs';
// Production logs are observations, never acceptance or instructions.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { productionConfig, windowFor, collectSource } from './production-collectors.mjs';
import { readState, transaction, digest, fail, recoverState, boundedJson, validProbe, retainVerification } from './production-store.mjs';
export { productionConfig, windowFor } from './production-collectors.mjs';
export function applyObservation(state, source, observation) {
  let saved = state.sources[source.id];
  if (saved && saved.scope !== source.scopeKey) fail('source scope changed; choose a new source id');
  saved ??= state.sources[source.id] = { scope:source.scopeKey, windows:[], watermark:null };
  observation = {...observation,start:new Date(observation.start).toISOString(),end:new Date(observation.end).toISOString()};
  const key = digest([source.scopeKey,observation.start,observation.end]);
  const fingerprint = digest(observation);
  const prior = saved.windows.find(w => w.id === key);
  if (prior?.digest === fingerprint) return { replay:true, window:prior };
  if (saved.watermark && observation.start <= saved.watermark) fail('observation predates retained identity horizon');
  const ids = [];
  for (const event of observation.events) {
    const id = event.signature;
    let incident = state.incidents[id];
    incident ??= state.incidents[id] = { id,scope:source.scopeKey,source:source.id,type:event.type,locations:event.locations,status:'new',count:0,firstSeen:event.time,lastSeen:event.time,events:[],revisions:[],confidence:'exact',references:[] };
    const identity = event.event ?? digest([source.scopeKey,id,event.time]);
    if (!event.event || event.lowerBound) incident.confidence = 'lower-bound';
    if (!incident.events.includes(identity)) {
      incident.events.push(identity); incident.count++;
      incident.firstSeen = incident.firstSeen < event.time ? incident.firstSeen : event.time;
      incident.lastSeen = incident.lastSeen > event.time ? incident.lastSeen : event.time;
      if (incident.status === 'verified' && event.time >= incident.verification.start) { retainVerification(incident,incident.verification); incident.status = 'regressed'; }
      else if (incident.status === 'new' && incident.count >= source.threshold) incident.status = 'recurring';
      if (event.revision && !incident.revisions.includes(event.revision)) incident.revisions.push(event.revision);
    }
    ids.push(id);
  }
  const window = { id:key,digest:fingerprint,start:observation.start,end:observation.end,coverage:observation.coverage,gaps:observation.gaps,incidents:[...new Set(ids)],events:observation.events.length,traffic:observation.traffic };
  if (prior) saved.windows.splice(saved.windows.indexOf(prior),1);
  saved.windows.push(window); saved.windows.sort((a,b)=>a.end.localeCompare(b.end));
  while (saved.windows.length > 64) { const removed = saved.windows.shift(); saved.watermark = removed.end; state.droppedWindows++; }
  // Never evict unresolved incidents or event identities: byte bound refuses writes instead.
  return { replay:false,window };
}
export async function status({ root, config, now = new Date() }) {
  let p;
  try { p = productionConfig(config); } catch { return { state:'unavailable',sources:[],incidents:[],gaps:['configuration-invalid'] }; }
  if (!p.enabled) return { state:p.applicability ?? 'off',sources:[],incidents:[],gaps:[] };
  let state;
  try { state = await readState(root); } catch { return { state:'unavailable',sources:[],incidents:[],gaps:['state-unavailable-or-recovery-required'] }; }
  const sources = p.sources.map(s => {
    const saved = state.sources[s.id], latest = saved?.windows.at(-1);
    const stale = !latest || (now.getTime() - Date.parse(latest.end) > s.windowMinutes * 60000 || Date.parse(latest.end) > now.getTime());
    const gaps = saved && saved.scope !== s.scopeKey ? ['scope-changed'] : !latest ? ['not-collected'] : [...latest.gaps,...(stale ? ['stale-window'] : [])];
    return { id:s.id,provider:s.provider,coverage:gaps.length ? 'unknown' : latest.coverage,gaps,latest:latest ?? null };
  });
  return { state:'observed',sources,incidents:Object.values(state.incidents).map(({events,...i})=>({...i,activity:p.sources.some(s=>s.id===i.source && s.scopeKey===i.scope)?'active':'inactive-source'})),gaps:sources.flatMap(s=>s.gaps.map(g=>`${s.id}:${g}`)),droppedWindows:state.droppedWindows,droppedReceipts:state.droppedReceipts,retention:{ windowsPerSource:64,receipts:64,verificationHistoryPerIncident:32,unresolved:'retained; capacity refuses further writes' } };
}
export async function collect({ root, config, yes = false, source, start, end, now = new Date(), ...deps }) {
  const p = productionConfig(config);
  if (!p.enabled) return status({root,config,now});
  const selected = p.sources.filter(s => !source || s.id === source);
  if (!selected.length) fail('unknown production source');
  const planned = selected.map(s=>({source:s,window:windowFor(s,{start,end,now})}));
  if (!yes) return { state:'preview',sources:planned.map(({source:s,window})=>({id:s.id,provider:s.provider,...window,maxEvents:s.maxEvents,maxBytes:s.maxBytes,timeoutMs:s.timeoutMs})) };
  return transaction(root,async state => {
    const results = [];
    for (const {source:s,window:w} of planned) {
      const o = await collectSource(root,s,w,deps);
      results.push({source:s.id,...applyObservation(state,s,o),attempts:o.attempts});
    }
    return { state:'collected',results,gaps:results.flatMap(r=>r.window.gaps.map(g=>`${r.source}:${g}`)) };
  });
}
export function sourceLink(source) {
  if (source.provider === 'gcp') return `https://console.cloud.google.com/run/detail/${encodeURIComponent(source.region)}/${encodeURIComponent(source.service)}/logs?project=${encodeURIComponent(source.project)}`;
  if (source.provider === 'vercel') return source.dashboardUrl ?? 'https://vercel.com/dashboard';
  return '.keel/production/state.json';
}
export async function spec({ root, config, incident }) {
  const p = productionConfig(config), state = await readState(root), i = state.incidents[incident];
  if (!i) fail('unknown production incident');
  const s = p.sources.find(s=>s.id === i.source && s.scopeKey === i.scope);
  if (!s) fail('incident source no longer matches configuration');
  return { state:'prepared',incident:i.id,subjectKey:`production:${i.scope}:${i.id}`,title:`Production ${i.type} ${i.id.slice(0,12)}`,source:sourceLink(s),rubric:{
    version:1,problem:`Production incident ${i.id}; source ${s.id}; ${i.count} observations (${i.confidence}) from ${i.firstSeen} to ${i.lastSeen}. Source: ${sourceLink(s)}.`,
    reproduction:'Reproduce this error shape using synthetic Acme inputs. Logs alone do not establish reproduction. Add a regression test and prove it fails on the baseline without the fix.',
    acceptance:'The baseline-failing regression test passes with the fix; after deployment, verify the fixed revision, complete source-matched coverage, sufficient traffic or an explicitly approved equivalent probe, and no recurrence. Merge and issue closure do not establish acceptance.',
    change:'One bounded repair at the reproduced code location; identify affected files during review. No automatic merge or deployment.',
    prerequisites:[],ownerBlockers:['Reproduction and intended fix need review before this task is buildable.'],
  } };
}
// Assessment consumes freshly read delivery evidence, not a user-imported success boolean.
export function assessVerification({ incident, source, window, revision, deployment, live, probe, timedProbe, now = new Date() }) {
  const gaps = [];
  if (!window || window.coverage !== 'complete' || window.gaps.length) gaps.push('complete-window-required');
  if (!window || Date.parse(window.end) > now.getTime() || Date.parse(window.start) < Date.parse(incident.lastSeen) || (incident.verification && Date.parse(window.end) <= Date.parse(incident.verification.end))) gaps.push('post-error-ordered-window-required');
  if (!deployment || deployment.site !== source.site || deployment.serving !== revision || !deployment.ok || Date.parse(deployment.at) >= Date.parse(window?.start) || !deployment.run) gaps.push('recorded-deployment-required');
  if (!live || !live.ok || live.serving !== revision || live.site !== source.site || !live.smoke?.length || live.smoke.some(s=>!s.matched)) gaps.push('live-revision-and-smokes-required');
  if (!probe || source.equivalentProbe !== probe || !live?.smoke?.some(s=>s.path === probe && s.matched)) gaps.push('traffic-or-approved-equivalent-probe-required');
  if (!validProbe(timedProbe) || timedProbe.scope !== source.scopeKey || timedProbe.revision !== revision || timedProbe.site !== source.site || timedProbe.path !== probe || Date.parse(timedProbe.startedAt) < Date.parse(window?.start) || Date.parse(timedProbe.completedAt) > Date.parse(window?.end)) gaps.push('probe-outside-window');
  if (window?.incidents.includes(incident.id)) return { state:'recurring',gaps,revision,start:window.start,end:window.end };
  return { state:gaps.length ? 'inconclusive' : 'verified',gaps,revision,start:window?.start ?? null,end:window?.end ?? null };
}
export async function verify({ root,config,incident,revision,probe,yes=false, deliveryVerify, fetch }) {
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(revision ?? '')) fail('verify requires full fixed revision');
  const state = await readState(root), i = state.incidents[incident];
  if (!i) fail('unknown production incident');
  const s = productionConfig(config).sources.find(s=>s.id === i.source && s.scopeKey === i.scope);
  if (!s) fail('incident source changed');
  const window = state.sources[s.id].windows.at(-1);
  if (!yes) return {state:'preview',incident,revision,window:window?.id,probe:probe ?? null};
  let deployment, live, startedAt, completedAt;
  if (s.site && s.site === config.delivery?.site && (config.practices ?? []).includes('delivery')) {
    try {
      const { readVerify } = await import('./morning.mjs');
      const records = readVerify(root);
      deployment = !records.unread && records.results.find(r=>r.site === s.site && r.serving === revision && r.ok && Date.parse(r.at) < Date.parse(window?.start));
      // CLI uses its package implementation; installed night uses its installed delivery module.
      const check = deliveryVerify ?? (await import(pathToFileURL(join(root,'scripts/keel/verify.mjs')).href)).verify;
      startedAt = new Date().toISOString();
      live = await check({root,config,sha:revision,exact:true,within:0,fetch});
      completedAt = new Date().toISOString();
    } catch { /* Missing delivery remains inconclusive; provider details stay private. */ }
  }
  const saved = state.sources[s.id];
  const probes = (saved.probes ?? []).filter(p=>p.scope===s.scopeKey && p.site===s.site && p.revision===revision && p.path===probe && validProbe(p));
  let receipt;
  if (live?.ok && live.serving===revision && live.site===s.site && probe===s.equivalentProbe && live.smoke?.length && live.smoke.every(x=>x.matched) && live.smoke.some(x=>x.path===probe)) {
    receipt={version:2,id:digest([s.scopeKey,revision,s.site,probe,startedAt,completedAt]),scope:s.scopeKey,revision,site:s.site,path:probe,startedAt,completedAt,smokeCount:live.smoke.length,origin:'delivery.verify'};
    if(!validProbe(receipt)) receipt=null;
  }
  // A completed earlier check establishes revision before the window. A
  // separate probe's entire execution interval must fit inside the window.
  const timedProbe=probes.find(p=>p.startedAt>=window?.start && p.completedAt<=window?.end);
  if(!deployment) {
    const previous=probes.filter(p=>p.completedAt<window?.start).at(-1);
    if(previous) deployment={site:previous.site,serving:previous.revision,ok:true,at:previous.completedAt,run:`delivery.verify:${previous.id}`};
  }
  const result = assessVerification({incident:i,source:s,window,revision,deployment,live,probe,timedProbe});
  result.evidence = {
    scope:s.scopeKey, checkedAt:new Date().toISOString(),
    window:window ? {id:window.id,digest:window.digest,coverage:window.coverage} : null,
    probe:timedProbe ? structuredClone(timedProbe) : null,
    deployment:deployment?.ok && deployment.site===s.site && deployment.serving===revision && deployment.run && Number.isFinite(Date.parse(deployment.at))
      ? {reference:digest(deployment.run),site:s.site,revision,at:new Date(deployment.at).toISOString()} : null,
    liveProbe:receipt ? structuredClone(receipt) : null,
  };
  return transaction(root,async current=>{
    if (digest(current) !== digest(state)) fail('production evidence changed during verification; retry against current evidence');
    const sourceState=current.sources[s.id];
    if(receipt) {
      sourceState.probes ??= []; sourceState.droppedProbes ??= 0;
      if(!sourceState.probes.some(p=>p.id===receipt.id)) sourceState.probes.push(receipt);
      sourceState.probes.sort((a,b)=>a.completedAt.localeCompare(b.completedAt));
      while(sourceState.probes.length>32){sourceState.probes.shift();sourceState.droppedProbes++;}
    }
    const row = current.incidents[incident];
    retainVerification(row,row.lastVerification);
    if (result.state === 'verified') { retainVerification(row,row.verification); row.status='verified'; row.verification=result; }
    else if (result.state === 'recurring' && row.status === 'verified') { retainVerification(row,row.verification); row.status='regressed'; }
    row.lastVerification = result;
    return {...result,probeReceipt:receipt ? {id:receipt.id,startedAt:receipt.startedAt,completedAt:receipt.completedAt,path:receipt.path} : null,usedProbe:timedProbe?.id ?? null};
  });
}
export async function productionCandidates({root,config,now}) {
  const reading = await status({root,config,now});
  if (['off','not-applicable'].includes(reading.state)) return [];
  const candidate = (id,title) => ({id,kind:'triage',title,source:'health:production_errors',lane:'night'});
  return [
    ...(reading.gaps.length ? [candidate('production-coverage','Production unknown coverage: '+reading.gaps.join(', ').slice(0,220))] : []),
    ...reading.incidents.filter(i=>i.activity==='active' && ['recurring','regressed','awaiting-fix'].includes(i.status)).slice(0,5).map(i=>candidate('production-'+i.id.slice(0,16),`Production ${i.activity==='inactive-source'?'inactive-source ('+i.status+')':i.status}: ${i.type} ${i.id.slice(0,12)} (${i.count}, ${i.confidence})`)),
  ];
}
export function productionLines(reading) {
  if (!reading || reading.state === 'off') return [];
  if (reading.state === 'not-applicable') return ['Production monitoring: not applicable; no monitored runtime.'];
  return [`Production monitoring: ${reading.state}; coverage gaps: ${reading.gaps.join(', ') || 'none'}.`,...reading.incidents.slice(0,20).map(i=>`Production ${i.activity==='inactive-source'?'inactive-source ('+i.status+')':i.status}: ${i.type} ${i.id.slice(0,12)}; ${i.count} observations (${i.confidence}).`)];
}
export async function run(args,{root=process.cwd(),deliveryVerify}={}) {
  const [verb='status',...rest]=args.filter(a=>a!=='--json'), opts={root,deliveryVerify};
  const valued={'--source':'source','--start':'start','--end':'end','--incident':'incident','--revision':'revision','--probe':'probe'};
  for(let n=0;n<rest.length;n++) {
    const a=rest[n];
    if(a==='--json') continue;
    if(a==='--yes'||a==='--recover') {opts[a.slice(2)]=true;continue;}
    if(!valued[a]||!rest[n+1]||rest[n+1].startsWith('--')) fail('invalid production argument');
    opts[valued[a]]=rest[++n];
  }
  opts.config=await boundedJson(join(root,'.keel/keel.json'));
  let data;
  if(verb==='status' && opts.recover) { if(!opts.yes) data={state:'preview',action:'recover'}; else data=await recoverState(root); }
  else if(verb==='status') data=await status(opts);
  else if(verb==='collect') data=await collect(opts);
  else if(verb==='spec') data=await spec(opts);
  else if(verb==='verify') data=await verify(opts);
  else fail('production expects status, collect, spec or verify');
  return {data,text:JSON.stringify(data,null,2),exitCode:data.state==='preview'?3:data.state==='inconclusive'||data.state==='unavailable'||data.results?.some(r=>r.window.coverage==='unavailable')?1:0};
}
if (isMain(import.meta)) {
  try { const r=await run(process.argv.slice(2)); console.log(process.argv.includes('--json')?JSON.stringify(r.data):r.text);process.exitCode=r.exitCode; }
  catch { console.log(JSON.stringify({error:'production operation refused; check configuration, state or recovery'}));process.exitCode=2; }
}
