import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  parseDesignReviewOutput,
  readDesignRequestReference,
  readDesignRequests
} from "./chunk-VL2CA3MI.mjs";
import {
  designRequestBasisCurrent
} from "./chunk-U4ZPMZI4.mjs";
import {
  questionnaireFailureStatus,
  readGoverningDesign,
  readInheritedCanvases
} from "./chunk-OA4UADPF.mjs";
import {
  designScopeStanding,
  itemKind,
  normalizeHomeUrl,
  parseDesignArtifactRef,
  parseDesignBrief,
  parseDesignComparison,
  parseDesignDecisionInput,
  parseDesignQuestionSet,
  parseDesignResponse,
  resolveActor,
  sameDesignArtifact
} from "./chunk-4JILTJDB.mjs";
import {
  assertJsonCompatible,
  parseDesign,
  serializeDesign
} from "./chunk-TE337AEY.mjs";

// packages/core/src/design-direction.ts
var object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var fail = (message2) => {
  throw new Error(`Design direction: ${message2}`);
};
var text = (value, field) => typeof value === "string" && value.trim().length > 0 && value.length <= 8e3 ? value : fail(`${field} needs bounded nonempty text.`);
function strings(value, field, limit) {
  if (!Array.isArray(value) || !value.length || value.length > limit) fail(`${field} needs between 1 and ${limit} entries.`);
  return value.map((entry) => text(entry, field));
}
function fields(value, names, label) {
  if (!object(value) || Object.keys(value).some((key) => !names.includes(key))) fail(`${label} contains unsupported fields or is not an object.`);
  return value;
}
function parseDesignDirection(value) {
  assertJsonCompatible(value, "isocan.direction");
  const v = fields(value, ["version", "stage", "requestId", "rationale", "taskHierarchy", "layout", "density", "typography", "palettePurpose", "treatments"], "record");
  if (v.version !== 1 || !["provisional", "accepted"].includes(v.stage)) fail("unsupported version or stage.");
  if (!Array.isArray(v.treatments) || !v.treatments.length || v.treatments.length > 32) fail("treatments needs between 1 and 32 entries.");
  const treatments = v.treatments.map((entry) => {
    const t = fields(entry, ["name", "guidance", "states"], "treatment");
    return { name: text(t.name, "treatment name"), guidance: text(t.guidance, "treatment guidance"), states: strings(t.states, "treatment states", 32) };
  });
  if (new Set(treatments.map((t) => t.name)).size !== treatments.length) fail("treatment names must be distinct.");
  return { version: 1, stage: v.stage, ...v.requestId === void 0 ? {} : { requestId: text(v.requestId, "requestId") }, rationale: text(v.rationale, "rationale"), taskHierarchy: strings(v.taskHierarchy, "taskHierarchy", 32), layout: text(v.layout, "layout"), density: text(v.density, "density"), typography: text(v.typography, "typography"), palettePurpose: text(v.palettePurpose, "palettePurpose"), treatments };
}
function readDesignDirection(doc) {
  if (doc.problems.length) return { status: "malformed", problems: [...doc.problems] };
  const vendor = doc.tokens.isocan;
  if (vendor === void 0) return { status: "absent" };
  if (!object(vendor)) return { status: "malformed", problems: ["The isocan extension is not an object."] };
  if (vendor.direction === void 0) return { status: "absent" };
  try {
    return { status: "valid", direction: parseDesignDirection(vendor.direction) };
  } catch (error) {
    return { status: "malformed", problems: [error instanceof Error ? error.message : String(error)] };
  }
}
function withDesignDirection(doc, direction) {
  if (doc.problems.length) fail(`repair the existing document before editing: ${doc.problems.join("; ")}`);
  const vendor = doc.tokens.isocan;
  if (vendor !== void 0 && !object(vendor)) fail("cannot replace a non-object isocan extension while preserving its data.");
  const prior = readDesignDirection(doc);
  if (prior.status === "malformed") fail(`repair the existing direction before editing: ${prior.problems.join("; ")}`);
  if (vendor !== void 0) assertJsonCompatible(vendor);
  return { ...doc, tokens: { ...doc.tokens, isocan: { ...vendor, direction: parseDesignDirection(direction) } } };
}

