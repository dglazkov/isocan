import { mindmapCli } from "@isocan/mindmap/cli";
import { mermaidCli } from "@isocan/mermaid/cli";
import type { CliModule } from "./modulehost.ts";

/**
 * **The modules this build of the CLI carries** — the twin of
 * `packages/web/src/modules.ts`, and the other half of the coupling. A module
 * in one list and not the other is the web-only (or terminal-only) feature
 * AGENTS.md forbids, and `test/modules.test.ts` says so.
 */
export const CLI_MODULES: readonly CliModule[] = [mindmapCli, mermaidCli];
