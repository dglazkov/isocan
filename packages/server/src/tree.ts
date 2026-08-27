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