// packages/api/src/design-system-reader.ts
var message = (error) => error instanceof Error ? error.message : String(error);
var semantic = (value) => {
  if (Array.isArray(value)) return "[" + value.map(semantic).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => JSON.stringify(key) + ":" + semantic(entry)).join(",") + "}";
  return JSON.stringify(value);
};
var hash = async (text2) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text2)))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
var sourceOf = (projection) => ({ canvasId: projection.source.canvasId, expectedHome: normalizeHomeUrl(projection.source.home), mode: projection.source.canvasId === projection.destination.canvasId && normalizeHomeUrl(projection.source.home) === projection.destination.home ? "direct" : "inherited" });
async function readDesignSystem(io, options) {
  const [snapshot, home] = await Promise.all([io.snapshot(options.canvasId, options.signal), io.home(options.canvasId, options.signal)]);
  const target = options.target ?? { kind: "canvas" };
  const linked = await readInheritedCanvases(io, snapshot.canvas, home, options.signal);
  const scope = target.kind === "item" ? snapshot.canvas.items[target.itemId] ? { at: snapshot.canvas.items[target.itemId] } : null : target.kind === "group" ? { groupId: target.groupId } : target.kind === "point" ? { at: { x: target.x, y: target.y } } : {};
  const governing = await readGoverningDesign(io, { canvasId: options.canvasId, canvas: snapshot.canvas, project: snapshot.project, home, linked, ...target.kind === "item" ? { atId: target.itemId } : target.kind === "group" ? { groupId: target.groupId } : target.kind === "point" ? { point: { x: target.x, y: target.y } } : {}, ...options.signal ? { signal: options.signal } : {} });
  const count = scope && designScopeStanding(snapshot.canvas, Object.values(snapshot.canvas.items).filter((item) => itemKind(item) === "screen"), snapshot.project, { ...scope, linked });
  const standing = count && count.selection.status !== "unavailable" ? { standing: count.standing, screenCount: count.screenCount, uncoveredIds: count.uncoveredIds, scopeId: count.scopeId } : null;
  return { governing, direction: governing.status === "available" ? readDesignDirection(governing.document) : { status: "absent" }, author: governing.status === "available" ? governing.author : null, standing };
}
async function projectDesignSystem(io, options) {
  const { governing } = await readDesignSystem(io, options);
  if (governing.status !== "available") throw new Error(governing.reason);
  if (await hash(governing.text) !== governing.artifact.blobHash) throw new Error("The governing document bytes disagree with their source identity.");
  return { schemaVersion: 1, kind: "design-projection", source: governing.artifact, destination: { canvasId: options.canvasId, home: await io.home(options.canvasId, options.signal), target: options.target ?? { kind: "canvas" } }, expectedMetadata: governing.metadata, filename: governing.version.filename, mimeType: governing.version.mimeType, baseText: governing.text, baseHash: governing.artifact.blobHash, exempt: governing.exempt };
}
async function parseDesignProjection(value) {
  const v = value;
  const keys = (object3, allowed) => !!object3 && typeof object3 === "object" && !Array.isArray(object3) && Object.keys(object3).every((key) => allowed.includes(key));
  if (!keys(v, ["schemaVersion", "kind", "source", "destination", "expectedMetadata", "filename", "mimeType", "baseText", "baseHash", "exempt"]) || v.schemaVersion !== 1 || v.kind !== "design-projection" || typeof v.baseText !== "string" || new TextEncoder().encode(v.baseText).length > 1024 * 1024 || typeof v.exempt !== "boolean") throw new Error("Invalid design projection manifest.");
  const source = parseDesignArtifactRef(v.source);
  if (!keys(v.destination, ["canvasId", "home", "target"]) || typeof v.destination.canvasId !== "string" || !v.destination.canvasId || typeof v.destination.home !== "string") throw new Error("The projection needs its original destination.");
  try {
    const url = new URL(v.destination.home);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error("The projection destination needs an authoritative HTTP home.");
  }
  const target = v.destination.target;
  if (!keys(target, ["kind", ...target?.kind === "item" ? ["itemId"] : target?.kind === "group" ? ["groupId"] : target?.kind === "point" ? ["x", "y"] : []]) || !["canvas", "item", "group", "point"].includes(target.kind) || target.kind === "item" && (typeof target.itemId !== "string" || !target.itemId) || target.kind === "group" && (typeof target.groupId !== "string" || !target.groupId) || target.kind === "point" && (!Number.isFinite(target.x) || !Number.isFinite(target.y))) throw new Error("Invalid projection target.");
  if (!keys(v.expectedMetadata, ["title", "properties"]) || typeof v.expectedMetadata.title !== "string" || !v.expectedMetadata.properties || typeof v.expectedMetadata.properties !== "object" || Array.isArray(v.expectedMetadata.properties) || Object.values(v.expectedMetadata.properties).some((value2) => typeof value2 !== "string") || typeof v.filename !== "string" || !v.filename || typeof v.mimeType !== "string" || !v.mimeType) throw new Error("The projection needs exact source metadata.");
  if (v.baseHash !== source.blobHash || await hash(v.baseText) !== v.baseHash) throw new Error("The projection's original bytes do not match its captured hash.");
  return { ...structuredClone(v), source, destination: { ...structuredClone(v.destination), home: normalizeHomeUrl(v.destination.home) } };
}
async function prepareDesignReconciliation(request) {
  const projection = await parseDesignProjection(request.projection);
  if (!request.opId || !request.versionId || typeof request.text !== "string") throw new Error("Reconciliation needs stable operation/version IDs and authored text.");
  if (new TextEncoder().encode(request.text).length > 1024 * 1024) throw new Error("The replacement design exceeds the 1 MiB projection limit.");
  const document = parseDesign(request.text);
  if (document.problems.length) throw new Error(`The replacement design cannot be read: ${document.problems.join("; ")}`);
  return { ...request, projection };
}
async function reconcileDesignProjection(io, request) {
  request = await prepareDesignReconciliation(request);
  const { projection, signal } = request;
  const blobHash = await hash(request.text), size = new TextEncoder().encode(request.text).byteLength;
  const source = { ...projection.source, versionId: request.versionId, blobHash };
  const result = { status: "pending", source, submittedOpId: request.opId, opId: null };
  const operation = { type: "item.edit", itemId: source.itemId, expectedVersionId: projection.source.versionId, expectedMetadata: projection.expectedMetadata, patch: {}, version: { id: request.versionId, blobHash, size, filename: projection.filename, mimeType: projection.mimeType } };
  const read = () => readDesignSystem(io, { canvasId: projection.destination.canvasId, target: projection.destination.target, ...signal ? { signal } : {} });
  const sourceSnapshot = async () => {
    const source2 = sourceOf(projection);
    if (source2.mode === "inherited") return io.sourceSnapshot(source2, signal);
    if (normalizeHomeUrl(await io.home(source2.canvasId, signal)) !== source2.expectedHome) throw new Error("The direct source authority changed.");
    return io.snapshot(source2.canvasId, signal);
  };
  const preflight = async () => {
    const [current, origin2] = await Promise.all([read(), sourceSnapshot()]);
    if (normalizeHomeUrl(await io.home(projection.destination.canvasId, signal)) !== projection.destination.home) throw new Error("The destination authority changed. Retain this working draft.");
    const selected = current.governing;
    if (selected.status !== "available") throw new Error(selected.reason);
    if (!sameDesignArtifact(selected.artifact, projection.source) || selected.exempt !== projection.exempt) throw new Error("The governing selection changed. Review the current document and retain this working draft.");
    const item = origin2.canvas.items[source.itemId];
    if (!item || item.currentVersionId !== projection.source.versionId || semantic({ title: item.title, properties: item.properties }) !== semantic(projection.expectedMetadata)) throw new Error("The source version or metadata changed. Retain this working draft and reconcile against the current source.");
    const version = item.versions.find((one) => one.id === projection.source.versionId);
    if (!version || version.filename !== projection.filename || version.mimeType !== projection.mimeType || version.blobHash !== projection.baseHash) throw new Error("The captured source metadata disagrees with its actual version.");
    return origin2;
  };
  let origin;
  try {
    signal?.throwIfAborted();
    origin = await sourceSnapshot();
    const version = origin.canvas.items[source.itemId]?.versions.find((one) => one.id === request.versionId);
    if (!request.retry && !version) {
      await preflight();
      const uploaded = await io.upload(sourceOf(projection), request.text, projection.filename, projection.mimeType, signal);
      if (uploaded.blobHash !== blobHash || uploaded.size !== size) throw new Error("Uploaded bytes do not match the retained reconciliation intent.");
      origin = await preflight();
    }
  } catch (error) {
    signal?.throwIfAborted();
    return { ...result, status: request.retry ? "pending" : "refused", reason: message(error) };
  }
  let receipt;
  try {
    receipt = await io.edit(sourceOf(projection), operation, request.opId, signal);
  } catch (error) {
    return { ...result, status: questionnaireFailureStatus(error), reason: message(error) };
  }
  const envelope = receipt.envelope;
  const sameAuthor = envelope?.actor && resolveActor(origin.joined ?? {}, envelope.actor.id) === resolveActor(origin.joined ?? {}, io.actorId);
  if (!envelope || envelope.canvasId !== source.canvasId || !sameAuthor || semantic(envelope.op) !== semantic(operation)) return { ...result, reason: "The returned operation did not confirm this exact source edit and author. Retain the prepared intent for reconciliation." };
  const savedProjection = { ...projection, source, baseText: request.text, baseHash: blobHash };
  const accepted = { ...result, status: "accepted", opId: envelope.id, savedProjection };
  try {
    const { governing } = await read();
    if (governing.status !== "available") return { ...accepted, consistency: { status: "unavailable", reasons: [governing.reason], governing } };
    const reasons = sameDesignArtifact(governing.artifact, source) && governing.exempt === projection.exempt ? [] : ["The source edit was accepted, but its source or governing selection has since changed."];
    return { ...accepted, consistency: { status: reasons.length ? "stale" : "current", reasons, governing } };
  } catch (error) {
    return { ...accepted, consistency: { status: "unavailable", reasons: [message(error)] } };
  }
}
async function writeDesignDirection(io, request) {
  const projection = await parseDesignProjection(request.projection);
  const document = withDesignDirection(parseDesign(projection.baseText), request.direction);
  return reconcileDesignProjection(io, { ...request, projection, text: serializeDesign(document.tokens, document.body) });
}

