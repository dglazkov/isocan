/** Actual shared writers in a separate process; the preload owns IPC barriers. */
import { adoptIdentity, writeBadge } from "../src/badge-store.ts";
import { writeIdentity } from "../../api/src/identity.ts";
const [home, input] = process.argv.slice(2);
const action = JSON.parse(input);
try {
  const result = action.kind === "badge"
    ? await writeBadge(home, action.base, action.badge)
    : action.kind === "adopt"
      ? await adoptIdentity(home, action.actor)
      : await writeIdentity(home, action.name, action.fresh);
  process.send?.({ type: "result", result });
} catch (error) {
  process.send?.({ type: "error", message: error.message });
  process.exitCode = 1;
} finally {
  process.disconnect?.();
}
