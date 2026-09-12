import type { CanvasContents, Item } from "@isocan/core";
import { nodesOn, originId } from "./core.ts";
import { nodeSchema, type AnatomyProject } from "./schema.ts";
import { saveNode, type AnatomyIO } from "./operations.ts";

export function resolveConcept(canvas: CanvasContents, projectItem: Item, project: AnatomyProject, ref: string) {
  const matches = nodesOn(canvas, projectItem.id).filter(item => item.id === ref || originId(item) === ref);
  if (matches.length !== 1) throw new Error(`Choose one concept by its native item ID or portable concept ID: ${ref}`);
  const item = matches[0]!;
  const node = project.nodes.find(node => node.id === originId(item));
  if (!node) throw new Error(`No concept ${ref}`);
  return { item, node };
}

/** Shallow, explicit fields; omitted evidence/options/assessments are preserved. */
export async function patchConcept(io: AnatomyIO, canvas: CanvasContents, projectItem: Item, project: AnatomyProject, ref: string, input: unknown) {
  const parsed = nodeSchema.omit({ id: true }).partial().parse(input);
  // Defaults belong to complete files. A missing array in a patch is not [].
  const patch = Object.fromEntries(Object.keys(input as object).map(key => [key, parsed[key as keyof typeof parsed]]));
  const { node } = resolveConcept(canvas, projectItem, project, ref);
  const next = nodeSchema.parse({ ...node, ...patch });
  const itemId = await saveNode(io, canvas, projectItem, project, next);
  return { projectId: projectItem.id, itemId, conceptId: node.id, status: next.status };
}

export async function resolveDecision(io: AnatomyIO, canvas: CanvasContents, projectItem: Item, project: AnatomyProject, ref: string, optionId: string) {
  const { node } = resolveConcept(canvas, projectItem, project, ref);
  const options = node.resolutionOptions.filter(option => option.id === optionId);
  if (options.length !== 1) throw new Error(`Choose one resolution option on ${node.id}: ${optionId}`);
  const option = options[0]!;
  const receipt = await patchConcept(io, canvas, projectItem, project, node.id, {
    summary: option.resultingSummary, status: "settled", reason: `Resolved: ${option.label}`,
  });
  return { ...receipt, optionId };
}
