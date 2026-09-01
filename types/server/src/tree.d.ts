import type { DirClaim } from "../../core/src/index.js";
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
/** May this name appear in a listing at all? */
export declare function listable(name: string, kind: "file" | "dir"): boolean;
/**
 * The directories bound to one canvas, verified against the marker on disk.
 *
 * `dirs.json` is the CLI's discovery cache and can go stale; the marker
 * (`<dir>/.isocan/project.json`) is the binding. A cache row whose marker is
 * missing or names another canvas is silently not a binding — never an
 * error, because a moved directory is ordinary life, not an attack.
 */
export declare function boundDirs(home: string, canvasId: string): Promise<string[]>;
/** Walk one bound root. Sorted directories-first per level, capped, honest
 * about the cap. */
export declare function readTree(root: string): Promise<TreeRoot>;
/** How much file the read route will hand over. The add path renders on a
 * canvas; nobody is adding a database dump by click. */
export declare const MAX_READ_BYTES: number;
/**
 * One bound file's bytes, for the owner's own browser — the read half of
 * add-to-canvas. Every refusal is null: the caller turns it into one honest
 * 404, because which rule refused is exactly what a probe would love to
 * learn.
 */
export declare function readBound(root: string, rel: string): Promise<Buffer | null>;
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
    /**
     * **WHICH canvas has it**, when anything does.
     *
     * `bound` alone was a dead end that had simply moved: the picker replaced
     * "run this command" with a folder wearing the word `bound` and no way to
     * learn what that meant or what to do about it. The name is the whole
     * answer — a directory claimed by *Acme Board* is a fact somebody can act
     * on, and a directory claimed by THIS canvas is not an obstacle at all
     * (`bindVerdict`, core): it is a clone that already knows what it is.
     *
     * Read from the committed marker first and the machine's roster second,
     * because the marker is the fact that travels. A repo cloned this morning
     * carries its binding and appears in no roster anywhere, which is exactly
     * the case the bare boolean got wrong.
     */
    claim?: DirClaim;
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
export declare function pickList(home: string, at: string | null): Promise<PickListing | null>;
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
export type WriteRefusal = "outside-root" | "not-listable" | "symlink" | "drifted" | "unwritable";
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
export declare function writeBound(root: string, rel: string, bytes: Buffer, ours: readonly string[], hashOf: (bytes: Buffer) => string): Promise<WriteResult>;
/** The content hash of a file inside the jail, or null when it is not there —
 * what `backingOf` needs to say whether the disk matches the canvas. */
export declare function hashBound(root: string, rel: string, hashOf: (bytes: Buffer) => string): Promise<string | null>;
