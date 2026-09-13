// Run after npm run build: node --import ./index.mjs scripts/journey-personal.mjs
// Fresh synthetic home and browser; real owner/delegate actions and response-stage identity race.
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { makeFixture, click, navigate, identity, screenshot, until } from './lib/personal-journey-fixture.mjs';
const { canvasItemOf, itemPath, deckPath, deckFilename } = await import('../packages/core/src/index.ts');
const f=await makeFixture(), b=f.owner;
const marker='PRIVATE_SYNTHETIC_PHONE_390_BROWSER';
const requests=[]; b.on('Network.requestWillBeSent',event=>requests.push({url:event.request.url,method:event.request.method})); await b.send('Network.enable');
const clickText=async(text,scope='document')=>{
 const p=await b.ev(`(async()=>{const e=[...${scope}.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Missing control '+${JSON.stringify(text)});e.scrollIntoView({behavior:'instant',block:'center'});await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;if(!r.width||!r.height||!e.contains(document.elementFromPoint(x,y)))throw Error('Covered control '+${JSON.stringify(text)});return{x,y}})()`);
 for(const type of ['mousePressed','mouseReleased'])await b.send('Input.dispatchMouseEvent',{type,...p,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});
};
const key=async(key,code,modifiers=0)=>{for(const type of ['keyDown','keyUp'])await b.send('Input.dispatchKeyEvent',{type,key,code,modifiers});};
const openContext=async()=>{await key('k','KeyK',4);await until(b,'document.querySelector(".palette-field")!==null','command palette');await b.send('Input.insertText',{text:'Open Context'});await until(b,'document.querySelector(".palette-row")?.textContent.includes("Open Context")','Context action');await click(b,'.palette-row');await until(b,'document.querySelector(".personal-controls")!==null','personal controls');};
let source,privateHash;
try {
 await openContext();
 await clickText('Your canvas');
 await until(b,'document.querySelector(".personal-controls a")!==null','explicit private birth');
 const address=await b.ev('document.querySelector(".personal-controls a").href'); source=new URL(address).pathname.split('/').pop();
 const status=await f.client.personalStatus(f.maya.id);assert.equal(status.source.canvasId,source);assert.equal(status.home,f.base);
 await f.client.sendOp(source,f.maya,{type:'project.update',patch:{title:'PRIVATE_SOURCE_TITLE_BROWSER'}});
 const blob=await f.client.uploadBlob(source,Buffer.from(marker),'text/plain','preference.txt');privateHash=blob.blobHash;
 await f.client.sendOp(source,f.maya,{type:'item.add',itemId:'itm_private_preference',title:'Phone preference',width:400,height:200,placement:{x:0,y:0},properties:{context:'pinned'},version:{...blob,id:'ver_private_preference',mimeType:'text/plain',filename:'preference.txt'}});
 await clickText('Link your canvas here');
 await until(b,'document.querySelector(".personal-read")!==null','authorized personal layer');
 await until(b,'document.querySelector("[data-preview-state=personal]")!==null','redacted source card');
 const link=(await f.client.personalLinks(f.shared,f.maya.id)).links[0];
 await clickText('Read personal context');
 await until(b,`document.querySelector('.personal-private')?.textContent.includes(${JSON.stringify(marker)})`,'owner private pinned text');
 assert.equal(await b.ev(`document.querySelector('.canvas-viewport')?.textContent.includes(${JSON.stringify(marker)})`),false);
 assert.equal(await b.ev(`document.body.textContent.includes('PRIVATE_SOURCE_TITLE_BROWSER')`),false);
 console.log('OWNER_BIRTH_LINK_READ_REDACTED',source,link.itemId);
 const ownerShot=path.join(f.output,'owner-private-capture.png');
 await f.cli('canvas','shot',source,'--out',ownerShot);
 assert((await fs.stat(ownerShot)).size>1000);assert(f.cameraProfilesRemoved?.length>0);console.log('EXPLICIT_OWNER_PRIVATE_CAPTURE_EXIT_0_PROFILE_REMOVED',true);
 const rowan=(await f.client.sendOp(null,f.maya,{type:'actor.claim',sessionKey:'synthetic:memory-rowan',name:'Acme Rowan',harness:'synthetic'})).envelope.actor;
 await assert.rejects(f.client.readPersonal(f.shared,{actorId:rowan.id,itemId:link.itemId,mode:'content'}));
 await clickText('Agent access');await click(b,'.personal-delegates input');await b.send('Input.insertText',{text:rowan.id});await clickText('Allow agent');
 await until(b,`document.querySelector('.personal-delegates')?.textContent.includes(${JSON.stringify('Revoke agent '+rowan.id)})`,'allowed agent');
 assert.ok(JSON.stringify(await f.client.readPersonal(f.shared,{actorId:rowan.id,itemId:link.itemId,mode:'content'})).includes(marker));
 await clickText('Revoke agent '+rowan.id);
 await until(b,`!document.querySelector('.personal-delegates')?.textContent.includes(${JSON.stringify('Revoke agent '+rowan.id)})`,'revoked agent');
 await assert.rejects(f.client.readPersonal(f.shared,{actorId:rowan.id,itemId:link.itemId,mode:'content'}));
 console.log('ACTUAL_UI_ALLOW_REVOKE',true);
 // Give copied cards every face that used to bypass CanvasCard itself.
 const made=canvasItemOf(f.base,source),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
 const image=await f.client.uploadBlob(f.shared,png,'image/png','synthetic.png');
 const module=await f.client.uploadBlob(f.shared,Buffer.from('graph TD; SECRET-->PRIVATE'),'text/vnd.mermaid','synthetic.mmd');
 const cardblob=await f.client.uploadBlob(f.shared,Buffer.from(made.blob),made.mimeType,made.filename);
 for(const [id,version,memory] of [['itm_private_image',{...image,mimeType:'image/png',filename:'synthetic.png'},null],['itm_private_module',{...module,mimeType:'text/vnd.mermaid',filename:'synthetic.mmd'},'inherit'],['itm_private_visual',{...cardblob,mimeType:made.mimeType,filename:made.filename,visual:{...image,mimeType:'image/png',filename:'synthetic.png'}},null]]){
  await f.client.sendOp(f.shared,f.maya,{type:'item.add',itemId:id,title:'Copied personal source',width:300,height:220,placement:{x:500,y:0},properties:{...made.properties,...(memory?{memory}:{})},version:{...version,id:'ver_'+id}});
 }
 for(const [id,properties,version] of [
  ['itm_source_only_image',{kind:'text',source:made.properties.source},{...image,mimeType:'image/png',filename:'synthetic.png'}],
  ['itm_raw_canvas_module',{kind:'text',canvas:source},{...module,mimeType:'text/vnd.mermaid',filename:'synthetic.mmd'}],
  ['itm_uri_body_only',{}, {...cardblob,mimeType:made.mimeType,filename:made.filename}],
 ]) await f.client.sendOp(f.shared,f.maya,{type:'item.add',itemId:id,title:'Synthetic altered source card',width:300,height:220,placement:{x:500,y:280},properties,version:{...version,id:'ver_'+id}});
 await click(b,'button[aria-label="Close the context view"]');
 requests.length=0;
 await navigate(b,f.base+'/p/'+f.shared);await until(b,'document.querySelectorAll("[data-preview-state=personal]").length>=7','all saved faces redacted');
 assert.equal(requests.filter(r=>r.url.includes('/api/projects/'+source+'/')||r.url.includes(image.blobHash)||r.url.includes(module.blobHash)||r.url.includes(privateHash)).length,0,'automatic source or saved private face fetched');
 for(const id of ['itm_private_image','itm_private_module','itm_private_visual','itm_source_only_image','itm_raw_canvas_module','itm_uri_body_only']) {
  requests.length=0;await navigate(b,f.base+itemPath(f.shared,id));await until(b,'document.querySelector("[data-preview-state=personal]")!==null','full screen redaction '+id);
  assert.equal(requests.filter(r=>r.url.includes('/api/projects/'+source+'/')||r.url.includes(image.blobHash)||r.url.includes(module.blobHash)||r.url.includes(privateHash)).length,0,'full screen read private/saved face');
 }
 requests.length=0; await navigate(b,f.base+deckPath(f.shared));await until(b,'document.querySelectorAll("[data-preview-state=personal]").length>=4','print-deck redaction');
 assert.equal(requests.filter(r=>r.url.includes('/api/projects/'+source+'/')||r.url.includes(image.blobHash)||r.url.includes(module.blobHash)||r.url.includes(privateHash)).length,0,'print deck read private/saved face');
 await b.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:f.output});await clickText('Download deck.html');
 const download=path.join(f.output,deckFilename('Acme shared project','html'));
 for(let i=0;i<60;i++){try{await fs.access(download);break}catch{await new Promise(r=>setTimeout(r,100))}}
 const html=await fs.readFile(download,'utf8');assert(!html.includes(png.toString('base64'))&&!html.includes(marker));
 const cliDeck=path.join(f.output,'private-card-cli-deck.html');await f.cli('slides','export',cliDeck,'--canvas',f.shared);
 const cliHtml=await fs.readFile(cliDeck,'utf8');assert(!cliHtml.includes(png.toString('base64'))&&!cliHtml.includes(marker));
 console.log('SAVED_AND_ALTERED_SOURCE_IMAGE_MODULE_URI_FULLSCREEN_DECK_ZERO_READS',true);
 await navigate(b,f.base+'/p/'+f.shared);await openContext();await clickText('Unlink your canvas');
 await until(b,`document.querySelectorAll('.personal-read').length===0`,'unlink removes private read');
 await assert.rejects(f.client.readPersonal(f.shared,{actorId:f.maya.id,itemId:link.itemId,mode:'content'}));
 await f.cli('undo','--canvas',f.shared,'--json');
 await until(b,'document.querySelector(".personal-read")!==null','undo restores same consent');
 await clickText('Read personal context');await until(b,`document.querySelector('.personal-private')?.textContent.includes(${JSON.stringify(marker)})`,'owner reads after undo');
 await screenshot(b,path.join(f.output,'personal-context-owner.png'));
 console.log('UNLINK_UNDO_READ',true);
 // Same owned browser and canvas: hold an actual authorized response while old bytes are still visible.
 for(let i=0;i<16;i++) await f.client.sendOp(source,f.maya,{type:'item.add',itemId:'itm_private_page_'+i,title:'Synthetic preference '+i,width:100,height:80,placement:{x:0,y:0},properties:{context:'pinned'},version:{...blob,id:'ver_private_page_'+i,mimeType:'text/plain',filename:'preference.txt'}});
 await clickText('Read personal context');
 await until(b,`document.querySelector('.personal-private')?.textContent.includes(${JSON.stringify(marker)})&&[...document.querySelectorAll('button')].some(e=>e.textContent==='Read more personal context')`,'rendered first page with continuation');
 let held; const cancelled=new Set(); b.on('Network.loadingFailed',e=>{if(e.canceled||e.errorText==='net::ERR_ABORTED')cancelled.add(e.requestId)});
 const paused=e=>{if(e.request.method==='POST'&&e.request.postData?.includes('"mode":"content"')&&e.responseStatusCode===200)held=e;else void b.send('Fetch.continueRequest',{requestId:e.requestId});}; b.on('Fetch.requestPaused',paused);
 await b.send('Fetch.enable',{patterns:[{urlPattern:'*/personal/read',requestStage:'Response'}]});
 await clickText('Read more personal context'); for(let n=0;n<100&&!held;n++)await new Promise(r=>setTimeout(r,50)); assert(held,'held actual authorized content response');
 const heldBody=await b.send('Fetch.getResponseBody',{requestId:held.requestId});
 const heldText=heldBody.base64Encoded?Buffer.from(heldBody.body,'base64').toString():heldBody.body;
 assert(heldText.includes(marker),'real held authorized response contains private marker');
 assert.equal(await b.ev(`document.querySelector('.personal-private')?.textContent.includes(${JSON.stringify(marker)})`),true,'already rendered page remains before identity switch');
 const samePath=await b.ev('location.pathname');
 await click(b,'.face.self'); await click(b,'.identity-known-row[title^="Continue as Acme Theo"]');
 await until(b,`JSON.parse(localStorage.getItem('isocan.identity')).id===${JSON.stringify(f.theo.id)}`,'switch to actual Theo in place');
 assert.equal(await b.ev('location.pathname'),samePath,'identity switch stays on shared canvas');
 assert.equal(await b.ev(`document.body.textContent.includes(${JSON.stringify(marker)})`),false,'already rendered private text clears at identity change');
 assert.equal(await b.ev('document.querySelector(".personal-private")!==null'),false);
 let release='continued'; try {await b.send('Fetch.continueResponse',{requestId:held.requestId});} catch(error) {release='cancelled';for(let n=0;n<40&&!cancelled.has(held.networkId);n++)await new Promise(r=>setTimeout(r,50));assert(cancelled.has(held.networkId),'held HTTP response must be cancelled if it cannot continue: '+String(error));}
 await b.send('Fetch.disable');
 await until(b,'document.querySelector(".ctx-layer .ctx-why")!==null','Theo context in place');
 await new Promise(r=>setTimeout(r,500));
 assert.equal(await b.ev('location.pathname'),samePath);
 assert.equal(await b.ev(`document.body.textContent.includes(${JSON.stringify(marker)})`),false,'old response cannot repopulate private text');
 assert.equal(await b.ev('document.querySelector(".personal-private")!==null'),false);
 console.log('REAL_RESPONSE_IN_PLACE_IDENTITY_CLEARS_LATE_PRIVATE_READ',release);
 // Mobile uses a local More sheet; opening it must not write a desktop panel preference.
 await navigate(b,f.base+'/');await click(b,'.who-btn');await click(b,'.identity-known-row[title^="Continue as Acme Maya"]');await until(b,`JSON.parse(localStorage.getItem('isocan.identity')).id===${JSON.stringify(f.maya.id)}`,'switch back to Maya');await navigate(b,f.base+'/p/'+f.shared);
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await until(b,'document.querySelector(".phone-face")!==null','phone face');
 const prefs=await b.ev('JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.includes("panel"))))');
 await click(b,'button[aria-label="More canvas options"]');await clickText('Context');await until(b,'document.querySelector(".phone-context-sheet .personal-controls")!==null','phone Context sheet');
 await clickText('Read personal context',"document.querySelector('.phone-context-sheet')");await until(b,`document.querySelector('.phone-context-sheet .personal-private')?.textContent.includes(${JSON.stringify(marker)})`,'phone private read');
 await screenshot(b,path.join(f.output,'personal-context-phone.png'));
 await click(b,'button[aria-label="Close the context view"]');assert.equal(await b.ev('document.querySelector(".phone-context-sheet")!==null'),false);
 assert.equal(await b.ev('JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.includes("panel"))))'),prefs);
 console.log('PHONE_MORE_CONTEXT_REACHABLE_AND_NO_DESKTOP_PREF_WRITE',true);
 const shared=JSON.stringify({snapshot:await f.client.snapshot(f.shared),log:await f.daemon.engine.getLog(f.shared)});
 assert(!shared.includes(marker)&&!shared.includes(privateHash)&&!shared.includes('PRIVATE_SOURCE_TITLE_BROWSER'),'private read bytes/provenance leaked into shared state');
 assert.deepEqual(b.takeErrors().filter(e=>!e.text?.includes('net::ERR_ABORTED')),[]);
 console.log('MEMORY_BROWSER_PROOF_PASS');
} catch(error) { console.log('FAIL_DOM',await b.ev('document.body.innerText.slice(-9000)'));await screenshot(b,path.join(f.output,'failure.png'));throw error; }
finally {await f.close();console.log('MEMORY_PROOF_ARTIFACTS',f.output);}
