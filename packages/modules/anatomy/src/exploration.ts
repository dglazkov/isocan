import type { WorkspacePresentation } from "@isocan/core";
import type { AnatomyProject } from "./schema.ts";

type Bounds = WorkspacePresentation["items"][string];
export interface ExplorationLayout { root: string; focus: string; items: Record<string, Bounds> }

/** Rectangular rings reserve enough room for every detail level. The grid makes
 * overlap impossible without iterative pairwise relaxation. Breadth-first order
 * puts related concepts nearby; stable IDs break ties, never source array order.
 * On an incoming edit in the same view, occupied homes stay occupied. */
export function explorationLayout(project: AnatomyProject, focusId?: string, previous?: ExplorationLayout): ExplorationLayout {
  let root = project.id;
  const concepts = new Set(project.nodes.map(n => n.id));
  while (concepts.has(root)) root = `@${root}`;
  const ids = new Set([root, ...project.nodes.map(n => n.id)]);
  const focus = focusId && ids.has(focusId) ? focusId : root;
  const links = new Map([...ids].map(id => [id, new Set<string>()]));
  const join = (a: string, b: string) => {
    if (a !== b && links.has(a) && links.has(b)) { links.get(a)!.add(b); links.get(b)!.add(a); }
  };
  for (const node of project.nodes) join(node.id, node.parentId ?? root);
  for (const edge of project.edges) join(edge.from, edge.to);
  const distance = new Map([[focus, 0]]), queue = [focus];
  for (let i = 0; i < queue.length; i++) for (const id of links.get(queue[i]!)!) {
    if (!distance.has(id)) { distance.set(id, distance.get(queue[i]!)! + 1); queue.push(id); }
  }
  const order = [...ids].filter(id => id !== focus).sort((a, b) =>
    (distance.get(a) ?? Infinity) - (distance.get(b) ?? Infinity) || a.localeCompare(b));
  const compact = new Set(order.filter(id => distance.get(id) === 1).slice(0, 8));
  const homes = new Map<string, { x: number; y: number }>(), used = new Set<string>(["0:0"]);
  if (previous?.focus === focus) for (const id of order) {
    const old = previous.items[id];
    if (old) {
      const point = { x: old.x + old.width / 2, y: old.y + old.height / 2 };
      homes.set(id, point); used.add(`${point.x}:${point.y}`);
    }
  }
  function* slots() {
    for (let ring = 1; ; ring++) {
      // Start at the right of the focus, then walk the perimeter clockwise.
      for (let y = -ring + 1; y <= ring; y++) yield { x: ring * 320, y: y * 188 };
      for (let x = ring - 1; x >= -ring; x--) yield { x: x * 320, y: ring * 188 };
      for (let y = ring - 1; y >= -ring; y--) yield { x: -ring * 320, y: y * 188 };
      for (let x = -ring + 1; x <= ring; x++) yield { x: x * 320, y: -ring * 188 };
    }
  }
  const available = slots();
  const items: Record<string, Bounds> = { [focus]: { x: -180, y: -116, width: 360, height: 232, detail: "full", emphasis: true } };
  for (const id of order) {
    let home = homes.get(id);
    while (!home) { const point = available.next().value!; if (!used.has(`${point.x}:${point.y}`)) home = point; }
    used.add(`${home.x}:${home.y}`);
    const detail = compact.has(id) ? "compact" : "marker";
    const width = detail === "compact" ? 220 : 32, height = detail === "compact" ? 88 : 32;
    items[id] = { x: home.x - width / 2, y: home.y - height / 2, width, height, detail };
  }
  return { root, focus, items };
}

export const EXPLORATION_LENSES = ["blueprint", "overview", "decisions", "coverage"] as const;
export function explorationState(value: Readonly<Record<string, string>>) {
  return { projectId: value.project ?? null, nodeId: value.focus ?? null,
    lens: EXPLORATION_LENSES.find(lens => lens === value.lens) ?? "blueprint" };
}
