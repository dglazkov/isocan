import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as paths from "./paths.ts";

/**
 * A directory and its canvas (#60).
 *
 * The binding is a marker file — `<root>/.isocan/project.json` — holding the
 * canvas id and nothing else that matters. Identity, not state: the oplog,
 * blobs and snapshots stay in the isocan home, so committing the marker costs
 * a repo one tiny file and buys the future — a clone arrives already knowing
 * WHICH canvas this directory is, and a canvas id shared through git is
 * what lets two homes (or, later, a hosted store) agree they are working on
 * the same canvas. Resolution walks up from the cwd like `.git` discovery
 * does, so the binding holds anywhere in the tree and the nearest marker
 * wins — a monorepo package with its own canvas shadows the repo's.
 *
 * This is deliberately NOT an identity slot. A directory cannot tell one
 * agent from another (#56), which is why the marker names a canvas and never
 * a person.
 */

export interface DirMarker {
  /**
   * **On disk this field is spelled `projectId`, deliberately** (phase 13.5's
   * rename). The marker is COMMITTED INTO PEOPLE'S REPOS: every one already in
   * the wild spells it the old way, and a clone that suddenly stopped resolving
   * would be the worst kind of breakage — silent, and in somebody else's
   * checkout. `readMarker` accepts either spelling and `writeMarker` keeps
   * writing the old one, so the code says canvas and the file stays readable by
   * every isocan there has ever been.
   */
  canvasId: string;
  /** A hint for materializing the canvas in a home that has never seen it
   * (a fresh clone): the id is the identity, the title is a good first
   * guess. */
  title?: string;
  /**
   * The canvas's home — the address it lives at.
   *
   * **Birth writes a promise, not a fact** (offline-birth.md): the marker
   * carries id AND address from the first minute, committed with the marker,
   * whether or not the home has heard of the canvas yet. Nothing about the
   * marker's shape reveals the difference, which is the point — a clone, a
   * script, an agent reading it behaves identically either way, and a canvas
   * born on a plane adopts its home later without the file changing.
   *
   * Optional forever, and that is not laxity: every marker in the wild today
   * lacks it, and a daemon with no home configured writes markers that go on
   * lacking it, because a canvas that lives on one laptop has no address to
   * name. Absent means "wherever the daemon reading this lives".
   */
  home?: string;
}

export interface DirBinding extends DirMarker {
  /** The directory holding the marker. */
  root: string;
}

export const markerFile = (dir: string) => path.join(dir, ".isocan", "project.json");

function parseMarker(raw: unknown): DirMarker | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as MarkerFile;
  // `projectId` is what is on disk; `canvasId` is accepted so a marker written
  // by a future isocan that drops the old spelling still resolves.
  const canvasId = obj.projectId ?? obj.canvasId;
  if (typeof canvasId !== "string" || canvasId.length === 0) return null;
  // A `home` that is present but not a usable address is a MALFORMED marker,
  // judged exactly as a malformed `canvasId` is: the whole file is
  // rejected. Not ignored — ignoring it would silently turn "this canvas
  // lives at the address I cannot read" into "this canvas lives wherever you
  // are", which is the one wrong answer, and it would be given quietly. An
  // ABSENT `home` is a different thing entirely and is fine (see DirMarker).
  if (obj.home !== undefined && (typeof obj.home !== "string" || obj.home.trim() === "")) {
    return null;
  }
  return {
    canvasId,
    ...(typeof obj.title === "string" && obj.title ? { title: obj.title } : {}),
    ...(typeof obj.home === "string" ? { home: obj.home.trim() } : {}),
  };
}

