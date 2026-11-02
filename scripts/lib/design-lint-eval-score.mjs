/** Frozen-fixture evaluation bookkeeping. Browser evidence and human ratings stay separate. */
import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const hash = value => createHash('sha256').update(value).digest('hex');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const json = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const sortedDiagnostics = diagnostics => diagnostics.map(({ code, property, actual }) => JSON.stringify([code, property ?? null, actual])).sort();
const fixedPolicy = policy => policy && Object.fromEntries(['status', 'original', 'effective', 'problems', 'boundary'].map(key => [key, policy[key]]));
const appliedIdentities = policy => ['appliedTreatments', 'appliedExceptions'].map(key => (policy?.[key] ?? []).map(({ range: _range, ...identity }) => identity));
const coverageAvailable = audit => audit?.status === 'audited' && typeof audit.coverage?.complete === 'boolean' && Array.isArray(audit.coverage.unexamined) && Array.isArray(audit.coverage.omittedCategories);
const covered = audit => coverageAvailable(audit) && audit.coverage.complete && !audit.coverage.unexamined.length && !audit.coverage.omittedCategories.length && audit.coverage.checkedValues > 0;

/** html must be the bytes re-read after the actual receipt, never candidate-only bytes. */
export function assessAttempt({ task, beforeHtml, html, audit, baselineAudit, protectedUnchanged, browserEvidence, receiptStatus }) {
  const violations = [];
  const require = (code, passed) => { if (!passed) violations.push(code); return !!passed; };
  const available = audit?.status === 'audited' && Array.isArray(audit.diagnostics);
  const baselineAvailable = baselineAudit?.status === 'audited' && Array.isArray(baselineAudit.diagnostics);
  const expected = sortedDiagnostics(task.expected.initialDiagnostics);
  const observed = baselineAvailable ? sortedDiagnostics(baselineAudit.diagnostics) : [];
  const missing = [...expected], unexpected = [];
  for (const value of observed) { const index = missing.indexOf(value); if (index < 0) unexpected.push(JSON.parse(value)); else missing.splice(index, 1); }
  const initialReady = require('initial-diagnostics-or-coverage', baselineAvailable && same(expected, observed) && covered(baselineAudit));
  const byRule = {};
  for (const finding of audit?.diagnostics ?? []) byRule[finding.code] = (byRule[finding.code] ?? 0) + 1;
  const compliance = { available, diagnosticCount: available ? audit.diagnostics.length : null, byRule, passed: require('compliance', available && audit.diagnostics.length === 0), initial: { expected: task.expected.initialDiagnostics, observed: baselineAudit?.diagnostics ?? null, missing: missing.map(value => JSON.parse(value)), unexpected } };
  const coverage = { available: coverageAvailable(audit), complete: require('coverage', covered(audit)), unexamined: audit?.coverage?.unexamined ?? null, omittedCategories: audit?.coverage?.omittedCategories ?? null, newUnexamined: coverageAvailable(audit) && coverageAvailable(baselineAudit) ? Math.max(0, audit.coverage.unexamined.length - baselineAudit.coverage.unexamined.length) + Math.max(0, audit.coverage.omittedCategories.length - baselineAudit.coverage.omittedCategories.length) : null };
  const provenance = {
    storedBytes: require('stored-audit-bytes', available && audit.input?.kind === 'stored' && audit.input.sha256 === hash(html) && baselineAudit?.input?.kind === 'stored' && baselineAudit.input.sha256 === hash(beforeHtml)),
    browserBytes: require('stored-browser-bytes', browserEvidence?.inputHash === hash(html)),
    sameSource: require('source-or-governing-change', available && baselineAvailable && audit.canvasId === baselineAudit.canvasId && audit.itemId === baselineAudit.itemId && audit.ruleVersion === baselineAudit.ruleVersion && same(audit.governing, baselineAudit.governing)),
    receiptAccepted: require('unaccepted-receipt', receiptStatus === 'accepted' || receiptStatus === 'unchanged'),
  };
  const protection = {
    unchanged: require('protected-document-changed', protectedUnchanged === true),
    policyUnchanged: require('effective-policy-changed', available && baselineAvailable && same(fixedPolicy(audit.policy), fixedPolicy(baselineAudit.policy)) && same(appliedIdentities(audit.policy), appliedIdentities(baselineAudit.policy))),
    cleanUnchanged: require('unnecessary-clean-edit', !task.expected.unchangedControl || (html === beforeHtml && receiptStatus === 'unchanged')),
  };
  // applied treatment ranges may move after a repair; compare the fixed policy above
  // without conflating completion with a human's judgment of the rendered result.
  const actualViewports = browserEvidence?.viewports?.map(row => row.viewport);
  const render = {
    available: require('browser-unavailable', browserEvidence?.available === true),
    passed: require('render-or-interaction', browserEvidence?.passed === true && browserEvidence.complete === true && same(actualViewports, task.viewports)),
    interactionFailures: browserEvidence?.available === true ? (browserEvidence.viewports ?? []).filter(row => row.interaction?.passed !== true).length : null,
  };
  return { complete: violations.length === 0, initialReady, compliance, coverage, provenance, protection, render, violations, human: { intent: null, preference: null } };
}

