import { afterEach, describe, expect, it, vi } from "vitest";
import { DOOR_ROUTE, passesRoute } from "@isocan/core";
import { ApiError, DaemonRoutes, type BadgeStore, type RoomRoutes, type StoredBadge } from "../src/index.ts";

/**
 * **The client a host constructs, from `isocan/rc` alone** (sheep's collie,
 * phase 1). A host with no Node — a Worker holding the room — speaks to the
 * daemon with the same `DaemonRoutes` the CLI's `DaemonClient` extends, not a
 * second client written from the wire. The boundary test holds that it
 * reaches nothing Node-only; this holds that what it hands a host is usable as
 * handed: a badge store the host keeps, the global `fetch`, and the room's
 * interface satisfied by the compiler at the assignment below.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A badge store with no disk: what a host keeps in its own storage. */
function memoryBadges(): BadgeStore & { held: StoredBadge | null } {
  return {
    held: null,
    async read() {
      return this.held;
    },
    async keep(badge) {
      this.held = badge;
    },
  };
}

describe("DaemonRoutes, as isocan/rc hands it to a host", () => {
  it("is the room's routes: a host hands it to runRoom as it stands", () => {
    // The compiler is the assertion (`npm run typecheck` covers this file):
    // if a RoomRoutes call drifts from DaemonRoutes' spelling, this line stops
    // typechecking.
    const routes: RoomRoutes = new DaemonRoutes("https://acme.invalid", memoryBadges());
    expect(typeof routes.rcHold).toBe("function");
  });

  it("knocks at the door over the global fetch, keeps the badge in the host's store, and replays", async () => {
    const base = "https://acme.invalid";
    const calls: { url: string; auth: string | null }[] = [];
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const auth = new Headers(init?.headers).get("Authorization");
      calls.push({ url, auth });
      const json = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
      if (url === `${base}${DOOR_ROUTE}`) return json(200, { badgeId: "bdg_acme", secret: "s3cret" });
      if (url === `${base}${passesRoute("prj_acme")}`) {
        return auth ? json(200, { pass: { id: "pas_acme" }, token: "pas_acme.token" }) : json(401, { error: "a badge is required", code: "no-badge" });
      }
      return json(404, { error: "not found", code: "not-found" });
    });

    const badges = memoryBadges();
    const routes = new DaemonRoutes(base, badges);
    const minted = await routes.mintPass("prj_acme");
    expect(minted.token).toBe("pas_acme.token");
    expect(badges.held?.badgeId).toBe("bdg_acme");
    expect(calls.map((c) => [c.url.slice(base.length), c.auth !== null])).toEqual([
      [passesRoute("prj_acme"), false],
      [DOOR_ROUTE, false],
      [passesRoute("prj_acme"), true],
    ]);

    // A refusal arrives as the ApiError the room reads refusals by.
    await expect(routes.killBadge("bdg_other")).rejects.toBeInstanceOf(ApiError);
  });

  it("answers a blob as a Uint8Array — a host has no Buffer", async () => {
    vi.stubGlobal("fetch", async () => new Response(new Uint8Array([65, 99, 109, 101]), { status: 200 }));
    const routes = new DaemonRoutes("https://acme.invalid", memoryBadges());
    const bytes = await routes.downloadBlob("prj_acme", "hash_acme");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(bytes)).toBe("Acme");
  });
});
