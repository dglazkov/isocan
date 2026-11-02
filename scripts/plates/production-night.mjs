import { selectArtifacts } from './names.mjs';
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
const WORKFLOW='.github/workflows/plates-night.yml';
// Workflow filenames and uploaded artifacts are immutable provenance, not branding.
const HISTORIES = [
  { workflow: WORKFLOW, config: '.plates/plates.json' },
  { workflow: '.github/workflows/keel-night.yml', config: '.keel/keel.json' },
];
const missing = error => error?.status === 404 || error?.statusCode === 404 || /\(HTTP 404\)/.test(String(error?.stderr ?? ''));
const historyOf = path => HISTORIES.find(history => history.workflow === path);
export function selectPrevious(runs,env,repositoryNames = new Set([env.GITHUB_REPOSITORY.toLowerCase()])) {
  if(!Array.isArray(runs)) fail('production run history unavailable');
  for (const r of runs) {
    if (!Number.isSafeInteger(r?.id) || !Number.isSafeInteger(r.run_attempt) || !/^[a-f0-9]{40}$/.test(r.head_sha ?? '') || !r.head_repository?.full_name || !r.repository?.full_name || typeof r.head_branch !== 'string' || typeof r.path !== 'string' || typeof r.event !== 'string' || !Array.isArray(r.pull_requests) || !Number.isFinite(Date.parse(r.run_started_at))) fail('production run provenance unavailable');
  }
  return runs.filter(r=>String(r.id)!==env.GITHUB_RUN_ID && repositoryNames.has(r.head_repository.full_name.toLowerCase()) && repositoryNames.has(r.repository.full_name.toLowerCase()) && r.head_branch===env.BASE && !!historyOf(r.path) && ['schedule','workflow_dispatch'].includes(r.event) && Array.isArray(r.pull_requests) && !r.pull_requests.length)
    .sort((a,b)=>Date.parse(b.run_started_at)-Date.parse(a.run_started_at));
}
export function validateEnvelope(envelope,run,repo,repositoryNames = new Set([repo.toLowerCase()])) {
  const p=envelope?.provenance;
  if(envelope?.version!==1 || !repositoryNames.has(String(p?.repo ?? '').toLowerCase()) || (!historyOf(run.path) || p.workflow!==run.path) || p.runId!==String(run.id) || p.attempt!==run.run_attempt || p.headSha!==run.head_sha) fail('production recovery provenance mismatch');
  if(envelope.state!=='retained' || !envelope.snapshot || envelope.digest!==digest(envelope.snapshot)) fail('latest production attempt has unavailable state; owner recovery required');
  return validateState(envelope.snapshot);
}
export async function recoverNight({root,config,env=process.env,api,download,readOnly=false}) {
  const settings = productionConfig(config);
  if(!settings.enabled) return {state:'off'};
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(env.GITHUB_REPOSITORY??'') || env.GITHUB_REF_NAME!==env.BASE || !(readOnly ? ['schedule','workflow_dispatch','workflow_run'] : ['schedule','workflow_dispatch']).includes(env.GITHUB_EVENT_NAME)) fail('production retention requires the default-branch night');
  const repo=env.GITHUB_REPOSITORY;
  const repositoryNames = new Set([repo.toLowerCase()]), checkedNames = new Map([[repo.toLowerCase(), true]]);
  let repository;
  const sameRepository = async name => {
    if (typeof name !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name)) return false;
    const key = name.toLowerCase();
    if (checkedNames.has(key)) return checkedNames.get(key);
    if (checkedNames.size >= 8) fail('production repository aliases exceed read bound');
    repository ??= await api(`repos/${repo}`);
    if (!Number.isSafeInteger(repository?.id) || repository.id < 1 || repository.full_name?.toLowerCase() !== repo.toLowerCase()) fail('production repository identity unavailable');
    const alias = await api(`repos/${name}`);
    const same = alias?.id === repository.id && alias.full_name?.toLowerCase() === repo.toLowerCase();
    checkedNames.set(key, same);
    if (same) repositoryNames.add(key);
    return same;
  };
  const histories = [], byId = new Map();
  for (const history of HISTORIES) {
    let response;
    try { response = await api(`repos/${repo}/actions/workflows/${history.workflow.split('/').at(-1)}/runs?branch=${encodeURIComponent(env.BASE)}&per_page=100`); }
    catch (error) { if (missing(error)) continue; throw error; }
    if (!Number.isSafeInteger(response?.total_count) || response.total_count < 0 || !Array.isArray(response.workflow_runs) || response.workflow_runs.length > 100 || response.total_count < response.workflow_runs.length) fail('production run history unavailable');
    // Validate every row before filtering, including rows that cannot be restored.
    selectPrevious(response.workflow_runs, env); // validate before inspecting names
    for (const run of response.workflow_runs) {
      for (const source of [run.repository, run.head_repository]) {
        if (source.full_name.toLowerCase() !== repo.toLowerCase() && await sameRepository(source.full_name) && source.id !== repository.id) fail('production run repository identity mismatch');
      }
    }
    const selected = selectPrevious(response.workflow_runs, env, repositoryNames);
    if (response.workflow_runs.some(run => run.path !== history.workflow)) fail('production workflow history provenance mismatch');
    histories.push(response);
    for (const run of selected) {
      if (byId.has(run.id)) fail('production run history identity duplicated');
      byId.set(run.id, run);
    }
  }
  if (!histories.length) fail('production workflow history unavailable');
  const runs = [...byId.values()];
  if(!readOnly && Number(env.GITHUB_RUN_ATTEMPT)>1) runs.push(await api(`repos/${repo}/actions/runs/${env.GITHUB_RUN_ID}/attempts/${Number(env.GITHUB_RUN_ATTEMPT)-1}`));
  runs.sort((a,b)=>Date.parse(b.run_started_at)-Date.parse(a.run_started_at));
  for(const run of runs) {
    if (settings.since && Date.parse(run.run_started_at) < Date.parse(settings.since)) return {state:'bootstrap',since:settings.since,gap:'explicit start boundary; earlier coverage unavailable'};
    if(!Number.isSafeInteger(run.id)||!Number.isSafeInteger(run.run_attempt)||!/^[a-f0-9]{40}$/.test(run.head_sha??'')) fail('production run identity unavailable');
    const history = historyOf(run.path);
    if (!history) fail('production run workflow unavailable');
    const contents=await api(`repos/${repo}/contents/${history.config}?ref=${run.head_sha}`);
    if(contents.encoding!=='base64'||typeof contents.content!=='string'||contents.content.length>1500000) fail('production previous configuration unavailable');
    let previous; try { previous=JSON.parse(Buffer.from(contents.content,'base64').toString('utf8')); } catch { fail('production previous configuration malformed'); }
    if(!productionConfig(previous).enabled) continue;
    if(run.status!=='completed') fail('production previous writer still active');
    const listed=await api(`repos/${repo}/actions/runs/${run.id}/artifacts?per_page=100`);
    if(!Array.isArray(listed.artifacts)||listed.total_count!==listed.artifacts.length) fail('production artifact list incomplete');
    const { name: artifact, matches } = selectArtifacts(listed.artifacts, 'artifact:keel-production-', String(run.run_attempt));
    if(matches.length!==1||matches[0].expired||matches[0].size_in_bytes>16*1024*1024) fail('newest production artifact missing, expired or oversized; no fallback');
    const envelope=await download(run,artifact);
    if (!await sameRepository(envelope?.provenance?.repo)) fail('production recovery repository identity mismatch');
    const state=validateEnvelope(envelope,run,repo,repositoryNames);
    await safePath(join(root,'.plates/production'),true,true);
    await transaction(root,async current=>{
      if (Object.keys(current.sources).length && digest(current)!==digest(state)) fail('existing production state differs from recovery; owner reconciliation required');
      Object.assign(current,state); return {state:'restored'};
    });
    return {state:'restored',runId:String(run.id),attempt:run.run_attempt};
  }
  if(histories.some(response => response.total_count!==response.workflow_runs.length)) fail('production bootstrap history incomplete');
  return {state:'bootstrap',gap:'no prior enabled night; history begins with this observation'};
}
export async function night({root=process.cwd(),env=process.env,restoreOnly=false}={}) {
  const config=await boundedJson(join(root,'.plates/plates.json'));
  const settings = productionConfig(config);
  if(!settings.enabled) return {state:'off'};
  if(!env.RUNNER_TEMP) fail('production night needs RUNNER_TEMP');
  const output=join(env.RUNNER_TEMP,'plates-production','envelope.json');
  const provenance={repo:env.GITHUB_REPOSITORY,workflow:WORKFLOW,runId:env.GITHUB_RUN_ID,attempt:Number(env.GITHUB_RUN_ATTEMPT),headSha:env.GITHUB_SHA};
  // Written before restore: a failure is retained, never a quiet reset tomorrow.
  if(!restoreOnly) await atomicJson(output,{version:1,state:'unavailable',provenance});
  const api=async endpoint=>JSON.parse(execFileSync('gh',['api',endpoint],{cwd:root,env:providerEnv('gh',env),encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']}));
  const download=async(run,name)=>{
    const dir=await mkdtemp(join(tmpdir(),'plates-production-'));
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
