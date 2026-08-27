import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HomeLinks } from "../src/home-links.ts";

/**
 * **Bytes must not be able to travel to a different place than the ops that
 * name them.**
 *
 * `Engine.putBlob` decides where an upload goes by asking `homeOf` — push to
 * the home first, then keep a local copy. When the routing table has not been
 * read yet, every canvas answers "no home", so the push is skipped in silence
 * while the `item.addVersion` that names the blob replicates as usual. A
 * teammate then holds an item, its title and its version number, with no
 * bytes behind it and "blob not found" where the screen should be — and
 * nothing ever repairs it, because nothing ever notices.
 *
 * Reported by a collaborator who could see the items and none of the
 * pictures.
 */

const daemonSrc = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/daemon.ts"),
  "utf8",
);

describe("the routing table is known before the door opens", () => {
  it("loads homes before listening, and dials only after", () => {
    const load = daemonSrc.indexOf("await homes.load()");
    const listen = daemonSrc.indexOf("await app.listen(");
    const dial = daemonSrc.indexOf("await homes.start()");
    expect(load, "daemon.ts must load the home table").toBeGreaterThan(-1);
    expect(listen).toBeGreaterThan(-1);
    expect(dial, "daemon.ts must still start the links").toBeGreaterThan(-1);
    // Loading is a file read and answers "where does this canvas live" — it
    // has to precede the first request.
    expect(load, "an unloaded table makes every canvas look homeless").toBeLessThan(listen);
    // Dialling is a network round trip whose first inbound op is written
    // through the engine, so it must NOT precede serving.
    expect(dial, "dialling before serving is the race this ordering avoids").toBeGreaterThan(listen);
  });
});

describe("loading the table is not dialling", () => {
  let home: string;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-homeroute-"));
  });
  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true });
  });

  it("answers homeOf from disk without opening a single connection", async () => {
    // A home that does not exist: if `load` dialled, this would hang or throw.
    // It must simply read the row, because that row is what an upload landing
    // one millisecond after `listen` needs in order to go to the right place.
    await fs.mkdir(path.join(home), { recursive: true });
    await fs.writeFile(
      path.join(home, "homes.json"),
      JSON.stringify({ prj_away: "http://127.0.0.1:9/", prj_mine: null }),
    );
    // Only the row-reading half is under test, and it touches neither of
    // these — which is the property being asserted.
    const links = new HomeLinks({
      home,
      birthHome: null,
      engine: null,
      presence: null,
    } as unknown as ConstructorParameters<typeof HomeLinks>[0]);
    await links.load();
    // Normalized on the way in, which is the row's own business.
    expect(links.homeOf("prj_away")).toBe("http://127.0.0.1:9");
    // Null is a real answer — "this daemon is its home" — and must stay
    // distinguishable from "I have not looked yet".
    expect(links.homeOf("prj_mine")).toBe(null);
    await links.close();
  });
});
