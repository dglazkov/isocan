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

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  newItemId,
  newOpId,
  newVersionId,
  type Actor,
  type CanvasContents,
  type CanvasSnapshotResponse,
  type Item,
  type ModuleRequest,
  type ModuleResponse,
  type ServerHost,
  type ServerModule,
} from "@isocan/core";
import {
  CONTEXT_BUDGETS,
  MEMORY_FACETS,
  packMemoryContext,
  parseReflectionDoc,
  renderReflectionDoc,
  type MemoryFacet,
  type ReflectionDoc,
} from "@isocan/core/context-budget";
import { encodePointer, isPointerOwner, parsePointer } from "@isocan/core/pointer";
import {
  MEMORY_PROPS,
  POINTER_MIME,
  type MemoryExclusion,
  type MemoryForgetRequest,
  type MemoryForgetResponse,
  type MemoryHydrateRequest,
  type MemoryHydrateResponse,
  type MemoryLearnRequest,
  type MemoryLearnResponse,
  type MemoryPlaceRequest,
  type MemoryPlaceResponse,
  type MemoryReflectRequest,
  type MemoryReflectResponse,
  type MemorySearchHit,
  type MemorySearchRequest,
  type MemorySearchResponse,
} from "./core.ts";

/**
 * **Memory's server half: `POST /api/m/memory/{reflect,learn,search,place,hydrate,forget}`**
 * (Open Stitch phase 5).
 *
 * - `POST /reflect`: creates or versions a `role: reflection` markdown item
 *   citing `#item` and `comment:` threads, preserving `"Your project guidance"`
 *   and stamping `_Updated: <ISO>_`.
 * - `POST /learn`: appends explicit guidance to the project reflection or writes
 *   a faceted observation to the caller's private `"About you"` canvas.
 * - `POST /search`: 3-way RRF (`k=60`) across admitted canvases packed within
 *   `CONTEXT_BUDGETS.history`.
 * - `POST /place`: drops a `pointer` item containing only `{ ref, ownerId, facet?, label? }`
 *   with zero private observation text.
 * - `POST /hydrate`: resolves a pointer item — 200 for `ownerId`, 403 locked for
 *   collaborators, 410 Gone when the referenced observation was forgotten.
 * - `POST /forget`: deletes an observation/memory item via `item.delete` and
 *   records a durable exclusion tombstone so reflection, search, and hydration
 *   permanently exclude it.
 */

const MEMORY_BAD_REQUEST = "memory-bad-request";
const MEMORY_NOT_FOUND = "memory-not-found";
const MEMORY_LOCKED = "memory-pointer-locked";
const MEMORY_FORBIDDEN = "memory-forbidden";
const MEMORY_FORGOTTEN = "memory-forgotten";

/** Per-home durable exclusion ledger for source-level Forget (injectable for tests). */
export interface MemoryExclusionLedger {
  add(exclusion: MemoryExclusion): Promise<void>;
  get(canvasId: string, itemId: string): Promise<MemoryExclusion | null>;
  has(canvasId: string, itemId: string): Promise<boolean>;
  list(): Promise<MemoryExclusion[]>;
}

function exclusionKey(canvasId: string, itemId: string): string {
  return `${canvasId}:${itemId}`;
}

export function createInMemoryExclusionLedger(): MemoryExclusionLedger {
  const map = new Map<string, MemoryExclusion>();
  return {
    async add(exclusion) {
      map.set(exclusionKey(exclusion.canvasId, exclusion.itemId), exclusion);
    },
    async get(canvasId, itemId) {
      return map.get(exclusionKey(canvasId, itemId)) ?? null;
    },
    async has(canvasId, itemId) {
      return map.has(exclusionKey(canvasId, itemId));
    },
    async list() {
      return [...map.values()];
    },
  };
}

