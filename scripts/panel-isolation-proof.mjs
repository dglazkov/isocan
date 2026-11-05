#!/usr/bin/env node
// Synthetic, loopback-only browser regression. Imports the production frame,
// bridge and React surface; no daemon, real canvas, credentials or provider calls.
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { browser, until } from './lib/browser.mjs';
import { CONTENT_CSP } from '../packages/server/src/content.ts';

const servers = [], operations = [];
let b, maliciousLoads = 0;
async function serve(handler) {
  const server = createServer(handler); servers.push(server);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return `http://127.0.0.1:${server.address().port}`;
}
const html = script => `<!doctype html><title>Acme isolation fixture</title><script>${script}</script>`;
const op = requestId => ({ type: 'isocan:panel-op', version: 1, requestId,
  op: { type: 'item.move', itemId: 'itm_acme', x: 12, y: 34 } });
try {
  const content = await serve((req, res) => {
    res.setHeader('Content-Type', 'text/html'); res.setHeader('Content-Security-Policy', CONTENT_CSP);
    if (req.url.endsWith('/malicious')) {
      maliciousLoads++;
      res.end(html(`parent.postMessage({proof: 'navigation-substitution'}, '*');
        parent.postMessage(${JSON.stringify(op('sibling-navigation'))}, '*');`));
    } else if (req.url.endsWith('/attacker')) {
      res.end(html(`addEventListener('message', e => {
        if (e.source !== parent) return;
        if (e.data === 'navigate') {
          const attempts = [];
          for (let i = 0; i < parent.frames.length; i++) {
            const target = parent.frames[i]; if (target === window) continue;
            for (const method of ['assignment', 'replace']) {
              try {
                const url = new URL('malicious', location.href).href;
                if (method === 'assignment') target.location = url;
                else target.location.replace(url);
                attempts.push({method, outcome: 'accepted'});
              } catch (error) { attempts.push({method, outcome: error.name}); }
            }
          }
          parent.postMessage({proof: 'navigation-attempt', attempts}, '*'); return;
        }
        if (e.data !== 'attack') return;
        let injected = 0, denied = 0;
        for (let i = 0; i < parent.frames.length; i++) {
          const target = parent.frames[i]; if (target === window) continue;
          try { const script = target.document.createElement('script');
            script.textContent = ${JSON.stringify(`parent.postMessage(${JSON.stringify(op('sibling-injection'))}, '*')`)};
            target.document.body.append(script); injected++;
          } catch { denied++; }
        }
        parent.postMessage(${JSON.stringify(op('sibling-direct'))}, '*');
        localStorage.setItem('acme-isolation', 'ordinary-storage');
        parent.postMessage({proof: 'attack', injected, denied, storage: localStorage.getItem('acme-isolation')}, '*');
      });`));
    } else {
      res.end(html(`addEventListener('message', e => {
        if (e.source !== parent) return;
        if (e.data === 'legitimate') {
          let storageDenied = false; try { localStorage.setItem('acme-panel', 'must-not-share'); } catch { storageDenied = true; }
          parent.postMessage({proof: 'panel-storage', storageDenied}, '*');
          parent.postMessage(${JSON.stringify(op('legitimate'))}, '*');
        } else if (e.data?.type === 'isocan:panel-op-result') parent.postMessage({proof: 'reply', result: e.data}, '*');
      });`));
    }
  });
  const bundle = await build({ stdin: { resolveDir: fileURLToPath(new URL('..', import.meta.url)), loader: 'tsx', contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { ExtensionPanelSurface } from './packages/web/src/components/ExtensionPanel.tsx';
    import { itemFrame } from './packages/web/src/lib/frame.ts';
    window.proofs = [];
    addEventListener('message', e => { if (e.data?.proof) window.proofs.push(e.data); });
    const root = createRoot(document.getElementById('root'));
    window.show = (canvasId = 'prj_acme', itemId = 'itm_panel', hash = 'panel') => {
      window.previousFrame = document.querySelector('.extension-panel-frame')?.contentWindow;
      const active = { itemId, title: 'Acme panel', color: '#5b7a8c', panel: {
        kind: 'panel', title: 'Acme panel', side: 'left', src: 'panel.html',
        bytes: { itemId: 'itm_page', blobHash: hash, filename: 'panel.html', mimeType: 'text/html' }
      }};
      flushSync(() => root.render(<ExtensionPanelSurface canvasId={canvasId} active={active} panels={[active]}
        origin={{base: ${JSON.stringify(content)}, ticket: null}} onClose={() => {}} />));
      window.panelLoaded = new Promise(resolve => document.querySelector('.extension-panel-frame').addEventListener('load', resolve, {once:true}));
    };
    window.show();
    const built = itemFrame({base: ${JSON.stringify(content)}, ticket: null}, 'prj_acme', 'attacker');
    const sibling = document.createElement('iframe'); sibling.id = 'sibling'; sibling.src = built.src; sibling.sandbox = built.sandbox;
    document.body.append(sibling); window.ready = true;
  ` }, bundle: true, write: false, platform: 'browser', format: 'esm', jsx: 'automatic', loader: {'.css': 'empty'},
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true' } });
  const app = await serve(async (req, res) => {
    if (req.url === '/proof.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text); return; }
    if (req.url.startsWith('/api/')) {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      res.setHeader('Content-Type', 'application/json');
      if (req.url.endsWith('/actor')) {
        const itemId = req.url.split('/').at(-2);
        res.end(JSON.stringify({ token: 'synthetic-acme-panel-token', actor: {id: `ext_${itemId.slice(4)}`, name: 'Acme panel'} }));
      } else {
        assert.equal(req.url, '/api/ops'); assert.equal(req.headers.authorization, 'Bearer synthetic-acme-panel-token');
        operations.push(body); res.end(JSON.stringify({seq: operations.length, envelope: {id: `op_${operations.length}`}}));
      }
      return;
    }
    res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><div id="root"></div><script type="module" src="/proof.js"></script>');
  });
  // All browser HTTP goes through an owned proxy that refuses non-fixture URLs.
  const allowed = new Set([new URL(app).host, new URL(content).host]);
  const proxy = await serve((req, res) => {
    let url; try { url = new URL(req.url); } catch { res.writeHead(403).end(); return; }
    if (url.protocol !== 'http:' || !allowed.has(url.host)) { res.writeHead(403).end(); return; }
    const forward = request(url, {method: req.method, headers: req.headers}, upstream => {
      res.writeHead(upstream.statusCode, upstream.headers); upstream.pipe(res);
    });
    forward.on('error', () => res.writeHead(502).end()); req.pipe(forward);
  });
  servers.at(-1).on('connect', (_req, socket) => socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'));
  b = await browser({proxyServer: proxy, args: ['--disable-extensions', '--disable-background-networking', '--disable-component-update']});
  await b.send('Page.navigate', {url: app});
  await until(b, 'window.ready && document.querySelectorAll("iframe").length === 2', 'production panel surface');
  // Load is a browser observation, not a fabricated MessageEvent/source object.
  await b.ev(`Promise.all([...document.querySelectorAll('iframe')].map(f => new Promise(resolve => {
    f.addEventListener('load', resolve, {once:true}); f.src = f.src;
  })))`);
  await b.ev(`document.getElementById('sibling').contentWindow.postMessage('attack', '*')`);
  await until(b, `window.proofs.some(p => p.proof === 'attack')`, 'sibling attack attempt');
  await b.ev(`new Promise(resolve => setTimeout(resolve, 100))`);
  const attack = await b.ev(`window.proofs.find(p => p.proof === 'attack')`);
  console.log(JSON.stringify({stage: 'sibling-attack', attack, operations: operations.length}));
  assert.equal(operations.length, 0, 'ordinary sibling acquired panel authority');
  assert.equal(attack.injected, 0, 'ordinary sibling injected into panel document');
  assert.equal(attack.denied, 1); assert.equal(attack.storage, 'ordinary-storage');
  await b.ev(`document.getElementById('sibling').contentWindow.postMessage('navigate', '*')`);
  await until(b, `window.proofs.some(p => p.proof === 'navigation-attempt')`, 'sibling WindowProxy navigation attempt');
  await b.ev(`new Promise(resolve => setTimeout(resolve, 100))`);
  const navigation = await b.ev(`window.proofs.find(p => p.proof === 'navigation-attempt')`);
  console.log(JSON.stringify({stage: 'sibling-navigation', navigation, maliciousLoads, operations: operations.length}));
  assert.deepEqual(navigation.attempts, [{method: 'assignment', outcome: 'SecurityError'}, {method: 'replace', outcome: 'SecurityError'}]);
  assert.equal(maliciousLoads, 0, 'sibling substituted attacker bytes in panel window');
  assert.equal(operations.length, 0, 'sibling navigation acquired panel authority');
  assert.equal(await b.ev(`window.proofs.some(p => p.proof === 'navigation-substitution')`), false);
  for (const [canvas, item, hash] of [['prj_acme', 'itm_panel', 'panel'], ['prj_acme', 'itm_other', 'panel'],
    ['prj_acme', 'itm_other', 'panel2'], ['prj_other', 'itm_other', 'panel2']]) {
    if (operations.length) {
      await b.ev(`window.show(${JSON.stringify(canvas)}, ${JSON.stringify(item)}, ${JSON.stringify(hash)}); window.panelLoaded`);
      assert.equal(await b.ev(`document.querySelector('.extension-panel-frame').contentWindow !== window.previousFrame`), true, 'switch reused panel WindowProxy');
    }
    const count = operations.length;
    await b.ev(`document.querySelector('.extension-panel-frame').contentWindow.postMessage('legitimate', '*')`);
    await until(b, `window.proofs.filter(p => p.proof === 'reply').length === ${count + 1}`, 'legitimate operation result');
    assert.equal(operations.length, count + 1); assert.equal(operations.at(-1).canvasId, canvas);
    assert.equal(operations.at(-1).actor.id, `ext_${item.slice(4)}`);
  }
  const proofs = await b.ev('window.proofs');
  assert.ok(proofs.filter(p => p.proof === 'panel-storage').every(p => p.storageDenied));
  for (const {result} of proofs.filter(p => p.proof === 'reply')) {
    assert.deepEqual(Object.keys(result).sort(), ['id', 'ok', 'requestId', 'seq', 'type', 'version']);
    assert.equal(result.ok, true);
  }
  console.log(JSON.stringify({status: 'passed', legitimateOperations: operations.length, switchKinds: ['panel', 'blob', 'canvas'],
    siblingInjection: 'refused', siblingNavigation: 'refused', ordinaryStorage: 'preserved', panelStorage: 'denied', replies: 'sanitized', externalRequestsForwarded: 0}));
} finally {
  if (b) await b.close();
  await Promise.all(servers.map(server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); })));
}
