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

import { nanoid } from "nanoid";
import {
  BROWSER_MIME,
  buildContextGraph,
  edgeLabelProperty,
  EDGE_PROP_PREFIX,
  normalizeSiteUrl,
  type Actor,
  type Item,
  type ModuleRequest,
  type ModuleResponse,
  type ServerHost,
  type ServerModule,
} from "@isocan/core";
import { handleForActor } from "@isocan/core/handles";
import { parseOpenNodeSpec, type OpenNodeSpec } from "@isocan/core/open-node-spec";
import type { SessionDriver, SessionEvent } from "@isocan/core/session-driver";
import {
  SESSION_MIME,
  TERMINAL_MIME,
  WORKBENCH_PROPS,
  type WorkbenchApproveRequest,
  type WorkbenchCancelRequest,
  type WorkbenchDebugRequest,
  type WorkbenchEmitRequest,
  type WorkbenchSendRequest,
  type WorkbenchStartRequest,
} from "./core.ts";
import { createDefaultDriverRegistry, DriverRegistry } from "./drivers/registry.ts";

const defaultRegistry = createDefaultDriverRegistry();

function resolveRegistry(host: ServerHost): DriverRegistry {
  const seam = host.options["registry"];
  if (seam && typeof seam === "object" && "get" in seam && "list" in seam) {
    return seam as DriverRegistry;
  }
  const drivers = host.options["drivers"];
  if (Array.isArray(drivers)) {
    return new DriverRegistry(drivers as SessionDriver[]);
  }
  return defaultRegistry;
}

async function resolveCallerActor(host: ServerHost, explicit?: Actor): Promise<Actor | null> {
  if (explicit && typeof explicit.id === "string" && typeof explicit.name === "string") {
    await host.speaksFor(explicit.id);
    return explicit;
  }
  return (await host.defaultActor?.()) ?? null;
}

function badRequest(error: string, code = "workbench-bad-request"): ModuleResponse {
  return { status: 400, body: { code, error } };
}

function notFound(error: string, code = "workbench-not-found"): ModuleResponse {
  return { status: 404, body: { code, error } };
}

function nodePayload(node: OpenNodeSpec): {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  width: number;
  height: number;
} {
  const enc = new TextEncoder();
  switch (node.kind) {
    case "markdown":
      return {
        bytes: enc.encode(node.content ?? ""),
        mimeType: "text/markdown",
        filename: `${(node.title ?? "note").replace(/[^a-z0-9_-]+/gi, "-")}.md`,
        width: node.width ?? 480,
        height: node.height ?? 360,
      };
    case "sticky":
      return {
        bytes: enc.encode(node.content ?? ""),
        mimeType: "text/plain",
        filename: "sticky.txt",
        width: node.width ?? 240,
        height: node.height ?? 240,
      };
    case "site": {
      const normalized = normalizeSiteUrl(node.url ?? "http://localhost:3000");
      return {
        bytes: enc.encode(`${normalized}\n`),
        mimeType: BROWSER_MIME,
        filename: "site.url",
        width: node.width ?? 640,
        height: node.height ?? 480,
      };
    }
    case "image":
      return {
        bytes: enc.encode(node.url ?? node.content ?? ""),
        mimeType: node.url ? BROWSER_MIME : "text/plain",
        filename: "image.url",
        width: node.width ?? 480,
        height: node.height ?? 360,
      };
    case "terminal":
      return {
        bytes: enc.encode(
          JSON.stringify({
            kind: "terminal",
            driver: node.driver ?? "pty",
            ...(node.sessionId ? { sessionId: node.sessionId } : {}),
            ...(node.command ? { command: node.command } : {}),
            ...(node.workspace ? { workspace: node.workspace } : {}),
          }),
        ),
        mimeType: TERMINAL_MIME,
        filename: "terminal.terminal",
        width: node.width ?? 480,
        height: node.height ?? 320,
      };
    case "session":
      return {
        bytes: enc.encode(
          JSON.stringify({
            kind: "session",
            driver: node.driver ?? "antigravity",
            ...(node.sessionId ? { sessionId: node.sessionId } : {}),
            ...(node.workspace ? { workspace: node.workspace } : {}),
          }),
        ),
        mimeType: SESSION_MIME,
        filename: "session.session",
        width: node.width ?? 480,
        height: node.height ?? 320,
      };
  }
}

