import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {click,navigate} from './personal-journey-fixture.mjs';
import {until} from './browser.mjs';
import {fill,inspectWidths} from './design-systems-browser.mjs';

/** Extend an owned copy of the incumbent's actual custom element, tokens and running stock endpoint. */
export async function walkIncumbent(b,output) {
  const original=new URL('../../test/fixtures/design-partner/brand-extension/repo/',import.meta.url), folder=path.join(output,'incumbent-repo');
  await fs.cp(original,folder,{recursive:true});
  const index=await fs.readFile(path.join(folder,'public/index.html'),'utf8');
  const stockPath=index.match(/fetch\("([^"]+)"\)/)[1];
  const additions=`<acme-card id="lookup"><h2>Find stock</h2><p>Look up a SKU before walking to its shelf.</p><form id="lookup-form"><label for="sku">SKU</label><input id="sku" placeholder="For example: BTL-20"><button>Find stock</button></form><p id="lookup-status" role="status">Enter a SKU to begin.</p><ul id="results"></ul></acme-card><style>main{max-width:760px;margin:auto;padding:var(--space)}acme-card+acme-card{margin-top:var(--space)}#lookup-form{display:flex;align-items:center;gap:var(--space);flex-wrap:wrap}#lookup input{font:inherit;padding:8px;border:1px solid var(--ink);border-radius:var(--radius);min-width:0;max-width:100%}#results{padding-left:var(--space)}#results li{margin-block:var(--space)}</style><script type="module">document.querySelector('#lookup-form').onsubmit=async event=>{event.preventDefault();const status=document.querySelector('#lookup-status'),list=document.querySelector('#results'),button=event.currentTarget.querySelector('button');button.disabled=true;status.textContent='Looking up stock…';list.replaceChildren();try{const url=new URL(${JSON.stringify(stockPath)},location.origin);url.searchParams.set('q',document.querySelector('#sku').value);const response=await fetch(url);if(!response.ok)throw Error();const rows=await response.json();status.textContent=rows.length?rows.length+' matching stock lines':'No stock matches that SKU.';for(const row of rows){const li=document.createElement('li');li.textContent=row.sku+' · '+row.name+' · '+row.available+' available · Shelf '+row.shelf;list.append(li)}}catch{status.textContent='Stock could not be read. Your SKU remains; try again.'}finally{button.disabled=false}};</script>`;
  await fs.writeFile(path.join(folder,'public/index.html'),index.replace('<p>Stock lookup will be added here.</p>','<p><a href="#lookup">Find a SKU and its shelf</a></p>').replace('</main>',additions+'</main>'));
  for(const file of ['public/components.mjs','public/tokens.css','server.mjs']) assert.equal(await fs.readFile(new URL(file,original),'utf8'),await fs.readFile(path.join(folder,file),'utf8'),`${file} reused unchanged`);
  const server=spawn(process.execPath,['server.mjs'],{cwd:folder,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});let stderr='';server.stderr.on('data',chunk=>stderr+=chunk);
  try {
    const url=await new Promise((resolve,reject)=>{let stdout='';server.stdout.on('data',chunk=>{stdout+=chunk;try{resolve(JSON.parse(stdout.trim()).url)}catch{}});server.once('error',reject);server.once('exit',()=>reject(Error('Incumbent runtime exited: '+stderr)));});
    await navigate(b,url+'/');await until(b,`document.querySelector('#count').textContent==='2 stock lines available'`,'actual incumbent runtime');
    const styles=await b.ev(`(()=>{const cards=[...document.querySelectorAll('acme-card')];return cards.map(e=>({component:e.constructor.name,padding:getComputedStyle(e).padding,radius:getComputedStyle(e).borderRadius,background:getComputedStyle(e).backgroundColor}))})()`);
    assert.equal(styles[0].component,'AcmeCard');assert.deepEqual(styles[1],styles[0]);
    await fill(b,'#sku','BTL-20');await click(b,'#lookup-form button');await until(b,`document.querySelector('#results').textContent.includes('24 available · Shelf B-4')`,'real stock lookup');
    await fill(b,'#sku','NOT-A-SKU');await click(b,'#lookup-form button');await until(b,`document.querySelector('#lookup-status').textContent==='No stock matches that SKU.'`,'empty lookup');await inspectWidths(b,output,'incumbent');
    const hashes={};for(const file of ['server.mjs','public/index.html','public/components.mjs','public/tokens.css'])hashes[file]=createHash('sha256').update(await fs.readFile(path.join(folder,file))).digest('hex');
    return {folder,url,hashes,styles,proof:'Actual incumbent server and stock endpoint; original AcmeCard and tokens unchanged; added lookup returns stock and empty state.'};
  } finally {if(server.exitCode===null&&server.signalCode===null){const exited=once(server,'exit');server.kill('SIGTERM');await exited;}}
}
