import { describe, expect, it, vi } from "vitest";
import { CANVAS_GROUPS_FEATURE, type Actor, type Operation, type PersonalLinkResponse } from "@isocan/core";
import { Engine, type Desk, type Store } from "@isocan/server";
import { PersonalService } from "../../packages/server/src/personal.ts";
import { mint } from "./desk-conformance.ts";

/** The same real writer/service assertions run over disk and emulator storage. */
export interface PersonalLifecycleFixture {
  store: Store;
  desk: Desk;
  reopen(): Promise<{ store: Store; desk: Desk }>;
  done(): Promise<void>;
}

const badgeId = "bdg_acme_lifecycle";
const home = "https://acme.invalid";
const destination = "prj_acme_lifecycle";

function services(backing: Pick<PersonalLifecycleFixture, "store" | "desk">) {
  const engine = new Engine(backing.store, backing.desk);
  const personal = new PersonalService(engine, backing.store, backing.desk, () => false);
  return { ...backing, engine, personal };
}

async function prepare(backing: Pick<PersonalLifecycleFixture, "store" | "desk">) {
  const f = services(backing);
  await f.desk.put(mint(badgeId));
  const claim = async (key: string, name: string) => (await f.engine.claim({ badgeId, op: { type: "actor.claim", sessionKey: key, name } })).envelope.actor;
  const owner = await claim("home:maya", "Maya");
  const agent = await claim("test:cedar", "Cedar");
  await submit(f.engine, owner, null, { type: "project.create", canvasId: destination, title: "Acme shared work", groupMode: "groups" });
  await f.desk.admit(badgeId, destination, { root: "created" }, "own");
  const source = (await f.personal.ensure(badgeId, owner.id, home)).source!.canvasId;
  const pin = await addPin(f.engine, owner, source, "itm_first", "PRIVATE_FIRST_390");
  const linked = await f.personal.link(badgeId, destination, { actorId: owner.id, requestId: "first-link" }, home);
  await f.personal.delegate(badgeId, owner.id, source, agent.id, true);
  return { ...f, owner, agent, source, pin, linked, claim };
}

function submit(engine: Engine, actor: Actor, canvasId: string | null, op: Operation) {
  return engine.submit({ badgeId, actor, canvasId, op, clientFeatures: CANVAS_GROUPS_FEATURE });
}

async function addPin(engine: Engine, actor: Actor, canvasId: string, itemId: string, text: string) {
  const blob = await engine.putBlob(canvasId, Buffer.from(text), { mimeType: "text/plain", filename: "preference.txt" });
  const version = { ...blob, id: `ver_${itemId}`, filename: "preference.txt" };
  await submit(engine, actor, canvasId, { type: "item.add", itemId, title: text, properties: { context: "pinned" },
    width: 300, height: 200, placement: { x: 0, y: 0 }, version });
  return version;
}

async function content(personal: PersonalService, actorId: string, linked: PersonalLinkResponse) {
  return personal.read(badgeId, destination, { actorId, itemId: linked.link.itemId, mode: "content" }, home);
}

function privateReadCounter(f: ReturnType<typeof services>, sourceIds: string[]) {
  const sources = new Set(sourceIds);
  const spies = [
    vi.spyOn(f.engine, "getSnapshot"), vi.spyOn(f.engine, "getLog"),
    vi.spyOn(f.engine as unknown as { runtime(id: string): Promise<unknown> }, "runtime"),
    vi.spyOn(f.store, "load"), vi.spyOn(f.store, "openBlob"),
  ];
  return {
    none: () => { for (const spy of spies) expect(spy.mock.calls.filter(([id]) => sources.has(id))).toEqual([]); },
    restore: () => { for (const spy of spies) spy.mockRestore(); },
  };
}

