import assert from 'node:assert/strict';
import { promises as fs, watch } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const repo=fileURLToPath(new URL('../../', import.meta.url));
const { startDaemon } = await import(pathToFileURL(path.join(repo,'packages/server/src/daemon.ts')).href);
const { writeBadge, adoptIdentity } = await import(pathToFileURL(path.join(repo,'packages/server/src/badge-store.ts')).href);
const { DaemonClient } = await import(pathToFileURL(path.join(repo,'packages/api/src/client.ts')).href);
const { harnessVars } = await import(pathToFileURL(path.join(repo,'packages/api/src/harness.ts')).href);
const { BADGE_COOKIE, parseBadgeToken } = await import(pathToFileURL(path.join(repo,'packages/core/src/index.ts')).href);
const { browser, until } = await import(pathToFileURL(path.join(repo,'scripts/lib/browser.mjs')).href);

export async function click(b, selector) {
  await until(b, `document.querySelector(${JSON.stringify(selector)}) !== null`, `control ${selector}`);
  const position = await b.ev(`(async () => {
    const e = document.querySelector(${JSON.stringify(selector)});
    e.scrollIntoView({behavior:'instant', block:'center'});
    await new Promise(requestAnimationFrame);
    const r = e.getBoundingClientRect(), x = r.left + r.width/2, y = r.top + r.height/2;
    if (!r.width || !r.height || !e.contains(document.elementFromPoint(x,y))) throw Error('Covered or zero-sized control');
    return {x,y};
  })()`);
  for (const type of ['mousePressed','mouseReleased']) await b.send('Input.dispatchMouseEvent', {type,...position,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});
}
export async function navigate(b, url) {
  await b.send('Page.navigate',{url});
  await until(b, `location.href === ${JSON.stringify(url)} && document.readyState === 'complete'`, `navigation ${url}`);
}
export async function identity(b) { return b.ev('JSON.parse(localStorage.getItem("isocan.identity"))'); }
export async function enterName(b, name) {
  if (!await b.ev('document.querySelector(".identity-dialog") !== null')) await click(b,'.front-onward button');
  await click(b,'.identity-dialog input.text-input');
  await b.send('Input.insertText',{text:name});
  await click(b,'.identity-dialog button[type="submit"]');
  await until(b, `JSON.parse(localStorage.getItem('isocan.identity') || 'null')?.name === ${JSON.stringify(name)}`, `identity ${name}`);
  return identity(b);
}
export async function screenshot(b, file) {
  const {data} = await b.send('Page.captureScreenshot',{format:'png'});
  await fs.writeFile(file,Buffer.from(data,'base64'));
}
export async function makeFixture({ contentPort = "off" } = {}) {
  const output = await fs.mkdtemp(path.join(os.tmpdir(),'isocan-personal-journey-'));
  const state = path.join(output,'state');
  await fs.mkdir(state);
  process.env.ISOCAN_STORE='file';
  const daemonOptions={host:'127.0.0.1',home:path.join(state,'daemon'),birthHome:null,auth:null,operators:[],contentPort,servesWorld:true};
  let daemon=await startDaemon({...daemonOptions,port:0});
  const base=`http://127.0.0.1:${daemon.app.server.address().port}`;
  const owner=await browser();
  await owner.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const fixture={output,state,daemon,base,owner,extraBrowsers:[]};
  // Reopen the same synthetic home/port so archive reads can be proven across daemon/store lifetimes.
  fixture.restart=async()=>{
    daemon.app.server.closeAllConnections(); await daemon.close();
    daemon=await startDaemon({...daemonOptions,port:Number(new URL(base).port)});
    fixture.daemon=daemon;
  };
  fixture.close=async()=>{
    const closed=await Promise.allSettled([owner,...fixture.extraBrowsers].map(b=>b.close()));
    daemon.app.server.closeAllConnections(); await daemon.close();
    await fs.rm(state,{recursive:true,force:true,maxRetries:5,retryDelay:100});
    for(const result of closed) if(result.status==='rejected') throw result.reason;
  };
  try {
    await navigate(owner,base+'/');
    fixture.maya=await enterName(owner,'Acme Maya');
    fixture.clientHome=path.join(state,'owner-client'); await fs.mkdir(fixture.clientHome);
    const cookies=(await owner.send('Network.getCookies',{urls:[base]})).cookies;
    const token=parseBadgeToken(cookies.find(c=>c.name===BADGE_COOKIE)?.value ?? '');
    assert(token,'actual owner browser holds its credential');
    await writeBadge(fixture.clientHome,base,{...token,at:new Date().toISOString()});
    await adoptIdentity(fixture.clientHome,fixture.maya);
    fixture.client=new DaemonClient(base,fixture.clientHome);
    fixture.shared='prj_memory_root_shared';
    await fixture.client.sendOp(null,fixture.maya,{type:'project.create',canvasId:fixture.shared,title:'Acme shared project',groupMode:'groups'});
    fixture.cli=async(...args)=>{
      const env={...process.env};
      for(const key of Object.keys(env)) if(key.startsWith('ISOCAN_')||harnessVars.includes(key)) delete env[key];
      Object.assign(env,{ISOCAN_HOME:fixture.clientHome,ISOCAN_DIRECT:base,ISOCAN_PORT:new URL(base).port,ISOCAN_DEFAULT_HOME_URL:''});
      const camera=args[0]==='canvas'&&args[1]==='shot';
      const cameraTemp=camera?await fs.mkdtemp(path.join(state,'camera-temp-')):null;
      const profiles=new Set();
      const watcher=cameraTemp?watch(cameraTemp,(_event,name)=>{if(name?.startsWith('isocan-cdp-'))profiles.add(path.join(cameraTemp,name));}):null;
      if(cameraTemp)Object.assign(env,{TMPDIR:cameraTemp,TMP:cameraTemp,TEMP:cameraTemp});
      // One owned process group includes the CLI camera grandchild and its
      // Chrome. A timeout must not leave those holding the output pipes open.
      const grouped=process.platform!=='win32';
      const child=spawn(process.execPath,[path.join(repo,'packages/cli/bin/isocan.js'),...args],{env,cwd:fixture.clientHome,stdio:['ignore','pipe','pipe'],detached:grouped});
      let stdout='',stderr='',timedOut=false;child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);
      const deadline=setTimeout(()=>{timedOut=true;try{if(grouped&&child.pid)process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');}catch{child.kill('SIGKILL');}},camera?90_000:30_000);
      try {
        const {code,signal}=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));});
        assert.equal(code,0,`CLI ${args.join(' ')}: exit=${code} signal=${signal??'none'}${timedOut?' timeout':''}; ${stderr}`);
        if(cameraTemp){
          assert(profiles.size>0,'observed the actual camera profile');
          for(const profile of profiles)await assert.rejects(fs.access(profile),{code:'ENOENT'},'owned camera profile removed before command exits');
          fixture.cameraProfilesRemoved=[...profiles];
        }
        try { return JSON.parse(stdout); } catch { return stdout; }
      } finally {clearTimeout(deadline);watcher?.close();}
    };
    await until(owner,'document.querySelector(".who-btn") !== null','named home');
    await click(owner,'.who-btn'); await click(owner,'.identity-leave');
    fixture.theo=await enterName(owner,'Acme Theo');
    await until(owner,'document.querySelector(".who-btn") !== null','second named home');
    await click(owner,'.who-btn');
    await click(owner,'.identity-known-row[title^="Continue as Acme Maya"]');
    await until(owner,`JSON.parse(localStorage.getItem('isocan.identity')).id===${JSON.stringify(fixture.maya.id)}`,'actual identity switch returns to Maya');
    assert.notEqual(fixture.maya.id,fixture.theo.id);
    await navigate(owner,`${base}/p/${fixture.shared}`);
    await until(owner,'document.querySelector(".canvas-page") !== null','shared canvas');
    return fixture;
  } catch(error) {
    await screenshot(owner,path.join(output,'fixture-failure.png')).catch(()=>{});
    console.error('Fixture evidence:',output);await fixture.close();throw error;
  }
}

export { until };
