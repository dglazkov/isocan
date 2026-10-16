import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  extensionColor,
  isPanelExtension,
  newId,
  panelActor,
  panelSubject,
  readPanelExtension,
  type PanelActorResponse,
} from "@isocan/core";
import { mintBadge } from "./badges.ts";
import type { Desk } from "./desk.ts";
import type { Engine } from "./engine.ts";
import { admittingGrant, NotAdmittedError } from "./grants.ts";
import type { Store } from "./store.ts";

/**
 * **A panel's own actor, badge and grant** (extensions phase 5, "The extension
 * actor"): the identity desk pointed at software in the dock instead of people.
 * Its own file, the way the pass, operator and forget routes are, so
 * `registerRoutes` stays under its agreed length.
 */
interface PanelRouteScope {
  engine: Engine;
  store: Store;
  desk: Desk;
  sourceMutation: (req: FastifyRequest, canvasId: string) => Promise<void>;
}

/** The panel actor route, on `app`, where `registerRoutes` reaches it. */
export function registerPanelRoutes(app: FastifyInstance, scope: PanelRouteScope): void {
  const { engine, store, desk, sourceMutation } = scope;
  app.post("/api/projects/:id/panels/:itemId/actor", async (req, reply) => {
    const { id, itemId } = req.params as { id: string; itemId: string };
    const snapshot = await engine.getSnapshot(id);
    const item = snapshot.canvas.items[itemId];
    if (!item || !isPanelExtension(item)) {
      return reply.status(404).send({ error: `no panel ${itemId} on ${id}`, code: "unknown-panel" });
    }
    const version = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
    if (!version) {
      return reply.status(400).send({ error: `panel ${itemId} has no version`, code: "bad-panel" });
    }
    const stream = await store.openBlob(id, version.blobHash);
    if (!stream) {
      return reply.status(404).send({ error: "those bytes are not here", code: "no-blob" });
    }
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
    const parsed = readPanelExtension(Buffer.concat(chunks).toString("utf8"), snapshot.canvas);
    if (!parsed.panel) {
      return reply.status(400).send({ error: parsed.problem, code: "bad-panel" });
    }
    await sourceMutation(req, id);
    const actor = panelActor(itemId, parsed.panel.title);
    const subject = panelSubject(itemId);
    const rows = await desk.grantsFor(id);
    if (!rows.some((g) => g.subject === subject)) {
      await desk.putGrant({
        id: newId("gnt"),
        canvasId: id,
        subject,
        grantedBy: req.badge!.badgeId,
        at: new Date().toISOString(),
      });
    }
    const { record, token } = mintBadge("bearer");
    await desk.put(record);
    await desk.attest(record.badgeId, {
      attribute: subject,
      verifiedVia: "panel",
      at: new Date().toISOString(),
    });
    const badgeAfterAttest = (await desk.badge(record.badgeId))!;
    const matched = await admittingGrant(desk, id, badgeAfterAttest, snapshot.project.createdBy.id);
    if (!matched || !matched.grant) {
      throw new NotAdmittedError(id);
    }
    await desk.admit(record.badgeId, id, matched.provenance, matched.capability);
    await engine.endowClaim(record.badgeId, actor, id);
    return {
      actor,
      grant: matched.grant,
      badgeId: record.badgeId,
      token,
      color: extensionColor(itemId),
    } satisfies PanelActorResponse;
  });
}
