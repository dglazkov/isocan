import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {OPERATIONS_ROUTE} from '../../packages/api/src/index.ts';
import {newOpId,newVersionId} from '../../packages/core/src/index.ts';
import {prepareDesignReviewRepair,prepareDesignVerifierOffer} from '../../packages/api/src/design-review-write.ts';
import {readDesignReviews} from '../../packages/api/src/design-review-reader.ts';
import {designReviewPort} from '../../packages/api/src/design-review-node.ts';
import {reviewReceivingHTML} from './design-review-scenario.mjs';
import {interruptReviewWrite} from './design-review-intake.mjs';
import {click,navigate,screenshot,until} from './personal-journey-fixture.mjs';
import {clickText} from './design-systems-browser.mjs';

/** Real shared reservations outlive unsuccessful work; capability claims are tested against a live owned verifier connection. */
export async function reviewNegatives({f,canvas,designer,agent,ctx,checks}) {
  const b=f.owner,io=designReviewPort(ctx(agent)),personIO=designReviewPort(ctx(f.maya)),otherIO=designReviewPort(ctx(f.theo));
  const ref=item=>({home:f.base,canvasId:f.shared,itemId:item.id,versionId:item.currentVersionId,blobHash:item.versions.find(v=>v.id===item.currentVersionId).blobHash});
  const source=await canvas.notify('Check the Acme receiving draft; keep unavailable browser checks explicit.');
  const output=await designer.add({title:'Acme verification draft',content:reviewReceivingHTML({systemAligned:true}),mime:'text/html',filename:'verification-draft.html'});
  const requestId='request_review_limits';
  assert.equal((await designer.designStart({opId:newOpId(),action:{kind:'start',requestId,itemId:'item_brief_review_limits',versionId:newVersionId(),admission:'explicit',source:{entrance:'canvas-chat',threadId:source.threadId,commentId:source.commentId},fields:{intent:'create',fidelity:'designed',delivery:'html-node',targetItemId:null,groupId:null,audience:'Warehouse staff',primaryTask:'Receive stock',constraints:['Phone and desktop'],facts:[],references:[],outstandingDecisionIds:[],outputIds:[output.id]}}})).status,'accepted');
  const obligations=[{id:'phone-save',kind:'browser-task',task:'Save and correct received stock',state:'saved and correction',viewport:{width:390,height:900},required:true},{id:'craft',kind:'craft',task:'Inspect receiving hierarchy',state:'composition',viewport:null,required:true}];
  const journal=async name=>path.join(f.output,name+'.json');
  async function send(prepared){await fs.writeFile(await journal(prepared.opId),JSON.stringify(prepared,null,2));const result=await designer.designReviewSubmit(prepared);assert.equal(result.status,'accepted',JSON.stringify(result));}
  const runId='review_limits';await send(await designer.designReviewStart({requestId,runId,itemId:'item_review_limits',passId:'pass_limits_initial',sessionId:'design-systems-continuation',output:{kind:'canvas',artifact:ref(output)},obligations,opId:newOpId(),versionId:newVersionId()}));
  const read=async()=>{const result=await designer.designReview(requestId,runId);assert.equal(result.unavailable.length,0,JSON.stringify(result));return result.runs[0]};
  let row=await read();
  const session=await f.client.createSession(f.shared,agent,'Owned synthetic browser verifier','codex');
  const stop=new AbortController();let holdError=null;
  const hold=(async()=>{while(!stop.signal.aborted)try{await f.client.rcHold({canvasId:f.shared,actorIds:[agent.id],owner:f.maya,policies:{[agent.id]:{owner:f.maya,listen:[]}},waitMs:5000},stop.signal)}catch(error){if(!stop.signal.aborted){holdError=error;break;}}})();
  try{
    const end=Date.now()+10000;while(!(await f.client.rcAnswering(f.shared)).actorIds.includes(agent.id)){if(Date.now()>end)throw Error('Owned verifier hold failed');await new Promise(resolve=>setTimeout(resolve,40));}
    const probe=await f.owner.send('Browser.getVersion');assert(probe.product.includes('Chrome'));
    const offerValue=(id,available,expiresAt)=>({schemaVersion:1,kind:'verifier-offer',id,requestId,runId,run:row.ref,output:row.run.passes.at(-1).output,sessionId:session.sessionId,observedAt:new Date().toISOString(),expiresAt,delivery:'canvas',available,reason:available?'Owned Chrome responded to Browser.getVersion and the receiving runtime is reachable.':'This synthetic collaborator does not have a browser available for this request.',tools:available?[{name:'Chrome DevTools Protocol',version:probe.product}]:[]});
    await send(await prepareDesignVerifierOffer(io,{canvasId:f.shared,itemId:'item_verifier_unavailable',opId:newOpId(),versionId:newVersionId(),offer:offerValue('verifier_unavailable',false,new Date(Date.now()+240000).toISOString())}));
    await send(await prepareDesignVerifierOffer(io,{canvasId:f.shared,itemId:'item_verifier_expiring',opId:newOpId(),versionId:newVersionId(),offer:offerValue('verifier_expiring',true,new Date(Date.now()+1500).toISOString())}));
    await new Promise(resolve=>setTimeout(resolve,1600));
    const expired=await readDesignReviews(personIO,{canvasId:f.shared,requestId});assert(expired.offers.find(o=>o.offer.id==='verifier_expiring').reasons.some(r=>r.includes('expired')));assert.equal(expired.offers.find(o=>o.offer.id==='verifier_unavailable').eligible,false);
    await send(await prepareDesignVerifierOffer(io,{canvasId:f.shared,itemId:'item_verifier_live',opId:newOpId(),versionId:newVersionId(),offer:offerValue('verifier_live',true,new Date(Date.now()+240000).toISOString())}));
    assert.equal((await readDesignReviews(personIO,{canvasId:f.shared,requestId})).offers.find(o=>o.offer.id==='verifier_live').eligible,true);
    assert.equal((await readDesignReviews(otherIO,{canvasId:f.shared,requestId})).offers.find(o=>o.offer.id==='verifier_live').eligible,false,'access alone does not grant mayWake');
    await b.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await navigate(b,`${f.base}/p/${f.shared}`);await until(b,`document.querySelector('[data-design-review-entry="${requestId}"]')!==null`,'unverified task entry');assert.equal(await b.ev(`document.querySelector('[data-design-review-entry="${requestId}"]').getAttribute('aria-expanded')`),'false','another request has separate review navigation');await click(b,`[data-design-review-entry="${requestId}"]`);await until(b,`[...document.querySelectorAll('.design-review button')].some(e=>e.textContent==='Ask ${agent.name} to verify'&&!e.disabled)`,'eligible actual verifier action');
    const fault=await interruptReviewWrite(b,'thread.reply');await clickText(b,'Ask '+agent.name+' to verify');const submitted=await fault.observed;await fault.close();await until(b,`document.querySelector('[data-review-handoff="pending"]')!==null`,'pending addressed request journal');
    await navigate(b,f.base+'/');await click(b,'.who-btn');await click(b,'.identity-known-row[title^="Continue as Acme Theo"]');await until(b,`JSON.parse(localStorage.getItem('isocan.identity')).id===${JSON.stringify(f.theo.id)}`,'actual other actor');await navigate(b,`${f.base}/p/${f.shared}`);await until(b,`document.querySelector('[data-design-review-entry="${requestId}"]')!==null`,'other actor task');assert.equal(await b.ev(`document.querySelector('[data-design-review-entry="${requestId}"]').getAttribute('aria-expanded')`),'false');await click(b,`[data-design-review-entry="${requestId}"]`);await until(b,`document.querySelector('.design-review-verifiers') && !document.querySelector('.design-review-verifiers').textContent.includes('Recovering any saved request')`,'separate actor journal read');assert.equal(await b.ev(`!!document.querySelector('[data-review-handoff="pending"]')`),false,'another actor cannot inherit this pending intent');
    await navigate(b,f.base+'/');await click(b,'.who-btn');await click(b,'.identity-known-row[title^="Continue as Acme Maya"]');await until(b,`JSON.parse(localStorage.getItem('isocan.identity')).id===${JSON.stringify(f.maya.id)}`,'original actor restored');await navigate(b,`${f.base}/p/${f.shared}`);
    await b.send('Page.reload');await until(b,`document.querySelector('[data-design-review-entry="${requestId}"]')!==null`,'reloaded task');await click(b,`[data-design-review-entry="${requestId}"]`);await until(b,`document.querySelector('[data-review-handoff="pending"]')!==null`,'recovered handoff');await clickText(b,'Retry original verification request');await until(b,`document.querySelector('[data-review-handoff="accepted"]')!==null`,'accepted addressed request');
    assert.equal(typeof submitted.opId,'string');assert(submitted.opId.length>0);await fs.writeFile(path.join(f.output,'verifier-pending-transport.json'),JSON.stringify(submitted,null,2));
    const log=await f.client.getLog(f.shared,0);assert.equal(log.filter(e=>e.envelope.id===submitted.opId).length,1);assert.equal((await read()).run.passes[0].record,null,'delivery did not fabricate inspection');await screenshot(b,path.join(f.output,'verifier-requested.png'));
    await clickText(b,'Keep history and close request');
    const lost=await acceptedHandoffReadFailure(b);await clickText(b,'Ask '+agent.name+' to verify');const committed=await lost.observed;
    await until(b,`document.querySelector('[data-review-handoff="accepted"]')?.textContent.includes('unavailable')`,'accepted request with unavailable consistency');await lost.close();
    await b.send('Page.reload');await until(b,`document.querySelector('[data-design-review-entry="${requestId}"]')!==null`,'accepted request reload');await click(b,`[data-design-review-entry="${requestId}"]`);await until(b,`document.querySelector('[data-review-handoff="accepted"]')?.textContent.includes('unavailable')`,'retained accepted/unavailable journal');
    assert.equal(typeof committed.opId,'string');assert(committed.opId.length>0);await fs.writeFile(path.join(f.output,'verifier-accepted-transport.json'),JSON.stringify(committed,null,2));
    assert.equal((await f.client.getLog(f.shared,0)).filter(e=>e.envelope.id===committed.opId).length,1);assert.equal(await b.ev(`Array.from(document.querySelectorAll('.design-review button')).some(e=>e.textContent==='Retry original verification request')`),false);await screenshot(b,path.join(f.output,'verifier-accepted-unavailable.png'));
    checks.push('A real accepted handoff followed by unavailable snapshot reads remains accepted/unavailable after refresh; no fresh retry action is offered.');
    checks.push('Real Chrome selfprobe, live session and held rc connection permit only the owner to request verification; unavailable/expired/unauthorized offers remain ineligible. Failed handoff survives refresh and retries one exact request without claiming inspection.');
  }finally{stop.abort();await hold;await f.client.endSession(f.shared,session.sessionId);if(holdError)throw holdError;}
  async function append(action,extra={}){row=await read();await send(await designer.designReviewStep({runId,base:row.ref,action,opId:newOpId(),versionId:newVersionId(),...extra}));row=await read();}
  const unavailable={outcome:'reviewed',note:'Browser inspection is unavailable for this bounded negative branch; no successful task claim is supplied.',observations:[],findings:[]};
  await append('record',{record:unavailable});assert.equal(row.readings.task,'unavailable');
  await append('begin-repair',{passId:'pass_invalid',sessionId:'design-systems-continuation'});
  await assert.rejects(()=>prepareDesignReviewRepair(io,{canvasId:f.shared,runId,base:row.ref,text:'',opId:newOpId(),versionId:newVersionId(),repairId:'repair_invalid'}),/HTML source/);
  await append('record',{record:{...unavailable,outcome:'invalid',note:'The reserved attempt produced no authored HTML and preparation refused it.'}});
  await append('begin-repair',{passId:'pass_noop',sessionId:'design-systems-continuation'});
  await assert.rejects(()=>prepareDesignReviewRepair(io,{canvasId:f.shared,runId,base:row.ref,text:reviewReceivingHTML({systemAligned:true}),opId:newOpId(),versionId:newVersionId(),repairId:'repair_noop'}),/does not change/);
  await append('record',{record:{...unavailable,outcome:'noop',note:'The reserved attempt returned unchanged source and preparation refused it.'}});
  assert.equal(row.remainingRepairs,0);await assert.rejects(()=>designer.designReviewStep({runId,base:row.ref,action:'begin-repair',passId:'not_allowed',sessionId:'design-systems-continuation',opId:newOpId(),versionId:newVersionId()}),/cannot reserve/);
  await append('finish');assert.equal(row.run.finished.status,'draft');assert.equal(row.ready,false);
  checks.push('Invalid and no-op generation each consume their reserved pass; a third attempt is refused and missing browser evidence finishes as an honest draft.');
  return {requestId,run:row};
}

