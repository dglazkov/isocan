import { afterEach, expect, it } from "vitest";
import { CanvasHandle, designSystemPort, projectDesignSystem, reconcileDesignProjection, readDesignSystem, writeDesignDirection } from "@isocan/api";
import { canvasItemOf, designSystemProperties, newCanvasId, SOURCE_POLICY_HEADER, parseSourcePolicyHeader } from "@isocan/core";
import { questionnaireFixture } from "./questionnaire-fixture.ts";
import { auditDesign } from "./design-audit-fixture.ts";

let fixture: Awaited<ReturnType<typeof questionnaireFixture>> | undefined;
afterEach(async () => { await fixture?.close(); fixture = undefined; });
const direction = { version: 1 as const, stage: "accepted" as const, rationale: "Keep receiving fast for gloved operators.", taskHierarchy: ["Review delivery", "Confirm stock"], layout: "One task column", density: "Comfortable controls", typography: "Existing sans serif", palettePurpose: "Reserve accent for confirmation", treatments: [{ name: "Confirm", guidance: "Keep a full-width primary control", states: ["idle", "invalid", "saved"] }] };
async function setup() {
  const f = fixture = await questionnaireFixture();
  const item = await f.agentCanvas.add({ title: "Acme system", content: auditDesign(), mime: "text/markdown", filename: "DESIGN.md", properties: designSystemProperties() });
  const io = designSystemPort(f.agent), projection = await projectDesignSystem(io, { canvasId: f.canvasId });
  return { f, item, io, projection };
}

it("writes one conditional authored direction, preserves source metadata and retries only its real receipt", async () => {
  const { f, item, io, projection } = await setup();
  const before = await f.client.snapshot(f.canvasId);
  const request = { projection, direction, opId: "op_direction_acme", versionId: "ver_direction_acme" };
  expect(await writeDesignDirection(io, request)).toMatchObject({ status: "accepted", opId: request.opId, consistency: { status: "current" } });
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(before.lastSeq + 1);
  const read = await readDesignSystem(designSystemPort(f.other), { canvasId: f.canvasId });
  expect(read).toMatchObject({ author: f.agent.actor, direction: { status: "valid", direction }, governing: { metadata: { title: item.title, properties: item.properties } } });
  expect(await writeDesignDirection(io, request)).toMatchObject({ status: "accepted", opId: request.opId });
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(before.lastSeq + 1);
  // Generic op-id retry cannot make an unrelated actor or changed content appear saved.
  expect(await writeDesignDirection(designSystemPort(f.other), request)).toMatchObject({ status: "pending", opId: null });
  expect(await writeDesignDirection(io, { ...request, direction: { ...direction, density: "Changed" } })).toMatchObject({ status: "pending", opId: null });
  await f.client.claimActor({ type: "actor.claim", sessionKey: "acme:joined-system-editor", name: "Acme Joined Editor" });
  const joinedActor = (await f.client.actorBindings(["acme:joined-system-editor"]))[0]!.actor;
  await f.client.sendOp(null, joinedActor, { type: "actor.join", from: f.agent.actor.id, into: joinedActor.id });
  expect(await writeDesignDirection(designSystemPort({ ...f.agent, actor: joinedActor }), { ...request, retry: true })).toMatchObject({ status: "accepted", opId: request.opId });
  await f.client.undo(f.canvasId, f.agent.actor);
  expect((await f.client.snapshot(f.canvasId)).canvas.items[item.id]!.currentVersionId).toBe(projection.source.versionId);
});

it("retains lost-ack intent, refuses stale metadata before upload, and keeps accepted save separate from unavailable consistency", async () => {
  const { f, io, projection } = await setup();
  const request = { projection, text: auditDesign("Acme updated"), opId: "op_projection_acme", versionId: "ver_projection_acme" };
  const lost = await reconcileDesignProjection({ ...io, edit: async (...args) => { await io.edit(...args); throw new TypeError("Synthetic lost acknowledgement"); } }, request);
  expect(lost).toMatchObject({ status: "pending", opId: null });
  expect(await reconcileDesignProjection(io, { ...request, retry: true })).toMatchObject({ status: "accepted", opId: request.opId, consistency: { status: "current" } });
  const fresh = await projectDesignSystem(io, { canvasId: f.canvasId });
  let saved = false;
  const unavailable = await reconcileDesignProjection({ ...io, snapshot: (...args) => { if (saved) throw new Error("Synthetic read unavailable"); return io.snapshot(...args); }, edit: async (...args) => { const receipt = await io.edit(...args); saved = true; return receipt; } }, { projection: fresh, text: auditDesign("Acme saved"), opId: "op_saved_unavailable", versionId: "ver_saved_unavailable" });
  expect(unavailable).toMatchObject({ status: "accepted", consistency: { status: "unavailable" } });
  const current = await projectDesignSystem(io, { canvasId: f.canvasId });
  await f.agentCanvas.set(current.source.itemId, { properties: { purpose: "Acme concurrent metadata" } });
  let uploads = 0;
  expect(await reconcileDesignProjection({ ...io, upload: async (...args) => { uploads++; return io.upload(...args); } }, { projection: current, text: auditDesign("Acme stale"), opId: "op_stale_acme", versionId: "ver_stale_acme" })).toMatchObject({ status: "refused" });
  expect(uploads).toBe(0);
  expect(await reconcileDesignProjection({ ...io, snapshot: async () => { throw new Error("Unavailable"); } }, { ...request, retry: true })).toMatchObject({ status: "pending" });
});