function createFileExclusionLedger(dataDir: string): MemoryExclusionLedger {
  const filePath = path.join(dataDir, "memory-exclusions.json");
  let loaded: Map<string, MemoryExclusion> | null = null;
  let pendingLoad: Promise<Map<string, MemoryExclusion>> | null = null;

  async function ensureLoaded(): Promise<Map<string, MemoryExclusion>> {
    if (loaded) return loaded;
    if (pendingLoad) return pendingLoad;
    pendingLoad = (async () => {
      const map = new Map<string, MemoryExclusion>();
      try {
        const raw = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(raw) as { exclusions?: MemoryExclusion[] } | MemoryExclusion[];
        const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.exclusions) ? parsed.exclusions : [];
        for (const row of rows) {
          if (row && typeof row.canvasId === "string" && typeof row.itemId === "string") {
            map.set(exclusionKey(row.canvasId, row.itemId), row);
          }
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
          // Ignore corrupted/unreadable file and start clean rather than crashing routes.
        }
      }
      loaded = map;
      return map;
    })();
    return pendingLoad;
  }

  async function persist(map: Map<string, MemoryExclusion>): Promise<void> {
    await fs.mkdir(dataDir, { recursive: true });
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    const payload = JSON.stringify({ version: 1, exclusions: [...map.values()] }, null, 2);
    await fs.writeFile(tmpPath, payload, "utf8");
    await fs.rename(tmpPath, filePath);
  }

  return {
    async add(exclusion) {
      const map = await ensureLoaded();
      map.set(exclusionKey(exclusion.canvasId, exclusion.itemId), exclusion);
      await persist(map);
    },
    async get(canvasId, itemId) {
      const map = await ensureLoaded();
      return map.get(exclusionKey(canvasId, itemId)) ?? null;
    },
    async has(canvasId, itemId) {
      const map = await ensureLoaded();
      return map.has(exclusionKey(canvasId, itemId));
    },
    async list() {
      const map = await ensureLoaded();
      return [...map.values()];
    },
  };
}

const ledgersByDir = new Map<string, MemoryExclusionLedger>();
const fallbackLedger = createInMemoryExclusionLedger();

function ledgerForHost(host: ServerHost): MemoryExclusionLedger {
  const injected = host.options?.exclusionLedger as Partial<MemoryExclusionLedger> | undefined;
  if (
    injected &&
    typeof injected.add === "function" &&
    typeof injected.has === "function" &&
    typeof injected.get === "function" &&
    typeof injected.list === "function"
  ) {
    return injected as MemoryExclusionLedger;
  }
  const dataDir = typeof host.options?.dataDir === "string" && host.options.dataDir.trim()
    ? host.options.dataDir.trim()
    : null;
  if (!dataDir) return fallbackLedger;
  let ledger = ledgersByDir.get(dataDir);
  if (!ledger) {
    ledger = createFileExclusionLedger(dataDir);
    ledgersByDir.set(dataDir, ledger);
  }
  return ledger;
}

function splitPointerRef(ref: string, fallbackCanvasId: string): { targetCanvasId: string; targetItemId: string } {
  const colonIdx = ref.indexOf(":");
  const targetCanvasId = colonIdx > 0 ? ref.slice(0, colonIdx) : fallbackCanvasId;
  const targetItemId = colonIdx > 0 ? ref.slice(colonIdx + 1) : ref;
  return { targetCanvasId, targetItemId };
}

const REFLECTION_SIZE = { width: 420, height: 340 } as const;
const OBSERVATION_SIZE = { width: 320, height: 180 } as const;
const POINTER_SIZE = { width: 280, height: 132 } as const;
const RRF_K = 60;

function checkActor(actor: unknown): string | null {
  if (actor === undefined) return null;
  const a = actor as Partial<Actor> | null;
  if (!a || typeof a !== "object" || typeof a.id !== "string" || !a.id || typeof a.name !== "string") {
    return "when supplied, `actor` must carry non-empty `id` and string `name`";
  }
  return null;
}

async function resolveActor(actor: Actor | undefined, host: ServerHost): Promise<Actor | null> {
  if (actor) {
    await host.speaksFor(actor.id);
    return { id: actor.id, name: actor.name };
  }
  return (await host.defaultActor?.()) ?? null;
}

function nextPlacement(canvas: CanvasContents): { x: number; y: number } {
  const items = Object.values(canvas.items);
  if (items.length === 0) return { x: 0, y: 0 };
  let maxRight = -Infinity;
  let minY = Infinity;
  for (const item of items) {
    const right = item.x + item.width;
    if (right > maxRight) maxRight = right;
    if (item.y < minY) minY = item.y;
  }
  return { x: Math.round(maxRight + 32), y: Number.isFinite(minY) ? Math.round(minY) : 0 };
}

function currentVersionOf(item: Item) {
  return item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[item.versions.length - 1] ?? null;
}

async function readItemText(
  host: ServerHost,
  canvasId: string,
  item: Item,
  maxBytes = 32 * 1024,
): Promise<string> {
  const ver = currentVersionOf(item);
  if (!ver || ver.size > maxBytes) return "";
  if (!ver.mimeType.startsWith("text/") && ver.mimeType !== "application/json") return "";
  const bytes = await host.readBlob(canvasId, ver.blobHash);
  if (!bytes) return "";
  return new TextDecoder().decode(bytes);
}

