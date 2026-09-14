import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readDesignAudit, saveDesignRepair } from "../src/lib/design-audit.ts";
import { auditFixture, auditHome } from "../../api/test/design-audit-fixture.ts";

const replacement = '<p style="padding:16px">Acme</p>';
const replacementHash = createHash("sha256").update(replacement).digest("hex");
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("../src/stores/canvasStore.ts", () => ({ sendEchoedResult: send }));
vi.mock("../src/lib/groupplacement.ts", () => ({ creationDestination: () => ({ originGroupMode: "groups" }) }));
beforeEach(() => { vi.stubGlobal("window", { location: { origin: auditHome } }); send.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function prepare() {
  const { canvas, blobs } = auditFixture();
  // The target has a local governing system; unrelated inherited items do
  // not need to be fetched to establish a conditional repair's receipt.
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/homes") return Response.json({ canvases: { prj_dest: null } });
    if (url === "/api/projects/prj_dest/canvas") return Response.json({ canvas, project: { id: "prj_dest" } });
    if (url === "/api/projects/prj_dest/blobs" && init?.method === "POST") return Response.json({ blobHash: replacementHash, size: replacement.length });
    const hash = url.split("/blobs/")[1];
    if (hash && blobs[hash]) return new Response(blobs[hash]);
    throw new Error(`Unexpected fixture request ${url}`);
  }));
  const report = await readDesignAudit("prj_dest", { itemIds: ["nested"] });
  const row = report.items[0]!;
  if (row.status !== "audited") throw new Error("fixture must be audited");
  return { itemId: "nested", text: replacement, expectedVersionId: row.versionId!, expectedGoverning: row.governing, expectedRuleVersion: row.ruleVersion };
}

it("a queued browser repair waits for accepted completion before reporting saved", async () => {
  const options = await prepare();
  let finish!: (result: { status: "accepted" }) => void;
  send.mockResolvedValue({ status: "queued", completion: new Promise(resolve => { finish = resolve; }) });
  const queued = vi.fn();
  let settled = false;
  const result = saveDesignRepair("prj_dest", { id: "usr_acme", name: "Acme" }, { ...options, onQueued: queued }).then(value => { settled = true; return value; });
  await vi.waitFor(() => expect(queued).toHaveBeenCalledOnce());
  expect(settled).toBe(false);
  expect(send.mock.calls[0]![2]).toMatchObject({ type: "item.edit", expectedVersionId: options.expectedVersionId });
  finish({ status: "accepted" });
  expect((await result).status).toBe("saved");
});

it("a queued browser repair can be definitively refused without pretending it saved", async () => {
  const options = await prepare();
  send.mockResolvedValue({ status: "queued", completion: Promise.resolve({ status: "refused", message: "A newer version arrived" }) });
  expect(await saveDesignRepair("prj_dest", { id: "usr_acme", name: "Acme" }, options)).toMatchObject({ status: "refused", code: "write-refused", reason: "A newer version arrived" });
});

it("a queue without completion returns pending identity for authoritative snapshot confirmation", async () => {
  const options = await prepare();
  send.mockResolvedValue({ status: "queued" });
  expect(await saveDesignRepair("prj_dest", { id: "usr_acme", name: "Acme" }, options)).toMatchObject({ status: "pending", itemId: "nested", blobHash: replacementHash, versionId: expect.stringMatching(/^ver_/) });
});

it("a transport error after submission keeps acceptance unknown rather than calling it a refusal", async () => {
  const options = await prepare();
  send.mockRejectedValue(new Error("Connection vanished"));
  expect(await saveDesignRepair("prj_dest", { id: "usr_acme", name: "Acme" }, options)).toMatchObject({ status: "pending", reason: expect.stringContaining("Connection vanished") });
});
