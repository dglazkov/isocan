import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {OPERATIONS_ROUTE} from '../../packages/api/src/index.ts';
import {newOpId,newCommentId,newVersionId} from '../../packages/core/src/index.ts';
import {click,navigate,screenshot,until} from './personal-journey-fixture.mjs';
import {clickText} from './design-systems-browser.mjs';
import {reviewFill as fill} from './design-review-browser.mjs';

/** The owned browser submits real source text, two consequential answers and one optional file control in the same batch. */
export async function reviewIntake(f,canvas,designer) {
  const b=f.owner,context=await canvas.add({title:'Acme product and brand',content:'Acme stockroom. Reuse evergreen controls and paper surfaces. Phone and desktop. Receiving and stock lookup are separate tasks.',mime:'text/markdown'});
  await navigate(b,`${f.base}/p/${f.shared}`);
  if(!await b.ev(`document.querySelector('.main-panel')!==null`)){await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'j',modifiers:4,windowsVirtualKeyCode:74});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'j',windowsVirtualKeyCode:74});}
  await until(b,`document.querySelector('[data-item-id="${context.id}"]')!==null`,'selected product context');
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'0',modifiers:4,windowsVirtualKeyCode:48});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'0',windowsVirtualKeyCode:48});
  await click(b,`[data-item-id="${context.id}"] .item-titlebar`);
  await fill(b,'.main-panel form .mention-field textarea','Build me an inventory app.');await click(b,'.main-panel button[title="Send (⌘⏎)"]');
  await until(b,`[...document.querySelectorAll('.main-design-ask')].some(e=>e.textContent==='Start design task')`,'source start action');await clickText(b,'Start design task');await clickText(b,'Start task');
  await until(b,`document.querySelector('[data-design-request]')!==null`,'admitted brief');
  let row=(await canvas.designBrief()).requests[0];assert(row.brief.context.entries.some(e=>e.itemId===context.id));assert.equal(row.nextAction,'clarify');
  const requestId=row.brief.requestId;
  const choice=(id,title,options)=>({id,title,consequence:id==='audience'?'This sets information density and touch targets.':'This determines the first screen and its primary action.',renderer:'choice-list',options:options.map(([id,title,consequence])=>({id,title,consequence})),multiple:false,skippable:true,delegatable:true});
  const questions={schemaVersion:1,kind:'questions',requestId,epoch:row.brief.epoch,id:'questions_review_receiving',revision:1,brief:row.ref,respondentActorId:f.maya.id,headline:'Two decisions, plus an optional sketch',inferredAnswers:[],questions:[choice('audience','Who uses this most?',[['warehouse','Warehouse staff','Large touch controls and short operational labels.'],['analysts','Stock analysts','Prioritize comparison and dense stock summaries.']]),choice('task','What must they finish quickly?',[['receive','Receive stock on a phone','Prioritize scanning, quantity entry and correction.'],['lookup','Look up stock','Prioritize search and stock availability.']]),{id:'sketch',title:'Optional: attach a sketch',consequence:'A sketch can clarify the boundary between receiving and lookup; you can proceed without one.',renderer:'upload',options:[],multiple:false,skippable:true,delegatable:false}],supersedes:null,discovery:{purpose:'initial',factBindings:[{questionId:'audience',factId:'audience'},{questionId:'task',factId:'primaryTask'},{questionId:'sketch',factId:'layout-reference'}]}};
  const asked=await designer.designAsk({questions,threadId:row.brief.source.threadId,commentId:newCommentId(),opId:newOpId()});assert.equal(asked.status,'accepted',JSON.stringify(asked));
  await until(b,`document.querySelector('[data-question-payload="${questions.id}"]')!==null`,'three controls in one initial batch');
  await click(b,'.q-choice-list input[value="analysts"]');await click(b,'.q-choice-list input[value="warehouse"]');await clickText(b,'Continue');await click(b,'.q-choice-list input[value="receive"]');await clickText(b,'Continue');
  const file=path.join(f.output,'receiving-sketch.svg');await fs.writeFile(file,'<svg xmlns="http://www.w3.org/2000/svg" width="420" height="240"><rect width="420" height="240" fill="#fffef9"/><path d="M210 20v200" stroke="#245844"/><text x="25" y="60">Receive stock</text><text x="235" y="60">Stock lookup</text><rect x="25" y="90" width="160" height="70" fill="none" stroke="#245844"/><text x="40" y="132">Scan / quantity</text></svg>');
  await b.send('Page.setInterceptFileChooserDialog',{enabled:true});const chooser=b.once('Page.fileChooserOpened');await click(b,'.q-upload-area input[type=file]');const opened=await chooser;await b.send('DOM.setFileInputFiles',{files:[file],backendNodeId:opened.backendNodeId});
  await until(b,`document.querySelector('.q-upload-row [role=status]')?.textContent==='Uploaded'`,'acknowledged upload');await until(b,`document.querySelector('.q-reference-preview img')?.naturalWidth>0`,'visible sketch thumbnail');
  await designer.notify('Progress: I am reading the existing Acme context. The design questions remain open.');
  assert.equal((await designer.designQuestions({requestId}))[0].status,'open');
  await b.send('Page.reload');await until(b,`document.querySelector('.q-upload-row [role=status]')?.textContent==='Uploaded'`,'per-question upload draft survives refresh');
  const fault=await interruptReviewWrite(b,'questionnaire.answer');await clickText(b,'Submit answers');const interrupted=await fault.observed;await fault.close();
  await until(b,`document.querySelector('.q-error')?.textContent.includes('Synthetic')`,'answer failure retains draft');await b.send('Page.reload');await until(b,`[...document.querySelectorAll('button')].some(e=>e.textContent==='Retry submission')`,'saved exact submission');await clickText(b,'Retry submission');await until(b,`!document.querySelector('[data-question-payload="${questions.id}"]')`,'one accepted answer');
  const saved=(await designer.designQuestions({requestId}))[0];assert.equal(saved.responses.length,1);assert.equal(saved.responses[0].response.id,interrupted.op.response.id);
  const attachment=saved.resolutions.flatMap(r=>r.state==='answered'&&r.value.kind==='references'?r.value.references:[]).find(r=>r.artifact);assert(attachment);
  const exact=await designer.designReference({threadId:saved.source.threadId,commentId:saved.responses[0].commentId,referenceId:attachment.id});assert.deepEqual(Buffer.from(exact.bytes),await fs.readFile(file));
  const latest=(await designer.designBrief({requestId})).requests[0];
  const reconciled=await designer.designChange({opId:newOpId(),action:{kind:'update',brief:latest.ref,epoch:latest.brief.epoch,versionId:newVersionId(),acceptedResponses:latest.reconciliation,patch:{audience:'Warehouse staff',primaryTask:'Receive and correct stock on a phone',constraints:['Use the supplied Acme evergreen controls and paper surfaces','Support phone390 and desktop1280','Keep receiving separate from stock lookup'],references:[{id:'sketch-reference',state:'fetched',artifact:attachment.artifact,reason:'Exact SVG inspected: receiving and stock lookup occupy separate halves.'}]}}});assert.equal(reconciled.status,'accepted',JSON.stringify(reconciled));
  row=(await designer.designBrief({requestId})).requests[0];assert.equal(row.remainingInitialQuestions,0);assert.equal(row.brief.continuation.acceptedResponses.length,1);
  await screenshot(b,path.join(f.output,'scene1-2-context-answer.png'));
  return {row,context,attachment,questionSource:saved.source,submission:interrupted.op.response.id};
}

/** One real transport interruption is observed before retry; state-changing controls are never clicked twice blindly. */
export async function interruptReviewWrite(b,type,{afterCommit=false}={}) {
  let captured,resolve,reject;const observed=new Promise((yes,no)=>{resolve=yes;reject=no});const timer=setTimeout(()=>reject(Error('Armed write did not arrive')),15000);
  const off=b.on('Fetch.requestPaused',event=>{void(async()=>{let body;try{body=JSON.parse(event.request.postData??'{}')}catch{body={}}if(captured||body.op?.type!==type||afterCommit&&event.responseStatusCode!==200)return b.send('Fetch.continueRequest',{requestId:event.requestId});captured=body;await b.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:afterCommit?408:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({error:'Synthetic interrupted design acknowledgement'})).toString('base64')});clearTimeout(timer);resolve(body)})().catch(reject)});
  await b.send('Fetch.enable',{patterns:[{urlPattern:`*${OPERATIONS_ROUTE}`,requestStage:afterCommit?'Response':'Request'}]});
  return {observed,close:async()=>{clearTimeout(timer);await b.send('Fetch.disable');off()}};
}