export const workbenchServer: ServerModule = {
  name: "@isocan/workbench",
  routes: [
    {
      method: "GET",
      path: "drivers",
      spend: "none",
      handler: async (_req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> => {
        const registry = resolveRegistry(host);
        const drivers = await Promise.all(
          registry.list().map(async (driver) => ({
            id: driver.id,
            label: driver.label,
            available: await driver.available().catch(() => false),
            models: await driver.models().catch(() => []),
          })),
        );
        return { status: 200, body: { drivers } };
      },
    },
    {
      method: "GET",
      path: "sessions",
      spend: "none",
      handler: async (req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> => {
        const registry = resolveRegistry(host);
        const driverId = req.query["driver"]?.trim();
        const workspace = req.query["workspace"]?.trim() || undefined;
        const targets = driverId ? [registry.get(driverId)].filter((d): d is SessionDriver => Boolean(d)) : registry.list();
        if (driverId && targets.length === 0) {
          return notFound(`unknown driver "${driverId}"`);
        }
        const lists = await Promise.all(targets.map((d) => d.list(workspace).catch(() => [])));
        return { status: 200, body: { sessions: lists.flat() } };
      },
    },
    {
      method: "POST",
      path: "start",
      spend: "none",
      check: ({ body }) => {
        const b = (body && typeof body === "object" ? body : {}) as Partial<WorkbenchStartRequest>;
        if (typeof b.driver !== "string" || !b.driver.trim()) {
          return badRequest("workbench start requires a `driver`");
        }
        return null;
      },
      handler: async (req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> => {
        const body = req.body as WorkbenchStartRequest;
        const registry = resolveRegistry(host);
        const driver = registry.get(body.driver.trim());
        if (!driver) return notFound(`unknown driver "${body.driver}"`);

        const actor = await resolveCallerActor(host, body.actor);
        if (!actor) return badRequest("no actor claimed for this badge");

        const kind = body.kind === "terminal" ? "terminal" : "session";
        const autoPreview = body.autoPreview !== false;

        const summary = await driver.start({
          ...(body.workspace ? { workspace: body.workspace } : {}),
          ...(body.prompt ? { prompt: body.prompt } : {}),
          ...(body.command ? { command: body.command } : {}),
          ...(body.model ? { model: body.model } : {}),
          ...(body.title ? { title: body.title } : {}),
        });

        const handle = summary.handle ?? handleForActor(summary.id, []);
        const itemId = `itm_${nanoid(10)}`;
        const mimeType = kind === "terminal" ? TERMINAL_MIME : SESSION_MIME;
        const filename = kind === "terminal" ? `${summary.id}.terminal` : `${summary.id}.session`;
        const payload = new TextEncoder().encode(
          JSON.stringify({
            kind,
            driver: driver.id,
            sessionId: summary.id,
            title: summary.title,
            status: summary.status,
            handle,
            ...(summary.workspace ? { workspace: summary.workspace } : {}),
            ...(summary.model ? { model: summary.model } : {}),
          }),
        );

        const { blobHash, size } = await host.putBlob(req.canvasId, payload, { mimeType, filename });
        await host.submit({
          canvasId: req.canvasId,
          actor,
          op: {
            type: "item.add",
            itemId,
            version: {
              id: `ver_${nanoid(10)}`,
              blobHash,
              mimeType,
              filename,
              size,
            },
            width: 480,
            height: 320,
            placement: { x: 120, y: 120 },
            title: summary.title,
            properties: {
              [WORKBENCH_PROPS.driver]: driver.id,
              [WORKBENCH_PROPS.sessionId]: summary.id,
              [WORKBENCH_PROPS.status]: summary.status,
              [WORKBENCH_PROPS.autoPreview]: String(autoPreview),
              ...(summary.workspace ? { [WORKBENCH_PROPS.workspace]: summary.workspace } : {}),
              "station.handle": handle,
            },
          },
        });

        const seenUrls = new Set<string>();
        let queue = Promise.resolve();
        const unsub = driver.tail(summary.id, (event: SessionEvent) => {
          queue = queue.then(async () => {
            if (event.kind === "dev_server_ready" && event.devServer && autoPreview) {
              let normalizedUrl: string;
              try {
                normalizedUrl = normalizeSiteUrl(event.devServer.url);
              } catch {
                return;
              }
              if (seenUrls.has(normalizedUrl)) return;
              seenUrls.add(normalizedUrl);

              const siteId = `itm_${nanoid(10)}`;
              const siteBytes = new TextEncoder().encode(`${normalizedUrl}\n`);
              const siteBlob = await host.putBlob(req.canvasId, siteBytes, {
                mimeType: BROWSER_MIME,
                filename: "dev-server.url",
              });
              await host.submit({
                canvasId: req.canvasId,
                actor,
                op: {
                  type: "item.add",
                  itemId: siteId,
                  version: {
                    id: `ver_${nanoid(10)}`,
                    blobHash: siteBlob.blobHash,
                    mimeType: BROWSER_MIME,
                    filename: "dev-server.url",
                    size: siteBlob.size,
                  },
                  width: 640,
                  height: 480,
                  placement: { anchorItemId: itemId },
                  title: event.devServer.label ?? normalizedUrl,
                  properties: {
                    parent: itemId,
                    [WORKBENCH_PROPS.driver]: driver.id,
                    [WORKBENCH_PROPS.sessionId]: summary.id,
                    [WORKBENCH_PROPS.sourceRef]: `devserver:${summary.id}:${normalizedUrl}`,
                  },
                },
              });
            } else if (event.kind === "status" && event.status) {
              await host.submit({
                canvasId: req.canvasId,
                actor,
                op: {
                  type: "item.update",
                  itemId,
                  patch: {
                    properties: {
                      [WORKBENCH_PROPS.status]: event.status,
                    },
                  },
                },
              }).catch(() => {});
              if (event.status === "cancelled" || event.status === "done" || event.status === "stopped" || event.status === "failed") {
                unsub();
              }
            }
          }).catch(() => {});
        });

        return { status: 201, body: { session: summary, itemId, driver: driver.id } };
      },
    },
    {
      method: "POST",
      path: "send",
      spend: "none",
      check: ({ body }) => {
        const b = (body && typeof body === "object" ? body : {}) as Partial<WorkbenchSendRequest>;
        if (typeof b.driver !== "string" || !b.driver.trim()) return badRequest("`driver` is required");
        if (typeof b.sessionId !== "string" || !b.sessionId.trim()) return badRequest("`sessionId` is required");
        if (typeof b.text !== "string") return badRequest("`text` is required");
        return null;
      },
      handler: async (req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> => {
        const body = req.body as WorkbenchSendRequest;
        const driver = resolveRegistry(host).get(body.driver.trim());
        if (!driver) return notFound(`unknown driver "${body.driver}"`);
        await driver.send(body.sessionId.trim(), body.text);
        return { status: 200, body: { ok: true } };
      },
    },
    {
      method: "POST",
      path: "approve",
      spend: "none",
      check: ({ body }) => {
        const b = (body && typeof body === "object" ? body : {}) as Partial<WorkbenchApproveRequest>;
        if (typeof b.driver !== "string" || !b.driver.trim()) return badRequest("`driver` is required");
        if (typeof b.sessionId !== "string" || !b.sessionId.trim()) return badRequest("`sessionId` is required");
        if (typeof b.interactionId !== "string" || !b.interactionId.trim()) return badRequest("`interactionId` is required");
        return null;
      },
      handler: async (req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> => {
        const body = req.body as WorkbenchApproveRequest;
        const driver = resolveRegistry(host).get(body.driver.trim());
        if (!driver) return notFound(`unknown driver "${body.driver}"`);
        await driver.approve(body.sessionId.trim(), body.interactionId.trim(), body.decision);
        return { status: 200, body: { ok: true } };
      },
    },
    {
      method: "POST",
      path: "cancel",
      spend: "none",
      check: ({ body }) => {
        const b = (body && typeof body === "object" ? body : {}) as Partial<WorkbenchCancelRequest>;
        if (typeof b.driver !== "string" || !b.driver.trim()) return badRequest("`driver` is required");
        if (typeof b.sessionId !== "string" || !b.sessionId.trim()) return badRequest("`sessionId` is required");
        return null;
      },
      handler: async (req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> => {
        const body = req.body as WorkbenchCancelRequest;
        const driver = resolveRegistry(host).get(body.driver.trim());
        if (!driver) return notFound(`unknown driver "${body.driver}"`);
        await driver.cancel(body.sessionId.trim());
        return { status: 200, body: { ok: true } };
      },
    },
    {
      method: "POST",
      path: "emit",
      spend: "none",
      bodyLimit: 256 * 1024,
      handler: async (req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> => {
        const body = (req.body && typeof req.body === "object" ? req.body : {}) as Partial<WorkbenchEmitRequest>;
        const parsed = parseOpenNodeSpec(body.spec, {
          ...(typeof body.trustedProducer === "string" ? { trustedProducer: body.trustedProducer } : {}),
        });
        if (!parsed.ok) return badRequest(parsed.error);

        const actor = await resolveCallerActor(host, body.actor);
        if (!actor) return badRequest("no actor claimed for this badge");

        const snapshot = await host.canvas(req.canvasId);
        const existingBySourceRef = new Map<string, Item>();
        for (const item of Object.values(snapshot.canvas.items)) {
          const ref = item.properties[WORKBENCH_PROPS.sourceRef];
          if (ref) existingBySourceRef.set(ref, item);
        }

        const group = `emit_${nanoid(8)}`;
        const nodeIdMap = new Map<string, string>();
        const itemIds: string[] = [];
        const updatedIds: string[] = [];

        for (let i = 0; i < parsed.spec.nodes.length; i++) {
          const node = parsed.spec.nodes[i]!;
          const existing = parsed.spec.upsertBySourceRef && node.sourceRef
            ? existingBySourceRef.get(node.sourceRef)
            : undefined;

          const payload = nodePayload(node);

          if (existing) {
            if (node.id) nodeIdMap.set(node.id, existing.id);
            if (node.sourceRef) nodeIdMap.set(node.sourceRef, existing.id);
            if (node.content !== undefined || node.url !== undefined) {
              const { blobHash, size } = await host.putBlob(req.canvasId, payload.bytes, {
                mimeType: payload.mimeType,
                filename: payload.filename,
              });
              await host.submit({
                canvasId: req.canvasId,
                actor,
                group,
                op: {
                  type: "item.addVersion",
                  itemId: existing.id,
                  version: {
                    id: `ver_${nanoid(10)}`,
                    blobHash,
                    mimeType: payload.mimeType,
                    filename: payload.filename,
                    size,
                  },
                },
              });
            }
            if (node.title !== undefined || node.properties) {
              await host.submit({
                canvasId: req.canvasId,
                actor,
                group,
                op: {
                  type: "item.update",
                  itemId: existing.id,
                  patch: {
                    ...(node.title !== undefined ? { title: node.title } : {}),
                    ...(node.properties ? { properties: node.properties } : {}),
                  },
                },
              });
            }
            updatedIds.push(existing.id);
            continue;
          }

          const itemId = `itm_${nanoid(10)}`;
          if (node.id) nodeIdMap.set(node.id, itemId);
          if (node.sourceRef) nodeIdMap.set(node.sourceRef, itemId);

          const { blobHash, size } = await host.putBlob(req.canvasId, payload.bytes, {
            mimeType: payload.mimeType,
            filename: payload.filename,
          });
          await host.submit({
            canvasId: req.canvasId,
            actor,
            group,
            op: {
              type: "item.add",
              itemId,
              version: {
                id: `ver_${nanoid(10)}`,
                blobHash,
                mimeType: payload.mimeType,
                filename: payload.filename,
                size,
              },
              width: payload.width,
              height: payload.height,
              placement: {
                x: node.x ?? 120 + i * 40,
                y: node.y ?? 120 + i * 40,
              },
              ...(node.title ? { title: node.title } : {}),
              properties: {
                ...(node.properties ?? {}),
                ...(node.sourceRef ? { [WORKBENCH_PROPS.sourceRef]: node.sourceRef } : {}),
                ...(node.driver ? { [WORKBENCH_PROPS.driver]: node.driver } : {}),
                ...(node.sessionId ? { [WORKBENCH_PROPS.sessionId]: node.sessionId } : {}),
                ...(node.workspace ? { [WORKBENCH_PROPS.workspace]: node.workspace } : {}),
              },
            },
          });
          itemIds.push(itemId);
        }

        const resolveTarget = (ref: string): string =>
          nodeIdMap.get(ref) ?? existingBySourceRef.get(ref)?.id ?? ref;

        const edgesByFrom = new Map<string, Record<string, string>>();
        let edgeCount = 0;
        for (const edge of parsed.spec.edges) {
          const fromId = resolveTarget(edge.from);
          const toId = resolveTarget(edge.to);
          const key = edge.key ?? toId;
          const props = edgesByFrom.get(fromId) ?? {};
          props[`${EDGE_PROP_PREFIX}${key}`] = toId;
          if (edge.label) props[edgeLabelProperty(key)] = edge.label;
          edgesByFrom.set(fromId, props);
          edgeCount++;
        }

        for (const [fromId, props] of edgesByFrom.entries()) {
          await host.submit({
            canvasId: req.canvasId,
            actor,
            group,
            op: {
              type: "item.update",
              itemId: fromId,
              patch: { properties: props },
            },
          });
        }

        let patchCount = 0;
        for (const patch of parsed.spec.patches) {
          const targetId = resolveTarget(patch.target);
          await host.submit({
            canvasId: req.canvasId,
            actor,
            group,
            op: {
              type: "item.update",
              itemId: targetId,
              patch: {
                ...(patch.title !== undefined ? { title: patch.title } : {}),
                ...(patch.description !== undefined ? { description: patch.description } : {}),
                ...(patch.properties ? { properties: patch.properties } : {}),
              },
            },
          });
          updatedIds.push(targetId);
          patchCount++;
        }

        return {
          status: 200,
          body: { itemIds, updatedIds, edgeCount, patchCount },
        };
      },
    },
    {
      method: "POST",
      path: "debug",
      spend: "none",
      check: ({ body }) => {
        const b = (body && typeof body === "object" ? body : {}) as Partial<WorkbenchDebugRequest>;
        if (typeof b.itemId !== "string" || !b.itemId.trim()) return badRequest("`itemId` is required");
        if (typeof b.driver !== "string" || !b.driver.trim()) return badRequest("`driver` is required");
        return null;
      },
      handler: async (req: ModuleRequest, host: ServerHost): Promise<ModuleResponse> => {
        const body = req.body as WorkbenchDebugRequest;
        const driver = resolveRegistry(host).get(body.driver.trim());
        if (!driver) return notFound(`unknown driver "${body.driver}"`);

        const actor = await resolveCallerActor(host, body.actor);
        if (!actor) return badRequest("no actor claimed for this badge");

        const snapshot = await host.canvas(req.canvasId);
        const target = snapshot.canvas.items[body.itemId.trim()];
        if (!target) return notFound(`item "${body.itemId}" not found on canvas`);

        const graph = buildContextGraph(snapshot);
        const mode = body.mode === "plan" ? "plan" : "fix";
        const errorContext = target.properties["failure"] ?? target.description ?? target.title;
        const prompt = [
          body.prompt?.trim() || (mode === "plan" ? "Plan a fix for this item." : "Fix the error on this item."),
          `Target item: ${target.id} (${target.title})`,
          errorContext ? `Error/context: ${errorContext}` : "",
          `Canvas items (${graph.items.length}): ${graph.items.slice(0, 12).map((i) => `${i.id}:${i.title}`).join(", ")}`,
        ]
          .filter(Boolean)
          .join("\n");

        const summary = await driver.start({
          ...(body.workspace ? { workspace: body.workspace } : {}),
          ...(body.model ? { model: body.model } : {}),
          prompt,
          title: `Debug (${mode}): ${target.title}`,
        });

        const sessionItemId = `itm_${nanoid(10)}`;
        const payload = new TextEncoder().encode(
          JSON.stringify({
            kind: "session",
            driver: driver.id,
            sessionId: summary.id,
            title: summary.title,
            status: summary.status,
            targetItemId: target.id,
            mode,
          }),
        );
        const { blobHash, size } = await host.putBlob(req.canvasId, payload, {
          mimeType: SESSION_MIME,
          filename: `${summary.id}.session`,
        });
        await host.submit({
          canvasId: req.canvasId,
          actor,
          op: {
            type: "item.add",
            itemId: sessionItemId,
            version: {
              id: `ver_${nanoid(10)}`,
              blobHash,
              mimeType: SESSION_MIME,
              filename: `${summary.id}.session`,
              size,
            },
            width: 480,
            height: 320,
            placement: { anchorItemId: target.id },
            title: summary.title,
            properties: {
              parent: target.id,
              [WORKBENCH_PROPS.driver]: driver.id,
              [WORKBENCH_PROPS.sessionId]: summary.id,
              [WORKBENCH_PROPS.status]: summary.status,
            },
          },
        });

        return {
          status: 201,
          body: {
            session: summary,
            itemId: sessionItemId,
            targetItemId: target.id,
          },
        };
      },
    },
  ],
};

export default workbenchServer;
