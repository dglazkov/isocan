/**
 * Where everything lives, in one place, so the schema is readable without
 * reading the backing.
 *
 * ```
 * canvases/{id}                    the Canvas document + compactedThrough + deleted
 * canvases/{id}/ops/{paddedSeq}    one CREATE-ONLY document per LogEntry
 * canvases/{id}/blobmeta/{hash}    one document per blob — no shared index
 * actors/{paddedSeq}               the registry's PUBLIC face, op docs
 * meta/actors                      registry snapshot { lastSeq, names, colors }
 * commands/{name}                  slash commands (a hosted home has no editor)
 *
 * gs://{bucket}/canvases/{id}/snapshot.json          canvas + trash, derived
 * gs://{bucket}/canvases/{id}/blobs/{hash}.{ext}     the bytes, same addressing as a disk
 * gs://{bucket}/canvases/{id}/oplog-archive.jsonl    what compaction set aside
 * gs://{bucket}/canvases/{id}/ops/{paddedSeq}.json   an entry too big for a document
 * ```
 */

/**
 * Document ids sort LEXICOGRAPHICALLY, so "the op document's id is its seq"
 * is only true if the seq is zero-padded: `ops/9` sorts after `ops/10`
 * otherwise, and any `documentId()` range query is silently wrong. Twelve
 * digits is a trillion ops — comfortably past the point where something else
 * breaks first.
 *
 * The numeric `seq` field is kept BESIDE the id and is what queries actually
 * order by; the padded id exists so that the id itself is the precondition.
 */
export const SEQ_DIGITS = 12;

export function padSeq(seq: number): string {
  return String(seq).padStart(SEQ_DIGITS, "0");
}

export const CANVASES = "canvases";
export const ACTORS = "actors";
export const COMMANDS = "commands";
export const META = "meta";
export const ACTORS_SNAPSHOT = `${META}/actors`;

export const canvasDoc = (id: string) => `${CANVASES}/${id}`;
export const opsCollection = (id: string) => `${CANVASES}/${id}/ops`;
export const blobMetaCollection = (id: string) => `${CANVASES}/${id}/blobmeta`;

export const snapshotKey = (id: string) => `${CANVASES}/${id}/snapshot.json`;
export const blobKey = (id: string, file: string) => `${CANVASES}/${id}/blobs/${file}`;
export const archiveKey = (id: string) => `${CANVASES}/${id}/oplog-archive.jsonl`;
export const opOverflowKey = (id: string, seq: number) =>
  `${CANVASES}/${id}/ops/${padSeq(seq)}.json`;
