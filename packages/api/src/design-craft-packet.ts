import type { Actor } from "@isocan/core";
import { parseDesignArtifactRef, parseDesignBrief, parseDesignQuestionSet, parseDesignResponse, type DesignArtifactRef, type DesignBrief, type DesignQuestionSet, type DesignResponse } from "@isocan/core/design-partner";
import { parseDesignComparison, parseDesignDecisionInput, type DesignComparison, type DesignDecisionInput } from "@isocan/core/design-decision";
import { parseDesignProjection, type DesignProjection } from "./design-system-reader.ts";
import { designCraftGuidance, designCraftRevision, designCraftSources } from "./design-craft-guidance.ts";
import { craftLicense, craftNotice } from "./craft/sources.ts";
import { parseDesignReviewOutput } from "./design-review-contract.ts";

/** Guidance is selected explicitly; ordinary design work never opts in automatically. */
export type DesignCraftStage = "new-work" | "critique" | "finish";
type Status = "current" | "stale" | "unavailable";
type CraftFile = { path: string; mimeType: string; size: number; sha256: string; data: string };
/** A bounded, attributed context projection whose original files remain independent of local edits. */
export interface DesignCraftPacket {
  schemaVersion: 1; kind: "craft-packet"; mode: "adapted-guidance"; revision: typeof designCraftRevision; packetId: string;
  stage: DesignCraftStage; status: Status; reasons: string[];
  upstream: { repository: "https://github.com/pbakaus/impeccable"; commit: "2149fcce39a90bb409df5f16515f316a76dc6199"; skillVersion: "4.3.1"; resources: ReturnType<typeof designCraftSources> };
  request: { ref: DesignArtifactRef; brief: DesignBrief; author: Actor };
  questions: Array<{ questions: DesignQuestionSet; author: Actor; status: "open" | "answered" | "superseded" | "stale"; outstandingQuestionIds: string[]; responses: Array<{ response: DesignResponse; author: Actor }> }>;
  decisions: Array<{ input: DesignDecisionInput; comparison: DesignComparison; adopted: DesignArtifactRef; author: Actor; recommendationAuthor: Actor; recommendation: string; status: Status }>;
  governing: { status: "available"; projection: DesignProjection; author: Actor } | { status: "none" | "unavailable"; reason: string };
  references: Array<{ artifact: DesignArtifactRef; roles: string[]; title: string; filename: string; mimeType: string; path: string | null; reason: string | null }>;
  runtimeReports: Array<{ receipt: DesignArtifactRef; output: Extract<ReturnType<typeof parseDesignReviewOutput>, { kind: "repository" }>; author: Actor; status: Status }>;
  files: CraftFile[];
  limits: string[];
}

