/**
 * **Which of these bytes do you hold?** — the blob HEAD, asked for many
 * hashes in one round trip.
 *
 * The replica's blob keeper asks this of each canvas's home every ten
 * minutes. Asked one HEAD per blob, a laptop replicating a few isocan.io
 * canvases sent ~2,550 requests a sweep at a door that meters by address; one
 * POST per `BLOBS_PRESENT_LIMIT` hashes is the same question at a handful.
 *
 * **A POST that reads, and the door treats it as one**: a hash list does not
 * fit in a URL, and the same hook that refuses every non-GET below `edit`
 * exempts this path, so a view-only member may ask it exactly as it may send
 * the HEAD. A home older than this route answers `unknown-route`, and the
 * asker falls back to the HEAD per blob — laptops meet older homes.
 */
export declare const BLOBS_PRESENT_ROUTE = "/api/projects/:id/blobs/present";
/** `BLOBS_PRESENT_ROUTE` for one canvas, spelled once so the asker and the
 *  route cannot drift apart. */
export declare const blobsPresentRoute: (canvasId: string) => string;
/** Hashes one ask may carry — ~65 bytes each, so a call stays well under any
 *  body limit, and a canvas of 2,600 blobs is three calls. */
export declare const BLOBS_PRESENT_LIMIT = 1000;
/** The body of a `BLOBS_PRESENT_ROUTE` ask: the hashes, and nothing else,
 *  because the question is the same for every one of them. */
export interface BlobsPresentRequest {
    /** Content hashes (sha256 hex) to ask about. */
    hashes: string[];
}
/** The answer: the complement of what the home holds, rather than the list
 *  held, because in steady state it is empty. */
export interface BlobsPresentResponse {
    /** The asked hashes this home does not hold — every other one it does. */
    missing: string[];
}
