import type { CanvasContents, Item } from "./model.ts";

interface EdgeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * **Node-declared directional edges** — any canvas item can declare outgoing
 * directional edges to other items on the canvas via its `properties`.
 *
 * Two property forms are supported so both CLI flags (`--prop edge:next=itm_2`)
 * and structured writes (`properties.edges = JSON.stringify(...)`) work
 * without a dedicated operation:
 *
 * 1. Flat keys: `edge:<key> = "<targetItemId>"` with optional
 *    `edge:<key>:label = "<label>"`.
 * 2. JSON array or comma list on `edges`:
 *    `[{"to":"itm_2","label":" Submit "}]` or `"itm_2,itm_3"`.
 */

/** Prefix for flat outgoing edge property keys (`edge:<key>`). */
export const EDGE_PROP_PREFIX = "edge:";
/** Property key holding a comma list or JSON array of outgoing edges. */
export const EDGES_PROP = "edges";

interface DeclaredEdge {
  /** Edge key within the source item (defaults to the target item id). */
  key: string;
  /** Target item id on the same canvas. */
  to: string;
  /** Optional label drawn along the directional edge. */
  label?: string;
}

interface NodeEdge {
  from: Item;
  to: Item;
  key: string;
  label?: string;
}

/** Whether a property key is an `edge:<key>` target reference (and not its `:label` companion). */
export function isEdgeReferenceProperty(key: string): boolean {
  return key.startsWith(EDGE_PROP_PREFIX) && !key.endsWith(":label");
}

/** Companion label property key for `edge:<key>`. */
export function edgeLabelProperty(edgeKey: string): string {
  const bare = edgeKey.startsWith(EDGE_PROP_PREFIX)
    ? edgeKey.slice(EDGE_PROP_PREFIX.length)
    : edgeKey;
  return `${EDGE_PROP_PREFIX}${bare}:label`;
}

/**
 * Every outgoing directional edge declared on `item.properties`, in deterministic
 * key order, deduplicated by `(key, to)`.
 */
export function declaredEdgesOf(item: Pick<Item, "properties">): DeclaredEdge[] {
  const props = item.properties ?? {};
  const result: DeclaredEdge[] = [];
  const seen = new Set<string>();

  const add = (key: string, to: string, label?: string) => {
    const target = to.trim();
    const k = key.trim() || target;
    if (!target) return;
    const id = `${k}->${target}`;
    if (seen.has(id)) return;
    seen.add(id);
    const trimmedLabel = label?.trim();
    result.push({
      key: k,
      to: target,
      ...(trimmedLabel ? { label: trimmedLabel } : {}),
    });
  };

  for (const key of Object.keys(props).sort()) {
    if (!isEdgeReferenceProperty(key)) continue;
    const to = props[key];
    if (!to) continue;
    const bareKey = key.slice(EDGE_PROP_PREFIX.length);
    const label = props[edgeLabelProperty(bareKey)];
    add(bareKey, to, label);
  }

  const rawEdges = props[EDGES_PROP]?.trim();
  if (rawEdges) {
    if (rawEdges.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(rawEdges);
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            if (typeof entry === "string") {
              add(entry, entry);
            } else if (entry && typeof entry === "object") {
              const obj = entry as { to?: unknown; key?: unknown; label?: unknown };
              if (typeof obj.to === "string") {
                add(
                  typeof obj.key === "string" ? obj.key : obj.to,
                  obj.to,
                  typeof obj.label === "string" ? obj.label : undefined,
                );
              }
            }
          }
        }
      } catch {
        // Ignore malformed JSON in `edges` property; valid flat `edge:*` keys still resolve.
      }
    } else {
      for (const token of rawEdges.split(",")) {
        const target = token.trim();
        if (target) add(target, target);
      }
    }
  }

  return result;
}

/**
 * Every resolved directional edge declared by items on `canvas`.
 * Self-edges and edges pointing at missing/trashed items are omitted.
 */
export function nodeEdges(canvas: CanvasContents): NodeEdge[] {
  const out: NodeEdge[] = [];
  for (const from of Object.values(canvas.items)) {
    for (const decl of declaredEdgesOf(from)) {
      if (decl.to === from.id) continue;
      const to = canvas.items[decl.to];
      if (!to) continue;
      out.push({
        from,
        to,
        key: decl.key,
        ...(decl.label ? { label: decl.label } : {}),
      });
    }
  }
  return out;
}

/**
 * Property patch for `item.update` that declares a directional edge from the
 * updated item to `toItemId`.
 */
export function edgePatch(
  toItemId: string,
  options: { key?: string; label?: string | null } = {},
): Record<string, string | null> {
  const key = (options.key?.trim() || toItemId.trim());
  const patch: Record<string, string | null> = {
    [`${EDGE_PROP_PREFIX}${key}`]: toItemId.trim(),
  };
  if (options.label !== undefined) {
    const trimmed = options.label?.trim() ?? "";
    patch[edgeLabelProperty(key)] = trimmed ? trimmed : null;
  }
  return patch;
}

/**
 * Property patch for `item.update` that removes a declared directional edge
 * by its key (or target item id when the default key was used).
 */
export function removeEdgePatch(keyOrTargetId: string): Record<string, null> {
  const key = keyOrTargetId.startsWith(EDGE_PROP_PREFIX)
    ? keyOrTargetId.slice(EDGE_PROP_PREFIX.length)
    : keyOrTargetId.trim();
  return {
    [`${EDGE_PROP_PREFIX}${key}`]: null,
    [edgeLabelProperty(key)]: null,
  };
}

interface EdgeAnchorPair {
  x1: number;
  y1: number;
  cx1: number;
  cy1: number;
  cx2: number;
  cy2: number;
  x2: number;
  y2: number;
  /** Midpoint along the cubic bezier curve for placing an optional edge label. */
  mx: number;
  my: number;
}

/**
 * Cubic bezier anchor and control points connecting `from` to `to` along the
 * dominant axis (horizontal when `|dx| >= |dy|`, vertical otherwise).
 */
export function directionalEdgeGeometry(from: EdgeBox, to: EdgeBox): EdgeAnchorPair {
  const fc = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const tc = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const dx = tc.x - fc.x;
  const dy = tc.y - fc.y;
  let x1: number, y1: number, cx1: number, cy1: number, cx2: number, cy2: number, x2: number, y2: number;
  if (Math.abs(dx) >= Math.abs(dy)) {
    x1 = dx >= 0 ? from.x + from.width : from.x;
    y1 = fc.y;
    x2 = dx >= 0 ? to.x : to.x + to.width;
    y2 = tc.y;
    const mid = (x1 + x2) / 2;
    cx1 = mid;
    cy1 = y1;
    cx2 = mid;
    cy2 = y2;
  } else {
    x1 = fc.x;
    y1 = dy >= 0 ? from.y + from.height : from.y;
    x2 = tc.x;
    y2 = dy >= 0 ? to.y : to.y + to.height;
    const mid = (y1 + y2) / 2;
    cx1 = x1;
    cy1 = mid;
    cx2 = x2;
    cy2 = mid;
  }
  const mx = 0.125 * x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x2;
  const my = 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2;
  return { x1, y1, cx1, cy1, cx2, cy2, x2, y2, mx, my };
}
