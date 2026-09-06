/**
 * A size, said the way a person would.
 *
 * Beside `elapsed.ts`, and for the same reason: the terminal and the browser
 * both have to say how much space something takes, and two answers to one
 * question is one answer and a bug.
 *
 * **It is here because the copies had already drifted**, which is a better
 * argument than "they might". On 6 September 2026 the two were:
 *
 * | | units |
 * | --- | --- |
 * | `cli/src/output.ts` | KB MB GB **TB** |
 * | `web/components/TrashPanel.tsx` | KB MB GB |
 *
 * So a two-terabyte trash total printed `2.0 TB` in the terminal and
 * `2048.0 GB` in the browser — house rule 4's prediction, sitting in the tree,
 * found by an architecture review rather than by anybody noticing. The
 * terminal's version is the one that came here; the browser's was the one that
 * had fallen behind.
 *
 * **Binary units, and the labels are the everyday ones.** 1024 rather than
 * 1000 because these are file and blob sizes on a disk, and `KB` rather than
 * `KiB` because that is what the rest of the interface says and correctness
 * about a label nobody uses is not correctness.
 */

/** Where the value stops being fractional. `2.0 TB` reads as a measurement;
 * `2048.0 GB` reads as a bug, and `847.3 MB` is more precision than anyone
 * asked for — so three digits and up loses the decimal. */
const WHOLE_AT = 100;

const UNITS = ["KB", "MB", "GB", "TB"] as const;

/**
 * `"512 B"`, `"1.5 KB"`, `"847 MB"`, `"2.0 TB"`.
 *
 * Bytes below a kilobyte are whole and unsuffixed by a decimal: nobody wants
 * `0.5 KB` for 512 bytes.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes;
  let unit: string = "B";
  for (const next of UNITS) {
    if (value < 1024) break;
    value /= 1024;
    unit = next;
  }
  return `${value.toFixed(value >= WHOLE_AT ? 0 : 1)} ${unit}`;
}