/** Mutations construct failure stimuli only; grading uses audit and actual Chrome evidence. */
export function controlsForTask(task) {
  const html = task.repairedHtml;
  if (typeof html !== 'string') throw new Error('Negative controls need frozen repairedHtml.');
  const style = css => html.replace('</head>', `<style>${css}</style></head>`);
  const rows = [
    ['empty', '<!doctype html><html lang="en"><head><title>Acme empty page control</title></head><body></body></html>'],
    ['hidden', style('#description { display: none; }')],
    ['clipped', style('#description { max-height: 1px; overflow: hidden; }')],
    ['styles-removed', html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')],
    ['new-uncovered', html.replace('</body>', '<script>document.body.dataset.dynamic="true"</script></body>')],
    ['broken-interaction', html.replace(/\s+popovertarget="feedback"/, '')],
    ['transparent-feedback', style('#feedback { color: transparent; }')],
    ['clipped-feedback', style('#feedback { height: 1px; overflow: hidden; padding: 0; }')],
    ['covered-text', html.replace('</body>', '<div style="position:fixed;inset:0;background:white;z-index:9999;pointer-events:none"></div></body>')],
  ];
  if (task.invariants.required.some(row => row.recipe)) rows.push(
    ['recipe-removed', html.replace(/\s+data-isocan-recipe="Button"/, '')],
    ['recipe-renamed', html.replace('data-isocan-recipe="Button"', 'data-isocan-recipe="Other"')],
  );
  if (task.expected.unchangedControl) rows.push(['unnecessary-clean-edit', `${html}\n`]);
  return rows.map(([id, html]) => ({ id, html, expected: { complete: false } }));
}

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const imageOrder = images => [...images].sort((a, b) => a.width - b.width);

/** Copies images to condition-hidden paths; separate arm key must not be shown to raters. */
export function writeBlindReview({ runs, outputDir, seed }) {
  if (['review.html', 'review.json', 'arm-key.json'].some(file => existsSync(path.join(outputDir, file)))) throw new Error('Blind review manifests are immutable; use a fresh output directory.');
  const groups = new Map();
  for (const run of runs) {
    const key = `${run.taskId}:${run.repetition}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(run);
  }
  const assets = path.join(outputDir, 'review-assets');
  mkdirSync(assets, { recursive: true });
  const publicPairs = [], keys = [];
  for (const [group, pair] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    if (pair.length !== 2 || new Set(pair.map(run => run.condition)).size !== 2 || pair.some(run => !['rules-only', 'diagnostics'].includes(run.condition))) throw new Error(`Blind pair ${group} needs exactly one run per condition.`);
    if (pair[0].taskText !== pair[1].taskText) throw new Error('Paired task instructions differ.');
    const ordered = [...pair].sort((a, b) => a.condition.localeCompare(b.condition));
    if (parseInt(hash(`${seed}:${group}`).slice(0, 2), 16) % 2) ordered.reverse();
    const pairId = `pair-${String(publicPairs.length + 1).padStart(2, '0')}`;
    const entry = { pairId, taskText: pair[0].taskText, reference: [], A: { intent: null, images: [] }, B: { intent: null, images: [] }, preference: null };
    const key = { pairId };
    const copyImages = (images, label) => imageOrder(images).map(({ width, height, path: source }) => {
      const bytes = readFileSync(source), filename = `${pairId}-${label}-${width}x${height}.png`;
      copyFileSync(source, path.join(assets, filename));
      return { width, height, path: `review-assets/${filename}`, sha256: hash(bytes) };
    });
    for (const [index, label] of ['A', 'B'].entries()) {
      const run = ordered[index];
      if (!run.htmlHash || run.screenshots?.length !== 2 || run.initialScreenshots?.length !== 2) throw new Error(`Blind review requires stored byte hashes and both render sizes for ${run.runId}.`);
      entry[label].images = copyImages(run.screenshots, label);
      key[label] = { runId: run.runId, condition: run.condition, htmlHash: run.htmlHash, taskId: run.taskId, repetition: run.repetition };
    }
    // A common starting image is valid only if both arms' captured pixels match.
    const initial = ordered.map(run => imageOrder(run.initialScreenshots).map(image => ({ width: image.width, height: image.height, sha256: hash(readFileSync(image.path)) })));
    if (!same(initial[0], initial[1])) throw new Error(`Blind pair ${group} has different initial renderings.`);
    entry.reference = copyImages(ordered[0].initialScreenshots, 'reference');
    publicPairs.push(entry); keys.push(key);
  }
  const binding = { seed, nonce: randomUUID(), pairs: publicPairs };
  const evaluationId = hash(JSON.stringify({ schemaVersion: 1, binding, keys }));
  const review = { schemaVersion: 1, evaluationId, humanRatings: 'pending', pairs: publicPairs };
  const armKey = { schemaVersion: 1, evaluationId, binding, pairs: keys };
  json(path.join(outputDir, 'review.json'), review);
  json(path.join(outputDir, 'arm-key.json'), armKey);
  const images = rows => rows.map(row => `<figure><figcaption>${row.width} × ${row.height}</figcaption><img src="${escape(row.path)}" alt="Rendering at ${row.width} by ${row.height}"></figure>`).join('');
  const intent = (pairId, label) => `<label>Intent <select data-pair="${pairId}" data-arm="${label}"><option value="">Pending</option><option>preserved</option><option>uncertain</option><option>lost</option></select></label>`;
  const sections = publicPairs.map(pair => `<section><h2>${pair.pairId}</h2><p>${escape(pair.taskText)}</p><details><summary>Initial reference</summary><div class="images">${images(pair.reference)}</div></details><div class="pair">${['A', 'B'].map(label => `<article><h3>${label}</h3>${intent(pair.pairId, label)}<div class="images">${images(pair[label].images)}</div></article>`).join('')}</div><label>Preference <select data-pair="${pair.pairId}" data-preference><option value="">Pending</option><option>A</option><option>B</option><option>tie</option></select></label></section>`).join('');
  // The embedded payload is the same condition-hidden review JSON, never the key.
  const payload = JSON.stringify(review).replace(/</g, '\\u003c');
  writeFileSync(path.join(outputDir, 'review.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Paired repair review</title><style>body{font:16px/1.5 system-ui;margin:24px;color:#203040;background:#f4f7fa}section{background:white;padding:24px;margin:24px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{min-width:0}.images{display:flex;flex-wrap:wrap;gap:12px}figure{margin:12px 0;max-width:100%}img{display:block;max-width:100%;height:auto;border:1px solid #ccd}select,button{font:inherit;padding:6px}h3{font-size:24px}</style><h1>Paired repair review</h1><p>Judge each final against the task and initial reference. Browser checks do not supply human intent ratings. Ratings begin pending.</p><button id="download">Download ratings JSON</button>${sections}<script>const review=${payload}; document.querySelectorAll('select').forEach(select=>select.addEventListener('change',()=>{const pair=review.pairs.find(p=>p.pairId===select.dataset.pair);if(select.hasAttribute('data-preference'))pair.preference=select.value||null;else pair[select.dataset.arm].intent=select.value||null}));document.querySelector('#download').onclick=()=>{const data={schemaVersion:1,evaluationId:review.evaluationId,pairs:review.pairs.map(p=>({pairId:p.pairId,A:{intent:p.A.intent},B:{intent:p.B.intent},preference:p.preference}))};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='ratings.json';a.click();URL.revokeObjectURL(a.href)};</script></html>`);
  return { evaluationId, htmlPath: path.join(outputDir, 'review.html'), jsonPath: path.join(outputDir, 'review.json'), armKeyPath: path.join(outputDir, 'arm-key.json'), pairs: publicPairs.length, humanRatings: 'pending' };
}

const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2 : null; };
const improvement = (before, after) => before > 0 ? (before - after) / before : null;

