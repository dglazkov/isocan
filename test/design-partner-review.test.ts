import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadCorpus, loadBaseline, createManifest } from "../scripts/lib/design-partner-eval.mjs";
import { STUDY_UNCERTAINTY, executionIdentity } from "../scripts/lib/design-partner-execution.mjs";
import { studyHash } from "../scripts/lib/design-partner-runtime.mjs";
import { CRAFT_DIMENSIONS, prepareBlindReview, serveBlindReview, partnershipInstruments, briefClusterInterval, summarizeStudyOutcomes, analyzeBlindReview } from "../scripts/lib/design-partner-review.mjs";

const owned: string[] = [];
afterEach(async () => { await Promise.all(owned.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }))); });
async function fixture({ study = "smoke", records = "none" }: { study?: string; records?: string } = {}) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "isocan-review-instrument-"))); owned.push(root);
  const evidenceRoot = path.join(root, "evidence"), directory = path.join(root, "public"), keyFile = path.join(root, "private-key.json"); await fs.mkdir(evidenceRoot);
  const [corpus, baseline] = await Promise.all([loadCorpus(), loadBaseline()]);
  const manifest: any = { dry: createManifest(corpus, baseline, { study }), uncertainty: STUDY_UNCERTAINTY, runtimes: { A: { sourceRevision: "a".repeat(40) }, B: { sourceRevision: "b".repeat(40) } }, profile: { model: "synthetic-not-a-provider", tools: [], version: "synthetic-native-harness-v1" }, limits: { aggregateApiEquivalentUsd: 1000, perRunApiEquivalentUsd: 10, millisecondsPerRun: 100_000 }, authorization: null };
  const rows: any[] = [];
  if (records !== "none") for (const [i, p] of manifest.dry.runs.entries()) {
    const bytes = Buffer.from("<!doctype html><title>Acme task</title><main><h1>Receiving stock</h1><button>Save receipt</button></main>"), artifact = { kind: "canvas-item", path: `output-${i}.html`, sha256: studyHash(bytes) };
    await fs.writeFile(path.join(evidenceRoot, artifact.path), bytes);
    const attemptBytes = Buffer.from(JSON.stringify({ runId: p.runId, manifestSha256: executionIdentity(manifest), state: "terminal", outcome: { status: "completed", providerExecution: "canned-process-only" } }));
    const attempt = { path: `attempt-${i}.json`, sha256: studyHash(attemptBytes) }; await fs.writeFile(path.join(evidenceRoot, attempt.path), attemptBytes);
    const captureBytes = Buffer.from(JSON.stringify({ artifact, finalClaim: { ready: true }, reportedReceipts: [] })), capture = { path: `capture-${i}.json`, sha256: studyHash(captureBytes) }; await fs.writeFile(path.join(evidenceRoot, capture.path), captureBytes);
    rows.push({ schemaVersion: 1, kind: "design-partner-execution-result", runId: p.runId, manifestSha256: executionIdentity(manifest), fixtureSha256: p.fixtureSha256, status: "completed", artifact, provenance: { attempt, capture }, readyReported: true, taskSuccess: true, accounting: { apiEquivalentUsd: .1, toolUsd: 0, billedUsd: null }, elapsedMs: 1000, comparisonStratum: "fictionally-equal", qualityEvidence: false });
  }
  const options = { manifest, corpus, records: rows, evidenceRoot, directory, keyFile, raterIds: ["Private Reviewer Alpha", "Private Reviewer Bravo", "Private Reviewer Charlie"] };
  async function prepare() {
    const result = await prepareBlindReview(options), key = JSON.parse(await fs.readFile(keyFile, "utf8"));
    const reviews = await Promise.all(key.packets.map((p: any) => fs.readFile(path.join(directory, p.path), "utf8").then(JSON.parse)));
    return { result, key, reviews };
  }
  return { ...options, root, prepare };
}
function rateSynthetic(reviews: any[], key: any, vote: (binding: any, reviewer: number) => string = () => "B", overall = 4) {
  for (const [i, review] of reviews.entries()) {
    review.mode = "synthetic"; review.independent = true; review.priorKnowledge = false; review.startedAt = "2026-09-15T10:00:00Z"; review.finishedAt = "2026-09-15T11:00:00Z";
    for (const pair of review.pairs) {
      const b = key.pairs.find((p: any) => p.reviewerId === review.reviewerId && p.reviewId === pair.reviewId), choice = vote(b, i);
      pair.rating = { outcome: ["tie", "both-unusable"].includes(choice) ? choice : b.left === choice ? "left" : "right", reason: "Synthetic arithmetic test, not a person's quality judgment.", left: Object.fromEntries(CRAFT_DIMENSIONS.map((k: string) => [k, overall])), right: Object.fromEntries(CRAFT_DIMENSIONS.map((k: string) => [k, overall])), criticalDefects: { left: [], right: [] }, startedAt: review.startedAt, finishedAt: review.finishedAt };
    }
  }
}
const analyze = (f: any, p: any, extra = {}) => analyzeBlindReview({ ...f, ...p, reviewRoot: f.directory, ...extra });