// packages/api/src/craft/sources.ts
var craftSources = [
  {
    "path": "reference/adapt.md",
    "bytes": 11301,
    "gitBlob": "85f7c022f5c65baebdd8df16b996898a4f520e3a",
    "sha256": "871a8e4d749b807c693ebabd83defbd6c76e1bd2a0f53a28a460cb1308ba8634"
  },
  {
    "path": "reference/craft-floor.md",
    "bytes": 5500,
    "gitBlob": "ae213ce801ebb2085033b309b4144e8d7e9996ba",
    "sha256": "e802e4f7bdc89050a9c0f2ca506e1d493a2316e6e810c0336c57aa073717ef3e"
  },
  {
    "path": "reference/critique.md",
    "bytes": 45944,
    "gitBlob": "c1285ca137d9aa1280e538601a0e84140246fe56",
    "sha256": "cb8caddbb3919e5bf7f252143b519fb16db28a244642d937b186cb89962d9201"
  },
  {
    "path": "reference/harden.md",
    "bytes": 9450,
    "gitBlob": "124742e1cca3caff2c495009a8f408382e73e7d1",
    "sha256": "16ba7fca1973c5faf53dd2ca523559129c0fe9e5f8d50b645f527afa78186cd2"
  },
  {
    "path": "reference/new-work.md",
    "bytes": 52769,
    "gitBlob": "cd2a22b98eac53ddfe5c2d61b4a31be693e58fe4",
    "sha256": "85b9c2d051de94ee9129c58be111946f73035ca62bbd2a3936f4fa48768fe5cf"
  },
  {
    "path": "reference/operate.md",
    "bytes": 4145,
    "gitBlob": "524f2c3ae9fa497284e9699f3ca5320cce5d05cf",
    "sha256": "a9d2203acd45ca33a13d5c68b02b23ed512425ac15f0e8438318ed124b43729d"
  },
  {
    "path": "reference/polish.md",
    "bytes": 6646,
    "gitBlob": "f93170f773cac058f51e289603aed7575d62a6a2",
    "sha256": "81666fc7f783b4e3514db6554e713dc0479bd9cdedb06e93d15f8b579aae869a"
  }
];
var craftLicense = '                                 Apache License\n                           Version 2.0, January 2004\n                        http://www.apache.org/licenses/\n\n   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION\n\n   1. Definitions.\n\n      "License" shall mean the terms and conditions for use, reproduction,\n      and distribution as defined by Sections 1 through 9 of this document.\n\n      "Licensor" shall mean the copyright owner or entity authorized by\n      the copyright owner that is granting the License.\n\n      "Legal Entity" shall mean the union of the acting entity and all\n      other entities that control, are controlled by, or are under common\n      control with that entity. For the purposes of this definition,\n      "control" means (i) the power, direct or indirect, to cause the\n      direction or management of such entity, whether by contract or\n      otherwise, or (ii) ownership of fifty percent (50%) or more of the\n      outstanding shares, or (iii) beneficial ownership of such entity.\n\n      "You" (or "Your") shall mean an individual or Legal Entity\n      exercising permissions granted by this License.\n\n      "Source" form shall mean the preferred form for making modifications,\n      including but not limited to software source code, documentation\n      source, and configuration files.\n\n      "Object" form shall mean any form resulting from mechanical\n      transformation or translation of a Source form, including but\n      not limited to compiled object code, generated documentation,\n      and conversions to other media types.\n\n      "Work" shall mean the work of authorship, whether in Source or\n      Object form, made available under the License, as indicated by a\n      copyright notice that is included in or attached to the work\n      (an example is provided in the Appendix below).\n\n      "Derivative Works" shall mean any work, whether in Source or Object\n      form, that is based on (or derived from) the Work and for which the\n      editorial revisions, annotations, elaborations, or other modifications\n      represent, as a whole, an original work of authorship. For the purposes\n      of this License, Derivative Works shall not include works that remain\n      separable from, or merely link (or bind by name) to the interfaces of,\n      the Work and Derivative Works thereof.\n\n      "Contribution" shall mean any work of authorship, including\n      the original version of the Work and any modifications or additions\n      to that Work or Derivative Works thereof, that is intentionally\n      submitted to the Licensor for inclusion in the Work by the copyright\n      owner or by an individual or Legal Entity authorized to submit on\n      behalf of the copyright owner. For the purposes of this definition,\n      "submitted" means any form of electronic, verbal, or written\n      communication sent to the Licensor or its representatives, including\n      but not limited to communication on electronic mailing lists, source\n      code control systems, and issue tracking systems that are managed by,\n      or on behalf of, the Licensor for the purpose of discussing and\n      improving the Work, but excluding communication that is conspicuously\n      marked or otherwise designated in writing by the copyright owner as\n      "Not a Contribution."\n\n      "Contributor" shall mean Licensor and any individual or Legal Entity\n      on behalf of whom a Contribution has been received by Licensor and\n      subsequently incorporated within the Work.\n\n   2. Grant of Copyright License. Subject to the terms and conditions of\n      this License, each Contributor hereby grants to You a perpetual,\n      worldwide, non-exclusive, no-charge, royalty-free, irrevocable\n      copyright license to reproduce, prepare Derivative Works of,\n      publicly display, publicly perform, sublicense, and distribute the\n      Work and such Derivative Works in Source or Object form.\n\n   3. Grant of Patent License. Subject to the terms and conditions of\n      this License, each Contributor hereby grants to You a perpetual,\n      worldwide, non-exclusive, no-charge, royalty-free, irrevocable\n      (except as stated in this section) patent license to make, have made,\n      use, offer to sell, sell, import, and otherwise transfer the Work,\n      where such license applies only to those patent claims licensable\n      by such Contributor that are necessarily infringed by their\n      Contribution(s) alone or by combination of their Contribution(s)\n      with the Work to which such Contribution(s) was submitted. If You\n      institute patent litigation against any entity (including a\n      cross-claim or counterclaim in a lawsuit) alleging that the Work\n      or a Contribution incorporated within the Work constitutes direct\n      or contributory patent infringement, then any patent licenses\n      granted to You under this License for that Work shall terminate\n      as of the date such litigation is filed.\n\n   4. Redistribution. You may reproduce and distribute copies of the\n      Work or Derivative Works thereof in any medium, with or without\n      modifications, and in Source or Object form, provided that You\n      meet the following conditions:\n\n      (a) You must give any other recipients of the Work or\n          Derivative Works a copy of this License; and\n\n      (b) You must cause any modified files to carry prominent notices\n          stating that You changed the files; and\n\n      (c) You must retain, in the Source form of any Derivative Works\n          that You distribute, all copyright, patent, trademark, and\n          attribution notices from the Source form of the Work,\n          excluding those notices that do not pertain to any part of\n          the Derivative Works; and\n\n      (d) If the Work includes a "NOTICE" text file as part of its\n          distribution, then any Derivative Works that You distribute must\n          include a readable copy of the attribution notices contained\n          within such NOTICE file, excluding those notices that do not\n          pertain to any part of the Derivative Works, in at least one\n          of the following places: within a NOTICE text file distributed\n          as part of the Derivative Works; within the Source form or\n          documentation, if provided along with the Derivative Works; or,\n          within a display generated by the Derivative Works, if and\n          wherever such third-party notices normally appear. The contents\n          of the NOTICE file are for informational purposes only and\n          do not modify the License. You may add Your own attribution\n          notices within Derivative Works that You distribute, alongside\n          or as an addendum to the NOTICE text from the Work, provided\n          that such additional attribution notices cannot be construed\n          as modifying the License.\n\n      You may add Your own copyright statement to Your modifications and\n      may provide additional or different license terms and conditions\n      for use, reproduction, or distribution of Your modifications, or\n      for any such Derivative Works as a whole, provided Your use,\n      reproduction, and distribution of the Work otherwise complies with\n      the conditions stated in this License.\n\n   5. Submission of Contributions. Unless You explicitly state otherwise,\n      any Contribution intentionally submitted for inclusion in the Work\n      by You to the Licensor shall be under the terms and conditions of\n      this License, without any additional terms or conditions.\n      Notwithstanding the above, nothing herein shall supersede or modify\n      the terms of any separate license agreement you may have executed\n      with Licensor regarding such Contributions.\n\n   6. Trademarks. This License does not grant permission to use the trade\n      names, trademarks, service marks, or product names of the Licensor,\n      except as required for reasonable and customary use in describing the\n      origin of the Work and reproducing the content of the NOTICE file.\n\n   7. Disclaimer of Warranty. Unless required by applicable law or\n      agreed to in writing, Licensor provides the Work (and each\n      Contributor provides its Contributions) on an "AS IS" BASIS,\n      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or\n      implied, including, without limitation, any warranties or conditions\n      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A\n      PARTICULAR PURPOSE. You are solely responsible for determining the\n      appropriateness of using or redistributing the Work and assume any\n      risks associated with Your exercise of permissions under this License.\n\n   8. Limitation of Liability. In no event and under no legal theory,\n      whether in tort (including negligence), contract, or otherwise,\n      unless required by applicable law (such as deliberate and grossly\n      negligent acts) or agreed to in writing, shall any Contributor be\n      liable to You for damages, including any direct, indirect, special,\n      incidental, or consequential damages of any character arising as a\n      result of this License or out of the use or inability to use the\n      Work (including but not limited to damages for loss of goodwill,\n      work stoppage, computer failure or malfunction, or any and all\n      other commercial damages or losses), even if such Contributor\n      has been advised of the possibility of such damages.\n\n   9. Accepting Warranty or Additional Liability. While redistributing\n      the Work or Derivative Works thereof, You may choose to offer,\n      and charge a fee for, acceptance of support, warranty, indemnity,\n      or other liability obligations and/or rights consistent with this\n      License. However, in accepting such obligations, You may act only\n      on Your own behalf and on Your sole responsibility, not on behalf\n      of any other Contributor, and only if You agree to indemnify,\n      defend, and hold each Contributor harmless for any liability\n      incurred by, or claims asserted against, such Contributor by reason\n      of your accepting any such warranty or additional liability.\n\n   END OF TERMS AND CONDITIONS\n\n   Copyright 2025 Paul Bakaus\n\n   Licensed under the Apache License, Version 2.0 (the "License");\n   you may not use this file except in compliance with the License.\n   You may obtain a copy of the License at\n\n       http://www.apache.org/licenses/LICENSE-2.0\n\n   Unless required by applicable law or agreed to in writing, software\n   distributed under the License is distributed on an "AS IS" BASIS,\n   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n   See the License for the specific language governing permissions and\n   limitations under the License.\n';
var craftNotice = "# Third-Party Notices\n\nThis project includes content derived from third-party work, used under the terms of its original license.\n\n## Platform Design Skills\n\nThe `skill/reference/ios.md` and `skill/reference/android.md` platform reference files are distilled from ehmo's `platform-design-skills` (Apple Human Interface Guidelines and Material Design 3 rules), rewritten in Impeccable's voice.\n\n**Original work:** https://github.com/ehmo/platform-design-skills\n**Original license:** MIT\n**Author:** ehmo\n";

