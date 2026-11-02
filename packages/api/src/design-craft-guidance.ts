import { craftSources } from "./craft/sources.ts";
import type { DesignCraftPacket, DesignCraftStage } from "./design-craft-packet.ts";

/** Reviewed adaptation identity, independent of the upstream skill, npm package and native engine versions. */
export const designCraftRevision = "isocan-craft-v1";
/** Stage selection loads only the source identities relevant to this bounded adaptation. */
export function designCraftSources(stage: DesignCraftStage) {
  const paths = stage === "new-work" ? ["new-work", "operate", "craft-floor"] : stage === "critique" ? ["critique", "craft-floor"] : ["polish", "harden", "adapt", "craft-floor"];
  return craftSources.filter(source => paths.includes(source.path.slice(10, -3)));
}
/** Generates guidance from saved context; it neither asks questions nor claims inspection happened. */
export function designCraftGuidance(packet: Pick<DesignCraftPacket, "stage" | "request" | "governing" | "decisions">): string {
  const brief = packet.request.brief;
  const task = brief.primaryTask ?? "the consequential task already identified by the shared design workflow";
  const audience = brief.audience ?? "the audience still to be resolved in the saved brief";
  const common = [
    `Work from this saved brief for ${audience}: ${task}. Preserve supplied facts, explicitly labeled assumptions, skips and accepted decision rationale. Do not repeat settled discovery; use the existing workflow for consequential open decisions.`,
    packet.governing.status === "available" ? "Use the exact incumbent DESIGN.md and the repository's actual components. Extend its tokens and patterns only when the task requires it; a projection is not permission to replace its source." : packet.governing.status === "none" ? "No governing canvas system was identified at this scope. Inspect any actual repository incumbent before choosing a direction; known canvas absence does not establish repository absence." : "Governing authority is unavailable. Preserve that limit and recover the permitted source before claiming system conformance.",
    "Familiar fonts, dense operational tables and standard controls are valid. Let the task determine hierarchy, density, palette purpose and composition. Avoid decoration that competes with the primary action.",
  ];
  const stage = packet.stage === "new-work" ? [
    `Compose one complete slice of “${task}”: entry, primary action, confirmation and recovery. Give real content and the most important decision the strongest visual hierarchy.`,
    "Choose structure before details. Reuse settled direction and actual components; show alternatives only for an unresolved consequential uncertainty. There is no mandatory comp, random concept exercise or new interview.",
    "Plan narrow and wide layouts as different reading and interaction contexts. Keep labels, keyboard order, targets, validation and empty/loading/error states usable before adding finishing details.",
  ] : packet.stage === "critique" ? [
    `Walk “${task}” using realistic content, errors and recovery. Name concrete evidence, affected users and consequences; distinguish broken behavior from hierarchy, content and consistency problems.`,
    "Read source conformance, actual browser task observations and craft judgment independently. A source analyzer cannot attest browser behavior; missing browser execution remains unavailable.",
    "Prioritize consequential causes: a blocked action, misleading state, inaccessible control or missing recovery before spacing and visual polish. Preserve what already works and explain each proposed correction.",
  ] : [
    "Finish in order: blocked tasks, incomplete states, hierarchy and content, shared-pattern consistency, then local polish. Make the smallest coherent correction to the actual cause.",
    "Exercise long content, validation, empty and failure states, zoom, keyboard focus and narrow layouts. Adapt structure and input affordances instead of merely shrinking desktop pixels.",
    "Verify the changed task and neighboring states after a repair. Preserve exact inspected versions, record remaining limits and stop at the shared review's two-repair allowance.",
  ];
  return ["# Adapted Impeccable craft guidance", "", `Revision: ${designCraftRevision} · stage: ${packet.stage}`, "", "Modified, context-specific adaptation of Paul Bakaus's Impeccable; see LICENSE.impeccable and NOTICE.impeccable.md. This is not native playbook execution.", "", ...common.concat(stage).map(line => `- ${line}`), "", `Delivery: ${brief.delivery}. ${brief.delivery === "connected-app" ? "Inspect the actual repository revision, components and connected runtime. Exported HTML/context cannot substitute for that runtime." : "Inspect the declared HTML output and its actual behavior at the required viewports."}`, "", "Opening this packet records no execution. If you actually apply this guidance, publish an ordinary evidence artifact naming this packet, stage, scope, changes and limits; use tool='isocan adapted Impeccable guidance' and toolVersion='isocan-craft-v1' in the existing review observations. Source audit and browser readings remain independent. Missing browser evidence keeps the final receipt an unverified draft. No additional repair budget is created.", "", "Native playbooks, hooks, overlays, engine downloads, image generation and native reviewer/documenter roles are unsupported and were not run.", ""].join("\n");
}
