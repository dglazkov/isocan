#!/usr/bin/env node
/**
 * `npm run test:ci` — the suite with every anti-skip switch on, which is what
 * `.github/workflows/release.yml` and `pr.yml` both run.
 *
 * There is nothing here but `vitest run` and the environment from
 * `scripts/switches.mjs`. It exists so that the list of switches has one home
 * instead of a copy in each workflow, and so the workflows cannot drift apart
 * the way two hand-kept `env:` blocks do. Adding a switch is an edit to
 * `switches.mjs`; both workflows get it, and `test/switches.test.ts` fails if
 * either goes back to setting one by hand.
 *
 * Arguments pass through, so `npm run test:ci -- packages/cli` works the way
 * `npm test -- packages/cli` does.
 *
 * A person can run this too, but it is not the pre-push command: it needs a
 * 21+ JRE for the emulator and a built `packages/web/dist` for the bundle
 * budget, and without them it FAILS where an ordinary run would skip and say
 * so — which is the whole point of the switches and exactly wrong as a habit
 * to ask of every machine. `npm run test:deep` is the pre-push command;
 * `AGENTS.md` says so. Run this one when your machine can, and the rest of the
 * gate is CI's.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ciEnv, enforcedLines } from "./switches.mjs";

const vitest = fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url));

for (const line of enforcedLines()) console.log(line);
console.log("");

const run = spawnSync(process.execPath, [vitest, "run", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, ...ciEnv() },
});

process.exit(run.status ?? 1);
