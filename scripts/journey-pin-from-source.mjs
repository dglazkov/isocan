// Run after npm run build: node --import ./index.mjs scripts/journey-pin-from-source.mjs
// Memory phase 6 (docs/projects/memory/pin-from-source.md) in an ACTUAL browser.
//
// The picker's layout is the half no source-reading test can answer. A CSS rule
// saying `grid-template-columns: auto minmax(0, 1fr)` is not a rendered layout,
// and "the sentence is in the DOM" is not "a person can read the sentence" —
// a zero-height box, a covering overlay and `visibility: hidden` all satisfy
// the first and none satisfy the second. So everything below is measured from
// getBoundingClientRect and elementFromPoint, at 1440px and at 390px.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeFixture, click, navigate, screenshot, until } from './lib/personal-journey-fixture.mjs';
const repo = fileURLToPath(new URL('../', import.meta.url));
const { designSystemProperties } = await import('../packages/core/src/index.ts');
const { CanvasGroups } = await import(pathToFileURL(path.join(repo, 'packages/api/src/canvas-groups.ts')).href);

const f = await makeFixture(), b = f.owner;
const source = 'prj_pin_library', sourceTitle = 'Acme Design System';
const CHECKLIST = 'Acme review checklist', PACK = 'Acme review pack', DESIGN = 'Acme DESIGN.md';

const key = async (k, code, modifiers = 0) => { for (const type of ['keyDown', 'keyUp']) await b.send('Input.dispatchKeyEvent', { type, key: k, code, modifiers }); };
const clickText = async (text) => {
  const selector = await b.ev(`(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Missing '+${JSON.stringify(text)});e.dataset.journeyControl='selected';return '[data-journey-control=selected]'})()`);
  await click(b, selector); await b.ev(`document.querySelector('[data-journey-control=selected]')?.removeAttribute('data-journey-control')`);
};
const openContext = async () => {
  await key('k', 'KeyK', 4); await until(b, 'document.querySelector(".palette-field")!==null', 'palette');
  await b.send('Input.insertText', { text: 'Open Context' });
  await until(b, 'document.querySelector(".palette-row")?.textContent.includes("Open Context")', 'Context action');
  await click(b, '.palette-row');
  await until(b, 'document.querySelector(".ctx-layer")!==null', 'Context panel');
};
const op = (id, operation, actor = f.maya) => f.client.sendOp(id, actor, operation);
const note = async (id, itemId, title, properties = {}, content = 'ACME_SOURCE_BYTES', at = { x: 0, y: 0 }) => {
  const blob = await f.client.uploadBlob(id, Buffer.from(content), 'text/plain', 'note.txt');
  await op(id, { type: 'item.add', itemId, title, width: 300, height: 180, placement: at, properties, version: { ...blob, id: 'ver_' + itemId, mimeType: 'text/plain', filename: 'note.txt' } });
};

/**
 * **Readable means measured, not present.** A control counts only when it has
 * real area, sits inside the viewport, is not `hidden`/`visibility:hidden`, and
 * is what `elementFromPoint` finds at its own centre — the last being the one
 * that catches an overlay lying on top of it.
 */
