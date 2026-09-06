import { mimeFromName } from "@isocan/core";

/**
 * What a dropped file is. **The browser is asked first** and usually right —
 * it gets `image/png` right and `.md` wrong — so core's table is consulted
 * only as a patch, when `file.type` is empty or the browser's own shrug
 * (`application/octet-stream`). See `core/media.ts`: this and the CLI's
 * `mimeFor` are two entry points onto one table, deliberately, because they
 * start from different amounts of knowledge.
 */
export function mimeTypeOf(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  return mimeFromName(file.name) ?? file.type ?? "application/octet-stream";
}
