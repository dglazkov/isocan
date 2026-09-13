import { describe, expect, it, vi } from "vitest";
import type { SeenMark } from "@isocan/core";

const api = vi.hoisted(() => ({ fetchSeen: vi.fn(), putSeen: vi.fn() }));
vi.mock("../src/lib/api.ts", () => api);

describe("accepted visits update the local inbox", () => {
  it("announces the home's accepted mark, never a read or an optimistic browser clock", async () => {
    api.fetchSeen.mockResolvedValue({ marks: {} });
    let accept!: (value: { mark: SeenMark }) => void;
    api.putSeen.mockReturnValue(new Promise((resolve) => { accept = resolve; }));
    const { loadSeen, noteVisit, onSeenVisit, seenMarks } = await import("../src/lib/seen.ts");
    const received = vi.fn();
    const unwatch = onSeenVisit(received);
    await loadSeen("usr_ada");
    expect(received).not.toHaveBeenCalled();
    noteVisit("prj_acme", 10, "usr_ada");
    await vi.waitFor(() => expect(api.putSeen).toHaveBeenCalledWith("prj_acme", 10, "usr_ada"));
    expect(received).not.toHaveBeenCalled();
    const mark = { seq: 12, at: "2026-09-13T12:00:00.000Z" };
    accept({ mark });
    await vi.waitFor(() => expect(received).toHaveBeenCalledWith("usr_ada", "prj_acme", mark));
    expect(seenMarks("usr_ada").prj_acme).toEqual(mark);
    unwatch();
    noteVisit("prj_acme", 12, "usr_ada");
    await Promise.resolve();
    await Promise.resolve();
    expect(received).toHaveBeenCalledTimes(1);
  });
});

describe("shared seen-read ownership", () => {
  it("cancels the last caller's HTTP work and permits an immediate retry", async () => {
    let signal!: AbortSignal;
    api.fetchSeen.mockImplementationOnce((_id, given) => {
      signal = given;
      return new Promise((_resolve, reject) => given.addEventListener("abort", () => reject(given.reason), { once: true }));
    });
    const { loadSeen } = await import("../src/lib/seen.ts");
    const controller = new AbortController();
    const pending = loadSeen("usr_cancel", { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(signal.aborted).toBe(true);
    api.fetchSeen.mockResolvedValueOnce({ marks: {} });
    expect(await loadSeen("usr_cancel")).toBe(true);
  });

  it("keeps a shared read alive for an actual visit after navigation cancels", async () => {
    let signal!: AbortSignal;
    let finish!: (value: { marks: {} }) => void;
    api.fetchSeen.mockImplementationOnce((_id, given) => {
      signal = given;
      return new Promise((resolve) => { finish = resolve; });
    });
    const { loadSeen } = await import("../src/lib/seen.ts");
    const controller = new AbortController();
    const navigation = loadSeen("usr_shared", { signal: controller.signal });
    const visit = loadSeen("usr_shared", { refresh: true });
    controller.abort();
    await expect(navigation).rejects.toThrow();
    expect(signal.aborted).toBe(false);
    finish({ marks: {} });
    expect(await visit).toBe(true);
  });

  it("reports a failed read separately from a fresh empty ledger and retries", async () => {
    api.fetchSeen.mockRejectedValueOnce(new Error("offline"));
    const { loadSeen } = await import("../src/lib/seen.ts");
    expect(await loadSeen("usr_retry")).toBe(false);
    api.fetchSeen.mockResolvedValueOnce({ marks: {} });
    expect(await loadSeen("usr_retry")).toBe(true);
    api.fetchSeen.mockResolvedValueOnce({ marks: { prj_acme: { seq: 2, at: "2026-09-13T00:00:00Z" } } });
    expect(await loadSeen("usr_retry", { refresh: true })).toBe(true);
  });
});

it("does not satisfy a targeted read from an unscoped read's result or pending request", async () => {
  let finish!: (value: { marks: {} }) => void;
  api.fetchSeen.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  api.fetchSeen.mockResolvedValueOnce({ marks: { prj_target: { seq: 9, at: "2026-09-13T01:00:00Z" } } });
  const { loadSeen, seenMarks } = await import("../src/lib/seen.ts");
  const unscoped = loadSeen("usr_scope");
  expect(await loadSeen("usr_scope", { canvasId: "prj_target" })).toBe(true);
  expect(api.fetchSeen).toHaveBeenLastCalledWith("usr_scope", expect.any(AbortSignal), "prj_target");
  expect(seenMarks("usr_scope").prj_target?.seq).toBe(9);
  finish({ marks: {} });
  expect(await unscoped).toBe(true);
  api.fetchSeen.mockResolvedValueOnce({ marks: {} });
  expect(await loadSeen("usr_scope", { canvasId: "prj_other" })).toBe(true);
  expect(api.fetchSeen).toHaveBeenLastCalledWith("usr_scope", expect.any(AbortSignal), "prj_other");
});


describe("authoritative prior marks stay separate from merged recents", () => {
  it.each([null, { seq: 5, at: "2026-09-13T01:00:00Z" }])("returns the home's exact %j despite an older wrong-home mark99", async (authoritative) => {
    const { noteVisit, rememberSeen, seenMarks } = await import("../src/lib/seen.ts");
    const actorId = authoritative ? "usr_prior_lower" : "usr_prior_empty";
    const stale = { seq: 99, at: "2026-09-13T09:00:00Z" };
    rememberSeen(actorId, { prj_target: stale });
    api.fetchSeen.mockResolvedValueOnce({ marks: authoritative ? { prj_target: authoritative } : {} });
    // Hold the new visit apart from the prior read being asserted.
    api.putSeen.mockReturnValueOnce(new Promise(() => {}));
    expect(await noteVisit("prj_target", 9, actorId)).toMatchObject({ available: true, mark: authoritative });
    expect(api.fetchSeen).toHaveBeenLastCalledWith(actorId, expect.any(AbortSignal), "prj_target");
    // Recents and accepted-visit notifications retain their monotonic merge.
    expect(seenMarks(actorId).prj_target).toEqual(stale);
  });

  it("does not fall back to a prior success or the merged ledger after a failed fresh read", async () => {
    const { noteVisit, rememberSeen } = await import("../src/lib/seen.ts");
    rememberSeen("usr_prior_failure", { prj_target: { seq: 99, at: "2026-09-13T09:00:00Z" } });
    api.fetchSeen.mockResolvedValueOnce({ marks: { prj_target: { seq: 5, at: "2026-09-13T01:00:00Z" } } });
    await noteVisit("prj_target", 9, "usr_prior_failure");
    api.fetchSeen.mockRejectedValueOnce(new Error("home unavailable"));
    expect(await noteVisit("prj_target", 9, "usr_prior_failure")).toMatchObject({ available: false, mark: null });
    api.fetchSeen.mockResolvedValueOnce({ marks: {} });
    expect(await noteVisit("prj_target", 9, "usr_prior_failure")).toMatchObject({ available: true, mark: null });
  });
});
