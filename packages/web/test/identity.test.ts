import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DOOR_ROUTE, formatBadgeToken } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";
import { mintTestBadge } from "./badge.ts";
import {
  adoptIdentity,
  enterAs,
  knownIdentities,
  readIdentity,
  renameIdentity,
  signOut,
} from "../src/lib/identity.ts";

/**
 * Web identity is a claim, not a file (#58): every door in the UI issues
 * `actor.claim`, so these tests assert against a real daemon — the same
 * single writer the CLI's `identity --session` talks to. localStorage is
 * memory (which actors are this browser's to ask for), never authority.
 */

/** localStorage, in memory — the module reads it lazily, so a stub is enough. */
function stubStorage(): void {
  const map = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

let home: string;
let daemon: Daemon;
let base: string;
/** The cookie carrier needs a cookie jar, and node's `fetch` has none — so
 * this browser presents its badge as a bearer instead. Both carriers are
 * accepted from anyone, so it is a different envelope around the same badge,
 * not a fiction: what a real Chrome does with the cookie is the phase's
 * browser proof, and it says so. */
let auth: Record<string, string>;
const realFetch = globalThis.fetch;

beforeEach(async () => {
  stubStorage();
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-web-identity-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  const door = await realFetch(`${base}${DOOR_ROUTE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ carrier: "bearer" }),
  });
  const { badgeId, secret } = (await door.json()) as { badgeId: string; secret: string };
  auth = { Authorization: `Bearer ${formatBadgeToken(badgeId, secret)}` };
  // The app fetches same-origin ("/api/…"); in node the daemon is the origin.
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    realFetch(
      typeof input === "string" && input.startsWith("/") ? `${base}${input}` : input,
      { ...init, headers: { ...(init?.headers as Record<string, string>), ...auth } },
    )) as typeof fetch;
});

afterEach(async () => {
  globalThis.fetch = realFetch;
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

/** This browser's claims, as the API serves them — badge-scoped, so the
 * badge has to be the same one the app is presenting. */
const bindings = (): Promise<{ key: string; actor: { id: string; name: string } }[]> =>
  realFetch(`${base}/api/actors`, { headers: auth }).then((r) => r.json() as Promise<any>);

describe("web identity", () => {
  it("mints an id on first entry, remembers it, and the daemon holds the claim", async () => {
    const me = await enterAs("Dimitri");
    expect(me.id).toMatch(/^usr_/);
    expect(readIdentity()).toEqual(me);
    expect(knownIdentities()).toEqual([me]);

    const bound = await bindings();
    expect(bound).toHaveLength(1);
    expect(bound[0]!.key).toMatch(/^web:/);
    expect(bound[0]!.actor).toEqual(me);
  });

  it("renaming keeps the id — you are the same person, differently spelled", async () => {
    const before = await enterAs("Dimitri");
    const after = await renameIdentity("Dimitri G");
    expect(after.id).toBe(before.id);
    expect(readIdentity()).toEqual(after);
    // One roster entry, not two: renaming does not clone you.
    expect(knownIdentities()).toEqual([after]);
    // And one binding: the rename travelled through the same session key.
    const bound = await bindings();
    expect(bound).toHaveLength(1);
    expect(bound[0]!.actor).toEqual(after);
  });

  it("leaving and re-entering under a name used before returns the SAME actor", async () => {
    const first = await enterAs("Dimitri");
    signOut();
    expect(readIdentity()).toBeNull();
    expect(knownIdentities()).toEqual([first]); // leaving is not forgetting

    const back = await enterAs("dimitri"); // case is not a different person
    expect(back).toEqual(first); // the DAEMON said so — same rule as the CLI
  });

  it("a name never used before is someone new, and both are remembered", async () => {
    const dimitri = await enterAs("Dimitri");
    const kenny = await enterAs("Kenny");
    expect(kenny.id).not.toBe(dimitri.id);
    // Most recently worn first.
    expect(knownIdentities()).toEqual([kenny, dimitri]);

    expect(await adoptIdentity(dimitri)).toEqual(dimitri);
    expect(readIdentity()).toEqual(dimitri);
    expect(knownIdentities()).toEqual([dimitri, kenny]);
  });

  it("a name somebody ELSE answers to is refused, not quietly become", async () => {
    // Kenny exists on a canvas, made there by someone who is not this
    // browser — a CLI on the same machine, with a badge of its own: the door
    // must not hand this browser his actor, or a fresh one wearing his name.
    const cli = await mintTestBadge(base);
    await cli.speakAs({ id: "usr_cli_kenny", name: "Kenny" });
    await realFetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cli.headers },
      body: JSON.stringify({
        projectId: null,
        actor: { id: "usr_cli_kenny", name: "Kenny" },
        op: { type: "project.create", projectId: "prj_1", title: "Kenny's" },
      }),
    });
    // And this browser is in that room. A real one is there by its URL —
    // `claimInto` sends the canvas from the address bar — but there is no
    // address bar in node, so it arrives the other way a browser does: it
    // opened the canvas.
    await realFetch(`${base}/api/projects/prj_1/canvas`, { headers: auth });

    await expect(enterAs("Kenny")).rejects.toThrow(/taken here/);
    expect(readIdentity()).toBeNull(); // still at the door
  });

  it("survives a browser that refuses storage", async () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    const me = await enterAs("Nico");
    expect(me.name).toBe("Nico");
    expect(readIdentity()).toBeNull(); // not remembered, but not broken
    expect(knownIdentities()).toEqual([]);
  });
});
