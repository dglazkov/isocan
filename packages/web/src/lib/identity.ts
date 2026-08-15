import type { Actor } from "@isocan/core";
import { newActorId } from "@isocan/core";

const KEY = "isocan.identity";

/** Web identity lives in localStorage; the CLI's lives in ~/.isocan. Two
 * personas per machine is honest for v1; authenticated identity later only
 * changes how an Actor is minted. */
export function readIdentity(): Actor | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Actor;
    return parsed.id && parsed.name ? parsed : null;
  } catch {
    return null;
  }
}

export function saveIdentity(name: string): Actor {
  const existing = readIdentity();
  const actor: Actor = { id: existing?.id ?? newActorId(), name };
  localStorage.setItem(KEY, JSON.stringify(actor));
  return actor;
}
