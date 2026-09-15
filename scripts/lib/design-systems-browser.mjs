import assert from 'node:assert/strict';
import path from 'node:path';
import {click,navigate,screenshot} from './personal-journey-fixture.mjs';
import {until} from './browser.mjs';

export async function fill(b,selector,text) {
  await click(b,selector);
  await until(b,`document.activeElement===document.querySelector(${JSON.stringify(selector)})`,'focused '+selector);
  if(await b.ev(`document.querySelector(${JSON.stringify(selector)}).value!==''`)) await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',commands:['selectAll']});
  await b.send('Input.insertText',{text});
}
export async function key(b,name,code) {
  await b.send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:name,windowsVirtualKeyCode:code});
  await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:name,windowsVirtualKeyCode:code});
}
export async function clickText(b,text,scope='button') {
  await until(b,`[...document.querySelectorAll(${JSON.stringify(scope)})].some(e=>e.textContent.trim()===${JSON.stringify(text)} && !e.disabled && !e.closest('button:disabled'))`,text);
  await b.ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(scope)})].find(e=>e.textContent.trim()===${JSON.stringify(text)});e.dataset.systemJourney='target'})()`);
  try {await click(b,'[data-system-journey="target"]');}finally{await b.ev(`document.querySelector('[data-system-journey]')?.removeAttribute('data-system-journey')`);}
}
export async function field(b,label,text) {
  await b.ev(`(()=>{const e=[...document.querySelectorAll('.design-systems label')].find(e=>e.textContent.startsWith(${JSON.stringify(label)}))?.querySelector('input,textarea');if(!e)throw Error('Missing field');e.dataset.systemJourney='field'})()`);
  try {await fill(b,'[data-system-journey="field"]',text);}finally{await b.ev(`document.querySelector('[data-system-journey]')?.removeAttribute('data-system-journey')`);}
}
export async function inspectWidths(b,output,label) {
  for(const width of [390,1280]) {
    await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    assert.equal(await b.ev('document.documentElement.scrollWidth>innerWidth'),false,`${label} no overflow at ${width}`);
    await b.ev('scrollTo(0,0)');await screenshot(b,path.join(output,`${label}-${width}.png`));
    await b.ev('scrollTo(0,document.documentElement.scrollHeight)');await screenshot(b,path.join(output,`${label}-${width}-end.png`));
  }
}
export async function walkReference(b,url,id,output) {
  await navigate(b,url);await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  if(id==='receiving') {
    await until(b,`document.querySelector('#qty-0')!==null`,'receiving form');
    await click(b,'#receipt-tab');assert(await b.ev(`!document.querySelector('#empty').hidden`));await click(b,'#start-receiving');
    await click(b,'#save');await until(b,`!document.querySelector('#error').hidden`,'zero validation');await fill(b,'#qty-0','-1');await click(b,'#save');assert(await b.ev(`document.querySelector('#error').textContent.includes('whole number')`));
    await fill(b,'#qty-0','12');await fill(b,'#note','Partial delivery. Keep the second carton for the afternoon shift.');
    await click(b,'.demo summary');await click(b,'#fail-next');await click(b,'#save');await until(b,`document.querySelector('#error').textContent.includes('could not be saved')`,'recoverable storage failure');assert.equal(await b.ev(`document.querySelector('#qty-0').value`),'12');
    await click(b,'#save');await until(b,`!document.querySelector('#receipt-view').hidden && !document.querySelector('#saved').hidden`,'saved twelve');
    await click(b,'#correct');await fill(b,'#qty-0','10');await click(b,'#save');
    assert(await b.ev(`['qty-0','note','receipt-tab','receive-tab','correct','start-receiving','shipment-picker','fail-next','clear-receipt'].every(id=>document.getElementById(id).disabled)`),'all dependent controls freeze coherently');
    await until(b,`!document.querySelector('#receipt-view').hidden && document.querySelector('#saved-lines').textContent.includes('10 units')`,'same receipt correction');
    await navigate(b,url);await click(b,'#receipt-tab');assert(await b.ev(`document.querySelector('#saved-lines').textContent.includes('10 units')`));
    assert.deepEqual(await b.ev(`(()=>{const rows=JSON.parse(localStorage.getItem('isocan.reference.receiving.v1'));return {count:Object.keys(rows).length,quantity:rows['PO-1042'].quantities[0]}})()`),{count:1,quantity:10});
    await click(b,'#correct');await inspectWidths(b,output,id);
  } else if(id==='field-guide') {
    await click(b,'#open-saves');assert(await b.ev(`!document.querySelector('#saved-empty').hidden`));await click(b,'#close-saves');await click(b,'[data-save="start"]');
    await navigate(b,url);await click(b,'#open-saves');await key(b,'Tab',9);await key(b,'Enter',13);
    await until(b,`location.hash==='#start' && document.activeElement===document.querySelector('#start h2')`,'saved passage keyboard return');
    await click(b,'.contents a[href="#walk"]');await click(b,'.checklist input');assert(await b.ev(`document.querySelector('#check-status').textContent.includes('1 of 3')`));
    await inspectWidths(b,output,id);
  } else {
    await click(b,'a[href="#book"]');await click(b,'#reserve');await until(b,`!document.querySelector('#form-error').hidden`,'reservation validation');
    await fill(b,'#name','Acme Visitor');await fill(b,'#email','visitor@example.test');
    await selectValue(b,'#project','Clothing — a button or seam');
    await click(b,'.reference summary');await click(b,'#fail-next');await click(b,'#reserve');await until(b,`document.querySelector('#form-error').textContent.includes('not saved')`,'recoverable reservation failure');
    await click(b,'#reserve');await until(b,`!document.querySelector('#confirmation').hidden`,'local reservation saved');
    await click(b,'#edit');await fill(b,'#name','Acme Returning Visitor');await click(b,'#reserve');await until(b,`!document.querySelector('#confirmation').hidden`,'reservation correction');
    await navigate(b,url);assert(await b.ev(`!document.querySelector('#confirmation').hidden && document.querySelector('#confirmation').textContent.includes('Acme Returning Visitor')`));await inspectWidths(b,output,id);
  }
  assert.deepEqual(b.takeErrors(),[],`${id} runtime errors`);console.log('checkpoint: native '+id+' passed');
  return `${id}: actual split-origin HTML, keyboard/empty/long content, appropriate validation/error/persistence/correction, 390px/1280px, reduced motion`;
}
/** Native selects use observed options and selectOption-style focus/input/change; buttons and text use hit-tested CDP input. */
export async function selectValue(b,selector,value) {
  await until(b,`document.querySelector(${JSON.stringify(selector)})!==null`,'native select loaded');
  assert(await b.ev(`Array.from(document.querySelector(${JSON.stringify(selector)}).options).some(o=>o.value===${JSON.stringify(value)})`),'known native option');
  await b.ev(`(()=>{const select=document.querySelector(${JSON.stringify(selector)});select.focus();select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await until(b,`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(value)}`,'native selection');
}
/** The real opaque library preview uses child CDP only to observe it; actual input is hit tested in child and parent. */
export async function walkTemporaryPreview(b) {
  let target;
  for(let i=0;i<100;i++){target=(await b.send('Target.getTargets')).targetInfos.find(one=>one.type==='iframe'&&one.url==='about:srcdoc');if(target)break;await new Promise(resolve=>setTimeout(resolve,50));}
  assert(target,'actual opaque srcdoc target');
  const {sessionId}=await b.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});let nextId=0;const pending=new Map(),childErrors=[];
  const off=b.on('Target.receivedMessageFromTarget',event=>{if(event.sessionId!==sessionId)return;const m=JSON.parse(event.message),one=pending.get(m.id);if(m.method==='Runtime.exceptionThrown')childErrors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')childErrors.push(m.params.entry.text);if(!one)return;pending.delete(m.id);m.error?one.reject(Error(JSON.stringify(m.error))):one.resolve(m.result);});
  const childSend=async(method,params)=>{const id=++nextId;let timer;try{const result=new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});timer=setTimeout(()=>{pending.delete(id);reject(Error('Child CDP timeout '+method))},10000);});await b.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})});return await result;}finally{clearTimeout(timer);}};
  const frame={ev:async expression=>{const r=await childSend('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;}};
  let lastClick,clickId=0;
  const frameClick=async selector=>{
    await b.ev(`document.querySelector('.design-recipe-preview').scrollIntoView({block:'center',behavior:'instant'})`);
    await frame.ev(`(async()=>{document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'});await new Promise(requestAnimationFrame)})()`);
    // DOM hit tests can lead the OOPIF compositor after scrolling. A real rendered
    // surface must contain both scrolls before routing the single pointer press.
    await b.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
    const box=await frame.ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(!r.width||!r.height||!e.contains(document.elementFromPoint(x,y)))throw Error('Covered child control');return{x,y}})()`);
    const offset=await b.ev(`(()=>{const e=document.querySelector('.design-recipe-preview'),r=e.getBoundingClientRect();return{x:r.left+e.clientLeft,y:r.top+e.clientTop}})()`),point={x:box.x+offset.x,y:box.y+offset.y};
    assert(await b.ev(`document.elementFromPoint(${point.x},${point.y})===document.querySelector('.design-recipe-preview')`),'parent iframe is hit target');
    lastClick={id:++clickId,selector,box,offset,point};
    await frame.ev(`globalThis.__designJourneyInput.intent=${JSON.stringify(lastClick)}`);
    for(const type of ['mousePressed','mouseReleased'])await b.send('Input.dispatchMouseEvent',{type,...point,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});
    await until(frame,`globalThis.__designJourneyInput.events.some(e=>e.intentId===${clickId} && e.type==='click' && e.trusted && e.intendedTarget)`,'actual child click on '+selector);
  };
  const frameFill=async(selector,text)=>{
    await frameClick(selector);
    // The parent input acknowledgement can precede focus delivery in the child renderer.
    const focused=`document.activeElement===document.querySelector(${JSON.stringify(selector)})`;
    await until(frame,focused,'clicked child input focus settled');
    assert(await frame.ev(focused),'child input focused');
    await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',commands:['selectAll']});
    await b.send('Input.insertText',{text});
    await until(frame,`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(text)}`,'child input received text');
  };
  try {
    await childSend('Runtime.enable',{});await childSend('Log.enable',{});
    await frame.ev(`(()=>{const input=globalThis.__designJourneyInput={events:[],intent:null};input.observe=event=>{const target=event.target,intent=input.intent;input.events.push({type:event.type,intentId:intent?.id,intendedTarget:!!intent&&!!document.querySelector(intent.selector)?.contains(target),target:{tag:target?.tagName,id:target?.id},x:event.clientX,y:event.clientY,trusted:event.isTrusted,scroll:{x:scrollX,y:scrollY}});if(input.events.length>100)input.events.shift()};for(const type of ['pointerdown','pointerup','click','submit'])document.addEventListener(type,input.observe,true)})()`);
    await until(frame,`document.querySelector('#persistence-note')?.textContent.includes('Temporary preview')`,'honest temporary storage label');
    await frameFill('#qty-0','3');await frameClick('#save');await until(frame,`!document.querySelector('#receipt-view').hidden && document.querySelector('#saved-lines').textContent.includes('3 units')`,'actual sandbox preview save');
    await frameClick('#correct');await frameFill('#qty-0','2');await frameClick('#save');await until(frame,`!document.querySelector('#receipt-view').hidden && document.querySelector('#saved-lines').textContent.includes('2 units')`,'actual sandbox preview correction');
    assert.deepEqual(childErrors,[],'actual child runtime/security errors');console.log('checkpoint: sandbox preview save/correction passed');
    return 'Actual opaque srcdoc preview receives child+parent hit-tested translated input and saves/corrects temporary memory, with an explicit temporary-storage label.';
  }catch(error){
    const parent=await b.ev(`(()=>{const e=document.querySelector('.design-recipe-preview'),r=e?.getBoundingClientRect(),hit=document.elementFromPoint(${lastClick?.point.x??0},${lastClick?.point.y??0});return{focus:{tag:document.activeElement?.tagName,id:document.activeElement?.id},rect:r?.toJSON(),hit:{tag:hit?.tagName,id:hit?.id,className:hit?.className},viewport:{width:innerWidth,height:innerHeight}}})()`);
    const child=await frame.ev(`(()=>{const e=document.querySelector(${JSON.stringify(lastClick?.selector??'#qty-0')}),hit=document.elementFromPoint(${lastClick?.box.x??0},${lastClick?.box.y??0});return{href:location.href,qty:document.querySelector('#qty-0')?.value,text:document.body.innerText.slice(-1200),focus:{tag:document.activeElement?.tagName,id:document.activeElement?.id},rect:e?.getBoundingClientRect().toJSON(),hit:{tag:hit?.tagName,id:hit?.id},viewport:{width:innerWidth,height:innerHeight}}})()`);
    const input=await frame.ev('globalThis.__designJourneyInput.events');
    console.error('Preview failure state:',JSON.stringify({targetId:target.targetId,lastClick,parent,child,input,childErrors},null,2));
    throw error;
  }finally{await frame.ev(`(()=>{for(const type of ['pointerdown','pointerup','click','submit'])document.removeEventListener(type,globalThis.__designJourneyInput?.observe,true);delete globalThis.__designJourneyInput})()`);off();await b.send('Target.detachFromTarget',{sessionId});}
}
