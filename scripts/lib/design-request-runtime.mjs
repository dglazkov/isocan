/** Synthetic receiving task used by the real design-request journey; no provider or external service. */
import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

/** One task UI can prove a local prototype or an actual server-backed delivery without confusing their claims. */
export function receivingHtml(connected = false) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acme receiving</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f5f4ef;color:#20352f;font:16px/1.5 system-ui,sans-serif}main{max-width:860px;margin:auto;padding:28px 20px}header{border-bottom:2px solid #20352f;padding-bottom:20px;margin-bottom:24px}small{color:#53665f}h1{font-size:32px;line-height:1.15;margin:8px 0}h2{font-size:20px;margin:0 0 12px}section{background:#fff;padding:24px;border:1px solid #d7ded8;border-radius:10px;margin-bottom:20px}form{display:grid;grid-template-columns:1fr 130px;gap:16px}label{display:flex;flex-direction:column;gap:6px;font-weight:600}input,button{font:inherit;border:1px solid #a4b3ab;border-radius:6px;padding:12px;min-height:46px;min-width:0}button{cursor:pointer;background:#244c3b;color:white;font-weight:650}button.secondary{background:white;color:#244c3b}button:focus-visible,input:focus-visible{outline:3px solid #c47926;outline-offset:3px}form button{grid-column:1/-1}#error{color:#a22a22;font-weight:600}.line{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid #d7ded8}.line span{min-width:0}.line button{flex:none}#save{margin-top:20px;width:100%}#success{color:#244c3b;font-weight:650}#runtime{font-size:13px}@media(max-width:520px){main{padding:20px 14px}section{padding:18px}form{grid-template-columns:minmax(0,1fr)}h1{font-size:28px}.line{align-items:flex-start;flex-wrap:wrap}}</style>
<main><header><small>ACME / STOCKROOM</small><h1>Receive a delivery</h1><p>Add the quantities that arrived, review them, then save your receipt.</p><small id="runtime">${connected ? 'Connected to the stockroom service' : 'Local prototype · saved in this browser'}</small></header>
<section><h2 id="form-title">Add received stock</h2><form id="receive"><label>Stock code<input id="sku" required value="AC-104" autocomplete="off"></label><label>Quantity received<input id="quantity" type="number" step="1" value="" inputmode="numeric"></label><button id="add" type="submit">Add to receipt</button></form><p id="error" role="alert"></p></section>
<section><h2>Your receipt</h2><div id="lines"></div><button id="save" disabled>Save receipt</button><p id="success" role="status"></p></section></main>
<script>const connected=${JSON.stringify(connected)},stock={'AC-104':'Cotton gloves','AC-205':'Packing tape'};let lines=[],receiptId=null,editing=null;const $=id=>document.getElementById(id);async function api(url,options){const res=await fetch(url,options);const data=await res.json();if(!res.ok)throw Error(data.error);return data}function render(){$('lines').replaceChildren();if(!lines.length){const p=document.createElement('p');p.textContent='No items received yet.';$('lines').append(p)}for(const [index,line]of lines.entries()){const row=document.createElement('div');row.className='line';const text=document.createElement('span');text.textContent=line.name+' · '+line.quantity+' received';const button=document.createElement('button');button.className='secondary';button.textContent='Correct';button.setAttribute('aria-label','Correct '+line.name);button.onclick=()=>{editing=index;$('sku').value=line.sku;$('quantity').value=line.quantity;$('form-title').textContent='Correct received quantity';$('add').textContent='Save correction';$('quantity').focus()};row.append(text,button);$('lines').append(row)}$('save').disabled=!lines.length;$('save').textContent=receiptId?'Save receipt again':'Save receipt'}$('receive').onsubmit=async event=>{event.preventDefault();$('error').textContent='';const sku=$('sku').value.trim(),quantity=Number($('quantity').value);if(!Number.isSafeInteger(quantity)||quantity<1){$('error').textContent='Enter a whole quantity of at least 1.';return}try{const item=connected?await api('/warehouse/stock?sku='+encodeURIComponent(sku)):{sku,name:stock[sku]};if(!item.name)throw Error('That stock code was not found.');const line={sku,name:item.name,quantity};if(editing===null)lines.push(line);else{lines[editing]=line;if(receiptId){if(connected)await api('/warehouse/receipts/'+receiptId,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({lines})});else localStorage.setItem('acme-receipt',JSON.stringify({id:receiptId,lines}));$('success').textContent='Correction saved.'}}editing=null;$('quantity').value='';$('form-title').textContent='Add received stock';$('add').textContent='Add to receipt';render()}catch(error){$('error').textContent=error.message}};$('save').onclick=async()=>{try{if(connected){const result=await api(receiptId?'/warehouse/receipts/'+receiptId:'/warehouse/receipts',{method:receiptId?'PATCH':'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lines})});receiptId=result.id;const saved=await api('/warehouse/receipts/'+receiptId);lines=saved.lines}else{receiptId='local-receipt';localStorage.setItem('acme-receipt',JSON.stringify({id:receiptId,lines}))}$('success').textContent='Receipt saved. You can correct any quantity.';render()}catch(error){$('error').textContent=error.message}};render();</script></html>`;
}

/** Own an actual loopback stock/receipt service; the journey verifies its persisted in-process records. */
export async function startReceivingRuntime() {
  const html = receivingHtml(true);
  const receipts = new Map();
  const events = [];
  let serial = 0;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const reply = (value, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
    if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); return; }
    events.push({ method: req.method, path: url.pathname });
    if (url.pathname === '/warehouse/stock') { const sku = url.searchParams.get('sku'), name = { 'AC-104': 'Cotton gloves', 'AC-205': 'Packing tape' }[sku]; reply(name ? { sku, name } : { error: 'That stock code was not found.' }, name ? 200 : 404); return; }
    const id = url.pathname.startsWith('/warehouse/receipts/') ? url.pathname.slice('/warehouse/receipts/'.length) : null;
    if (req.method === 'GET' && id) { reply(receipts.get(id) ?? { error: 'Receipt not found.' }, receipts.has(id) ? 200 : 404); return; }
    if ((req.method === 'POST' && url.pathname === '/warehouse/receipts') || (req.method === 'PATCH' && id)) {
      try {
        let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 100_000) throw Error('Receipt too large.'); }
        const { lines } = JSON.parse(raw);
        if (!Array.isArray(lines) || !lines.length || lines.some(line => !['AC-104', 'AC-205'].includes(line.sku) || !Number.isSafeInteger(line.quantity) || line.quantity < 1)) throw Error('A receipt needs valid stock and positive whole quantities.');
        if (id && !receipts.has(id)) { reply({ error: 'Receipt not found.' }, 404); return; }
        const record = { id: id ?? 'receipt-' + ++serial, lines };
        receipts.set(record.id, record); reply(record); return;
      } catch (error) { reply({ error: error.message }, 400); return; }
    }
    reply({ error: 'Not found.' }, 404);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const revision = createHash('sha256').update(await readFile(new URL(import.meta.url))).update(html).digest('hex');
  return { url: `http://127.0.0.1:${server.address().port}`, html, revision, buildId: `acme-${revision.slice(0, 12)}`, receipts, events, close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
