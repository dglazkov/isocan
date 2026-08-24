import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizeHomeUrl } from "@isocan/core";
import { readBadge, writeBadge } from "../src/badge-store.ts";
import { resolveHomeUrl } from "../src/config.ts";
import { readHomes, writeHomes } from "../src/homes.ts";
import * as p from "../src/paths.ts";

/**
 * **One address, one spelling** — measured rather than assumed (phase 10.3).
 *
 * Four spellings of a home address used to coexist happily: `HomeLink`'s
 * constructor stripped trailing slashes, `resolveHomeUrl` trimmed whitespace,
 * `badge-store` keyed by whatever string it was handed, and the CLI returned
 * `new URL(raw).origin`. With ONE home per daemon they never met — every
 * caller was handed the same string from the same config key.
 *
 * With many, **two spellings of one address are two links, two badges, two
 * presence mirror keys, and the same face twice in every roster**. The badge
 * is the one that would hurt most and the one that is invisible: a daemon that
 * looked its badge up under a spelling it did not write it under would knock
 * on the door again, be handed a fresh badge holding NO admissions, and then
 * quietly mirror nothing.
 *
 * A trailing slash is not hypothetical — this repo's own fixtures write
 * `{ home: "http://127.0.0.1:9/" }` — so every spelling `config.json` can
 * plausibly hold is exercised here rather than reasoned about.
 */

/** Every way a person or a config file could plausibly spell one home. */
const SPELLINGS = [
  "https://isocan.io",
  "https://isocan.io/",
  "https://isocan.io///",
  "  https://isocan.io  ",
  "https://ISOCAN.io",
  "https://isocan.io:443",
];

let home: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-addr-"));
});

afterEach(async () => {
  await fs.rm(home, { recursive: true, force: true });
  delete process.env.ISOCAN_HOME_URL;
});

describe("a home address has one spelling", () => {
  it("normalizes every spelling config.json can hold to the same origin", () => {
    for (const spelling of SPELLINGS) {
      expect(normalizeHomeUrl(spelling), spelling).toBe("https://isocan.io");
    }
    // A non-default port is part of the identity and survives — a LAN home and
    // a local daemon are as real as a hosted one.
    expect(normalizeHomeUrl("http://127.0.0.1:4441/")).toBe("http://127.0.0.1:4441");
    expect(normalizeHomeUrl("http://192.168.1.9:4441")).toBe("http://192.168.1.9:4441");
  });

  it("is TOTAL — a value already committed to disk never crashes a daemon", () => {
    // The difference between this and the CLI's refusing wrapper. Everything
    // here is read from a file the daemon must boot from, and the only
    // alternatives to handing it back are a crash at boot and a home silently
    // forgotten.
    expect(normalizeHomeUrl("not an address")).toBe("not an address");
    expect(normalizeHomeUrl("  isocan.io/  ")).toBe("isocan.io");
    expect(normalizeHomeUrl("")).toBe("");
  });

  it("finds the badge it wrote, whichever spelling it was written under", async () => {
    // The measurement the phase asked for, stated as `readBadge(home,
    // normalizeHomeUrl(x))` finding what `writeBadge(home, x)` wrote — for
    // every spelling above. A daemon that missed here would re-badge, hold a
    // credential with no admissions, and mirror nothing while looking healthy.
    for (const [index, spelling] of SPELLINGS.entries()) {
      const badge = { badgeId: `bdg_${index}`, secret: `s_${index}`, at: "2026-08-24T00:00:00Z" };
      await writeBadge(home, spelling, badge);
      expect(await readBadge(home, normalizeHomeUrl(spelling)), spelling).toEqual(badge);
      // …and under every OTHER spelling too, which is the property that
      // actually matters: the writer and the reader are different callers with
      // different strings in hand.
      for (const other of SPELLINGS) {
        expect(await readBadge(home, other), `${spelling} written, ${other} read`).toEqual(badge);
      }
    }
    // One key in the file, not six. Six would be six badges, of which at most
    // one carries the admissions.
    const identity = JSON.parse(await fs.readFile(p.identityFile(home), "utf8")) as {
      auth: Record<string, unknown>;
    };
    expect(Object.keys(identity.auth)).toEqual(["https://isocan.io"]);
  });

  it("keeps the human's name and a second home's badge intact", async () => {
    // The read-merge property this file has always had, re-asserted where the
    // plural case is now the ordinary one.
    await fs.writeFile(p.identityFile(home), JSON.stringify({ id: "usr_dion", name: "Dion" }));
    await writeBadge(home, "https://acme.invalid/", { badgeId: "b1", secret: "s1", at: "t" });
    await writeBadge(home, "https://widget.invalid", { badgeId: "b2", secret: "s2", at: "t" });
    const identity = JSON.parse(await fs.readFile(p.identityFile(home), "utf8")) as {
      name: string;
      auth: Record<string, { badgeId: string }>;
    };
    expect(identity.name).toBe("Dion");
    expect(Object.keys(identity.auth).sort()).toEqual([
      "https://acme.invalid",
      "https://widget.invalid",
    ]);
    expect((await readBadge(home, "https://acme.invalid"))!.badgeId).toBe("b1");
  });

  it("normalizes what resolveHomeUrl answers, because that string becomes a key", async () => {
    await fs.writeFile(p.configFile(home), JSON.stringify({ home: "https://isocan.io/" }));
    expect(await resolveHomeUrl(home)).toBe("https://isocan.io");
    process.env.ISOCAN_HOME_URL = "https://DEV.isocan.io/";
    expect(await resolveHomeUrl(home)).toBe("https://dev.isocan.io");
  });

  it("normalizes the rows in homes.json on the way out", async () => {
    // The file is small, hand-inspectable and therefore hand-editable, and a
    // person fixing a typo in it should not have to know that a trailing slash
    // makes a second link.
    await writeHomes(home, { prj_acme: "https://isocan.io/", prj_local: null });
    expect(await readHomes(home)).toEqual({ prj_acme: "https://isocan.io", prj_local: null });
    // A missing file is no rows, and a malformed one is no rows — never a
    // crash. What that costs, plainly, is that a corrupt record reads every
    // canvas as locally homed, which is the safe direction: writes stay here
    // and go nowhere wrong.
    await fs.rm(p.homesFile(home));
    expect(await readHomes(home)).toEqual({});
    await fs.writeFile(p.homesFile(home), "{ not json ,");
    expect(await readHomes(home)).toEqual({});
    await fs.writeFile(p.homesFile(home), '"a string is not a record"');
    expect(await readHomes(home)).toEqual({});
  });
});