// packages/api/src/design-craft-guidance.ts
var designCraftRevision = "isocan-craft-v1";
function designCraftSources(stage) {
  const paths = stage === "new-work" ? ["new-work", "operate", "craft-floor"] : stage === "critique" ? ["critique", "craft-floor"] : ["polish", "harden", "adapt", "craft-floor"];
  return craftSources.filter((source) => paths.includes(source.path.slice(10, -3)));
}
function designCraftGuidance(packet) {
  const brief = packet.request.brief;
  const task = brief.primaryTask ?? "the consequential task already identified by the shared design workflow";
  const audience = brief.audience ?? "the audience still to be resolved in the saved brief";
  const common = [
    `Work from this saved brief for ${audience}: ${task}. Preserve supplied facts, explicitly labeled assumptions, skips and accepted decision rationale. Do not repeat settled discovery; use the existing workflow for consequential open decisions.`,
    packet.governing.status === "available" ? "Use the exact incumbent DESIGN.md and the repository's actual components. Extend its tokens and patterns only when the task requires it; a projection is not permission to replace its source." : packet.governing.status === "none" ? "No governing canvas system was identified at this scope. Inspect any actual repository incumbent before choosing a direction; known canvas absence does not establish repository absence." : "Governing authority is unavailable. Preserve that limit and recover the permitted source before claiming system conformance.",
    "Familiar fonts, dense operational tables and standard controls are valid. Let the task determine hierarchy, density, palette purpose and composition. Avoid decoration that competes with the primary action."
  ];
  const stage = packet.stage === "new-work" ? [
    `Compose one complete slice of \u201C${task}\u201D: entry, primary action, confirmation and recovery. Give real content and the most important decision the strongest visual hierarchy.`,
    "Choose structure before details. Reuse settled direction and actual components; show alternatives only for an unresolved consequential uncertainty. There is no mandatory comp, random concept exercise or new interview.",
    "Plan narrow and wide layouts as different reading and interaction contexts. Keep labels, keyboard order, targets, validation and empty/loading/error states usable before adding finishing details."
  ] : packet.stage === "critique" ? [
    `Walk \u201C${task}\u201D using realistic content, errors and recovery. Name concrete evidence, affected users and consequences; distinguish broken behavior from hierarchy, content and consistency problems.`,
    "Read source conformance, actual browser task observations and craft judgment independently. A source analyzer cannot attest browser behavior; missing browser execution remains unavailable.",
    "Prioritize consequential causes: a blocked action, misleading state, inaccessible control or missing recovery before spacing and visual polish. Preserve what already works and explain each proposed correction."
  ] : [
    "Finish in order: blocked tasks, incomplete states, hierarchy and content, shared-pattern consistency, then local polish. Make the smallest coherent correction to the actual cause.",
    "Exercise long content, validation, empty and failure states, zoom, keyboard focus and narrow layouts. Adapt structure and input affordances instead of merely shrinking desktop pixels.",
    "Verify the changed task and neighboring states after a repair. Preserve exact inspected versions, record remaining limits and stop at the shared review's two-repair allowance."
  ];
  return ["# Adapted Impeccable craft guidance", "", `Revision: ${designCraftRevision} \xB7 stage: ${packet.stage}`, "", "Modified, context-specific adaptation of Paul Bakaus's Impeccable; see LICENSE.impeccable and NOTICE.impeccable.md. This is not native playbook execution.", "", ...common.concat(stage).map((line) => `- ${line}`), "", `Delivery: ${brief.delivery}. ${brief.delivery === "connected-app" ? "Inspect the actual repository revision, components and connected runtime. Exported HTML/context cannot substitute for that runtime." : "Inspect the declared HTML output and its actual behavior at the required viewports."}`, "", "Opening this packet records no execution. If you actually apply this guidance, publish an ordinary evidence artifact naming this packet, stage, scope, changes and limits; use tool='isocan adapted Impeccable guidance' and toolVersion='isocan-craft-v1' in the existing review observations. Source audit and browser readings remain independent. Missing browser evidence keeps the final receipt an unverified draft. No additional repair budget is created.", "", "Native playbooks, hooks, overlays, engine downloads, image generation and native reviewer/documenter roles are unsupported and were not run.", ""].join("\n");
}

