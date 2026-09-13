import { DaemonClient } from "@isocan/api";
import { normalizeHomeUrl, type Actor } from "@isocan/core";
import { readBadge } from "@isocan/server";

/** A deliberate private file capture uses only a credential this client already holds at its true home. */
export async function personalCaptureOwner(clientHome: string, home: string, canvasId: string, actor: Actor) {
  const badge = await readBadge(clientHome, home);
  if (!badge) throw new Error("Private capture requires your existing owner credential at the canvas's authoritative home.");
  const direct = new DaemonClient(home, clientHome);
  const status = await direct.personalStatus(actor.id, undefined, canvasId);
  if (normalizeHomeUrl(status.home) !== normalizeHomeUrl(home) ||
      ![status.source, ...status.preserved].some((source) => source?.canvasId === canvasId && source.state === "live")) {
    throw new Error("This home could not verify that the selected person owns this private canvas.");
  }
  return { badge, actor };
}
