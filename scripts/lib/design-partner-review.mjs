/** Local review instruments preserve exact evidence and never turn test ratings into study authority. */
import { promises as fs } from "node:fs";
import path from "node:path";
import http from "node:http";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { STUDY_UNCERTAINTY, executionIdentity } from "./design-partner-execution.mjs";
import { studyHash, studyJson, studyPath } from "./design-partner-runtime.mjs";
import { validateStudyResultEvidence } from "./design-partner-results.mjs";
import { loadCorpus, validateManifestInputs } from "./design-partner-eval.mjs";

/** The preregistered craft dimensions; every initial score is empty. */
export const CRAFT_DIMENSIONS = Object.freeze(["hierarchy", "typography", "composition", "content", "interactionStates", "responsiveness", "productSpecificity", "briefAdherence", "overall"]);
const TIMING_RULE = "acceptable-task-pass-majority-craft-4-control-half-v1";
const STUDY_TASKS = fileURLToPath(new URL("../../docs/projects/design-partner/study-tasks.json", import.meta.url));
const require = (ok, message) => { if (!ok) throw new Error(message); };
const text = value => typeof value === "string" && value.trim().length > 0;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const score = value => Number.isInteger(value) && value >= 1 && value <= 5;
const outcomes = ["left", "right", "tie", "both-unusable"];
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const quantile = (sorted, q) => { if (!sorted.length) return null; const at = (sorted.length - 1) * q, low = Math.floor(at); return sorted[low] + (sorted[Math.ceil(at)] - sorted[low]) * (at - low); };
const summary = values => { const sorted = values.filter(v => typeof v === "number" && Number.isFinite(v) && v >= 0).sort((a, b) => a - b); return { known: sorted.length, unknown: values.length - sorted.length, median: quantile(sorted, .5), p90: quantile(sorted, .9), maximum: sorted.at(-1) ?? null }; };
const timeRange = (a, b) => text(a) && text(b) && Number.isFinite(Date.parse(a)) && Date.parse(b) >= Date.parse(a);
const blankRating = () => ({ outcome: null, reason: null, left: Object.fromEntries(CRAFT_DIMENSIONS.map(k => [k, null])), right: Object.fromEntries(CRAFT_DIMENSIONS.map(k => [k, null])), criticalDefects: { left: [], right: [] }, startedAt: null, finishedAt: null });
const resetReview = review => ({ ...review, mode: null, independent: null, priorKnowledge: null, startedAt: null, finishedAt: null, pairs: review.pairs.map(pair => ({ ...pair, rating: blankRating() })) });
const outside = (file, directory) => file !== directory && !file.startsWith(directory + path.sep);
async function safeAbsolute(value) {
  const resolved = path.resolve(value); let current = resolved; const suffix = [];
  for (;;) {
    try {
      const stat = await fs.lstat(current);
      require(current !== resolved || !stat.isSymbolicLink(), "Review destinations cannot themselves be symbolic links");
      // The caller selects this parent, including normal OS aliases; all contained evidence reads still refuse links.
      return path.join(await fs.realpath(current), ...suffix);
    } catch (error) { if (error.code !== "ENOENT") throw error; suffix.unshift(path.basename(current)); current = path.dirname(current); }
  }
}
async function exactFile(root, ref) {
  require(ref && text(ref.path) && digest(ref.sha256), "Missing exact evidence identity"); const filename = await studyPath(root, ref.path);
  require((await fs.lstat(filename)).isFile(), "Evidence is not a regular file"); const bytes = await fs.readFile(filename);
  require(studyHash(bytes) === ref.sha256, "Evidence bytes differ from their saved identity"); return bytes;
}
async function inventory(root, relative = "") {
  const files = [];
  for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    require(!entry.isSymbolicLink(), "Review root contains a symbolic link");
    if (entry.isDirectory()) files.push(...await inventory(root, name)); else { require(entry.isFile(), "Unsupported review entry"); files.push(name); }
  }
  return files.sort(order);
}
function plansFor(manifest, corpus, records, contrast) {
  require(same(contrast, ["A", "B"]) || same(contrast, ["B", "C"]) && manifest.dry.conditions.includes("C") && manifest.dry.impeccable?.mode === "adapted", "Only A/B or explicit B/adapted-guidance C contrasts are supported");
  require(same(manifest.uncertainty, STUDY_UNCERTAINTY), "The frozen uncertainty method changed");
  const plans = manifest.dry.runs, keys = new Set(plans.map(p => p.runId));
  require(keys.size === plans.length && plans.length === manifest.dry.plannedRuns, "Duplicate or incomplete planned cells");
  require(new Set(records.map(r => r.runId)).size === records.length && records.every(r => keys.has(r.runId)), "Unknown or duplicated result changes the denominator");
  const selected = plans.filter(p => p.condition === contrast[0]);
  require(selected.length > 0 && new Set(selected.map(p => p.pairId)).size === selected.length, "Missing or duplicate planned pairs");
  for (const p of selected) {
    require(p.runId === `${p.pairId}/${p.condition}` && corpus.tasks.some(t => t.id === p.fixtureId), "Invalid planned task identity");
    const mate = plans.find(r => r.runId === `${p.pairId}/${contrast[1]}`);
    require(mate && ["fixtureId", "entrance", "repetition", "fixtureSha256", "contextManifestSha256", "deliveryType", "primaryTaskId"].every(k => same(p[k], mate[k])) && same(p.viewports, mate.viewports), "Unmatched planned pair");
  }
  return selected;
}
async function evidenceFor(records, manifest, evidenceRoot) {
  return new Map(await Promise.all(records.map(async row => {
    try { return [row.runId, await validateStudyResultEvidence(row, { manifest, evidenceRoot })]; }
    catch (error) { return [row.runId, { eligible: false, complete: false, reasons: [String(error.message ?? error)], taskSuccess: null, readyReported: row.readyReported === true, criticalUnresolved: null, comparisonSignature: null, publicEvidence: [], assessment: null }]; }
  })));
}
function pairIdentity(blindingSeed, reviewerId, plan, contrast) {
  const reviewId = `pair-${studyHash(`${blindingSeed}/${reviewerId}/${plan.pairId}`).slice(0, 16)}`;
  const conditions = [...contrast].sort((a, b) => order(studyHash(`${blindingSeed}/${reviewerId}/${plan.pairId}/${a}`), studyHash(`${blindingSeed}/${reviewerId}/${plan.pairId}/${b}`)));
  return { reviewerId, reviewId, pairId: plan.pairId, fixtureId: plan.fixtureId, entrance: plan.entrance, repetition: plan.repetition, left: conditions[0], right: conditions[1] };
}
function identifying(bytes, manifest, records, suppliedRaters) {
  const known = [...suppliedRaters, ...records.flatMap(r => [r.runId, r.requestId, r.sourceRevision, r.procedureRevision, r.provider?.resolvedModel, r.provider?.requestedModel, r.capabilities?.harnessRevision]), manifest.profile?.model, manifest.profile?.version, ...Object.values(manifest.runtimes ?? {}).map(r => r.sourceRevision)].filter(v => text(v) && v.length >= 4);
  const raw = bytes.toString("utf8"), body = raw.replace(/&#(x[0-9a-f]+|[0-9]+);?/gi, (_, value) => String.fromCodePoint(Math.min(parseInt(value[0].toLowerCase() === "x" ? value.slice(1) : value, value[0].toLowerCase() === "x" ? 16 : 10), 0x10ffff)));
  return known.some(value => body.toLowerCase().includes(value.toLowerCase())) || /(?:condition\s*[:=]\s*["']?[ABC]\b|claude|openai|codex|impeccable|adapted-guidance|native-playbook|design-partner\/[^\s"']+\/([ABC])\b)/i.test(body);
}
const REVIEW_JS = String.raw`const packet=await(await fetch('packet.json')).json();const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));document.querySelector('#who').textContent=packet.reviewerId;const root=document.querySelector('#pairs');for(const p of packet.pairs){const el=document.createElement('section');el.innerHTML='<h2>'+esc(p.brief)+'</h2><p>'+esc(p.task.goal)+'</p><h3>Supplied facts</h3><dl>'+Object.entries(p.availableFacts).map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(typeof v==='string'?v:JSON.stringify(v))+'</dd>').join('')+'</dl><h3>Original context</h3>'+p.context.map(c=>'<details><summary>'+esc(c.label)+'</summary><a href="'+esc(c.path)+'" download>Exact supplied file</a>'+(c.text?'<pre>'+esc(c.text)+'</pre>':'')+'</details>').join('')+'<h3>Primary task steps</h3><ol>'+p.task.steps.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol><p>Target viewports: '+p.viewports.map(v=>v.width+' × '+v.height).join(', ')+'</p><div class="sides">'+['left','right'].map(side=>{const s=p[side];return '<article><h3>'+side+'</h3><p>'+esc(s.status)+'</p>'+s.warnings.map(w=>'<p class="warning">'+esc(w)+'</p>').join('')+(s.output?'<p><a href="'+esc(s.output.path)+'" download>Exact output</a></p>':'')+s.evidence.map(e=>{const label=e.state==='initial'?'Initial state':Number.isInteger(e.stepIndex)?'Task step '+(e.stepIndex+1)+': '+p.task.steps[e.stepIndex]:'Final state';return '<figure><img alt="'+esc(label)+'" src="'+esc(e.path)+'"><figcaption>'+esc(label+(e.viewport?' · '+e.viewport.width+' × '+e.viewport.height:''))+'</figcaption></figure>'}).join('')+'<ol>'+s.taskSteps.map(step=>'<li>'+esc(step.description)+': '+esc(step.result)+'</li>').join('')+'</ol>'+packet.rubric.dimensions.map(dim=>'<label>'+esc(dim)+' <select data-side="'+side+'" data-dim="'+dim+'"><option value="">Unscored</option>'+[1,2,3,4,5].map(n=>'<option>'+n+'</option>').join('')+'</select></label>').join('')+'<label>Critical defects in '+side+' (one per line)<textarea data-defects="'+side+'"></textarea></label></article>'}).join('')+'</div><label>Preference <select data-outcome><option value="">Unscored</option><option value="left">Left</option><option value="right">Right</option><option value="tie">Tie</option><option value="both-unusable">Both unusable</option></select></label><label>Reason <textarea data-reason></textarea></label>';root.append(el);let begun=false;el.addEventListener('change',e=>{if(!begun){p.rating.startedAt=new Date().toISOString();begun=true}if(e.target.dataset.dim)p.rating[e.target.dataset.side][e.target.dataset.dim]=e.target.value?Number(e.target.value):null;if(e.target.hasAttribute('data-outcome'))p.rating.outcome=e.target.value||null;if(e.target.hasAttribute('data-reason'))p.rating.reason=e.target.value||null;if(e.target.hasAttribute('data-defects'))p.rating.criticalDefects[e.target.dataset.defects]=e.target.value.split('\n').filter(Boolean);p.rating.finishedAt=new Date().toISOString()})}document.querySelector('#begin').onclick=()=>{packet.startedAt=new Date().toISOString();document.querySelector('#begin').disabled=true};document.querySelector('#save').onclick=()=>{packet.mode=document.querySelector('#actual').checked?'actual':'synthetic';packet.independent=document.querySelector('#independent').checked;packet.priorKnowledge=document.querySelector('#knowledge').checked;packet.finishedAt=new Date().toISOString();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(packet,null,2)],{type:'application/json'}));a.download='ratings.json';a.click();URL.revokeObjectURL(a.href)};`;
const REVIEW_HTML = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Independent design review</title><style>body{font:16px/1.5 system-ui;max-width:1440px;margin:auto;padding:24px;color:#172331;background:#fafafa}section{border-top:2px solid #82909e;margin:32px 0;padding-top:20px}.sides{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{background:white;border:1px solid #ccd3dc;padding:16px;min-width:0}img{max-width:100%;height:auto}label{display:block;margin:12px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}dt{font-weight:600}dd{margin:0 0 8px}select,textarea,button{font:inherit}textarea{display:block;width:95%;min-height:70px}.warning{color:#743c09}small{display:block}@media(max-width:700px){.sides{grid-template-columns:1fr}}</style><h1>Independent design review</h1><p id="who"></p><p>Score the intended task, not decoration. 1 Unusable · 2 Substantial redesign · 3 Adequate · 4 Strong and specific · 5 Excellent.</p><p>Missing outputs remain in the review. Screenshots show the captured initial, task-step and final states. Available downloads preserve exact output bytes; screenshot-only outputs have no interactive preview. Do not inspect filenames or source to identify its producer. Report prior knowledge honestly.</p><button id="begin">Begin review</button><div id="pairs"></div><label><input id="actual" type="checkbox">These are my actual human review observations (leave clear for instrumentation tests).</label><label><input id="independent" type="checkbox">I did not produce these designs and reviewed independently.</label><label><input id="knowledge" type="checkbox">I recognized a producer or condition.</label><button id="save">Download ratings</button><small>No rating is transmitted. Return your downloaded JSON to the study coordinator.</small><script type="module" src="review.js"></script>`;

/** Create three usable neutral local packets; raw native logs and the condition key remain private. */
export async function prepareBlindReview({ manifest, corpus, records, evidenceRoot, directory, keyFile, raterIds, contrast = ["A", "B"], blindingSeed = randomBytes(32).toString("hex") }) {
  await validateManifestInputs(manifest.dry); require(same(corpus, await loadCorpus()), "Review corpus differs from frozen source bytes");
  require(digest(blindingSeed), "A private 256-bit blinding seed is required");
  require(Array.isArray(raterIds) && raterIds.length === 3 && new Set(raterIds).size === 3 && raterIds.every(text), "Exactly three distinct independent rater identities are required");
  const plans = plansFor(manifest, corpus, records, contrast), root = await safeAbsolute(directory), secret = await safeAbsolute(keyFile);
  require(outside(secret, root), "Condition key must be held outside the served review root");
  const evidence = await evidenceFor(records, manifest, evidenceRoot), rows = new Map(records.map(r => [r.runId, r]));
  const key = { schemaVersion: 2, kind: "design-partner-blinding-key", manifestSha256: executionIdentity(manifest), contrast, blindingSeed, timingRule: TIMING_RULE, raters: raterIds.map((identity, i) => ({ reviewerId: `reviewer-${i + 1}`, identity })), pairs: [], packets: [], files: [], blindingIssues: [] };
  await fs.mkdir(root, { recursive: false });
  async function write(relative, bytes, mimeType) { await fs.writeFile(path.join(root, relative), bytes, { flag: "wx" }); const ref = { path: relative, sha256: studyHash(bytes), mimeType }; key.files.push(ref); return ref; }
  for (const { reviewerId } of key.raters) {
    await fs.mkdir(path.join(root, reviewerId));
    const packet = { schemaVersion: 2, kind: "design-partner-blind-review", reviewerId, rubric: { anchors: { 1: "Unusable", 2: "Substantial redesign needed", 3: "Adequate", 4: "Strong and specific; minor polish remains", 5: "Excellent for the intended task" }, dimensions: CRAFT_DIMENSIONS }, mode: null, independent: null, priorKnowledge: null, startedAt: null, finishedAt: null, pairs: [] };
    for (const plan of plans) {
      const task = corpus.tasks.find(t => t.id === plan.fixtureId), binding = pairIdentity(blindingSeed, reviewerId, plan, contrast), sides = {}, context = [];
      for (const [i, item] of task.snapshot.items.entries()) {
        const bytes = Buffer.from(task.inputs[item.path]), filename = `${binding.reviewId}-context-${i}${path.extname(item.path) || ".txt"}`;
        require(!identifying(bytes, manifest, [], raterIds), "Supplied context would disclose a private identity");
        await write(`${reviewerId}/${filename}`, bytes, item.mime);
        context.push({ label: item.title ?? path.basename(item.path), path: filename, sha256: studyHash(bytes), mimeType: item.mime, text: /^(?:text\/|application\/json)/.test(item.mime) ? bytes.toString("utf8") : null });
      }
      for (const side of ["left", "right"]) {
        const runId = `${plan.pairId}/${binding[side]}`, row = rows.get(runId), checked = evidence.get(runId), warnings = [], refs = []; let output = null;
        if (row?.artifact) {
          const bytes = await exactFile(evidenceRoot, row.artifact);
          if (identifying(bytes, manifest, records, raterIds)) { warnings.push("The exact output could identify its producer; it is retained privately without rewriting."); key.blindingIssues.push({ reviewerId, reviewId: binding.reviewId, side, reason: "self-identifying-output" }); }
          else if (row.artifact.kind === "canvas-item" && row.artifact.supportFiles?.length) warnings.push("Screenshot-only review: this output depends on support files retained privately. No interactive preview or bare HTML download is provided; inspect the independent screenshots and task outcomes below.");
          else if (row.artifact.kind === "canvas-item") { const filename = `${binding.reviewId}-${side}.html`; await write(`${reviewerId}/${filename}`, bytes, "text/html"); output = { path: filename, sha256: row.artifact.sha256, kind: "canvas-item" }; }
          else warnings.push("Interactive repository runtime is unavailable in this packet. Exact repository bytes remain private; inspect the independent final runtime screenshots and task outcomes below.");
        }
        for (const [i, ref] of (checked?.publicEvidence ?? []).entries()) {
          const bytes = await exactFile(evidenceRoot, ref);
          if (ref.kind !== "screenshot") continue; // Native traces can disclose producer metadata; normalized final step outcomes are shown instead.
          require(["image/png", "image/jpeg", "image/webp"].includes(ref.mimeType), "Unsupported public screenshot format");
          if (identifying(bytes, manifest, records, raterIds)) { warnings.push("An evidence file could identify its producer and remains private."); key.blindingIssues.push({ reviewerId, reviewId: binding.reviewId, side, reason: "self-identifying-evidence" }); continue; }
          const filename = `${binding.reviewId}-${side}-evidence-${i}.${{ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[ref.mimeType]}`;
          require(ref.state === undefined || ref.state === "initial", "Unknown screenshot state");
          require(ref.stepIndex === undefined || Number.isInteger(ref.stepIndex) && ref.stepIndex >= 0 && ref.stepIndex < task.primaryTask.steps.length, "Screenshot does not identify a frozen task step");
          require(ref.state === undefined || ref.stepIndex === undefined, "Screenshot state and task step are ambiguous");
          await write(`${reviewerId}/${filename}`, bytes, ref.mimeType); refs.push({ path: filename, sha256: ref.sha256, viewport: ref.viewport ?? null, ...(ref.state === undefined ? {} : { state: ref.state }), ...(ref.stepIndex === undefined ? {} : { stepIndex: ref.stepIndex }) });
        }
        if (!row) warnings.push("This planned output is missing.");
        else if (row.status !== "completed") warnings.push("This attempt did not deliver a completed output.");
        if (!checked?.complete) warnings.push("Independent final task evidence is incomplete; no task-success claim is available.");
        const taskSteps = (checked?.assessment?.steps ?? []).map(step => ({ stepIndex: step.stepIndex, viewport: step.viewport ?? null, description: task.primaryTask.steps[step.stepIndex] ?? "Unknown frozen task step", result: step.result }));
        sides[side] = { status: row?.status ?? "missing", output, evidence: refs, taskSuccess: checked?.taskSuccess ?? null, taskSteps, warnings };
      }
      const pair = { reviewId: binding.reviewId, brief: task.instruction, category: task.family, availableFacts: task.knownFacts, context, task: task.primaryTask, viewports: task.viewports, ...sides, rating: blankRating() };
      require(!identifying(Buffer.from(studyJson(pair)), manifest, [], raterIds), "Review wrapper would disclose a private identity");
      packet.pairs.push(pair); key.pairs.push(binding);
    }
    const packetBytes = studyJson(packet); const ref = await write(`${reviewerId}/packet.json`, packetBytes, "application/json"); key.packets.push({ reviewerId, ...ref });
    await write(`${reviewerId}/index.html`, REVIEW_HTML, "text/html"); await write(`${reviewerId}/review.js`, REVIEW_JS, "text/javascript");
  }
  // This index contains only neutral public IDs, never native paths or private rater identities.
  await write("index.html", `<!doctype html><title>Design reviews</title><h1>Independent review packets</h1>${key.raters.map(r => `<p><a href="${r.reviewerId}/">${r.reviewerId}</a></p>`).join("")}`, "text/html");
  await write("review-files.json", studyJson({ schemaVersion: 1, kind: "neutral-review-files", files: [...key.files] }), "application/json");
  await fs.writeFile(secret, studyJson(key), { flag: "wx", mode: 0o600 });
  return { kind: "design-partner-review-preparation", pairedComparisons: plans.length, independentRaters: 3, ratings: 0, qualityEvidence: false, blindingIssues: key.blindingIssues.length, directory: root, keyFile: secret, entry: path.join(root, "index.html") };
}

/** Serve only contained packet files on loopback; scripts cannot access private evidence or make network calls. */
export async function serveBlindReview({ directory, port = 0 }) {
  const root = await safeAbsolute(directory); require((await fs.stat(root)).isDirectory(), "Missing review directory");
  const catalogue = JSON.parse(await fs.readFile(await studyPath(root, "review-files.json"), "utf8"));
  require(catalogue.kind === "neutral-review-files" && Array.isArray(catalogue.files) && new Set(catalogue.files.map(f => f.path)).size === catalogue.files.length, "Invalid public file catalogue");
  const allowed = new Map(catalogue.files.map(f => [f.path, f]));
  for (const ref of allowed.values()) await exactFile(root, ref);
  const server = http.createServer(async (req, res) => {
    try {
      require(req.method === "GET" || req.method === "HEAD", "Read-only review server");
      let relative = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname).slice(1); if (!relative || relative.endsWith("/")) relative += "index.html";
      require(allowed.has(relative), "Not an immutable review file");
      const file = await studyPath(root, relative);
      require((await fs.lstat(file)).isFile(), "Not a review file");
      const mime = allowed.get(relative).mimeType;
      const bytes = await exactFile(root, allowed.get(relative));
      res.writeHead(200, { "Content-Type": mime, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", "Referrer-Policy": "no-referrer" });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Review file unavailable"); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}

/** Derive the one six-person assignment schedule from the root-owned frozen cards; consent stays empty. */
export async function partnershipInstruments() {
  const bytes = await fs.readFile(STUDY_TASKS), tasks = JSON.parse(bytes);
  require(tasks.revision === "design-partner-partnership-tasks-v1" && same(tasks.assignments.map(a => a.participantId), ["P01", "P02", "P03", "P04", "P05", "P06"]), "Unknown partnership task protocol");
  return { schemaVersion: 2, kind: "design-partner-partnership-instruments", source: { revision: tasks.revision, sha256: studyHash(bytes) }, mode: null, participantsRecruited: 0, taskCards: tasks.tasks, limits: tasks.limits, orderLimit: tasks.orderLimit, sessions: tasks.assignments.map(a => ({ participantId: a.participantId, first: a.first, second: a.second, participantAssigned: false, entrance: null, codingBackground: null, consent: null, startedAt: null, endedAt: null, eventRecord: null, observations: [], questions: [], steering: [], alternativesRejected: [], facilitatorInterventions: [], acceptableResultMs: null, knowinglyChoseOrDelegated: null, settledContextLost: null, preferredCondition: null, reason: null, realisticCrossEntranceReturn: null, facilitatorMinutes: null })) };
}

/** One majority per planned pair, then deterministic resampling of whole brief clusters, never individual votes. */
export function briefClusterInterval(pairs) {
  if (!pairs.length) return { ...STUDY_UNCERTAINTY, lower: null, upper: null };
  const groups = [...new Set(pairs.map(p => p.fixtureId))].sort(order).map(id => pairs.filter(p => p.fixtureId === id).sort((a, b) => order(a.pairId, b.pairId)));
  let state = parseInt(studyHash(STUDY_UNCERTAINTY.seed).slice(0, 8), 16);
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  const samples = Array.from({ length: STUDY_UNCERTAINTY.resamples }, () => { let sum = 0, count = 0; for (let i = 0; i < groups.length; i++) { const group = groups[Math.floor(random() * groups.length)]; for (const row of group) { sum += row.advantage; count++; } } return sum / count; }).sort((a, b) => a - b);
  return { ...STUDY_UNCERTAINTY, lower: quantile(samples, .025), upper: quantile(samples, .975) };
}

async function partnerEvidence(partnership, evidenceRoot) {
  const template = await partnershipInstruments(), reasons = [], sessions = [];
  if (!partnership) return { complete: false, eligible: false, passed: null, reasons: ["Real participant observations are missing"], sessions };
  require(same(partnership.source, template.source) && same(partnership.taskCards, template.taskCards) && same(partnership.limits, template.limits) && same(partnership.orderLimit, template.orderLimit), "Partnership instruments differ from frozen task cards");
  require(Array.isArray(partnership.sessions) && new Set(partnership.sessions.map(s => s.participantId)).size === partnership.sessions.length && partnership.sessions.every(s => template.sessions.some(t => t.participantId === s.participantId)), "Unknown or duplicate participant assignment");
  if (partnership.mode !== "actual" || partnership.participantsRecruited !== 6) reasons.push("Actual consented participant sessions are not established");
  for (const planned of template.sessions) {
    const session = partnership.sessions.find(s => s.participantId === planned.participantId), failures = []; let events = [];
    if (!session) { reasons.push(`Missing assigned participant ${planned.participantId}`); sessions.push({ participantId: planned.participantId, complete: false }); continue; }
    require(same(session.first, planned.first) && same(session.second, planned.second), "Participant task/condition order changed");
    if (session.participantAssigned !== true || !["canvas-chat", "external-agent"].includes(session.entrance) || !timeRange(session.startedAt, session.endedAt) || !text(session.reason) || !Number.isFinite(session.facilitatorMinutes)) failures.push("Session identity, dates or supplied reason is missing");
    try {
      const consent = JSON.parse(await exactFile(evidenceRoot, session.consent?.evidence));
      require(session.consent.permitted === true && consent.mode === "actual" && consent.participantId === planned.participantId && consent.permitted === true && Date.parse(consent.at) <= Date.parse(session.startedAt), "Consent does not cover this session");
      const record = JSON.parse(await exactFile(evidenceRoot, session.eventRecord));
      require(record.kind === "design-partner-partnership-events" && record.mode === "actual" && record.participantId === planned.participantId && Array.isArray(record.events), "Missing actual traceable participant event record"); events = record.events;
      require(events.length > 0 && events.every((e, i) => Number.isFinite(e.elapsedMs) && e.elapsedMs >= 0 && (!i || e.elapsedMs >= events[i - 1].elapsedMs) && text(e.description) && text(e.requestId) && text(e.artifactId) && [planned.first, planned.second].some(t => e.taskId === t.taskId && e.condition === t.condition) && ["canvas-chat", "external-agent"].includes(e.entrance)), "Incomplete or unbound participant events");
      require([planned.first, planned.second].every(t => events.some(e => e.taskId === t.taskId && e.condition === t.condition)), "A participant task is missing from the trace");
    } catch (error) { failures.push(error.message); }
    const candidateEvents = events.filter(e => e.condition === "B"), rescued = candidateEvents.some(e => e.type === "intervention") || (session.facilitatorInterventions?.length ?? 0) > 0;
    const knowingly = candidateEvents.some(e => e.type === "direction" && ["choose", "delegate"].includes(e.action) && e.understood === true && text(e.reason));
    const contextLosses = candidateEvents.filter(e => e.type === "settled-context-loss").length;
    if (session.knowinglyChoseOrDelegated !== knowingly || session.settledContextLost !== (contextLosses > 0)) failures.push("Session interpretation disagrees with its attributed events");
    reasons.push(...failures.map(r => `${planned.participantId}: ${r}`)); sessions.push({ participantId: planned.participantId, complete: failures.length === 0, knowinglyChoseOrDelegated: knowingly, rescued, contextLosses, reason: session.reason });
  }
  const complete = sessions.length === 6 && sessions.every(s => s.complete), eligible = complete && reasons.length === 0;
  return { complete, eligible, passed: eligible ? sessions.filter(s => s.knowinglyChoseOrDelegated && !s.rescued).length >= 5 && sessions.reduce((n, s) => n + s.contextLosses, 0) < 2 : null, reasons, sessions, interpretation: "Six-person diagnostic evidence; no population preference estimate. Consent and independence remain attributed human attestations." };
}

/** Descriptive arithmetic over classified pair observations; this helper grants no evidence or rollout eligibility. */
export function summarizeStudyOutcomes({ manifest, plans, pairs, rows, checked, contrast, criticalSides = new Set(), criticalUnknownRuns = new Set() }) {
  const interval = briefClusterInterval(pairs), strongCoverage = pairs.filter(p => p.strongCandidate).length / pairs.length;
  const conditions = Object.fromEntries(contrast.map((condition, index) => {
    const all = plans.map(p => rows.get(`${p.pairId}/${condition}`)), entries = plans.map(p => checked.get(`${p.pairId}/${condition}`));
    const acceptable = pairs.map(p => index === 0 ? p.controlTaskSuccess === true && p.strongControl : p.candidateTaskSuccess === true && p.strongCandidate);
    return [condition, { planned: plans.length, attempted: all.filter(Boolean).length, taskSuccesses: entries.filter(e => e?.taskSuccess === true).length, unknownTaskOutcomes: entries.filter(e => e?.taskSuccess == null).length, acceptableOutputs: acceptable.filter(Boolean).length, statuses: Object.fromEntries(["completed", "failed", "timed-out", "unavailable", "abandoned", "missing"].map(status => [status, all.filter(r => (r?.status ?? "missing") === status).length])), costApiEquivalentUsd: summary(all.map(r => typeof r?.accounting?.apiEquivalentUsd === "number" && typeof r?.accounting?.toolUsd === "number" ? r.accounting.apiEquivalentUsd + r.accounting.toolUsd : null)), billedUsd: summary(all.map(r => r?.accounting?.billedUsd ?? null)), allRunCappedTimeMs: summary(all.map((r, i) => entries[i]?.taskSuccess === true ? Number.isFinite(r?.elapsedMs) ? Math.min(r.elapsedMs, manifest.limits?.millisecondsPerRun ?? r.elapsedMs) : null : manifest.limits?.millisecondsPerRun ?? null)), successfulTimeMs: summary(all.flatMap((r, i) => entries[i]?.taskSuccess === true ? [r.elapsedMs] : [])), acceptableResultTimeMs: summary(all.flatMap((r, i) => acceptable[i] ? [r.elapsedMs] : [])) }];
  }));
  const [control, candidate] = contrast.map(c => conditions[c]);
  const costRatio = control.costApiEquivalentUsd.median > 0 && !control.costApiEquivalentUsd.unknown && !candidate.costApiEquivalentUsd.unknown ? candidate.costApiEquivalentUsd.median / control.costApiEquivalentUsd.median : null;
  const timeRatio = control.acceptableOutputs >= plans.length / 2 && control.acceptableResultTimeMs.median > 0 && candidate.acceptableResultTimeMs.median !== null ? candidate.acceptableResultTimeMs.median / control.acceptableResultTimeMs.median : null;
  const cap = manifest.limits, selected = plans.flatMap(p => contrast.map(c => rows.get(`${p.pairId}/${c}`))), knownCosts = selected.map(r => typeof r?.accounting?.apiEquivalentUsd === "number" && typeof r?.accounting?.toolUsd === "number" ? r.accounting.apiEquivalentUsd + r.accounting.toolUsd : null);
  // Contrasts have separate ratios, but every recorded arm spends the one authorized aggregate budget.
  const allRecordedCosts = [...rows.values()].map(r => typeof r?.accounting?.apiEquivalentUsd === "number" && typeof r?.accounting?.toolUsd === "number" ? r.accounting.apiEquivalentUsd + r.accounting.toolUsd : null);
  const measuredCaps = selected.map(r => checked.get(r?.runId)?.ceilingsAdherent);
  const knownBudgetFailure = cap && (allRecordedCosts.some(c => c !== null && (c < 0 || c > cap.perRunApiEquivalentUsd)) || allRecordedCosts.reduce((n, c) => n + (c ?? 0), 0) > cap.aggregateApiEquivalentUsd || selected.some(r => Number.isFinite(r?.elapsedMs) && r.elapsedMs > cap.millisecondsPerRun));
  const absoluteCaps = measuredCaps.some(v => v === false) || knownBudgetFailure ? false : measuredCaps.some(v => v !== true) || !cap || knownCosts.some(c => c === null) || allRecordedCosts.some(c => c === null) || selected.some(r => !Number.isFinite(r?.elapsedMs)) ? null : true;
  const readiness = Object.fromEntries(contrast.map(condition => {
    const claims = plans.map(p => `${p.pairId}/${condition}`).filter(id => checked.get(id)?.readyReported), violations = [], unavailable = [];
    for (const id of claims) { const e = checked.get(id); if (e.taskSuccess === false || e.criticalUnresolved === true || criticalSides.has(id)) violations.push(id); else if (e.taskSuccess !== true || e.criticalUnresolved !== false || criticalUnknownRuns.has(id)) unavailable.push(id); }
    return [condition, { claims: claims.length, violations, unavailable, passed: violations.length ? false : unavailable.length ? null : true }];
  }));
  const taskGroups = manifest.dry.caseIds.flatMap(id => manifest.dry.entrances.map(e => { const group = pairs.filter(p => p.fixtureId === id && p.entrance === e); return group.some(p => p.candidateTaskSuccess === true) ? true : !group.length || group.some(p => p.candidateTaskSuccess === null) ? null : false; }));
  const gates = { qualityAdvantage: interval.lower > 0, strongCoverage: strongCoverage >= .8, categoryCoverage: [...new Set(pairs.map(p => p.category))].every(c => pairs.some(p => p.category === c && p.strongCandidate)), taskNoRegression: candidate.unknownTaskOutcomes || control.unknownTaskOutcomes ? null : candidate.taskSuccesses >= control.taskSuccesses, taskCoverage: taskGroups.includes(false) ? false : taskGroups.includes(null) ? null : true, readyClaims: readiness[contrast[1]].passed, acceptableResultTime: timeRatio === null ? null : timeRatio <= 1.5, modelToolCost: costRatio === null ? null : costRatio <= 2, absoluteCaps };
  return { interval, strongCoverage, conditions, costRatio, timeRatio, gates, readiness, successConditionedTimeRatio: control.successfulTimeMs.median > 0 && candidate.successfulTimeMs.median !== null ? candidate.successfulTimeMs.median / control.successfulTimeMs.median : null };
}

/** Validate immutable packets and actual attempt/assessment evidence before separating eligibility from measured gates. */
export async function analyzeBlindReview({ manifest, corpus, records, key, reviews, evidenceRoot, reviewRoot, partnership = null }) {
  await validateManifestInputs(manifest.dry); require(same(corpus, await loadCorpus()), "Analysis corpus differs from frozen source bytes");
  require(key.schemaVersion === 2 && key.kind === "design-partner-blinding-key" && key.manifestSha256 === executionIdentity(manifest) && key.timingRule === TIMING_RULE, "Blinding key belongs to another protocol or manifest");
  const plans = plansFor(manifest, corpus, records, key.contrast), rows = new Map(records.map(r => [r.runId, r])), checked = await evidenceFor(records, manifest, evidenceRoot), evidenceReasons = [], reviewReasons = [], votes = new Map(), overall = new Map(), criticalSides = new Set(), criticalUnknownRuns = new Set();
  require(key.raters.length === 3 && same(key.raters.map(r => r.reviewerId), ["reviewer-1", "reviewer-2", "reviewer-3"]) && new Set(key.raters.map(r => r.identity)).size === 3, "Invalid independent rater key");
  require(digest(key.blindingSeed), "Missing private allocation seed");
  const expectedBindings = key.raters.flatMap(r => plans.map(p => pairIdentity(key.blindingSeed, r.reviewerId, p, key.contrast)));
  require(same(key.pairs, expectedBindings), "Private pair mapping differs from reproducible frozen assignment");
  require(new Set(key.files.map(f => f.path)).size === key.files.length, "Duplicate immutable packet file");
  require(same(await inventory(await safeAbsolute(reviewRoot)), key.files.map(f => f.path).sort(order)), "Review root contains unlisted files or leaked private metadata");
  for (const ref of key.files) await exactFile(reviewRoot, ref);
  require(Array.isArray(reviews) && new Set(reviews.map(r => r.reviewerId)).size === reviews.length && reviews.every(r => key.raters.some(k => k.reviewerId === r.reviewerId)), "Unknown or duplicate reviewer instrument");
  if (reviews.length !== 3) reviewReasons.push("Three independent completed reviewers are required");
  for (const review of reviews) {
    const ref = key.packets.find(p => p.reviewerId === review.reviewerId); require(ref, "Missing original packet identity");
    const template = JSON.parse(await exactFile(reviewRoot, ref)); require(same(resetReview(review), template), "Scored packet changed immutable brief, output, evidence, rubric or assignment");
    if (review.mode !== "actual" || review.independent !== true || review.priorKnowledge !== false || !timeRange(review.startedAt, review.finishedAt)) reviewReasons.push("Review is synthetic, incomplete, dependent or unblinded");
    for (const pair of review.pairs) {
      const binding = key.pairs.find(p => p.reviewerId === review.reviewerId && p.reviewId === pair.reviewId), rating = pair.rating;
      const attributed = rating?.criticalDefects && !Array.isArray(rating.criticalDefects) && same(Object.keys(rating.criticalDefects).sort(), ["left", "right"]) && ["left", "right"].every(side => Array.isArray(rating.criticalDefects[side]) && rating.criticalDefects[side].every(text));
      if (!attributed) for (const side of ["left", "right"]) criticalUnknownRuns.add(`${binding.pairId}/${binding[side]}`);
      if (!outcomes.includes(rating?.outcome) || !text(rating.reason) || !timeRange(rating.startedAt, rating.finishedAt) || !attributed || !CRAFT_DIMENSIONS.every(k => score(rating.left?.[k]) && score(rating.right?.[k]))) { reviewReasons.push("Missing actual pair/rubric ratings or critical-defect attribution"); continue; }
      const value = rating.outcome === "left" || rating.outcome === "right" ? binding[rating.outcome] : rating.outcome;
      if (!votes.has(binding.pairId)) votes.set(binding.pairId, []); votes.get(binding.pairId).push(value);
      for (const side of ["left", "right"]) if (rating.criticalDefects[side].length) criticalSides.add(`${binding.pairId}/${binding[side]}`);
      for (const side of ["left", "right"]) { const id = `${binding.pairId}/${binding[side]}`; if (!overall.has(id)) overall.set(id, []); overall.get(id).push(rating[side].overall); }
    }
  }
  const pairs = plans.map(plan => {
    const cast = votes.get(plan.pairId) ?? [], counts = Object.fromEntries([...key.contrast, "tie", "both-unusable"].map(value => [value, cast.filter(v => v === value).length]));
    if (cast.length !== 3) reviewReasons.push("A planned pair lacks three independent votes");
    const majority = Object.entries(counts).find(([, n]) => n >= 2)?.[0] ?? "disagreement", candidateId = `${plan.pairId}/${key.contrast[1]}`, controlId = `${plan.pairId}/${key.contrast[0]}`;
    const candidate = rows.get(candidateId), control = rows.get(controlId), candidateEvidence = checked.get(candidateId), controlEvidence = checked.get(controlId);
    for (const id of [candidateId, controlId]) { const e = checked.get(id); if (!rows.has(id)) evidenceReasons.push(`Missing planned run ${id}`); else if (!e?.eligible || !e.complete) evidenceReasons.push(...(e?.reasons.length ? e.reasons : ["Native or independent final task evidence is incomplete"]).map(reason => `${id}: ${reason}`)); }
    if (!candidateEvidence?.comparisonSignature || candidateEvidence.comparisonSignature !== controlEvidence?.comparisonSignature) evidenceReasons.push(`Unmatched native model/tool/resource evidence for ${plan.pairId}`);
    const strong = id => rows.get(id)?.status === "completed" && (overall.get(id) ?? []).filter(s => s >= 4).length >= 2;
    return { pairId: plan.pairId, fixtureId: plan.fixtureId, entrance: plan.entrance, repetition: plan.repetition, category: corpus.tasks.find(t => t.id === plan.fixtureId).family, votes: counts, majority, disagreement: new Set(cast).size > 1, advantage: majority === key.contrast[1] ? 1 : majority === key.contrast[0] ? -1 : 0, strongCandidate: strong(candidateId), strongControl: strong(controlId), candidateTaskSuccess: candidateEvidence?.taskSuccess ?? null, controlTaskSuccess: controlEvidence?.taskSuccess ?? null };
  });
  if (key.blindingIssues.length) reviewReasons.push("Some exact outputs/evidence could not be blinded");
  const { interval, strongCoverage, conditions, costRatio, timeRatio, gates, readiness, successConditionedTimeRatio } = summarizeStudyOutcomes({ manifest, plans, pairs, rows, checked, contrast: key.contrast, criticalSides, criticalUnknownRuns });
  const partner = await partnerEvidence(partnership, evidenceRoot), evidenceComplete = evidenceReasons.length === 0, reviewComplete = reviewReasons.length === 0;
  const observedFailures = Object.entries(gates).filter(([, passed]) => passed === false).map(([gate]) => gate), unavailableGates = Object.entries(gates).filter(([, passed]) => passed === null).map(([gate]) => gate);
  return { schemaVersion: 2, kind: "design-partner-analysis", protocol: { uncertainty: STUDY_UNCERTAINTY, timingRule: TIMING_RULE, acceptableOutput: "Independent primary-task pass and majority overall craft >=4; elapsed generation time is a proxy, not participant acceptance time.", controlQualificationFloor: .5 }, comparisonEligible: evidenceComplete && reviewComplete, qualityEvidence: evidenceComplete && reviewComplete, evidence: { complete: evidenceComplete, reasons: [...new Set(evidenceReasons)] }, review: { complete: reviewComplete, reasons: [...new Set(reviewReasons)], independence: "Recorded human attestations; the tool does not certify people or detect all identifying pixels." }, observedGateFailures: observedFailures, unavailableGates, gates, readiness, qualityAndUsabilityPassed: evidenceComplete && reviewComplete && !observedFailures.length && !unavailableGates.length, study: manifest.dry.study, fullStudyGo: manifest.dry.study === "full" && evidenceComplete && reviewComplete && !observedFailures.length && !unavailableGates.length && partner.passed === true, go: false, rollout: "retain-opt-in", rolloutReason: "Hosted acceptance and explicit product rollout authorization are separate; this instrument never enables defaults.", pairedComparisons: pairs.length, interval, strongCoverage, conditions, costRatio, acceptableResultTimeRatio: timeRatio, successConditionedTimeRatio, partnership: partner, byEntrance: Object.fromEntries(manifest.dry.entrances.map(e => [e, pairs.filter(p => p.entrance === e)])), byCategory: Object.fromEntries([...new Set(pairs.map(p => p.category))].map(c => [c, pairs.filter(p => p.category === c)])), pairs };
}
