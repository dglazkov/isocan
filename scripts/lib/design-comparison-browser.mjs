import assert from 'node:assert/strict';
import {until} from './browser.mjs';

/** Observe the exact product iframe; route real input through the parent compositor after each rendered scroll. */
export async function comparisonFrame(b) {
  const selector='.design-comparison-frame';
  await until(b,`document.querySelector('${selector}')?.src && !document.querySelector('.design-comparison-try')?.textContent.includes('Opening this exact version…')`,'exact comparison frame load acknowledged');
  const url=await b.ev(`document.querySelector('${selector}').src`), errors=[],pending=new Map();let next=0,sessionId,contextId,off=()=>{};
  const {root}=await b.send('DOM.getDocument',{}),{nodeId}=await b.send('DOM.querySelector',{nodeId:root.nodeId,selector});
  const {node}=await b.send('DOM.describeNode',{nodeId});assert(node.frameId,'actual comparison element owns a frame');
  const infos=(await b.send('Target.getTargets')).targetInfos;
  const tree=(await b.send('Page.getFrameTree')).frameTree;
  const find=one=>one.frame.id===node.frameId?one.frame:(one.childFrames??[]).map(find).find(Boolean);
  const owned=find(tree);assert(owned?.url===url,'owned frame has completed navigation to the displayed exact URL');
  const target=infos.find(one=>one.type==='iframe'&&one.targetId===node.frameId);
  const attachment={node:{nodeId,frameId:node.frameId},frame:owned,targets:infos.map(({targetId,type,url})=>({targetId,type,url}))};
  let send=(method,params)=>b.send(method,params);
  if(target){
    ({sessionId}=await b.send('Target.attachToTarget',{targetId:target.targetId,flatten:false}));
    off=b.on('Target.receivedMessageFromTarget',event=>{if(event.sessionId!==sessionId)return;const msg=JSON.parse(event.message),one=pending.get(msg.id);if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description??msg.params.exceptionDetails.text);if(msg.method==='Log.entryAdded'&&msg.params.entry.level==='error')errors.push(msg.params.entry.text);if(one){pending.delete(msg.id);msg.error?one.reject(Error(JSON.stringify(msg.error))):one.resolve(msg.result)}});
    send=async(method,params)=>{const id=++next;let timer;try{const result=new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});timer=setTimeout(()=>{pending.delete(id);reject(Error('Child CDP timeout '+method))},10000)});await b.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})});return await result}finally{clearTimeout(timer)}};
    await send('Runtime.enable',{});await send('Log.enable',{});
  }else{
    ({executionContextId:contextId}=await b.send('Page.createIsolatedWorld',{frameId:owned.id,worldName:'design-comparison-proof'}));
  }
  const ev=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,...(contextId?{contextId}:{})});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result.value};
  const frame={ev};let clickId=0,lastClick;
  await until(frame,`document.readyState==='complete'`,'exact option ready');
  await ev(`(()=>{const input=globalThis.__comparisonInput={events:[],intent:null};input.observe=event=>{const intent=input.intent;input.events.push({type:event.type,intentId:intent?.id,intendedTarget:!!intent&&!!document.querySelector(intent.selector)?.contains(event.target),target:event.target?.id,x:event.clientX,y:event.clientY,trusted:event.isTrusted});if(input.events.length>120)input.events.shift()};for(const type of ['pointerdown','pointerup','click','submit'])document.addEventListener(type,input.observe,true)})()`);
  const click=async control=>{
    await until(frame,`document.querySelector(${JSON.stringify(control)}) && !document.querySelector(${JSON.stringify(control)}).disabled`,'enabled child '+control);
    await b.ev(`document.querySelector('${selector}').scrollIntoView({block:'center',behavior:'instant'})`);
    await ev(`(async()=>{document.querySelector(${JSON.stringify(control)}).scrollIntoView({block:'center',behavior:'instant'});await new Promise(requestAnimationFrame)})()`);
    await b.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
    const box=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(control)}),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(!r.width||!r.height||!e.contains(document.elementFromPoint(x,y)))throw Error('Covered child control');return{x,y}})()`);
    const offset=await b.ev(`(()=>{const e=document.querySelector('${selector}'),r=e.getBoundingClientRect();return{x:r.left+e.clientLeft,y:r.top+e.clientTop}})()`),point={x:box.x+offset.x,y:box.y+offset.y};
    assert(await b.ev(`document.elementFromPoint(${point.x},${point.y})===document.querySelector('${selector}')`),'parent hit test reaches intended iframe');
    lastClick={id:++clickId,selector:control,box,offset,point};await ev(`globalThis.__comparisonInput.intent=${JSON.stringify(lastClick)}`);
    for(const type of ['mousePressed','mouseReleased'])await b.send('Input.dispatchMouseEvent',{type,...point,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});
    await until(frame,`globalThis.__comparisonInput.events.some(e=>e.intentId===${clickId}&&e.type==='click'&&e.trusted&&e.intendedTarget)`,'single actual child click '+control);
  };
  const fill=async(control,text)=>{await click(control);await until(frame,`document.activeElement===document.querySelector(${JSON.stringify(control)})`,'child focus settled');await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',commands:['selectAll']});await b.send('Input.insertText',{text});await until(frame,`document.querySelector(${JSON.stringify(control)}).value===${JSON.stringify(text)}`,'child receives text')};
  const select=async(control,value)=>{assert(await ev(`Array.from(document.querySelector(${JSON.stringify(control)}).options).some(o=>o.value===${JSON.stringify(value)})`),'known native option');await ev(`(()=>{const e=document.querySelector(${JSON.stringify(control)});e.focus();e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()`)};
  const evidence=async()=>({url,attachment,frameId:node.frameId,targetId:target?.targetId??null,lastClick,events:await ev('globalThis.__comparisonInput.events'),errors:[...errors],state:await ev(`({href:location.href,focus:document.activeElement?.id,viewport:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth>innerWidth})`)});
  const close=async()=>{await ev(`(()=>{for(const type of ['pointerdown','pointerup','click','submit'])document.removeEventListener(type,globalThis.__comparisonInput?.observe,true);delete globalThis.__comparisonInput})()`);off();if(sessionId)await b.send('Target.detachFromTarget',{sessionId});assert.deepEqual(errors,[],'child runtime/security errors')};
  return {ev,click,fill,select,evidence,close,url};
}
