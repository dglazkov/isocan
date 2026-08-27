import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { dirsFile } from "./paths.ts";

/**
 * The bound directory, read-only — the workbench's file tree.
 *
 * This is the one seam where the product touches the REAL disk rather than
 * the canvas, and every rule here comes from the security review that gated
 * it (workbench design doc, "the file tree"):
 *
 * - **Owner-scoped, never canvas-admission.** Every canvas is born with a
 *   link grant; a tree behind the admissions door would hand anyone with the
 *   link a listing of the owner's working directory, `.env` included. The
 *   route gates on loopback + local-home instead (http.ts, where the gate
 *   has the request to look at); this module trusts nothing and jails
 *   everything anyway.
 * - **The listing is not the content.** `readTree` names files; `readBound`
 *   hands bytes to the owner's own browser so a person can ADD a file to the
 *   canvas — the existing, deliberate line between "on my disk" and
 *   "shared". Nothing here writes.
 * - **Dotfiles are not shown, ever** — `.env`, `.git`, `.ssh` are exactly
 *   the files whose distinction is that nobody put them on a canvas — plus a
 *   hard denylist of secret shapes that live outside dot-space, and the
 *   dependency/build directories that are all noise and no project.
 * - **Symlinks are not followed, at all.** A link inside the jail pointing
 *   out of it is the classic escape; skipping links entirely is smaller than
 *   re-realpathing every entry and never wrong for a listing.
 */

export interface TreeEntry {
  /** Relative to the bound root, `/`-joined on every platform. */
  path: string;
  kind: "file" | "dir";
  size: number;
}

export interface TreeRoot {
  root: string;
  entries: TreeEntry[];
  truncated: boolean;
}

/** Names that are secrets by shape, wherever they live. A denylist leaks by
 * omission — the dotfile rule above is the real wall; this catches the known
 * shapes that walk around outside it. */
const SECRET_NAMES = [/\.pem$/i, /\.key$/i, /^id_rsa/i, /^id_ed25519/i, /credential/i, /\.p12$/i];

/** All noise: dependency trees and build output. */
const NOISE_DIRS = new Set(["node_modules", "dist", "build", "out", "coverage", "__pycache__"]);

const MAX_ENTRIES = 2000;

/** May this name appear in a listing at all? */
export function listable(name: string, kind: "file" | "dir"): boolean {
  if (name.startsWith(".")) return false;
  if (kind === "dir" && NOISE_DIRS.has(name)) return false;
  if (kind === "file" && SECRET_NAMES.some((rx) => rx.test(name))) return false;
  return true;
}

/**
 * The directories bound to one canvas, verified against the marker on disk.
 *
 * `dirs.json` is the CLI's discovery cache and can go stale; the marker
 * (`<dir>/.isocan/project.json`) is the binding. A cache row whose marker is
 * missing or names another canvas is silently not a binding — never an
 * error, because a moved directory is ordinary life, not an attack.
 */
export async function boundDirs(home: string, canvasId: string): Promise<string[]> {
  let cache: Record<string, string>;
  try {
    cache = JSON.parse(readFileSync(dirsFile(home), "utf8")) as Record<string, string>;
  } catch {
    return [];
  }
  const dirs: string[] = [];
  for (const [dir, id] of Object.entries(cache)) {
    if (id !== canvasId) continue;
    try {
      const marker = JSON.parse(
        await fs.readFile(path.join(dir, ".isocan", "project.json"), "utf8"),
      ) as { projectId?: string; canvasId?: string };
      if ((marker.canvasId ?? marker.projectId) === canvasId) dirs.push(path.resolve(dir));
    } catch {
      // No marker, no binding.
    }
  }
  return dirs;
}

/** Walk one bound root. Sorted directories-first per level, capped, honest
 * about the cap. */
export async function readTree(root: string): Promise<TreeRoot> {
  const real = await fs.realpath(root);
  const entries: TreeEntry[] = [];
  let truncated = false;

  async function walk(dir: string, rel: string): Promise<void> {
    if (truncated) return;
    let names;
    try {
      names = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory: absent, not an error
    }
    const sorted = names.sort((a, b) =>
      a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1,
    );
    for (const entry of sorted) {
      if (entry.isSymbolicLink()) continue;
      const kind = entry.isDirectory() ? "dir" : entry.isFile() ? "file" : null;
      if (!kind || !listable(entry.name, kind)) continue;
      if (entries.length >= MAX_ENTRIES) {
        truncated = true;
        return;
      }
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (kind === "dir") {
        entries.push({ path: childRel, kind, size: 0 });
        await walk(path.join(dir, entry.name), childRel);
      } else {
        let size = 0;
        try {
          size = (await fs.lstat(path.join(dir, entry.name))).size;
        } catch {
          continue;
        }
        entries.push({ path: childRel, kind, size });
      }
    }
  }

  await walk(real, "");
  return { root: real, entries, truncated };
}

