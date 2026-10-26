import { writeName, selectArtifacts, artifactNames } from './names.mjs';
// The canvas journal's recovery, for a fresh CI checkout (plates practice
// `night`; managed: plates render rewrites it). Two workflows write the
// project's canvas: plates-night.yml (`plates canvas night`, the measurements)
// and plates-morning.yml's card job (`plates morning --card`, the plan's live
// card after each pass, plates phase 78). They share one journal, so each
// restores the newest attempt of EITHER that may have written the canvas:
// a journal one of them did not see would make the other's next conditional
// edit look like a person's.
//
//   node scripts/plates/canvas-recovery.mjs --workflow plates-night.yml|plates-morning.yml
//
// Prints the recovery.json to restore (PLATES_CANVAS_RECOVERY), or nothing when
// no earlier attempt exists and the owner provisioned .plates/canvas/manifest.json
// (the bootstrap). Exit 1 with ::error:: when it cannot establish the newest
// state: the caller then records a never-ran receipt and touches no canvas.
// Exit 3 (plates-morning only) when another canvas writer is still running: the
// card waits for the next pass, which starts plates-morning again.
//
// The rules, each paid for once in plates-night.yml (duo#90-93, cajones#63-64):
// only default-branch, same-repo runs of the two workflows, by their own
// events; never a run queued behind this one; a rerun sees its own earlier
// attempt; newest by when the attempt ran, not by id; a run whose committed
// config had canvas nightly publishing off is skipped; a never-ran receipt
// sends recovery to the attempt before it; the artifact's provenance must
// name exactly the attempt it came from. A night attempt with canvas on must
// have left its artifact. A plates-morning attempt with none is skipped only
// when its own job results show its card step never ran (canvas not set for
// the card, or no plan; #152), and its run's earlier attempt, which may have,
// is read in its place (#151); without that evidence it is refused.
// gh is `gh`; GH_TOKEN is the job's own (actions: read, contents: read).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { isMain } from './lib.mjs';

/** The canvas writers: their artifact (name-<attempt>), the events that may run them, and whether an enabled attempt must have left one. */
export const WRITERS = Object.freeze({
  'keel-night.yml': Object.freeze({ artifact: writeName('artifact:keel-canvas-night'), artifactId: 'artifact:keel-canvas-night', events: Object.freeze(['schedule', 'workflow_dispatch']), required: true }),
  'keel-morning.yml': Object.freeze({ artifact: writeName('artifact:keel-canvas-card'), artifactId: 'artifact:keel-canvas-card', events: Object.freeze(['schedule', 'workflow_dispatch', 'workflow_run']), required: false }),
  'plates-night.yml': Object.freeze({ artifact: writeName('artifact:keel-canvas-night'), artifactId: 'artifact:keel-canvas-night', events: Object.freeze(['schedule', 'workflow_dispatch']), required: true }),
  'plates-morning.yml': Object.freeze({ artifact: writeName('artifact:keel-canvas-card'), artifactId: 'artifact:keel-canvas-card', events: Object.freeze(['schedule', 'workflow_dispatch', 'workflow_run']), required: false }),
});

/** plates-morning.yml's card job and the one step of it that writes the canvas. */
export const CARD_JOB = 'card', CARD_STEP = 'Publish the plan card';

class Refusal extends Error { constructor(message, code = 1) { super(message); this.code = code; } }
const fail = (message, code = 1) => { throw new Refusal(message, code); };

