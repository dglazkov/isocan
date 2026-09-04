import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const rail = read("../src/components/AddPopover.tsx");
const upload = read("../src/lib/upload.ts");
const api = read("../src/lib/api.ts");
const server = read("../../server/src/http.ts");
const cli = read("../../cli/src/main.ts");

/**
 * **A Google Doc on the canvas** (research note, stages 2–3): one item, both
 * halves, on both surfaces; the daemon fetches for the app; a private doc is
 * refused in words; a sync stacks a version only when the bytes changed.
 */
describe("a Google Doc typed into Add site becomes a document that keeps its link", () => {
  it("is told apart by its address and added through the daemon's fetch", () => {
    // Through the one Add door now: the classifier says "doc", the popover
    // fetches through the daemon.
    expect(rail).toContain('if (what.kind === "doc") {');
    expect(rail).toContain("const doc = await exportDoc(what.url);");
    expect(api).toContain("export async function exportDoc(url: string)");
  });

  it("is the same item.add a dropped .md makes, plus source and synced", () => {
    expect(upload).toContain("export async function addDocumentItem(");
    expect(upload).toContain("properties: docProperties(doc.source, doc.syncedAt)");
  });
});

describe("the daemon fetches only what core recognises as a doc, and refuses a sign-in page", () => {
  it("answers 400 for a non-doc, and refuses a private doc in words through the one fetcher", () => {
    const route = server.slice(server.indexOf("app.get(DOC_EXPORT_ROUTE"), server.indexOf('app.get("/api/colors"'));
    expect(route).toContain("const id = googleDocId(raw);");
    expect(route).toContain("reply.code(400)");
    // One implementation for the daemon and the CLI: anonymous first, then
    // this machine's Drive token; a sign-in page is a refusal there.
    expect(route).toContain("const doc = await fetchGoogleDoc(id, token);");
    expect(route).toContain("err instanceof DocRefusal");
    const fetcher = read("../../server/src/google.ts");
    expect(fetcher).toContain('/text\\/html/i.test(type)');
    expect(fetcher).toContain("share it by link");
    expect(fetcher).toContain("isocan gdoc auth");
  });
});

describe("the terminal adds and syncs docs", () => {
  it("has gdoc add and gdoc sync", () => {
    expect(cli).toContain('.command("gdoc")');
    expect(cli).toContain('.command("add <url>")');
    expect(cli).toContain('.command("sync")');
  });

  it("stacks a version only when the bytes changed — the daemon's hash says so", () => {
    const sync = cli.slice(cli.indexOf('gdocCmd\n  .command("sync")'), cli.indexOf("* **Areas** —"));
    expect(sync).toContain("if (upload.blobHash === current.blobHash) {");
    expect(sync).toContain('type: "item.addVersion"');
    expect(sync).toContain("[DOC_SYNCED_PROP]: doc.fetchedAt");
  });

  it("says out loud that the words are on the canvas now", () => {
    expect(cli).toContain("readable by everyone admitted to it");
  });
});
