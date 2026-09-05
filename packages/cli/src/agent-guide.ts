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

/**
 * The base guide, then a section per loaded module
 * (`docs/projects/modules/design.md`): a module's verbs are described only
 * while the module is here to answer them, which is `surface.test.ts`'s rule
 * — a verb nobody is told about does not exist — with its pleasant inverse.
 */
export const agentGuide = (moduleSections: readonly string[] = []): string =>
  [readFileSync(agentGuidePath(), "utf8"), ...moduleSections.map((s) => s.trim())].join("\n\n") + "\n";
