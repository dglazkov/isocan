// Run after npm run build: node --import ./index.mjs scripts/journey-recap.mjs
// Fresh synthetic home: real CLI, Context interactions, archive/restart and a failed head request.
import assert from 'node:assert/strict';
import path from 'node:path';
import { makeFixture, click, navigate, screenshot, until } from './lib/personal-journey-fixture.mjs';
const { canvasItemOf, designSystemProperties, formatRecapHead, sourcePolicyHeader } = await import('../packages/core/src/index.ts');
const { DaemonClient } = await import('../packages/api/src/client.ts');
const f=await makeFixture(), b=f.owner, source='prj_recap_library';
const sourceTitle='Acme reference library '+ '🪴'.repeat(170);
const secret=['SYNTHETIC_CHAT_BODY','SYNTHETIC_EXCLUDED_TITLE','SYNTHETIC_REMOVED_TITLE','SYNTHETIC_SOURCE_BYTES','SYNTHETIC_PERSONAL_HISTORY'];
const requests=[]; await b.send('Network.enable'); b.on('Network.requestWillBeSent',e=>requests.push(e.request));
const key=async(key,code,modifiers=0)=>{for(const type of ['keyDown','keyUp'])await b.send('Input.dispatchKeyEvent',{type,key,code,modifiers});};
const clickText=async(text)=>{
 const selector=await b.ev(`(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Missing '+${JSON.stringify(text)});e.dataset.journeyControl='selected';return '[data-journey-control=selected]'})()`);
 await click(b,selector); await b.ev(`document.querySelector('[data-journey-control=selected]')?.removeAttribute('data-journey-control')`);
};
const openContext=async()=>{
 await key('k','KeyK',4);await until(b,'document.querySelector(".palette-field")!==null','palette');
 await b.send('Input.insertText',{text:'Open Context'});await until(b,'document.querySelector(".palette-row")?.textContent.includes("Open Context")','Context action');await click(b,'.palette-row');
 await until(b,'document.querySelector(".context-view")!==null||document.querySelector(".ctx-layer")!==null','Context panel');
};
const recapSelector=`.ctx-recap[data-source-canvas="${source}"]`;
const recapText=()=>b.ev(`document.querySelector(${JSON.stringify(recapSelector)})?.textContent`);
const showRecap=()=>b.ev(`document.querySelector(${JSON.stringify(recapSelector)}).closest('.ctx-row').scrollIntoView({behavior:'instant',block:'start'})`);
const op=(id,operation,actor=f.maya)=>f.client.sendOp(id,actor,operation);
const note=async(id,itemId,title,properties={},content='SYNTHETIC_SOURCE_BYTES',at={x:0,y:0})=>{
 const blob=await f.client.uploadBlob(id,Buffer.from(content),'text/plain','reference.txt');
 await op(id,{type:'item.add',itemId,title,width:300,height:180,placement:at,properties,version:{...blob,id:'ver_'+itemId,mimeType:'text/plain',filename:'reference.txt'}});
};
const place=async(id,target,title,properties={})=>{
 const made=canvasItemOf(f.base,target),blob=await f.client.uploadBlob(f.shared,Buffer.from(made.blob),made.mimeType,made.filename);
 await op(f.shared,{type:'item.add',itemId:id,title,width:300,height:180,placement:{x:900,y:0},properties:{...made.properties,memory:'inherit',...properties},version:{...blob,id:'ver_'+id,mimeType:made.mimeType,filename:made.filename}});
};
let scoped;
try {
 await op(null,{type:'project.create',canvasId:source,title:sourceTitle,groupMode:'groups'});
 await note(source,'itm_recap_design','Reference design',designSystemProperties(),'# Acme design\nUse blue.');
 await note(source,'itm_recap_pin','Acme pinned reference',{context:'pinned'});
 for(let n=0;n<12;n++)await note(source,'itm_recap_'+n,'Acme visible '+n+(n===0?' '+ '🪴'.repeat(170):''));
 await note(source,'itm_recap_excluded',secret[1],{context:'excluded'});
 await note(source,'itm_recap_removed',secret[2]);
 const actors=[];
 for(let n=0;n<7;n++)actors.push((await op(null,{type:'actor.claim',sessionKey:'synthetic:recap-'+n,name:'Acme worker '+n+(n===0?' '+ '🪴'.repeat(170):''),harness:'synthetic'})).envelope.actor);
 for(let n=0;n<155;n++)await op(source,{type:'item.update',itemId:'itm_recap_'+(n%12),patch:{description:'Synthetic revision '+n}},actors[n%7]);
 await op(source,{type:'item.update',itemId:'itm_recap_excluded',patch:{description:'Excluded change'}});
 await op(source,{type:'item.delete',itemId:'itm_recap_removed'});
 await op(source,{type:'thread.create',threadId:'thr_recap_chat',x:0,y:0,anchorItemId:null,main:true,comment:{id:'cmt_recap_chat',body:secret[0]}});
 await note(f.shared,'itm_recap_local_design','Acme local design',designSystemProperties(),'# Local Acme design\nUse green.');
 const placed=await f.cli('canvas','place',source,'--inherit','--canvas',f.shared,'--json'); assert.equal(placed.inherit,true);
 // A saved request stays exactly the same while live Context later reads new history.
 await op(f.shared,{type:'thread.create',threadId:'thr_recap_frozen',x:0,y:0,anchorItemId:null,comment:{id:'cmt_recap_frozen',body:'Review this reference',contextRequest:{rootIds:[placed.itemId]}}});
 const frozen=await f.client.commentContext(f.shared,'thr_recap_frozen','cmt_recap_frozen');
 const personal=await f.client.ensurePersonal(f.maya.id), privateId=personal.source.canvasId;
 await note(privateId,'itm_recap_private_pin','Acme personal preference',{context:'pinned'},secret[4]);
 await f.client.linkPersonal(f.shared,{actorId:f.maya.id,requestId:'op_recap_personal_link'});
 await place('itm_recap_forged_private',privateId,'Copied private source');
 await place('itm_recap_excluded_edge',source,'Excluded inherited edge',{context:'excluded'});
 const foreign=canvasItemOf('http://foreign.invalid',source);
 await op(f.shared,{type:'item.update',itemId:'itm_recap_excluded_edge',patch:{properties:{...foreign.properties,memory:'inherit',context:'excluded'}}});
 scoped=new DaemonClient(f.base,f.clientHome,undefined,{policy:{mode:'exclude'},expectedHome:f.base});
 const before={source:await f.client.snapshot(source),destination:await f.client.snapshot(f.shared),log:await f.daemon.engine.getLog(f.shared)};
 const head=await scoped.recapHead(source), report=formatRecapHead(head.head);
 assert.equal(head.head.count,100);assert.equal(head.head.comments,1);assert.equal(head.head.actors.length,5);assert.equal(head.head.items.length,8);
 for(const field of ['earlierAvailableOps','actors','items','hiddenItems','clippedLabels'])assert(head.head.omitted[field]>0,'explicit omission '+field);
 assert.equal(Array.from(head.title).length,160);for(const word of secret)assert(!JSON.stringify(head).includes(word),'head leaked '+word);
 const cli=await f.cli('context','--canvas',f.shared,'--json');
 const pieces=cli.flatMap(layer=>layer.pieces), contribution=pieces.find(piece=>piece.recap?.canvasId===source);
 assert.deepEqual(contribution.recap,head);assert.equal(pieces.filter(piece=>piece.recap).length,1,'excluded and personal edges do not add history');
 assert(cli.find(layer=>layer.kind==='personal').pieces.every(piece=>!piece.recap));
 assert(pieces.some(piece=>piece.name==='Design system'&&piece.overridden),'local design still governs');
 assert((await f.cli('context','--canvas',f.shared)).includes(report));
 requests.length=0;await navigate(b,f.base+'/p/'+f.shared);await openContext();
 await until(b,`document.querySelector(${JSON.stringify(recapSelector)})?.textContent===${JSON.stringify(report)}`,'actual Recent work report');
 const recapRequests=requests.filter(r=>r.url.endsWith('/context/recap'));assert(recapRequests.length>0);assert(recapRequests.every(r=>r.url.includes('/'+source+'/')),'private/foreign edge requested a recap');
 for(const request of recapRequests)assert(Object.values(request.headers).includes(sourcePolicyHeader({policy:{mode:'exclude'},expectedHome:f.base})),'actual recap GET carries source policy');
 for(const word of secret)assert(!(await recapText()).includes(word));
 const line=await b.ev(`document.querySelector(${JSON.stringify(recapSelector)}).parentElement.textContent`);assert(line.includes(head.title),'visible recap source name');
 await showRecap();await screenshot(b,path.join(f.output,'recap-context-desktop.png'));
 assert.deepEqual(await f.client.commentContext(f.shared,'thr_recap_frozen','cmt_recap_frozen'),frozen);
 assert.deepEqual(await f.client.snapshot(source),before.source);assert.deepEqual(await f.client.snapshot(f.shared),before.destination);assert.deepEqual(await f.daemon.engine.getLog(f.shared),before.log);
 console.log('ACTUAL_CLI_WEB_TYPED_REPORT_BOUNDS_OMISSIONS_SOURCE_PRIVATE_EXCLUDED_FROZEN',true);
 const gc=await f.client.gc(source,{keepOps:3,graceMs:0});assert(gc.droppedEntries>100);assert.equal(gc.retainedEntries,3);assert.deepEqual(await scoped.recapHead(source),head);
 await f.restart(); assert.deepEqual(await scoped.recapHead(source),head);assert.deepEqual((await f.cli('context','--canvas',f.shared,'--json')).flatMap(layer=>layer.pieces).find(piece=>piece.recap?.canvasId===source).recap,head);
 await navigate(b,f.base+'/p/'+f.shared);await openContext();await until(b,`document.querySelector(${JSON.stringify(recapSelector)})?.textContent===${JSON.stringify(report)}`,'archived/restarted Recent work');
 console.log('ACTUAL_GC_ARCHIVE_RESTART_SAME_CLI_AND_BROWSER_HEAD',true);
 await click(b,'button[aria-label="Close the context view"]');
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await until(b,'document.querySelector(".phone-face")!==null','phone');
 const preference=await b.ev('JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.includes("panel"))))');
 await click(b,'button[aria-label="More canvas options"]');await clickText('Context');await until(b,`document.querySelector(${JSON.stringify(recapSelector)})?.textContent===${JSON.stringify(report)}`,'phone Recent work');
 const geometry=await b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(recapSelector)}),r=e.getBoundingClientRect();return {width:innerWidth,left:r.left,right:r.right,scroll:e.scrollWidth,client:e.clientWidth}})()`);assert(geometry.left>=0&&geometry.right<=geometry.width&&geometry.scroll<=geometry.client+1,'bounded phone report wraps');
 await showRecap();await screenshot(b,path.join(f.output,'recap-context-phone.png'));await click(b,'button[aria-label="Close the context view"]');assert.equal(await b.ev('JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.includes("panel"))))'),preference);
 console.log('ACTUAL_PHONE_CONTEXT_REPORT_WRAPS_NO_DESKTOP_PREF_WRITE',true);
 // Fail only the actual head GET. Source snapshot/design/pins must still render.
 let failures=0;b.on('Fetch.requestPaused',e=>{failures++;void b.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'ConnectionFailed'});});await b.send('Fetch.enable',{patterns:[{urlPattern:'*/context/recap',requestStage:'Request'}]});
 await click(b,'button[aria-label="More canvas options"]');await clickText('Context');
 await until(b,`[...document.querySelectorAll('.ctx-layer')].some(e=>e.textContent.includes('Recent work')&&e.textContent.includes('Failed to fetch'))`,'explicit head-only failure');
 assert(failures>0);assert.equal(await recapText(),undefined);
 const failedLayer=await b.ev(`[...document.querySelectorAll('.ctx-layer')].find(e=>e.textContent.includes('Recent work'))?.textContent`);assert(failedLayer.includes('Design system')&&failedLayer.includes("this canvas's wins")&&failedLayer.includes('Acme pinned reference'),'head failure retained readable design and pins');
 await b.ev(`[...document.querySelectorAll('.ctx-row')].find(e=>e.querySelector('.ctx-name')?.textContent==='Recent work')?.scrollIntoView({behavior:'instant',block:'center'})`);
 const failedGeometry=await b.ev(`(()=>{
  const row=[...document.querySelectorAll('.ctx-row')].find(e=>e.querySelector('.ctx-name')?.textContent==='Recent work');
  return ['.ctx-name','.ctx-size','.ctx-from','.ctx-why'].map(selector=>{
   const e=row.querySelector(selector),r=e.getBoundingClientRect();
   return {selector,text:e.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,scroll:e.scrollWidth,client:e.clientWidth};
  });
 })()`);
 for(const part of failedGeometry)assert(part.left>=0&&part.right<=part.width&&part.top>=56&&part.bottom<=part.height-60&&part.scroll<=part.client+1,'failed Recent work stays visible within phone sheet: '+JSON.stringify(part));
 assert.equal(failedGeometry.find(part=>part.selector==='.ctx-size').text,'not here');
 assert.equal(failedGeometry.find(part=>part.selector==='.ctx-why').text,'Failed to fetch');
 await screenshot(b,path.join(f.output,'recap-unavailable-phone.png'));await b.send('Fetch.disable');
 console.log('ACTUAL_HEAD_TRANSPORT_FAILURE_RETAINS_DESIGN_AND_PINS',true);
 // The injected failed network request is expected; JavaScript errors are not.
 assert.deepEqual(b.takeErrors(),[]);
 console.log('RECAP_BROWSER_CLI_PROOF_PASS');
} catch(error){console.log('FAIL_DOM',await b.ev('document.body.innerText.slice(-12000)'));await screenshot(b,path.join(f.output,'recap-failure.png'));throw error;}
finally{await f.close();console.log('RECAP_PROOF_ARTIFACTS',f.output);}
