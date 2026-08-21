import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The collaboration guide agents read before they act — the protocol behind
 * the commands, as opposed to `--help`, which is the commands themselves.
 *
 * It lives HERE, next to the CLI it describes, and not in the skill (#75).
 * The skill is installed once into a directory and then sits there: an agent
 * following a six-month-old copy is being told about a six-month-old CLI, and
 * nothing in the loop notices. Shipping the guide with the binary makes the
 * two impossible to separate — upgrade the CLI and you have upgraded the
 * instructions. `.agents/skills/isocan-collab/SKILL.md` is now a doorway that
 * says "run `isocan --agent-help`", which is small enough to never rot.
 */
export const agentGuidePath = (): string =>
  fileURLToPath(new URL("./agent-guide.md", import.meta.url));

export const agentGuide = (): string => readFileSync(agentGuidePath(), "utf8");
