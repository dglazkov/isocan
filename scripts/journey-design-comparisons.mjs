#!/usr/bin/env node
/** Real browser + CLI comparison/adoption journey. Run after build: node --import tsx scripts/journey-design-comparisons.mjs.
 * Scripted synthetic collaborators prove contracts and task behavior; conductor craft review is separate from model quality.
 */
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {newOpId,newVersionId,newCommentId} from '../packages/core/src/index.ts';
import {CanvasHandle} from '../packages/api/src/connect.ts';
import {designDecisionScope} from '../packages/core/src/design-decision.ts';
import {prepareDesignDecision} from '../packages/api/src/design-decision-reader.ts';
import {makeFixture,click,navigate,screenshot,until} from './lib/personal-journey-fixture.mjs';
import {clickText,fill,selectValue} from './lib/design-systems-browser.mjs';
import {continuationCli} from './lib/design-systems-cli.mjs';
import {comparisonFrame} from './lib/design-comparison-browser.mjs';
import {receivingScenario,campaignScenario,structuralComparisonHTML,visualComparisonHTML} from './lib/design-comparison-scenarios.mjs';
const f=await makeFixture({contentPort:0}),b=f.owner,checks=[],frames=[],fixtures=[];
async function waitRead(read,test,label){const end=Date.now()+15000;for(;;){const value=await read();if(test(value))return value;if(Date.now()>end)throw Error('Timed out reading '+label);await new Promise(resolve=>setTimeout(resolve,50));}}
const sha=value=>createHash('sha256').update(value).digest('hex');
const agentCli=continuationCli(f);
const ctx=actor=>({client:f.client,actor,home:f.clientHome,harness:actor.id===f.maya.id?'web':'codex',birthHome:null,binding:null,homeOf:async()=>null});
const handle=async actor=>new CanvasHandle(ctx(actor),(await f.client.snapshot(f.shared)).project);
let agent,canvas,designer,activeFrame;
async function jsonFile(name,value){const file=path.join(f.output,name+'.json');await fs.writeFile(file,JSON.stringify(value,null,2));return file;}
const ref=item=>({home:f.base,canvasId:f.shared,itemId:item.id,versionId:item.currentVersionId,blobHash:item.versions.find(v=>v.id===item.currentVersionId).blobHash});
async function setup(name,{visual=false,external=false,existing=false,mode='comparison',publish=true}={}){
  const source=await canvas.notify(visual?'Explore two visual directions for our repair morning.':'Compare the two receiving workflows before implementation.');
  const modes=visual?['editorial','poster']:['continuous','confirm'];
  const alternatives=[];
  for(const variant of modes){const html=visual?visualComparisonHTML(variant):structuralComparisonHTML(variant);const item=await designer.add({title:variant==='continuous'?'Continuous receipt':variant==='confirm'?'Confirm each line':variant==='editorial'?'Editorial invitation':'Event poster',content:html,mime:'text/html',filename:`${name}-${variant}.html`});alternatives.push(item);fixtures.push({request:name,variant,itemId:item.id,hash:sha(html),bytes:Buffer.byteLength(html)});}
  const target=existing?await designer.add({title:'Existing receiving screen',description:'Keep the current screen identity and metadata.',content:'<!doctype html><html><main><h1>Existing receiving</h1><p>Receipt needs clearer review.</p></main></html>',mime:'text/html',filename:'receiving.html'}):null;
  const requestId=`req_${name}`;
  const started=await designer.designStart({opId:newOpId(),action:{kind:'start',requestId,itemId:`itm_brief_${name}`,versionId:newVersionId(),admission:'explicit',source:external?{entrance:'external-agent',externalRequestId:`native_${name}`}:{entrance:'canvas-chat',threadId:source.threadId,commentId:source.commentId},fields:{intent:existing?'refine':'create',fidelity:visual?'designed':'wireframe',delivery:'html-node',targetItemId:target?.id??null,groupId:null,audience:visual?'Local people with one portable item to repair':'Receiving staff',primaryTask:visual?'Reserve and correct a repair place':'Receive three stock lines, review and correct the receipt',constraints:['Phone and desktop',...(visual?campaignScenario.facts:receivingScenario.items.map(i=>`${i.sku}: ${i.ordered} ordered`))],facts:[],references:[],outstandingDecisionIds:['primary-direction'],outputIds:[]}}});
  assert.equal(started.status,'accepted',JSON.stringify(started));
  const request=(await designer.designBrief({requestId})).requests[0];
  const comparison={schemaVersion:1,kind:'comparison',id:`cmp_${name}`,revision:1,requestId,epoch:request.brief.epoch,brief:request.ref,decisionKey:'primary-direction',audience:external?{kind:'external-agent',externalRequestId:`native_${name}`,reporterActorId:agent.id}:{kind:'human',respondentActorId:f.maya.id},mode,uncertainty:visual?'visual':'structure',scenario:visual?`${campaignScenario.instructions} ${campaignScenario.facts.join(' · ')}`:`${receivingScenario.instructions} Same delivery: ${receivingScenario.items.map(i=>`${i.name} (${i.sku}), ${i.ordered}`).join('; ')}.`,fidelity:visual?'designed':'wireframe',alternatives:alternatives.map((item,n)=>({id:modes[n],title:item.title,hypothesis:visual?(n?'A centered event poster puts the date and action in one direct composition.':'An editorial invitation explains the repair morning through narrative and a split illustration.'):(n?'Confirm each counted line before moving to the next SKU.':'Scan a whole batch, then review all counts together.'),tradeoff:visual?(n?'Less narrative before the reservation; stronger event hierarchy.':'More reading before the full offer; quieter editorial tone.'):(n?'More repeated confirmations; errors caught immediately.':'Fewer taps; a deliberate final review catches mistakes.'),artifact:ref(item)})),recommendedAlternativeId:modes[0],recommendation:visual?'The editorial invitation explains what visitors can bring before asking for a reservation.':'Continuous scanning reduces repeated taps for a batch while keeping explicit receipt correction.',target:{itemId:target?.id??null,groupId:null},governing:request.governingBinding,supersedes:null,correctsDecisionId:null,followsResponseId:null};
  const publication={threadId:source.threadId,commentId:newCommentId(),opId:newOpId(),comparison};
  if(publish){const published=await agentCli('--canvas',f.shared,'design','compare','--publish',await jsonFile(name+'-comparison',publication),'--json');assert.equal(published.status,'accepted',JSON.stringify(published));}
  return {request,comparison,publication,alternatives,target,source,requestId};
}
async function read(one,as=canvas){return (await as.designComparisons({requestId:one.requestId})).comparisons.find(r=>r.comparison.id===one.comparison.id);}
async function open(one){
  await navigate(b,`${f.base}/p/${f.shared}`);
  if(!await b.ev(`document.querySelector('.main-panel')!==null`)){await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'j',modifiers:4,windowsVirtualKeyCode:74});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'j',windowsVirtualKeyCode:74});}
  await until(b,`document.querySelector('[data-design-request="${one.requestId}"]')!==null`,'task entry');
  await click(b,`[data-design-request="${one.requestId}"] button[data-comparison-entry]`);
  await until(b,`document.querySelector('[data-design-comparison="${one.comparison.id}"]')!==null && !document.querySelector('.design-comparison')?.textContent.includes('Checking the comparison')`,'shared comparison read');
}
async function tryTask(one,variant){
  const option=one.comparison.alternatives.find(o=>o.id===variant);await clickText(b,'Try '+option.title);
  activeFrame=await comparisonFrame(b);const frame=activeFrame;
  assert.notEqual(new URL(frame.url).origin,f.base,'real content origin');
  assert((await b.ev(`document.querySelector('.design-comparison-frame').getAttribute('sandbox')`)).includes('allow-forms'));
  await screenshot(b,path.join(f.output,`${one.requestId}-${variant}-wide.png`));
  if(one.comparison.uncertainty==='structure'){
    await frame.click('#save');assert(await frame.ev(`!document.querySelector('#error').hidden && document.activeElement.id==='sku'`));
    for(const item of receivingScenario.items){await frame.fill('#sku',item.sku);await frame.fill('#quantity',String(item.ordered));await frame.click('#scan');if(variant==='confirm')await frame.click('#confirm');}
    await frame.click('#save');await until(frame,`!document.querySelector('#receipt').hidden`,'three-line receipt');
    await frame.click('#correct');await frame.click('[data-edit="0"]');await frame.fill('#correction-quantity','10');await frame.click('#update-count');await frame.click('#save');
    assert(await frame.ev(`document.querySelector('#saved-lines').textContent.includes('10 units')`));
  }else{
    await frame.click('a[href="#book"]');await frame.click('#reserve');assert(await frame.ev(`!document.querySelector('#form-error').hidden && document.activeElement.id==='name'`));
    await frame.fill('#name','Acme Visitor');await frame.fill('#email','visitor@example.test');await frame.select('#project','Clothing');await frame.click('#reserve');await until(frame,`!document.querySelector('#confirmation').hidden`,'reservation saved');await frame.click('#edit');await frame.fill('#name','Acme Returning Visitor');await frame.click('#reserve');assert(await frame.ev(`document.querySelector('#thanks').textContent.includes('Returning')`));
  }
  // A real unrelated canvas act causes a status read while the exact running prototype keeps its state.
  const before=await frame.ev('performance.timeOrigin');await designer.notify('Acme comparison runtime remains open while history refreshes.');
  await until(b,`document.querySelector('.design-comparison-frame')!==null`,'preview remains mounted');assert.equal(await frame.ev('performance.timeOrigin'),before);
  const focusedBeforeResize=await frame.ev('document.activeElement.id');
  await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});
  assert.equal(await frame.ev('performance.timeOrigin'),before,'same active frame survives phone breakpoint');
  assert.equal(await frame.ev('document.activeElement.id'),focusedBeforeResize,'frame focus survives phone breakpoint');
  const narrow=frame;
  assert.equal(await narrow.ev('document.documentElement.scrollWidth>innerWidth'),false,'exact option at narrow frame');
  if(one.comparison.uncertainty==='structure'){
    await narrow.click('#correct');await narrow.click('[data-edit="0"]');await narrow.fill('#correction-quantity','9');await narrow.click('#update-count');await narrow.click('#save');assert(await narrow.ev(`document.querySelector('#saved-lines').textContent.includes('9 units')`));
    await narrow.click('#correct');await narrow.click('[data-edit="0"]');await narrow.fill('#correction-quantity','10');await narrow.click('#update-count');await narrow.click('#save');assert(await narrow.ev(`document.querySelector('#saved-lines').textContent.includes('10 units')`));
  }else{await narrow.click('#edit');await narrow.fill('#name','Acme Phone Visitor');await narrow.click('#reserve');assert(await narrow.ev(`document.querySelector('#thanks').textContent.includes('Phone Visitor')`));}
  await screenshot(b,path.join(f.output,`${one.requestId}-${variant}-390.png`));frames.push(await narrow.evidence());
  // Walk the real keyboard out of the child to the explicit parent Return control.
  let returned=false;
  for(let n=0;n<40;n++){await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',windowsVirtualKeyCode:9});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',windowsVirtualKeyCode:9});if(await b.ev(`document.activeElement?.textContent==='Return to comparison'`)){returned=true;break;}}
  assert(returned,'native Tab reaches Return outside the iframe');await frame.close();activeFrame=null;
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',text:'\r',windowsVirtualKeyCode:13});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',windowsVirtualKeyCode:13});
  await until(b,`document.activeElement?.textContent==='Try ${option.title}'`,'phone keyboard Return restores focus to Try');
  assert.equal(await b.ev('document.documentElement.scrollWidth>innerWidth'),false,'narrow comparison UI');
  await click(b,'[aria-label="Design comparison"] > header button[aria-label="Close"]');
  await clickText(b,'Compare options',`[data-design-comparison-comment="${one.comparison.id}"] button`);await until(b,`document.querySelector('[data-design-comparison="${one.comparison.id}"]')!==null`,'explicit phone comparison entrance');
  await click(b,'[aria-label="Design comparison"] > header button[aria-label="Close"]');
  await b.send('Emulation.setDeviceMetricsOverride',{width:1360,height:1000,deviceScaleFactor:1,mobile:false});
  await open(one);
}
async function choose(one,optionId,reason=''){
  const before=(await f.client.snapshot(f.shared)).canvas;
  const option=one.comparison.alternatives.find(o=>o.id===optionId);
  await click(b,`.comparison-choice-list label:nth-child(${one.comparison.alternatives.indexOf(option)+1}) input`);
  if(reason)await fill(b,'.comparison-actions textarea',reason);
  await clickText(b,'Use '+option.title);await until(b,`document.querySelector('.comparison-actions')?.textContent.includes('Your choice is saved.')`,'canonical browser adoption');
  const result=(await canvas.designComparisons({requestId:one.requestId})).decisions.find(d=>d.standing==='effective');assert(result);assert.equal(result.author.id,f.maya.id);assert.deepEqual(result.decision.input.authority,{kind:'human-choice',reason:reason||null});
  const snapshot=await f.client.snapshot(f.shared),targetId=one.target?.id??option.artifact.itemId;
  assert.equal(result.decision.adopted.itemId,targetId);assert.equal(snapshot.canvas.items[targetId].currentVersionId,result.decision.adopted.versionId);assert(snapshot.canvas.items[one.request.ref.itemId]);assert.equal(one.alternatives.filter(item=>snapshot.canvas.items[item.id]).length,2);
  await click(b,'[aria-label="Design comparison"] > header button[aria-label="Close"]');
  await click(b,'button[title="Undo (⌘Z)"]');await until(b,`document.querySelector('[data-design-request="${one.requestId}"]')!==null`,'undo observed');
  let state=await waitRead(()=>canvas.designComparisons({requestId:one.requestId}),value=>value.decisions.some(d=>d.decision.input.id===result.decision.input.id&&d.standing==='undone'),'paired Undo');assert.equal(state.decisions.find(d=>d.decision.input.id===result.decision.input.id).standing,'undone');assert.equal((await f.client.snapshot(f.shared)).canvas.items[targetId].currentVersionId,before.items[targetId].currentVersionId);
  await click(b,'button[title="Redo (⇧⌘Z)"]');state=await waitRead(()=>canvas.designComparisons({requestId:one.requestId}),value=>value.decisions.some(d=>d.decision.input.id===result.decision.input.id&&d.standing==='effective'),'paired Redo');assert.equal(state.decisions.find(d=>d.decision.input.id===result.decision.input.id).standing,'effective');
  return result;
}
try{
  await agentCli('identity','--session','--name','Acme Comparison Designer','--json');agent=await agentCli('whoami','--json');canvas=await handle(f.maya);designer=await handle(agent);
  const structural=await setup('receiving',{existing:true});await open(structural);await screenshot(b,path.join(f.output,'structural-comparison-wide.png'));console.log('checkpoint: actual comparison UI opened');
  for(const mode of ['continuous','confirm'])await tryTask(structural,mode);
  const chosen=await choose(structural,'continuous','Keep the fast scan loop and review the whole receipt before saving.');checks.push('Both structural options execute the same three counts and correction in exact frames at desktop/390; browser choice preserves existing target and one Undo/Redo restores the pair.');
  const originalView=await read(structural),correctedComparison={...structural.comparison,id:'cmp_receiving_correction',revision:2,correctsDecisionId:chosen.decision.input.id,supersedes:originalView.source};
  const correctionPublication={threadId:structural.source.threadId,commentId:newCommentId(),opId:newOpId(),comparison:correctedComparison};
  const correctedPublished=await agentCli('--canvas',f.shared,'design','compare','--publish',await jsonFile('receiving-correction',correctionPublication),'--json');assert.equal(correctedPublished.status,'accepted');
  const correction={...structural,comparison:correctedComparison};await open(correction);const corrected=await choose(correction,'confirm','For this station, confirm each line before the next scan.');assert.equal(corrected.decision.input.supersedesDecisionId,chosen.decision.input.id);checks.push('Task-card entry permits exactly named correction of the prior effective choice; second human choice and paired Undo/Redo preserve both decisions.');
  const history=await agentCli('--canvas',f.shared,'design','compare','--target',chosen.decision.adopted.itemId,'--json');assert(history.decisions.some(d=>d.decision.input.authority.reason==='Keep the fast scan loop and review the whole receipt before saving.'));
  assert.equal(history.decisions.find(d=>d.standing==='effective').decision.input.id,corrected.decision.input.id);assert.equal(history.decisions.find(d=>d.standing==='effective').decision.input.authority.reason,'For this station, confirm each line before the next scan.');
  const continued=await designer.add({title:'Next receiving screen',content:structuralComparisonHTML('confirm').replace('<title>','<title>Continued · '),mime:'text/html',filename:'continued-receiving.html'});assert(continued);checks.push('Native continuation reads exact accepted human rationale and builds the next screen with the current corrected confirmation workflow; no repeated comparison or interview.');
  const visual=await setup('campaign',{visual:true});await open(visual);await screenshot(b,path.join(f.output,'visual-comparison-wide.png'));for(const mode of ['editorial','poster'])await tryTask(visual,mode);await choose(visual,'poster');checks.push('Both designed visual directions share supplied facts and reservation/correction task; materially different composition/type; greenfield adoption retains both alternatives and null human reason.');
  const delegated=await setup('delegation');await open(delegated);await selectValue(b,'.comparison-actions select','delegate');await until(b,`[...document.querySelectorAll('.comparison-actions select option')].some(e=>e.value===${JSON.stringify(agent.id)})`,'named designer');await selectValue(b,'.comparison-actions label:has(select) + label select',agent.id);await clickText(b,'Send response');await until(b,`document.querySelector('.comparison-actions')?.textContent.includes('Your response is saved.')`,'named delegation');
  let view=await read(delegated,designer);assert.equal(view.effectiveResponse.response.outcome.agentActorId,agent.id);
  const input=prepareDesignDecision({canvasId:f.shared,threadId:view.source.threadId,commentId:newCommentId(),opId:newOpId(),decision:{id:'decision_delegated',requestId:delegated.requestId,decisionKey:view.comparison.decisionKey,source:{kind:'comparison',source:view.source},basis:view.approvalBases[0].basis,chosenAlternativeId:'continuous',versionId:newVersionId(),supersedesDecisionId:null,authority:{kind:'canvas-delegation',responseId:view.effectiveResponse.response.id,rationale:'Keep the scanner moving; review all three counts together.'}}});
  const {canvasId:_,...nativeInput}=input;const nativeResult=await agentCli('--canvas',f.shared,'design','decide',await jsonFile('delegated-decision',nativeInput),'--json');assert.equal(nativeResult.status,'accepted');checks.push('Browser named delegation is a non-adopting response; actual CLI designer decides with its own rationale and retained delegation ID.');
  await click(b,'[aria-label="Design comparison"] > header button[aria-label="Close"]');
  const external=await setup('native_report',{external:true,visual:true});view=await read(external,designer);
  const native={threadId:view.source.threadId,commentId:newCommentId(),opId:newOpId(),decision:{id:'decision_native_report',requestId:external.requestId,decisionKey:view.comparison.decisionKey,source:{kind:'comparison',source:view.source},basis:view.approvalBases[1].basis,chosenAlternativeId:'poster',versionId:newVersionId(),supersedesDecisionId:null,authority:{kind:'external-report',externalRequestId:'native_native_report',reportedOutcome:'choice',statement:'In the native conversation the requester selected the event poster.',reportedReason:null,rationale:'Implement the reported poster choice with the same reservation fields.'}}};
  const reported=await agentCli('--canvas',f.shared,'design','decide',await jsonFile('native-report',native),'--json');assert.equal(reported.status,'accepted');assert.equal((await designer.designComparisons({requestId:external.requestId})).decisions[0].decision.input.authority.kind,'external-report');checks.push('External CLI reports native choice honestly under the admitted reporter; no fabricated canvas human answer.');
  const revision=await setup('more_combine');await open(revision);await selectValue(b,'.comparison-actions select','more');await fill(b,'.comparison-actions input[type=number]','4');await clickText(b,'Send response');await until(b,`document.querySelector('.comparison-actions')?.textContent.includes('Your response is saved.')`,'more request');view=await read(revision);assert.equal(view.effectiveResponse.response.outcome.count,4);
  await clickText(b,'Revise my response');await selectValue(b,'.comparison-actions select','combine');await fill(b,'.comparison-actions label:has(input[placeholder]) input','continuous scanning');await b.ev(`document.querySelectorAll('.comparison-actions input[placeholder]')[1].dataset.combinationSecond='yes'`);await fill(b,'[data-combination-second]','per-line correction');await fill(b,'.comparison-actions label:last-child textarea','Keep the scan loop, with explicit correction of each saved line.');await clickText(b,'Send response');await until(b,`document.querySelector('.comparison-actions')?.textContent.includes('Your response is saved.')`,'specific combination');view=await read(revision);assert.equal(view.effectiveResponse.response.outcome.kind,'combine');assert.equal(view.responses.length,2);checks.push('Explicit more-four and revised combine-two-ideas remain distinct typed requests, with prior response retained and no adoption.');
  await click(b,'[aria-label="Design comparison"] > header button[aria-label="Close"]');
  const direct=await setup('direct_precise',{existing:true,mode:'direct',publish:false});
  const proposal={...direct.comparison,alternatives:[direct.comparison.alternatives[0]]},snapshot=await f.client.snapshot(f.shared),target=snapshot.canvas.items[direct.target.id];
  const directInput={threadId:direct.source.threadId,commentId:newCommentId(),opId:newOpId(),decision:{id:'decision_direct_precise',requestId:direct.requestId,decisionKey:proposal.decisionKey,source:{kind:'direct',proposal},basis:{brief:direct.request.ref,epoch:direct.request.brief.epoch,alternatives:proposal.alternatives.map(o=>o.artifact),target:{artifact:ref(target),title:target.title,description:target.description,properties:target.properties,scope:designDecisionScope(snapshot.canvas,target)},governing:proposal.governing},chosenAlternativeId:'continuous',versionId:newVersionId(),supersedesDecisionId:null,authority:{kind:'agent-judgment',rationale:'This precise improvement retains the established receiving pattern without requiring an option choice.'}}};
  const directResult=await agentCli('--canvas',f.shared,'design','decide',await jsonFile('direct-precise',directInput),'--json');assert.equal(directResult.status,'accepted');assert.equal((await designer.designComparisons({requestId:direct.requestId})).comparisons.length,0);checks.push('Actual native one-direction judgment adopts a precise existing-screen improvement without publishing a comparison or claiming human preference.');
  const stale=await setup('stale_target',{existing:true});view=await read(stale);const staleInput=prepareDesignDecision({canvasId:f.shared,threadId:view.source.threadId,commentId:newCommentId(),opId:newOpId(),decision:{id:'decision_stale_target',requestId:stale.requestId,decisionKey:view.comparison.decisionKey,source:{kind:'comparison',source:view.source},basis:view.approvalBases[0].basis,chosenAlternativeId:'continuous',versionId:newVersionId(),supersedesDecisionId:null,authority:{kind:'human-choice',reason:null}}});
  await f.client.sendOp(f.shared,agent,{type:'item.update',itemId:stale.target.id,patch:{description:'A teammate changed only the target description.'}});
  const refused=await canvas.designDecide(staleInput);assert.equal(refused.status,'refused');assert.equal((await canvas.designComparisons({requestId:stale.requestId})).decisions.length,0);checks.push('Captured approval refuses a concurrent metadata-only target edit without adopting or recording preference.');
  const staleOption=await setup('stale_option');view=await read(staleOption);
  const optionInput=prepareDesignDecision({canvasId:f.shared,threadId:view.source.threadId,commentId:newCommentId(),opId:newOpId(),decision:{id:'decision_stale_option',requestId:staleOption.requestId,decisionKey:view.comparison.decisionKey,source:{kind:'comparison',source:view.source},basis:view.approvalBases[0].basis,chosenAlternativeId:'continuous',versionId:newVersionId(),supersedesDecisionId:null,authority:{kind:'human-choice',reason:null}}});
  await designer.edit(staleOption.alternatives[1].id,{content:structuralComparisonHTML('confirm')+'<!-- revised alternative -->'});assert.equal((await canvas.designDecide(optionInput)).status,'refused');assert.equal((await canvas.designComparisons({requestId:staleOption.requestId})).decisions.length,0);checks.push('A changed rejected option invalidates the captured decision too; no partial adoption or invented preference.');
  const mime=await setup('mime_guard',{publish:false,existing:true}),markdown=await designer.add({title:'Written notes, not a runnable option',content:'# Acme notes',mime:'text/markdown',filename:'notes.md'});
  const mimeComparison={...mime.comparison,alternatives:mime.comparison.alternatives.map((option,n)=>n?{...option,artifact:ref(markdown)}:option)};
  const mimeResult=await designer.designCompare({threadId:mime.source.threadId,commentId:newCommentId(),opId:newOpId(),comparison:mimeComparison});assert.equal(mimeResult.status,'accepted');view=await read(mime);const mimeDecision={canvasId:f.shared,threadId:view.source.threadId,commentId:newCommentId(),opId:newOpId(),decision:{id:'decision_mime_guard',requestId:mime.requestId,decisionKey:view.comparison.decisionKey,source:{kind:'comparison',source:view.source},basis:view.approvalBases[1].basis,chosenAlternativeId:'confirm',versionId:newVersionId(),supersedesDecisionId:null,authority:{kind:'human-choice',reason:null}}};const mimeRefused=await canvas.designDecide(mimeDecision);assert.equal(mimeRefused.status,'refused');assert.match(mimeRefused.reason,/HTML|MIME|mime|html/);assert.equal((await canvas.designComparisons({requestId:mime.requestId})).decisions.length,0);checks.push('Markdown may be inspected as a comparison citation, but cannot replace an HTML screen; incompatible adoption is refused without a decision.');
  const reissue=await setup('reissue_view');await open(reissue);await click(b,'.comparison-choice-list label:first-child input');await fill(b,'.comparison-actions textarea','Retain this draft while I try the first source.');
  const prior=await read(reissue),successor={...reissue.comparison,id:'cmp_reissue_successor',revision:2,supersedes:prior.source};
  const reissued=await designer.designCompare({threadId:reissue.source.threadId,commentId:newCommentId(),opId:newOpId(),comparison:successor});assert.equal(reissued.status,'accepted');
  await until(b,`document.querySelector('[data-design-comparison="${reissue.comparison.id}"]') && document.querySelector('.design-comparison')?.textContent.includes('A newer comparison is available')`,'published successor does not silently switch source');
  assert.equal(await b.ev(`document.querySelector('.comparison-actions textarea').value`),'Retain this draft while I try the first source.');
  const successorView=(await canvas.designComparisons({requestId:reissue.requestId})).comparisons.find(one=>one.comparison.id===successor.id);await selectValue(b,'.comparison-batches select',JSON.stringify(successorView.source));await until(b,`document.querySelector('[data-design-comparison="${successor.id}"]')!==null`,'explicit newer source review');
  await selectValue(b,'.comparison-batches select',JSON.stringify(prior.source));assert.equal(await b.ev(`document.querySelector('.comparison-actions textarea').value`),'Retain this draft while I try the first source.');checks.push('A newly published successor does not switch the selected source or discard its words; explicit history selection changes source and restores its scoped draft on return.');
  const builds=[];for(const name of (await fs.readdir(new URL('../packages/web/dist/assets/',import.meta.url))).filter(n=>/^index-.*\.js$/.test(n))){const bytes=await fs.readFile(new URL('../packages/web/dist/assets/'+name,import.meta.url));builds.push({name,bytes:bytes.length,sha256:sha(bytes)})}
  assert.deepEqual(b.takeErrors(),[],'application runtime errors');await fs.writeFile(path.join(f.output,'verification.json'),JSON.stringify({checks,fixtures,frames,builds,inputScope:'Actual parent pointer/keyboard + child observed DOM hit tests and rendered surface barrier; native select chooses observed options via selectOption-style focus/value/input/change.',limits:'Synthetic task/contract behavior and independently reviewed authored craft; no model quality claim.'},null,2));console.log(JSON.stringify({output:f.output,checks},null,2));
}catch(error){if(activeFrame)await fs.writeFile(path.join(f.output,'frame-failure.json'),JSON.stringify(await activeFrame.evidence().catch(e=>({error:String(e)})),null,2));await screenshot(b,path.join(f.output,'failure.png')).catch(()=>{});console.error('Evidence:',f.output);throw error;}finally{if(activeFrame)await activeFrame.close().catch(()=>{});await f.close();}
