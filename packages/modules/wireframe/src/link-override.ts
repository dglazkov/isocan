import type { Item, Operation } from "@isocan/core";
import { LINKS_PROP, LINK_BACK, LINK_NONE, readOverrides } from "./links.ts";

/**
 * **A person's decision about one hotspot, as the one op that stores it** —
 * shared by `isocan wire link`, the canvas's arrows (drag a head, Change
 * target…, Remove, Reset) and `/wire links` in the dialog, so the three
 * cannot write the decision three ways (phase 8; research *Flow arrows* §3:
 * "retarget is the existing `wire link` override, no new op").
 *
 * `value` is a screen's item id, `LINK_BACK`, `LINK_NONE`, or null to give
 * the hotspot back to the rules. The patch is built from the item AS PASSED,
 * so a caller must hand it the item as it is now — re-read, not one captured
 * before a wait — or it writes back a stale map over somebody else's
 * decision about another hotspot on the same screen.
 */
export function linkOverridePatch(
  current: string | undefined,
  key: string,
  value: string | null,
): { properties: Record<string, string> } | { removeProperties: string[] } {
  const overrides = readOverrides(current);
  if (value === null) delete overrides[key];
  else overrides[key] = value;
  return Object.keys(overrides).length ? { properties: { [LINKS_PROP]: JSON.stringify(overrides) } } : { removeProperties: [LINKS_PROP] };
}

/**
 * **What an arrow's menu does, in `wire link`'s words.** Each writing action
 * on a selected arrow (and each choice in `/wire links`) is one of these, and
 * each is exactly one `wire link` invocation: a target screen, `--back`,
 * `--none`, `--clear`. `test/arrows.test.ts` holds the ops equal to the CLI's.
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

/** The `item.update` that records `value` for `key` on `item` (see `linkOverridePatch`). */
export function linkOverrideOp(item: Pick<Item, "id" | "properties">, key: string, value: string | null): Operation {
  return { type: "item.update", itemId: item.id, patch: linkOverridePatch(item.properties?.[LINKS_PROP], key, value) };
}
