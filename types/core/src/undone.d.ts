import type { LogEntry } from "./ops.js";
/**
 * **Which ops currently stand, and which a person took back.**
 *
 * `LogEntry.undoneBy` exists on the type, and a client never sees it. It is
 * derived bookkeeping the server keeps in memory (`UndoStacks` in
 * `server/src/undo.ts`) and deliberately never writes into the log file — so
 * anything reading a log over the wire that reaches for `entry.undoneBy` gets
 * `undefined` every time, and a report built on it says "nothing was ever
 * undone" about every canvas in the world.
 *
 * That is the silent-zero shape this repo has a lesson about, and it is why
 * this is a function over `cause` instead: the undo entry itself is in the
 * log, it names what it reversed, and a redo clears it again. The log is
 * sufficient; the field is a convenience that does not travel.
 *
 * This was two copies of four lines before it was one. `chooseRetained` in
 * `server/src/gc.ts` needs exactly this to keep an undo pair-complete across
 * the cut, and `buildCorpus` needs it to say which of an ask's ops a person
 * reversed. Two folds over one fact agree until the day they don't, and then
 * neither can say so.
 *
 * @returns target seq → the seq of the undo that currently reverses it. An
 * entry absent from the map stands.
 */
export declare function undoneSeqs(entries: readonly LogEntry[]): Map<number, number>;