function findReflectionItem(canvas: CanvasContents): Item | undefined {
  return Object.values(canvas.items).find((i) => i.properties?.[MEMORY_PROPS.role] === "reflection");
}

async function isItemExcluded(
  ledger: MemoryExclusionLedger,
  host: ServerHost,
  canvasId: string,
  item: Item,
): Promise<boolean> {
  if (await ledger.has(canvasId, item.id)) return true;
  const srcCanvasId = item.properties?.[MEMORY_PROPS.sourceCanvasId];
  const srcItemId = item.properties?.[MEMORY_PROPS.sourceItemId];
  if (srcCanvasId && srcItemId && (await ledger.has(srcCanvasId, srcItemId))) return true;
  const ver = currentVersionOf(item);
  if (ver?.mimeType === POINTER_MIME) {
    const raw = await host.readBlob(canvasId, ver.blobHash);
    const pointer = raw ? parsePointer(raw) : null;
    if (pointer) {
      const { targetCanvasId, targetItemId } = splitPointerRef(pointer.ref, canvasId);
      if (await ledger.has(targetCanvasId, targetItemId)) return true;
    }
  }
  return false;
}

async function buildReflectionSections(
  snapshot: CanvasSnapshotResponse,
  existing: ReflectionDoc | null,
  req: MemoryReflectRequest,
  ledger: MemoryExclusionLedger,
  host: ServerHost,
): Promise<ReflectionDoc> {
  const rawItems = Object.values(snapshot.canvas.items).filter(
    (i) => i.properties?.[MEMORY_PROPS.role] !== "reflection",
  );
  const items: Item[] = [];
  const excludedItemIds = new Set<string>();
  for (const item of rawItems) {
    if (await isItemExcluded(ledger, host, req.canvasId, item)) {
      excludedItemIds.add(item.id);
      continue;
    }
    items.push(item);
  }
  const itemLines = items.slice(0, 12).map((i) => {
    const desc = i.properties?.["agentDescription"]?.trim() || i.description?.trim() || i.title;
    return `- #${i.id} (${i.title}): ${desc.slice(0, 120)}`;
  });

  const openThreads: typeof snapshot.canvas.threads[string][] = [];
  for (const t of Object.values(snapshot.canvas.threads)) {
    if (t.anchorItemId && (excludedItemIds.has(t.anchorItemId) || (await ledger.has(req.canvasId, t.anchorItemId)))) {
      continue;
    }
    openThreads.push(t);
  }
  const threadLines = openThreads.slice(0, 10).map((t) => {
    const first = t.comments[0]?.body?.trim() || "Open discussion";
    const anchor = t.anchorItemId ? ` on #${t.anchorItemId}` : "";
    return `- comment:${t.id}${anchor}: ${first.slice(0, 100)}`;
  });

  const sections: ReflectionDoc["sections"] = {
    ...(existing?.sections ?? {}),
  };

  if (req.sections?.["Your project guidance"] !== undefined) {
    sections["Your project guidance"] = req.sections["Your project guidance"];
  }
  if (req.focus?.trim()) {
    sections["Current intent"] = req.focus.trim();
  } else if (!sections["Current intent"]) {
    sections["Current intent"] = `Active work on "${snapshot.project.title}" (${items.length} item${items.length === 1 ? "" : "s"}).`;
  }
  sections["Canvas state"] =
    itemLines.length > 0
      ? itemLines.join("\n")
      : `Canvas "${snapshot.project.title}" has no items yet.`;
  if (threadLines.length > 0) {
    sections["Open threads"] = threadLines.join("\n");
  }
  for (const [k, v] of Object.entries(req.sections ?? {})) {
    if (k === "Your project guidance" || typeof v !== "string") continue;
    if (v.trim()) {
      sections[k as keyof ReflectionDoc["sections"]] = v.trim();
    }
  }

  return {
    title: `${snapshot.project.title} — Reflection`,
    sections,
  };
}