it("opens and reconciles inherited bytes through policy-bearing actual reads and writes, retaining exemption independently", async () => {
  const f = fixture = await questionnaireFixture(), libraryId = newCanvasId();
  await f.client.sendOp(null, f.agent.actor, { type: "project.create", canvasId: libraryId, title: "Acme library" });
  const library = new CanvasHandle(f.agent, (await f.client.snapshot(libraryId)).project);
  const item = await library.add({ title: "Acme inherited system", content: auditDesign("Acme library"), mime: "text/markdown", filename: "DESIGN.md", properties: designSystemProperties() });
  await f.agentCanvas.add({ title: "Acme library source", content: f.base, mime: "text/plain", properties: { ...canvasItemOf(f.base, libraryId).properties, memory: "inherit" } });
  await f.client.sendOp(f.canvasId, f.agent.actor, { type: "project.update", patch: { properties: { design: "none" } } });
  const policies: Array<{ method: string; policy: unknown }> = [];
  f.daemon.app.server.on("request", req => {
    if (req.url?.includes(`/api/projects/${libraryId}/`) || req.url === "/api/ops") {
      const header = req.headers[SOURCE_POLICY_HEADER.toLowerCase()];
      policies.push({ method: req.method ?? "GET", policy: typeof header === "string" ? parseSourcePolicyHeader(header) : null });
    }
  });
    const io = designSystemPort(f.agent), projection = await projectDesignSystem(io, { canvasId: f.canvasId });
    expect(projection).toMatchObject({ exempt: true, source: { canvasId: libraryId, itemId: item.id } });
    const saved = await reconcileDesignProjection(io, { projection, text: auditDesign("Acme inherited update"), opId: "op_inherited_save", versionId: "ver_inherited_save" });
    expect(saved).toMatchObject({ status: "accepted", consistency: { status: "current" } });
    expect(policies.length).toBeGreaterThan(3);
    for (const request of policies) expect(request.policy).toMatchObject({ policy: { mode: "exclude" }, expectedHome: f.base });
    expect(Object.values((await f.client.snapshot(f.canvasId)).canvas.items).some(one => one.id === item.id)).toBe(false);
});

it("recovers a lost accepted operation after its proposed version is pruned and its item is removed", async () => {
  const { f, io, projection, item } = await setup();
  const request = { projection, text: auditDesign("Acme first save"), opId: "op_pruned_retry", versionId: "ver_pruned_retry" };
  expect(await reconcileDesignProjection({ ...io, edit: async (...args) => { await io.edit(...args); throw new TypeError("Synthetic lost response"); } }, request)).toMatchObject({ status: "pending" });
  await f.agentCanvas.edit(item.id, { content: auditDesign("Acme later version") });
  await f.client.sendOp(f.canvasId, f.agent.actor, { type: "item.pruneVersions", itemId: item.id, keep: 1 });
  expect((await f.client.snapshot(f.canvasId)).canvas.items[item.id]!.versions.some(one => one.id === request.versionId)).toBe(false);
  expect(await reconcileDesignProjection(io, { ...request, retry: true })).toMatchObject({ status: "accepted", opId: request.opId, consistency: { status: "stale" } });
  await f.agentCanvas.remove(item.id);
  expect(await reconcileDesignProjection(io, { ...request, retry: true })).toMatchObject({ status: "accepted", opId: request.opId, consistency: { status: "unavailable" } });
});

it("keeps permitted direct personal context while refusing the same system as an automatic inherited source", async () => {
  const f = fixture = await questionnaireFixture();
  const personal = (await f.client.ensurePersonal(f.person.actor.id)).source!;
  const handle = new CanvasHandle(f.person, (await f.client.snapshot(personal.canvasId)).project);
  await handle.add({ title: "Acme personal system", content: auditDesign("Acme personal"), mime: "text/markdown", filename: "DESIGN.md", properties: designSystemProperties() });
  const io = designSystemPort(f.person), projection = await projectDesignSystem(io, { canvasId: personal.canvasId });
  expect(await reconcileDesignProjection(io, { projection, text: auditDesign("Acme personal update"), opId: "op_personal_direct", versionId: "ver_personal_direct" })).toMatchObject({ status: "accepted" });
  await f.personCanvas.add({ title: "Acme private inheritance", content: f.base, mime: "text/plain", properties: { ...canvasItemOf(f.base, personal.canvasId).properties, memory: "inherit" } });
  const inherited = await readDesignSystem(io, { canvasId: f.canvasId });
  expect(inherited.governing).toMatchObject({ status: "unavailable", artifact: null });
  await expect(projectDesignSystem(io, { canvasId: f.canvasId })).rejects.toThrow();
});
