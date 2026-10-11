// Durable health-page proposal identity. No commands or remote content execute here.
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, mkdir, lstat, realpath, open, rename, rm } from 'node:fs/promises';
import { resolve, relative, dirname, join, isAbsolute, sep } from 'node:path';
import { hostname } from 'node:os';
import { healthDirOf } from './lib.mjs';

export const TIME_BEGIN = '<!-- keel:time-proposal:begin -->';
export const TIME_END = '<!-- keel:time-proposal:end -->';
export const TIME_PROPOSAL_MAX_BYTES = 256 * 1024;
const MAX = TIME_PROPOSAL_MAX_BYTES;
const measures = new Set(['gate_time','time_creep','critical_file','inconclusive_share','wall_clock_tests','worked_around']);
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const canonical = x => Array.isArray(x) ? x.map(canonical) : plain(x) ? Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])) : x;
const json = x => JSON.stringify(canonical(x));
const hash = x => createHash('sha256').update(json(x)).digest('hex');
const text = x => typeof x === 'string' && x.trim().length > 0 && x.length <= 10000 && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(x);
const stamp = x => typeof x === 'string' && Number.isFinite(Date.parse(x));
const clone = x => JSON.parse(JSON.stringify(x));
function validate(p) {
  const problems=[];
  if (!plain(p) || p.version!==1 || !measures.has(p.measure) || !stamp(p.createdAt)) return ['invalid timing proposal version, measure or creation time'];
  const i=p.identity;
  const fields=i?.kind==='timing'?['scope','runner','configHash','flagsHash','machineClass','commandHash']:i?.kind==='stalls'?['scope','runner','configHash','flagsHash']:i?.kind==='local-workaround'?['scope','invocationIdentity']:null;
  if (!fields || fields.some(k=>!text(i[k])) || !(text(i.target)||plain(i.target))) problems.push('required typed identity unavailable');
  if ((p.measure==='worked_around' && i?.kind!=='local-workaround') || (p.measure==='wall_clock_tests' && i?.kind!=='stalls') || (!['worked_around','wall_clock_tests'].includes(p.measure) && i?.kind!=='timing')) problems.push('measure identity kind differs');
  if (!plain(p.candidate) || !text(p.candidate.title) || !plain(p.candidate.rubric) || !text(p.candidate.remeasureCommand)) problems.push('concrete candidate, rubric and remeasurement command required');
  const b=p.baseline;
  if (!plain(b) || !stamp(b.windowStart) || !stamp(b.windowEnd) || Date.parse(b.windowStart)>=Date.parse(b.windowEnd) || !Number.isFinite(b.value) || b.value<0 || !text(b.unit) || !Array.isArray(b.runIds) || b.runIds.some(v=>!text(v)) || !Array.isArray(b.revisionShas) || b.revisionShas.some(v=>!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(v))) problems.push('frozen baseline unavailable');
  if (!plain(p.threshold) || p.threshold.contractVersion!==1 || !text(p.threshold.rule) || !plain(p.threshold.parameters)) problems.push('frozen threshold unavailable');
  const c=p.coverage;
  if (!plain(c) || ['retained','eligible','omitted'].some(k=>!Number.isSafeInteger(c[k])||c[k]<0) || !Array.isArray(c.dates) || typeof c.sampled!=='boolean' || !Array.isArray(c.gaps)) problems.push('coverage unavailable');
  const l=p.lifecycle;
  if (!plain(l) || !['proposed','accepting','accepted','declined'].includes(l.state) || !(l.decidedAt===null||stamp(l.decidedAt)) || !(l.reason===null||typeof l.reason==='string') || !['issue','transition','remeasurement'].every(k=>Object.hasOwn(l,k))) problems.push('lifecycle invalid');
  else if (l.issue!==null && (!plain(l.issue)||!Number.isSafeInteger(l.issue.number)||l.issue.number<1||!text(l.issue.repo)||l.issue.url?.toLowerCase()!==`https://github.com/${l.issue.repo.toLowerCase()}/issues/${l.issue.number}`)) problems.push('issue identity invalid');
  if (l?.state==='accepted'&&!l.issue) problems.push('accepted proposal requires verified issue identity');
  if (['accepted','accepting','declined'].includes(l?.state)&&!stamp(l.decidedAt)) problems.push('decision timestamp required');
  if (l?.state==='declined'&&!text(l.reason)) problems.push('decline reason required');
  if (p.subjectKey!==hash({measure:p.measure,identity:i})) problems.push('subject identity mismatch');
  if (p.instanceId!==hash({subjectKey:p.subjectKey,candidate:p.candidate,baseline:p.baseline,threshold:p.threshold,createdAt:p.createdAt})) problems.push('instance or frozen baseline mismatch');
  if (Buffer.byteLength(JSON.stringify(p,null,2))>MAX) problems.push('proposal exceeds size bound');
  return problems;
}
export function makeTimeProposal({measure,identity,candidate,baseline,threshold,coverage,at=new Date()}) {
  const createdAt=new Date(at).toISOString(),subjectKey=hash({measure,identity});
  const p=clone({version:1,instanceId:hash({subjectKey,candidate,baseline,threshold,createdAt}),subjectKey,measure,createdAt,identity,candidate,baseline,threshold,coverage,lifecycle:{state:'proposed',decidedAt:null,reason:null,issue:null,transition:null,remeasurement:null}});
  // A large complete baseline cannot be truncated into a different claim.
  // Producers report n/a when this returns null, without failing other measures.
  if(Buffer.byteLength(JSON.stringify(p,null,2))>MAX)return null;
  const problems=validate(p);if(problems.length)throw new Error(problems.join('; '));return p;
}
export function formatTimeProposal(proposal) {
  const problems=validate(proposal);if(problems.length)throw new Error(problems.join('; '));
  return `${TIME_BEGIN}\n\`\`\`keel-time-proposal\n${JSON.stringify(proposal,null,2)}\n\`\`\`\n${TIME_END}`;
}
function location(source) {
  const starts=[...source.matchAll(/<!-- keel:time-proposal:begin -->/g)],ends=[...source.matchAll(/<!-- keel:time-proposal:end -->/g)],fences=[...source.matchAll(/^```keel-time-proposal[ \t]*\r?$/gm)];
  if(!starts.length&&!ends.length&&!fences.length)return null;
  if(starts.length!==1||ends.length!==1||fences.length!==1||ends[0].index<starts[0].index)throw new Error('timing proposal requires one bounded generated region and fence');
  const start=starts[0].index,end=ends[0].index+TIME_END.length,region=source.slice(start,end);
  const match=/^<!-- keel:time-proposal:begin -->\r?\n```keel-time-proposal[ \t]*\r?\n([\s\S]*?)\r?\n```\r?\n<!-- keel:time-proposal:end -->$/.exec(region);
  if(!match||fences[0].index<start||fences[0].index>=end||match[1].length>MAX)throw new Error('invalid timing proposal region');
  return {start,end,raw:match[1]};
}
export function parseTimeProposal(source) {
  try {const loc=location(String(source));if(!loc)return {proposal:null,problems:[]};const p=JSON.parse(loc.raw),problems=validate(p);return {proposal:problems.length?null:p,problems};}
  catch(e){return {proposal:null,problems:[e.message]};}
}
const reportHash = text => createHash('sha256').update(text).digest('hex');
const reportEnd = '<!-- keel:health-report:end -->';
const proposalSection = /^## Proposal\b[^\n]*\n[\s\S]*?(?=^## |$(?![\s\S]))/m;
function managedReport(source) {
  const starts=[...source.matchAll(/<!-- keel:health-report:begin/g)],ends=[...source.matchAll(/<!-- keel:health-report:end -->/g)];
  if(!starts.length&&!ends.length)return null;
  if(starts.length!==1||ends.length!==1)throw new Error('health report has ambiguous managed regions');
  const start=starts[0].index,end=ends[0].index+reportEnd.length;
  const m=/^<!-- keel:health-report:begin ([a-f0-9]{64}) -->\n([\s\S]*)\n<!-- keel:health-report:end -->$/.exec(source.slice(start,end));
  if(!m||reportHash(m[2])!==m[1])throw new Error('health report managed-region drift; human edits preserved, no report written');
  return {start,end,body:m[2]};
}
// Only hash-verified report bytes are replaceable. The proposal region and all
// surrounding human bytes are separate and survive every refresh unchanged.
export function mergeHealthPage({previous='',generated}) {
  const old=parseTimeProposal(previous),next=parseTimeProposal(generated);
  const problems=[...old.problems,...next.problems];if(problems.length)return {text:previous,problems};
  try {
    const current=managedReport(previous);
    if(generated.includes('<!-- keel:health-report:'))throw new Error('generated report must be unwrapped');
    const outside=current?previous.slice(0,current.start)+previous.slice(current.end):previous;
    const embedded=current?proposalSection.exec(current.body)?.[0]:null;
    if(embedded&&proposalSection.test(outside))throw new Error('health page has ambiguous proposal sections; human bytes preserved');
    const existing=embedded||proposalSection.exec(outside)?.[0]||old.proposal;
    // Decisions apply to their original proposal, including non-time proposals.
    // Never replace that text or leave its decision attached to a new candidate.
    let body=generated.replace(proposalSection,''),proposal='';
    const loc=location(body);if(loc)body=body.slice(0,loc.start)+body.slice(loc.end);
    const offered=proposalSection.exec(generated)?.[0]??(next.proposal?'## Proposal\n\n'+formatTimeProposal(next.proposal):'');
    const emptyOffer=/^## Proposal[^\n]*\n\s*(?:None\b|No new proposal:)/.test(offered);
    if(embedded)proposal='\n\n'+embedded;
    else if(!existing&&offered&&!emptyOffer)proposal='\n\n'+offered;
    if(body.length>1024*1024)throw new Error('generated health report exceeds size bound');
    const report=`<!-- keel:health-report:begin ${reportHash(body)} -->\n${body}\n${reportEnd}`;
    if(current)return {text:previous.slice(0,current.start)+report+proposal+previous.slice(current.end),problems:[]};
    // A legacy page has no trustworthy managed boundary: keep its bytes once,
    // visibly as history, and create exactly one replaceable current report.
    const prefix=previous?'## Preserved legacy health page (historical)\n\n'+previous+'\n\n## Current health report\n\n':'';
    return {text:prefix+report+proposal,problems:[]};
  }catch(e){return {text:previous,problems:[e.message]};}
}
async function safePath(root,path,{create=false}={}) {
  const abs=resolve(root,path),rel=relative(resolve(root),abs);
  if(!rel||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))throw new Error('health path must be inside project');
  const base=await realpath(root);
  const config=await readFile(join(root,'.keel/keel.json'),'utf8').then(JSON.parse,e=>{if(e.code==='ENOENT')return {};throw e;});
  const configured=resolve(root,healthDirOf(config));
  // Only the configured directory may be an alias. Resolve its deepest existing
  // ancestor before creating anything, and use one canonical directory/lock.
  let ancestor=configured,directory;const missing=[];
  for(;;){
    try{directory=join(await realpath(ancestor),...missing);break;}
    catch(e){
      if(e.code!=='ENOENT')throw e;
      const st=await lstat(ancestor).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
      if(st)throw new Error('unsafe health path: unresolved configured directory');
      missing.unshift(relative(dirname(ancestor),ancestor));ancestor=dirname(ancestor);
    }
  }
  const within=relative(base,directory);
  if(within==='..'||within.startsWith('..'+sep)||isAbsolute(within))throw new Error('unsafe health path: configured directory resolves outside project');
  if(dirname(abs)!==configured&&dirname(resolve(base,rel))!==directory)throw new Error('unsafe health path: outside configured health directory');
  if(create)await mkdir(directory,{recursive:true});
  if(!(await lstat(directory)).isDirectory())throw new Error('unsafe health path');
  const file=join(directory,relative(dirname(abs),abs));
  const st=await lstat(file).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  if(st&&!st.isFile())throw new Error('unsafe health path');
  return file;
}
async function atomic(file,value) {
  const temp=file+'.'+randomUUID()+'.tmp';let handle;
  try{handle=await open(temp,'wx',0o600);await handle.writeFile(value);await handle.sync();await handle.close();handle=null;await rename(temp,file);if(process.platform!=='win32'){const dir=await open(dirname(file),'r');try{await dir.sync();}finally{await dir.close();}}}
  finally{await handle?.close();await rm(temp,{force:true});}
}
async function lockOwner(lock) {
  try {const path=join(lock,'owner.json');if(!(await lstat(path)).isFile())return null;const o=JSON.parse(await readFile(path,'utf8'));return o.host===hostname()&&Number.isSafeInteger(o.pid)&&o.pid>0&&typeof o.token==='string'?o:null;}catch{return null;}
}
function ownerDead(owner) {
  if(!owner||owner.pid===process.pid)return false;
  try{process.kill(owner.pid,0);return false;}catch(e){return e.code==='ESRCH';}
}
async function reap(lock) {
  const owner=await lockOwner(lock);if(!ownerDead(owner))return;
  const reaper=join(lock,'reaper');try{await mkdir(reaper);}catch{return;}
  let moved=false;
  try{const current=await lockOwner(lock);if(current?.token!==owner.token||!ownerDead(current))return;const orphan=lock+'.orphan-'+randomUUID();await rename(lock,orphan);moved=true;await rm(orphan,{recursive:true,force:true});}
  finally{if(!moved)await rm(reaper,{recursive:true,force:true});}
}
async function locked(root,path,fn) {
  const file=await safePath(root,path,{create:true}),lock=join(dirname(file),'.keel-time-proposals.lock');
  let acquired=false;
  for(let attempt=0;attempt<100;attempt++){
    try{await mkdir(lock);acquired=true;break;}catch(e){if(e.code!=='EEXIST')throw e;}
    try{if(!(await lstat(lock)).isDirectory())throw new Error('unsafe health lock');await reap(lock);}catch(e){if(e.code!=='ENOENT')throw e;}
    // Never steal an active or unidentifiable lock, regardless of its age.
    await new Promise(r=>setTimeout(r,20));
  }
  if(!acquired)throw new Error('health proposal writer busy; retry after the current writer completes');
  try{await atomic(join(lock,'owner.json'),JSON.stringify({pid:process.pid,host:hostname(),token:randomUUID()}));return await fn(file);}
  finally{await rm(lock,{recursive:true,force:true});}
}
export async function withTimeProposal({root,path,expectedInstance},callback) {
  if(typeof expectedInstance!=='string'||!/^[a-f0-9]{64}$/.test(expectedInstance))throw new Error('time proposal requires --instance from the current page');
  return locked(root,path,async file=>{
    let source=await readFile(file,'utf8');const parsed=parseTimeProposal(source);
    if(parsed.problems.length||!parsed.proposal)throw new Error(parsed.problems.join('; ')||'time proposal unavailable');
    let proposal=parsed.proposal;if(proposal.instanceId!==expectedInstance)throw new Error('stale proposal instance; refresh the page');
    const saveLifecycle=async lifecycle=>{
      const next={...proposal,lifecycle:clone(lifecycle)},problems=validate(next);if(problems.length)throw new Error(problems.join('; '));
      // Guard also against editors which do not participate in the shared lock.
      if(await readFile(file,'utf8')!==source)throw new Error('health page changed outside the proposal lock');
      const loc=location(source);source=source.slice(0,loc.start)+formatTimeProposal(next)+source.slice(loc.end);
      if(await safePath(root,path)!==file)throw new Error('health directory changed during proposal write');
      await atomic(file,source);proposal=next;return clone(next);
    };
    return callback({proposal:clone(proposal),saveLifecycle});
  });
}
export async function writeHealthReport({root,path,generated}) {
  return locked(root,path,async file=>{
    const previous=await readFile(file,'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
    const result=mergeHealthPage({previous,generated});if(result.problems.length)throw new Error(result.problems.join('; '));
    if(await safePath(root,path)!==file)throw new Error('health directory changed during report write');
    await atomic(file,result.text);return result;
  });
}
export async function readTimeProposals({root,healthDir='docs/health'}) {
  const proposals=[],gaps=[];let names;
  try{const directory=dirname(await safePath(root,join(healthDir,'.probe')));names=(await readdir(directory)).filter(n=>/^\d{4}-\d{2}-\d{2}\.md$/.test(n)).sort();}
  catch(e){if(e.code==='ENOENT')return {proposals,gaps};return {proposals,gaps:[e.message]};}
  for(const name of names){const path=join(healthDir,name);try{const source=await readFile(await safePath(root,path),'utf8');if(source.length>4*1024*1024)throw new Error('health page exceeds read bound');const parsed=parseTimeProposal(source);gaps.push(...parsed.problems.map(p=>`${path}: ${p}`));if(parsed.proposal)proposals.push({...parsed.proposal,path});}catch(e){gaps.push(`${path}: ${e.message}`);}}
  return {proposals,gaps};
}
export function selectableTimeProposal({candidate,history,at=new Date()}) {
  const key=candidate.subjectKey??hash({measure:candidate.measure,identity:candidate.identity});
  for(const p of Array.isArray(history)?history:history?.proposals??[])if(p.subjectKey===key){
    if(['accepting','accepted','proposed'].includes(p.lifecycle?.state))return {allowed:false,reason:'an existing proposal owns this subject'};
    if(p.lifecycle?.state==='declined'&&stamp(p.lifecycle.decidedAt)&&Date.parse(p.lifecycle.decidedAt)<=new Date(at).getTime()&&new Date(at)-Date.parse(p.lifecycle.decidedAt)<28*86400000)return {allowed:false,reason:'declined within 28 days'};
  }return {allowed:true,reason:null};
}
