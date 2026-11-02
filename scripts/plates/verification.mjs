import { environmentValue, nightBranches, NAMES } from './names.mjs';
// Revision-bound observations, embedded in the existing health report. No gate execution.
import { execFile, spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { frontMatter } from './lib.mjs';

export const VERIFICATION_MARK = '<!-- plates:verification:v1 ';
export const VERIFICATION_MAX = 128 * 1024;
const SHA = /^[a-f0-9]{40}$/;
const REPO = /^[\w.-]+\/[\w.-]+$/;
const stamp = s => typeof s === 'string' && /^\d{4}-\d\d-\d\dT/.test(s) && Number.isFinite(Date.parse(s));
const short = s => typeof s === 'string' && s.length > 0 && s.length <= 500 && !/[\x00-\x1f<>]/.test(s);
const list = x => Array.isArray(x) && x.length <= 500;
const clean = s => String(s ?? '').replace(/[\x00-\x1f<>]/g, ' ').slice(0, 500);
const exec = (bin, args, options) => new Promise((resolve, reject) => execFile(bin, args, { ...options, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 }, (e, out) => e ? reject(new Error('bounded source read failed')) : resolve(out)));
export async function verificationGit({root, env = process.env}) {
  try {
    const run = args => exec(environmentValue('variable:KEEL_GIT', env) ?? 'git', args, {cwd:root,env});
    const [sha, status] = await Promise.all([run(['rev-parse','HEAD']), run(['status','--porcelain','--untracked-files=normal'])]);
    if (!SHA.test(sha.trim())) throw new Error();
    return {sha:sha.trim(),dirty:status.trim().length > 0};
  } catch { return {sha:null,dirty:null}; }
}

/** Full bounded pages remain gaps: absence from a truncated read is never health. */
export async function observeVerification({root, config, env = process.env, now = new Date().toISOString(), read, git = verificationGit}) {
  const gaps = [], repo = REPO.test(config.repo ?? '') ? config.repo : null;
  const source = await git({root,env});
  if (!source.sha) gaps.push('checked revision unavailable');
  const get = read ?? (async endpoint => JSON.parse(await exec((environmentValue('variable:KEEL_GH', env) ?? 'gh'), ['api',endpoint], {cwd:root,env})));
  const fetch = async (name, endpoint) => { try { return await get(endpoint); } catch { gaps.push(`${name} unavailable`); return null; } };
  let remote = null, claims = [];
  if (!repo) gaps.push('repository identity unavailable');
  else {
    const meta = await fetch('repository', `repos/${repo}`);
    if (typeof meta?.full_name !== 'string' || meta.full_name.toLowerCase() !== repo.toLowerCase() || !short(meta?.default_branch)) gaps.push('repository identity or default branch unavailable');
    else {
      const head = await fetch('default revision', `repos/${repo}/commits/${encodeURIComponent(meta.default_branch)}`);
      if (SHA.test(head?.sha ?? '')) remote = {branch:meta.default_branch,sha:head.sha};
      else gaps.push('default revision unavailable');
    }
    const [refs, prs] = await Promise.all([
      fetch('claims', `repos/${repo}/git/matching-refs/heads/claims/phase-?per_page=100`),
      fetch('open PRs', `repos/${repo}/pulls?state=open&per_page=100`),
    ]);
    if (!Array.isArray(refs) || refs.length >= 100 || refs.some(r=>!/^refs\/heads\/claims\/phase-\d+$/.test(r?.ref ?? '') || !SHA.test(r?.object?.sha ?? ''))) gaps.push('claims incomplete or capped');
    if (!Array.isArray(prs) || prs.length >= 100 || prs.some(p=>p?.state!=='open' || !Number.isSafeInteger(p.number) || !short(p.head?.ref))) gaps.push('open PRs incomplete or capped');
    const explicit = (Array.isArray(refs) ? refs : []).slice(0,100).filter(r => /^refs\/heads\/claims\/phase-\d+$/.test(r?.ref ?? ''));
    const owners = new Map();
    for (const ref of explicit) {
      const phase = Number(ref.ref.match(/\d+$/)[0]);
      if (!Number.isSafeInteger(phase)) { gaps.push('invalid phase identity'); continue; }
      if (owners.has(phase)) gaps.push(`phase ${phase} duplicate explicit refs`);
      owners.set(phase,{ref,prs:[]});
    }
    for (const pr of (Array.isArray(prs) ? prs : []).slice(0,100)) {
      const phase = Number(/(?:^|[/_-])phase-0*(\d+)(?!\d)/i.exec(pr?.head?.ref ?? '')?.[1]);
      if (!Number.isSafeInteger(phase) || pr?.state !== 'open' || !Number.isSafeInteger(pr.number)) continue;
      if (!owners.has(phase)) owners.set(phase,{ref:null,prs:[]});
      owners.get(phase).prs.push(pr);
    }
    if (owners.size > 50) gaps.push('claim detail limit reached');
    let phases = null;
    if (config.phases?.source === 'milestones' && owners.size) gaps.push('milestone phase acceptance unavailable');
    if (owners.size && remote && config.phases?.source !== 'milestones') phases = await fetch('phase listing', `repos/${repo}/contents/docs/phases?ref=${remote.sha}`);
    if (owners.size && (!Array.isArray(phases) || phases.length >= 1000)) gaps.push('phase status coverage unavailable or capped');
    for (const [phase,owner] of [...owners].slice(0,50)) {
      const row = {phase, branch:owner.ref ? owner.ref.ref.slice(11) : clean(owner.prs[0].head.ref), status:null, owes:null, lastObservedAt:null, activity:'unknown', findings:[], prs:owner.prs.map(p=>p.number)};
      if (owner.ref) {
        const sha=owner.ref.object?.sha;
        const commit = SHA.test(sha ?? '') ? await fetch('claim commit', `repos/${repo}/commits/${sha}`) : null;
        if (stamp(commit?.commit?.committer?.date) && Date.parse(commit.commit.committer.date)<=Date.parse(now)) row.lastObservedAt = commit.commit.committer.date;
        else gaps.push(`phase ${phase} last observation unavailable`);
      }
      const names = Array.isArray(phases) ? phases.filter(p => new RegExp(`^0*${phase}-.*\\.md$`).test(p?.name ?? '')) : [];
      if (names.length === 1 && remote) {
        const file = await fetch('phase record', `repos/${repo}/contents/docs/phases/${encodeURIComponent(names[0].name)}?ref=${remote.sha}`);
        if (file?.encoding === 'base64' && typeof file.content === 'string' && file.content.length <= 128000) {
          const meta=frontMatter(Buffer.from(file.content,'base64').toString('utf8'));
          row.status=meta?.get('status') ?? null;
          row.owes=meta?.get('owes') || null;
        }
      }
      if (!['planned','designed','partial','built','lived-in','superseded'].includes(row.status)) {row.status=null;gaps.push(`phase ${phase} status unavailable`);}
      if (row.owes!==null && !short(row.owes)) {row.owes=null;gaps.push(`phase ${phase} owes unavailable`);}
      const ended=['built','lived-in','superseded'].includes(row.status) || (row.status==='partial' && row.owes==='walk');
      if (ended) row.findings.push(owner.ref ? 'completed-phase-leftover' : 'completed-phase-open-pr');
      if (owner.ref && row.prs.length) row.findings.push('explicit-and-open-pr-ownership');
      if (!owner.ref) row.findings.push('open-pr-ownership');
      if (row.prs.length>1) row.findings.push('duplicate-open-pr-ownership');
      if (row.lastObservedAt && Date.parse(now)-Date.parse(row.lastObservedAt) >= 7*86400000) row.findings.push('old-claim-observation');
      claims.push(row);
    }
  }
  return {repo,observedAt:now,source,remote,claims,gaps:[...new Set(gaps)],localCoverage:'unavailable'};
}

/** Only selected bounded facts leave the instruments; never raw output or claim tokens. */
export function verificationReceipt(observation, results, after = observation.source) {
  const result = id => results.find(r=>r.id===id);
  const g = result('gate'), r = result('record_contradictions');
  const gaps = [...observation.gaps];
  if (after.sha !== observation.source.sha || after.dirty !== observation.source.dirty) gaps.push('checkout changed during measurement');
  if (!g || !['ok','outside'].includes(g.state)) gaps.push('gate outcome unavailable');
  if (!r || !['ok','outside'].includes(r.state) || !r.facts) gaps.push('reconciliation coverage unavailable');
  const findings = (r?.facts?.findings ?? []).slice(0,100).map(x=>({rule:clean(x.rule),path:clean(x.path)}));
  if ((r?.facts?.findings?.length ?? 0)>100 || (r?.facts?.unknown?.length ?? 0)>100) gaps.push('reconciliation detail limit reached');
  const unknown = (r?.facts?.unknown ?? []).slice(0,100).map(x=>clean(x.message ?? x.rule ?? 'unknown reconciliation source'));
  if (unknown.length) gaps.push('reconciliation sources unavailable');
  return {schema:1,attempt:randomUUID(),...observation,gaps:[...new Set(gaps)],
    gate:{state:g?.state ?? 'unavailable',source:g?.facts?.reused ? 'reused-ci' : g?.facts?.source === 'local-command' ? 'local-command' : 'unavailable',
      status:Number.isInteger(g?.facts?.status)?g.facts.status:null,sha:g?.facts?.reused ? g.facts.sha ?? null : observation.source.sha,
      workflow:g?.facts?.reused ? clean(g.facts.workflow) : null,completedAt:g?.facts?.reused ? g.facts.completedAt ?? null : null},
    reconciliation:{state:r?.state ?? 'unavailable',findings,unknown},
  };
}

export function formatVerification(receipt) {
  const json = JSON.stringify(receipt).replaceAll('<','\\u003c').replaceAll('>','\\u003e');
  if (Buffer.byteLength(json) > VERIFICATION_MAX) throw new Error('verification receipt exceeds bound');
  return `${VERIFICATION_MARK}${json} -->`;
}
export function parseVerifications(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text)>4*1024*1024) throw new Error('verification report exceeds bound');
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('<!-- plates:verification:')) continue;
    if (!line.startsWith(VERIFICATION_MARK) || !line.endsWith(' -->') || Buffer.byteLength(line)>VERIFICATION_MAX+100) throw new Error('malformed verification marker');
    rows.push(JSON.parse(line.slice(VERIFICATION_MARK.length,-4)));
    if(rows.length>100) throw new Error('verification attempt limit reached');
  }
  return rows;
}
export function retainVerifications(previous, generated) {
  const old = parseVerifications(previous), next = parseVerifications(generated);
  const ids = new Set(next.map(r=>r.attempt));
  const retained = old.filter(r=>!ids.has(r.attempt));
  if(old.length+next.length>100) throw new Error('verification history full; preserve prior attempts');
  return retained.length ? generated+'\n'+retained.map(formatVerification).join('\n')+'\n' : generated;
}

