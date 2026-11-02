import assert from 'node:assert/strict';
import path from 'node:path';
import {navigate,screenshot,until} from './personal-journey-fixture.mjs';
import {receivingScenario} from './design-comparison-scenarios.mjs';

/** Wait for the painted target, then send one real pointer act; acknowledgements are not task outcomes. */
export async function reviewClick(b,selector) {
  await until(b,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return e&&!e.disabled})()`,'enabled '+selector);
  await b.ev(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
  await b.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
  const point=await b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;if(!r.width||!r.height||!e.contains(document.elementFromPoint(x,y)))throw Error('Covered control '+${JSON.stringify(selector)});return{x,y}})()`);
  for(const type of ['mousePressed','mouseReleased'])await b.send('Input.dispatchMouseEvent',{type,...point,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});
}

/** Text entry uses actual focus and keyboard; a DOM assignment cannot satisfy this proof. */
export async function reviewFill(b,selector,text) {
  await reviewClick(b,selector);
  await until(b,`document.activeElement===document.querySelector(${JSON.stringify(selector)})`,'actual focus '+selector);
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',commands:['selectAll']});
  await b.send('Input.insertText',{text});
  assert.equal(await b.ev(`document.querySelector(${JSON.stringify(selector)}).value`),text,'actual entered text');
}

/** Observe one exact rendered version at one width, retaining failed behavior rather than inventing a pass. */
export async function inspectReviewReceiving(b,url,{output,prefix,width,brokenSave=false,phoneOverflow=false}) {
  await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
  // This is synthetic fixture setup in an owned browser profile, never a production reset action.
  await b.send('Storage.clearDataForOrigin',{origin:new URL(url).origin,storageTypes:'local_storage'});
  await navigate(b,url);
  const observations=[],viewport={width,height:900};
  const record=(state,action,expected,observed,passed,evidence)=>observations.push({state,action,expected,observed,result:passed?'passed':'failed',viewport,evidence});
  await until(b,`document.querySelector('#sku')!==null && document.readyState==='complete'`,'actual receiving output');
  const initial=await b.ev(`({empty:document.querySelector('#activity').textContent,receiptVisible:!document.querySelector('#receipt').hidden})`);
  assert.equal(initial.receiptVisible,false);assert(initial.empty.includes('Nothing counted'));
  record('empty','Open the receiving task','An empty draft receipt',initial.empty,true,[]);
  await reviewClick(b,'#save');
  if(brokenSave){
    await until(b,`document.querySelector('#activity').textContent==='Preparing your receipt…'`,'executed broken save handler');
  }else{
    await until(b,`!document.querySelector('#error').hidden && document.activeElement.id==='sku'`,'empty receipt validation');
    record('validation','Save an empty receipt','Visible validation focused on SKU',await b.ev(`document.querySelector('#error').textContent`),true,[]);
  }
  await reviewFill(b,'#sku','NOTE-12');await reviewFill(b,'#quantity','12');
  const geometry=await b.ev(`(()=>{const r=document.querySelector('#quantity').getBoundingClientRect();return{viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,left:r.left,right:r.right,width:r.width}})()`);
  const overflow=geometry.scrollWidth>geometry.viewport||geometry.right>geometry.viewport;
  assert.equal(overflow,phoneOverflow&&width<500,'task-triggered phone overflow observed');
  const narrowShot=path.join(output,`${prefix}-${width}-quantity.png`);await screenshot(b,narrowShot);
  record('narrow','Enter a quantity at the agreed width','Quantity stays within the viewport',JSON.stringify(geometry),!overflow,[narrowShot]);
  await reviewClick(b,'#scan');
  for(const item of receivingScenario.items.slice(1)){await reviewFill(b,'#sku',item.sku);await reviewFill(b,'#quantity',String(item.ordered));await reviewClick(b,'#scan');}
  const counted=await b.ev(`Array.from(document.querySelectorAll('#lines .count'),e=>e.textContent)`);assert.equal(counted.length,3);
  await reviewClick(b,'#save');
  if(brokenSave){
    await until(b,`document.querySelector('#activity').textContent==='Preparing your receipt…'`,'executed broken primary action');
    const stored=await b.ev(`JSON.parse(localStorage.getItem('isocan.comparison.receiving.continuous')||'null')`);
    assert(!stored?.counts,'broken save did not persist counts');assert(await b.ev(`document.querySelector('#receipt').hidden`));
    const shot=path.join(output,`${prefix}-${width}-save-failed.png`);await screenshot(b,shot);
    record('save','Save the three counted stock lines','Saved receipt with 12, 20 and 8 units','The action ran but no receipt or stored counts exist.',false,[shot]);
  }else{
    await until(b,`!document.querySelector('#receipt').hidden`,'receipt saved');
    assert.deepEqual(await b.ev(`JSON.parse(localStorage.getItem('isocan.comparison.receiving.continuous')).counts`),[12,20,8]);
    record('save','Save the three counted stock lines','Saved receipt with 12, 20 and 8 units','Stored counts are [12,20,8].',true,[]);
    await reviewClick(b,'#correct');await reviewClick(b,'[data-edit="0"]');await reviewFill(b,'#correction-quantity','10');await reviewClick(b,'#update-count');await reviewClick(b,'#save');
    await until(b,`!document.querySelector('#receipt').hidden && document.querySelector('#saved-lines').textContent.includes('10 units')`,'correction saved');
    assert.deepEqual(await b.ev(`JSON.parse(localStorage.getItem('isocan.comparison.receiving.continuous')).counts`),[10,20,8]);
    record('correction','Correct notebooks from 12 to 10 and save','The same receipt contains [10,20,8]','Stored counts are [10,20,8].',true,[]);
    await navigate(b,url);await until(b,`!document.querySelector('#receipt').hidden && document.querySelector('#saved-lines').textContent.includes('10 units')`,'saved correction survives reload');
    const shot=path.join(output,`${prefix}-${width}-corrected.png`);await screenshot(b,shot);
    record('reload','Reload the actual output','The saved correction remains','Rendered saved receipt retains 10 notebook units.',true,[shot]);
    await reviewClick(b,'#correct');await reviewClick(b,'#sku');await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',windowsVirtualKeyCode:9});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',windowsVirtualKeyCode:9});
    await until(b,`document.activeElement.id==='quantity'`,'real keyboard focus on quantity');
    record('keyboard','Tab from SKU to quantity','Visible focus reaches quantity','Quantity is the active element after native Tab.',true,[shot]);
  }
  assert.deepEqual(b.takeErrors(),[],'actual task has no runtime errors');
  return {url,viewport,browser:await b.send('Browser.getVersion'),observations};
}

