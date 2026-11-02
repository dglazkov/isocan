#!/usr/bin/env node
/** Real Chrome + owned daemon proof. Run `node --import tsx scripts/journey-design-request.mjs` after npm run build.
 * Scripted synthetic collaborators prove routing and actual task behavior, not model-generated craft quality.
 */
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { newOpId, workbenchItemPath } from '../packages/core/src/index.ts';
import { CanvasHandle } from '../packages/api/src/connect.ts';
import { makeFixture, click, navigate, screenshot } from './lib/personal-journey-fixture.mjs';
import { browser, until } from './lib/browser.mjs';
import { receivingHtml, startReceivingRuntime } from './lib/design-request-runtime.mjs';
const f = await makeFixture({contentPort:0}), b = f.owner, runtime = await startReceivingRuntime();
const checks = [], materials = [];
const key = async(name,code) => { await b.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:name,windowsVirtualKeyCode:code}); await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:name,windowsVirtualKeyCode:code}); };
async function clickText(text, scope='button') {
  await until(b, `[...document.querySelectorAll(${JSON.stringify(scope)})].some(e=>e.textContent.trim()===${JSON.stringify(text)})`, text);
  await b.ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(scope)})].find(e=>e.textContent.trim()===${JSON.stringify(text)});e.dataset.designJourney='target';return true})()`);
  try { await click(b,'[data-design-journey="target"]'); } finally { await b.ev(`document.querySelector('[data-design-journey]')?.removeAttribute('data-design-journey')`); }
}
async function fill(selector,text, target=b) { await click(target,selector); if(!await target.ev(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`)) await click(target,selector); await until(target,`document.activeElement===document.querySelector(${JSON.stringify(selector)})`,'focus '+selector); if(await target.ev(`document.querySelector(${JSON.stringify(selector)}).value!==''`)) await target.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',commands:['selectAll']}); await target.send('Input.insertText',{text}); }
async function fillLabel(label,text,scope='.design-task-panel') {
  await b.ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(scope+' label')})].find(e=>e.textContent.trim().startsWith(${JSON.stringify(label)}))?.querySelector('input,textarea');if(!e)throw Error('Missing '+${JSON.stringify(label)});e.dataset.designJourney='field';return true})()`);
  try { await fill('[data-design-journey="field"]',text); } finally { await b.ev(`document.querySelector('[data-design-journey]')?.removeAttribute('data-design-journey')`); }
}
const handle = async (id,actor=f.maya,harness='web') => new CanvasHandle({client:f.client,actor,home:f.clientHome,harness,birthHome:null,binding:null,homeOf:async()=>null},(await f.client.snapshot(id)).project);
const current = async(canvas,requestId) => (await canvas.designBrief({requestId})).requests[0];
const ref = (id,item) => { const v=item.versions.find(v=>v.id===item.currentVersionId);return {home:f.base,canvasId:id,itemId:item.id,versionId:v.id,blobHash:v.blobHash}; };
const fields = {intent:'create',fidelity:'designed',delivery:'html-node',targetItemId:null,groupId:null,audience:null,primaryTask:null,constraints:[],facts:[],references:[],outstandingDecisionIds:[],outputIds:[]};
async function act(canvas,row,kind,extra={}) { const result=await canvas.designChange({opId:newOpId(),action:{kind,brief:row.ref,epoch:row.brief.epoch,versionId:`ver_${crypto.randomUUID()}`,...extra}});assert.equal(result.status,'accepted',JSON.stringify(result));return current(canvas,row.brief.requestId); }
async function runtimeWalk(target,url,label) {
  await navigate(target,url);
  await until(target,`document.querySelector('#lines')?.textContent.includes('No items')`,'empty receipt');
  await click(target,'#add'); await until(target,`document.querySelector('#error').textContent.includes('at least 1')`,'empty quantity validation');
  await fill('#quantity','-1',target); await click(target,'#add'); await until(target,`document.querySelector('#error').textContent.includes('at least 1')`,'negative validation');
  await fill('#quantity','12',target); await click(target,'#add'); await until(target,`document.querySelector('#lines').textContent.includes('12 received')`,'received stock');
  await click(target,'#save'); await until(target,`document.querySelector('#success').textContent.includes('Receipt saved')`,'saved receipt');
  await click(target,'.line button'); await fill('#quantity','10',target); await click(target,'#add'); await until(target,`document.querySelector('#success').textContent.includes('Correction saved')`,'correction saved');
  await click(target,'#save'); await until(target,`document.querySelector('#success').textContent.includes('Receipt saved')`,'repeat save');
  for(const width of [390,1280]) { await target.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});assert.equal(await target.ev('document.documentElement.scrollWidth>innerWidth'),false,`${label} no overflow ${width}`);await screenshot(target,path.join(f.output,`${label}-${width}.png`)); }
  checks.push(`${label}: empty, invalid, receive12, save, correct10, re-save, phone390/desktop1280`);
}
try {
  const canvas = await handle(f.shared);const workflow=await f.cli('--canvas',f.shared,'design','workflow','--json');assert(workflow.procedure.includes('zero to three'));
  const context = await canvas.add({title:'Acme product context',content:'Acme stockroom brand: use the existing green control treatment. Support phones and desktop; no new palette.',mime:'text/markdown'});
  // The existing real source message captures selection. Starting the task is one separate visible act.
  await canvas.notify('Acme design workspace ready.');
  await navigate(b,`${f.base}/p/${f.shared}`);
  await until(b,`document.querySelector('[data-item-id="${context.id}"]')!==null`,'context loaded in current canvas');
  if(!await b.ev(`document.querySelector('.main-panel')!==null`)) { await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'j',modifiers:4,windowsVirtualKeyCode:74});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'j',windowsVirtualKeyCode:74}); }await until(b,`document.querySelector('.main-panel')!==null`,'canvas chat ready');
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'0',modifiers:4,windowsVirtualKeyCode:48});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'0',windowsVirtualKeyCode:48});
  await until(b,`(()=>{const e=document.querySelector('[data-item-id="${context.id}"] .item-titlebar');if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))})()`,'initial canvas fit and hit target');
  await click(b,`[data-item-id="${context.id}"] .item-titlebar`);
  await fill('.main-panel form .mention-field textarea','Build me an inventory app.');
  await click(b,'.main-panel button[title="Send (⌘⏎)"]');
  await until(b,`[...document.querySelectorAll('.main-comment-body')].some(e=>e.textContent.includes('Build me an inventory app.')) || document.querySelector('.main-panel')?.textContent.includes('Build me an inventory app.')`,'real sparse source message');
  await b.ev(`(()=>{const e=[...document.querySelectorAll('.main-design-ask')].filter(e=>e.textContent==='Start design task').at(-1);if(!e)throw Error('No design start');e.dataset.designJourney='start';return true})()`);
  await click(b,'[data-design-journey="start"]');if(!await b.ev(`document.querySelector('[aria-label="Start a design task"]')!==null`)) await click(b,'[data-design-journey="start"]');await fs.writeFile(path.join(f.output,'source-context.json'),JSON.stringify((await f.client.snapshot(f.shared)).canvas.threads,null,2));await clickText('Start task');
  await until(b,`document.querySelector('[data-design-request]')!==null`,'canonical task card');
  let row = (await canvas.designBrief()).requests[0]; assert(row);const requestId=row.brief.requestId;
  assert.equal(row.nextAction,'clarify');assert.equal(row.brief.audience,null);assert.equal(row.brief.requestingActorId,f.maya.id);assert(row.brief.context.entries.some(e=>e.itemId===context.id));
  await screenshot(b,path.join(f.output,'sparse-canvas-task.png'));
  const cliStart = await f.cli('--canvas',f.shared,'design','brief',requestId,'--json');assert.equal(cliStart.requests[0].ref.versionId,row.ref.versionId);checks.push('canvas message → explicit task; exact CLI read; selected context; no mandatory long form');
  await f.client.claimActor({type:'actor.claim',sessionKey:'codex:design-request-journey',name:'Acme Designer'});
  const agent=(await f.client.actorBindings(['codex:design-request-journey']))[0].actor;
  const agentCanvas=await handle(f.shared,agent,'codex');
  const q=(id,title)=>({id,title,consequence:'This changes the primary receiving interaction.',renderer:'freeform',options:[],multiple:false,skippable:true,delegatable:true});
  const questions={schemaVersion:1,kind:'questions',requestId,epoch:row.brief.epoch,id:'questions_receiving',revision:1,brief:row.ref,respondentActorId:f.maya.id,headline:'Two decisions for receiving',inferredAnswers:[],questions:[q('audience','Who uses this most?'),q('task','What must they finish quickly?')],supersedes:null,discovery:{purpose:'initial',factBindings:[{questionId:'audience',factId:'audience'},{questionId:'task',factId:'primaryTask'}]}};
  const asked=await agentCanvas.designAsk({questions,threadId:row.brief.source.threadId,commentId:'comment_questions_receiving',opId:'op_questions_receiving'});assert.equal(asked.status,'accepted',JSON.stringify(asked));
  await until(b,`document.querySelector('[data-question-payload="questions_receiving"]')!==null`,'named human questionnaire');
  await fill('.q-textarea','Warehouse staff');await clickText('Continue');await fill('.q-textarea','Receive and correct stock on a phone');await clickText('Submit answers');
  await until(b,`!document.querySelector('[data-question-payload="questions_receiving"]')`,'settled answers');
  await clickText('Continue from answers…');
  await fillLabel('Audience','Warehouse staff','form[aria-label="Continue from design answers"]');await fillLabel('Main task','Receive and correct stock on a phone','form[aria-label="Continue from design answers"]');await fillLabel('Constraints','Use existing green controls\nSupport phone and desktop','form[aria-label="Continue from design answers"]');await clickText('Save brief and continue');
  await until(b,`!document.querySelector('form[aria-label="Continue from design answers"]')`,'explicit reconciliation');
  row=await current(canvas,requestId);assert.equal(row.brief.audience,'Warehouse staff');assert.equal(row.brief.continuation.acceptedResponses.length,1);assert.equal(row.remainingInitialQuestions,0);
  row=await act(agentCanvas,row,'resume',{reason:'External collaborator continues the saved request.'});assert.equal(row.brief.audience,'Warehouse staff');assert.equal(row.brief.continuation.acceptedResponses.length,1);assert.equal(row.nextAction,'build');checks.push('two missing questions; human answers; explicit brief reconciliation; external continuation with no repeated initial interview');
  // Native external intake is reported by the actual agent, while material facts converge.
  const extId='prj_design_external';await f.client.sendOp(null,f.maya,{type:'project.create',canvasId:extId,title:'Acme external task',groupMode:'groups'});
  const external=await handle(extId,agent,'codex');const externalContext=await external.add({title:context.title,content:'Acme stockroom brand: use the existing green control treatment. Support phones and desktop; no new palette.',mime:'text/markdown'});
  const externalStart=await external.designStart({opId:'op_external_start',action:{kind:'start',admission:'explicit',requestId:'request_external',itemId:'item_external_brief',versionId:'ver_external_start',source:{entrance:'external-agent',externalRequestId:'Acme inventory request'},contextRequest:{rootIds:[externalContext.id]},fields:{...fields,constraints:row.brief.constraints}}});assert.equal(externalStart.status,'accepted',JSON.stringify(externalStart));
  let erow=await current(external,'request_external');assert.equal(erow.nextAction,'clarify');
  erow=await act(external,erow,'update',{patch:{audience:row.brief.audience,primaryTask:row.brief.primaryTask}});
  assert.equal(erow.brief.requestingActorId,agent.id);assert(erow.brief.continuation.factProvenance.filter(p=>['audience','primaryTask'].includes(p.field)).every(p=>p.kind==='reported'));
  materials.push({entrance:'canvas-chat',audience:row.brief.audience,task:row.brief.primaryTask,delivery:row.brief.delivery,constraints:row.brief.constraints,contextTitles:row.brief.context.entries.map(e=>e.title)},{entrance:'external-agent',audience:erow.brief.audience,task:erow.brief.primaryTask,delivery:erow.brief.delivery,constraints:erow.brief.constraints,contextTitles:erow.brief.context.entries.map(e=>e.title)});assert.deepEqual({...materials[0],entrance:null},{...materials[1],entrance:null});checks.push('sparse external request converges on same facts with honest agent-reported provenance');
  const html=receivingHtml(), native=await canvas.add({title:'Acme receiving',content:html,mime:'text/html'}), extOutput=await external.add({title:'Acme receiving',content:html,mime:'text/html'});
  const taskBrowser=await browser();f.extraBrowsers.push(taskBrowser);
  const nativeRef=ref(f.shared,native);
  async function savedRuntimeUrl(canvasId,itemId,hash) { await navigate(b,f.base+workbenchItemPath(canvasId,itemId));await until(b,`[...document.querySelectorAll('iframe')].some(e=>e.src.includes(${JSON.stringify(hash)}))`,'actual saved renderer URL');const source=await b.ev(`[...document.querySelectorAll('iframe')].find(e=>e.src.includes(${JSON.stringify(hash)})).src`);assert.notEqual(new URL(source).origin,f.base,'actual split content origin');return source; }
  await runtimeWalk(taskBrowser,await savedRuntimeUrl(f.shared,native.id,nativeRef.blobHash),'native');
  const externalTaskBrowser=await browser();f.extraBrowsers.push(externalTaskBrowser);await runtimeWalk(externalTaskBrowser,await savedRuntimeUrl(extId,extOutput.id,ref(extId,extOutput).blobHash),'external-native');
  row=await act(agentCanvas,row,'complete',{patch:{outputIds:[native.id]}});erow=await act(external,erow,'complete',{patch:{outputIds:[extOutput.id]}});
  // No available browser report stays a draft through the actual browser publication UI.
  await navigate(b,`${f.base}/p/${f.shared}`);await clickText('Publish evidence…');await clickText('Publish receipt');
  await until(b,`!document.querySelector('form[aria-label="Publish design evidence"]')`,'unverified receipt publication');
  row=await current(canvas,requestId);assert.equal(row.receipts[0].receipt.status,'draft');assert.equal(row.receipts[0].receipt.checks[0].result,'unavailable');checks.push('browser unavailable → attributed unverified draft');
  await navigate(b,f.base+workbenchItemPath(f.shared,row.receipts[0].ref.itemId));await until(b,`document.querySelector('.design-record-face h4')?.textContent==='Unverified draft'`,'actual receipt face currentness');
  await canvas.edit(native.id,{content:html.replace('Add the quantities','Carefully add the quantities'),mime:'text/html'});await until(b,`document.querySelector('.design-record-face h4')?.textContent==='Evidence needs refreshing'`,'receipt face observes concurrent output edit');await screenshot(b,path.join(f.output,'receipt-face-drift.png'));checks.push('actual receipt face refreshes stale output without receipt-version change');await navigate(b,`${f.base}/p/${f.shared}`);
  // Real concurrent edit while reports are open must never retarget an old observation.
  await clickText('Publish evidence…');await until(b,`document.querySelector('form[aria-label="Publish design evidence"]')!==null`,'evidence editor');
  const capturedOutput=(await f.client.snapshot(f.shared)).canvas.items[native.id].currentVersionId;await canvas.edit(native.id,{content:html.replace('Add the quantities','Record the quantities'),mime:'text/html'});
  await until(b,`document.querySelector('form[aria-label="Publish design evidence"]')?.textContent.includes('changed after this draft began')`,'concurrent output edit warns');
  assert.equal(await b.ev(`[...document.querySelectorAll('form[aria-label="Publish design evidence"] button')].find(e=>e.textContent==='Publish receipt').disabled`),true);
  const stored=await b.ev(`JSON.parse(Object.entries(localStorage).find(([key])=>key.startsWith('isocan.design.receipt.v2:'))[1])`);assert.equal(stored.output.versionId,capturedOutput);await click(b,'form[aria-label="Publish design evidence"] h4');await screenshot(b,path.join(f.output,'receipt-concurrent-edit.png'));checks.push('open receipt retains original output version and blocks concurrent-edit publication');
  await clickText('Close','form[aria-label="Publish design evidence"] button');
  // Precise edits and ordinary JSON/HTML imports leave the existing enrollment count unchanged.
  const count=(await canvas.designBrief()).requests.length;await canvas.add({title:'Acme imported HTML archive',content:'<!doctype html><html><title>Acme imported archive</title><h1>Previously designed stock report</h1></html>',mime:'text/html'});assert.equal((await canvas.designBrief()).requests.length,count);checks.push('precise output edit and ordinary HTML import do not start an interview or admit a new request');
  const beforeCancel=await current(canvas,requestId);await clickText('Cancel task',`[data-design-request="${requestId}"] footer button`);await fillLabel('Reason','Pause this synthetic task');await clickText('Cancel task',`[data-design-request="${requestId}"] form button`);await until(b,`document.querySelector('[data-design-request="${requestId}"] .design-task-status')?.textContent==='Cancelled'`,'typed cancellation');
  const stale=await agentCanvas.designChange({opId:newOpId(),action:{kind:'complete',brief:beforeCancel.ref,epoch:beforeCancel.brief.epoch,versionId:'ver_stale_complete'}});assert.equal(stale.status,'refused');await click(b,'button[title="Undo (⌘Z)"]');await until(b,`document.querySelector('[data-design-request="${requestId}"] .design-task-status')?.textContent==='Task completed'`,'one undo restores completed task');assert.equal((await current(canvas,requestId)).ref.versionId,beforeCancel.ref.versionId);
  await f.client.sendOp(f.shared,f.maya,{type:'thread.reply',threadId:beforeCancel.brief.source.threadId,comment:{id:'cmt_literal_cancel',body:'/cancel'}});assert.equal((await current(canvas,requestId)).status,'cancelled');checks.push('typed cancel refuses stale completion; one undo restores prior version; literal requester cancel blocks work');
  // Connected delivery exercises actual stock fetch and receipt create/read/update APIs.
  const connected=await browser();f.extraBrowsers.push(connected);await runtimeWalk(connected,runtime.url+'/','connected');assert.equal(runtime.receipts.size,1);assert.equal([...runtime.receipts.values()][0].lines[0].quantity,10);assert(runtime.events.some(e=>e.method==='GET'&&e.path.startsWith('/warehouse/receipts/')));
  const connStart=await external.designStart({opId:'op_connected_start',action:{kind:'start',admission:'explicit',requestId:'request_connected',itemId:'item_connected_brief',versionId:'ver_connected_start',source:{entrance:'external-agent',externalRequestId:'Acme connected receiving'},fields:{...fields,delivery:'connected-app',audience:row.brief.audience,primaryTask:row.brief.primaryTask}}});assert.equal(connStart.status,'accepted',JSON.stringify(connStart));
  let crow=await current(external,'request_connected');crow=await act(external,crow,'complete');
  const shot=await external.add({title:'Acme receiving browser evidence',content:await fs.readFile(path.join(f.output,'connected-390.png')),mime:'image/png'});
  const receipt={schemaVersion:1,kind:'receipt',id:'receipt_connected',requestId:crow.brief.requestId,epoch:crow.brief.epoch,brief:crow.ref,output:{kind:'repository',repository:'synthetic:acme-receiving',revision:runtime.revision,buildId:runtime.buildId,runtimeUrl:runtime.url+'/'},context:crow.contextReferences,governing:crow.governingBinding,fidelity:'designed',status:'draft',checks:[{id:'check_connected_browser',kind:'browser-task',tool:'Chrome CDP journey',toolVersion:(await connected.send('Browser.getVersion')).product,result:'passed',coverage:'Empty, validation, receive12, save, correct10, re-save; phone390 and desktop1280.',state:'One saved receipt contains quantity10',viewport:{width:390,height:844},evidence:[ref(extId,shot)]}],unresolved:[{severity:'noncritical',description:'Synthetic loopback runtime; production persistence and source/craft review are outside this report.'}]};
  const published=await external.designPublishReceipt({opId:'op_connected_receipt',itemId:'item_connected_receipt',versionId:'ver_connected_receipt',receipt});assert.equal(published.status,'accepted',JSON.stringify(published));
  crow=await current(external,'request_connected');assert.equal(crow.receipts[0].receipt.output.buildId,runtime.buildId);checks.push('connected receipt identifies complete runtime implementation hash, build, URL, Chrome and exact screenshot');
  await navigate(b,`${f.base}/p/${extId}`);await until(b,`document.querySelector('[data-design-request="request_connected"]')!==null`,'external task visible in canvas');
  await screenshot(b,path.join(f.output,'external-task-receipt.png'));
  const errors=[...b.takeErrors(),...taskBrowser.takeErrors(),...connected.takeErrors(),...externalTaskBrowser.takeErrors()];assert.deepEqual(errors,[],'actual Chrome has no script errors');
  await fs.writeFile(path.join(f.output,'proof.json'),JSON.stringify({checks,materials,runtime:{revision:runtime.revision,buildId:runtime.buildId,url:runtime.url,events:runtime.events},browser:await b.send('Browser.getVersion')},null,2));
  console.log(JSON.stringify({ok:true,output:f.output,checks},null,2));
} catch(error) {await screenshot(b,path.join(f.output,'failure.png')).catch(()=>{});console.error('Design request journey evidence:',f.output);console.error(await b.ev(`JSON.stringify({focus:document.activeElement?.tagName,body:document.body.textContent.slice(-3000)})`));throw error;}
finally {await runtime.close();await f.close();}