export function verificationSummary(receipt) {
  return `Verification: ${receipt.source.sha ?? 'unknown revision'} (${receipt.source.dirty === false ? 'clean' : receipt.source.dirty === true ? 'dirty' : 'dirty state unavailable'}); gate ${receipt.gate.state} (${receipt.gate.source}); reconciliation ${receipt.reconciliation.state}. ${receipt.gaps.join('; ') || 'No remote coverage gaps observed'}. Local worktrees and session activity unavailable; this is not production acceptance.\n`+
    receipt.claims.map(c=>`- Phase ${c.phase}: ${c.findings.join(', ') || 'explicit claim'}; open PRs ${c.prs.join(', ') || 'none observed'}; activity unknown. Inspect https://github.com/${receipt.repo}/tree/${encodeURIComponent(c.branch)} before any owner action.`).join('\n');
}

/** Untrusted receipt validation; exact current source is required, even for report commits. */
export function assessVerification(text, {repo,branch,sha,now=new Date().toISOString(),maxAgeMs=2*86400000}) {
  const out = (state,reason,receipt=null) => ({state,reason,receipt,healthy:false});
  if (!REPO.test(repo ?? '') || !short(branch) || !SHA.test(sha ?? '') || !stamp(now)) return out('unavailable','current repository identity or revision unavailable');
  if(text===null) return out('missing','verification not yet adopted or no report');
  let rows;
  try { rows=parseVerifications(text); } catch { return out('malformed','invalid bounded verification record'); }
  if(!rows.length) return out('missing','verification not yet adopted');
  const valid = r => r?.schema===1 && short(r.attempt) && REPO.test(r.repo ?? '') && stamp(r.observedAt)
    && r.source && (r.source.sha===null || SHA.test(r.source.sha ?? '')) && [null,true,false].includes(r.source.dirty)
    && (r.remote===null || (short(r.remote?.branch) && SHA.test(r.remote?.sha ?? '')))
    && list(r.gaps) && r.gaps.every(short) && r.localCoverage==='unavailable'
    && list(r.claims) && r.claims.every(c=>Number.isSafeInteger(c.phase) && short(c.branch) && c.activity==='unknown' && (c.status===null || ['planned','designed','partial','built','lived-in','superseded'].includes(c.status)) && (c.owes===undefined || c.owes===null || short(c.owes)) && (c.lastObservedAt===null || (stamp(c.lastObservedAt) && Date.parse(c.lastObservedAt)<=Date.parse(r.observedAt))) && list(c.findings) && c.findings.every(short) && list(c.prs) && c.prs.every(Number.isSafeInteger))
    && ['ok','outside','broken','n/a','unavailable'].includes(r.gate?.state) && ['local-command','reused-ci','unavailable'].includes(r.gate?.source)
    && (r.gate.status===null || Number.isInteger(r.gate.status)) && (r.gate.sha===null || SHA.test(r.gate.sha ?? ''))
    && (r.gate.source!=='reused-ci' || (short(r.gate.workflow) && stamp(r.gate.completedAt) && Date.parse(r.gate.completedAt)<=Date.parse(r.observedAt)))
    && ['ok','outside','broken','n/a','unavailable'].includes(r.reconciliation?.state) && list(r.reconciliation.findings) && r.reconciliation.findings.every(f=>short(f.rule)&&short(f.path)) && list(r.reconciliation.unknown) && r.reconciliation.unknown.every(short);
  if(rows.some(r=>!valid(r)) || new Set(rows.map(r=>r.attempt)).size!==rows.length) return out('malformed','invalid verification schema');
  const r=rows.sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))[0];
  if(rows.some(x=>x.repo.toLowerCase()!==repo.toLowerCase()))return out('malformed','foreign repository receipt');
  if(rows.some(x=>Date.parse(x.observedAt)>Date.parse(now)))return out('malformed','future observation');
  if(Date.parse(now)-Date.parse(r.observedAt)>maxAgeMs)return out('stale','latest observation is older than two days',r);
  if(!r.remote || !r.source.sha)return out('unavailable','source or remote observation unavailable',r);
  if(r.remote.branch!==branch || r.remote.sha!==sha || r.source.sha!==sha || r.gate.sha!==sha)return out('behind','checked source differs from current default branch',r);
  const healthy=r.source.dirty===false && r.gate.state==='ok' && r.gate.status===0 && r.gate.source!=='unavailable' && r.reconciliation.state==='ok' && !r.reconciliation.findings.length && !r.reconciliation.unknown.length && !r.gaps.length && !r.claims.some(c=>c.findings.some(f=>f!=='open-pr-ownership'));
  return {state:'current',healthy,reason:healthy?'current configured checks; local session activity remains unknown':'current observation has failures, findings or coverage gaps',receipt:r};
}

