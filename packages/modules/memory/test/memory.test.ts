/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import {
  CLIENT_FEATURES_HEADER,
  CURRENT_CLIENT_FEATURES,
  askTheDoor,
  bearerHeader,
  grantsRoute,
  newCanvasId,
  newItemId,
  newVersionId,
  registerModule,
  unregisterModule,
  type Actor,
  type CanvasSnapshotResponse,
  type StoredBadge,
} from "@isocan/core";
import { CONTEXT_BUDGETS, parseReflectionDoc } from "@isocan/core/context-budget";
import { parsePointer } from "@isocan/core/pointer";
import { startDaemon, type Daemon } from "../../../server/src/daemon.ts";
import {
  MEMORY_FORGET_ROUTE,
  MEMORY_HYDRATE_ROUTE,
  MEMORY_LEARN_ROUTE,
  MEMORY_PLACE_ROUTE,
  MEMORY_PROPS,
  MEMORY_REFLECT_ROUTE,
  MEMORY_SEARCH_ROUTE,
  POINTER_MIME,
  memoryModule,
  type MemoryForgetResponse,
  type MemoryHydrateResponse,
  type MemoryLearnResponse,
  type MemoryPlaceResponse,
  type MemoryReflectResponse,
  type MemorySearchResponse,
} from "../src/core.ts";

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  unregisterModule(memoryModule.name);
  while (cleanup.length > 0) {
    const fn = cleanup.pop()!;
    await fn();
  }
});

async function mkHome(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-memory-test-"));
  cleanup.push(() => fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return dir;
}

function daemonBase(d: Daemon): string {
  const addr = d.app.server.address() as AddressInfo;
  return `http://127.0.0.1:${addr.port}`;
}

async function boot(home: string): Promise<Daemon> {
  const d = await startDaemon({
    home,
    port: 0,
    contentPort: "off",
    gcIntervalMs: 0,
    blobCheckIntervalMs: 0,
  });
  cleanup.push(() => d.close());
  return d;
}

function authHeaders(badge: StoredBadge, json = false): Record<string, string> {
  return {
    ...bearerHeader(badge),
    [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function mintEditor(base: string, sessionKey: string, name: string): Promise<{ badge: StoredBadge; actor: Actor }> {
  const knocked = await askTheDoor(base);
  if (!("badge" in knocked)) throw new Error(`door refused: ${knocked.refused.error}`);
  const { badge } = knocked;
  const claimRes = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(badge, true),
    body: JSON.stringify({
      canvasId: null,
      actor: { id: "", name },
      op: { type: "actor.claim", sessionKey, name },
    }),
  });
  expect(claimRes.status).toBe(200);
  const claimed = (await claimRes.json()) as { envelope: { actor: Actor } };
  return { badge, actor: claimed.envelope.actor };
}

async function createCanvas(base: string, badge: StoredBadge, actor: Actor, title: string): Promise<string> {
  const canvasId = newCanvasId();
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(badge, true),
    body: JSON.stringify({
      canvasId: null,
      actor,
      op: { type: "project.create", canvasId, title },
    }),
  });
  expect(res.status).toBe(200);
  return canvasId;
}

async function addTextItem(
  base: string,
  badge: StoredBadge,
  actor: Actor,
  canvasId: string,
  title: string,
  body: string,
): Promise<string> {
  const blobRes = await fetch(`${base}/api/projects/${canvasId}/blobs`, {
    method: "POST",
    headers: {
      ...authHeaders(badge),
      "Content-Type": "text/markdown",
      "X-Isocan-Filename": `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`,
    },
    body,
  });
  expect(blobRes.status).toBe(200);
  const blob = (await blobRes.json()) as { blobHash: string; size: number };
  const itemId = newItemId();
  const opRes = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: authHeaders(badge, true),
    body: JSON.stringify({
      canvasId,
      actor,
      op: {
        type: "item.add",
        itemId,
        version: {
          id: newVersionId(),
          blobHash: blob.blobHash,
          mimeType: "text/markdown",
          filename: "note.md",
          size: blob.size,
        },
        width: 300,
        height: 180,
        placement: { x: 0, y: 0 },
        title,
      },
    }),
  });
  expect(opRes.status).toBe(200);
  return itemId;
}