/** How much file the read route will hand over. The add path renders on a
 * canvas; nobody is adding a database dump by click. */
export const MAX_READ_BYTES = 20 * 1024 * 1024;

/**
 * One bound file's bytes, for the owner's own browser — the read half of
 * add-to-canvas. Every refusal is null: the caller turns it into one honest
 * 404, because which rule refused is exactly what a probe would love to
 * learn.
 */
export async function readBound(root: string, rel: string): Promise<Buffer | null> {
  const real = await fs.realpath(root);
  const normal = path.normalize(rel);
  if (path.isAbsolute(normal) || normal.startsWith("..")) return null;
  // Every segment must be listable — a dotfile is hidden from the listing,
  // so it must be unreachable by name too, or the listing is a curtain.
  const segments = normal.split(path.sep);
  for (let i = 0; i < segments.length; i++) {
    const kind = i === segments.length - 1 ? "file" : "dir";
    if (!listable(segments[i]!, kind)) return null;
  }
  const target = path.join(real, normal);
  // Deliberately REDUNDANT on POSIX: normalize has already resolved every
  // `..` and the refusal above caught any that remained, so no probe can
  // reach this line escaping. It stands as the belt for path semantics this
  // code has not met yet (Windows drives, future refactors of the checks
  // above) — a jail keeps a wall it cannot currently be pushed through.
  if (!(target === real || target.startsWith(real + path.sep))) return null;
  try {
    // lstat is the load-bearing choice: it does NOT follow links, so a
    // symlink is simply not a file and falls out here — no separate link
    // check to forget.
    const stat = await fs.lstat(target);
    if (!stat.isFile()) return null;
    if (stat.size > MAX_READ_BYTES) return null;
    return await fs.readFile(target);
  } catch {
    return null;
  }
}

/**
 * **Directories you could bind, one level at a time** — what the app's
 * picker walks (`docs/research/2026-08-26-attaching-a-directory.md`).
 *
 * This is deliberately THINNER than everything above it, because it is
 * deliberately WIDER: `readTree` lists inside a directory somebody already
 * bound, and this lists directories nobody has bound to anything. That is the
 * first enumeration surface this daemon has ever had, so it is cut to the
 * bone — names of DIRECTORIES only, one level, never file names, never bytes,
 * never a recursive walk that would turn a picker into a map of the disk.
 *
 * The jail is the same shape as `readBound`'s and it holds the same way:
 * every path is resolved and checked against `$HOME`, `..` cannot leave
 * because the check is on the RESOLVED path rather than on the spelling, and
 * symlinks are not followed at all (`lstat`, not `stat`) — a link inside the
 * jail pointing out of it is the classic escape.
 *
 * `$HOME` is the ceiling. Above it lies every other account on the machine
 * and the system itself, and nothing up there is a project.
 */
export interface PickEntry {
  name: string;
  /** Absolute, so the app can hand it straight back to the bind route. */
  path: string;
  /** Already bound to some canvas — the picker says so rather than letting
   *  somebody pick it and meet a refusal. */
  bound: boolean;
}

export interface PickListing {
  /** The directory being listed, absolute and resolved. */
  dir: string;
  /** Its parent, or null at `$HOME` — the ceiling, so there is no way up
   *  past it and the app can hide the affordance rather than offer a step
   *  that will be refused. */
  up: string | null;
  entries: PickEntry[];
}

const MAX_PICK_ENTRIES = 400;

