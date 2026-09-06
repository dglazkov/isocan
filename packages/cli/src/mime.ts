import { defaultSize, mimeFromName } from "@isocan/core";

/**
 * The mime for a filename. Only the extension to go on, so core's table is
 * this function's whole knowledge and `application/octet-stream` is its last
 * resort — see `core/media.ts` for why this and the web's `mimeTypeOf` are two
 * entry points onto one table rather than one function.
 */
export function mimeFor(filename: string): string {
  return mimeFromName(filename) ?? "application/octet-stream";
}

export { defaultSize };
