#!/usr/bin/env node
/** Run with `node --import tsx scripts/journey-questionnaire.mjs` after building the web app.
 * An owned daemon, real Chrome controls and CLI calls prove questionnaire persistence and parity.
 * All names/files are synthetic. No model calls or external services are involved.
 */
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { CanvasHandle } from '../packages/api/src/connect.ts';
import { makeFixture, click, navigate, screenshot } from './lib/personal-journey-fixture.mjs';
import { until } from './lib/browser.mjs';
const f = await makeFixture();
const b = f.owner;
const output = f.output;
const key = async (name, code) => {
  await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: name, windowsVirtualKeyCode: code });
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, windowsVirtualKeyCode: code });
};
async function clickText(text, scope = 'button') {
  await b.ev(`(() => { const e=[...document.querySelectorAll(${JSON.stringify(scope)})].find(e=>e.textContent.trim()===${JSON.stringify(text)}); if(!e)throw Error('Missing '+${JSON.stringify(text)}); e.dataset.questionnaireJourney='target';return true; })()`);
  try { await click(b, '[data-questionnaire-journey="target"]'); }
  finally { await b.ev(`document.querySelector('[data-questionnaire-journey]')?.removeAttribute('data-questionnaire-journey')`); }
}
async function labelControl(label, tag, callback) {
  await b.ev(`(() => { const label=[...document.querySelectorAll('.q-publish label')].find(e=>e.textContent.trim().startsWith(${JSON.stringify(label)})); const e=label?.querySelector(${JSON.stringify(tag)}); if(!e)throw Error('Missing field '+${JSON.stringify(label)});e.dataset.questionnaireJourney='field';return true; })()`);
  try { await click(b, '[data-questionnaire-journey="field"]'); await callback(); }
  finally { await b.ev(`document.querySelector('[data-questionnaire-journey]')?.removeAttribute('data-questionnaire-journey')`); }
}
async function choose(label, value) {
  await b.ev(`(() => { const label=[...document.querySelectorAll('.q-publish label')].find(e=>e.textContent.trim().startsWith(${JSON.stringify(label)}));const e=label?.querySelector('select');if(!e)throw Error('Missing select');e.dataset.questionnaireJourney='field';return true; })()`);
  try {
    // Headless Chrome's native OS popup does not consume CDP key events. Reach the closed
    // select through actual Tab navigation, then use the browser's native select keys.
    await click(b, '.q-publish h3');
    for(let i=0;i<30&&!await b.ev(`document.activeElement===document.querySelector('[data-questionnaire-journey="field"]')`);i++) await key('Tab',9);
    assert(await b.ev(`document.activeElement===document.querySelector('[data-questionnaire-journey="field"]')`), 'Tab reaches '+label);
    const option = await b.ev(`Array.from(document.querySelector('[data-questionnaire-journey="field"]').options).find(o=>o.value===${JSON.stringify(value)})?.textContent`);
    assert(option, `option ${value} exists`);
    // Native typeahead reaches the named choice even where macOS headless Chrome leaves
    // arrow-key select popups to the OS. These remain browser-delivered keyboard events.
    for (const ch of option) { await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch }); }
    await key('Tab',9);
    assert.equal(await b.ev(`document.querySelector('[data-questionnaire-journey="field"]').value`),value,'keyboard selection for '+label);
  } finally { await b.ev(`document.querySelector('[data-questionnaire-journey]')?.removeAttribute('data-questionnaire-journey')`); }
}
async function fill(selector, text) { await click(b, selector); await b.send('Input.insertText', { text }); }
async function upload(file) {
  await b.send('Page.setInterceptFileChooserDialog', { enabled: true });
  const opened = b.once('Page.fileChooserOpened');
  await click(b, '.q-upload-area input[type=file]');
  const chooser = await opened;
  await b.send('DOM.setFileInputFiles', { files: [file], backendNodeId: chooser.backendNodeId });
  await until(b, `document.querySelector('.q-upload-row [role=status]')?.textContent==='Uploaded'`, 'the exact upload to be acknowledged');
  await until(b, `document.querySelector('.q-reference-preview img')?.complete && document.querySelector('.q-reference-preview img')?.naturalWidth>0`, 'the uploaded sketch thumbnail to render');
}
async function fault(afterCommit = false) {
  let captured, resolve, reject;
  const observed = new Promise((yes, no) => { resolve = yes; reject = no; });
  const timer = setTimeout(() => reject(Error('The armed questionnaire write never reached the transport')), 15000);
  const unsubscribe = b.on('Fetch.requestPaused', (event) => {
    void (async () => {
      let body; try { body = JSON.parse(event.request.postData ?? '{}'); } catch { body = {}; }
      if (captured || body.op?.type !== 'questionnaire.answer' || afterCommit && event.responseStatusCode !== 200) return b.send('Fetch.continueRequest', { requestId: event.requestId });
      captured = body;
      await b.send('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: afterCommit ? 408 : 503, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify({ error: 'Synthetic interrupted answer acknowledgement' })).toString('base64') });
      clearTimeout(timer); resolve(body);
    })().catch(reject);
  });
  await b.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/ops', requestStage: afterCommit ? 'Response' : 'Request' }] });
  return { observed, close: async () => { clearTimeout(timer); await b.send('Fetch.disable'); unsubscribe(); } };
}
const files = [];
try {
  const ctx = { client: f.client, actor: f.maya, home: f.clientHome, harness: 'web', birthHome: null, binding: null, homeOf: async () => null };
  const canvas = new CanvasHandle(ctx, (await f.client.snapshot(f.shared)).project);
  const original = await canvas.notify('Design an Acme receiving screen with two reference sketches.');
  const brief = { schemaVersion: 1, kind: 'brief', requestId: 'req_journey_receiving', epoch: 1, requestingActorId: f.maya.id, source: { entrance: 'canvas-chat', threadId: original.threadId, commentId: original.commentId }, progress: 'active', intent: 'create', fidelity: 'designed', delivery: 'html-node', targetItemId: null, groupId: null, audience: 'Receiving staff', primaryTask: 'Receive and correct stock', constraints: ['Phone and desktop'], facts: [], context: await canvas.context(), references: [], outstandingDecisionIds: [], outputIds: [] };
  const item = await canvas.add({ title: 'Acme receiving brief', content: JSON.stringify(brief), mime: 'application/json' });
  const version = item.versions.find(v => v.id === item.currentVersionId);
  const basis = { home: f.base, canvasId: f.shared, itemId: item.id, versionId: version.id, blobHash: version.blobHash };
  await f.client.claimActor({ type: 'actor.claim', sessionKey: 'codex:questionnaire-journey-helper', name: 'Acme Helper' });
  const helper = (await f.client.actorBindings(['codex:questionnaire-journey-helper']))[0].actor;
  const question = (id, renderer) => ({ id, title: id, consequence: 'This informs the receiving task design.', renderer, options: [], multiple: false, skippable: true, delegatable: false });
  const questions = { schemaVersion: 1, kind: 'questions', requestId: brief.requestId, epoch: 1, id: 'questions_journey', revision: 1, brief: basis, respondentActorId: f.maya.id, headline: 'Receiving references', inferredAnswers: [], questions: [question('First sketch', 'upload'), question('Second sketch', 'upload'), question('First reference', 'url-collection'), question('Second reference', 'url-collection'), question('Receiving notes', 'freeform')], supersedes: null };
  const questionFile = path.join(output, 'questions.json'); await fs.writeFile(questionFile, JSON.stringify(questions));
  await f.cli('--canvas', f.shared, 'design', 'ask', questionFile, '--thread', original.threadId, '--json');
  for (const [index, text] of ['Review the whole receipt', 'Confirm each scanned item'].entries()) {
    const dir = path.join(output, String(index)); await fs.mkdir(dir);
    const file = path.join(dir, 'sketch.svg');
    await fs.writeFile(file, `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#fff9ed"/><text x="20" y="80" fill="#273443">${text}</text></svg>`); files.push(file);
  }
  await navigate(b, `${f.base}/p/${f.shared}`);
  await until(b, `document.querySelector('[data-question-payload="questions_journey"]') !== null`, 'published CLI question');
  await upload(files[0]); await clickText('Continue');
  assert.equal(await b.ev(`document.querySelectorAll('.q-upload-row').length`), 0, 'successive upload questions have separate state');
  await upload(files[1]); await clickText('Continue');
  await fill('.q-url-area input', 'https://example.invalid/first'); await key('Enter', 13); await clickText('Continue');
  assert.equal(await b.ev(`document.querySelectorAll('.q-url-reference').length`), 0, 'successive URL questions have separate state');
  await fill('.q-url-area input', 'https://example.invalid/second'); await clickText('Add URL'); await clickText('Continue');
  await fill('.q-textarea', 'Keep receiving separate from stock lookup.');
  await clickText('Back'); await b.send('Page.reload');
  await until(b, `document.querySelector('.q-url-reference a')?.textContent==='https://example.invalid/second'`, 'URL draft after refresh');
  await f.client.sendOp(f.shared, helper, { type: 'thread.reply', threadId: original.threadId, comment: { id: 'comment_helper_progress', body: 'Still researching; the questions remain for Maya.' } });
  await clickText('Continue');
  assert.equal(await b.ev(`document.querySelector('.q-textarea').value`), 'Keep receiving separate from stock lookup.');
  const outage = await fault(); await clickText('Submit answers'); const interrupted = await outage.observed; await outage.close();
  await until(b, `document.querySelector('.q-error')?.textContent.includes('Synthetic')`, 'retryable failure');
  assert.equal((await canvas.designQuestions())[0].status, 'open');
  await b.send('Page.reload'); await until(b, `[...document.querySelectorAll('button')].some(e=>e.textContent==='Retry submission')`, 'saved retry after refresh');
  await clickText('Retry submission'); await until(b, `!document.querySelector('[data-question-payload="questions_journey"]')`, 'one accepted answer');
  const saved = (await canvas.designQuestions())[0]; assert.equal(saved.status, 'answered'); assert.equal(saved.responses.length, 1);
  assert.equal(saved.responses[0].response.id, interrupted.op.response.id, 'retry preserves response identity');
  const references = saved.resolutions.flatMap(r => r.state === 'answered' && r.value.kind === 'references' ? r.value.references : []).filter(r => r.artifact);
  assert.equal(references.length, 2); assert.notEqual(references[0].artifact.blobHash, references[1].artifact.blobHash);
  for (const [index, ref] of references.entries()) {
    const target = path.join(output, `read-${index}.svg`);
    await f.cli('--canvas', f.shared, 'design', 'reference', saved.source.threadId, saved.responses[0].commentId, ref.id, '--out', target, '--json');
    assert.deepEqual(await fs.readFile(target), await fs.readFile(files[index]), 'CLI opens exact uploaded bytes');
  }
  await screenshot(b, path.join(output, 'answered.png'));
  await clickText('Ask design questions'); await until(b, `document.querySelector('.q-publish select option[value="${item.id}"]') !== null`, 'brief choices');
  await choose('Design brief', item.id); await choose('Who should answer?', f.maya.id);
  await labelControl('Question', 'input', () => b.send('Input.insertText', { text: 'Which stock correction matters first?' }));
  await labelControl('Why this affects', 'textarea', () => b.send('Input.insertText', { text: 'This decides the first correction control.' }));
  await clickText('Publish questions'); await until(b, `!document.querySelector('.q-publish')`, 'browser-published question');
  const browserQuestion = (await canvas.designQuestions()).find(s => s.questions.id !== questions.id);
  assert(browserQuestion, 'CLI-readable browser question exists');
  await f.cli('--canvas', f.shared, 'design', 'answer', browserQuestion.questions.id, '--id', 'answer_cli_reverse', '--question', browserQuestion.questions.questions[0].id, '--text', 'Correct a damaged delivery first.', '--json');
  await until(b, `!document.querySelector('[data-question-payload="${browserQuestion.questions.id}"]')`, 'CLI answer resolves browser question');
  await click(b, 'button[title="Undo (⌘Z)"]');
  await until(b, `document.querySelector('[data-question-payload="${browserQuestion.questions.id}"]') !== null`, 'one undo reopens the answer');
  await b.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await navigate(b, `${f.base}/p/${f.shared}`);
  await until(b, `document.querySelector('[data-question-payload="${browserQuestion.questions.id}"]') !== null`, 'narrow questionnaire');
  await fill('.q-textarea', 'Correct damaged items before saving.');
  await key('Tab', 9);
  assert(await b.ev(`document.activeElement && document.activeElement !== document.body`), 'keyboard focus reaches a control');
  const clipped = await b.ev(`(()=>{const e=document.querySelector('.q-dock-container');return e.scrollWidth>e.clientWidth+1})()`); assert.equal(clipped, false, 'narrow questionnaire does not overflow');
  await screenshot(b, path.join(output, 'narrow.png'));
  const lost = await fault(true); await clickText('Submit answers'); await lost.observed; await lost.close();
  await until(b, `!document.querySelector('[data-question-payload="${browserQuestion.questions.id}"]')`, 'writer-observed answer survives HTTP408 acknowledgement loss');
  assert.equal((await canvas.designQuestions()).find(s => s.questions.id === browserQuestion.questions.id).responses.length, 1);
  console.log(JSON.stringify({ ok: true, output, checks: ['group uploads', 'successive uploads and URLs', 'freeform and reference refresh', 'unrelated agent reply', 'failed-submit refresh/retry', 'exact CLI bytes', 'browser publish and CLI answer', 'one undo', 'keyboard focus', '390px width', 'committed answer with lost HTTP408 receipt'] }, null, 2));
} catch (error) { await screenshot(b, path.join(output, 'failure.png')).catch(() => {}); console.error('Questionnaire journey evidence:', output); throw error; }
finally { await f.close(); }