const readable = (selector, label) => b.ev(`(()=>{
  const e=document.querySelector(${JSON.stringify(selector)});
  if(!e) throw Error('missing '+${JSON.stringify(label)});
  const r=e.getBoundingClientRect(), s=getComputedStyle(e);
  const hit=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
  return {text:(e.textContent||'').trim(), width:r.width, height:r.height, left:r.left, right:r.right, top:r.top, bottom:r.bottom,
          vw:innerWidth, vh:innerHeight, visibility:s.visibility, display:s.display, opacity:Number(s.opacity),
          covered: !(hit && (e===hit || e.contains(hit) || hit.contains(e))),
          scroll:e.scrollWidth, client:e.clientWidth};
})()`);
const assertReadable = async (selector, label, at) => {
  const m = await readable(selector, label);
  assert(m.width > 1 && m.height > 1, `${label} has no area at ${at}: ${JSON.stringify(m)}`);
  assert(m.visibility === 'visible' && m.display !== 'none' && m.opacity > 0.01, `${label} is not shown at ${at}: ${JSON.stringify(m)}`);
  assert(!m.covered, `${label} is covered at ${at}: ${JSON.stringify(m)}`);
  assert(m.left >= 0 && m.right <= m.vw + 1, `${label} spills horizontally at ${at}: ${JSON.stringify(m)}`);
  assert(m.top >= 0 && m.bottom <= m.vh + 1, `${label} is off-screen at ${at}: ${JSON.stringify(m)}`);
  assert(m.scroll <= m.client + 1, `${label} overflows its own box at ${at}: ${JSON.stringify(m)}`);
  return m;
};
/** The picker's own blocks must not lie on each other, at either width. */
const overlaps = () => b.ev(`(()=>{
  const boxes=[...document.querySelectorAll('.ctx-pin-piece, .ctx-pin-picker > .ctx-why, .ctx-pin-actions')]
    .map(e=>({e,r:e.getBoundingClientRect()})).filter(({r})=>r.width>1&&r.height>1);
  const hits=[];
  for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i].r, c=boxes[j].r;
    const x=Math.min(a.right,c.right)-Math.max(a.left,c.left), y=Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top);
    if(x>2&&y>2) hits.push(boxes[i].e.className+' overlaps '+boxes[j].e.className+' by '+Math.round(x)+'x'+Math.round(y));
  }
  return hits;
})()`);
const spill = () => b.ev('document.documentElement.scrollWidth');
const pickerSelector = '.ctx-pin[aria-label="Copy a piece here"]';
const sentence = '.ctx-pin-picker > .ctx-why:last-of-type';

/** Open the picker on the inherited layer and wait for the offers to arrive. */
const openPicker = async () => {
  await until(b, `[...document.querySelectorAll('.ctx-layer')].some(l=>l.getAttribute('aria-label')===${JSON.stringify(sourceTitle)}&&l.querySelector('${pickerSelector}'))`, 'the picker on the inherited layer');
  const control = await b.ev(`(()=>{
    const layer=[...document.querySelectorAll('.ctx-layer')].find(l=>l.getAttribute('aria-label')===${JSON.stringify(sourceTitle)});
    const e=[...layer.querySelectorAll('button')].find(e=>e.textContent.trim()==='Copy a piece here');
    if(!e) throw Error('no Copy a piece here on the inherited layer');
    e.dataset.journeyControl='pin'; return '[data-journey-control=pin]';
  })()`);
  await assertReadable(control, '"Copy a piece here"', 'open');
  await click(b, control);
  await until(b, `document.querySelector('.ctx-pin-picker')!==null&&document.querySelectorAll('.ctx-pin-piece').length>0`, 'the piece list', 30_000);
};

