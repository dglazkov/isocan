/**
 * **Is round 1's P worth routing on? — the reading** (judge phase 2).
 *
 *   node --import tsx packages/modules/judge/scripts/calibrate.ts --rows ~/judge-corpus [--page <file>] [--day YYYY-MM-DD] [--seed 1] [--force]
 *   node --import tsx packages/modules/judge/scripts/calibrate.ts --dry [--page <file>]
 *
 * `--rows` is the directory `isocan judge corpus --out` wrote (its
 * `labelled.json`, or `shape.json` when that is all there is), or either file.
 * The page goes to `docs/calibration/<day>-need.md` beside the 4 September
 * reading unless `--page` says elsewhere, and an existing page is not
 * overwritten without `--force`.
 *
 * `--dry` reads the committed synthetic fixture instead and writes the page
 * either way — to `--page`, or to stdout — so the harness is shown to write
 * a page before anybody's rows exist. A dry page is never a record: it is
 * refused anywhere under `docs/calibration/`.
 *
 * No judge is called. The probabilities were recorded when each flow ran;
 * the reading is those numbers against what the person then did
 * (`src/reading.ts`). Nothing is written to any canvas, and the page carries
 * counts, rates and model ids — the rows' requests, titles and canvases are
 * dropped the moment the file is parsed (`rowsOf`).
 *
 * A script rather than an `isocan judge` verb: the act is writing a dated
 * page into this repository's `docs/`, on the machine that holds the
 * person's rows, and an installed CLI has neither the repository nor any
 * business reading a person's labels for an agent.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readingOf, renderPage, rowsOf } from "../src/reading.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(here, "../../../..");
export const FIXTURE = path.resolve(here, "../test/fixtures/corpus-shape.json");
export const CALIBRATION_DIR = path.join(REPO, "docs/calibration");

const USAGE = "usage: calibrate.ts (--rows <dir|labelled.json|shape.json> | --dry) [--page <file>] [--day YYYY-MM-DD] [--seed N] [--force]";

function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const inside = (file: string, dir: string) => {
  const rel = path.relative(dir, file);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};

/** The file `--rows` names: a file as given, or the directory's labelled.json (model ids and all), else its shape.json. */
export function rowsFile(rows: string): string {
  const at = path.resolve(rows);
  if (!existsSync(at)) throw new Error(`--rows ${at}: nothing there`);
  if (!statSync(at).isDirectory()) return at;
  for (const name of ["labelled.json", "shape.json"]) if (existsSync(path.join(at, name))) return path.join(at, name);
  throw new Error(`--rows ${at}: neither labelled.json nor shape.json — run \`isocan judge corpus --out ${rows}\` first`);
}

export interface RunResult {
  page: string;
  /** Where the page was written, or undefined when it went to stdout. */
  wrote?: string;
}

/** The harness, argv in and a page out — `main` is this and a print. */
export function run(argv: readonly string[]): RunResult {
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    if (i < 0) return undefined;
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`${name} needs a value\n${USAGE}`);
    return v;
  };
  const dry = argv.includes("--dry");
  const rows = flag("--rows");
  const pageFlag = flag("--page");
  const day = flag("--day") ?? today();
  const seed = Number(flag("--seed") ?? "1");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`--day ${day} is not YYYY-MM-DD`);
  if (!Number.isInteger(seed)) throw new Error(`--seed ${String(seed)} is not an integer`);
  if (dry && rows) throw new Error(`--dry reads the committed fixture — give it no --rows as well\n${USAGE}`);
  if (!dry && !rows) throw new Error(USAGE);

  const file = dry ? FIXTURE : rowsFile(rows!);
  const { rows: parsed, from } = rowsOf(JSON.parse(readFileSync(file, "utf8")) as unknown);
  const reading = readingOf(parsed, { from, seed });
  const page = renderPage(reading, { day, dry, ...(dry ? { source: "`packages/modules/judge/test/fixtures/corpus-shape.json`, the committed synthetic fixture" } : {}) });

  let target: string | undefined;
  if (dry) {
    target = pageFlag === undefined ? undefined : path.resolve(pageFlag);
    if (target && inside(target, CALIBRATION_DIR)) {
      throw new Error(`--dry writes a page made of synthetic rows, and ${CALIBRATION_DIR} holds readings — name a page outside it`);
    }
  } else {
    target = path.resolve(pageFlag ?? path.join(CALIBRATION_DIR, `${day}-need.md`));
    if (existsSync(target) && !argv.includes("--force")) throw new Error(`${target} exists — a reading is a record; --force to replace it, or --page elsewhere`);
  }
  if (target) {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, page);
  }
  return { page, ...(target ? { wrote: target } : {}) };
}

function main(): void {
  const { page, wrote } = run(process.argv.slice(2));
  if (wrote) {
    console.log(page.split("\n")[0]);
    console.log(`wrote ${wrote}`);
  } else {
    process.stdout.write(page);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error((error as Error).message);
    process.exit(2);
  }
}
