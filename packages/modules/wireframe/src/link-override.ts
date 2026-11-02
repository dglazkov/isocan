import type { Item, MetaPatch } from "@isocan/core";
import { LINKS_PROP, LINK_BACK, LINK_NONE, readOverrides } from "./links.ts";
import type { WirePort } from "./port.ts";

/**
 * **A person's decision about one hotspot, written so two can land at once**
 * (phase 8, Porchlight #4).
 *
 * Until now every override on a screen lived in ONE property, `wireLinks`, a
 * JSON object rewritten whole — read, patch, `item.update`. Two writers on the
 * same screen (two `wire link` calls, or a person retargeting an arrow while
 * an agent relinks) each read the old object and the later write dropped the
 * earlier one's key. Nothing about a read-modify-write can be made safe from
 * the outside: the second reader always read before the first wrote.
 *
 * So each override is now its own property, `wireLink:<slot>#<element>`. The
 * reducer merges an `item.update`'s properties key by key, so two writes to
 * two hotspots are two keys and both survive, whatever order they land in.
 * The old JSON is still READ (`overridesOf`), and the first write to a screen
 * that still carries it folds it into per-key properties in the same patch —
 * idempotently, so two writers migrating at once write the same values.
 *
 * Both surfaces write through `linkPatch`: `isocan wire link` here, and the
 * canvas's arrow menu (retarget, remove, reset) on the web. No new op.
 */

/** The prefix of the property one hotspot's override lives in. */
export const LINK_PREFIX = "wireLink:";

/** The property one hotspot's override lives in. */
export function linkProp(key: string): string {
  return `${LINK_PREFIX}${key}`;
}

/** Every override on a screen: the legacy JSON, then the per-hotspot properties over it. */
export function overridesOf(properties: Readonly<Record<string, string>> | undefined): Record<string, string> {
  const out = readOverrides(properties?.[LINKS_PROP]);
  for (const [prop, value] of Object.entries(properties ?? {})) {
    if (prop.startsWith(LINK_PREFIX) && value) out[prop.slice(LINK_PREFIX.length)] = value;
  }
  return out;
}

/**
 * The patch that sets one hotspot's override (`value`: a screen id, `back`,
 * `none`) or clears it (`null`). Touches only that hotspot's property — plus,
 * once, the fold of a legacy `wireLinks` into per-key properties.
 */
export function linkPatch(item: Pick<Item, "properties">, key: string, value: string | null): MetaPatch {
  const properties: Record<string, string> = {};
  const removeProperties: string[] = [];
  const legacy = item.properties?.[LINKS_PROP];
  if (legacy !== undefined) {
    // Fold what the old JSON held into keys of their own — except where a per-key property already overrides it.
    for (const [k, v] of Object.entries(readOverrides(legacy))) {
      if (k !== key && item.properties?.[linkProp(k)] === undefined) properties[linkProp(k)] = v;
    }
    removeProperties.push(LINKS_PROP);
  }
  if (value === null) removeProperties.push(linkProp(key));
  else properties[linkProp(key)] = value;
  return { ...(Object.keys(properties).length ? { properties } : {}), ...(removeProperties.length ? { removeProperties } : {}) };
}

/** Would this patch change anything on the item as it stands? */
export function linkChanges(item: Pick<Item, "properties">, key: string, value: string | null): boolean {
  if (item.properties?.[LINKS_PROP] !== undefined) return true;
  return value === null ? item.properties?.[linkProp(key)] !== undefined : item.properties?.[linkProp(key)] !== value;
}

/**
 * Set (or clear, with `null`) one hotspot's override on a screen, in `group`.
 * Returns the screen's overrides as they will read once it lands, and whether
 * anything was written — setting what is already set sends nothing.
 */
export async function setLinkOverride(
  port: Pick<WirePort, "send">,
  item: Pick<Item, "id" | "properties">,
  key: string,
  value: string | null,
  group: string,
): Promise<{ overrides: Record<string, string>; wrote: boolean }> {
  const patch = linkPatch(item, key, value);
  const after: Record<string, string> = { ...(item.properties ?? {}), ...(patch.properties ?? {}) };
  for (const prop of patch.removeProperties ?? []) delete after[prop];
  const overrides = overridesOf(after);
  if (!linkChanges(item, key, value)) return { overrides, wrote: false };
  await port.send({ type: "item.update", itemId: item.id, patch }, group);
  return { overrides, wrote: true };
}

/**
 * **What an arrow's menu does, in `wire link`'s words** (phase 8, part A).
 * Each writing action on a selected arrow — and each choice in `/wire
 * links` — is exactly one `wire link` invocation: a target screen,
 * `--back`, `--none`, `--clear`. Its value goes to `linkPatch`, so the
 * canvas writes what the terminal writes: one `item.update`, one group, one
 * undo. `test/arrows.test.ts` holds the ops equal to the CLI's.
 */
export type ArrowWrite = { kind: "retarget"; to: string } | { kind: "back" } | { kind: "remove" } | { kind: "reset" };

export function overrideValue(w: ArrowWrite): string | null {
  switch (w.kind) {
    case "retarget":
      return w.to;
    case "back":
      return LINK_BACK;
    case "remove":
      return LINK_NONE;
    case "reset":
      return null;
  }
}
