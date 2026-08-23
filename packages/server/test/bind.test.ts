import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { startDaemon, type Daemon } from "../src/daemon.ts";

/**
 * Which interface the daemon binds — and the first case here is a SECURITY
 * property, not a feature.
 *
 * `http.ts`'s `loopbackBound` reads the address the server actually bound and
 * hands localhost trust to it: mechanism 5's "within a machine, localhost
 * trust stands" is applied by asking the socket, not by asking a config. So
 * the default bind is what decides whose Origin header is believed without
 * question. If someone later "simplifies" the default to `0.0.0.0` — a
 * one-word change, the kind that looks like tidying — the localhost clause
 * silently starts applying to the whole network, every other test in the suite
 * still passes, and nothing says a word. That is exactly the class of change a
 * test exists to stop, so it is pinned here.
 *
 * Every assertion is made against `app.server.address()` — what the socket IS
 * bound to — and never against the option that was passed in, which would only
 * prove that a variable equals itself.
 *
 * NOTHING HERE BINDS A WIDE INTERFACE. The case that matters is the narrow
 * one, and the two cases that need a *different* address to be meaningful use
 * `::1`, which is loopback too. A test suite that opened the machine to the
 * network to prove the daemon does not is not a trade worth making.
 */

/** What the socket is really bound to. */
function boundAddress(daemon: Daemon): string {
  const address = daemon.app.server.address();
  if (!address || typeof address === "string") {
    throw new Error(`expected an AddressInfo, got ${JSON.stringify(address)}`);
  }
  return address.address;
}

/**
 * Is there an IPv6 loopback on this machine? Two of the three cases need an
 * address that is loopback but is NOT the default, and `::1` is the only one
 * that is reliably present on both macOS and Linux — `127.0.0.2` is loopback
 * on Linux and unbindable on a stock macOS, which would make this file fail
 * for a reason that has nothing to do with isocan.
 *
 * Asked rather than assumed, so a machine without it gets a named skip instead
 * of a mystery failure.
 *
 * Probed at MODULE LOAD, with a top-level await, and that placement is the
 * whole trick: `it.skipIf(...)` is evaluated while the file is being COLLECTED,
 * so a flag set in `beforeAll` is still `false` when the decision is made — and
 * both cases skip on every machine forever, silently, with a green run to show
 * for it. That is exactly what happened on the first draft of this file. Asked
 * here, the answer exists before the first `it` is reached.
 */
const hasIpv6Loopback = await new Promise<boolean>((resolve) => {
  const probe = net.createServer();
  probe.once("error", () => resolve(false));
  probe.listen({ port: 0, host: "::1" }, () => probe.close(() => resolve(true)));
});

let daemon: Daemon | null = null;
let home: string | null = null;
const priorBind = process.env.ISOCAN_BIND;

async function start(options: { host?: string } = {}): Promise<Daemon> {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-bind-"));
  daemon = await startDaemon({ port: 0, home, ...options });
  return daemon;
}

afterEach(async () => {
  // The environment is process-wide and vitest workers run many files, so a
  // leaked ISOCAN_BIND would quietly re-point every daemon a later file starts.
  if (priorBind === undefined) delete process.env.ISOCAN_BIND;
  else process.env.ISOCAN_BIND = priorBind;
  if (daemon) await daemon.close();
  if (home) await fs.rm(home, { recursive: true, force: true });
  daemon = null;
  home = null;
});

describe("which interface the daemon binds", () => {
  it("binds LOOPBACK when nothing says otherwise — the default that grants localhost trust", async () => {
    delete process.env.ISOCAN_BIND;
    const started = await start();
    // Not "not 0.0.0.0" — the exact address, because "not the wide one" would
    // still pass if the default drifted to some other reachable interface.
    expect(boundAddress(started)).toBe("127.0.0.1");
  });

  it.skipIf(!hasIpv6Loopback)(
    "reads ISOCAN_BIND — proven with ::1, which is a different address and still loopback",
    async () => {
      // The point of `::1` rather than `127.0.0.1` here: asserting the default
      // address back would pass even if ISOCAN_BIND were never read at all.
      // A different address is what makes this an observation.
      process.env.ISOCAN_BIND = "::1";
      const started = await start();
      expect(boundAddress(started)).toBe("::1");
    },
  );

  it.skipIf(!hasIpv6Loopback)(
    "an explicit host option beats ISOCAN_BIND — configuration a caller states wins over ambient",
    async () => {
      // Worth its place: `startDaemon` is called with options by the tests, by
      // `runDaemon`, and by anything embedding the daemon, while ISOCAN_BIND is
      // set by the container image for every process in it. If the environment
      // won, a caller passing `host` inside a container would be silently
      // overruled — and would have no way to find out except by reading the
      // socket, which is what this does.
      process.env.ISOCAN_BIND = "::1";
      const started = await start({ host: "127.0.0.1" });
      expect(boundAddress(started)).toBe("127.0.0.1");
    },
  );
});
