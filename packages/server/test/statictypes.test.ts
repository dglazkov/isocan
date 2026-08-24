import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { STATIC_TYPES } from "../src/http.ts";

/**
 * **Every file this tree ships has to have a name for what it is.**
 *
 * The static server's type map is hand-rolled and had six entries. Phase 13.5
 * put the front page's screenshot in `packages/web/public/front/` — the first
 * `.webp` this repo has ever served — and it went out as
 * `application/octet-stream`, because an unknown extension falls through to
 * that. It still RENDERED: Chrome sniffs the body of an `<img>` and draws the
 * picture anyway, so the defect was invisible from the browser and visible
 * only in a response header nobody was reading.
 *
 * That is this codebase's oldest recurring failure with a new coat on — the
 * default answer to something the server does not recognise is a cheerful one.
 * The cost lands later and far away: the day anything puts
 * `X-Content-Type-Options: nosniff` on static assets (the blob route and the
 * sign-in refusal already set it, so the habit is in the building), that image
 * stops being drawn, on the first page a stranger sees.
 *
 * So the guard is not "webp is in the map" — that case can only fail once, and
 * it would pass forever afterwards while saying nothing about the next asset
 * type somebody adds. It is the RULE: whatever is in `public/` is named here.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "../../web/public");

/** Every extension under `packages/web/public/`, recursively. */
function extensionsUnder(dir: string): Set<string> {
  const found = new Set<string>();
  const walk = (at: string) => {
    for (const entry of readdirSync(at)) {
      const full = path.join(at, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      const ext = path.extname(entry).toLowerCase();
      // A file with no extension has nothing to look up and would fall through
      // for a different reason; none exist today and one would be its own bug.
      if (ext !== "") found.add(ext);
    }
  };
  walk(dir);
  return found;
}

describe("what the static server calls the files it serves", () => {
  it("names every extension shipped in packages/web/public", () => {
    const shipped = [...extensionsUnder(publicDir)].sort();
    // The fixture is the tree, deliberately: this must fail when somebody adds
    // an `.avif`, a `.woff2` or a `.jpg` and not before.
    expect(shipped.length).toBeGreaterThan(0);
    const unnamed = shipped.filter((ext) => !(ext in STATIC_TYPES));
    expect(unnamed).toEqual([]);
  });

  it("calls the front page's screenshot an image, not a stream of bytes", () => {
    // The specific regression, named, because it is the one that shipped. The
    // rule above is what generalises it; this is what it cost.
    expect(STATIC_TYPES[".webp"]).toBe("image/webp");
  });

  it("never maps anything to the fallback, which is what falling through means", () => {
    // A type spelled `application/octet-stream` ON PURPOSE would be
    // indistinguishable from an extension nobody added, and the rule above
    // would then pass for a file that is still served as a stream of bytes.
    expect(Object.values(STATIC_TYPES)).not.toContain("application/octet-stream");
  });
});
