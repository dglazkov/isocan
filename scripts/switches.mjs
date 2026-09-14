/**
 * **The anti-skip switches, written down once.**
 *
 * Three suites in this repository can decide at runtime that they cannot run:
 * the cloud suites without a Firestore emulator, the bundle budget without a
 * built `packages/web/dist`, and — since the deep lane — the thirty-five files
 * that spawn the CLI per case. Each one skips *loudly*, naming what it did not
 * check, because a contributor on a laptop without Java should still get a
 * useful run. Each one also has a variable that turns that skip into a
 * failure, and CI sets all three: a green run on the commit that decides a
 * release must not be a run that quietly left a third of the gate out.
 *
 * That decision — which switches CI sets, and why — used to live in the `env:`
 * block of `.github/workflows/release.yml` and, copied word for word, in
 * `pr.yml`. Two copies of a list is a list that drifts, and the drift is
 * invisible: pull requests stay green while `main` goes red, which is the
 * exact failure `.github/actions/suite-setup` was extracted to prevent one
 * step earlier in the same job.
 *
 * So the list lives here, `scripts/test-ci.mjs` is what sets it, and both
 * workflows run `npm run test:ci`. `test/switches.test.ts` fails when a
 * workflow sets one of these by hand again, when a switch here is read by no
 * source file in the repository, or when a variable named `ISOCAN_REQUIRE_*`
 * exists in the tree without an entry below. A switch cannot be added by
 * silence, and it cannot be a wish: `docs/reviews/lessons.md` #13 is about a
 * guard that nothing invoked, and this file is a list of guards.
 */

/**
 * @typedef {object} Switch
 * @property {string} name      The variable a run sets.
 * @property {string} covers    What skips without it, in a phrase.
 * @property {boolean} onCI     Whether the release and pull-request runs set it.
 * @property {string} why       Why, in a sentence — the thing the workflows used to each carry a copy of.
 * @property {string} locally   What a person on a laptop types to run that suite for real.
 */

/** @type {readonly Switch[]} */
export const SWITCHES = [
  {
    name: "ISOCAN_REQUIRE_EMULATOR",
    covers: "the Firestore-backed cloud suites",
    onCI: true,
    why:
      "Locally the cloud suites skip and say in their own titles what they did not check, because " +
      "the emulator needs a 21+ JRE and most machines have whatever Java they have. A green CI run " +
      "that skipped Firestore launders an unknown into a checkmark, and this is the run that decides " +
      "what gets released.",
    locally: "FIRESTORE_EMULATOR_HOST=127.0.0.1:19099 ISOCAN_REQUIRE_EMULATOR=1 npm test",
  },
  {
    name: "ISOCAN_REQUIRE_DEEP",
    covers: "the deep lane — the CLI walks and the board, a third of the CPU",
    onCI: true,
    why:
      "`npm test` on a laptop leaves the deep lane out so the inner loop is ninety seconds instead of " +
      "four minutes, and says so on the way out. Here it must never be left out: the same argument as " +
      "the emulator switch, and the same failure — a run that skipped the walks reporting a checkmark " +
      "for them.",
    locally: "npm run test:deep",
  },
  {
    name: "ISOCAN_REQUIRE_BUNDLE",
    covers: "the bundle budget, which measures packages/web/dist",
    onCI: true,
    why:
      "The budget builds nothing — it measured 1,093,766 for a tree that produced 725,291 the one time " +
      "it rebuilt from inside a parallel suite — so a missing or stale `dist` is a skip. On CI `npm ci` " +
      "runs `prepare`, which builds; if the budget skips here, that did not happen, and a silent skip " +
      "would let the entry chunk drift again.",
    locally: "npm run build && npm test",
  },
];

/** The switches CI sets, in order. What `npm run test:ci` turns on. */
export const CI_SWITCHES = SWITCHES.filter((s) => s.onCI);

/** The environment `npm run test:ci` adds — every CI switch, set to the "1" each suite reads. */
export function ciEnv() {
  return Object.fromEntries(CI_SWITCHES.map((s) => [s.name, "1"]));
}

/**
 * What this run refuses to skip, said before the suites rather than after.
 * The fast lane prints what it left out; this is the other half of the same
 * sentence, so neither kind of run is read as more or less than it was.
 */
export function enforcedLines() {
  return [
    `nothing in this run may skip: ${CI_SWITCHES.map((s) => s.name).join(", ")}.`,
    ...CI_SWITCHES.map((s) => `  ${s.name}  ${s.covers}`),
  ];
}