/** Preserve a real successful writer response, then deny only its browser follow-up canvas reads. */
async function acceptedHandoffReadFailure(b) {
  let written,resolve,reject;const observed=new Promise((yes,no)=>{resolve=yes;reject=no});const timer=setTimeout(()=>reject(Error('Accepted handoff follow-up read did not arrive')),15000);
  const off=b.on('Fetch.requestPaused',event=>{void(async()=>{
    if(new URL(event.request.url).pathname===OPERATIONS_ROUTE&&event.responseStatusCode===200){let body;try{body=JSON.parse(event.request.postData??'{}')}catch{}if(body?.op?.type==='thread.reply')written=body;return b.send('Fetch.continueRequest',{requestId:event.requestId});}
    if(written&&new URL(event.request.url).pathname.endsWith('/canvas')){await b.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({error:'Synthetic unavailable follow-up snapshot'})).toString('base64')});clearTimeout(timer);resolve(written);return;}
    await b.send('Fetch.continueRequest',{requestId:event.requestId});
  })().catch(reject)});
  await b.send('Fetch.enable',{patterns:[{urlPattern:`*${OPERATIONS_ROUTE}`,requestStage:'Response'},{urlPattern:'*/api/projects/*/canvas',requestStage:'Request'}]});
  return {observed,close:async()=>{clearTimeout(timer);await b.send('Fetch.disable');off()}};
}