/** Deterministic serialization binds every field, independent of object insertion order. */
export function craftSemantic(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(craftSemantic).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + craftSemantic((value as Record<string, unknown>)[key])).join(",") + "}";
  return JSON.stringify(value);
}
/** Exact byte hashes identify packet files and never imply their source was authorized. */
export async function craftHash(value: string | Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value)))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
/** Base64 keeps arbitrary permitted reference bytes serializable in either runtime. */
export function craftBytes(file: Pick<CraftFile, "data">): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data)) throw new Error("Invalid packet file encoding.");
  return Uint8Array.from(atob(file.data), character => character.charCodeAt(0));
}
/** A generated safe filename and exact bytes form one immutable baseline file. */
export async function craftFile(path: string, content: string | Uint8Array, mimeType: string): Promise<CraftFile> {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  if (bytes.length > 2 * 1024 * 1024) throw new Error("A craft reference exceeds the 2 MiB packet file limit.");
  let binary = ""; for (let at = 0; at < bytes.length; at += 8192) binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
  return { path, mimeType, size: bytes.length, sha256: await craftHash(bytes), data: btoa(binary) };
}
/** Context prose is generated from canonical facts; local edits stay proposed notes. */
export function craftContextFiles(packet: Omit<DesignCraftPacket, "files" | "packetId">): Record<string, string> {
  const b = packet.request.brief;
  const list = (values: string[]) => values.length ? values.map(value => `- ${value}`).join("\n") : "None recorded.";
  const provenance = b.facts.map(fact => `${fact.origin}: ${JSON.stringify(fact)}`);
  const decisions = packet.decisions.map(one => { const chosen = one.comparison.alternatives.find(option => option.id === one.input.chosenAlternativeId)!; return `${one.input.decisionKey}: accepted choice ${chosen.id} — ${chosen.title}. Hypothesis: ${chosen.hypothesis} Tradeoff: ${chosen.tradeoff} Exact option: ${JSON.stringify(chosen.artifact)}. Authority: ${JSON.stringify(one.input.authority)} · by ${one.author.name} (${one.author.id}). Original recommendation (${one.comparison.recommendedAlternativeId}) by ${one.recommendationAuthor.name}: ${one.recommendation}`; });
  const output = packet.references.filter(one => one.roles.includes("output") && one.path);
  const product = ["# Product", "<!-- impeccable:product-schema 1 -->", "", "## Platform", "web", "", "## Users", b.audience ?? "Unresolved; see the saved brief.", "", "## Product Purpose", b.primaryTask ?? "Unresolved; see the saved brief.", "", "## Brand Commitments", list(b.constraints), "", "## Facts and provenance", list(provenance), "", "## Canonical field attribution", JSON.stringify(b.continuation?.factProvenance ?? {}, null, 2), "Supplied describes the fact category; only the canonical attribution establishes direct, reported or questionnaire origin. Assumed facts remain assumptions.", "", "## Accepted decisions", list(decisions), "", "## Saved questions and outcomes", ...packet.questions.map(question => JSON.stringify(question)), "", "## Evidence on Hand", list(packet.references.map(one => one.path ?? `${one.filename || one.artifact.itemId}: unavailable — ${one.reason}`)), "", "## Supplied references", list(b.references.map(one => JSON.stringify(one))), "", "## Projection boundary", `Request ${b.requestId}, epoch ${b.epoch}; ${packet.request.ref.itemId}@${packet.request.ref.versionId}. Delivery: ${b.delivery}. Local changes are proposed context notes, not confirmed facts. Adopt them with an explicit brief correction.`, ""].join("\n");
  const surface = ["---", "version: 1", "slug: task", `primary_target: ${JSON.stringify(output[0]?.path ?? ".")}`, `related_targets: ${JSON.stringify(output.slice(1).map(one => one.path))}`, "---", "# Saved design task", "", "## Task", b.primaryTask ?? "Unresolved in saved brief.", "", "## Audience", b.audience ?? "Unresolved in saved brief.", "", "## Confirmed constraints", list(b.constraints), "", "## Direction and scope", `Intent: ${b.intent}; fidelity: ${b.fidelity}; delivery: ${b.delivery}.`, "", list(decisions), "", "## Limits", list(packet.limits), ""].join("\n");
  const reported = packet.runtimeReports.length ? "\n## Reported repository delivery\n" + list(packet.runtimeReports.map(report => `${JSON.stringify(report.output)} · reported by ${report.author.name} · ${report.status} · exact receipt ${JSON.stringify(report.receipt)}`)) + "\nThese are existing authored reports. This packet did not inspect or run the repository.\n" : "";
  return { "PRODUCT.md": product + reported, ".impeccable/surfaces/task.md": surface + reported, "GUIDANCE.md": designCraftGuidance(packet), "LICENSE.impeccable": craftLicense, "NOTICE.impeccable.md": craftNotice };
}