try {
  // ---- a synthetic source with a design note, a pin, and a pinned group ----
  await op(null, { type: 'project.create', canvasId: source, title: sourceTitle, groupMode: 'groups' });
  await note(source, 'itm_pin_design', DESIGN, designSystemProperties(), '# Acme\n\nspacing: 8px\n', { x: 0, y: 0 });
  await note(source, 'itm_pin_one', 'Acme step one', {}, 'one\n', { x: 700, y: 300 });
  await note(source, 'itm_pin_two', 'Acme step two', {}, 'two\n', { x: 760, y: 340 });
  const pack = (await new CanvasGroups(f.client, source, f.maya).wrap(['itm_pin_one', 'itm_pin_two'], PACK, { note: 'Acme brief' })).itemId;
  await op(source, { type: 'item.update', itemId: pack, patch: { properties: { context: 'pinned' } } });
  await note(source, 'itm_pin_checklist', CHECKLIST, { context: 'pinned' }, '- read the brief\n', { x: 0, y: 900 });

  const placed = await f.cli('canvas', 'place', source, '--inherit', '--canvas', f.shared, '--json');
  assert.equal(placed.inherit, true, 'the source is inherited on the destination');
  const before = { source: await f.client.snapshot(source), log: await f.daemon.engine.getLog(f.shared) };

  // ---------------------------- desktop, 1440px ----------------------------
  await b.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate(b, f.base + '/p/' + f.shared);
  await until(b, 'document.querySelector(".canvas-page")!==null', 'the canvas');
  await openContext();
  await openPicker();

  // The source is NAMED in the picker, and the offers are its current design
  // and its ambient pins — not its item list.
  const heading = await assertReadable('.ctx-pin-picker > .ctx-why', 'the picker heading', '1440px');
  assert(heading.text.includes(sourceTitle), 'the picker names its source: ' + heading.text);
  const offered = await b.ev(`[...document.querySelectorAll('.ctx-pin-name')].map(e=>e.textContent.trim())`);
  assert.deepEqual([...offered].sort(), [DESIGN, PACK, CHECKLIST].sort(), 'offers are design + ambient pins: ' + JSON.stringify(offered));
  assert(!offered.includes('Acme step one'), 'a group child is not offered on its own');

  // The sentence a person needs AT the moment of the decision, actually read
  // off the screen rather than out of the DOM.
  const said = await assertReadable(sentence, 'the copy-of-the-current-version sentence', '1440px');
  assert(said.text.includes('copies the current version'), 'sentence says it is a copy: ' + said.text);
  assert(said.text.includes('will not update it'), 'sentence says the source will not update it: ' + said.text);
  assert(said.text.includes(sourceTitle), 'sentence names the source: ' + said.text);

  // A group says how many items BEFORE the button is pressed.
  const count = await b.ev(`(()=>{
    const row=[...document.querySelectorAll('.ctx-pin-piece')].find(e=>e.querySelector('.ctx-pin-name')?.textContent.trim()===${JSON.stringify(PACK)});
    row.querySelector('.ctx-pin-count').dataset.journeyControl='count'; return true;})()`);
  assert(count);
  const counted = await assertReadable('[data-journey-control=count]', 'the group item count', '1440px');
  assert.equal(counted.text, 'copies 3 items', 'the group says its size: ' + counted.text);
  await b.ev(`document.querySelector('[data-journey-control=count]')?.removeAttribute('data-journey-control')`);

  assert.deepEqual(await overlaps(), [], 'picker blocks overlap at 1440px');
  assert(await spill() <= 1441, 'the page spills horizontally at 1440px');
  await screenshot(b, path.join(f.output, 'pin-picker-desktop.png'));
  console.log('ACTUAL_BROWSER_PICKER_NAMES_SOURCE_OFFERS_SENTENCE_AND_GROUP_SIZE', true);

  // ------------------------------ copy and pin -----------------------------
  await click(b, 'input[type=radio][value="itm_pin_checklist"]');
  await clickText('Copy and pin');
  await until(b, `[...document.querySelectorAll('.ctx-pin [role=status]')].some(e=>e.textContent.includes('is copied here and pinned'))`, 'the copy to land', 60_000);

  // Local Context shows the copied piece WITH its source beside it.
  await until(b, `document.querySelector('.ctx-copied-row[data-source-canvas="${source}"]')!==null`, 'the copied row in local Context', 60_000);
  const provenance = await assertReadable(`.ctx-copied-row[data-source-canvas="${source}"]`, 'the copied piece and its source', '1440px');
  assert(provenance.text.includes(CHECKLIST), 'the copied piece is named: ' + provenance.text);
  assert(provenance.text.includes(sourceTitle), 'its source is beside it: ' + provenance.text);
  const localLayer = await b.ev(`[...document.querySelectorAll('.ctx-layer')].find(l=>l.getAttribute('aria-label')==='This canvas')?.textContent`);
  assert(localLayer.includes('Copied from a source'), 'local Context names the copied row');
  await b.ev(`document.querySelector('.ctx-copied-row[data-source-canvas="${source}"]').scrollIntoView({behavior:'instant',block:'center'})`);
  await screenshot(b, path.join(f.output, 'pin-copied-desktop.png'));

  // One accepted operation, and the source is untouched by it.
  const log = await f.daemon.engine.getLog(f.shared);
  const added = log.slice(before.log.length);
  assert.equal(added.length, 1, 'exactly one accepted operation: ' + JSON.stringify(added.map(e => e.envelope.op.type)));
  assert.equal(added[0].envelope.op.type, 'group.change', 'and it is the existing copy act');
  assert.deepEqual(await f.client.snapshot(source), before.source, 'the source is unchanged by the copy');
  console.log('ACTUAL_BROWSER_COPY_ONE_OP_SOURCE_BESIDE_PIECE_SOURCE_UNCHANGED', true);

  // -------------------------------- 390px ----------------------------------
  await click(b, 'button[aria-label="Close the context view"]');
  await b.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await until(b, 'document.querySelector(".phone-face")!==null', 'the phone face');
  await click(b, 'button[aria-label="More canvas options"]'); await clickText('Context');
  await until(b, 'document.querySelector(".ctx-layer")!==null', 'phone Context');

  // The copy made above is still the thing a person reads, at phone width.
  await b.ev(`document.querySelector('.ctx-copied-row[data-source-canvas="${source}"]').scrollIntoView({behavior:'instant',block:'center'})`);
  const phoneProvenance = await assertReadable(`.ctx-copied-row[data-source-canvas="${source}"]`, 'the copied piece and its source', '390px');
  assert(phoneProvenance.text.includes(CHECKLIST) && phoneProvenance.text.includes(sourceTitle), 'phone shows the source beside the piece: ' + phoneProvenance.text);
  await screenshot(b, path.join(f.output, 'pin-copied-phone.png'));

  await openPicker();
  const phoneHeading = await assertReadable('.ctx-pin-picker > .ctx-why', 'the picker heading', '390px');
  assert(phoneHeading.text.includes(sourceTitle));
  await b.ev(`document.querySelector(${JSON.stringify(sentence)}).scrollIntoView({behavior:'instant',block:'center'})`);
  const phoneSaid = await assertReadable(sentence, 'the copy-of-the-current-version sentence', '390px');
  assert(phoneSaid.text.includes('copies the current version') && phoneSaid.text.includes('will not update it'), 'phone sentence: ' + phoneSaid.text);

  // Every piece row, and both buttons, measured rather than asserted from CSS.
  const rows = await b.ev(`[...document.querySelectorAll('.ctx-pin-piece')].map((e,i)=>{e.dataset.journeyRow=String(i);return i;})`);
  for (const index of rows) await assertReadable(`[data-journey-row="${index}"]`, `piece row ${index}`, '390px');
  await b.ev(`document.querySelectorAll('[data-journey-row]').forEach(e=>e.removeAttribute('data-journey-row'))`);
  const buttons = await b.ev(`(()=>{const a=document.querySelector('.ctx-pin-actions');a.scrollIntoView({behavior:'instant',block:'center'});
    return [...a.querySelectorAll('button')].map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent.trim(),left:r.left,right:r.right,width:r.width,height:r.height,disabled:e.disabled,vw:innerWidth};});})()`);
  assert.deepEqual(buttons.map(x => x.text), ['Copy and pin', 'Cancel'], 'both decisions are on the phone: ' + JSON.stringify(buttons));
  for (const button of buttons) assert(button.left >= 0 && button.right <= button.vw + 1 && button.width > 1, 'a decision spills at 390px: ' + JSON.stringify(button));
  // A choice is selected by default, so the act must be PRESSABLE — a decision
  // that is on screen and disabled is not a decision.
  assert.equal(buttons.find(x => x.text === 'Copy and pin').disabled, false, 'Copy and pin is pressable with a piece chosen at 390px: ' + JSON.stringify(buttons));

  assert.deepEqual(await overlaps(), [], 'picker blocks overlap at 390px');
  const phoneSpill = await spill();
  assert(phoneSpill <= 391, `the page spills horizontally at 390px: scrollWidth=${phoneSpill}`);
  await screenshot(b, path.join(f.output, 'pin-picker-phone.png'));
  console.log('ACTUAL_390PX_PICKER_READABLE_NO_SPILL_NO_OVERLAP', true);

  assert.deepEqual(b.takeErrors(), [], 'the page threw nothing while the picker was driven');
  console.log('PIN_FROM_SOURCE_BROWSER_PROOF_PASS');
} catch (error) {
  console.log('FAIL_DOM', await b.ev('document.body.innerText.slice(-12000)').catch(() => '(no DOM)'));
  await screenshot(b, path.join(f.output, 'pin-failure.png')).catch(() => {});
  throw error;
} finally { await f.close(); console.log('PIN_PROOF_ARTIFACTS', f.output); }