it("creates neutral usable local packets with every missing planned output and no prefilled observations", async () => {
  const f = await fixture(), p = await f.prepare();
  expect(p.result).toMatchObject({ pairedComparisons: 8, independentRaters: 3, ratings: 0, qualityEvidence: false });
  for (const [i, review] of p.reviews.entries()) {
    expect(review.reviewerId).toBe(`reviewer-${i + 1}`); expect(review.pairs).toHaveLength(8); expect(review.mode).toBeNull();
    for (const pair of review.pairs) { expect(pair.left.status).toBe("missing"); expect(pair.right.status).toBe("missing"); expect(pair.left.taskSuccess).toBeNull(); expect(pair.rating.outcome).toBeNull(); expect(Object.values(pair.rating.left).every(v => v === null)).toBe(true); }
  }
  expect(JSON.stringify(p.reviews)).not.toMatch(/Private Reviewer|runId|sourceRevision|harness/);
  expect(JSON.stringify(p.reviews)).not.toContain(p.key.blindingSeed);
  expect(p.key.blindingSeed).toMatch(/^[a-f0-9]{64}$/);
  const server = await serveBlindReview({ directory: f.directory });
  try {
    const html = await fetch(server.url + "reviewer-1/"); expect(html.status).toBe(200); expect(await html.text()).toContain("Download ratings");
    const js = await fetch(server.url + "reviewer-1/review.js"); expect(await js.text()).toContain("data-outcome");
    expect(html.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect((await fetch(server.url + "../private-key.json")).status).toBe(404);
    await fs.copyFile(f.keyFile, path.join(f.directory, "leaked-key.json")); expect((await fetch(server.url + "leaked-key.json")).status).toBe(404);
  } finally { await server.close(); }
});

it("retains exact artifact bytes under neutral names but flags identifying output without rewriting it", async () => {
  const f = await fixture({ records: "canned" }), first = f.records[0];
  const identifying = Buffer.from("<!doctype html><p>Generated by Claude; condition: B</p>"); first.artifact.sha256 = studyHash(identifying); await fs.writeFile(path.join(f.evidenceRoot, first.artifact.path), identifying);
  const p = await f.prepare(); expect(p.result.blindingIssues).toBe(3);
  for (const review of p.reviews) {
    const bound = p.key.pairs.find((b: any) => b.reviewerId === review.reviewerId && `${b.pairId}/${b.left}` === first.runId || b.reviewerId === review.reviewerId && `${b.pairId}/${b.right}` === first.runId);
    const pair = review.pairs.find((r: any) => r.reviewId === bound.reviewId), side = `${bound.pairId}/${bound.left}` === first.runId ? "left" : "right";
    expect(pair[side].output).toBeNull(); expect(pair[side].warnings.join(" ")).toMatch(/retained privately/);
    for (const other of review.pairs.flatMap((r: any) => [r.left, r.right]).filter((r: any) => r.output)) expect(studyHash(await fs.readFile(path.join(f.directory, review.reviewerId, other.output.path)))).toBe(other.output.sha256);
  }
  expect(await fs.readFile(path.join(f.evidenceRoot, first.artifact.path))).toEqual(identifying);
  expect((await fs.readdir(f.directory)).some(n => n.includes("Private"))).toBe(false);
});

it("refuses unsafe paths, symlink parents, duplicate cells and an internal condition key", async () => {
  const f = await fixture({ records: "canned" });
  await expect(prepareBlindReview({ ...f, keyFile: path.join(f.directory, "key.json") })).rejects.toThrow(/outside/);
  await expect(prepareBlindReview({ ...f, records: [...f.records, f.records[0]] })).rejects.toThrow(/duplicated/);
  await fs.symlink(f.root, path.join(f.root, "alias")); await expect(prepareBlindReview({ ...f, directory: path.join(f.root, "alias", "public"), keyFile: path.join(f.root, "public", "key.json") })).rejects.toThrow(/outside/);
  f.records[0].artifact.path = "../private.json"; await expect(f.prepare()).rejects.toThrow(/contained/);
  const g = await fixture({ records: "canned" }); await fs.symlink(path.join(g.evidenceRoot, g.records[1].artifact.path), path.join(g.evidenceRoot, "linked.html")); g.records[0].artifact.path = "linked.html";
  await expect(g.prepare()).rejects.toThrow(/symbolic/);
});

it("rejects edited immutable brief/evidence/assignment content and leaked private files when reading scores", async () => {
  const f = await fixture({ records: "canned" }), p = await f.prepare(); rateSynthetic(p.reviews, p.key);
  const changed = structuredClone(p.reviews); changed[0].pairs[0].brief = "An easier task";
  await expect(analyze(f, { ...p, reviews: changed })).rejects.toThrow(/immutable/);
  const missing = structuredClone(p.reviews); missing[0].pairs.pop(); await expect(analyze(f, { ...p, reviews: missing })).rejects.toThrow(/immutable/);
  const wrongKey = structuredClone(p.key); [wrongKey.pairs[0].left, wrongKey.pairs[0].right] = [wrongKey.pairs[0].right, wrongKey.pairs[0].left]; await expect(analyze(f, { ...p, key: wrongKey })).rejects.toThrow(/assignment/);
  await fs.copyFile(f.keyFile, path.join(f.directory, "secret.json")); await expect(analyze(f, p)).rejects.toThrow(/leaked private/); await fs.unlink(path.join(f.directory, "secret.json"));
  const output = p.key.files.find((r: any) => /pair-.*\.html$/.test(r.path)); await fs.appendFile(path.join(f.directory, output.path), "<!-- altered -->"); await expect(analyze(f, p)).rejects.toThrow(/saved identity/);
});

it("collapses three votes to one majority and retains ties, both-unusable and disagreement without dropping failed rows", async () => {
  const f = await fixture({ records: "canned" }), p = await f.prepare();
  const ids = f.manifest.dry.runs.filter((r: any) => r.condition === "A").map((r: any) => r.pairId), patterns = [["B", "B", "A"], ["A", "B", "tie"], ["tie", "tie", "B"], ["both-unusable", "both-unusable", "A"]];
  rateSynthetic(p.reviews, p.key, (b, i) => patterns[ids.indexOf(b.pairId) % 4]![i]!);
  const result = await analyze(f, p);
  expect(result.pairedComparisons).toBe(8); expect(result.pairs.map((r: any) => r.majority)).toEqual(["B", "disagreement", "tie", "both-unusable", "B", "disagreement", "tie", "both-unusable"]);
  expect(result.pairs.reduce((n: number, r: any) => n + r.advantage, 0) / 8).toBe(.25);
  expect(result.conditions.A.planned).toBe(8); expect(result.conditions.B.planned).toBe(8);
  expect(result.conditions.B.taskSuccesses).toBe(0); expect(result.conditions.B.unknownTaskOutcomes).toBe(8);
  expect(result.comparisonEligible).toBe(false); expect(result.fullStudyGo).toBe(false); expect(result.go).toBe(false);
  expect(result.evidence.reasons.join(" ")).toMatch(/Canned/); expect(result.review.reasons.join(" ")).toMatch(/synthetic/);
});

it("does not upgrade fully populated canned output ratings or partner forms into evidence, including full-study mode", async () => {
  const f = await fixture({ study: "full", records: "canned" }), p = await f.prepare(); rateSynthetic(p.reviews, p.key);
  const partnership: Omit<Awaited<ReturnType<typeof partnershipInstruments>>, "mode"> & { mode: string | null } = await partnershipInstruments(); partnership.mode = "actual"; partnership.participantsRecruited = 6;
  for (const session of partnership.sessions) Object.assign(session, { participantAssigned: true, entrance: "canvas-chat", knowinglyChoseOrDelegated: true, settledContextLost: false, reason: "Synthetic supplied conclusion only", facilitatorMinutes: 1, startedAt: "2026-09-15T10:00:00Z", endedAt: "2026-09-15T11:00:00Z" });
  const result = await analyze(f, p, { partnership });
  expect(result.strongCoverage).toBe(1); expect(result.interval.lower).toBe(1); expect(result.comparisonEligible).toBe(false); expect(result.fullStudyGo).toBe(false); expect(result.partnership.eligible).toBe(false); expect(result.partnership.passed).toBeNull();
  expect(result.acceptableResultTimeRatio).toBeNull(); expect(result.conditions.A.acceptableOutputs).toBe(0); expect(result.conditions.A.billedUsd.unknown).toBe(48);
  expect(result.conditions.A.allRunCappedTimeMs).toMatchObject({ known: 48, median: 100_000 });
});

it("separates negative observed quality gates from evidence completeness and preserves missing denominators", async () => {
  const f = await fixture({ records: "canned" }); f.records[0].status = "failed"; f.records.pop(); const p = await f.prepare(); rateSynthetic(p.reviews, p.key, () => "A", 2);
  const result = await analyze(f, p);
  expect(result.comparisonEligible).toBe(false); expect(result.observedGateFailures).toEqual(expect.arrayContaining(["qualityAdvantage", "strongCoverage", "categoryCoverage"]));
  expect(result.unavailableGates).toEqual(expect.arrayContaining(["acceptableResultTime", "taskCoverage"])); expect(result.evidence.reasons.some((s: string) => s.startsWith("Missing planned run"))).toBe(true);
  expect(result.pairedComparisons).toBe(8); expect(result.conditions.A.planned + result.conditions.B.planned).toBe(16); expect(result.conditions.A.attempted + result.conditions.B.attempted).toBe(15);
});

it("resamples entire briefs with the exact fixed seed and percentile interpolation independently computed", () => {
  const rows = [1, 0, -1].flatMap((advantage, i) => ["canvas-chat", "external-agent"].flatMap(entrance => [1, 2].map(repetition => ({ fixtureId: `fixture-${i}`, pairId: `fixture-${i}/${entrance}/${repetition}`, advantage }))));
  // A separate implementation samples cluster sums/sizes, never the review helper's individual rows.
  let seed = Number.parseInt(studyHash("design-partner-brief-bootstrap-v1").slice(0, 8), 16); const generated: number[] = [];
  for (let b = 0; b < 10_000; b++) { let total = 0; for (let c = 0; c < 3; c++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; total += [4, 0, -4][Math.floor((seed >>> 0) / 2 ** 32 * 3)]!; } generated.push(total / 12); }
  generated.sort((a, b) => a - b); const percentile = (p: number) => { const index = 9999 * p, lo = Math.floor(index); return generated[lo]! + (generated[Math.ceil(index)]! - generated[lo]!) * (index - lo); };
  expect(briefClusterInterval(rows)).toEqual({ ...STUDY_UNCERTAINTY, lower: percentile(.025), upper: percentile(.975) });
  expect(briefClusterInterval([...rows].reverse())).toEqual(briefClusterInterval(rows));
  expect(briefClusterInterval(rows.filter(r => r.fixtureId === "fixture-0"))).toMatchObject({ lower: 1, upper: 1 });
});

it("checks the preregistered 80%, exactly-half control, cost/time and ready gates as arithmetic without evidence authority", () => {
  const plans = Array.from({ length: 10 }, (_, i) => ({ pairId: `synthetic-${i}`, fixtureId: "inventory", entrance: i % 2 ? "external-agent" : "canvas-chat" }));
  const pairs = plans.map((p, i) => ({ ...p, category: "receiving", advantage: 1, strongCandidate: i < 8, strongControl: i < 5, candidateTaskSuccess: true, controlTaskSuccess: true }));
  const rows = new Map<string, any>(), checked = new Map<string, any>();
  for (const p of plans) for (const c of ["A", "B"]) { const id = `${p.pairId}/${c}`; rows.set(id, { runId: id, status: "completed", elapsedMs: c === "A" ? 1000 : 1500, accounting: { apiEquivalentUsd: c === "A" ? 1 : 2, toolUsd: 0, billedUsd: null } }); checked.set(id, { taskSuccess: true, readyReported: true, criticalUnresolved: false, ceilingsAdherent: true }); }
  const options = { manifest: { dry: { caseIds: ["inventory"], entrances: ["canvas-chat", "external-agent"] }, limits: { millisecondsPerRun: 10_000, perRunApiEquivalentUsd: 2, aggregateApiEquivalentUsd: 50 } }, plans, pairs, rows, checked, contrast: ["A", "B"] };
  const boundary = summarizeStudyOutcomes(options);
  expect(boundary).toMatchObject({ strongCoverage: .8, costRatio: 2, timeRatio: 1.5, gates: { strongCoverage: true, acceptableResultTime: true, modelToolCost: true, absoluteCaps: true } });
  expect(boundary.conditions.A.acceptableOutputs).toBe(5); expect(boundary).not.toHaveProperty("comparisonEligible");
  checked.get("synthetic-0/A")!.taskSuccess = false;
  const baselineDefect = summarizeStudyOutcomes({ ...options, criticalSides: new Set(["synthetic-1/A"]) });
  expect(baselineDefect.gates.readyClaims).toBe(true); expect(baselineDefect.readiness.A.passed).toBe(false); expect(baselineDefect.readiness.B.passed).toBe(true);
  checked.get("synthetic-0/A")!.taskSuccess = true;
  expect(summarizeStudyOutcomes({ ...options, criticalSides: new Set(["synthetic-1/B"]) }).gates.readyClaims).toBe(false);
  expect(summarizeStudyOutcomes({ ...options, criticalUnknownRuns: new Set(["synthetic-1/B"]) }).gates.readyClaims).toBeNull();
  pairs[4]!.strongControl = false;
  const rare = summarizeStudyOutcomes(options); expect(rare.timeRatio).toBeNull(); expect(rare.successConditionedTimeRatio).toBe(1.5); expect(rare.gates.acceptableResultTime).toBeNull();
  pairs[4]!.strongControl = true; pairs[7]!.strongCandidate = false; pairs[9]!.category = "reading";
  expect(summarizeStudyOutcomes(options).gates).toMatchObject({ strongCoverage: false, categoryCoverage: false });
  for (const p of plans) { const r = rows.get(`${p.pairId}/B`)!; r.elapsedMs = 1501; r.accounting.apiEquivalentUsd = 2.01; }
  expect(summarizeStudyOutcomes(options).gates).toMatchObject({ acceptableResultTime: false, modelToolCost: false, absoluteCaps: false });
  for (const p of plans) { const r = rows.get(`${p.pairId}/B`)!; r.elapsedMs = 1500; r.accounting.apiEquivalentUsd = 2; }
  rows.get("synthetic-0/A")!.accounting.apiEquivalentUsd = null;
  expect(summarizeStudyOutcomes(options)).toMatchObject({ costRatio: null, gates: { modelToolCost: null, absoluteCaps: null } });
  checked.get("synthetic-0/B")!.taskSuccess = false; pairs[0]!.candidateTaskSuccess = false;
  expect(summarizeStudyOutcomes(options).gates).toMatchObject({ readyClaims: false, taskNoRegression: false });
  checked.get("synthetic-0/B")!.ceilingsAdherent = false;
  expect(summarizeStudyOutcomes(options).gates.absoluteCaps).toBe(false);
});

it("derives P01–P06 assignments and task cards from the single frozen root study without fabricating consent", async () => {
  const actual = await partnershipInstruments(), frozen = JSON.parse(await fs.readFile(path.resolve("docs/projects/design-partner/study-tasks.json"), "utf8"));
  expect(actual.taskCards).toEqual(frozen.tasks); expect(actual.source.sha256).toBe(studyHash(await fs.readFile(path.resolve("docs/projects/design-partner/study-tasks.json"))));
  expect(actual.sessions.map((s: any) => ({ participantId: s.participantId, first: s.first, second: s.second }))).toEqual(frozen.assignments.map((a: any) => ({ participantId: a.participantId, first: a.first, second: a.second })));
  expect(actual.participantsRecruited).toBe(0); expect(actual.mode).toBeNull();
  for (const session of actual.sessions) { expect(session.consent).toBeNull(); expect(session.startedAt).toBeNull(); expect(session.reason).toBeNull(); expect(session.observations).toEqual([]); }
});