/** The recovery.json to restore for this run, or null for the bootstrap. Throws a Refusal. */
export function chooseRecovery({ self, env = process.env, gh = 'gh' }) {
  const repo = env.REPO, base = env.BASE;
  const writer = WRITERS[self];
  if (!writer) fail(`Canvas recovery: --workflow is one of ${Object.keys(WRITERS).join(', ')}.`);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo ?? '') || !base) fail('Canvas recovery requires the current repository and default branch.');
  if (!writer.events.includes(env.GITHUB_EVENT_NAME) || env.GITHUB_REF_NAME !== base) fail('Canvas publication requires a default-branch night, never a PR or another branch.');
  const api = (endpoint, optional = false) => {
    try { return JSON.parse(execFileSync(gh, ['api', endpoint], { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 })); }
    catch (error) { if (optional && /HTTP 404/.test(String(error.stderr ?? ''))) return null; throw error; }
  };
  // A repository rename changes the slug in new runs, not old provenance.
  // Trust an old slug only after both API reads identify the same numeric repository.
  const names = new Map([[repo.toLowerCase(), true]]);
  let repository;
  const sameRepository = name => {
    if (typeof name !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name)) return false;
    const key = name.toLowerCase();
    if (names.has(key)) return names.get(key);
    if (names.size >= 8) fail('Canvas recovery repository aliases exceed read bound.');
    repository ??= api(`repos/${repo}`);
    if (!Number.isSafeInteger(repository?.id) || repository.id < 1 || repository.full_name?.toLowerCase() !== repo.toLowerCase()) fail('Canvas recovery repository identity unavailable.');
    const alias = api(`repos/${name}`);
    const same = alias?.id === repository.id && alias.full_name?.toLowerCase() === repo.toLowerCase();
    names.set(key, same);
    return same;
  };
  const sourceMatches = source => {
    if (source?.full_name?.toLowerCase() === repo.toLowerCase()) return true;
    if (!Number.isSafeInteger(source?.id) || source.id < 1) return false;
    return sameRepository(source.full_name) && source.id === repository.id;
  };
  const previous = [];
  for (const wf of Object.keys(WRITERS)) {
    const file = `.github/workflows/${wf}`;
    const history = api(`repos/${repo}/actions/workflows/${wf}/runs?branch=${encodeURIComponent(base)}&per_page=100`, wf !== self);
    if (history === null) continue; // confirmed absent alias only
    const runs = history.workflow_runs;
    if (!Array.isArray(runs)) fail('Cannot establish canvas recovery run history.');
    for (const run of runs.filter(r => r?.path === file)) {
      // Never a run queued behind this one (it has no state yet); a rerun of an old night still sees the runs after it.
      if (String(run.id) === String(env.GITHUB_RUN_ID)) { if (Number(env.GITHUB_RUN_ATTEMPT) > 1) previous.push({ ...api(`repos/${repo}/actions/runs/${run.id}/attempts/${Number(env.GITHUB_RUN_ATTEMPT) - 1}`), writer: wf }); }
      else if (run.status === 'completed' || Number(run.id) < Number(env.GITHUB_RUN_ID)) previous.push({ ...run, writer: wf });
    }
  }
  // The attempt that ran last comes first: a rerun of an old night ran after the nights it follows by ID.
  const newestFirst = (a, b) => (Date.parse(b.run_started_at ?? '') || 0) - (Date.parse(a.run_started_at ?? '') || 0) || b.id - a.id || b.run_attempt - a.run_attempt;
  const eligible = previous.filter(r => Number.isSafeInteger(r.id) && Number.isSafeInteger(r.run_attempt) && /^[a-f0-9]{40}$/.test(r.head_sha ?? '') && sourceMatches(r.head_repository) && sourceMatches(r.repository) && r.head_branch === base && r.path === `.github/workflows/${r.writer}` && WRITERS[r.writer].events.includes(r.event) && Array.isArray(r.pull_requests) && r.pull_requests.length === 0)
    .sort(newestFirst);
  const bounded = file => fs.existsSync(file) && !fs.lstatSync(file).isSymbolicLink() && fs.lstatSync(file).isFile() && fs.statSync(file).size <= 64 * 1024 * 1024;
  const provenanceOf = (file, run) => {
    const p = JSON.parse(fs.readFileSync(file, 'utf8')).provenance;
    if (!sameRepository(p?.repo) || p.workflow !== run.path || String(p.runId) !== String(run.id) || p.attempt !== run.run_attempt || p.headSha !== run.head_sha) fail('Recovery provenance does not match the selected attempt.');
  };
  // Positive evidence, from the attempt's own complete job list, that its card step never ran: no
  // card job ran in this attempt (none, or only one carried over from an earlier attempt), or it
  // was skipped, or its publish step was. Anything else, unknown included, may have published.
  const cardNeverRan = run => {
    const listed = api(`repos/${repo}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`);
    if (!Array.isArray(listed?.jobs) || listed.total_count !== listed.jobs.length) return false;
    const cards = listed.jobs.filter(j => j?.name === CARD_JOB && (j.run_attempt === undefined || j.run_attempt === run.run_attempt));
    if (!cards.length) return true;
    if (cards.length !== 1 || cards[0].status !== 'completed') return false;
    if (cards[0].conclusion === 'skipped') return true;
    const steps = (Array.isArray(cards[0].steps) ? cards[0].steps : []).filter(s => s?.name === CARD_STEP);
    return steps.length === 1 && steps[0].status === 'completed' && steps[0].conclusion === 'skipped';
  };
  const queue = [...eligible];
  while (queue.length) {
    const run = queue.shift();
    const w = WRITERS[run.writer];
    const committed = api(`repos/${repo}/contents/.plates/plates.json?ref=${run.head_sha}`, true) ?? api(`repos/${repo}/contents/.keel/keel.json?ref=${run.head_sha}`);
    if (committed.encoding !== 'base64' || typeof committed.content !== 'string' || committed.size > 1024 * 1024) fail('Cannot establish whether the previous night had canvas enabled.');
    const config = JSON.parse(Buffer.from(committed.content, 'base64').toString('utf8'));
    if (config.canvas?.enabled !== true || config.canvas?.cadence !== 'nightly') continue;
    if (run.status !== 'completed') {
      if (self.endsWith('-morning.yml')) fail(`Another canvas writer (${run.writer} run ${run.id}) is still running; the plan card waits for the next pass.`, 3);
      fail('The latest canvas night is not completed; do not race or restore older state.');
    }
    const list = api(`repos/${repo}/actions/runs/${run.id}/artifacts?per_page=100`).artifacts;
    if (!Array.isArray(list)) fail('Cannot list the trusted night artifacts.');
    const { name, matches } = selectArtifacts(list, w.artifactId, `-${run.run_attempt}`);
    const found = matches.filter(a => !a.expired && a.workflow_run?.id === run.id && a.workflow_run?.head_sha === run.head_sha && a.size_in_bytes > 0 && a.size_in_bytes <= 64 * 1024 * 1024);
    // A plates-morning attempt that left no card artifact is skipped only when its own job results show
    // its card step never ran (#152): a card published and then a failed upload also leaves none, and
    // restoring older state then would make a second card. Its run's earlier attempt may have run
    // the card (a rerun of a failed send after the card published, #151): that attempt takes its
    // place in time order, as after a never-ran receipt.
    if (!w.required && found.length === 0 && !list.some(a => artifactNames(w.artifactId, `-${run.run_attempt}`).includes(a.name))) {
      if (!cardNeverRan(run)) fail('A plates-morning attempt left no card journal, and its job results do not show that its card step never ran: it may have published the card. Manual recovery required; refusing older state.');
      if (run.run_attempt > 1) { queue.push({ ...api(`repos/${repo}/actions/runs/${run.id}/attempts/${run.run_attempt - 1}`), writer: run.writer }); queue.sort(newestFirst); }
      continue;
    }
    if (found.length !== 1) fail('Latest expected attempt recovery artifact missing, expired, oversized or ambiguous. Manual recovery required; refusing older state.');
    const dir = fs.mkdtempSync(path.join(env.RUNNER_TEMP, 'canvas-recovery-'));
    execFileSync(gh, ['run', 'download', String(run.id), '--repo', repo, '--name', name, '--dir', dir], { timeout: 60000, maxBuffer: 1024 * 1024 });
    const file = path.join(dir, 'recovery.json');
    const never = path.join(dir, 'never-ran.json');
    // An attempt whose preflight failed never touched the canvas: recover from the attempt before it,
    // in this run if it was a rerun, else the run before.
    if (!fs.existsSync(file) && bounded(never)) {
      provenanceOf(never, run);
      // Its earlier attempt takes its place in time order, never ahead of a night that ran after it.
      if (run.run_attempt > 1) { queue.push({ ...api(`repos/${repo}/actions/runs/${run.id}/attempts/${run.run_attempt - 1}`), writer: run.writer }); queue.sort(newestFirst); }
      continue;
    }
    if (!bounded(file)) fail('The trusted artifact has no bounded recovery.json; snapshots alone cannot reconstruct ownership.');
    provenanceOf(file, run);
    return file;
  }
  if (fs.existsSync('.plates/canvas/manifest.json')) return null; // explicit bootstrap; the writer validates it
  fail('No prior canvas night journal exists. Provision the original connection manifest through setup; never reconnect automatically.');
}

if (isMain(import.meta)) {
  const at = process.argv.indexOf('--workflow');
  const self = at > 0 ? process.argv[at + 1] : undefined;
  try {
    const file = chooseRecovery({ self });
    if (file) console.log(file);
  } catch (e) {
    console.error(`::error::${e instanceof Refusal ? e.message : 'Canvas recovery could not read its inputs.'}`);
    process.exit(e instanceof Refusal ? e.code : 1);
  }
}
