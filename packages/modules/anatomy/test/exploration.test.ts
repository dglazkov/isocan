import { describe, expect, it } from "vitest";
import { explorationLayout, explorationState } from "../src/exploration.ts";
import { sampleProject } from "./fixture.ts";

function graph(count: number) {
  const project = sampleProject();
  project.nodes = Array.from({ length: count }, (_, i) => ({ ...project.nodes[0]!, id: `n${String(i).padStart(3, "0")}`, parentId: i ? `n${String(Math.floor((i - 1) / 4)).padStart(3, "0")}` : undefined }));
  project.edges = project.nodes.slice(1).map((n, i) => ({ id: `e${i}`, from: project.nodes[i]!.id, to: n.id, coupling: "loose" as const, label: "feeds" }));
  return project;
}
describe("fluid exploration layout", () => {
  for (const count of [30, 100, 300]) it(`${count} concepts remain deterministic, bounded in detail, and collision-free across focus changes`, () => {
    const project = graph(count);
    const before = structuredClone(project);
    for (const focus of [undefined, "n000", `n${String(count - 1).padStart(3, "0")}`]) {
      const layout = explorationLayout(project, focus);
      expect(layout).toEqual(explorationLayout({ ...project, nodes: [...project.nodes].reverse(), edges: [...project.edges].reverse() }, focus));
      const boxes = Object.values(layout.items);
      expect(boxes).toHaveLength(count + 1);
      expect(boxes.filter(b => b.detail === "full")).toHaveLength(1);
      expect(boxes.filter(b => b.detail === "compact").length).toBeLessThanOrEqual(8);
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!, b = boxes[j]!;
        expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
      }
    }
    expect(project).toEqual(before);
  });
  it("preserves existing homes on incoming additions and handles deleted focus", () => {
    const project = graph(30), first = explorationLayout(project, "n000");
    project.nodes.push({ ...project.nodes[0]!, id: "a-new-concept", parentId: "n029" });
    const next = explorationLayout(project, "n000", first);
    for (const [id, bounds] of Object.entries(first.items)) expect(next.items[id]).toEqual(bounds);
    project.nodes = project.nodes.filter(n => n.id !== "n000");
    expect(explorationLayout(project, "n000", next).focus).toBe(project.id);
  });
  it("keeps a concept whose portable ID happens to equal its project ID", () => {
    const project = graph(30);
    project.id = project.nodes[0]!.id;
    const layout = explorationLayout(project);
    expect(Object.keys(layout.items)).toHaveLength(31);
    expect(layout.root).not.toBe(project.id);
    expect(explorationLayout(project, project.id).items[project.id]!.detail).toBe("full");
  });
  it("parses deep links and falls back safely for unknown lenses", () => {
    expect(explorationState({ project: "p", focus: "n", lens: "coverage" })).toEqual({ projectId: "p", nodeId: "n", lens: "coverage" });
    expect(explorationState({ lens: "bogus" }).lens).toBe("blueprint");
  });
});