async function handleReflect(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = (req.body ?? {}) as Partial<MemoryReflectRequest>;
  const actorErr = checkActor(body.actor);
  if (actorErr) return { status: 400, body: { error: actorErr, code: MEMORY_BAD_REQUEST } };

  const actor = await resolveActor(body.actor, host);
  if (!actor) return { status: 400, body: { error: "reflect requires a claimed actor", code: MEMORY_BAD_REQUEST } };

  const ledger = ledgerForHost(host);
  const snapshot = await host.canvas(req.canvasId);
  const existing = findReflectionItem(snapshot.canvas);
  let existingDoc: ReflectionDoc | null = null;
  if (existing) {
    const text = await readItemText(host, req.canvasId, existing, 128 * 1024);
    if (text) existingDoc = parseReflectionDoc(text);
  }

  const updatedAt = new Date(host.now()).toISOString();
  const doc: ReflectionDoc = {
    ...(await buildReflectionSections(
      snapshot,
      existingDoc,
      {
        canvasId: req.canvasId,
        ...(body.focus !== undefined ? { focus: body.focus } : {}),
        ...(body.sections !== undefined ? { sections: body.sections } : {}),
        actor,
      },
      ledger,
      host,
    )),
    updatedAt,
  };
  const markdown = renderReflectionDoc(doc);
  const bytes = new TextEncoder().encode(markdown);
  const put = await host.putBlob(req.canvasId, bytes, {
    mimeType: "text/markdown",
    filename: "reflection.md",
  });
  const versionId = newVersionId();

  if (existing) {
    const group = `memory.reflect.${newOpId()}`;
    await host.submit({
      canvasId: req.canvasId,
      actor,
      group,
      op: {
        type: "item.addVersion",
        itemId: existing.id,
        version: {
          id: versionId,
          blobHash: put.blobHash,
          mimeType: put.mimeType,
          filename: "reflection.md",
          size: put.size,
        },
      },
    });
    await host.submit({
      canvasId: req.canvasId,
      actor,
      group,
      op: {
        type: "item.update",
        itemId: existing.id,
        patch: {
          properties: {
            [MEMORY_PROPS.role]: "reflection",
            [MEMORY_PROPS.updatedAt]: updatedAt,
          },
        },
      },
    });
    const res: MemoryReflectResponse = {
      itemId: existing.id,
      versionId,
      blobHash: put.blobHash,
      updatedAt,
      created: false,
      doc,
      markdown,
    };
    return { status: 200, body: res };
  }

  const itemId = newItemId();
  await host.submit({
    canvasId: req.canvasId,
    actor,
    op: {
      type: "item.add",
      itemId,
      version: {
        id: versionId,
        blobHash: put.blobHash,
        mimeType: put.mimeType,
        filename: "reflection.md",
        size: put.size,
      },
      width: REFLECTION_SIZE.width,
      height: REFLECTION_SIZE.height,
      placement: nextPlacement(snapshot.canvas),
      title: "Project Reflection",
      properties: {
        [MEMORY_PROPS.role]: "reflection",
        [MEMORY_PROPS.updatedAt]: updatedAt,
      },
    },
  });
  const res: MemoryReflectResponse = {
    itemId,
    versionId,
    blobHash: put.blobHash,
    updatedAt,
    created: true,
    doc,
    markdown,
  };
  return { status: 200, body: res };
}

