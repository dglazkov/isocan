/**
 * Crash-safe write: temp file in the same directory, fsync, rename over the
 * target. Readers see either the old or the new content, never a torn write.
 */
export declare function writeFileAtomic(filePath: string, data: string | Buffer): Promise<void>;
/** Append one line with fsync — the oplog's durability guarantee. */
export declare function appendLineDurable(filePath: string, line: string): Promise<void>;
export declare function readJson<T>(filePath: string): Promise<T | null>;
export declare function readJsonLines<T>(filePath: string): Promise<T[]>;
