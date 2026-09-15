import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BENCH_REACH } from "@isocan/core";
import { withoutComments } from "../../../test/source.ts";

/**
 * **Two surfaces, one derivation — the bench's half of it.**
 *
 * `agenttray.test.ts` guards the same thing one level down and says why: the
 * moment a panel works out for itself what a state means, the terminal and the
 * canvas can disagree about the same agent, and the person believes whichever
 * one they are looking at. The bench's whole claim in journey 1 is that *"the
 * same three rows, the same three states, because it is the same derivation"*
 * — so a panel that computed a state of its own would not be a bug in a
 * rendering, it would be the feature not existing.
 *
 * `benchRows()` in `@isocan/core` is that derivation, and it is a fourth
 * caller of `roster()` rather than a fourth implementation of it.
 *
 * **There are two bench panels now** (phase 1): the one under your own face,
 * and the rows with **Join** in the agents panel. So the guard covers the
 * READER they share as well as both panels — a second fetch would drift the
 * same way a second fold would, and the point of `lib/bench.ts` is that there
 * is one of each.
 */
const src = (rel: string) =>
  withoutComments(readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8"));
const reader = src("lib/bench.ts");
const panel = src("components/YourBench.tsx");
const tray = src("components/BenchJoin.tsx");
const cli = withoutComments(
  readFileSync(fileURLToPath(new URL("../../cli/src/bench.ts", import.meta.url)), "utf8"),
);

describe("Your bench shows what the terminal would print", () => {
  it("asks core for the rows, and for the words under each", () => {
    expect(reader).toMatch(/benchRows\(/);
    expect(reader).toMatch(/benchAgents\(/);
    expect(panel).toMatch(/benchWords\(row\)/);
    // The CLI reads the same one. Two callers of one function is the whole
    // design; two functions that agree today is the drift it prevents.
    expect(cli).toMatch(/benchRows\(/);
    expect(cli).toMatch(/benchWords\(/);
  });

  it("reads the bench once, for both panels", () => {
    // Neither panel fetches: they call the reader. A panel that grew its own
    // `personalStatus` walk would be the second derivation by another route.
    for (const [name, source] of [["YourBench", panel], ["BenchJoin", tray]] as const) {
      expect(source, `${name} must read through useBench`).toMatch(/useBench\(/);
      expect(source, `${name} must not fetch the bench itself`).not.toMatch(/personalStatus\(/);
      expect(source).not.toMatch(/benchRows\(/);
    }
  });

  it("computes no state of its own — not the three words, not the fold beneath them", () => {
    /**
     * A panel may name `row.reach` (it puts it on a class) and must never
     * SPELL one of its values: a literal here is a branch, and a branch here
     * is a second derivation waiting to disagree with `isocan bench`.
     */
    for (const [name, source] of [
      ["YourBench", panel],
      ["BenchJoin", tray],
      ["the reader", reader],
    ] as const) {
      for (const state of BENCH_REACH) {
        expect(source, `${name} must not decide what "${state}" means`).not.toContain(`"${state}"`);
        expect(source).not.toContain(`'${state}'`);
      }
      // And it must not reach past `benchRows` to the fold underneath: the
      // roster and the session state are core's business, asked once.
      expect(source).not.toMatch(/\broster\(/);
      expect(source).not.toMatch(/sessionState\(/);
    }
  });

  it("passes what it can measure and claims nothing it cannot", () => {
    // The connection-bound holds are what a browser CAN see, and without them
    // every standing row reads `enrolled` and no bench row could ever be
    // ready — the exact bug `answerable.ts` exists to have fixed once.
    expect(reader).toMatch(/fetchRcAnswering\(/);
    expect(reader).toMatch(/answerable: new Set\(/);
    // The machine-local running half is not readable from a tab, so it is
    // passed empty rather than guessed at. `benchRows` is still the one that
    // decides what an empty set means.
    expect(reader).toMatch(/new Set<string>\(\)/);
  });

  it("hangs off the identity menu, which is where a person's own things live", () => {
    const menu = src("components/IdentityMenu.tsx");
    expect(menu).toMatch(/import \{ YourBench \}/);
    expect(menu).toContain("Your bench…");
    // No canvas in the condition: a bench belongs to a person, and the two
    // dialogs above it that DO need one say so (`terminal && canvasId`).
    expect(menu).toMatch(/if \(bench\) return <YourBench actor=\{actor\} onClose=\{onClose\} \/>;/);
  });
});

/**
 * **Journey 2's gesture, where the journey puts it.**
 *
 * The placement is the feature: *above* **Add an agent…**, because the two
 * are different acts and the panel has to say so. Naming an agent you already
 * own asks nothing of any machine; introducing a stranger asks the rc to
 * claim an actor, which is why that one is gated on a parked rc and this one
 * is not. A Join that inherited "no rc, no button" would be journey 2 not
 * built.
 */
describe("Join, on each bench row in the agents panel", () => {
  const agentTray = src("components/AgentTray.tsx");

  it("sits above Add an agent…", () => {
    expect(agentTray).toMatch(/<BenchJoin /);
    expect(agentTray.indexOf("<BenchJoin ")).toBeLessThan(agentTray.indexOf("<AddAgent "));
  });

  it("is not gated on a parked rc — that gate is for strangers", () => {
    expect(tray).not.toMatch(/useRcParked\(/);
    expect(tray).not.toMatch(/useRcOwners\(/);
  });

  it("sends one op, and it is the one that carries the bench", () => {
    expect(tray).toMatch(/type: "agent\.invite"/);
    expect(tray).toMatch(/from: benchCanvasId/);
    // Not enroll, and nothing about rules: joining may not widen who summons.
    expect(tray).not.toContain('"agent.enroll"');
    expect(tray).not.toMatch(/\brules\b/);
    expect(tray).not.toMatch(/listen/);
  });

  it("says whether anything could answer, before the click", () => {
    // Journey 2's refusal that matters: Join still succeeds when the agent's
    // machine is not present, and the row says so in journey 1's words
    // rather than the click failing quietly afterwards.
    expect(tray).toMatch(/benchWords\(row\)/);
  });
});

/**
 * **The bench is not in the first download.**
 *
 * It was, for a day: `AgentTray` is on the canvas page and imported
 * `BenchJoin` directly, so every first visit fetched the bench reader and
 * core's `bench.ts` — 27,400 bytes — whether or not anybody ever opened a
 * panel. `test/bundle-budget.test.ts` caught it, and that test can only ever
 * say *the number moved*; this one says WHY it must not move back, in the
 * shape somebody is about to break.
 *
 * The invariant is one sentence: **nothing reaches `lib/bench.ts` except
 * behind a lazy boundary.** Two components read it, and each is already
 * behind one — `YourBench` through `CanvasCrumb`'s lazy identity menu,
 * `BenchJoin` through the tray's own `lazy()`. A third importer, or a direct
 * import of either component from an eager file, puts it all back in the
 * entry chunk, and the budget would notice a fortnight later as an
 * unattributable jump.
 */
describe("the bench is behind a lazy boundary", () => {
  const webSrc = fileURLToPath(new URL("../src", import.meta.url));

  /** Every source file under `packages/web/src`, with its prose removed. */
  const sources = (): Array<[string, string]> =>
    readdirSync(webSrc, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
      .map((entry) => {
        const full = path.join(entry.parentPath ?? entry.path, entry.name);
        return [path.relative(webSrc, full), withoutComments(readFileSync(full, "utf8"))] as const;
      })
      .map(([rel, text]) => [rel, text] as [string, string]);

  /**
   * Both ways in, because there are two now. A static `import … from` puts
   * the reader in whatever chunk the importer lands in; a dynamic `import()`
   * makes its own. The regex covers both deliberately — the composer's
   * roster (phase 2) reaches the reader the second way, and a guard that only
   * knew about the first would have said nothing about it either way.
   */
  const READS_IT = /(?:from|import\()\s*"\.{1,2}\/(?:\.\.\/)*(?:lib\/)?bench\.ts"/;

  it("only the three readers read it, and nothing else imports the panels eagerly", () => {
    const readers = sources()
      .filter(([, text]) => READS_IT.test(text))
      .map(([rel]) => rel)
      .sort();
    expect(
      readers,
      "a fourth reader of lib/bench.ts is a fourth door into the entry chunk — put it behind a lazy boundary and add it here",
    ).toEqual(["components/BenchJoin.tsx", "components/YourBench.tsx", "lib/benchmentions.ts"]);

    /**
     * And who imports the two panels with a plain `import`, which is what
     * puts them in whatever chunk the importer lands in.
     *
     * `IdentityMenu` is allowed to, and is the reason this is a named list
     * rather than a flat ban: the menu is itself lazy (the case below pins
     * that), so an ordinary import inside it lands in the menu's own chunk
     * and never in the entry. Anything else on this list is a file that has
     * to prove the same thing about itself.
     */
    const eager = sources()
      .filter(([rel]) => rel !== "components/BenchJoin.tsx" && rel !== "components/YourBench.tsx")
      .filter(([, text]) => /import \{ (BenchJoin|YourBench) \}/.test(text))
      .map(([rel]) => rel)
      .sort();
    expect(
      eager,
      "imported without lazy() — it belongs behind a boundary, or this file has to show it is already behind one",
    ).toEqual(["components/IdentityMenu.tsx"]);
  });

  it("the identity menu that imports YourBench is itself lazy", () => {
    // The allowance above is only honest while this holds: the menu hangs off
    // the crumb, and the crumb fetches it on demand.
    expect(src("components/CanvasCrumb.tsx")).toMatch(
      /const IdentityMenu = lazy\(\(\) => import\("\.\/IdentityMenu\.tsx"\)/,
    );
  });

  /**
   * **The composer's roster is the one reader that is NOT behind a lazy
   * component**, because the Chat is on the canvas page and its composer is
   * eager. So the boundary is inside the module instead: the hook is a dozen
   * lines of `useState` and `useEffect`, and the fetch it runs is an
   * `import()`. A plain import here would put the bench reader, `benchRows`
   * and `roster()` into the chunk every first visit downloads — which is the
   * accident the whole describe block above was written after.
   */
  it("the composer's bench roster reaches it only through import()", () => {
    const roster = src("lib/benchmentions.ts");
    expect(roster).toMatch(/await import\("\.\/bench\.ts"\)/);
    expect(roster, "a static import puts the bench in the entry chunk").not.toMatch(
      /from "\.\/bench\.ts"/,
    );
    // And it computes no reachability of its own — `readBenchAgents` reads
    // the record, and nothing on this path spells one of the three states.
    for (const state of BENCH_REACH) {
      expect(roster).not.toContain(`"${state}"`);
    }
    expect(roster).not.toMatch(/benchRows\(/);
  });

  it("the tray loads it with lazy() and renders it inside Suspense", () => {
    const agentTray = src("components/AgentTray.tsx");
    expect(agentTray).toMatch(/const BenchJoin = lazy\(\(\) => import\("\.\/BenchJoin\.tsx"\)/);
    expect(agentTray).toMatch(/<Suspense fallback=\{null\}>\s*<BenchJoin /);
  });
});
