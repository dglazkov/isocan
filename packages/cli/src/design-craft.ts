import type { Command } from "commander";
import { checkDesignCraftDirectory, designRequestPort, exportDesignCraft, inspectDesignCraftPackage, readDesignCraft, resolveCanvas, type DesignCraftStage } from "@isocan/api";
import type { Ctx } from "./ctx.ts";
import { printJson } from "./output.ts";

/** Optional native entry uses the same canonical packet and attributed knowledge as the lazy task view. */
export function registerDesignCraft(design: Command, contextOf: (cmd: Command) => Promise<Ctx>): void {
  design.command("craft <request>")
    .description("Read optional adapted Impeccable guidance around the saved brief; no native playbook execution")
    .option("--stage <stage>", "explicit new-work, critique or finish guidance")
    .option("--out <new-directory>", "export exact permitted context into a new directory; never overwrite")
    .option("--check <directory>", "check the original packet and canonical sources, preserving working edits")
    .option("--package <skill-directory>", "inspect the fixed pinned Codex skill files; never execute or download")
    .addHelpText("after", "\nRead: design craft req_example --stage critique --json\nExport: design craft req_example --stage finish --out /tmp/acme-craft\nCheck: design craft req_example --check /tmp/acme-craft --json\nUse design reconcile /tmp/acme-craft for a deliberate DESIGN.md edit.\nPRODUCT/surface edits remain proposed notes until an explicit brief correction.\nGuidance shares the existing review's two-repair allowance; opening it is not inspection.\n")
    .action(async (requestId: string, options: { stage?: string; out?: string; check?: string; package?: string }, command: Command) => {
      try {
        const ctx = await contextOf(command), canvasId = (await resolveCanvas(ctx)).id;
        if (options.check && (options.stage || options.out)) throw new Error("--check uses the saved stage and original files; omit --stage and --out.");
        if (!options.check && !["new-work", "critique", "finish"].includes(options.stage ?? "")) throw new Error("Choose --stage new-work, critique or finish.");
        const packageSource = options.package ? await inspectDesignCraftPackage(options.package) : null;
        if (options.check) {
          const checked = await checkDesignCraftDirectory(designRequestPort(ctx), { canvasId, requestId, directory: options.check });
          if (ctx.json) printJson({ ...checked, ...(packageSource ? { packageSource } : {}) });
          else console.log(`${checked.status}: ${checked.packetId}\n${checked.reasons.join("\n")}\n${checked.files.map(file => `${file.status}: ${file.path}`).join("\n")}\n${checked.notes}${packageSource ? `\nPackage source: ${packageSource.status}; native ${packageSource.native}` : ""}`);
          if (checked.status !== "current") process.exitCode = 1;
          return;
        }
        const packet = await readDesignCraft(designRequestPort(ctx), { canvasId, requestId, stage: options.stage as DesignCraftStage });
        const exported = options.out ? await exportDesignCraft(options.out, packet) : null;
        if (ctx.json) printJson(exported || packageSource ? { packet, ...(exported ? { exported } : {}), ...(packageSource ? { packageSource } : {}) } : packet);
        else {
          const guidance = packet.files.find(file => file.path === "GUIDANCE.md")!;
          console.log(`${packet.status}: ${packet.request.brief.requestId} · ${packet.packetId}\n${packet.reasons.join("\n")}\n${Buffer.from(guidance.data, "base64").toString("utf8")}${exported ? `\nExported: ${exported.directory}` : ""}${packageSource ? `\nPackage source: ${packageSource.status}; native ${packageSource.native}` : ""}`);
        }
      } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
    });
}