function object(value: unknown, keys: string[]): asserts value is Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !(key in value))) throw new Error("Invalid or unsupported craft packet fields.");
}
function strings(value: unknown): asserts value is string[] { if (!Array.isArray(value) || value.length > 1024 || value.some(one => typeof one !== "string" || one.length > 100000)) throw new Error("Invalid craft text list."); }
function actor(value: unknown): asserts value is Actor { object(value, ["id", "name"]); if (typeof value.id !== "string" || !value.id || typeof value.name !== "string") throw new Error("Invalid craft author."); }
const status = (value: unknown) => { if (!["current", "stale", "unavailable"].includes(value as string)) throw new Error("Invalid craft currentness."); };

/** Validate the complete saved shape, provenance payloads, source pin and baseline bytes before reuse. */
export async function parseDesignCraftPacket(value: unknown): Promise<DesignCraftPacket> {
  if (new TextEncoder().encode(JSON.stringify(value)).length > 12 * 1024 * 1024) throw new Error("Craft packet exceeds its 12 MiB bound.");
  object(value, ["schemaVersion", "kind", "mode", "revision", "packetId", "stage", "status", "reasons", "upstream", "request", "questions", "decisions", "governing", "references", "runtimeReports", "files", "limits"]);
  const p = value as unknown as DesignCraftPacket;
  if (p.schemaVersion !== 1 || p.kind !== "craft-packet" || p.mode !== "adapted-guidance" || p.revision !== designCraftRevision || !["new-work", "critique", "finish"].includes(p.stage)) throw new Error("Unsupported craft packet revision or stage.");
  status(p.status); strings(p.reasons); strings(p.limits);
  const pin = { repository: "https://github.com/pbakaus/impeccable", commit: "2149fcce39a90bb409df5f16515f316a76dc6199", skillVersion: "4.3.1", resources: designCraftSources(p.stage) };
  if (craftSemantic(p.upstream) !== craftSemantic(pin)) throw new Error("Craft source identities disagree with this adaptation.");
  object(p.request, ["ref", "brief", "author"]); parseDesignArtifactRef(p.request.ref); parseDesignBrief(p.request.brief); actor(p.request.author);
  if (!Array.isArray(p.questions) || p.questions.length > 128 || !Array.isArray(p.decisions) || p.decisions.length > 128 || !Array.isArray(p.references) || p.references.length > 64 || !Array.isArray(p.files) || p.files.length > 72) throw new Error("Invalid craft collection bound.");
  for (const q of p.questions) {
    object(q, ["questions", "author", "status", "outstandingQuestionIds", "responses"]); parseDesignQuestionSet(q.questions); actor(q.author); strings(q.outstandingQuestionIds);
    if (!["open", "answered", "superseded", "stale"].includes(q.status) || !Array.isArray(q.responses) || q.responses.length > 128 || q.questions.requestId !== p.request.brief.requestId) throw new Error("Invalid saved question.");
    for (const response of q.responses) { object(response, ["response", "author"]); parseDesignResponse(response.response); actor(response.author); }
  }
  for (const d of p.decisions) { object(d, ["input", "comparison", "adopted", "author", "recommendationAuthor", "recommendation", "status"]); parseDesignDecisionInput(d.input); parseDesignComparison(d.comparison); if (!d.comparison.alternatives.some(option => option.id === d.input.chosenAlternativeId) || d.comparison.requestId !== d.input.requestId || d.recommendation !== d.comparison.recommendation) throw new Error("Accepted choice disagrees with its saved comparison."); parseDesignArtifactRef(d.adopted); actor(d.author); actor(d.recommendationAuthor); status(d.status); if (typeof d.recommendation !== "string" || d.input.requestId !== p.request.brief.requestId) throw new Error("Invalid saved decision."); }
  if (!Array.isArray(p.runtimeReports) || p.runtimeReports.length > 128) throw new Error("Invalid reported runtime scope.");
  for (const report of p.runtimeReports) { object(report, ["receipt", "output", "author", "status"]); parseDesignArtifactRef(report.receipt); if (parseDesignReviewOutput(report.output).kind !== "repository" || p.request.brief.delivery !== "connected-app") throw new Error("Runtime report disagrees with declared delivery."); actor(report.author); status(report.status); }
  if (p.governing.status === "available") { object(p.governing, ["status", "projection", "author"]); await parseDesignProjection(p.governing.projection); actor(p.governing.author); }
  else { object(p.governing, ["status", "reason"]); if (!["none", "unavailable"].includes(p.governing.status) || typeof p.governing.reason !== "string") throw new Error("Invalid governing availability."); }
  const paths = new Set<string>(); let bytes = 0;
  for (const f of p.files) {
    object(f, ["path", "mimeType", "size", "sha256", "data"]);
    if (typeof f.path !== "string" || !/^(?:PRODUCT\.md|GUIDANCE\.md|LICENSE\.impeccable|NOTICE\.impeccable\.md|DESIGN\.md|DESIGN\.projection\.json|\.impeccable\/surfaces\/task\.md|references\/[0-9]{2}-[a-zA-Z0-9_.-]+)$/.test(f.path) || paths.has(f.path) || typeof f.mimeType !== "string" || !Number.isSafeInteger(f.size) || f.size < 0 || f.size > 2 * 1024 * 1024 || typeof f.data !== "string" || f.data.length > 3 * 1024 * 1024) throw new Error("Invalid craft file.");
    const content = craftBytes(f); bytes += content.length;
    if (content.length !== f.size || await craftHash(content) !== f.sha256 || bytes > 8 * 1024 * 1024) throw new Error("Craft file bytes disagree with their hashes or size bound.");
    paths.add(f.path);
  }
  const expected = new Set(Object.keys(craftContextFiles(p)));
  const artifacts = new Set<string>();
  for (const r of p.references) {
    object(r, ["artifact", "roles", "title", "filename", "mimeType", "path", "reason"]); parseDesignArtifactRef(r.artifact); strings(r.roles);
    const identity = craftSemantic(r.artifact);
    if (artifacts.has(identity) || !r.roles.length || new Set(r.roles).size !== r.roles.length || r.roles.some(role => !["context", "reference", "fact", "decision", "alternative", "output"].includes(role))) throw new Error("Invalid or duplicate craft reference role/identity.");
    artifacts.add(identity);
    if (![r.title, r.filename, r.mimeType].every(one => typeof one === "string") || r.path !== null && typeof r.path !== "string" || r.reason !== null && typeof r.reason !== "string" || (r.path === null) === (r.reason === null)) throw new Error("Invalid craft reference availability.");
    if (r.path) { const file = p.files.find(one => one.path === r.path); if (!r.path.startsWith("references/") || !file || file.sha256 !== r.artifact.blobHash || file.mimeType !== r.mimeType) throw new Error("Reference file disagrees with its exact artifact."); expected.add(r.path); }
  }
  const text = (name: string) => new TextDecoder("utf-8", { fatal: true }).decode(craftBytes(p.files.find(file => file.path === name)!));
  if (p.governing.status === "available") {
    expected.add("DESIGN.md"); expected.add("DESIGN.projection.json");
    if (!paths.has("DESIGN.md") || !paths.has("DESIGN.projection.json") || text("DESIGN.md") !== p.governing.projection.baseText || craftSemantic(await parseDesignProjection(JSON.parse(text("DESIGN.projection.json")))) !== craftSemantic(p.governing.projection)) throw new Error("Governing files disagree with the captured projection.");
  }
  if (craftSemantic([...expected].sort()) !== craftSemantic([...paths].sort())) throw new Error("Craft packet has missing or unexpected files.");
  for (const [name, content] of Object.entries(craftContextFiles(p))) if (text(name) !== content) throw new Error(`Generated ${name} disagrees with its captured context.`);
  const { packetId, ...body } = p;
  if (packetId !== await craftHash(craftSemantic(body))) throw new Error("Craft packet identity disagrees with its contents.");
  return structuredClone(p);
}