describe("@isocan/memory against real daemon", () => {
  it("reflects v1->v2 preserving guidance, learns on About you, places zero-leak pointer, hydrates 200/403, and searches across canvases", async () => {
    registerModule(memoryModule);
    const home = await mkHome();
    const daemon = await boot(home);
    const base = daemonBase(daemon);

    const alice = await mintEditor(base, "test:acme-alice", "Alice");
    const bob = await mintEditor(base, "test:acme-bob", "Bob");

    const sharedCanvasId = await createCanvas(base, alice.badge, alice.actor, "Acme Launch");
    const aboutAliceId = await createCanvas(base, alice.badge, alice.actor, "About you (Alice)");

    // Admit Bob to the shared canvas via a link grant (and NOT to Alice's private "About you" canvas).
    const grantRes = await fetch(`${base}${grantsRoute(sharedCanvasId)}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({ subject: "link", capability: "edit" }),
    });
    expect(grantRes.status).toBe(200);
    const admitRes = await fetch(`${base}/api/projects/${sharedCanvasId}/canvas`, {
      headers: authHeaders(bob.badge),
    });
    expect(admitRes.status).toBe(200);

    // Add a real item and comment thread on the shared canvas.
    const specId = await addTextItem(
      base,
      alice.badge,
      alice.actor,
      sharedCanvasId,
      "Acme Checkout Spec",
      "Checkout flow uses single-column layout and emerald primary CTA.",
    );

    const commentRes = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({
        canvasId: sharedCanvasId,
        actor: alice.actor,
        op: {
          type: "thread.create",
          threadId: "t-acme-1",
          anchorItemId: specId,
          x: 10,
          y: 10,
          comment: { id: "c-acme-1", body: "Check mobile keyboard overlap." },
        },
      }),
    });
    expect(commentRes.status).toBe(200);

    // 1. Reflect v1
    const reflect1Res = await fetch(`${base}${MEMORY_REFLECT_ROUTE}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({
        canvasId: sharedCanvasId,
        focus: "Shipping Acme Checkout v1",
        actor: alice.actor,
      }),
    });
    expect(reflect1Res.status).toBe(200);
    const reflect1 = (await reflect1Res.json()) as MemoryReflectResponse;
    expect(reflect1.created).toBe(true);
    expect(reflect1.markdown).toContain(`#${specId}`);
    expect(reflect1.markdown).toContain("comment:t-acme-1");
    expect(reflect1.markdown).toContain(`_Updated: ${reflect1.updatedAt}_`);

    // 2. Learn project guidance
    const learnProjRes = await fetch(`${base}${MEMORY_LEARN_ROUTE}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({
        canvasId: sharedCanvasId,
        text: "Never use rounded-full on primary rectangular buttons.",
        target: "project",
        actor: alice.actor,
      }),
    });
    expect(learnProjRes.status).toBe(200);
    const learnProj = (await learnProjRes.json()) as MemoryLearnResponse;
    expect(learnProj.itemId).toBe(reflect1.itemId);

    // 3. Reflect v2 preserves guidance and stacks a new version
    const reflect2Res = await fetch(`${base}${MEMORY_REFLECT_ROUTE}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({
        canvasId: sharedCanvasId,
        focus: "Polishing Acme Checkout v2",
        actor: alice.actor,
      }),
    });
    expect(reflect2Res.status).toBe(200);
    const reflect2 = (await reflect2Res.json()) as MemoryReflectResponse;
    expect(reflect2.created).toBe(false);
    expect(reflect2.itemId).toBe(reflect1.itemId);
    const parsedV2 = parseReflectionDoc(reflect2.markdown);
    expect(parsedV2.sections["Your project guidance"]).toContain("Never use rounded-full");
    expect(parsedV2.sections["Current intent"]).toBe("Polishing Acme Checkout v2");

    const snapAfterReflect = (await (
      await fetch(`${base}/api/projects/${sharedCanvasId}/canvas`, {
        headers: authHeaders(alice.badge),
      })
    ).json()) as CanvasSnapshotResponse;
    expect(snapAfterReflect.canvas.items[reflect1.itemId]!.versions.length).toBeGreaterThanOrEqual(3);

    // 4. Learn private observation on Alice's "About you" canvas
    const secretObservation = "Alice strongly prefers Swiss-grid typography and dislikes drop shadows.";
    const learnPersonalRes = await fetch(`${base}${MEMORY_LEARN_ROUTE}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({
        canvasId: sharedCanvasId,
        text: secretObservation,
        target: "personal",
        facet: "quality_and_taste_bar",
        confidence: 0.95,
        proofs: 4,
        personalCanvasId: aboutAliceId,
        actor: alice.actor,
      }),
    });
    expect(learnPersonalRes.status).toBe(200);
    const learnPersonal = (await learnPersonalRes.json()) as MemoryLearnResponse;
    expect(learnPersonal.canvasId).toBe(aboutAliceId);
    expect(learnPersonal.facet).toBe("quality_and_taste_bar");

    // 5. Place pointer on shared canvas — zero private text in blob
    const placeRes = await fetch(`${base}${MEMORY_PLACE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({
        canvasId: sharedCanvasId,
        ref: `${aboutAliceId}:${learnPersonal.itemId}`,
        facet: "quality_and_taste_bar",
        label: "Typography preference",
        actor: alice.actor,
      }),
    });
    expect(placeRes.status).toBe(200);
    const placed = (await placeRes.json()) as MemoryPlaceResponse;

    const snapWithPointer = (await (
      await fetch(`${base}/api/projects/${sharedCanvasId}/canvas`, {
        headers: authHeaders(bob.badge),
      })
    ).json()) as CanvasSnapshotResponse;
    const pointerItem = snapWithPointer.canvas.items[placed.itemId]!;
    expect(pointerItem.properties[MEMORY_PROPS.role]).toBe("pointer");
    const pointerVer = pointerItem.versions[0]!;
    expect(pointerVer.mimeType).toBe(POINTER_MIME);

    const blobRes = await fetch(`${base}/api/projects/${sharedCanvasId}/blobs/${pointerVer.blobHash}`, {
      headers: authHeaders(bob.badge),
    });
    const rawPointer = await blobRes.text();
    expect(rawPointer).not.toContain("Swiss-grid");
    expect(rawPointer).not.toContain("drop shadows");
    expect(parsePointer(rawPointer)).toEqual({
      ref: `${aboutAliceId}:${learnPersonal.itemId}`,
      ownerId: alice.actor.id,
      facet: "quality_and_taste_bar",
      label: "Typography preference",
    });

    // 6. Hydrate: 200 for Alice, 403 locked for Bob
    const hydrateAliceRes = await fetch(`${base}${MEMORY_HYDRATE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({
        canvasId: sharedCanvasId,
        itemId: placed.itemId,
        actor: alice.actor,
      }),
    });
    expect(hydrateAliceRes.status).toBe(200);
    const hydrateAlice = (await hydrateAliceRes.json()) as MemoryHydrateResponse;
    expect(hydrateAlice.locked).toBe(false);
    expect(hydrateAlice.text).toContain("Swiss-grid typography");

    const hydrateBobRes = await fetch(`${base}${MEMORY_HYDRATE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(bob.badge, true),
      body: JSON.stringify({
        canvasId: sharedCanvasId,
        itemId: placed.itemId,
        actor: bob.actor,
      }),
    });
    expect(hydrateBobRes.status).toBe(403);
    const hydrateBob = (await hydrateBobRes.json()) as { locked?: boolean };
    expect(hydrateBob.locked).toBe(true);

    // 7. Search across two admitted canvases within CONTEXT_BUDGETS.history
    await addTextItem(
      base,
      alice.badge,
      alice.actor,
      aboutAliceId,
      "Checkout Typography Note",
      "Remember to pair emerald CTA with Swiss-grid checkout spacing.",
    );

    const searchRes = await fetch(`${base}${MEMORY_SEARCH_ROUTE}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({
        canvasId: sharedCanvasId,
        query: "checkout emerald",
        actor: alice.actor,
      }),
    });
    expect(searchRes.status).toBe(200);
    const search = (await searchRes.json()) as MemorySearchResponse;
    const hitCanvases = new Set(search.hits.map((h) => h.canvasId));
    expect(hitCanvases.has(sharedCanvasId)).toBe(true);
    expect(hitCanvases.has(aboutAliceId)).toBe(true);
    expect(search.tokensUsed).toBeLessThanOrEqual(CONTEXT_BUDGETS.history);
  });

  it("forgets an observation with a durable tombstone: deletes item, excludes from search and reflect, and hydrates 410 Gone", async () => {
    registerModule(memoryModule);
    const home = await mkHome();
    const daemon = await boot(home);
    const base = daemonBase(daemon);

    const alice = await mintEditor(base, "test:acme-forget-alice", "Alice");
    const bob = await mintEditor(base, "test:acme-forget-bob", "Bob");

    const sharedCanvasId = await createCanvas(base, alice.badge, alice.actor, "Acme Forget Shared");
    const aboutAliceId = await createCanvas(base, alice.badge, alice.actor, "About you (Alice)");

    // Admit Bob to the shared canvas only.
    const grantRes = await fetch(`${base}${grantsRoute(sharedCanvasId)}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({ subject: "link", capability: "edit" }),
    });
    expect(grantRes.status).toBe(200);
    expect(
      (await fetch(`${base}/api/projects/${sharedCanvasId}/canvas`, { headers: authHeaders(bob.badge) })).status,
    ).toBe(200);

    // Alice records a personal observation and places a pointer to it on the shared canvas.
    const learnRes = await fetch(`${base}${MEMORY_LEARN_ROUTE}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({
        canvasId: sharedCanvasId,
        text: "Alice avoids neon chartreuse gradients in Acme checkout dialogs.",
        target: "personal",
        facet: "quality_and_taste_bar",
        personalCanvasId: aboutAliceId,
        actor: alice.actor,
      }),
    });
    expect(learnRes.status).toBe(200);
    const obs = (await learnRes.json()) as MemoryLearnResponse;

    const placeRes = await fetch(`${base}${MEMORY_PLACE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({
        canvasId: sharedCanvasId,
        ref: `${aboutAliceId}:${obs.itemId}`,
        facet: "quality_and_taste_bar",
        label: "Gradient preference",
        actor: alice.actor,
      }),
    });
    expect(placeRes.status).toBe(200);
    const pointer = (await placeRes.json()) as MemoryPlaceResponse;

    // Sanity: before forget, search finds the observation and hydrate succeeds for Alice.
    const preSearchRes = await fetch(`${base}${MEMORY_SEARCH_ROUTE}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({ canvasId: sharedCanvasId, query: "chartreuse gradients", actor: alice.actor }),
    });
    expect(preSearchRes.status).toBe(200);
    const preSearch = (await preSearchRes.json()) as MemorySearchResponse;
    expect(preSearch.hits.some((h) => h.itemId === obs.itemId)).toBe(true);

    const preHydrateRes = await fetch(`${base}${MEMORY_HYDRATE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({ canvasId: sharedCanvasId, itemId: pointer.itemId, actor: alice.actor }),
    });
    expect(preHydrateRes.status).toBe(200);

    // Bob cannot forget Alice's pointer on the shared canvas (403).
    const bobForgetRes = await fetch(`${base}${MEMORY_FORGET_ROUTE}`, {
      method: "POST",
      headers: authHeaders(bob.badge, true),
      body: JSON.stringify({ canvasId: sharedCanvasId, itemId: pointer.itemId, actor: bob.actor }),
    });
    expect(bobForgetRes.status).toBe(403);

    // Alice calls source-level forget on her observation.
    const forgetRes = await fetch(`${base}${MEMORY_FORGET_ROUTE}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({
        canvasId: aboutAliceId,
        itemId: obs.itemId,
        reason: "No longer accurate",
        actor: alice.actor,
      }),
    });
    expect(forgetRes.status).toBe(200);
    const forgotten = (await forgetRes.json()) as MemoryForgetResponse;
    expect(forgotten.forgotten).toBe(true);
    expect(forgotten.deleted).toBe(true);
    expect(forgotten.exclusion.canvasId).toBe(aboutAliceId);
    expect(forgotten.exclusion.itemId).toBe(obs.itemId);
    expect(forgotten.exclusion.actorId).toBe(alice.actor.id);
    expect(forgotten.exclusion.reason).toBe("No longer accurate");

    // (a) The observation item is deleted and the tombstone is persisted on disk.
    const aboutSnap = (await (
      await fetch(`${base}/api/projects/${aboutAliceId}/canvas`, { headers: authHeaders(alice.badge) })
    ).json()) as CanvasSnapshotResponse;
    expect(aboutSnap.canvas.items[obs.itemId]).toBeUndefined();

    const ledgerRaw = await fs.readFile(path.join(home, "memory-exclusions.json"), "utf8");
    expect(ledgerRaw).toContain(obs.itemId);

    // (b) Search never returns the forgotten observation.
    const postSearchRes = await fetch(`${base}${MEMORY_SEARCH_ROUTE}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({ canvasId: sharedCanvasId, query: "chartreuse gradients", actor: alice.actor }),
    });
    expect(postSearchRes.status).toBe(200);
    const postSearch = (await postSearchRes.json()) as MemorySearchResponse;
    expect(postSearch.hits.some((h) => h.itemId === obs.itemId)).toBe(false);

    // (c) Reflect excludes both the forgotten observation (on About you) and the pointer referencing it (on shared).
    const aboutReflectRes = await fetch(`${base}${MEMORY_REFLECT_ROUTE}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({ canvasId: aboutAliceId, actor: alice.actor }),
    });
    expect(aboutReflectRes.status).toBe(200);
    const aboutReflect = (await aboutReflectRes.json()) as MemoryReflectResponse;
    expect(aboutReflect.markdown).not.toContain(obs.itemId);
    expect(aboutReflect.markdown).not.toContain("chartreuse");

    const sharedReflectRes = await fetch(`${base}${MEMORY_REFLECT_ROUTE}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({ canvasId: sharedCanvasId, actor: alice.actor }),
    });
    expect(sharedReflectRes.status).toBe(200);
    const sharedReflect = (await sharedReflectRes.json()) as MemoryReflectResponse;
    expect(sharedReflect.markdown).not.toContain(pointer.itemId);
    expect(sharedReflect.markdown).not.toContain("Gradient preference");

    // (d) Hydrate on the pointer referencing the forgotten observation returns 410 Gone { forgotten: true }.
    const postHydrateRes = await fetch(`${base}${MEMORY_HYDRATE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(alice.badge, true),
      body: JSON.stringify({ canvasId: sharedCanvasId, itemId: pointer.itemId, actor: alice.actor }),
    });
    expect(postHydrateRes.status).toBe(410);
    const postHydrate = (await postHydrateRes.json()) as { forgotten?: boolean };
    expect(postHydrate.forgotten).toBe(true);

    // Collaborator Bob still gets 403 locked (does not leak forgotten state).
    const bobHydrateRes = await fetch(`${base}${MEMORY_HYDRATE_ROUTE}`, {
      method: "POST",
      headers: authHeaders(bob.badge, true),
      body: JSON.stringify({ canvasId: sharedCanvasId, itemId: pointer.itemId, actor: bob.actor }),
    });
    expect(bobHydrateRes.status).toBe(403);
  });
});
