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
export declare const markerFile: (dir: string) => string;
export declare function readMarker(dir: string): Promise<DirMarker | null>;
/** The nearest binding at or above `cwd`, walking up like `.git` discovery.
 * Stops at the user's home directory: a marker above it could only be an
 * accident, and would claim every canvas on the machine. */
export declare function findBinding(cwd: string, home: string): Promise<DirBinding | null>;
/**
 * Where a NEW marker for `cwd` belongs: the git toplevel when the cwd is in a
 * repo — the canvas is about the project, not the checkout, and a committed
 * marker then resolves identically from every subdirectory and every worktree
 * — otherwise the cwd itself. Null when nowhere is safe to bind (the user's
 * home directory, the filesystem root, the isocan home's own parent).
 */
export declare function bindableRoot(cwd: string, home: string): Promise<string | null>;
/** Write (or rewrite) the marker. Returns the file it wrote, for saying so. */
export declare function writeMarker(root: string, marker: DirMarker): Promise<string>;
export declare function recordDir(home: string, root: string, canvasId: string): Promise<void>;
/** Every directory the roster remembers for a canvas — worktrees and clones
 * are several honest answers, not a conflict. */
export declare function dirsOf(home: string, canvasId: string): Promise<string[]>;
