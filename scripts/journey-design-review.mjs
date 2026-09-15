#!/usr/bin/env node
/** Continuous synthetic Scenes1–6 candidate. Run after web build: node --import tsx scripts/journey-design-review.mjs.
 * Actual browser tasks and retained native reports prove engineering behavior, not generated-design quality or human preference.
 */
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {newOpId,newVersionId,newCommentId,workbenchItemPath,designSystemProperties} from '../packages/core/src/index.ts';
import {CanvasHandle} from '../packages/api/src/connect.ts';
import {readDesignRecipe} from '../packages/api/src/design-recipes.ts';
import {designSystemPort} from '../packages/api/src/design-system.ts';
import {projectDesignSystem,writeDesignDirection,readDesignSystem} from '../packages/api/src/design-system-reader.ts';
import {designReviewPort} from '../packages/api/src/design-review-node.ts';
import {prepareDesignReviewRepair} from '../packages/api/src/design-review-write.ts';
import {makeFixture,click,navigate,screenshot,until} from './lib/personal-journey-fixture.mjs';
import {browser} from './lib/browser.mjs';
import {clickText} from './lib/design-systems-browser.mjs';
import {continuationCli} from './lib/design-systems-cli.mjs';
import {comparisonFrame} from './lib/design-comparison-browser.mjs';
import {receivingScenario,structuralComparisonHTML} from './lib/design-comparison-scenarios.mjs';
import {reviewNegatives} from './lib/design-review-negatives.mjs';
import {reviewDrift,reviewEditorRecovery} from './lib/design-review-recovery.mjs';
import {reviewIntake} from './lib/design-review-intake.mjs';
import {reviewReceivingHTML,reviewReceivingScenario,reviewStockLookupHTML,startReviewIncumbent} from './lib/design-review-scenario.mjs';
import {inspectReviewReceiving,inspectReviewIncumbent,reviewFill,reviewClick} from './lib/design-review-browser.mjs';
const f=await makeFixture({contentPort:0}),b=f.owner,checks=[],evidence=[],task=await browser();f.extraBrowsers.push(task);
const ctx=actor=>({client:f.client,actor,home:f.clientHome,harness:actor.id===f.maya.id?'web':'codex',birthHome:null,binding:null,homeOf:async()=>null});
const handle=async actor=>new CanvasHandle(ctx(actor),(await f.client.snapshot(f.shared)).project);
const ref=item=>({home:f.base,canvasId:f.shared,itemId:item.id,versionId:item.currentVersionId,blobHash:item.versions.find(v=>v.id===item.currentVersionId).blobHash});
const json=async(name,value)=>{const file=path.join(f.output,name+'.json');await fs.writeFile(file,JSON.stringify(value,null,2));return file};
const accepted=result=>{assert.equal(result.status,'accepted',JSON.stringify(result));return result};
const current=async(canvas,id)=>(await canvas.designBrief({requestId:id})).requests[0];
const cli=continuationCli(f);let runtime,frame,designer,canvas,agent;
async function write(canvas,prepared,name){await json(name,prepared);return accepted(await canvas.designReviewSubmit(prepared));}
async function run(canvas,id){const value=await canvas.designReview(undefined,id);assert.equal(value.unavailable.length,0,JSON.stringify(value));return value.runs.find(r=>r.run.id===id);}
async function step(canvas,row,action,extra={}){const prepared=await canvas.designReviewStep({runId:row.run.id,base:row.ref,action,opId:newOpId(),versionId:newVersionId(),...extra});await write(canvas,prepared,`${row.run.id}-${action}-${prepared.opId}`);return run(canvas,row.run.id);}
async function change(canvas,row,patch){accepted(await canvas.designChange({opId:newOpId(),action:{kind:'update',brief:row.ref,epoch:row.brief.epoch,versionId:newVersionId(),patch}}));return current(canvas,row.brief.requestId);}
async function runtimeUrl(item){const artifact=ref(item);await navigate(b,f.base+workbenchItemPath(f.shared,item.id));await until(b,`[...document.querySelectorAll('iframe')].some(e=>e.src.includes(${JSON.stringify(artifact.blobHash)}))`,'supported content-origin renderer');const url=await b.ev(`[...document.querySelectorAll('iframe')].find(e=>e.src.includes(${JSON.stringify(artifact.blobHash)})).src`);assert.notEqual(new URL(url).origin,f.base);return url;}
async function openTask(id){await navigate(b,`${f.base}/p/${f.shared}`);if(!await b.ev(`document.querySelector('.main-panel')!==null`)){await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'j',modifiers:4,windowsVirtualKeyCode:74});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'j',windowsVirtualKeyCode:74});}await until(b,`document.querySelector('[data-design-request="${id}"]')!==null`,'current task');}
async function inspect(output,prefix,faults){const url=await runtimeUrl(output);const reports=[];for(const {width} of reviewReceivingScenario.viewports)reports.push(await inspectReviewReceiving(task,url,{output:f.output,prefix,width,...faults}));evidence.push(...reports);return reports;}
async function recordObservations(reports,prefix){
  const transcript=await designer.add({title:`Acme ${prefix} observed task transcript`,content:JSON.stringify(reports,null,2),mime:'application/json',filename:prefix+'-observations.json'}),fallback=ref(transcript),images=new Map();
  for(const report of reports)for(const observation of report.observations)for(const file of observation.evidence)if(!images.has(file)){const item=await designer.add({title:path.basename(file),content:await fs.readFile(file),mime:'image/png',filename:path.basename(file)});images.set(file,ref(item));}
  return reports.flatMap(report=>report.observations.map(observation=>({id:`${prefix}-${report.viewport.width}-${observation.state}`,obligationId:`${report.viewport.width}-${observation.state}`,tool:'Chrome DevTools Protocol, real pointer and keyboard',toolVersion:report.browser.product,result:observation.result,action:observation.action,expected:observation.expected,observed:observation.observed,evidence:observation.evidence.length?observation.evidence.map(file=>images.get(file)):[fallback]}))).concat([{id:prefix+'-craft',obligationId:'craft',tool:'Authored brief-grounded review of synthetic receiving composition',toolVersion:'review-journey-v1',result:'passed',action:'Inspect the recorded desktop and phone receiving views against the Acme brief.',expected:'Receiving takes priority, existing evergreen treatment is retained, quantities and correction have legible hierarchy.',observed:'The task-first form precedes the counted receipt; paper surfaces and evergreen primary actions retain the supplied brand. The phone overflow, when present, is recorded separately as a blocking task finding. This scripted fixture review is not a generated-design quality score.',evidence:[fallback,...images.values()]}]);
}
try{
  await cli('identity','--session','--name','Acme Review Designer','--json');agent=await cli('whoami','--json');designer=await handle(agent);canvas=await handle(f.maya);
  const intake=await reviewIntake(f,canvas,designer);let row=intake.row;const requestId=row.brief.requestId;
  checks.push('Scenes1–2: actual selected-context message, two choices plus optional upload, exact sketch read, unrelated comment, refresh and failed-answer retry without duplicates.');console.log('checkpoint: source, answers, attachment',requestId);
  const recipe=await readDesignRecipe('receiving'),system=await designer.add({title:'Acme receiving system',content:recipe.design,mime:'text/markdown',filename:'DESIGN.md',properties:designSystemProperties()});
  const options=[];for(const variant of ['continuous','confirm'])options.push(await designer.add({title:variant==='continuous'?'Continuous receipt':'Confirm each line',content:structuralComparisonHTML(variant),mime:'text/html',filename:variant+'.html'}));
  row=await change(designer,row,{outstandingDecisionIds:['receiving-sequence']});
  const publication={threadId:row.brief.source.threadId,commentId:newCommentId(),opId:newOpId(),comparison:{schemaVersion:1,kind:'comparison',id:'cmp_review_receiving',revision:1,requestId,epoch:row.brief.epoch,brief:row.ref,decisionKey:'receiving-sequence',audience:{kind:'human',respondentActorId:f.maya.id},mode:'comparison',uncertainty:'structure',scenario:receivingScenario.instructions+' Same three delivered stock lines, quantities12/20/8.',fidelity:'wireframe',alternatives:options.map((item,n)=>({id:n?'confirm':'continuous',title:item.title,hypothesis:n?'Confirm each count before the next scan.':'Scan a batch and review its receipt.',tradeoff:n?'More taps; immediate line review.':'Fewer taps; final review catches mistakes.',artifact:ref(item)})),recommendedAlternativeId:'continuous',recommendation:'Warehouse staff on a phone can scan a batch quickly and correct it at final review.',target:{itemId:null,groupId:null},governing:row.governingBinding,supersedes:null,correctsDecisionId:null,followsResponseId:null}};
  accepted(await cli('--canvas',f.shared,'design','compare','--publish',await json('scene3-comparison',publication),'--json'));
  await openTask(requestId);await click(b,`[data-design-request="${requestId}"] button[data-comparison-entry]`);await until(b,`document.querySelector('[data-design-comparison="cmp_review_receiving"]')!==null`,'same-scenario comparison');
  for(const [index,item] of options.entries()){
    await clickText(b,'Try '+item.title);frame=await comparisonFrame(b);
    await frame.fill('#sku','NOTE-12');await frame.fill('#quantity','12');await frame.click('#scan');if(index)await frame.click('#confirm');await frame.click('#save');await until(frame,`!document.querySelector('#receipt').hidden`,'wireframe saved primary task');
    await frame.click('#correct');await frame.click('[data-edit="0"]');await frame.fill('#correction-quantity','10');await frame.click('#update-count');await frame.click('#save');await until(frame,`document.querySelector('#saved-lines').textContent.includes('10 units')`,'wireframe correction');
    await screenshot(b,path.join(f.output,`scene3-${index}.png`));evidence.push(await frame.evidence());await frame.close();frame=null;await clickText(b,'Return to comparison');
  }
  await click(b,'.comparison-choice-list label:first-child input');await clickText(b,'Use Continuous receipt');await until(b,`document.querySelector('.comparison-actions')?.textContent.includes('Your choice is saved.')`,'canonical adoption');
  row=await current(designer,requestId);assert.equal(row.effectiveDecisions.length,1);assert.equal(row.effectiveDecisions[0].decision.input.authority.kind,'human-choice');
  const outputId=row.effectiveDecisions[0].decision.adopted.itemId;
  checks.push('Scene3: two exact working wireframes, both primary task and correction, one real human selection and adoption.');console.log('checkpoint: choice',outputId);
  const systemIO=designSystemPort(ctx(agent)),projection=await projectDesignSystem(systemIO,{canvasId:f.shared,target:{kind:'item',itemId:outputId}}),read=await readDesignSystem(systemIO,{canvasId:f.shared,target:{kind:'item',itemId:outputId}});
  const direction={...read.direction.direction,stage:'accepted',requestId,rationale:'The chosen batch receipt prioritizes mobile warehouse receiving, with a deliberate correction step and the supplied Acme evergreen controls.'};
  accepted(await writeDesignDirection(systemIO,{projection,direction,opId:newOpId(),versionId:newVersionId()}));
  await f.client.claimActor({type:'actor.claim',sessionKey:'codex:review-continuation',name:'Acme Continuation Reviewer'});const second=(await f.client.actorBindings(['codex:review-continuation']))[0].actor,continuation=await handle(second);
  const continued=await current(continuation,requestId);assert.equal(continued.brief.audience,'Warehouse staff');assert.equal(continued.remainingInitialQuestions,0);assert.equal((await readDesignSystem(designSystemPort(ctx(second)),{canvasId:f.shared,target:{kind:'item',itemId:outputId}})).direction.direction.stage,'accepted');
  const lookup=await continuation.add({title:'Acme stock lookup',content:reviewStockLookupHTML(),mime:'text/html',filename:'lookup-continuity.html'});
  assert.equal((await readDesignSystem(designSystemPort(ctx(second)),{canvasId:f.shared,target:{kind:'item',itemId:lookup.id}})).governing.artifact.itemId,system.id);
  await navigate(task,await runtimeUrl(lookup));await reviewFill(task,'#search','NOTE-12');assert.equal(await task.ev("document.querySelectorAll('#stock li').length"),1);await reviewFill(task,'#search','unavailable SKU');assert(await task.ev("!document.querySelector('#empty').hidden"));await reviewClick(task,'#clear');assert.equal(await task.ev("document.querySelectorAll('#stock li').length"),3);await screenshot(task,path.join(f.output,'scene5-actual-stock-lookup.png'));
  checks.push('Scenes4–5: supplied Acme system and accepted direction remain readable by a second agent; no repeated initial questions.');
  row=await change(designer,await current(designer,requestId),{outputIds:[outputId]});
  // This create request selected only brand context. The first implementation is an ordinary output revision,
  // before the initial review; task repairs after that use reserved canonical repair edges.
  await designer.edit(outputId,{content:reviewReceivingHTML({brokenSave:true,phoneOverflow:true}),mime:'text/html'});
  row=await current(designer,requestId);assert.equal(row.status,'current',JSON.stringify(row.reasons));
  let output=(await f.client.snapshot(f.shared)).canvas.items[outputId];
  const obligations=reviewReceivingScenario.viewports.flatMap(viewport=>reviewReceivingScenario.states.map(state=>({id:`${viewport.width}-${state}`,kind:'browser-task',task:'Receive three stock lines and correct the notebook count',state,viewport,required:true}))).concat([{id:'craft',kind:'craft',task:'Honor the Acme receiving brief and control hierarchy',state:'phone and desktop composition',viewport:null,required:true}]);
  const start=await designer.designReviewStart({requestId,runId:'review_receiving',itemId:'item_review_receiving',passId:'pass_initial',sessionId:'design-systems-continuation',output:{kind:'canvas',artifact:ref(output)},obligations,opId:newOpId(),versionId:newVersionId()});await write(designer,start,'initial-review-reservation');
  let review=await run(designer,'review_receiving');let reports=await inspect(output,'initial',{brokenSave:true,phoneOverflow:true});
  review=await step(designer,review,'record',{record:{outcome:'reviewed',note:'Actual primary action and quantity entry exposed two runtime defects.',observations:await recordObservations(reports,'initial'),findings:[{id:'broken-save',kind:'browser-task',severity:'critical',description:'Save does not produce or persist a receipt.',rationale:'Receiving cannot be completed.'},{id:'phone-overflow',kind:'browser-task',severity:'critical',description:'Quantity entry overflows the phone viewport.',rationale:'The required count control is clipped after input.'}]}});
  assert.notEqual(review.readings.task,'passed');assert(review.run.passes.at(-1).record.findings.some(f=>f.severity==='critical'));assert.equal(review.remainingRepairs,2);
  for(const pass of [1,2]){
    const owner=pass===1?designer:continuation,ownerActor=pass===1?agent:second;
    review=await run(owner,'review_receiving');assert.equal(review.remainingRepairs,3-pass);
    if(pass===1){accepted(await cli('--canvas',f.shared,'design','review',requestId,'--run',review.run.id,'--begin-repair','pass_repair_1','--session','design-systems-continuation','--json'));review=await run(owner,review.run.id);}else review=await step(owner,review,'begin-repair',{passId:'pass_repair_2',sessionId:'review-continuation'});
    const prepared=await prepareDesignReviewRepair(designReviewPort(ctx(ownerActor)),{canvasId:f.shared,runId:review.run.id,base:review.ref,text:reviewReceivingHTML({phoneOverflow:pass===1,systemAligned:true}),opId:newOpId(),versionId:newVersionId(),repairId:'repair_task_'+pass});await json('repair-'+pass+'-intent',prepared);accepted(await owner.designRepairSubmit(prepared));
    output=(await f.client.snapshot(f.shared)).canvas.items[outputId];reports=await inspect(output,'repair'+pass,{phoneOverflow:pass===1});
    review=await step(owner,await run(owner,review.run.id),'record',{record:{outcome:'reviewed',note:pass===1?'Save and correction now work; phone overflow still blocks the task.':'The remaining phone defect is repaired; actual affected task states were repeated.',observations:await recordObservations(reports,'repair'+pass),findings:pass===1?[{id:'phone-overflow',kind:'browser-task',severity:'critical',description:'Quantity still overflows on phone.',rationale:'The first repair solved Save only.'}]:[]}});
    console.log('checkpoint: actual repair',pass,review.readings,review.status);
  }
  assert.equal(review.remainingRepairs,0);assert.equal(review.readings.task,'passed');assert.equal(review.status,'current',JSON.stringify(review.reasons));
  await assert.rejects(()=>designer.designReviewStep({runId:review.run.id,base:review.ref,action:'begin-repair',passId:'forbidden_third',sessionId:'design-systems-continuation',opId:newOpId(),versionId:newVersionId()}),/cannot reserve/);
  const finish=await cli('--canvas',f.shared,'design','review',requestId,'--run',review.run.id,'--finish','--json');accepted(finish.result);review=await run(continuation,review.run.id);const complete=await current(designer,requestId);assert.equal(complete.brief.progress,'completed');assert.equal(complete.receipts.length,1);assert.equal(complete.receipts[0].status,'current');
  await openTask(requestId);await click(b,`button[data-design-review-entry="${requestId}"]`);await until(b,`document.querySelector('[data-design-review-run="review_receiving"]')!==null`,'shared review panel');await until(b,`!document.querySelector('.design-review')?.textContent.includes('Checking the saved review')`,'review currentness');
  assert(await b.ev(`document.querySelector('.design-review').textContent.includes('2 of 2 repair attempts used')`));await screenshot(b,path.join(f.output,'scene6-review-receipt-wide.png'));
  await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});await b.ev(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);await until(b,`document.querySelector('[data-design-review-run="review_receiving"]')!==null && document.querySelector('[data-design-review-entry="${requestId}"]').getAttribute('aria-expanded')==='true'`,'same selected review survives phone breakpoint');await b.ev(`document.querySelector('[data-design-review-request="${requestId}"]').scrollIntoView({block:'start',behavior:'instant'})`);await until(b,`(()=>{const e=document.querySelector('[data-design-review-request="${requestId}"]');return !!e && e.scrollWidth<=e.clientWidth+1})()`,'rendered phone review fits its container');await screenshot(b,path.join(f.output,'scene6-review-receipt-390.png'));
  checks.push('Scene6: actual Save and phone-overflow failures, two reserved repairs across distinct agents, exact retained observations, task/craft/source separation and shared cap.');
  await reviewDrift({f,designer,agent,continuation,second,outputId:output.id,system,checks});
  evidence.push(await reviewNegatives({f,canvas,designer,agent,ctx,checks}));
  await reviewEditorRecovery({f,designer,checks});
  runtime=await startReviewIncumbent(f.output);const connected=await inspectReviewIncumbent(task,runtime,f.output);evidence.push(connected);checks.push('Actual incumbent connected runtime: original components/tokens, stock GET, receipt POST, correction PATCH and reload GET; phone and desktop.');
  await json('proof',{ok:true,output:f.output,checks,evidence,review});console.log(JSON.stringify({ok:true,output:f.output,checks},null,2));
}catch(error){await screenshot(b,path.join(f.output,'failure-ui.png')).catch(()=>{});await screenshot(task,path.join(f.output,'failure-task.png')).catch(()=>{});await json('failure',{error:String(error),checks,evidence}).catch(()=>{});console.error('Review journey evidence:',f.output);throw error;}
finally{if(frame)await frame.close().catch(()=>{});if(runtime)await runtime.close();await f.close();}