/** Read-only aggregation. Missing evidence and ratings never become zero. */
export function summarizeEvaluation({ records, mode, ratings, armKey }) {
  if (!['dry-run', 'model'].includes(mode)) throw new Error('Unknown evaluation mode.');
  const reasons = [];
  const fail = reason => { if (!reasons.includes(reason)) reasons.push(reason); };
  const conditions = ['rules-only', 'diagnostics'];
  const arms = Object.fromEntries(conditions.map(condition => [condition, records.filter(row => row.condition === condition)]));
  const runIds = new Set(records.map(row => row.runId));
  if (records.length !== 36 || runIds.size !== 36 || Object.values(arms).some(rows => rows.length !== 18)) fail('Expected 36 unique runs and 18 per condition.');
  const tasks = new Set(records.map(row => row.taskId));
  if (tasks.size !== 6 || [...tasks].some(task => conditions.some(condition => {
    const rows = arms[condition].filter(row => row.taskId === task);
    return rows.length !== 3 || !same(rows.map(row => row.repetition).sort(), [1, 2, 3]);
  }))) fail('Expected six tasks with three distinct paired repetitions per condition.');
  if (records.some(row => !Number.isInteger(row.rounds) || row.rounds < 1 || row.rounds > 2)) fail('Correction rounds are missing or outside the fixed budget.');
  if (records.some(row => typeof row.complete !== 'boolean' || row.initialReady !== true || row.protectedUnchanged !== true || row.concurrentSafe !== true)) fail('Readiness or policy/concurrency protection is unavailable or failed.');
  const costReady = records.length > 0 && records.every(row => Number.isFinite(row.apiEquivalentCost) && row.apiEquivalentCost >= 0);
  if (!costReady) fail('Comparable reported API-equivalent costs are unavailable.');
  const coverageReady = records.length > 0 && records.every(row => Number.isInteger(row.newUnexamined) && row.newUnexamined >= 0 && Number.isInteger(row.interactionFailures) && row.interactionFailures >= 0);
  if (!coverageReady) fail('Comparable coverage or interaction evidence is unavailable.');
  const human = { available: false, intentLost: { 'rules-only': null, diagnostics: null }, preference: { 'rules-only': null, diagnostics: null, tie: null } };
  if (ratings) {
    if (!armKey?.binding || armKey.evaluationId !== hash(JSON.stringify({ schemaVersion: 1, binding: armKey.binding, keys: armKey.pairs }))) throw new Error('Review arm key manifest integrity failed.');
    if (!armKey?.evaluationId || ratings.evaluationId !== armKey.evaluationId) throw new Error('Ratings belong to a different evaluation manifest.');
    if (!Array.isArray(ratings.pairs) || !Array.isArray(armKey.pairs) || ratings.pairs.length !== 18 || armKey.pairs.length !== 18) throw new Error('Ratings and arm key must contain all 18 pairs.');
    const keyed = new Map(armKey.pairs.map(pair => [pair.pairId, pair]));
    const rated = new Set(ratings.pairs.map(pair => pair.pairId));
    if (keyed.size !== 18 || rated.size !== 18 || [...rated].some(id => !keyed.has(id))) throw new Error('Duplicate, missing or foreign review pairs.');
    const usedRuns = new Set();
    let pending = false;
    const lost = { 'rules-only': 0, diagnostics: 0 }, preference = { 'rules-only': 0, diagnostics: 0, tie: 0 };
    for (const pair of ratings.pairs) {
      const key = keyed.get(pair.pairId);
      if (key.A?.taskId !== key.B?.taskId || key.A?.repetition !== key.B?.repetition || new Set(['A', 'B'].map(label => key[label]?.condition)).size !== 2) throw new Error('Blind pair has invalid condition mapping.');
      for (const label of ['A', 'B']) {
        const mapped = key[label], row = records.find(row => row.runId === mapped?.runId);
        if (!row || usedRuns.has(row.runId) || row.condition !== mapped.condition || row.taskId !== mapped.taskId || row.repetition !== mapped.repetition || !row.htmlHash || row.htmlHash !== mapped.htmlHash) throw new Error('Arm key does not match the exact evaluated candidates.');
        usedRuns.add(row.runId);
        const value = pair[label]?.intent;
        if (value === null || value === undefined) pending = true;
        else if (!['preserved', 'uncertain', 'lost'].includes(value)) throw new Error('Invalid human intent rating.');
        else if (value === 'lost') lost[mapped.condition] += 1;
      }
      if (pair.preference === null || pair.preference === undefined) pending = true;
      else if (!['A', 'B', 'tie'].includes(pair.preference)) throw new Error('Invalid human preference rating.');
      else preference[pair.preference === 'tie' ? 'tie' : key[pair.preference].condition] += 1;
    }
    if (!pending) Object.assign(human, { available: true, intentLost: lost, preference });
  }
  if (!human.available) fail('Human intent and preference ratings are pending.');
  const metrics = Object.fromEntries(conditions.map(condition => {
    const rows = arms[condition];
    return [condition, { runs: rows.length, completed: rows.filter(row => row.complete === true).length, medianRounds: median(rows.map(row => row.rounds)), medianApiEquivalentCost: costReady ? median(rows.map(row => row.apiEquivalentCost)) : null, interactionFailures: coverageReady ? rows.reduce((sum, row) => sum + row.interactionFailures, 0) : null, newUnexamined: coverageReady ? rows.reduce((sum, row) => sum + row.newUnexamined, 0) : null }];
  }));
  const control = metrics['rules-only'], treatment = metrics.diagnostics;
  const completionDelta = treatment.completed - control.completed;
  const roundsReduction = improvement(control.medianRounds, treatment.medianRounds);
  const costReduction = costReady ? improvement(control.medianApiEquivalentCost, treatment.medianApiEquivalentCost) : null;
  const objectiveThreshold = completionDelta >= 2 || (completionDelta === 0 && (roundsReduction >= 0.2 || costReduction >= 0.2));
  const ceilingEffect = records.length === 36 && records.every(row => row.complete === true && row.rounds === 1);
  const safeguards = coverageReady && human.available && treatment.interactionFailures <= control.interactionFailures && treatment.newUnexamined === 0 && human.intentLost.diagnostics <= human.intentLost['rules-only'];
  const verdict = mode === 'dry-run' ? 'instrumentation-only' : reasons.length ? 'inconclusive' : ceilingEffect ? 'ceiling-effect' : objectiveThreshold && safeguards ? 'proceed-to-larger-trial' : 'do-not-proceed';
  return { schemaVersion: 1, mode, verdict, modelLift: null, reason: mode === 'dry-run' ? 'Canned outputs prove the instrument only; no model comparison occurred.' : null, reasons, metrics, human, comparison: { completionDelta, roundsReduction, apiEquivalentCostReduction: costReduction, objectiveThreshold, safeguards, ceilingEffect }, billedSpend: null };
}
