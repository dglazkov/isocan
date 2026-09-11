/** Real browser acceptance for Markdown attention (#236).
 * Run `npm run build` then `node scripts/check-text-selection.mjs [output-directory]`.
 * Own daemon, synthetic canvas, isolated browsers and a temporary CLI identity;
 * never reaches a person's canvas. The receiving browser is read-only.
 * Emits measured results and a screenshot; always reaps browsers and daemon.
 */
import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const root=fileURLToPath(new URL('../', import.meta.url));
const output=process.argv[2] ?? tmpdir();
const require=createRequire(root+'/package.json');
const {register}=await import(require.resolve('tsx/esm/api'));register();
const {startDaemon}=await import(root+'/packages/server/src/daemon.ts');
const {browser,throughTheDoor,until}=await import(root+'/scripts/lib/browser.mjs');
const home=await mkdtemp(tmpdir()+'/isocan-text-browser-');
const daemon=await startDaemon({port:0,contentPort:0,home});
const origin='http://127.0.0.1:'+daemon.app.server.address().port;
const clients=[];
const report={};
try{
 for(const [name,width] of [['Taylor',1200],['Morgan',900]]){
  const b=await browser();clients.push(b);
  await b.send('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:false});
  const loaded=b.once('Page.loadEventFired');await b.send('Page.navigate',{url:origin});await loaded;
  await throughTheDoor(b,origin,name,name);
 }
 const [a,b]=clients;
 const source='# Acme review\n\nRead **this sentence** with [the linked plan](https://example.com) and 🐏.\n\n## Decisions\n\n| Area | Choice |\n| --- | --- |\n| Reading | Keep the file |\n\n'+('A paragraph about reviewing a document together. '.repeat(30));
 report.fixture=await a.ev(`(async()=>{const actor=JSON.parse(localStorage.getItem('isocan.identity'));const post=async(op,canvasId=null)=>{const r=await fetch('/api/ops',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actor,clientId:'fixture',canvasId,op})});if(!r.ok)throw Error(await r.text());return r.json();};await post({type:'project.create',canvasId:'prj_attention',title:'Acme review'});const r=await fetch('/api/projects/prj_attention/blobs',{method:'POST',headers:{'Content-Type':'text/markdown'},body:${JSON.stringify(source)}});if(!r.ok)throw Error(await r.text());const blob=await r.json();await post({type:'item.add',itemId:'itm_document',title:'Review notes',version:{id:'ver_original',blobHash:blob.blobHash,mimeType:'text/markdown',filename:'review.md',size:blob.size},width:520,height:550,placement:{x:100,y:100}},'prj_attention');return {blobHash:blob.blobHash};})()`);
 // Morgan has a separate badge admitted only to read.
 await a.ev(`(async()=>{const actor=JSON.parse(localStorage.getItem('isocan.identity'));const {grants}=await (await fetch('/api/projects/prj_attention/grants')).json();for(const g of grants){if(g.subject==='link'){const r=await fetch('/api/projects/prj_attention/grants/'+g.id,{method:'DELETE'});if(!r.ok)throw Error(await r.text());}}const r=await fetch('/api/projects/prj_attention/grants',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject:'link',capability:'read',actorId:actor.id})});if(!r.ok)throw Error(await r.text());})()`);
 for(const c of clients){const loaded=c.once('Page.loadEventFired');await c.send('Page.navigate',{url:origin+'/p/prj_attention'});await loaded;await until(c,`!!document.querySelector('.item-read')`,'Read control',15000);
  // Real input hit-testing, rather than invoking a handler through inert content.
  const box=await c.ev(`(()=>{const r=document.querySelector('.item-read').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box});
  await until(c,`!!document.querySelector('.item.entered .markdown-text strong')`,'entered document',15000);
 }
 const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('ISOCAN_'))delete env[key];
 Object.assign(env,{ISOCAN_HOME:home+'/cli',ISOCAN_DIRECT:origin,ISOCAN_PORT:String(daemon.app.server.address().port),ISOCAN_SESSION_ID:'markdown-proof-casey',ISOCAN_HARNESS:'test'});
 const cli=(...args)=>promisify(execFile)(process.execPath,[root+'/packages/cli/bin/isocan.js',...args],{env,cwd:home,timeout:15000});
 const {writeBadge}=await import(root+'/packages/server/src/badge-store.ts');
 const {parseBadgeToken}=await import(root+'/packages/core/src/badge.ts');
 const {cookies}=await a.send('Network.getCookies',{urls:[origin]});
 const token=parseBadgeToken(cookies.find(c=>c.name==='isocan_badge')?.value);
 if(!token)throw Error('No test owner badge');
 await writeBadge(home+'/cli',origin,{...token,at:new Date().toISOString()});
 await cli('identity','--name','Casey');
 await cli('--canvas','prj_attention','session','start');
 const selected=await cli('--json','--canvas','prj_attention','session','select','itm_document','--quote','this sentence');
 report.cli=JSON.parse(selected.stdout);
 await until(b,`document.querySelector('.text-attention-status')?.textContent.includes('Casey') && CSS.highlights.size>0`,'CLI selection reaches the browser');
 await cli('--canvas','prj_attention','session','select','--clear');
 await until(b,`CSS.highlights.size===0`,'CLI clear reaches the browser');
 const select=`(()=>{const node=document.querySelector('.markdown-text strong').firstChild;const r=document.createRange();r.selectNodeContents(node);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));return getSelection().toString();})()`;
 report.readOnly=await b.ev(`(async()=>{const actor=JSON.parse(localStorage.getItem('isocan.identity'));const r=await fetch('/api/ops',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actor,canvasId:'prj_attention',op:{type:'item.move',itemId:'itm_document',x:500,y:500}})});return r.status;})()`);
 if(report.readOnly!==403)throw Error('Morgan is not read-only');
 report.seqBefore=await a.ev(`fetch('/api/projects/prj_attention/canvas').then(r=>r.json()).then(s=>s.lastSeq)`);
 await b.ev(`window.contentChanges=0;new MutationObserver(m=>window.contentChanges+=m.length).observe(document.querySelector('.markdown-text'),{subtree:true,childList:true,characterData:true});`);
 report.selected=await a.ev(select);
 await until(b,`document.querySelector('.text-attention-status')?.textContent.includes('Taylor') && CSS.highlights.size>0`,'Taylor selection on Morgan',15000);
 report.remote=await b.ev(`({label:document.querySelector('.text-attention-status').textContent,quote:[...CSS.highlights.values()][0].values().next().value.toString(),own:getSelection().toString()})`);
 report.otherSelected=await b.ev(select);
 await until(a,`document.querySelector('.text-attention-status')?.textContent.includes('Morgan') && CSS.highlights.size>0`,'Morgan selection on Taylor',15000);
 report.independent=await a.ev(`({own:getSelection().toString(),remote:[...CSS.highlights.values()][0].values().next().value.toString()})`);
 // Reflow one reader independently and keep the text range exact.
 await b.ev(`document.querySelector('.item').style.width='360px'`);
 report.reflow=await b.ev(`({quote:[...CSS.highlights.values()][0].values().next().value.toString(),own:getSelection().toString(),font:getComputedStyle(document.querySelector('.md-view')).fontSize})`);
 await b.ev(`document.querySelector('.md-view').scrollTop=100`);
 report.scroll=await b.ev(`({scroll:document.querySelector('.md-view').scrollTop,quote:[...CSS.highlights.values()][0].values().next().value.toString()})`);
 const image=await b.send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'isocan-selection-browser.png'),Buffer.from(image.data,'base64'));
 await a.ev(`getSelection().removeAllRanges();document.dispatchEvent(new Event('selectionchange'));`);
 await until(b,`CSS.highlights.size===0 && !document.querySelector('.text-attention-status')`,'remote selection clears',15000);
 report.cleared=true;
 report.contentChanges=await b.ev('window.contentChanges');
 report.seqAfter=await a.ev(`fetch('/api/projects/prj_attention/canvas').then(r=>r.json()).then(s=>s.lastSeq)`);
 if(!Number.isInteger(report.seqBefore)||report.seqBefore!==report.seqAfter)throw Error('Selection wrote an operation');
 // A hidden tab clears its own selection; re-entry does not replay it.
 await a.ev(select);
 await until(b,`CSS.highlights.size>0`,'selection before hide');
 await a.ev(`Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));`);
 await until(b,`CSS.highlights.size===0`,'hidden tab clears selection');
 report.hiddenClears=true;
 await a.ev(`Object.defineProperty(document,'hidden',{value:false,configurable:true});getSelection().removeAllRanges();document.dispatchEvent(new Event('visibilitychange'));`);
 // A new saved representation invalidates the old selection everywhere.
 await a.ev(select);await until(b,`CSS.highlights.size>0`,'selection before version');
 await a.ev(`(async()=>{const actor=JSON.parse(localStorage.getItem('isocan.identity'));const blob=await (await fetch('/api/projects/prj_attention/blobs',{method:'POST',headers:{'Content-Type':'text/markdown'},body:'# Revised review\\n\\nA different paragraph.'})).json();const r=await fetch('/api/ops',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actor,canvasId:'prj_attention',op:{type:'item.addVersion',itemId:'itm_document',version:{id:'ver_revised',blobHash:blob.blobHash,mimeType:'text/markdown',filename:'review.md',size:blob.size}}})});if(!r.ok)throw Error(await r.text());})()`);
 await until(b,`document.querySelector('.markdown-text')?.dataset.textVersion==='ver_revised' && CSS.highlights.size===0`,'new version clears range');
 report.versionClears=true;
 // Many unchanged documents must not parse again while the canvas moves.
 await a.ev(`(async()=>{const actor=JSON.parse(localStorage.getItem('isocan.identity'));for(let i=0;i<20;i++){const r=await fetch('/api/ops',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actor,canvasId:'prj_attention',op:{type:'item.add',itemId:'itm_copy'+i,title:'Acme notes '+i,version:{id:'ver_copy'+i,blobHash:${JSON.stringify(report.fixture.blobHash)},mimeType:'text/markdown',filename:'notes.md',size:100},width:400,height:300,placement:{x:700+(i%4)*440,y:100+Math.floor(i/4)*340}}})});if(!r.ok)throw Error(await r.text());}})()`);
 await until(a,`document.querySelectorAll('.markdown-text').length>=21`,'many rendered documents');
 await a.send('Profiler.enable');await a.send('Profiler.start');
 for(let i=0;i<12;i++){await a.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:650,y:450,deltaX:i<6?20:0,deltaY:10,modifiers:i<6?0:2});await new Promise(r=>setTimeout(r,70));}
 const {profile}=await a.send('Profiler.stop');
 const markdownNodes=new Set(profile.nodes.filter(n=>n.callFrame.url.includes('markdown-body')).map(n=>n.id));
 report.panZoom={documents:21,samples:profile.samples?.length ?? 0,markdownChunkSamples:(profile.samples ?? []).filter(id=>markdownNodes.has(id)).length};
 if(!report.panZoom.samples)throw Error('Profiler returned no samples');
 await cli('--canvas','prj_attention','version','promote','itm_document','ver_original');
 { const loaded=a.once('Page.loadEventFired');await a.send('Page.navigate',{url:origin+'/p/prj_attention'});await loaded;await until(a,`!!document.querySelector('.item-read')`,'Read control after presence checks'); }
 const click = async(selector) => {const box=await a.ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('missing ${selector}');const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await a.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});await a.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box});};
 await click('.item-read');await until(a,`!!document.querySelector('.item.entered .markdown-text strong')`,'read original');
 await a.ev(`(()=>{const node=document.querySelector('.markdown-text strong').firstChild;const r=document.createRange();r.selectNodeContents(node);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));})()`);
 await until(a,`!!document.querySelector('.text-comment-action')`,'comment on selection');
 await click('.text-comment-action');
 await until(a,`!!document.querySelector('.compose-popover textarea')`,'quote composer');
 assert.equal(await a.ev(`document.querySelector('.compose-popover blockquote').textContent`),'this sentence');
 await a.send('Input.insertText',{text:'Please clarify this passage.'});
 await click('.compose-popover button[type=submit]');
 await until(b,`!!document.querySelector('.document-discussions button')`,'durable comment reaches reader');
 assert.equal(await b.ev(`document.querySelectorAll('.text-comment-action').length`),0);
 const threads=JSON.parse((await cli('--json','--canvas','prj_attention','comment','list')).stdout);
 assert.equal(threads[0].textAnchor.quote,'this sentence');assert.equal(threads[0].textAnchorResolution.status,'resolved');
 await click('.document-discussions button');
 await until(a,`[...CSS.highlights.keys()].some(k=>k.startsWith('threadanchor'))`,'saved quote highlight');
 const quote=await a.ev(`[...CSS.highlights.entries()].find(([k])=>k.startsWith('threadanchor'))[1].values().next().value.toString()`);assert.equal(quote,'this sentence');
 await a.ev(`document.querySelector('.item').style.width='380px'`);
 assert.equal(await a.ev(`[...CSS.highlights.entries()].find(([k])=>k.startsWith('threadanchor'))[1].values().next().value.toString()`),'this sentence');
 report.durable={quote,readOnly:true,reflow:true,cliResolution:threads[0].textAnchorResolution};
 // Import a self-contained Markdown face and a sibling document; relative links
 // navigate to saved items, while a missing reference has no navigable app URL.
 await writeFile(home+'/pixel.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64'));
 await writeFile(home+'/guide.md','# Guide\n\nA **durable quote**.\n\n![Pixel](pixel.png)\n\n[Plan](plan.md#decisions) · [Missing](missing.md)');
 await writeFile(home+'/plan.md','# Plan\n\n'+('Review this plan. '.repeat(200))+'\n\n## Decisions\n\nDone.');
 const guide=JSON.parse((await cli('--json','--canvas','prj_attention','add','guide.md')).stdout);
 const plan=JSON.parse((await cli('--json','--canvas','prj_attention','add','plan.md')).stdout);
 const loaded=a.once('Page.loadEventFired');await a.send('Page.navigate',{url:origin+'/p/prj_attention/i/'+guide.itemId});await loaded;
 await until(a,`!!document.querySelector('.fullscreen-stage .markdown-text img')`,'imported Markdown');
 report.resourceImage=await a.ev(`(()=>{const image=document.querySelector('.fullscreen-stage .markdown-text img');return {src:image.src,naturalWidth:image.naturalWidth}})()`);
 assert.ok(report.resourceImage.src.startsWith('data:image/png;base64,'));assert.equal(report.resourceImage.naturalWidth,1);
 assert.equal(await a.ev(`document.querySelector('.fullscreen-stage .markdown-resource-missing')?.textContent`),'Missing');
 await a.ev(`(()=>{const node=document.querySelector('.fullscreen-stage .markdown-text strong').firstChild;const r=document.createRange();r.selectNodeContents(node);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));})()`);
 await until(a,`!!document.querySelector('.fullscreen-stage .text-comment-action')`,'full screen comment action');
 await click('.fullscreen-stage .text-comment-action');
 await until(a,`!!document.querySelector('.fullscreen .compose-popover textarea')`,'full screen composer above the stage');
 assert.equal(await a.ev(`(()=>{const e=document.querySelector('.fullscreen .compose-popover textarea');const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e})()`),true);
 await a.send('Input.insertText',{text:'Full screen discussion.'});await click('.fullscreen .compose-popover button[type=submit]');
 await until(a,`!!document.querySelector('.fullscreen-stage .document-discussions button')`,'full screen saved thread');
 report.fullscreenComments=true;

 await click('.fullscreen-stage .markdown-text a');
 await until(a,`location.pathname.endsWith(${JSON.stringify(plan.itemId)}) && !!document.querySelector('.fullscreen-stage .markdown-text h2')`,'relative link opens sibling');
 report.relativeNavigation=await a.ev(`({path:location.pathname,hash:location.hash,scroll:document.querySelector('.fullscreen-stage .md-view').scrollTop})`);
 assert.equal(report.relativeNavigation.hash,'#decisions');assert.ok(report.relativeNavigation.scroll>0);
 const screenshot=await a.send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'isocan-durable-browser.png'),Buffer.from(screenshot.data,'base64'));
 report.errors=await Promise.all(clients.map(c=>c.takeErrors()));
 for(const quote of [report.selected,report.remote.quote,report.otherSelected,report.independent.own,report.independent.remote,report.reflow.quote,report.reflow.own,report.scroll.quote]) assert.equal(quote,'this sentence');
 assert.equal(report.remote.own,'');
 assert.equal(report.contentChanges,0,'Presence must not rewrite rendered content');
 assert.equal(report.reflow.font,'16px');
 assert.equal(report.scroll.scroll,100);
 assert.deepEqual(report.errors,[[],[]]);
 console.log(JSON.stringify(report,null,2));await writeFile(path.join(output,'isocan-selection-browser.json'),JSON.stringify(report,null,2));
}finally{for(const c of clients)await c.close();await daemon.close();await rm(home,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
