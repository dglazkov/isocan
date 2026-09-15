import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {structuralComparisonHTML,receivingScenario} from './design-comparison-scenarios.mjs';

/** The same accepted scan/review task gains authored styling and two deliberately observable runtime defects. */
export function reviewReceivingHTML({brokenSave=false,phoneOverflow=false,systemAligned=false}={}) {
  const styling=`<style>:root{--ink:#1e332e;--paper:#f1f4ed;--surface:#fffef9;--accent:#245844;--line:#ccd5cb}body{background:var(--paper);color:var(--ink);font-family:Arial,Helvetica,sans-serif}.brand{color:var(--accent)}.panel{background:var(--surface);border-color:var(--line);border-radius:4px}.mast,.foot,.count-line,.save-area{border-color:var(--line)}button.primary{background:var(--accent);border-color:var(--accent);border-radius:4px}input{border-color:var(--line);border-radius:4px}button:focus-visible,input:focus-visible,a:focus-visible{outline-color:var(--accent)}.heading h1{letter-spacing:-.035em}.review{margin:32px auto}.notice,.foot{line-height:1.5}</style>`;
  const defects=`<script>
  // Synthetic starting defects are intentionally runtime behavior, outside static token diagnostics.
  ${brokenSave?`document.getElementById('save').onclick=()=>{document.getElementById('activity').textContent='Preparing your receipt…';};`:''}
  ${phoneOverflow?`document.getElementById('quantity').addEventListener('input',event=>{if(innerWidth<500){event.target.style.width='480px';event.target.style.maxWidth='none';}});`:''}
  </script>`;
  let html = structuralComparisonHTML('continuous')
    .replace('Continuous receipt · Receiving wireframe','Acme receiving · Count and review')
    .replace('Counter / receiving','Acme / receiving')
    .replace('Working wireframe<br>','Incoming delivery<br>')
    .replace('Authored synthetic example · structure under comparison','Authored example · receiving prototype')
    .replace('</head>',styling+'</head>')
    .replace('</body>',defects+'</body>');
  if(systemAligned){
    // The first authored repair reuses the installed receiving treatment instead of changing its system to bless wireframe values.
    const colors={'#315ced':'#245844','#8b8b88':'#ccd5cb','#fff':'#fffef9','#20211f':'#1e332e','#a12922':'#9a3025','#60635d':'#51665f','#f5f5f2':'#f1f4ed','#babcb5':'#ccd5cb','#b7bab1':'#ccd5cb','#d7d9d1':'#ccd5cb','#efefea':'#e0ebd9'};
    const lengths={'11px':'12px','13px':'14px','15px':'16px','18px':'16px','22px':'24px','30px':'32px','38px':'32px','3px':'4px','10px':'12px','14px':'16px','.65rem':'12px','1rem':'16px','.45rem':'8px'};
    html=html.replace(/<style>([\s\S]*?)<\/style>/g,(_,css)=>'<style>'+css.replace(/#[a-f0-9]{3,8}\b/gi,value=>colors[value]??value).replace(/(?<![\w.])(?:\d*\.)?\d+(?:px|rem)\b/g,value=>lengths[value]??value)+'</style>');
  }
  return html;
}

/** Agreed obligations are authored from the receiving brief; only actual browser calls satisfy them. */
export const reviewReceivingScenario={...receivingScenario,viewports:[{width:1280,height:900},{width:390,height:900}],states:['empty','validation','save','correction','reload','keyboard','narrow'],expectedCounts:[12,20,8],correctedCounts:[10,20,8]};

/** A second actual task reuses the accepted operational hierarchy and named stock facts. */
export function reviewStockLookupHTML() {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Acme stock lookup</title><style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f1f4ed;color:#1e332e;font:16px/1.5 Arial,Helvetica,sans-serif}main{max-width:800px;margin:48px auto;padding:24px}header{border-bottom:1px solid #ccd5cb;padding-bottom:24px}small{font-size:12px;color:#51665f}h1{font-size:32px;line-height:1.2;margin:8px 0}label{display:grid;gap:8px;margin:24px 0;font-weight:bold}input,button{font:inherit;min-height:44px;padding:8px 16px;border:1px solid #ccd5cb;border-radius:4px}input{width:100%;background:#fffef9}button{background:#245844;color:#fffef9;cursor:pointer}input:focus-visible,button:focus-visible{outline:3px solid #245844;outline-offset:3px}ul{padding:0;list-style:none}li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;padding:16px 0;border-bottom:1px solid #ccd5cb}li strong{display:block}li small{display:block}#empty{padding:24px;background:#fffef9}[hidden]{display:none!important}@media(max-width:520px){main{margin:16px auto;padding:20px}h1{font-size:28px}}</style><main><header><small>Acme / stockroom</small><h1>Find a stock line</h1><p>Look up an item before beginning another receipt.</p></header><label for="search">SKU or item name<input id="search" type="search" placeholder="Try NOTE-12 or notebooks"></label><p id="matches" role="status"></p><ul id="stock"></ul><section id="empty" hidden><h2>No matching stock</h2><p>Check the SKU or search a shorter item name.</p><button id="clear" type="button">Show all stock</button></section><footer><small>Authored example · supplied stock facts</small></footer></main><script>const rows=${JSON.stringify(receivingScenario.items)};const search=document.querySelector('#search');function render(){const query=search.value.trim().toLowerCase(),matched=rows.filter(row=>(row.sku+' '+row.name).toLowerCase().includes(query));document.querySelector('#stock').replaceChildren(...matched.map(row=>{const li=document.createElement('li'),name=document.createElement('span'),title=document.createElement('strong'),sku=document.createElement('small'),quantity=document.createElement('span');title.textContent=row.name;sku.textContent=row.sku;name.append(title,sku);quantity.textContent=row.ordered+' ordered';li.append(name,quantity);return li}));document.querySelector('#matches').textContent=matched.length+' stock lines';document.querySelector('#empty').hidden=matched.length>0;}search.addEventListener('input',render);document.querySelector('#clear').onclick=()=>{search.value='';render();search.focus()};render();</script></html>`;
}

/** Extend an owned incumbent checkout, retaining its actual component/tokens and stock service. */
export async function startReviewIncumbent(output) {
  const original=new URL('../../test/fixtures/design-partner/brand-extension/repo/',import.meta.url),folder=path.join(output,'incumbent-review-repo');
  await fs.cp(original,folder,{recursive:true});
  const indexPath=path.join(folder,'public/index.html'),serverPath=path.join(folder,'server.mjs');
  const index=await fs.readFile(indexPath,'utf8'),stockPath=index.match(/fetch\("([^"]+)"\)/)?.[1];
  assert(stockPath,'incumbent actual stock endpoint');
  const receiving=`<acme-card id="receiving"><h2>Receive stock</h2><p>Count the delivery, save it, then correct the same receipt.</p><form id="receive-form" novalidate><label>Stock item<select id="stock" required><option value="">Loading stock…</option></select></label><label>Units received<input id="quantity" type="number" inputmode="numeric" min="1" step="1" required></label><button id="save">Save receipt</button></form><p id="error" role="alert" hidden></p><article id="receipt" hidden><h3 tabindex="-1" id="saved-title">Receipt saved</h3><p id="saved-count"></p><button id="correct">Correct receipt</button></article><p role="status" id="status"></p><small>Authored local service. This receipt is stored by the running server.</small></acme-card><style>main{max-width:760px;margin:auto;padding:var(--space)}acme-card+acme-card{margin-top:var(--space)}#receive-form{display:grid;grid-template-columns:minmax(0,1fr) 140px;gap:var(--space);align-items:end}label{display:grid;gap:8px}input,select,button{font:inherit;min-height:44px;padding:8px;border:1px solid var(--ink);border-radius:var(--radius);max-width:100%;min-width:0}#save{grid-column:1/-1}#error{color:#8f2626}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--accent);outline-offset:3px}[hidden]{display:none!important}@media(max-width:520px){#receive-form{grid-template-columns:minmax(0,1fr)}}</style><script type="module">
  const $=id=>document.getElementById(id);let receipt=null,busy=false;
  async function call(url,options){const response=await fetch(url,options);const data=await response.json();if(!response.ok)throw Error(data.error||'The stockroom could not be reached.');return data}
  function show(){ $('receive-form').hidden=true;$('receipt').hidden=false;$('saved-count').textContent=receipt.sku+' · '+receipt.quantity+' units';$('saved-title').focus(); }
  function lock(value){busy=value;for(const id of ['stock','quantity','save','correct'])$(id).disabled=value;}
  try{const stock=await call(${JSON.stringify(stockPath)});$('stock').replaceChildren(...stock.map(row=>{const option=document.createElement('option');option.value=row.sku;option.textContent=row.sku+' · '+row.name;return option}));receipt=await call('/warehouse/receipts/current');if(receipt){$('stock').value=receipt.sku;$('quantity').value=receipt.quantity;show();}}
  catch(error){$('error').textContent=error.message;$('error').hidden=false;}
  $('receive-form').onsubmit=async event=>{event.preventDefault();if(busy)return;const sku=$('stock').value,quantity=Number($('quantity').value);$('error').hidden=true;if(!sku||!Number.isSafeInteger(quantity)||quantity<1){$('error').hidden=false;$('error').textContent='Choose a stock item and enter a whole quantity of at least 1.';$(sku?'quantity':'stock').focus();return}lock(true);$('status').textContent='Saving receipt…';try{const saved=await call(receipt?'/warehouse/receipts/'+receipt.id:'/warehouse/receipts',{method:receipt?'PATCH':'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sku,quantity})});receipt=await call('/warehouse/receipts/'+saved.id);$('status').textContent='Saved by the stockroom service.';show();}catch(error){$('error').hidden=false;$('error').textContent=error.message;$('status').textContent='Your count remains. Try saving again.';}finally{lock(false);}};
  $('correct').onclick=()=>{if(busy)return;$('receive-form').hidden=false;$('receipt').hidden=true;$('save').textContent='Save correction';$('quantity').focus();};
  </script>`;
  await fs.writeFile(indexPath,index.replace('<p>Stock lookup will be added here.</p>','<p><a href="#receiving">Receive this delivery</a></p>').replace('</main>',receiving+'</main>'));
  const server=await fs.readFile(serverPath,'utf8');
  const anchor='const file=routes[url.pathname];';assert(server.includes(anchor),'known incumbent file routing boundary');
  const receiptRoutes=`if(url.pathname.startsWith('/warehouse/receipts')){const answer=(value,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};const id=url.pathname.slice('/warehouse/receipts/'.length);if(req.method==='GET'){answer(id==='current'?[...receipts.values()][0]??null:receipts.get(id)??null);return;}try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10000)throw Error('Receipt too large');}const value=JSON.parse(raw);if(!stock.some(row=>row.sku===value.sku)||!Number.isSafeInteger(value.quantity)||value.quantity<1)throw Error('Valid stock and whole positive quantity required');if(req.method==='PATCH'&&!receipts.has(id)){answer({error:'Receipt not found'},404);return;}if(req.method!=='POST'&&req.method!=='PATCH'){answer({error:'Unsupported method'},405);return;}const receipt={id:req.method==='PATCH'?id:'receipt-'+(++serial),sku:value.sku,quantity:value.quantity};receipts.set(receipt.id,receipt);answer(receipt);return;}catch(error){answer({error:error.message},400);return;}}`;
  await fs.writeFile(serverPath,server.replace('const routes=',"const receipts=new Map();let serial=0;const routes=").replace(anchor,receiptRoutes+anchor));
  for(const file of ['public/components.mjs','public/tokens.css'])assert.equal(await fs.readFile(new URL(file,original),'utf8'),await fs.readFile(path.join(folder,file),'utf8'),file+' reused unchanged');
  const files=['server.mjs','public/index.html','public/components.mjs','public/tokens.css'],hashes={};
  for(const file of files)hashes[file]=createHash('sha256').update(await fs.readFile(path.join(folder,file))).digest('hex');
  const revision=createHash('sha256').update(JSON.stringify(hashes)).digest('hex');
  const child=spawn(process.execPath,['server.mjs'],{cwd:folder,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
  const close=async()=>{if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited;}};
  try{
    const url=await new Promise((resolve,reject)=>{let stdout='';child.stdout.on('data',chunk=>{stdout+=chunk;try{resolve(JSON.parse(stdout.trim()).url);}catch{}});child.once('error',reject);child.once('exit',()=>reject(Error('Incumbent runtime stopped: '+stderr)));});
    return {folder,url,revision,buildId:'acme-review-'+revision.slice(0,12),hashes,stockPath,close};
  }catch(error){await close();throw error;}
}