/** Morning displays retained observations, never claims a fresh remote read. */
export function retainedVerificationSummary(text) {
  try {
    const rows = parseVerifications(text);
    if (!rows.length) return null;
    const r = rows.sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))[0];
    const checked = assessVerification(text,{repo:r.repo,branch:r.remote?.branch,sha:r.remote?.sha});
    if (!checked.receipt) return `Retained verification ${checked.state}: ${checked.reason}. Refresh the project night; current remote coverage was not read here.`;
    return `Retained observation from ${r.observedAt}; current remote coverage was not read here. `+verificationSummary(r);
  } catch { return 'Retained verification malformed; refresh the project night. Current coverage is unknown.'; }
}

/** Workflow retry recovery: read the exact prior report, then publish only with its SHA lease. */
export async function recoverNightVerification({root,config,date,env=process.env}) {
  const repo=config.repo ?? env.GITHUB_REPOSITORY;
  if (!REPO.test(repo ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('night recovery requires repository identity and date');
  const git=args=>exec(environmentValue('variable:KEEL_GIT', env) ?? 'git',args,{cwd:root,env:{...env,GIT_TERMINAL_PROMPT:'0'}});
  const {branch,head}=await resolveNightBranch({root,date,env});
  if (!head) return {branch,head:'',attempts:0,report:null};
  await git(['fetch','--no-tags','--depth=1','origin',head]);
  const {healthDirOf}=await import('./lib.mjs');
  const path=`${healthDirOf(config)}/${date}.md`;
  const report=await git(['show',`${head}:${path}`]);
  const receipts=parseVerifications(report);
  if (receipts.length && assessVerification(report,{repo,branch:'recovery',sha:head}).state==='malformed') throw new Error('prior night verification malformed; preserve original branch');
  return {branch,head,attempts:receipts.length,report};
}

/** Original namespace, including a retained final PR when morning resumes.
 * Read refs only: this does not require a health page or fetch project content. */
export async function resolveNightBranch({root,date,env=process.env,includeFinal=false}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('night origin requires a date');
  const branches=nightBranches(date), found=[];
  for (const branch of branches) {
    let head='', present=false;
    for (const name of [branch,...(includeFinal?[`${branch}-final`]:[])]) {
      const ref=`refs/heads/${name}`;
      const lines=(await exec(environmentValue('variable:KEEL_GIT', env) ?? 'git',['ls-remote','--refs','origin',ref],{cwd:root,env:{...env,GIT_TERMINAL_PROMPT:'0'}})).trim().split('\n').filter(Boolean);
      if (!lines.length) continue;
      if (lines.length!==1) throw new Error('night recovery ref read is ambiguous');
      const [sha,readRef]=lines[0].split('\t');
      if (!SHA.test(sha ?? '') || readRef!==ref) throw new Error('night recovery ref read is malformed');
      present=true; if (name===branch) head=sha;
    }
    if (present) found.push({branch,head});
  }
  if (found.length>1) throw new Error('night recovery has two origin branches; preserve both and resolve ownership');
  return found[0] ?? {branch:branches[0],head:''};
}


// Optional rollout evidence: these values describe this invocation only. They
// never grant write authority or turn a local write into a published Git object.
export const namesDigest = text => createHash('sha256').update(text).digest('hex');
export function namesEvidenceContext(value, env = process.env) {
  if (!value) return false;
  const repositoryId = value === true ? Number(env.PLATES_NAMES_EVIDENCE_REPOSITORY_ID) : value.repositoryId;
  if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0) throw new Error('names evidence requires a positive repository ID');
  return { repositoryId };
}
export function namesObservation(producerId, context) {
  return context ? { producerId, reads: [], writes: [], fragments: [], gaps: [] } : null;
}
export function namesGap(observation, code) {
  if (observation && !observation.gaps.some(g => g.code === code)) observation.gaps.push({ code, producerId: observation.producerId, source: null });
}
export function namesFragment(observation, id, text, kind = 'projection') {
  const path = `fragments/${observation.producerId}-${id}.txt`;
  if (Buffer.byteLength(text) > 256 * 1024 || observation.fragments.length >= 128) { namesGap(observation, 'fragment-limit'); return null; }
  const old = observation.fragments.find(f => f.path === path);
  if (old && old.text !== text) throw new Error('names evidence fragment identity conflict');
  if (!old) observation.fragments.push({ path, kind, text });
  return { fragment: path, sha256: namesDigest(text) };
}
/** Retain only exact table-owned tokens from generated bytes, never prose. */
export function namesGeneratedFragment(observation, id, generated) {
  const text=Array.isArray(generated)?generated.join('\n'):generated;
  const names=[];
  for(const row of NAMES.filter(r=>['marker','fence','label'].includes(r.surface))) {
    for(const value of [row.plates,row.keel]) if(text.includes(value)) names.push({rowId:row.id,value});
  }
  const fragment=namesFragment(observation,id,[...new Set(names.map(n=>n.value))].join('\n'),'managed-fragment');
  return fragment?{...fragment,names}:null;
}
export const namesPlanProjection = plan => plan ? {date:plan.date,items:plan.items.map(({id,kind,status})=>({id,kind,status}))} : null;
export function namesSnapshot(text, {commitSha=null,blobSha=null,labelIds=[],providerUpdatedAt=null}={}) {
  return {state:text===null?'absent':'present',commitSha,blobSha,sha256:text===null?null:namesDigest(text),labelIds,providerUpdatedAt};
}
export function namesGit(root, args) {
  return spawnSync('git', ['--no-optional-locks','-c','core.fsmonitor=false',...args], {cwd:root,encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
}
/** Pin only the bytes actually consumed. A different checkout blob is a gap. */
export function namesLocalSource(root, path, text, { commitSha = 'HEAD' } = {}) {
  const source={ref:'HEAD',path,commitSha:null,blobSha:null,sha256:null,state:'unavailable',absence:null};
  if(commitSha !== 'HEAD' && !SHA.test(commitSha)) return source;
  const head=namesGit(root,['rev-parse','--verify',`${commitSha}^{commit}`]);
  if(head.status!==0 || !SHA.test(head.stdout.trim())) return source;
  source.commitSha=head.stdout.trim();
  const tree=namesGit(root,['ls-tree','-z',source.commitSha,'--',path]);
  if(tree.status!==0) return source;
  if(!tree.stdout) return text===null ? {...source,state:'absent',absence:'path'} : source;
  const match=/^100(?:644|755) blob ([a-f0-9]{40})	/.exec(tree.stdout);
  if(!match || text===null) return source;
  const blob=namesGit(root,['cat-file','blob',match[1]]);
  if(blob.status!==0 || blob.stdout!==text) return source;
  return {...source,state:'read',blobSha:match[1],sha256:namesDigest(text)};
}
export function namesRead(observation, context, source, {consumer,sourceKind,selected=false,contributed=false,outputSection,projection,recordIds=[]}) {
  if(!observation || !projection) return;
  if(observation.reads.length>=64) {namesGap(observation,'read-limit');return;}
  if(source.state==='unavailable') namesGap(observation,'read-unavailable');
  observation.reads.push({consumer,sourceKind,repositoryId:context.repositoryId,...source,selected:source.state==='read'&&selected,contributed:source.state==='read'&&contributed,outputSection,outputProjection:projection,recordIds:source.state==='read'?recordIds:[]});
}
/** Capture before mutation; unknown bytes are never attributed to execution HEAD. */
export function namesPreimage(root, path, text, options = {}) {
  const source = namesLocalSource(root, path, text, options);
  if (!['read', 'absent'].includes(source.state)) return null;
  return namesSnapshot(text, {commitSha:source.commitSha,blobSha:source.blobSha});
}
export function namesLocalWrite(observation, context, {root,path,role,targetRef,before,beforeSnapshot,intended,after,fragmentText,id,names=[]}) {
  if(!observation) return;
  const fragment=namesGeneratedFragment(observation,id,fragmentText);
  if(!fragment) return;
  const branch=namesGit(root,['symbolic-ref','--quiet','HEAD']);
  if(!targetRef && branch.status!==0) namesGap(observation,'local-write-ref-unavailable');
  // Working plans are ignored local bytes paired to the published night record;
  // they do not claim an independently retrievable before/after Git object.
  const preimage=role==='working-plan'?null:beforeSnapshot??null;
  if(role!=='working-plan' && !preimage) namesGap(observation,`preimage-unavailable-${role}`);
  const actual=after===intended && after!==null ? (role==='working-plan'?namesSnapshot(after):namesPreimage(root,path,after)??namesSnapshot(after)) : null;
  const unchanged=before===after && preimage && actual && preimage.sha256===actual.sha256;
  observation.writes.push({producerId:observation.producerId,role,sequence:observation.writes.length+1,operationId:null,target:{kind:'git',repositoryId:context.repositoryId,ref:targetRef??(branch.status===0?branch.stdout.trim():'HEAD'),path},outcome:after===intended?(unchanged?'no-change':'confirmed'):'attempted-unknown',before:preimage,intended:{...fragment,sha256:namesDigest(intended)},after:unchanged?preimage:actual,observedAt:new Date().toISOString()});
  if(after!==intended) namesGap(observation,'write-readback-mismatch');
}