async function handleLearn(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = (req.body ?? {}) as Partial<MemoryLearnRequest>;
  const actorErr = checkActor(body.actor);
  if (actorErr) return { status: 400, body: { error: actorErr, code: MEMORY_BAD_REQUEST } };
  if (typeof body.text !== "string" || !body.text.trim()) {
    return { status: 400, body: { error: "learn requires non-empty `text`", code: MEMORY_BAD_REQUEST } };
  }
  const text = body.text.trim();
  const actor = await resolveActor(body.actor, host);
  if (!actor) return { status: 400, body: { error: "learn requires a claimed actor", code: MEMORY_BAD_REQUEST } };

  const target: "project" | "personal" =
    body.target === "personal" || Boolean(body.personalCanvasId) || Boolean(body.facet)
      ? "personal"
      : "project";

  const updatedAt = new Date(host.now()).toISOString();

  if (target === "project") {
    const snapshot = await host.canvas(req.canvasId);
    const existing = findReflectionItem(snapshot.canvas);
    let doc: ReflectionDoc = { title: `${snapshot.project.title} — Reflection`, sections: {} };
    if (existing) {
      const prev = await readItemText(host, req.canvasId, existing, 128 * 1024);
      if (prev) doc = parseReflectionDoc(prev);
    }
    const prevGuidance = doc.sections["Your project guidance"]?.trim();
    const nextGuidance = prevGuidance ? `${prevGuidance}\n- ${text}` : `- ${text}`;
    doc = {
      ...doc,
      updatedAt,
      sections: {
        ...doc.sections,
        "Your project guidance": nextGuidance,
      },
    };
    const markdown = renderReflectionDoc(doc);
    const put = await host.putBlob(req.canvasId, new TextEncoder().encode(markdown), {
      mimeType: "text/markdown",
      filename: "reflection.md",
    });
    const versionId = newVersionId();
    if (existing) {
      const group = `memory.learn.${newOpId()}`;
      await host.submit({
        canvasId: req.canvasId,
        actor,
        group,
        op: {
          type: "item.addVersion",
          itemId: existing.id,
          version: {
            id: versionId,
            blobHash: put.blobHash,
            mimeType: put.mimeType,
            filename: "reflection.md",
            size: put.size,
          },
        },
      });
      await host.submit({
        canvasId: req.canvasId,
        actor,
        group,
        op: {
          type: "item.update",
          itemId: existing.id,
          patch: { properties: { [MEMORY_PROPS.updatedAt]: updatedAt } },
        },
      });
      const res: MemoryLearnResponse = {
        target: "project",
        canvasId: req.canvasId,
        itemId: existing.id,
        versionId,
        blobHash: put.blobHash,
        updatedAt,
      };
      return { status: 200, body: res };
    }
    const itemId = newItemId();
    await host.submit({
      canvasId: req.canvasId,
      actor,
      op: {
        type: "item.add",
        itemId,
        version: {
          id: versionId,
          blobHash: put.blobHash,
          mimeType: put.mimeType,
          filename: "reflection.md",
          size: put.size,
        },
        width: REFLECTION_SIZE.width,
        height: REFLECTION_SIZE.height,
        placement: nextPlacement(snapshot.canvas),
        title: "Project Reflection",
        properties: {
          [MEMORY_PROPS.role]: "reflection",
          [MEMORY_PROPS.updatedAt]: updatedAt,
        },
      },
    });
    const res: MemoryLearnResponse = {
      target: "project",
      canvasId: req.canvasId,
      itemId,
      versionId,
      blobHash: put.blobHash,
      updatedAt,
    };
    return { status: 200, body: res };
  }

  // Personal observation on "About you" canvas
  const facet: MemoryFacet =
    body.facet && (MEMORY_FACETS as readonly string[]).includes(body.facet)
      ? body.facet
      : "workflow_and_modality_patterns";
  const confidence = typeof body.confidence === "number" && Number.isFinite(body.confidence)
    ? Math.max(0, Math.min(1, body.confidence))
    : 0.8;
  const proofs = typeof body.proofs === "number" && Number.isFinite(body.proofs)
    ? Math.max(1, Math.round(body.proofs))
    : 1;

  let personalCanvasId = body.personalCanvasId?.trim() || "";
  if (!personalCanvasId && host.listCanvases) {
    const admitted = await host.listCanvases();
    const aboutYou = admitted.find((c) => c.title.toLowerCase().startsWith("about you"));
    if (aboutYou) personalCanvasId = aboutYou.id;
  }
  if (!personalCanvasId) personalCanvasId = req.canvasId;

  const targetSnapshot = await host.canvas(personalCanvasId);
  const obsMarkdown = `## ${facet}\n\n${text}\n\n_Confidence: ${confidence.toFixed(2)} · Proofs: ${proofs} · Source: ${req.canvasId}_\n`;
  const put = await host.putBlob(personalCanvasId, new TextEncoder().encode(obsMarkdown), {
    mimeType: "text/markdown",
    filename: "observation.md",
  });
  const itemId = newItemId();
  const versionId = newVersionId();
  await host.submit({
    canvasId: personalCanvasId,
    actor,
    op: {
      type: "item.add",
      itemId,
      version: {
        id: versionId,
        blobHash: put.blobHash,
        mimeType: put.mimeType,
        filename: "observation.md",
        size: put.size,
      },
      width: OBSERVATION_SIZE.width,
      height: OBSERVATION_SIZE.height,
      placement: nextPlacement(targetSnapshot.canvas),
      title: text.slice(0, 64),
      properties: {
        [MEMORY_PROPS.role]: "observation",
        [MEMORY_PROPS.facet]: facet,
        [MEMORY_PROPS.confidence]: String(confidence),
        [MEMORY_PROPS.proofs]: String(proofs),
        [MEMORY_PROPS.ownerId]: actor.id,
        [MEMORY_PROPS.sourceCanvasId]: req.canvasId,
        [MEMORY_PROPS.updatedAt]: updatedAt,
      },
    },
  });
  const res: MemoryLearnResponse = {
    target: "personal",
    canvasId: personalCanvasId,
    itemId,
    versionId,
    blobHash: put.blobHash,
    updatedAt,
    facet,
    confidence,
    proofs,
  };
  return { status: 200, body: res };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

function trigrams(text: string): Set<string> {
  const norm = text.toLowerCase().replace(/\s+/g, " ").trim();
  const out = new Set<string>();
  for (let i = 0; i <= norm.length - 3; i++) {
    out.add(norm.slice(i, i + 3));
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hits = 0;
  for (const x of a) if (b.has(x)) hits++;
  return hits / (a.size + b.size - hits);
}

async function handleSearch(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = (req.body ?? {}) as Partial<MemorySearchRequest>;
  if (typeof body.query !== "string" || !body.query.trim()) {
    return { status: 400, body: { error: "search requires non-empty `query`", code: MEMORY_BAD_REQUEST } };
  }
  const query = body.query.trim();
  const limit = typeof body.limit === "number" && body.limit > 0 ? Math.min(25, Math.round(body.limit)) : 10;

  const canvases = host.listCanvases
    ? await host.listCanvases()
    : [(await host.canvas(req.canvasId)).project];

  const queryTokens = tokenize(query);
  const queryTrigrams = trigrams(query);
  const queryLower = query.toLowerCase();

  interface Candidate {
    canvasId: string;
    canvasTitle: string;
    itemId: string;
    title: string;
    snippet: string;
    lexical: number;
    semantic: number;
    recency: number;
  }

  const ledger = ledgerForHost(host);
  const candidates: Candidate[] = [];
  for (const c of canvases) {
    const snap = await host.canvas(c.id).catch(() => null);
    if (!snap) continue;
    for (const item of Object.values(snap.canvas.items)) {
      const ver = currentVersionOf(item);
      if (ver?.mimeType === POINTER_MIME) continue;
      if (await isItemExcluded(ledger, host, c.id, item)) continue;
      const blobText = await readItemText(host, c.id, item);
      const haystack = `${item.title}\n${item.description ?? ""}\n${item.properties?.["agentDescription"] ?? ""}\n${blobText}`.trim();
      if (!haystack) continue;
      const hayLower = haystack.toLowerCase();
      let lexical = 0;
      if (hayLower.includes(queryLower)) lexical += 3;
      const itemTokens = new Set(tokenize(haystack));
      for (const qt of queryTokens) {
        if (itemTokens.has(qt)) lexical += 1;
      }
      const semantic = jaccard(queryTrigrams, trigrams(haystack));
      if (lexical === 0 && semantic < 0.04) continue;

      const updatedMs = Date.parse(item.updatedAt) || 0;
      const threadBoost = Object.values(snap.canvas.threads).filter((t) => t.anchorItemId === item.id).length * 86_400_000;
      candidates.push({
        canvasId: c.id,
        canvasTitle: snap.project.title,
        itemId: item.id,
        title: item.title,
        snippet: (blobText || item.properties?.["agentDescription"] || item.description || item.title).trim().slice(0, 240),
        lexical,
        semantic,
        recency: updatedMs + threadBoost,
      });
    }
  }

  const lexOrder = [...candidates].filter((c) => c.lexical > 0).sort((a, b) => b.lexical - a.lexical);
  const semOrder = [...candidates].filter((c) => c.semantic > 0).sort((a, b) => b.semantic - a.semantic);
  const recOrder = [...candidates].sort((a, b) => b.recency - a.recency);

  const lexRank = new Map(lexOrder.map((c, idx) => [`${c.canvasId}:${c.itemId}`, idx + 1]));
  const semRank = new Map(semOrder.map((c, idx) => [`${c.canvasId}:${c.itemId}`, idx + 1]));
  const recRank = new Map(recOrder.map((c, idx) => [`${c.canvasId}:${c.itemId}`, idx + 1]));

  const scored: MemorySearchHit[] = candidates
    .map((c) => {
      const key = `${c.canvasId}:${c.itemId}`;
      const lr = lexRank.get(key) ?? null;
      const sr = semRank.get(key) ?? null;
      const rr = recRank.get(key) ?? null;
      const score =
        (lr ? 1 / (RRF_K + lr) : 0) +
        (sr ? 1 / (RRF_K + sr) : 0) +
        (rr ? 1 / (RRF_K + rr) : 0);
      return {
        canvasId: c.canvasId,
        canvasTitle: c.canvasTitle,
        itemId: c.itemId,
        title: c.title,
        snippet: c.snippet,
        score,
        ranks: { lexical: lr, semantic: sr, recency: rr },
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const packed = packMemoryContext({
    historyPassages: scored.map((h) => ({
      canvasId: h.canvasId,
      itemId: h.itemId,
      title: h.title,
      text: h.snippet,
      score: h.score,
    })),
    budgets: { history: CONTEXT_BUDGETS.history },
  });

  const res: MemorySearchResponse = {
    query,
    hits: scored,
    packedHistory: packed.history,
    tokensUsed: packed.tokens.history,
  };
  return { status: 200, body: res };
}

async function handlePlace(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = (req.body ?? {}) as Partial<MemoryPlaceRequest>;
  const actorErr = checkActor(body.actor);
  if (actorErr) return { status: 400, body: { error: actorErr, code: MEMORY_BAD_REQUEST } };
  if (typeof body.ref !== "string" || !body.ref.trim()) {
    return { status: 400, body: { error: "place requires non-empty `ref`", code: MEMORY_BAD_REQUEST } };
  }
  const actor = await resolveActor(body.actor, host);
  if (!actor) return { status: 400, body: { error: "place requires a claimed actor", code: MEMORY_BAD_REQUEST } };

  const ownerId = body.ownerId?.trim() || actor.id;
  const pointerJson = encodePointer({
    ref: body.ref.trim(),
    ownerId,
    ...(body.facet ? { facet: body.facet } : {}),
    ...(body.label?.trim() ? { label: body.label.trim() } : {}),
  });
  const pointer = parsePointer(pointerJson)!;
  const put = await host.putBlob(req.canvasId, new TextEncoder().encode(pointerJson), {
    mimeType: POINTER_MIME,
    filename: "memory.pointer",
  });
  const snapshot = await host.canvas(req.canvasId);
  const placement =
    typeof body.x === "number" && typeof body.y === "number"
      ? { x: body.x, y: body.y }
      : nextPlacement(snapshot.canvas);

  const itemId = newItemId();
  await host.submit({
    canvasId: req.canvasId,
    actor,
    op: {
      type: "item.add",
      itemId,
      version: {
        id: newVersionId(),
        blobHash: put.blobHash,
        mimeType: POINTER_MIME,
        filename: "memory.pointer",
        size: put.size,
      },
      width: POINTER_SIZE.width,
      height: POINTER_SIZE.height,
      placement,
      title: pointer.label || "Private memory",
      properties: {
        [MEMORY_PROPS.role]: "pointer",
        [MEMORY_PROPS.ownerId]: pointer.ownerId,
        ...(pointer.facet ? { [MEMORY_PROPS.facet]: pointer.facet } : {}),
      },
    },
  });

  const res: MemoryPlaceResponse = { itemId, blobHash: put.blobHash, pointer };
  return { status: 200, body: res };
}

async function handleHydrate(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = (req.body ?? {}) as Partial<MemoryHydrateRequest>;
  const actorErr = checkActor(body.actor);
  if (actorErr) return { status: 400, body: { error: actorErr, code: MEMORY_BAD_REQUEST } };
  if (typeof body.itemId !== "string" || !body.itemId.trim()) {
    return { status: 400, body: { error: "hydrate requires `itemId`", code: MEMORY_BAD_REQUEST } };
  }

  const actor = await resolveActor(body.actor, host);
  const snapshot = await host.canvas(req.canvasId);
  const item = snapshot.canvas.items[body.itemId.trim()];
  if (!item) {
    return { status: 404, body: { error: `item ${body.itemId} not found`, code: MEMORY_NOT_FOUND } };
  }
  const ver = currentVersionOf(item);
  if (!ver || ver.mimeType !== POINTER_MIME) {
    return { status: 400, body: { error: `item ${item.id} is not a memory pointer`, code: MEMORY_BAD_REQUEST } };
  }
  const raw = await host.readBlob(req.canvasId, ver.blobHash);
  const pointer = raw ? parsePointer(raw) : null;
  if (!pointer) {
    return { status: 400, body: { error: `item ${item.id} carries an invalid pointer`, code: MEMORY_BAD_REQUEST } };
  }
  if (!isPointerOwner(pointer, actor?.id)) {
    return {
      status: 403,
      body: {
        error: "This memory pointer is private to its owner",
        code: MEMORY_LOCKED,
        locked: true,
        ownerId: pointer.ownerId,
      },
    };
  }

  const { targetCanvasId, targetItemId } = splitPointerRef(pointer.ref, req.canvasId);
  const ledger = ledgerForHost(host);
  if ((await ledger.has(targetCanvasId, targetItemId)) || (await ledger.has(req.canvasId, item.id))) {
    return {
      status: 410,
      body: {
        error: `referenced observation ${pointer.ref} has been forgotten`,
        code: MEMORY_FORGOTTEN,
        forgotten: true,
      },
    };
  }

  const targetSnap = targetCanvasId === req.canvasId ? snapshot : await host.canvas(targetCanvasId).catch(() => null);
  const targetItem = targetSnap?.canvas.items[targetItemId];
  if (!targetItem) {
    return { status: 404, body: { error: `referenced observation ${pointer.ref} not found`, code: MEMORY_NOT_FOUND } };
  }
  const text = await readItemText(host, targetCanvasId, targetItem, 128 * 1024);
  const res: MemoryHydrateResponse = {
    locked: false,
    pointer,
    title: targetItem.title,
    text,
    properties: targetItem.properties,
  };
  return { status: 200, body: res };
}

async function handleForget(req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> {
  const body = (req.body ?? {}) as Partial<MemoryForgetRequest>;
  const actorErr = checkActor(body.actor);
  if (actorErr) return { status: 400, body: { error: actorErr, code: MEMORY_BAD_REQUEST } };
  if (typeof body.itemId !== "string" || !body.itemId.trim()) {
    return { status: 400, body: { error: "forget requires non-empty `itemId`", code: MEMORY_BAD_REQUEST } };
  }
  const actor = await resolveActor(body.actor, host);
  if (!actor) return { status: 400, body: { error: "forget requires a claimed actor", code: MEMORY_BAD_REQUEST } };

  const itemId = body.itemId.trim();
  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : undefined;
  const ledger = ledgerForHost(host);
  const snapshot = await host.canvas(req.canvasId);
  const item = snapshot.canvas.items[itemId];

  if (!item) {
    const existing = await ledger.get(req.canvasId, itemId);
    if (existing) {
      const res: MemoryForgetResponse = { forgotten: true, exclusion: existing, deleted: false };
      return { status: 200, body: res };
    }
    return { status: 404, body: { error: `item ${itemId} not found`, code: MEMORY_NOT_FOUND } };
  }

  const propOwner = item.properties?.[MEMORY_PROPS.ownerId];
  if (propOwner && propOwner !== actor.id) {
    return {
      status: 403,
      body: {
        error: "Only the owner of this memory item may forget it",
        code: MEMORY_FORBIDDEN,
      },
    };
  }

  const ver = currentVersionOf(item);
  let pointerTarget: { targetCanvasId: string; targetItemId: string } | null = null;
  if (ver?.mimeType === POINTER_MIME) {
    const raw = await host.readBlob(req.canvasId, ver.blobHash);
    const pointer = raw ? parsePointer(raw) : null;
    if (pointer) {
      if (!isPointerOwner(pointer, actor.id)) {
        return {
          status: 403,
          body: {
            error: "Only the owner of this memory pointer may forget it",
            code: MEMORY_FORBIDDEN,
          },
        };
      }
      pointerTarget = splitPointerRef(pointer.ref, req.canvasId);
    }
  }

  const forgottenAt = new Date(host.now()).toISOString();
  const exclusion: MemoryExclusion = {
    canvasId: req.canvasId,
    itemId,
    actorId: actor.id,
    forgottenAt,
    ...(reason ? { reason } : {}),
  };
  await ledger.add(exclusion);

  // If forgetting via a pointer card, also tombstone & delete the source observation when reachable.
  if (pointerTarget) {
    const sourceExclusion: MemoryExclusion = {
      canvasId: pointerTarget.targetCanvasId,
      itemId: pointerTarget.targetItemId,
      actorId: actor.id,
      forgottenAt,
      ...(reason ? { reason } : {}),
    };
    await ledger.add(sourceExclusion);
    const sourceSnap =
      pointerTarget.targetCanvasId === req.canvasId
        ? snapshot
        : await host.canvas(pointerTarget.targetCanvasId).catch(() => null);
    if (sourceSnap?.canvas.items[pointerTarget.targetItemId]) {
      await host.submit({
        canvasId: pointerTarget.targetCanvasId,
        actor,
        op: { type: "item.delete", itemId: pointerTarget.targetItemId },
      }).catch(() => {
        // Source canvas may not be editable in this call; tombstone still guarantees 410 Gone.
      });
    }
  }

  await host.submit({
    canvasId: req.canvasId,
    actor,
    op: { type: "item.delete", itemId },
  });

  const res: MemoryForgetResponse = {
    forgotten: true,
    exclusion,
    deleted: true,
  };
  return { status: 200, body: res };
}

export const memoryServer: ServerModule = {
  name: "@isocan/memory",
  routes: [
    { method: "POST", path: "reflect", spend: "none", handler: handleReflect },
    { method: "POST", path: "learn", spend: "none", handler: handleLearn },
    { method: "POST", path: "search", spend: "none", handler: handleSearch },
    { method: "POST", path: "place", spend: "none", handler: handlePlace },
    { method: "POST", path: "hydrate", spend: "none", handler: handleHydrate },
    { method: "POST", path: "forget", spend: "none", handler: handleForget },
  ],
};

export default memoryServer;
