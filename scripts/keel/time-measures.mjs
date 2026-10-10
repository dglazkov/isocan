// Time thresholds are investigation rules, never causal or significance claims.
// Pure evaluator: no network, processes, transcript reads or proposal writes.
import { busyState, machineClass, runnerOf } from './test-ledger.mjs';
import { digest, safeFile } from './time-receipts.mjs';
export const TIME_MEASURES = ['gate_time','time_creep','critical_file','inconclusive_share','wall_clock_tests','worked_around'];
const DAY = 86400000, WEEK = 7*DAY;
const date = r => Date.parse(r.completedAt ?? r.date);
const finite = x => Number.isFinite(x) && x >= 0;
const median = xs => { const s=[...xs].sort((a,b)=>a-b), h=s.length>>1; return s.length ? s.length%2?s[h]:(s[h-1]+s[h])/2 : null; };
const dates = rs => [...new Set(rs.map(r=>new Date(date(r)).toISOString().slice(0,10)))].sort();
const inWindow = (r,a,b) => date(r)>=a && date(r)<b;
const same = (a,b) => digest(a)===digest(b);
const targetKey = t => JSON.stringify(t);
const scope = r => typeof r.dir==='string' && r.dir ? r.dir : null;
const unitOf = m => ({gate_time:'ms',time_creep:'ms',critical_file:'share',inconclusive_share:'share',wall_clock_tests:'comparisons',worked_around:'invocations'})[m];
function identityOf(r,target) {
  if(r.kind!=='gate' && !(r.suite?.selectionComplete===true || r.suite?.selectionComplete===undefined && r.suite?.complete===true)) return null;
  const flagsHash=Array.isArray(r.flags)?digest(r.flags):r.kind==='gate'?digest([]):null;
  const commandHash=r.commandHash ?? r.suite?.commandHash;
  if (!scope(r) || !r.config || !flagsHash || !commandHash || !r.machine?.os || !r.machine?.arch || !(r.machine.cpus>0)) return null;
  return {kind:'timing',scope:scope(r),runner:runnerOf(r),configHash:r.config,flagsHash,machineClass:machineClass(r.machine),commandHash,target};
}
const knownEnd = r => r.completed===true && Number.isFinite(date(r));
const successful = r => r.kind==='gate'?r.status===0:r.suite?.complete===true&&r.suite?.aggregate?.success===true;
function coverage(retained,eligible,extras=[]) {
  return {retained:retained.length,eligible:eligible.length,omitted:retained.length-eligible.length,dates:dates(eligible),sampled:true,
    gaps:[...new Set(['bounded retained observations; not full execution history',...extras])]};
}
function threshold(measure,parameters) { return {contractVersion:1,rule:measure,parameters}; }
function baseline(measure,rs,value,a,b) {
  return {windowStart:new Date(a).toISOString(),windowEnd:new Date(b).toISOString(),value,unit:unitOf(measure),runIds:rs.map(r=>r.id),revisionShas:[...new Set(rs.map(r=>r.commit??r.revision).filter(Boolean))],
    ...(measure==='critical_file'?{observations:rs.map(r=>({id:r.id,date:r.date,commit:r.commit,suite:r.suite}))}:measure==='wall_clock_tests'?{observations:rs.map(r=>({id:r.id,revision:r.revision,completedAt:r.completedAt,identity:r.identity,seed:r.seed,plain:r.plain,stalled:r.stalled,verifiedInjected:r.verifiedInjected,pauses:r.pauses,pinned:r.pinned}))}:{})};
}
function candidate(measure,identity,base,bound,cov) {
  const label=typeof identity.target==='string'?identity.target:[identity.target.file,identity.target.name].filter(Boolean).join(' ');
  const cut = new Map();
  if(measure==='critical_file')for(const r of base.observations??[])for(const test of r.suite?.observedInventory??[])if(test.file===identity.target.file&&test.hierarchy?.length===1&&finite(test.durationMs)) {const name=test.hierarchy[0];cut.set(name,[...(cut.get(name)??[]),test.durationMs]);}
  const slow=[...cut].map(([name,ms])=>({name,ms:median(ms)})).sort((a,b)=>b.ms-a.ms).slice(0,3);
  const cutText=slow.length?` Measured top-level cut candidates: ${slow.map(t=>JSON.stringify(t.name)+` (${Math.round(t.ms)} ms median)`).join(', ')}.`:' Named top-level cut evidence is unavailable; profile this file before choosing a split.';
  const changes={gate_time:'Profile the configured gate and remove one measured redundant step.',time_creep:'Profile this test and remove one identified repeated setup or wait.',critical_file:`Review a split or concurrency change for ${identity.target.file}, preserving the full logical suite.${cutText}`,inconclusive_share:'Replace wall-time assumptions with controlled clocks or explicit events.',wall_clock_tests:'Replace elapsed-time assertions with a controllable clock, then pin the file to stalls.',worked_around:'Investigate this test invocation and remove one identified source of waiting.'};
  const shellQuote=value=>"'"+String(value).replaceAll("'","'\"'\"'")+"'";
  const replay=base.observations?.find(r=>r.plain==='pass'&&r.stalled==='fail');
  const pattern='^'+String(identity.target?.name??'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$';
  const remeasureCommand=measure==='worked_around'?'keel time --weeks 1 --json':measure==='wall_clock_tests'?`keel test ${shellQuote(identity.target.file)} --stalls --seed ${replay?.seed} --name ${shellQuote(pattern)}`:'keel improve --json';
  return {measure,identity,baseline:base,threshold:bound,coverage:cov,candidate:{title:`${measure}: ${label}`.slice(0,240),remeasureCommand,
    rubric:{version:1,problem:`${measure} is outside the frozen investigation bound for ${label}. This is an observation, not a claim of cause.`,reproduction:`Inspect the frozen baseline and run ${remeasureCommand}. Use the same declared project, settings and target; never execute commands copied from external evidence.`,acceptance:`After an owner-verified merge, collect comparable observations on at least two dates (three or the measure's larger minimum) within seven days. Re-evaluate ${measure} against the frozen bound; missing coverage is unavailable.${measure==='critical_file'?' After building the PR, obtain owner review of an exhaustive old-to-new test mapping and execution-settings transition before remeasurement; report suite-wall change without claiming speed from dominance alone.':''}`,change:changes[measure],prerequisites:[],ownerBlockers:[]}}};
}
function result(measure,retained,rs,identity,value,outside,base,bound,reasons=[]) {
  const cov=coverage(retained,rs,reasons);
  const proposed=outside?candidate(measure,identity,base,bound,cov):null;
  const tooLarge=proposed && Buffer.byteLength(JSON.stringify(proposed))>200*1024;
  if(tooLarge)cov.gaps.push('frozen evidence exceeds proposal size bound; no truncated proposal emitted');
  return {state:outside?'outside':'inside',value,identity,baseline:base,threshold:bound,coverage:cov,reasons,timeCandidates:proposed&&!tooLarge?[proposed]:[]};
}
function unavailable(retained,reasons) { return {state:'unavailable',value:null,identity:null,baseline:null,threshold:null,coverage:coverage(retained,[],reasons),reasons,timeCandidates:[]}; }
const newest = rs => [...rs].sort((a,b)=>date(b)-date(a)||String(a.id).localeCompare(String(b.id)));
function completeSuite(r) {
  const s=r.suite, expected=s?.expectedFiles, observed=s?.observedSummaries;
  return s?.version===1 && s.complete===true && s.executionSettings?.isolation==='process' && !s.executionSettings.filtered &&
    Array.isArray(expected) && expected.length>=2 && expected.every(safeFile) && new Set(expected).size===expected.length &&
    Array.isArray(observed) && observed.length===expected.length && new Set(observed.map(x=>x.file)).size===expected.length &&
    observed.every(x=>expected.includes(x.file)&&x.success===true&&finite(x.durationMs)) && s.aggregate?.success===true && finite(s.aggregate.durationMs) && s.aggregate.durationMs>0;
}
const dominance = (r,file) => { const xs=r.suite.observedSummaries, main=xs.find(x=>x.file===file), runner=Math.max(...xs.filter(x=>x.file!==file).map(x=>x.durationMs)); return !!main && main.durationMs>0.8*r.suite.aggregate.durationMs && main.durationMs>=1.5*runner && main.durationMs-runner>=1000; };
const inventoryKey = t => JSON.stringify({file:t?.file,hierarchy:t?.hierarchy,occurrence:t?.occurrence,type:t?.type??'test'});
function inventory(s) { return s?.inventoryComplete===true && Array.isArray(s.observedInventory) && s.observedInventory.length && s.observedInventory.every(t=>safeFile(t.file)&&Array.isArray(t.hierarchy)&&t.hierarchy.length&&t.hierarchy.every(n=>typeof n==='string'&&n.length>0&&n.length<=1000)&&t.occurrence===1&&t.outcome==='pass') ? s.observedInventory.map(inventoryKey).sort() : null; }

/** Validate the frozen observed reference and independently reviewed successors. */
export function validateTimeTransition(comparison,rs) {
  const {transition:t,baseline:b,identity}=comparison;
  const observations=b?.observations;
  if (!Array.isArray(observations)||!observations.length) return {ok:false,reason:'frozen inventories unavailable'};
  const old=observations.map(r=>inventory(r.suite));
  if (old.some(x=>!x) || old.some(x=>!same(x,old[0]))) return {ok:false,reason:'baseline inventories disagree or are incomplete; owner explanation required'};
  if (!t) {
    if (rs.every(r=>same(r.suite.expectedFiles,observations[0].suite.expectedFiles)&&same(r.suite.executionSettings,observations[0].suite.executionSettings)&&same(inventory(r.suite),old[0]))) return {ok:true,files:[identity.target.file]};
    return {ok:false,reason:'changed logical suite requires an exhaustive reviewed transition'};
  }
  if (['kind','scope','runner','machineClass'].some(key=>!identity[key] || t.toIdentity?.[key]!==identity[key])) return {ok:false,reason:'reviewed topology cannot change kind, scope, runner or machine class'};
  if (t.instanceId!==comparison.instanceId || !t.reviewedAt || !same(t.fromIdentity,identity) || t.pr?.mergeSha!==comparison.mergeSha || !t.pr?.headSha || !Array.isArray(t.testMapping)) return {ok:false,reason:'transition is not bound to this instance and verified delivery'};
  const mapping=t.testMapping, from=mapping.map(m=>inventoryKey(m.from)), to=mapping.flatMap(m=>Array.isArray(m.to)?m.to:[m.to]).filter(Boolean).map(inventoryKey);
  if (!same([...from].sort(),old[0]) || new Set(from).size!==from.length || new Set(to).size!==to.length || !to.length) return {ok:false,reason:'mapping omits or duplicates original/successor identities'};
  if (!same(t.executionSettings?.before,observations[0].suite.executionSettings) || !rs.every(r=>same(r.suite.executionSettings,t.executionSettings?.after)&&same(inventory(r.suite),[...to].sort()))) return {ok:false,reason:'successor inventory or execution settings do not match review'};
  const files=[...new Set(mapping.filter(m=>m.from.file===identity.target.file).flatMap(m=>(Array.isArray(m.to)?m.to:[m.to]).map(x=>x.file)))];
  return files.length?{ok:true,files}:{ok:false,reason:'dominant target has no reviewed successor'};
}

export function evaluateTimeEvidence({measure,runs=[],stallsReceipts=[],localWorkarounds,at=Date.now(),comparison,gateBoundMs=null}) {
  const T=typeof at==='number'?at:Date.parse(at);
  if (!TIME_MEASURES.includes(measure)||!Number.isFinite(T)) return unavailable([],['unknown measure or report time']);
  if (comparison) return compareEvidence({measure,runs,stallsReceipts,localWorkarounds,T,comparison});
  if (measure==='worked_around') {
    const w=localWorkarounds;
    if (!w?.available || !Array.isArray(w.observations)) return unavailable([],['local validated invocation receipts unavailable (never collected in CI)']);
    const valid=w.observations.filter(r=>inWindow(r,T-WEEK,T)&&r.validated===true&&r.identity?.kind!=='unknown');
    const groups=new Map(); for(const r of valid) { const k=targetKey(r.identity); groups.set(k,[...(groups.get(k)??[]),r]); }
    const results=[];
    for(const rs0 of groups.values()) { const rs=[...new Map(rs0.map(r=>[r.id,r])).values()]; const target=rs[0].identity;
      const id={kind:'local-workaround',scope:w.scope,invocationIdentity:JSON.stringify(target),target}; if (!id.scope) continue;
      results.push(result(measure,w.observations,rs,id,rs.length,rs.length>=2,baseline(measure,rs,rs.length,T-WEEK,T),threshold(measure,{minimum:2})));
    }
    if (!results.some(r=>r.state==='outside') && (w.coverage?.state!=='observed'||valid.length!==w.observations.length)) return unavailable(w.observations,['partial coverage or unknown identities cannot establish inside']);
    return combine(results,w.observations);
  }
  if (measure==='wall_clock_tests') {
    const eligible=stallsReceipts.filter(r=>validStalls(r)&&r.plain==='pass'&&['pass','fail'].includes(r.stalled)&&inWindow(r,T-28*DAY,T)&&!r.pinned);
    const groups=group(eligible,r=>r.identity), results=[];
    for(const rs of groups.values()) { const outside=rs.filter(r=>r.plain==='pass'&&r.stalled==='fail');
      results.push(result(measure,stallsReceipts,rs,rs[0].identity,outside.length,!!outside.length,baseline(measure,rs,outside.length,T-28*DAY,T),threshold(measure,{minimum:1})));
    }
    return combine(results,stallsReceipts);
  }
  const timing=r=>knownEnd(r)&&!r.filtered&&busyState(r)==='quiet'&&successful(r)&&inWindow(r,T-35*DAY,T);
  const eligible=[...new Map(runs.filter(r=>r.id).map(r=>[r.id,r])).values()].filter(r=>measure==='inconclusive_share'?knownEnd(r)&&!r.filtered&&inWindow(r,T-28*DAY,T):timing(r));
  const entries=[];
  for(const r of eligible) {
    if (measure==='gate_time') {
      if(r.kind!=='gate'||r.gateSource!=='configured-check'||r.provenance?.source!=='outer-launcher'||r.provenance.invocationId!==r.invocationId||r.provenance.outerCommandHash!==r.commandHash||!finite(r.ms)) continue;
      const id=identityOf(r,'configured gate'); if(id)entries.push({r,identity:id,value:r.ms});
    } else if(measure==='critical_file') {
      if(!completeSuite(r))continue;
      for(const file of r.suite.expectedFiles) {const id=identityOf(r,{file});if(id)entries.push({r,identity:id,value:r.suite.observedSummaries.find(s=>s.file===file).durationMs/r.suite.aggregate.durationMs});}
    } else for(const test of r.tests??[]) {
      if(!safeFile(test.file)||typeof test.name!=='string'||test.name.length>1000)continue;
      if((r.tests??[]).filter(t=>t.file===test.file&&t.name===test.name&&(t.describe===true)===(test.describe===true)).length!==1)continue;
      if(measure==='time_creep'&&(test.outcome!=='pass'||!finite(test.ms)))continue;
      if(measure==='inconclusive_share'&&!['pass','fail','inconclusive'].includes(test.outcome))continue;
      const id=identityOf(r,{file:test.file,name:test.name,describe:test.describe===true});if(id)entries.push({r,identity:id,value:test.ms,outcome:test.outcome});
    }
  }
  const results=[];
  for(const es of group(entries,e=>e.identity).values()) {
    const id=es[0].identity, all=es.map(e=>e.r), recent=newest(all.filter(r=>inWindow(r,T-WEEK,T)));
    if(measure==='gate_time') {
      const current=recent.slice(0,3), before=all.filter(r=>inWindow(r,T-35*DAY,T-WEEK));
      if(current.length<3||dates(current).length<2)continue;
      const explicit=Number.isFinite(gateBoundMs)&&gateBoundMs>0;
      if(!explicit && (before.length<12||[0,1,2,3].some(i=>before.filter(r=>inWindow(r,T-(35-i*7)*DAY,T-(28-i*7)*DAY)).length<3)))continue;
      const usual=median(before.map(r=>r.ms)), bound=explicit?gateBoundMs:1.25*usual, value=median(current.map(r=>r.ms));
      results.push(result(measure,runs,current,id,value,value>bound,baseline(measure,explicit?current:before,explicit?value:usual,explicit?T-WEEK:T-35*DAY,explicit?T:T-WEEK),threshold(measure,{boundMs:bound,explicit,current:3,dates:2})));
    } else if(measure==='time_creep') {
      const before=es.filter(e=>inWindow(e.r,T-35*DAY,T-28*DAY)), current=es.filter(e=>inWindow(e.r,T-WEEK,T));
      if(before.length<5||current.length<5||dates(before.map(e=>e.r)).length<3||dates(current.map(e=>e.r)).length<3)continue;
      const base=median(before.map(e=>e.value)), value=median(current.map(e=>e.value));if(!(base>0))continue;
      results.push(result(measure,runs,current.map(e=>e.r),id,value,value/base>1.5&&value-base>200,baseline(measure,before.map(e=>e.r),base,T-35*DAY,T-28*DAY),threshold(measure,{ratio:1.5,increaseMs:200,minimum:5,dates:3})));
    } else if(measure==='critical_file') {
      const rs=newest(eligible.filter(r=>completeSuite(r)&&inWindow(r,T-WEEK,T)&&same(identityOf(r,id.target),id))).slice(0,3);if(rs.length<3||dates(rs).length<2||!rs.every(r=>r.suite.expectedFiles.includes(id.target.file))||!rs.every(r=>same(r.suite.expectedFiles,rs[0].suite.expectedFiles)&&same(r.suite.executionSettings,rs[0].suite.executionSettings)))continue;
      const value=median(rs.map(r=>r.suite.observedSummaries.find(s=>s.file===id.target.file).durationMs/r.suite.aggregate.durationMs));
      results.push(result(measure,runs,rs,id,value,rs.every(r=>dominance(r,id.target.file)),baseline(measure,rs,value,T-WEEK,T),threshold(measure,{share:0.8,ratio:1.5,marginMs:1000,minimum:3,dates:2})));
    } else {
      if(es.length<10||dates(all).length<3)continue;
      const value=es.filter(e=>e.outcome==='inconclusive').length/es.length;
      results.push(result(measure,runs,all,id,value,value>=0.5,baseline(measure,all,value,T-28*DAY,T),threshold(measure,{share:0.5,minimum:10,dates:3})));
    }
  }
  return combine(results,runs);
}
function group(xs,id) {const g=new Map();for(const x of xs){const k=targetKey(id(x));g.set(k,[...(g.get(k)??[]),x]);}return g;}
function combine(results,retained) {
  if(!results.length)return unavailable(retained,['insufficient comparable completed observations, dates or provenance']);
  const sorted=[...results].sort((a,b)=>(b.state==='outside')-(a.state==='outside')||b.value-a.value||targetKey(a.identity).localeCompare(targetKey(b.identity)));
  return {...sorted[0],timeCandidates:results.flatMap(r=>r.timeCandidates)};
}
function validStalls(r) {return r.version===1&&r.complete===true&&r.clean===true&&typeof r.revision==='string'&&/^[a-f0-9]{40}$/.test(r.revision)&&r.verifiedInjected===true&&r.pauses>0&&Number.isInteger(r.seed)&&r.identity?.kind==='stalls'&&r.identity.scope&&r.identity.configHash&&r.identity.flagsHash&&safeFile(r.identity.target?.file)&&typeof r.identity.target?.name==='string';}
function compareEvidence({measure,runs,stallsReceipts,localWorkarounds,T,comparison:c}) {
  const merge=Date.parse(c.mergeTime??c.mergedAt), start=Math.max(T-WEEK,merge);
  const retained=measure==='wall_clock_tests'?stallsReceipts:runs;
  if(!Number.isFinite(merge)||merge>=T||!c.mergeSha||!c.identity||!c.threshold)return unavailable(retained,['verified merge and frozen comparison unavailable']);
  if(c.transition!=null&&measure!=='critical_file')return unavailable(retained,['reviewed transitions apply only to critical_file']);
  // The action layer verifies ancestry before supplying comparison observations.
  const revisionOkay=r=>Array.isArray(c.eligibleRevisionShas)&&c.eligibleRevisionShas.includes(r.commit??r.revision);
  if(measure==='worked_around')return unavailable([],['local workaround postmerge revision provenance unavailable']);
  let rs=[...new Map(retained.filter(r=>inWindow(r,start,T)&&revisionOkay(r)&&r.id).map(r=>[r.id,r])).values()];
  if(measure==='wall_clock_tests')rs=rs.filter(r=>validStalls(r)&&same(r.identity,c.identity)&&r.plain==='pass'&&['pass','fail'].includes(r.stalled));
  else rs=rs.filter(r=>r.dirty===false&&knownEnd(r)&&!r.filtered&&(measure==='inconclusive_share'||busyState(r)==='quiet'&&successful(r))&&same(identityOf(r,(c.transition?.toIdentity??c.identity).target),c.transition?.toIdentity??c.identity));
  const minimum=measure==='time_creep'?5:measure==='inconclusive_share'?10:3, ndays=['time_creep','inconclusive_share'].includes(measure)?3:2;
  if(rs.length<minimum||dates(rs).length<ndays)return unavailable(retained,['insufficient fresh ancestry-verified observations or dates']);
  let value,outside,extra={};
  if(measure==='gate_time') {rs=newest(rs.filter(r=>r.kind==='gate'&&r.gateSource==='configured-check'&&r.provenance?.source==='outer-launcher'&&r.provenance.invocationId===r.invocationId&&r.provenance.outerCommandHash===r.commandHash&&finite(r.ms))).slice(0,3);value=median(rs.map(r=>r.ms));outside=value>c.threshold.parameters.boundMs;}
  else if(measure==='critical_file') {
    rs=newest(rs.filter(completeSuite)).slice(0,3);if(rs.length<minimum||dates(rs).length<ndays)return unavailable(retained,['complete successor file coverage unavailable']);
    const mapping=validateTimeTransition(c,rs);if(!mapping.ok)return unavailable(retained,[mapping.reason]);
    outside=newest(rs).slice(0,3).every(r=>mapping.files.some(f=>dominance(r,f)));
    value=median(rs.map(r=>Math.max(...r.suite.observedSummaries.filter(x=>mapping.files.includes(x.file)).map(x=>x.durationMs/r.suite.aggregate.durationMs))));
    extra={suiteWall:{beforeMs:median(c.baseline.observations.map(r=>r.suite.aggregate.durationMs)),afterMs:median(rs.map(r=>r.suite.aggregate.durationMs)),note:'descriptive only; dominance change does not establish faster execution'}};
  } else if(measure==='wall_clock_tests'){value=rs.filter(r=>r.stalled==='fail').length;outside=value>0;}
  else {
    const tests=rs.flatMap(r=>{ const matches=(r.tests??[]).filter(t=>same({file:t.file,name:t.name,describe:t.describe===true},c.identity.target)); return matches.length===1?matches.map(t=>({r,t})):[]; });
    if(tests.length<minimum)return unavailable(retained,['target missing or insufficient comparable observations']);
    if(measure==='time_creep'){if(tests.some(x=>x.t.outcome!=='pass'||!finite(x.t.ms))||!(c.baseline.value>0))return unavailable(retained,['successful target durations unavailable']);rs=tests.map(x=>x.r);value=median(tests.map(x=>x.t.ms));outside=value/c.baseline.value>c.threshold.parameters.ratio&&value-c.baseline.value>c.threshold.parameters.increaseMs;}
    else {const classified=tests.filter(x=>['pass','fail','inconclusive'].includes(x.t.outcome));if(classified.length<minimum)return unavailable(retained,['classified target coverage unavailable']);rs=classified.map(x=>x.r);value=classified.filter(x=>x.t.outcome==='inconclusive').length/classified.length;outside=value>=c.threshold.parameters.share;}
  }
  if(rs.length<minimum||dates(rs).length<ndays||!finite(value))return unavailable(retained,['matching target observations unavailable']);
  return {...result(measure,retained,rs,c.identity,value,outside,c.baseline,c.threshold),...extra,timeCandidates:[]};
}
