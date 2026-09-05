import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { CliModule } from "@isocan/cli/modulehost";
import { mermaidModule } from "./core.ts";

/**
 * **The CLI half of a kind that needs no verb.** `isocan add diagram.mmd` is
 * the way in, because the CLI's mime table asks the registry this record is
 * in; `isocan ls --kind diagram` filters by it; `isocan edit` opens the text.
 * Registering the record is the whole job, and the guide section says how
 * the kind is used from the terminal — the rule that a kind nobody is told
 * about does not exist, applied to a kind with no family of its own.
 */
export const mermaidCli: CliModule = {
  core: mermaidModule,
  register: () => {},
  guide: readFileSync(fileURLToPath(new URL("../agent-guide.md", import.meta.url)), "utf8"),
};

export default mermaidCli;
