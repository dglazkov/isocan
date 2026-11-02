import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {newOpId,newVersionId,workbenchItemPath} from '../../packages/core/src/index.ts';
import {prepareDesignRepair} from '../../packages/api/src/design-repair-reader.ts';
import {interruptReviewWrite} from './design-review-intake.mjs';
import {reviewClick} from './design-review-browser.mjs';
import {navigate,screenshot,until} from './personal-journey-fixture.mjs';
import {clickText} from './design-systems-browser.mjs';

/** Captured source and system drift refuse old work; exact Undo restores the earlier checked inputs. */
export async function reviewDrift({f,designer,agent,continuation,second,outputId,system,checks}) {
  const current=async()=>(await designer.designReview(undefined,'review_receiving')).runs[0];
  const before=(await f.client.snapshot(f.shared)).canvas.items[outputId],version=before.versions.find(v=>v.id===before.currentVersionId);
  const text=(await f.client.downloadBlob(f.shared,version.blobHash)).toString('utf8');
  const basis=await designer.designRepairBasis(outputId),prepared=await prepareDesignRepair({basis,text:text+'\n<!-- Explicit old repair draft -->',actorId:agent.id,opId:newOpId(),versionId:newVersionId(),repairId:'repair_old_output'});
  const other=await continuation.edit(outputId,{content:text+'\n<!-- A teammate changed the output -->',mime:'text/html'});
  const refusal=await designer.designRepairSubmit(prepared);assert.equal(refusal.status,'refused');assert.equal((await f.client.snapshot(f.shared)).canvas.items[outputId].currentVersionId,other.currentVersionId);assert.equal((await current()).status,'stale');
  await f.client.undo(f.shared,second);assert.equal((await current()).status,'current');
  const systemBefore=(await f.client.snapshot(f.shared)).canvas.items[system.id],sv=systemBefore.versions.find(v=>v.id===systemBefore.currentVersionId),systemText=(await f.client.downloadBlob(f.shared,sv.blobHash)).toString('utf8');
  const oldSystem=await designer.designRepairBasis(outputId),systemPrepared=await prepareDesignRepair({basis:oldSystem,text:text+'\n<!-- Repair captured before system change -->',actorId:prepared.actorId,opId:newOpId(),versionId:newVersionId(),repairId:'repair_old_system'});
  await continuation.edit(system.id,{content:systemText+'\nReview note: a teammate changed governing guidance.\n',mime:'text/markdown'});
  assert.equal((await current()).status,'stale');assert.equal((await designer.designRepairSubmit(systemPrepared)).status,'refused');
  await f.client.undo(f.shared,second);assert.equal((await current()).status,'current');
  checks.push('Actual output and governing-system edits invalidate evidence and refuse captured old repairs; each actor-owned Undo restores the original checked inputs without a new review budget.');
}

/** Existing Design check uses real CodeMirror edits and immutable retry IDs through HTTP503 and committed408. */
export async function reviewEditorRecovery({f,designer,checks}) {
  const b=f.owner,bad='<p style="padding:13px">Acme receiving count</p>',good='<p style="padding:16px">Acme receiving count</p>';
  const item=await designer.add({title:'Acme source repair recovery',content:bad,mime:'text/html',filename:'source-repair.html'});
  async function open(){await navigate(b,f.base+workbenchItemPath(f.shared,item.id));await until(b,`!!(document.querySelector('.stage-editor') || document.querySelector('button[title="Open the editor"]'))`,'source editor');if(!await b.ev(`!!document.querySelector('.stage-editor')`))await reviewClick(b,'button[title="Open the editor"]');await until(b,`document.querySelector('.design-lint-summary') && !document.querySelector('.design-lint')?.textContent.includes('Reading the original repair capture')`,'captured design check');}
  await b.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await open();
  await reviewClick(b,'[data-design-code="design/off-scale-spacing"] .design-lint-location');assert.equal(await b.ev('window.getSelection().toString()'),'13px');await b.send('Input.insertText',{text:'16px'});await until(b,`document.querySelector('.design-lint-summary')?.dataset.designFindings==='0'`,'exact draft source recheck');
  const fault=await interruptReviewWrite(b,'design.repair');await clickText(b,'Save repair');const pending=await fault.observed;await fault.close();await until(b,`document.querySelector('.design-lint-receipt')?.textContent.includes('awaiting confirmation')`,'persisted source repair');
  await b.send('Page.reload');await until(b,`[...document.querySelectorAll('.design-lint button')].some(e=>e.textContent==='Retry original repair'&&!e.disabled)`,'exact source retry after refresh');
  const lost=await interruptReviewWrite(b,'design.repair',{afterCommit:true});await clickText(b,'Retry original repair');await lost.observed;await lost.close();await until(b,`document.querySelector('.design-lint-receipt')?.textContent.includes('Repair saved as one operation')`,'canonical repair history recovers committed408');
  const snapshot=await f.client.snapshot(f.shared),saved=snapshot.canvas.items[item.id];assert.equal(saved.versions.length,item.versions.length+1);assert.equal((await f.client.downloadBlob(f.shared,saved.versions.find(v=>v.id===saved.currentVersionId).blobHash)).toString('utf8'),good);const log=await f.client.getLog(f.shared,0);assert.equal(typeof pending.opId,'string');assert(pending.opId.length>0);assert.equal(log.filter(e=>e.envelope.id===pending.opId).length,1);
  await fs.writeFile(path.join(f.output,'browser-repair-intent.json'),JSON.stringify(pending,null,2));await screenshot(b,path.join(f.output,'browser-repair-confirmed.png'));
  await navigate(b,`${f.base}/p/${f.shared}`);await reviewClick(b,'button[title="Undo (⌘Z)"]');const deadline=Date.now()+10000;while((await f.client.snapshot(f.shared)).canvas.items[item.id].currentVersionId!==item.currentVersionId){assert(Date.now()<deadline,'browser Undo restores original source');await new Promise(resolve=>setTimeout(resolve,40));}
  checks.push('Existing Design check: actual source selection/edit,503 refresh retry, committed408 full canonical repair recovery, one added version and one real browser Undo.');
}