export async function pickList(home: string, at: string | null): Promise<PickListing | null> {
  const os = await import("node:os");
  const ceiling = await fs.realpath(os.homedir()).catch(() => os.homedir());
  const wanted = at ? path.resolve(at) : ceiling;
  const real = await fs.realpath(wanted).catch(() => null);
  // Not there, or a symlink we will not chase: the same answer either way.
  if (real === null) return null;
  // Inside `$HOME` or `$HOME` itself, checked on the RESOLVED path so `..`
  // and a symlink spelling cannot walk out.
  if (real !== ceiling && !real.startsWith(ceiling + path.sep)) return null;
  const stat = await fs.lstat(real).catch(() => null);
  if (!stat?.isDirectory()) return null;

  let bound: Record<string, string> = {};
  try {
    bound = JSON.parse(readFileSync(dirsFile(home), "utf8")) as Record<string, string>;
  } catch {
    // No roster yet: nothing is bound, which is a listing, not an error.
  }

  const entries: PickEntry[] = [];
  for (const entry of await fs.readdir(real, { withFileTypes: true }).catch(() => [])) {
    // Directories only, and `isDirectory` on a Dirent is `lstat`-shaped —
    // a symlink reports as a link, not as what it points at.
    if (!entry.isDirectory()) continue;
    if (!listable(entry.name, "dir")) continue;
    const full = path.join(real, entry.name);
    entries.push({ name: entry.name, path: full, bound: bound[full] !== undefined });
    if (entries.length >= MAX_PICK_ENTRIES) break;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return { dir: real, up: real === ceiling ? null : path.dirname(real), entries };
}

/**
 * **Writing an item out** — the other direction, and the first time this
 * module does anything but read (`docs/projects/workbench/files-on-disk.md`).
 *
 * This file opens with "Nothing here writes." That stops being true, so the
 * rules get stricter rather than looser: a bad READ leaks a listing, a bad
 * WRITE destroys somebody's work. Every rule above still applies — the path
 * is jailed to the root on its RESOLVED form so `..` and a symlink spelling
 * cannot walk out, no segment may be a dotfile or a secret shape, and no
 * segment may be a symlink — plus two this direction needs:
 *
 * - **Parent directories are created only where every segment is listable**,
 *   so a path cannot conjure `.hidden/` on its way to a file.
 * - **Drift is refused, not overwritten**, and the version stack is what
 *   makes that answerable without storing anything. The caller passes every
 *   hash this item has ever held (`ours`); if the file on disk matches one of
 *   them, the canvas wrote it — current, or an older version the disk is
 *   simply behind — and updating it is safe. If it matches NONE of them,
 *   somebody edited it outside the canvas, and a silent overwrite would eat
 *   their work. No "last written" bookkeeping, no extra per-machine state:
 *   the stack already is the record of everything this item has been.
 *
 * Every refusal is a `WriteRefusal` rather than a throw, because the caller
 * has to tell a person which rule stopped them.
 */
export type WriteRefusal =
  | "outside-root"
  | "not-listable"
  | "symlink"
  | "drifted"
  | "unwritable";

export interface WriteResult {
  ok: boolean;
  refusal?: WriteRefusal;
  /** What was actually on disk when we looked — for the drift message. */
  found?: string | null;
}

/**
 * Write `bytes` to `<root>/<rel>`, refusing anything the jail forbids.
 *
 * `hashOf` computes a content hash the same way the store does, so "does the
 * disk match the canvas" is one comparison rather than two conventions.
 */
export async function writeBound(
  root: string,
  rel: string,
  bytes: Buffer,
  ours: readonly string[],
  hashOf: (bytes: Buffer) => string,
): Promise<WriteResult> {
  const normalized = path.normalize(rel);
  // `normalize("")` and `normalize(".")` are both "." — the root itself,
  // which is not a file. Named here rather than left to the dotfile rule
  // below, which would refuse it for the wrong reason and say so.
  if (normalized === "." || path.isAbsolute(normalized) || normalized.split(path.sep).includes("..")) {
    return { ok: false, refusal: "outside-root" };
  }
  const segments = normalized.split(path.sep).filter(Boolean);
  if (segments.length === 0) return { ok: false, refusal: "outside-root" };
  // Every segment on the way, by the same rule that decides what may be SEEN.
  for (const [index, segment] of segments.entries()) {
    if (!listable(segment, index === segments.length - 1 ? "file" : "dir")) {
      return { ok: false, refusal: "not-listable" };
    }
  }
  const full = path.join(root, normalized);
  // The redundant belt `readBound` keeps, for the same reason: `normalize`
  // and the `..` check above should make this unreachable, and a jail with
  // one lock is a jail with one bug.
  if (!full.startsWith(root + path.sep)) return { ok: false, refusal: "outside-root" };

  // No segment may be a symlink — the classic escape, checked with `lstat`
  // so a link reports as a link rather than as what it points at. Walked
  // from the root down, because a link anywhere on the way is the escape.
  let walked = root;
  for (const segment of segments.slice(0, -1)) {
    walked = path.join(walked, segment);
    const stat = await fs.lstat(walked).catch(() => null);
    if (stat === null) continue; // does not exist yet: it will be created
    if (stat.isSymbolicLink()) return { ok: false, refusal: "symlink" };
    if (!stat.isDirectory()) return { ok: false, refusal: "unwritable" };
  }
  const existing = await fs.lstat(full).catch(() => null);
  if (existing?.isSymbolicLink()) return { ok: false, refusal: "symlink" };
  if (existing && !existing.isFile()) return { ok: false, refusal: "unwritable" };

  // Drift: what is there is not anything this canvas ever wrote.
  const found = existing ? hashOf(await fs.readFile(full)) : null;
  if (found !== null && !ours.includes(found)) {
    return { ok: false, refusal: "drifted", found };
  }

  try {
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
  } catch {
    return { ok: false, refusal: "unwritable" };
  }
  return { ok: true };
}

/** The content hash of a file inside the jail, or null when it is not there —
 * what `backingOf` needs to say whether the disk matches the canvas. */
export async function hashBound(
  root: string,
  rel: string,
  hashOf: (bytes: Buffer) => string,
): Promise<string | null> {
  const bytes = await readBound(root, rel);
  return bytes === null ? null : hashOf(bytes);
}