async function readBindings(home: string): Promise<Record<string, MarkerFile>> {
  try {
    const raw = JSON.parse(await fs.readFile(paths.bindingsFile(home), "utf8")) as Record<
      string,
      MarkerFile
    >;
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

export async function readMarker(dir: string, home?: string): Promise<DirMarker | null> {
  try {
    const raw = JSON.parse(await fs.readFile(markerFile(dir), "utf8")) as unknown;
    const inTree = parseMarker(raw);
    if (inTree) return inTree;
  } catch {
    // No readable in-tree marker; try the out-of-tree fallback when `home` is given.
  }
  if (!home) return null;
  const real = await canon(dir);
  const outOfTree = await readBindings(await canon(home));
  return parseMarker(outOfTree[real]);
}

/** A directory the marker must never live in: the user's home directory
 * (binding it would bind everything under it) and the directory whose
 * `.isocan` IS the isocan home (the marker would land among the daemon's own
 * files). Same exclusions `retireStrandedIdentities` walks around. */
function excluded(dir: string, isocanHome: string, userHome: string): boolean {
  return dir === userHome || path.dirname(dir) === dir || path.join(dir, ".isocan") === isocanHome;
}

/** Comparable form of a path: symlinks resolved when the target exists.
 * macOS hands out `/var/…` in $HOME and `/private/var/…` from cwd for the
 * same directory — exclusion checks must not be fooled by the spelling. */
const canon = (p: string) => fs.realpath(p).catch(() => path.resolve(p));

/** The nearest binding at or above `cwd`, walking up like `.git` discovery.
 * Stops at the user's home directory: a marker above it could only be an
 * accident, and would claim every canvas on the machine. */
export async function findBinding(cwd: string, home: string): Promise<DirBinding | null> {
  const isocanHome = await canon(home);
  const userHome = await canon(os.homedir());
  const outOfTree = await readBindings(isocanHome);
  let dir = await canon(cwd);
  for (;;) {
    if (!excluded(dir, isocanHome, userHome)) {
      const marker = (await readMarker(dir)) ?? parseMarker(outOfTree[dir]);
      if (marker) return { root: dir, ...marker };
    }
    const parent = path.dirname(dir);
    if (parent === dir || dir === userHome) return null;
    dir = parent;
  }
}

/**
 * Where a NEW marker for `cwd` belongs: the git toplevel when the cwd is in a
 * repo — the canvas is about the project, not the checkout, and a committed
 * marker then resolves identically from every subdirectory and every worktree
 * — otherwise the cwd itself. Null when nowhere is safe to bind (the user's
 * home directory, the filesystem root, the isocan home's own parent).
 */
export async function bindableRoot(cwd: string, home: string): Promise<string | null> {
  const isocanHome = await canon(home);
  const userHome = await canon(os.homedir());
  const start = await canon(cwd);
  let toplevel: string | null = null;
  let dir = start;
  for (;;) {
    // `.git` is a directory in a normal checkout and a FILE in a linked
    // worktree; either one marks the root this checkout answers to.
    if (await fs.stat(path.join(dir, ".git")).then(() => true, () => false)) {
      toplevel = dir;
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir || dir === userHome) break;
    dir = parent;
  }
  for (const candidate of toplevel && toplevel !== start ? [toplevel, start] : [start]) {
    if (!excluded(candidate, isocanHome, userHome)) return candidate;
  }
  return null;
}

/** The marker AS IT IS ON DISK — `projectId`, the committed spelling. */
interface MarkerFile {
  projectId?: string;
  canvasId?: string;
  title?: string;
  home?: string;
}

async function hasVcsMarker(start: string, userHome: string, markerName: string): Promise<boolean> {
  let dir = start;
  for (;;) {
    if (await fs.stat(path.join(dir, markerName)).then(() => true, () => false)) return true;
    const parent = path.dirname(dir);
    if (parent === dir || dir === userHome) return false;
    dir = parent;
  }
}

async function preferOutOfTreeBinding(
  realRoot: string,
  isocanHome: string,
  userHome: string,
  outOfTree: Record<string, MarkerFile>,
): Promise<boolean> {
  if (await fs.stat(markerFile(realRoot)).then(() => true, () => false)) return false;
  if (await hasVcsMarker(realRoot, userHome, ".git")) return false;
  if (realRoot in outOfTree) return true;
  if (process.env.ISOCAN_NON_REPO_BINDINGS === "home") return true;
  try {
    const cfg = JSON.parse(await fs.readFile(paths.configFile(isocanHome), "utf8")) as {
      nonRepoBindings?: string;
    };
    if (cfg?.nonRepoBindings === "home") return true;
  } catch {
    // No readable config.json.
  }
  return (
    (await hasVcsMarker(realRoot, userHome, ".hg")) ||
    (await hasVcsMarker(realRoot, userHome, ".svn"))
  );
}

/** Write (or rewrite) the marker. Returns the file it wrote, for saying so. */
export async function writeMarker(
  root: string,
  marker: DirMarker,
  home?: string,
): Promise<string> {
  // The old spelling goes to disk (see `DirMarker.canvasId`): a marker this
  // build writes has to be readable by every isocan already installed, and by
  // every clone of the repo it is committed into.
  const onDisk: MarkerFile = {
    projectId: marker.canvasId,
    ...(marker.title !== undefined ? { title: marker.title } : {}),
    ...(marker.home !== undefined ? { home: marker.home } : {}),
  };
  if (home) {
    const isocanHome = await canon(home);
    const userHome = await canon(os.homedir());
    const realRoot = await canon(root);
    const outOfTree = await readBindings(isocanHome);
    if (await preferOutOfTreeBinding(realRoot, isocanHome, userHome, outOfTree)) {
      outOfTree[realRoot] = onDisk;
      const file = paths.bindingsFile(isocanHome);
      await fs.mkdir(isocanHome, { recursive: true });
      await fs.writeFile(file, `${JSON.stringify(outOfTree, null, 2)}\n`);
      return file;
    }
  }
  const file = markerFile(root);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(onDisk, null, 2)}\n`);
  return file;
}

/** Remove a directory's binding (in-tree `.isocan/project.json` or out-of-tree
 * `bindings.json` row). Returns the file that held the binding. */
export async function removeMarker(root: string, home?: string): Promise<string> {
  const file = markerFile(root);
  const hadInTree = await fs.stat(file).then(() => true, () => false);
  await fs.rm(file, { force: true }).catch(() => {});
  if (home) {
    const isocanHome = await canon(home);
    const realRoot = await canon(root);
    const outOfTree = await readBindings(isocanHome);
    if (realRoot in outOfTree) {
      delete outOfTree[realRoot];
      const bindings = paths.bindingsFile(isocanHome);
      await fs.mkdir(isocanHome, { recursive: true });
      await fs.writeFile(bindings, `${JSON.stringify(outOfTree, null, 2)}\n`);
      if (!hadInTree) return bindings;
    }
  }
  return file;
}

/* ── The roster: dir → canvasId, cached in the home ─────────────────────
 *
 * The marker is authoritative and lives with the directory; the roster is
 * how the home answers "where does that canvas's directory live" without a
 * crawl. Healed lazily — every command that resolves a binding re-records
 * it — and never trusted over the marker: a row whose directory moved is
 * stale until someone works there again, which is the price of a cache.
 * Several rows may name one canvas (worktrees, clones); that is the truth,
 * not a conflict. Best-effort throughout: a cache must never break a
 * command. */

async function readRoster(home: string): Promise<Record<string, string>> {
  try {
    const raw = JSON.parse(await fs.readFile(paths.dirsFile(home), "utf8")) as Record<
      string,
      string
    >;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export async function recordDir(home: string, root: string, canvasId: string): Promise<void> {
  try {
    // realpath so a directory reached through a symlink lands on one row.
    const real = await fs.realpath(root).catch(() => path.resolve(root));
    const roster = await readRoster(home);
    if (roster[real] === canvasId) return;
    roster[real] = canvasId;
    await fs.mkdir(home, { recursive: true });
    await fs.writeFile(paths.dirsFile(home), `${JSON.stringify(roster, null, 2)}\n`);
  } catch {
    // Cache only.
  }
}

/** Every directory the roster remembers for a canvas — worktrees and clones
 * are several honest answers, not a conflict. */
export async function dirsOf(home: string, canvasId: string): Promise<string[]> {
  const roster = await readRoster(home);
  return Object.entries(roster)
    .filter(([, id]) => id === canvasId)
    .map(([dir]) => dir)
    .sort();
}
