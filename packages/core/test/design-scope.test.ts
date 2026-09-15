import { describe, expect, it } from "vitest";
import { designScopeStanding, designStanding, selectDesignSystem, selectGoverningDesign, type CanvasContents, type Item } from "../src/index.ts";

const author = { id: "usr_acme", name: "Acme designer" }, ts = "2026-01-01T00:00:00.000Z";
function item(id: string, options: { group?: string; kind?: string; system?: boolean; time?: string; x?: number } = {}): Item {
  const time = options.time ?? ts;
  return { id, title: id, description: "", properties: { ...(options.kind ? { kind: options.kind } : {}), ...(options.system ? { role: "design-system" } : {}) }, x: options.x ?? 0, y: 0, width: 300, height: 200, ...(options.group ? { containerId: options.group } : {}), createdBy: author, createdAt: time, updatedBy: author, updatedAt: time, currentVersionId: `ver_${id}`, versions: [{ id: `ver_${id}`, blobHash: "a".repeat(64), filename: options.system ? "DESIGN.md" : "screen.html", mimeType: options.system || options.kind ? "text/markdown" : "text/html", size: 1, createdAt: time, createdBy: author }] };
}
const canvas = (items: Item[]): CanvasContents => ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {}, trash: [] });

describe("one governing scope", () => {
  it("preserves newest-at-winning-level and exposes its competing candidates instead of another lane's newer system", () => {
    const a = item("group_a", { kind: "group" }), b = item("group_b", { kind: "group" });
    const old = item("system_a_old", { group: a.id, system: true }), current = item("system_a", { group: a.id, system: true, time: "2026-02-01" }), unrelated = item("system_b", { group: b.id, system: true, time: "2026-03-01" });
    const screen = item("screen_a", { group: a.id, x: 10000 });
    const state = canvas([a, b, old, current, unrelated, screen]);
    const selected = selectDesignSystem(state, { at: screen });
    expect(selected).toMatchObject({ status: "selected", item: { id: current.id }, level: "scope", scopeId: a.id, scopeDepth: 0 });
    expect(selected.candidates.map((i) => i.id)).toEqual([current.id, old.id]);
    expect(selected.reason).toContain("2 systems compete");
    expect(selectDesignSystem(state, { groupId: a.id }).item?.id).toBe(current.id);
    expect(selectDesignSystem(state, { groupId: null }).item).toBeNull();
  });
  it("walks ancestors, canvas and readable inheritance in existing order while retaining refused sources", () => {
    const parent = item("parent", { kind: "group" }), child = item("child", { kind: "group", group: parent.id }), target = item("screen", { group: child.id });
    const parentSystem = item("parent_system", { group: parent.id, system: true }), global = item("global_system", { system: true }), inherited = item("brand_system", { system: true });
    const state = canvas([parent, child, target, parentSystem, global]);
    const links = [{ canvasId: "prj_private", item: item("private_link"), title: "Private", canvas: null, refused: "Access unavailable" }, { canvasId: "prj_brand", item: item("brand_link"), title: "Brand", canvas: canvas([inherited]) }];
    expect(selectGoverningDesign(state, links, { at: target })).toMatchObject({ item: { id: parentSystem.id }, scopeDepth: 1, level: "scope" });
    delete state.items[parentSystem.id]; expect(selectGoverningDesign(state, links, { at: target }).level).toBe("canvas");
    delete state.items[global.id];
    expect(selectGoverningDesign(state, links, { at: target })).toMatchObject({ item: { id: inherited.id }, level: "inherited", from: { canvasId: "prj_brand" }, refusedSources: [{ canvasId: "prj_private", reason: "Access unavailable" }] });
    expect(selectGoverningDesign(state, links.slice(0, 1), { at: target })).toMatchObject({ item: null, status: "unavailable" });
  });
  it("counts the actual proposed lane and summarizes uncovered screens, including fully covered multiple lanes", () => {
    const a = item("a", { kind: "group" }), b = item("b", { kind: "group" });
    const screens = [...Array.from({ length: 6 }, (_, i) => item(`a_${i}`, { group: a.id })), item("b_0", { group: b.id })];
    const state = canvas([a, b, ...screens]);
    expect(designScopeStanding(state, screens, undefined, { groupId: a.id })).toMatchObject({ standing: "overdue", screenCount: 6 });
    expect(designScopeStanding(state, screens, undefined, { groupId: b.id })).toMatchObject({ standing: "fine", screenCount: 1 });
    state.items.b_system = item("b_system", { group: b.id, system: true });
    expect(designScopeStanding(state, screens).uncoveredIds).toEqual(screens.slice(0, 6).map((s) => s.id));
    state.items.a_system = item("a_system", { group: a.id, system: true });
    expect(designScopeStanding(state, screens)).toMatchObject({ standing: "fine", uncoveredIds: [] });
    expect(designStanding(state, screens.length)).toBe("overdue");
  });
  it("keeps exemption independent from an incumbent and refuses an unavailable explicit target", () => {
    const system = item("system", { system: true }), state = canvas([system]);
    expect(selectGoverningDesign(state, [], { project: { properties: { design: "none" } } })).toMatchObject({ exempt: true, item: { id: system.id } });
    expect(selectGoverningDesign(state, [], { groupId: "missing" })).toMatchObject({ status: "unavailable", item: null });
    expect(selectGoverningDesign(state, [], { at: item("not_stored") })).toMatchObject({ status: "unavailable", item: null });
  });
  it("resolves an existing target's current legacy location instead of trusting an older item copy", () => {
    const area = item("area", { kind: "area" }), system = item("system", { system: true });
    const prior = item("screen", { x: 10000 }), current = { ...prior, x: 0 };
    const state = canvas([area, system, current]);
    expect(selectDesignSystem(state, { at: prior })).toMatchObject({ item: { id: system.id }, scopeId: area.id });
  });
});