// packages/api/src/design-craft-packet.ts
function craftSemantic(value) {
  if (Array.isArray(value)) return "[" + value.map(craftSemantic).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + craftSemantic(value[key])).join(",") + "}";
  return JSON.stringify(value);
}
async function craftHash(value) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value)))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function craftBytes(file) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data)) throw new Error("Invalid packet file encoding.");
  return Uint8Array.from(atob(file.data), (character) => character.charCodeAt(0));
}
async function craftFile(path, content, mimeType) {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  if (bytes.length > 2 * 1024 * 1024) throw new Error("A craft reference exceeds the 2 MiB packet file limit.");
  let binary = "";
  for (let at = 0; at < bytes.length; at += 8192) binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
  return { path, mimeType, size: bytes.length, sha256: await craftHash(bytes), data: btoa(binary) };
}
function craftContextFiles(packet) {
  const b = packet.request.brief;
  const list = (values) => values.length ? values.map((value) => `- ${value}`).join("\n") : "None recorded.";
  const provenance = b.facts.map((fact) => `${fact.origin}: ${JSON.stringify(fact)}`);
  const decisions = packet.decisions.map((one) => {
    const chosen = one.comparison.alternatives.find((option) => option.id === one.input.chosenAlternativeId);
    return `${one.input.decisionKey}: accepted choice ${chosen.id} \u2014 ${chosen.title}. Hypothesis: ${chosen.hypothesis} Tradeoff: ${chosen.tradeoff} Exact option: ${JSON.stringify(chosen.artifact)}. Authority: ${JSON.stringify(one.input.authority)} \xB7 by ${one.author.name} (${one.author.id}). Original recommendation (${one.comparison.recommendedAlternativeId}) by ${one.recommendationAuthor.name}: ${one.recommendation}`;
  });
  const output = packet.references.filter((one) => one.roles.includes("output") && one.path);
  const product = ["# Product", "<!-- impeccable:product-schema 1 -->", "", "## Platform", "web", "", "## Users", b.audience ?? "Unresolved; see the saved brief.", "", "## Product Purpose", b.primaryTask ?? "Unresolved; see the saved brief.", "", "## Brand Commitments", list(b.constraints), "", "## Facts and provenance", list(provenance), "", "## Canonical field attribution", JSON.stringify(b.continuation?.factProvenance ?? {}, null, 2), "Supplied describes the fact category; only the canonical attribution establishes direct, reported or questionnaire origin. Assumed facts remain assumptions.", "", "## Accepted decisions", list(decisions), "", "## Saved questions and outcomes", ...packet.questions.map((question) => JSON.stringify(question)), "", "## Evidence on Hand", list(packet.references.map((one) => one.path ?? `${one.filename || one.artifact.itemId}: unavailable \u2014 ${one.reason}`)), "", "## Supplied references", list(b.references.map((one) => JSON.stringify(one))), "", "## Projection boundary", `Request ${b.requestId}, epoch ${b.epoch}; ${packet.request.ref.itemId}@${packet.request.ref.versionId}. Delivery: ${b.delivery}. Local changes are proposed context notes, not confirmed facts. Adopt them with an explicit brief correction.`, ""].join("\n");
  const surface = ["---", "version: 1", "slug: task", `primary_target: ${JSON.stringify(output[0]?.path ?? ".")}`, `related_targets: ${JSON.stringify(output.slice(1).map((one) => one.path))}`, "---", "# Saved design task", "", "## Task", b.primaryTask ?? "Unresolved in saved brief.", "", "## Audience", b.audience ?? "Unresolved in saved brief.", "", "## Confirmed constraints", list(b.constraints), "", "## Direction and scope", `Intent: ${b.intent}; fidelity: ${b.fidelity}; delivery: ${b.delivery}.`, "", list(decisions), "", "## Limits", list(packet.limits), ""].join("\n");
  const reported = packet.runtimeReports.length ? "\n## Reported repository delivery\n" + list(packet.runtimeReports.map((report) => `${JSON.stringify(report.output)} \xB7 reported by ${report.author.name} \xB7 ${report.status} \xB7 exact receipt ${JSON.stringify(report.receipt)}`)) + "\nThese are existing authored reports. This packet did not inspect or run the repository.\n" : "";
  return { "PRODUCT.md": product + reported, ".impeccable/surfaces/task.md": surface + reported, "GUIDANCE.md": designCraftGuidance(packet), "LICENSE.impeccable": craftLicense, "NOTICE.impeccable.md": craftNotice };
}
function object2(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => !(key in value))) throw new Error("Invalid or unsupported craft packet fields.");
}
function strings2(value) {
  if (!Array.isArray(value) || value.length > 1024 || value.some((one) => typeof one !== "string" || one.length > 1e5)) throw new Error("Invalid craft text list.");
}
function actor(value) {
  object2(value, ["id", "name"]);
  if (typeof value.id !== "string" || !value.id || typeof value.name !== "string") throw new Error("Invalid craft author.");
}
var status = (value) => {
  if (!["current", "stale", "unavailable"].includes(value)) throw new Error("Invalid craft currentness.");
};
async function parseDesignCraftPacket(value) {
  if (new TextEncoder().encode(JSON.stringify(value)).length > 12 * 1024 * 1024) throw new Error("Craft packet exceeds its 12 MiB bound.");
  object2(value, ["schemaVersion", "kind", "mode", "revision", "packetId", "stage", "status", "reasons", "upstream", "request", "questions", "decisions", "governing", "references", "runtimeReports", "files", "limits"]);
  const p = value;
  if (p.schemaVersion !== 1 || p.kind !== "craft-packet" || p.mode !== "adapted-guidance" || p.revision !== designCraftRevision || !["new-work", "critique", "finish"].includes(p.stage)) throw new Error("Unsupported craft packet revision or stage.");
  status(p.status);
  strings2(p.reasons);
  strings2(p.limits);
  const pin = { repository: "https://github.com/pbakaus/impeccable", commit: "2149fcce39a90bb409df5f16515f316a76dc6199", skillVersion: "4.3.1", resources: designCraftSources(p.stage) };
  if (craftSemantic(p.upstream) !== craftSemantic(pin)) throw new Error("Craft source identities disagree with this adaptation.");
  object2(p.request, ["ref", "brief", "author"]);
  parseDesignArtifactRef(p.request.ref);
  parseDesignBrief(p.request.brief);
  actor(p.request.author);
  if (!Array.isArray(p.questions) || p.questions.length > 128 || !Array.isArray(p.decisions) || p.decisions.length > 128 || !Array.isArray(p.references) || p.references.length > 64 || !Array.isArray(p.files) || p.files.length > 72) throw new Error("Invalid craft collection bound.");
  for (const q of p.questions) {
    object2(q, ["questions", "author", "status", "outstandingQuestionIds", "responses"]);
    parseDesignQuestionSet(q.questions);
    actor(q.author);
    strings2(q.outstandingQuestionIds);
    if (!["open", "answered", "superseded", "stale"].includes(q.status) || !Array.isArray(q.responses) || q.responses.length > 128 || q.questions.requestId !== p.request.brief.requestId) throw new Error("Invalid saved question.");
    for (const response of q.responses) {
      object2(response, ["response", "author"]);
      parseDesignResponse(response.response);
      actor(response.author);
    }
  }
  for (const d of p.decisions) {
    object2(d, ["input", "comparison", "adopted", "author", "recommendationAuthor", "recommendation", "status"]);
    parseDesignDecisionInput(d.input);
    parseDesignComparison(d.comparison);
    if (!d.comparison.alternatives.some((option) => option.id === d.input.chosenAlternativeId) || d.comparison.requestId !== d.input.requestId || d.recommendation !== d.comparison.recommendation) throw new Error("Accepted choice disagrees with its saved comparison.");
    parseDesignArtifactRef(d.adopted);
    actor(d.author);
    actor(d.recommendationAuthor);
    status(d.status);
    if (typeof d.recommendation !== "string" || d.input.requestId !== p.request.brief.requestId) throw new Error("Invalid saved decision.");
  }
  if (!Array.isArray(p.runtimeReports) || p.runtimeReports.length > 128) throw new Error("Invalid reported runtime scope.");
  for (const report of p.runtimeReports) {
    object2(report, ["receipt", "output", "author", "status"]);
    parseDesignArtifactRef(report.receipt);
    if (parseDesignReviewOutput(report.output).kind !== "repository" || p.request.brief.delivery !== "connected-app") throw new Error("Runtime report disagrees with declared delivery.");
    actor(report.author);
    status(report.status);
  }
  if (p.governing.status === "available") {
    object2(p.governing, ["status", "projection", "author"]);
    await parseDesignProjection(p.governing.projection);
    actor(p.governing.author);
  } else {
    object2(p.governing, ["status", "reason"]);
    if (!["none", "unavailable"].includes(p.governing.status) || typeof p.governing.reason !== "string") throw new Error("Invalid governing availability.");
  }
  const paths = /* @__PURE__ */ new Set();
  let bytes = 0;
  for (const f of p.files) {
    object2(f, ["path", "mimeType", "size", "sha256", "data"]);
    if (typeof f.path !== "string" || !/^(?:PRODUCT\.md|GUIDANCE\.md|LICENSE\.impeccable|NOTICE\.impeccable\.md|DESIGN\.md|DESIGN\.projection\.json|\.impeccable\/surfaces\/task\.md|references\/[0-9]{2}-[a-zA-Z0-9_.-]+)$/.test(f.path) || paths.has(f.path) || typeof f.mimeType !== "string" || !Number.isSafeInteger(f.size) || f.size < 0 || f.size > 2 * 1024 * 1024 || typeof f.data !== "string" || f.data.length > 3 * 1024 * 1024) throw new Error("Invalid craft file.");
    const content = craftBytes(f);
    bytes += content.length;
    if (content.length !== f.size || await craftHash(content) !== f.sha256 || bytes > 8 * 1024 * 1024) throw new Error("Craft file bytes disagree with their hashes or size bound.");
    paths.add(f.path);
  }
  const expected = new Set(Object.keys(craftContextFiles(p)));
  const artifacts = /* @__PURE__ */ new Set();
  for (const r of p.references) {
    object2(r, ["artifact", "roles", "title", "filename", "mimeType", "path", "reason"]);
    parseDesignArtifactRef(r.artifact);
    strings2(r.roles);
    const identity = craftSemantic(r.artifact);
    if (artifacts.has(identity) || !r.roles.length || new Set(r.roles).size !== r.roles.length || r.roles.some((role) => !["context", "reference", "fact", "decision", "alternative", "output"].includes(role))) throw new Error("Invalid or duplicate craft reference role/identity.");
    artifacts.add(identity);
    if (![r.title, r.filename, r.mimeType].every((one) => typeof one === "string") || r.path !== null && typeof r.path !== "string" || r.reason !== null && typeof r.reason !== "string" || r.path === null === (r.reason === null)) throw new Error("Invalid craft reference availability.");
    if (r.path) {
      const file = p.files.find((one) => one.path === r.path);
      if (!r.path.startsWith("references/") || !file || file.sha256 !== r.artifact.blobHash || file.mimeType !== r.mimeType) throw new Error("Reference file disagrees with its exact artifact.");
      expected.add(r.path);
    }
  }
  const text2 = (name) => new TextDecoder("utf-8", { fatal: true }).decode(craftBytes(p.files.find((file) => file.path === name)));
  if (p.governing.status === "available") {
    expected.add("DESIGN.md");
    expected.add("DESIGN.projection.json");
    if (!paths.has("DESIGN.md") || !paths.has("DESIGN.projection.json") || text2("DESIGN.md") !== p.governing.projection.baseText || craftSemantic(await parseDesignProjection(JSON.parse(text2("DESIGN.projection.json")))) !== craftSemantic(p.governing.projection)) throw new Error("Governing files disagree with the captured projection.");
  }
  if (craftSemantic([...expected].sort()) !== craftSemantic([...paths].sort())) throw new Error("Craft packet has missing or unexpected files.");
  for (const [name, content] of Object.entries(craftContextFiles(p))) if (text2(name) !== content) throw new Error(`Generated ${name} disagrees with its captured context.`);
  const { packetId, ...body } = p;
  if (packetId !== await craftHash(craftSemantic(body))) throw new Error("Craft packet identity disagrees with its contents.");
  return structuredClone(p);
}