/** A stable primary pointer must preserve the actual private datasets and their separate authority. */
export function personalLifecycleConformance(name: string, make: () => Promise<PersonalLifecycleFixture>, skip?: string): void {
  describe(`Personal lifecycle — ${name}${skip ? ` [SKIPPED: ${skip}]` : ""}`, () => {
    const test = skip ? it.skip : it;
    test("rename and joining two existing sources retain bytes, concrete consent and source-specific delegates across restart", async () => {
      const backing = await make();
      try {
        const f = await prepare(backing);
        const other = await f.claim("home:theo", "Theo");
        const otherAgent = await f.claim("test:birch", "Birch");
        const second = (await f.personal.ensure(badgeId, other.id, home)).source!.canvasId;
        const secondPin = await addPin(f.engine, other, second, "itm_second", "PRIVATE_SECOND_720");
        const secondLink = await f.personal.link(badgeId, destination, { actorId: other.id, requestId: "second-link" }, home);
        await f.personal.delegate(badgeId, other.id, second, otherAgent.id, true);
        expect(second).not.toBe(f.source);
        const consent = await f.desk.personalLinkForItem(destination, f.linked.link.itemId);
        const secondConsent = await f.desk.personalLinkForItem(destination, secondLink.link.itemId);
        const delegates = await f.desk.personalDelegations(f.source);
        const secondDelegates = await f.desk.personalDelegations(second);

        const renamed = await f.claim("home:maya", "Maya Revised");
        expect(renamed.id).toBe(f.owner.id);
        expect(await f.personal.ensure(badgeId, renamed.id, home)).toMatchObject({ source: { canvasId: f.source }, owner: renamed, created: false });
        await f.engine.joinActors({ badgeId, actor: renamed, op: { type: "actor.join", from: other.id, into: renamed.id } });

        const retained = async (current: ReturnType<typeof services>) => {
          for (const actorId of [renamed.id, other.id]) {
            expect(await current.personal.ensure(badgeId, actorId, home)).toMatchObject({
              source: { canvasId: f.source, state: "live" }, preserved: [{ canvasId: second, state: "live" }], created: false,
            });
            expect((await content(current.personal, actorId, f.linked)).pieces).toMatchObject([{ versionId: f.pin.id, text: "PRIVATE_FIRST_390" }]);
            expect((await content(current.personal, actorId, secondLink)).pieces).toMatchObject([{ versionId: secondPin.id, text: "PRIVATE_SECOND_720" }]);
          }
          expect((await current.store.load(f.source))!.state.canvas.items.itm_first!.versions[0]!.blobHash).toBe(f.pin.blobHash);
          expect((await current.store.load(second))!.state.canvas.items.itm_second!.versions[0]!.blobHash).toBe(secondPin.blobHash);
          expect(await current.desk.personalLinkForItem(destination, f.linked.link.itemId)).toEqual(consent);
          expect(await current.desk.personalLinkForItem(destination, secondLink.link.itemId)).toEqual(secondConsent);
          expect(await current.desk.personalDelegations(f.source)).toEqual(delegates);
          expect(await current.desk.personalDelegations(second)).toEqual(secondDelegates);
          expect((await content(current.personal, f.agent.id, f.linked)).pieces[0]!.text).toBe("PRIVATE_FIRST_390");
          expect((await content(current.personal, otherAgent.id, secondLink)).pieces[0]!.text).toBe("PRIVATE_SECOND_720");
          const reads = privateReadCounter(current, [f.source, second]);
          try {
            await expect(content(current.personal, f.agent.id, secondLink)).rejects.toMatchObject({ statusCode: 403 });
            await expect(content(current.personal, otherAgent.id, f.linked)).rejects.toMatchObject({ statusCode: 403 });
            reads.none();
          } finally { reads.restore(); }
        };
        await retained(f);
        await retained(services(await backing.reopen()));
      } finally { await backing.done(); }
    });

    for (const state of ["taken-down", "deleted", "purged"] as const) test(`${state} sources refuse owner and delegate before private reads, including after restart`, async () => {
      const backing = await make();
      try {
        const f = await prepare(backing);
        expect((await content(f.personal, f.agent.id, f.linked)).pieces[0]!.text).toBe("PRIVATE_FIRST_390");
        if (state === "deleted") await submit(f.engine, f.owner, f.source, { type: "project.delete" });
        else {
          await f.store.setTakenDown(f.source, new Date().toISOString());
          if (state === "purged") await f.store.purgeCanvas(f.source);
        }
        const refused = async (current: ReturnType<typeof services>) => {
          expect(await current.store.canvasLifecycle(f.source)).toBe(state);
          expect(await current.desk.personalSource(f.source)).not.toBeNull();
          const reads = privateReadCounter(current, [f.source]);
          try {
            for (const actorId of [f.owner.id, f.agent.id]) for (const mode of ["summary", "content"] as const) {
              await expect(current.personal.read(badgeId, destination, { actorId, itemId: f.linked.link.itemId, mode }, home)).rejects.toMatchObject({ statusCode: 403, code: "personal-refused" });
            }
            reads.none();
          } finally { reads.restore(); }
        };
        await refused(f);
        await refused(services(await backing.reopen()));
      } finally { await backing.done(); }
    });
  });
}
