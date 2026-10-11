// Read-only adopted-night comparison. No issue writes and no candidate execution.
import { readFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as ledger from './test-ledger.mjs';
import { robotGithub, readRobotDelivery, robotRepo, robotSha } from './robot-delivery.mjs';
const atTime=at=>new Date(at??Date.now()).toISOString();
async function local(root) {
  const config=JSON.parse(await readFile(join(root,'.keel/keel.json'),'utf8'));
  if(!robotRepo(config.repo))throw new Error('local repository identity unavailable');
  return {config,repo:config.repo.toLowerCase()};
}
function ancestry(root,base,head) {
  if(!robotSha(base)||!(head==='HEAD'||robotSha(head)))return false;
  return spawnSync('git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','merge-base','--is-ancestor',base,head],{cwd:root,env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0'},stdio:'ignore',timeout:10000}).status===0;
}
export async function timeProposalDelivery(root,proposal,github) {
  const {repo}=await local(root),issue=proposal.lifecycle.issue;
  if(!issue||issue.repo.toLowerCase()!==repo)throw new Error('proposal issue does not belong to the local repository');
  const delivery=await readRobotDelivery({repo,issueNumber:issue.number,instanceId:proposal.instanceId,github});
  if(!['open','merged'].includes(delivery.state)||!delivery.pr)throw new Error(delivery.reasons.join('; ')||'verified delivery unavailable');
  return {repo,delivery};
}
export function checkedTimeTransition(transition,proposal,repo,delivery,at) {
  if(proposal.measure!=='critical_file')throw new Error('only critical_file proposals support topology mapping');
  const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const pr=transition?.pr;
  if(!transition||transition.instanceId!==proposal.instanceId||pr?.repo?.toLowerCase()!==repo||pr.number!==delivery.pr.number||pr.headSha!==delivery.pr.headSha||pr.mergeSha!==(delivery.pr.mergeSha??null))throw new Error('mapping must bind this instance and verified PR head/merge');
  if(!same(transition.fromIdentity,proposal.identity)||!transition.toIdentity||!Array.isArray(transition.testMapping)||!transition.testMapping.length||!transition.executionSettings?.before||!transition.executionSettings?.after)throw new Error('mapping requires original/successor identities and execution settings');
  for(const field of ['kind','scope','runner','machineClass']){
    if(transition.toIdentity[field]!==proposal.identity[field])throw new Error(`mapping must preserve ${field} identity`);
  }
  // Full identity, not just a filename. Exhaustiveness against producer receipts
  // and frozen inventories is the evaluator's responsibility.
  const valid=id=>id&&typeof id.file==='string'&&id.file&&!isAbsolute(id.file)&&!id.file.split(/[\\/]/).includes('..')&&Array.isArray(id.hierarchy)&&id.hierarchy.length>0&&id.hierarchy.every(n=>typeof n==='string'&&n.trim())&&Number.isSafeInteger(id.occurrence)&&id.occurrence>=0;
  const from=new Set(),to=new Set();
  for(const row of transition.testMapping){
    if(!valid(row.from)||!Array.isArray(row.to)||!row.to.length||row.to.some(id=>!valid(id)))throw new Error('testMapping needs full file/hierarchy/occurrence identities');
    const key=JSON.stringify(canonical(row.from));if(from.has(key))throw new Error('duplicate source mapping');from.add(key);
    for(const id of row.to){const key=JSON.stringify(canonical(id));if(to.has(key))throw new Error('successor identity collision');to.add(key);}
  }
  return {...transition,reviewedAt:at};
}
export async function remeasureTimeProposal({root,proposal,at,github=robotGithub,evaluate}) {
  const observedAt=atTime(at),unavailable=reason=>({state:'unavailable',observedAt,value:null,coverage:null,delivery:null,reasons:[reason]});
  try{
    if(proposal.lifecycle.state!=='accepted')return unavailable('proposal acceptance is not complete');
    const {repo,delivery}=await timeProposalDelivery(root,proposal,github);
    if(delivery.state!=='merged')return {...unavailable('verified PR has not merged'),delivery};
    if(Date.parse(delivery.pr.mergedAt)>=Date.parse(observedAt)||!ancestry(root,delivery.pr.mergeSha,'HEAD'))return {...unavailable('verified merge is not in the local checkout ancestry'),delivery};
    let transition=proposal.lifecycle.transition;
    if(transition){
      // A premerge review may acquire only the fresh merge SHA; the reviewed
      // PR head, mapping and settings remain unchanged.
      transition=checkedTimeTransition({...transition,pr:{...transition.pr,mergeSha:transition.pr.mergeSha??delivery.pr.mergeSha}},proposal,repo,delivery,transition.reviewedAt);
    }
    const {runs}=await ledger.readRuns(root,undefined,{gates:true});
    const revisions=new Map();
    // A run measured code that has the merge (descends from it) and that this checkout has (an ancestor of
    // HEAD): a branch that forked after the merge descends from it too, but its code is not what merged here.
    const eligibleRevision=sha=>{if(!revisions.has(sha))revisions.set(sha,ancestry(root,delivery.pr.mergeSha,sha)&&ancestry(root,sha,'HEAD'));return revisions.get(sha);};
    const eligible=runs.filter(r=>eligibleRevision(r.commit));
    const receipts=ledger.readStalls?await ledger.readStalls(root):{receipts:[]};
    const stallsReceipts=receipts.receipts??[];
    const eligibleStalls=stallsReceipts.filter(r=>eligibleRevision(r.revision??r.commit));
    if(!evaluate)evaluate=(await import('./time-measures.mjs')).evaluateTimeEvidence;
    const eligibleRevisionShas=[...new Set([...eligible.map(r=>r.commit),...eligibleStalls.map(r=>r.revision??r.commit)])];
    const comparison={eligibleRevisionShas,identity:proposal.identity,baseline:proposal.baseline,threshold:proposal.threshold,instanceId:proposal.instanceId,mergeSha:delivery.pr.mergeSha,mergeTime:delivery.pr.mergedAt,transition};
    const result=await evaluate({measure:proposal.measure,runs,stallsReceipts,localWorkarounds:[],at:observedAt,comparison});
    if(!['inside','outside','unavailable'].includes(result?.state))return {...unavailable('evaluator returned no comparable verdict'),delivery};
    return {state:result.state,observedAt,value:result.value??null,coverage:result.coverage??null,...(result.suiteWall?{suiteWall:result.suiteWall}:{}),delivery,reasons:result.reasons??[]};
  }catch(e){return unavailable(e.message);}
}