// packages/api/src/design-craft-reader.ts
async function readDesignCraft(io, options) {
  if (!["new-work", "critique", "finish"].includes(options.stage)) throw new Error("Choose new-work, critique or finish explicitly.");
  const { canvasId, requestId, signal } = options;
  const [read, snapshot, rawHome] = await Promise.all([readDesignRequests(io, { canvasId, filter: { requestId }, ...signal ? { signal } : {} }), io.snapshot(canvasId, signal), io.home(canvasId, signal)]);
  const row = read.requests.find((one) => one.brief.requestId === requestId);
  if (!row) throw new Error(read.unavailable.map((one) => one.reason).join("; ") || "No readable admitted design request has this identity.");
  const home = normalizeHomeUrl(rawHome), brief = row.brief;
  const author = (value) => ({ id: value.id, name: value.name });
  const target = brief.targetItemId ? { kind: "item", itemId: brief.targetItemId } : brief.groupId ? { kind: "group", groupId: brief.groupId } : { kind: "canvas" };
  const reasons = [...row.reasons];
  let governing = row.governing.status === "available" ? { status: "unavailable", reason: "The governing projection has not been read." } : { status: row.governing.status, reason: row.governing.reason };
  if (row.governing.status === "available") {
    try {
      const projection = await projectDesignSystem(io, { canvasId, target, ...signal ? { signal } : {} });
      if (!sameDesignArtifact(projection.source, row.governing.artifact)) throw new Error("The governing selection changed while the packet was read.");
      governing = { status: "available", projection, author: author(row.governing.author) };
    } catch (error) {
      signal?.throwIfAborted();
      governing = { status: "unavailable", reason: error instanceof Error ? error.message : String(error) };
    }
  }
  const cited = [];
  const add = (artifact, role) => {
    const old = cited.find((one) => sameDesignArtifact(one.artifact, artifact));
    if (old) {
      if (!old.roles.includes(role)) old.roles.push(role);
    } else cited.push({ artifact, roles: [role] });
  };
  for (const ref of row.contextReferences) add(ref, "context");
  for (const ref of brief.references) if (ref.artifact) add(ref.artifact, "reference");
  for (const fact of brief.facts) for (const ref of fact.sources) add(ref, "fact");
  for (const decision of row.effectiveDecisions) {
    add(decision.decision.adopted, "decision");
    for (const ref of decision.decision.input.basis.alternatives) add(ref, "alternative");
  }
  for (const id of brief.outputIds) {
    const item = snapshot.canvas.items[id], version = item?.versions.find((one) => one.id === item.currentVersionId);
    if (version) add({ home, canvasId, itemId: id, versionId: version.id, blobHash: version.blobHash }, "output");
    else reasons.push(`Declared output ${id} is unavailable.`);
  }
  if (cited.length > 64) throw new Error("The request exceeds the 64-reference craft packet limit; use the normal exact reference reads.");
  const files = [], references = [];
  for (const [index, citation] of cited.entries()) {
    try {
      const content = await readDesignRequestReference(io, { canvasId, requestId, artifact: citation.artifact, ...signal ? { signal } : {} });
      const name = content.version.filename.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(-100) || "reference.bin";
      const file = await craftFile(`references/${String(index).padStart(2, "0")}-${name}`, content.bytes, content.version.mimeType);
      files.push(file);
      references.push({ ...citation, title: content.title, filename: content.version.filename, mimeType: content.version.mimeType, path: file.path, reason: null });
    } catch (error) {
      signal?.throwIfAborted();
      const reason = error instanceof Error ? error.message : String(error);
      references.push({ ...citation, title: "Unavailable exact reference", filename: "", mimeType: "", path: null, reason });
      reasons.push(`${citation.artifact.itemId}@${citation.artifact.versionId}: ${reason}`);
    }
  }
  if (governing.status === "unavailable") reasons.push(governing.reason);
  const finalSnapshot = await io.snapshot(canvasId, signal);
  if (finalSnapshot.canvas.items[row.ref.itemId]?.currentVersionId !== row.ref.versionId || references.some((reference) => reference.roles.includes("output") && finalSnapshot.canvas.items[reference.artifact.itemId]?.currentVersionId !== reference.artifact.versionId)) reasons.push("The brief or declared output changed while this packet was read; refresh the explicit capture.");
  const limits = ["Adapted guidance only; opening a packet performs no inspection or model call.", "Native playbooks, hooks, overlays, images and native review roles are unsupported and not run.", "Package installation is not inspected by this shared read.", "Existing review obligations and the shared two-repair allowance still apply.", "Supplied URLs are declarations, not downloaded content.", ...brief.delivery === "connected-app" ? ["Actual repository and runtime inspection must be recorded separately; this packet does not establish their revision or behavior."] : []];
  const body = {
    schemaVersion: 1,
    kind: "craft-packet",
    mode: "adapted-guidance",
    revision: designCraftRevision,
    stage: options.stage,
    status: governing.status === "unavailable" || references.some((one) => one.path === null) || reasons.some((one) => one.startsWith("Declared output")) ? "unavailable" : row.status === "current" && !reasons.some((one) => one.startsWith("The brief or declared output changed")) ? "current" : "stale",
    reasons: [...new Set(reasons)],
    upstream: { repository: "https://github.com/pbakaus/impeccable", commit: "2149fcce39a90bb409df5f16515f316a76dc6199", skillVersion: "4.3.1", resources: designCraftSources(options.stage) },
    request: { ref: row.ref, brief, author: author(row.author) },
    questions: row.questions.map((q) => ({ questions: q.questions, author: author(q.author), status: q.status, outstandingQuestionIds: q.outstandingQuestionIds, responses: q.responses.map((r) => ({ response: r.response, author: author(r.author) })) })),
    decisions: row.effectiveDecisions.map((d) => ({ input: d.decision.input, comparison: d.decision.comparison, adopted: d.decision.adopted, author: author(d.author), recommendationAuthor: author(d.decision.recommendationAuthor), recommendation: d.decision.comparison.recommendation, status: d.status })),
    governing,
    references,
    limits,
    runtimeReports: brief.delivery === "connected-app" ? row.receipts.flatMap((receipt) => receipt.receipt.output.kind === "repository" ? [{ receipt: receipt.ref, output: receipt.receipt.output, author: author(receipt.author), status: receipt.status }] : []) : []
  };
  if (governing.status === "available") {
    files.push(await craftFile("DESIGN.md", governing.projection.baseText, "text/markdown"));
    files.push(await craftFile("DESIGN.projection.json", JSON.stringify(governing.projection, null, 2) + "\n", "application/json"));
  }
  for (const [path, text2] of Object.entries(craftContextFiles(body))) files.push(await craftFile(path, text2, "text/markdown"));
  const complete = { ...body, files };
  return parseDesignCraftPacket({ ...complete, packetId: await craftHash(craftSemantic(complete)) });
}
async function checkDesignCraft(io, options) {
  const packet = await parseDesignCraftPacket(options.packet);
  if (packet.request.ref.canvasId !== options.canvasId || packet.request.brief.requestId !== options.requestId) throw new Error("The saved craft packet belongs to another request or canvas.");
  try {
    const current = await readDesignCraft(io, { canvasId: options.canvasId, requestId: options.requestId, stage: packet.stage, ...options.signal ? { signal: options.signal } : {} });
    if (current.packetId === packet.packetId) return { packetId: packet.packetId, status: current.status, reasons: current.reasons };
    const states = await io.requests(options.canvasId, options.signal);
    const row = states.requests.find((one) => one.brief.requestId === options.requestId);
    if (row && current.status === "current" && designRequestBasisCurrent(row, { brief: packet.request.ref, requestId: options.requestId, epoch: packet.request.brief.epoch })) {
      const completion = !sameDesignArtifact(current.request.ref, packet.request.ref);
      if (completion) {
        const snapshot = await io.snapshot(options.canvasId, options.signal);
        const original = snapshot.canvas.items[packet.request.ref.itemId]?.versions.find((version) => version.id === packet.request.ref.versionId && version.blobHash === packet.request.ref.blobHash);
        if (!original) return { packetId: packet.packetId, status: "unavailable", reasons: ["Canonical completion is current, but the original packet's version attribution is unavailable. Preserve the packet and working files."] };
        if (craftSemantic({ id: original.createdBy.id, name: original.createdBy.name }) !== craftSemantic(packet.request.author)) return { packetId: packet.packetId, status: "stale", reasons: ["The packet's captured author disagrees with its canonical original version."] };
      }
      const comparable = (one) => ({
        brief: { ...one.request.brief, progress: "active" },
        author: completion ? packet.request.author : one.request.author,
        questions: one.questions.map((question) => ({ ...question, status: null })),
        decisions: one.decisions,
        governing: one.governing,
        references: one.references,
        runtimeReports: one.runtimeReports,
        files: one.files.filter((file) => file.path.startsWith("references/") || file.path.startsWith("DESIGN."))
      });
      if (craftSemantic(comparable(packet)) === craftSemantic(comparable(current))) return { packetId: packet.packetId, status: "current", reasons: [] };
    }
    return { packetId: packet.packetId, status: current.status === "unavailable" ? "unavailable" : "stale", reasons: [...current.reasons, "The canonical request, answers, accepted decisions, governing source or exact context differs from the original packet. Export a new capture to a new folder; preserve authored working files."] };
  } catch (error) {
    options.signal?.throwIfAborted();
    return { packetId: packet.packetId, status: "unavailable", reasons: [error instanceof Error ? error.message : String(error)] };
  }
}

export {
  readDesignSystem,
  projectDesignSystem,
  parseDesignProjection,
  prepareDesignReconciliation,
  reconcileDesignProjection,
  writeDesignDirection,
  craftHash,
  craftBytes,
  parseDesignCraftPacket,
  readDesignCraft,
  checkDesignCraft
};
