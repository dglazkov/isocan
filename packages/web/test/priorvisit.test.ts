import { expect, it, vi } from "vitest";
import type { SeenMarks, SeenMark, CanvasContents, LogEntry } from "@isocan/core";
import { visitDigest } from "../src/lib/visitdigest.ts";
const api = vi.hoisted(() => ({ fetchSeen: vi.fn(), putSeen: vi.fn() }));
vi.mock("../src/lib/api.ts", () => api);
it("captures the fresh prior mark before a visit write and preserves accepted notifications", async () => {
  let read!: (value: { marks: SeenMarks }) => void, accept!: (value: { mark: SeenMark }) => void;
  api.fetchSeen.mockImplementationOnce(() => new Promise((resolve) => { read = resolve; }));
  api.putSeen.mockImplementationOnce(() => new Promise((resolve) => { accept = resolve; }));
  const seen = await import("../src/lib/seen.ts");
  seen.rememberSeen("usr_prior", { prj_acme: { seq: 99, at: "2026-09-01T00:00:00Z" } });
  const notify = vi.fn(), unwatch = seen.onSeenVisit(notify);
  const pending = seen.noteVisit("prj_acme", 9, "usr_prior");
  expect(api.putSeen).not.toHaveBeenCalled();
  expect(api.fetchSeen).toHaveBeenCalledWith("usr_prior", expect.any(AbortSignal), "prj_acme");
  read({ marks: { prj_acme: { seq: 5, at: "2026-09-12T00:00:00Z" } } });
  const prior = await pending;
  expect(prior).toMatchObject({ available: true, head: 9, mark: { seq: 5 } });
  expect(api.putSeen).toHaveBeenCalledWith("prj_acme", 9, "usr_prior");
  expect(notify).not.toHaveBeenCalled();
  accept({ mark: { seq: 11, at: "2026-09-13T00:00:00Z" } });
  await vi.waitFor(() => expect(notify).toHaveBeenCalledOnce());
  expect(seen.seenMarks("usr_prior").prj_acme?.seq).toBe(99);
  expect(notify).toHaveBeenLastCalledWith("usr_prior", "prj_acme", { seq: 11, at: "2026-09-13T00:00:00Z" });
  expect(prior.mark?.seq).toBe(5); unwatch();
});
it("treats an authoritative empty scoped response as first visit despite an older local ledger", async () => {
  api.fetchSeen.mockResolvedValueOnce({ marks: {} });
  api.putSeen.mockResolvedValueOnce({ mark: { seq: 9, at: "2026-09-13T00:00:00Z" } });
  const seen = await import("../src/lib/seen.ts");
  seen.rememberSeen("usr_remote_first", { prj_acme: { seq: 99, at: "2026-09-01T00:00:00Z" } });
  expect(await seen.noteVisit("prj_acme", 9, "usr_remote_first")).toMatchObject({ available: true, mark: null });
});
it("distinguishes an unreadable ledger from a first recorded visit", async () => {
  api.fetchSeen.mockRejectedValueOnce(new Error("offline")); api.putSeen.mockRejectedValueOnce(new Error("offline"));
  const { noteVisit } = await import("../src/lib/seen.ts");
  expect(await noteVisit("prj_acme", 9, "usr_unavailable")).toMatchObject({ available: false, mark: null });
});
it("bounds digest records to the prior mark and arrival head, stating gaps", () => {
  const canvas: CanvasContents = { items: {}, threads: {}, trash: [] };
  const prior = { canvasId: "prj_acme", actorId: "usr_prior", head: 4, available: true, mark: { seq: 2, at: "2026-09-12T00:00:00Z" } };
  const entry = (seq: number): LogEntry => ({ seq, inverse: null, envelope: { id: `op_${seq}`, canvasId: "prj_acme", ts: "2026-09-13T00:00:00Z", actor: { id: "usr_morgan", name: "Morgan" }, op: { type: "project.update", patch: { title: "Acme" } } } });
  const complete = visitDigest(prior, canvas, [entry(2), entry(3), entry(4), entry(5)]);
  expect(complete.rows.map((r) => r.seq)).toEqual([4, 3]);
  expect(complete.rows[0]?.words).toBe("Morgan renamed the canvas");
  expect(visitDigest(prior, canvas, [entry(4)]).notice).toMatch(/unavailable/);
  expect(visitDigest({ ...prior, mark: null }, canvas, []).notice).toMatch(/first recorded/);
});
