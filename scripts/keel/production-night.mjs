import { isMain } from './lib.mjs';
import { providerEnv } from './production-collectors.mjs';
// Immutable per-attempt artifacts. Missing newest evidence never falls back to older state.
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { atomicJson, boundedJson, safePath, validateState, digest, fail, readState, transaction } from './production-store.mjs';
import { collect, productionConfig } from './production.mjs';
const WORKFLOW='.github/workflows/keel-night.yml';
export function selectPrevious(runs,env) {
  if(!Array.isArray(runs)) fail('production run history unavailable');
  for (const r of runs) {
    if (!Number.isSafeInteger(r?.id) || !Number.isSafeInteger(r.run_attempt) || !/^[a-f0-9]{40}$/.test(r.head_sha ?? '') || !r.head_repository?.full_name || !r.repository?.full_name || typeof r.head_branch !== 'string' || typeof r.path !== 'string' || typeof r.event !== 'string' || !Array.isArray(r.pull_requests) || !Number.isFinite(Date.parse(r.run_started_at))) fail('production run provenance unavailable');
  }
  return runs.filter(r=>String(r.id)!==env.GITHUB_RUN_ID && r.head_repository?.full_name===env.GITHUB_REPOSITORY && r.repository?.full_name===env.GITHUB_REPOSITORY && r.head_branch===env.BASE && r.path===WORKFLOW && ['schedule','workflow_dispatch'].includes(r.event) && Array.isArray(r.pull_requests) && !r.pull_requests.length)
    .sort((a,b)=>Date.parse(b.run_started_at)-Date.parse(a.run_started_at));
}
export function validateEnvelope(envelope,run,repo) {
  const p=envelope?.provenance;
  if(envelope?.version!==1 || p?.repo!==repo || p.workflow!==WORKFLOW || p.runId!==String(run.id) || p.attempt!==run.run_attempt || p.headSha!==run.head_sha) fail('production recovery provenance mismatch');
  if(envelope.state!=='retained' || !envelope.snapshot || envelope.digest!==digest(envelope.snapshot)) fail('latest production attempt has unavailable state; owner recovery required');
  return validateState(envelope.snapshot);
}
export async function recoverNight({root,config,env=process.env,api,download,readOnly=false}) {
  const settings = productionConfig(config);
  if(!settings.enabled) return {state:'off'};
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(env.GITHUB_REPOSITORY??'') || env.GITHUB_REF_NAME!==env.BASE || !(readOnly ? ['schedule','workflow_dispatch','workflow_run'] : ['schedule','workflow_dispatch']).includes(env.GITHUB_EVENT_NAME)) fail('production retention requires the default-branch night');
  const repo=env.GITHUB_REPOSITORY;
  const response=await api(`repos/${repo}/actions/workflows/keel-night.yml/runs?branch=${encodeURIComponent(env.BASE)}&per_page=100`);
  const runs=selectPrevious(response.workflow_runs,env);
  if(!readOnly && Number(env.GITHUB_RUN_ATTEMPT)>1) runs.push(await api(`repos/${repo}/actions/runs/${env.GITHUB_RUN_ID}/attempts/${Number(env.GITHUB_RUN_ATTEMPT)-1}`));
  runs.sort((a,b)=>Date.parse(b.run_started_at)-Date.parse(a.run_started_at));
  for(const run of runs) {
    if (settings.since && Date.parse(run.run_started_at) < Date.parse(settings.since)) return {state:'bootstrap',since:settings.since,gap:'explicit start boundary; earlier coverage unavailable'};
    if(!Number.isSafeInteger(run.id)||!Number.isSafeInteger(run.run_attempt)||!/^[a-f0-9]{40}$/.test(run.head_sha??'')) fail('production run identity unavailable');
    const contents=await api(`repos/${repo}/contents/.keel/keel.json?ref=${run.head_sha}`);
    if(contents.encoding!=='base64'||typeof contents.content!=='string'||contents.content.length>1500000) fail('production previous configuration unavailable');
    let previous; try { previous=JSON.parse(Buffer.from(contents.content,'base64').toString('utf8')); } catch { fail('production previous configuration malformed'); }
    if(!productionConfig(previous).enabled) continue;
    if(run.status!=='completed') fail('production previous writer still active');
    const listed=await api(`repos/${repo}/actions/runs/${run.id}/artifacts?per_page=100`);
    if(!Array.isArray(listed.artifacts)||listed.total_count!==listed.artifacts.length) fail('production artifact list incomplete');
    const matches=listed.artifacts.filter(a=>a.name===`keel-production-${run.run_attempt}`);
    if(matches.length!==1||matches[0].expired||matches[0].size_in_bytes>16*1024*1024) fail('newest production artifact missing, expired or oversized; no fallback');
    const envelope=await download(run,`keel-production-${run.run_attempt}`);
    const state=validateEnvelope(envelope,run,repo);
    await safePath(join(root,'.keel/production'),true,true);
    await transaction(root,async current=>{
      if (Object.keys(current.sources).length && digest(current)!==digest(state)) fail('existing production state differs from recovery; owner reconciliation required');
      Object.assign(current,state); return {state:'restored'};
    });
    return {state:'restored',runId:String(run.id),attempt:run.run_attempt};
  }
  if(response.total_count!==response.workflow_runs.length) fail('production bootstrap history incomplete');
  return {state:'bootstrap',gap:'no prior enabled night; history begins with this observation'};
}
export async function night({root=process.cwd(),env=process.env,restoreOnly=false}={}) {
  const config=await boundedJson(join(root,'.keel/keel.json'));
  const settings = productionConfig(config);
  if(!settings.enabled) return {state:'off'};
  if(!env.RUNNER_TEMP) fail('production night needs RUNNER_TEMP');
  const output=join(env.RUNNER_TEMP,'keel-production','envelope.json');
  const provenance={repo:env.GITHUB_REPOSITORY,workflow:WORKFLOW,runId:env.GITHUB_RUN_ID,attempt:Number(env.GITHUB_RUN_ATTEMPT),headSha:env.GITHUB_SHA};
  // Written before restore: a failure is retained, never a quiet reset tomorrow.
  if(!restoreOnly) await atomicJson(output,{version:1,state:'unavailable',provenance});
  const api=async endpoint=>JSON.parse(execFileSync('gh',['api',endpoint],{cwd:root,env:providerEnv('gh',env),encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']}));
  const download=async(run,name)=>{
    const dir=await mkdtemp(join(tmpdir(),'keel-production-'));
    try {
      execFileSync('gh',['run','download',String(run.id),'--repo',env.GITHUB_REPOSITORY,'--name',name,'--dir',dir],{cwd:root,env:providerEnv('gh',env),timeout:60000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
      return await boundedJson(join(dir,'envelope.json'));
    } finally {await rm(dir,{recursive:true,force:true});}
  };
  const recovery=await recoverNight({root,config,env,api,download,readOnly:restoreOnly});
  if(restoreOnly) return recovery;
  const result=await collect({root,config,yes:true,env});
  const snapshot=await readState(root);
  await atomicJson(output,{version:1,state:'retained',provenance,recovery,snapshot,digest:digest(snapshot)});
  return result;
}
if(isMain(import.meta)) {
  try { const result=await night({restoreOnly:process.argv.includes('--restore-only')});console.log(JSON.stringify(result));process.exitCode=result.results?.some(r=>r.window.coverage==='unavailable')?1:0; }
  catch {console.log(JSON.stringify({state:'unavailable',gaps:['production-night-recovery-or-collection-failed']}));process.exitCode=1;}
}
