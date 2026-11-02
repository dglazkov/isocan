/** Test-only scheduling of the former CLI identity writer. No credentials
 * cross IPC: only the fact that its stale read is ready to be released. */
import { promises as fs } from "node:fs";
import path from "node:path";
import { DaemonRoutes } from "../../api/src/routes.ts";
const redeem = DaemonRoutes.prototype.redeemPass;
let adoptionRead = false;
DaemonRoutes.prototype.redeemPass = async function (...args) {
  const answer = await redeem.apply(this, args);
  adoptionRead = Boolean(answer.actor && !answer.identity);
  return answer;
};
const read = fs.readFile.bind(fs);
fs.readFile = async (...args) => {
  const raw = await read(...args);
  if (adoptionRead && String(args[0]) === path.join(process.env.ISOCAN_HOME, "identity.json")) {
    adoptionRead = false;
    process.send?.({ type: "adoption-read" });
    await new Promise((resolve) => process.once("message", resolve));
  }
  return raw;
};
