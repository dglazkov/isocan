import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { groupMemberRoute, groupRoute, GROUPS_ROUTE } from "@isocan/core";
import {
  addGroupMember,
  createGroup,
  deleteGroup,
  listGroups,
  readGroup,
  removeGroupMember,
} from "../src/lib/api.ts";

/**
 * **The group, on the web surface** (roles phase 5). Two things worth
 * holding still without a browser: the calls the Groups panel and the Share
 * dialog go out on — the same routes `isocan group` and `isocan share
 * group:<name>` drive, spelled by core — and the shape of the two
 * components, read from source: a Groups… control on the canvas list beside
 * New space opening a panel where a group is made, its members added and
 * removed, and deleted; the Share dialog's invite field taking a group from
 * a picker or as `group:<name>` typed, resolved to the group's id before it
 * is sent; and a group row shown by its name and size rather than its id.
 * The conductor drives the rest in Chrome.
 */

const realFetch = globalThis.fetch;
interface Seen {
  method: string;
  url: string;
  body: string | undefined;
  headers: HeadersInit | undefined;
}
let seen: Seen[];
let answer: unknown;

beforeEach(() => {
  seen = [];
  answer = { groups: [] };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({
      method: init?.method ?? "GET",
      url: String(input),
      body: init?.body === undefined ? undefined : String(init.body),
      headers: init?.headers,
    });
    return new Response(JSON.stringify(answer), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("the group calls, on the wire", () => {
  it("lists, makes, reads and deletes a group through core's routes", async () => {
    await listGroups();
    await createGroup("Design team", "usr_priya");
    await readGroup("ppl_1");
    await deleteGroup("ppl_1", "usr_priya");
    expect(seen.map((s) => [s.method, s.url])).toEqual([
      ["GET", GROUPS_ROUTE],
      ["POST", GROUPS_ROUTE],
      ["GET", groupRoute("ppl_1")],
      // No body on the DELETE; the actor rides the query.
      ["DELETE", `${groupRoute("ppl_1")}?actorId=usr_priya`],
    ]);
    expect(JSON.parse(seen[1]!.body!)).toEqual({ name: "Design team", actorId: "usr_priya" });
    expect(seen[3]!.body).toBeUndefined();
    expect(seen[3]!.headers).toBeUndefined();
  });

  it("adds a member with PUT on the encoded member route, and removes with a bodiless DELETE", async () => {
    await addGroupMember("ppl_1", "email:jordan@acme.test", "usr_priya");
    await removeGroupMember("ppl_1", "email:jordan@acme.test", "usr_priya");
    expect(seen[0]).toMatchObject({ method: "PUT", url: groupMemberRoute("ppl_1", "email:jordan@acme.test") });
    expect(seen[0]!.url).toContain("email%3Ajordan%40acme.test");
    expect(JSON.parse(seen[0]!.body!)).toEqual({ actorId: "usr_priya" });
    expect(seen[1]).toMatchObject({
      method: "DELETE",
      url: `${groupMemberRoute("ppl_1", "email:jordan@acme.test")}?actorId=usr_priya`,
      body: undefined,
    });
  });
});

const list = readFileSync(fileURLToPath(new URL("../src/pages/CanvasListPage.tsx", import.meta.url)), "utf8");
const panel = readFileSync(fileURLToPath(new URL("../src/components/GroupsPanel.tsx", import.meta.url)), "utf8");
const dialog = readFileSync(fileURLToPath(new URL("../src/components/ShareDialog.tsx", import.meta.url)), "utf8");
const bare = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\/.*$/gm, "");

describe("the Groups panel", () => {
  const page = bare(list);
  const source = bare(panel);

  it("opens from Groups… on the canvas list, beside New space", () => {
    expect(page).toContain("Groups…");
    expect(page).toMatch(/<GroupsPanel actor=\{actor\}/);
    // Beside New space: the control follows the New space form in the head.
    expect(page.indexOf("New space")).toBeLessThan(page.indexOf("Groups…"));
    expect(page.indexOf("Groups…")).toBeLessThan(page.indexOf('className="who"'));
  });

  it("makes a group, adds and removes members, and deletes — each the same call the CLI makes", () => {
    expect(source).toContain("New group");
    expect(source).toMatch(/createGroup\(name, actor\.id\)/);
    // An address typed is spelled by core's `grantSubjectOf`, as the CLI
    // and the Share dialog spell it.
    expect(source).toMatch(/addGroupMember\(group\.id, grantSubjectOf\(who\), actor\.id\)/);
    expect(source).toMatch(/removeGroupMember\(group\.id, member, actor\.id\)/);
    expect(source).toMatch(/deleteGroup\(group\.id, actor\.id\)/);
    expect(source).toContain("Delete");
  });

  it("lists the owner's members, and reports what a member write reached as the home answered it", () => {
    expect(source).toMatch(/\(group\.members \?\? \[\]\)\.map/);
    expect(source).toContain("answer.reached");
    expect(source).toMatch(/Reached \$\{news\.reached === 1 \? "1 canvas"/);
  });
});

describe("the Share dialog", () => {
  const source = bare(dialog);

  it("offers the person's groups as a picker beside the address field, on a canvas and on a space", () => {
    expect(source).toMatch(/listGroups\(\)/);
    expect(source.match(/aria-label="Invite a group"/g)).toHaveLength(2);
    // Choosing one fills the field with `group:<name>`: one path for the
    // picker and for a typed name.
    expect(source.match(/setWho\(e\.target\.value \? `group:\$\{e\.target\.value\}` : ""\)/g)).toHaveLength(2);
    // The field is no longer an email field, since a group is not one.
    expect(source).not.toContain('type="email"');
  });

  it("resolves group:<name> through the person's own groups to the group's id before sending", () => {
    expect(source).toMatch(/createGrant\(canvasId, inviteSubject\(who, groups\), inviteRung, actor\.id\)/);
    expect(source).toMatch(/createSpaceGrant\(space\.id, inviteSubject\(who, groups\), inviteRung, actor\.id\)/);
    expect(source).toMatch(/sameGroupName\(group\.name, ref\)/);
    expect(source).toMatch(/return groupSubject\(found\.id\)/);
    // An address still goes through core's `grantSubjectOf`, unchanged.
    expect(source).toMatch(/if \(ref === null\) return grantSubjectOf\(who\)/);
  });

  it("shows a group row by its name and size from GET /api/groups/:id, never as group:ppl_…", () => {
    expect(source).toMatch(/readGroup\(id\)/);
    expect(source).toContain("· group of ${view.size}");
    // Every row's subject goes through the one label: the space's rows on
    // a canvas, the invitations, the bars, and the space's own rows.
    expect(source.match(/<b>\{subjectLabel\(grant\.subject, views\)\}<\/b>/g)).toHaveLength(5);
    expect(source).not.toMatch(/<b>\{grant\.subject\.replace/);
  });
});
