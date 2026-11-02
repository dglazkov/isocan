/**
 * A module customization hook that writes down every module the process
 * loads, one URL per line, to the file named by `ISOCAN_MODULE_LOG`.
 *
 * It runs on Node's hooks thread, which is why it writes to a file rather
 * than counting in a variable somebody could read: nothing in the main thread
 * can see this module's state. Appending is safe here because the hooks
 * thread is the only writer.
 *
 * See `count-modules.mjs` beside it for what registers it and why the number
 * matters.
 */
import { appendFileSync } from "node:fs";

const log = process.env.ISOCAN_MODULE_LOG;

export async function load(url, context, next) {
  if (log) appendFileSync(log, `${url}\n`);
  return next(url, context);
}