/** The connected case uses the incumbent component and its actual persisted server record. */
export async function inspectReviewIncumbent(b,runtime,output) {
  await navigate(b,runtime.url+'/');await until(b,`document.querySelector('#count').textContent==='2 stock lines available'`,'incumbent stock read');
  const component=await b.ev(`document.querySelector('#receiving').constructor.name`);assert.equal(component,'AcmeCard');
  await reviewClick(b,'#save');await until(b,`!document.querySelector('#error').hidden && document.activeElement.id==='quantity'`,'connected validation');
  await reviewFill(b,'#quantity','12');await reviewClick(b,'#save');await until(b,`!document.querySelector('#receipt').hidden && document.querySelector('#saved-count').textContent.includes('12 units')`,'server save');
  await reviewClick(b,'#correct');await reviewFill(b,'#quantity','10');await reviewClick(b,'#save');await until(b,`!document.querySelector('#receipt').hidden && document.querySelector('#saved-count').textContent.includes('10 units')`,'server correction');
  await navigate(b,runtime.url+'/');await until(b,`!document.querySelector('#receipt').hidden && document.querySelector('#saved-count').textContent.includes('10 units')`,'server readback after reload');
  const saved=await(await fetch(runtime.url+'/warehouse/receipts/current')).json();assert.equal(saved.quantity,10);
  for(const width of [1280,390]){await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});assert.equal(await b.ev('document.documentElement.scrollWidth>innerWidth'),false,'incumbent no overflow');await screenshot(b,path.join(output,`incumbent-review-${width}.png`));}
  assert.deepEqual(b.takeErrors(),[],'incumbent runtime errors');
  return {component,saved,revision:runtime.revision,buildId:runtime.buildId,url:runtime.url,hashes:runtime.hashes};
}
