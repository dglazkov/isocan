import type { CanvasContents, Item } from "@isocan/core";
import {
  PROJECT_MIME,
  PROP,
  hasMime,
  nodesOn,
  originId,
  currentVersion,
  outgoing,
  checkpointsOn,
} from "./manifest.ts";
import {
  nodeBodySchema,
  projectBodySchema,
  checkpointSchema,
  parseProject,
  type AnatomyProject,
  type AnatomyNode,
} from "./schema.ts";
export * from "./manifest.ts";
export * from "./schema.ts";
import anatomyModule from "./manifest.ts";
export default anatomyModule;

export type ReadText = (hash: string) => Promise<string>;
export async function readProject(
  canvas: CanvasContents,
  projectItem: Item,
  read: ReadText,
  includeDiscussion = false,
): Promise<AnatomyProject> {
  if (!hasMime(projectItem, PROJECT_MIME))
    throw new Error("Choose an Anatomy project item");
  const body = projectBodySchema.parse(
    JSON.parse(await read(currentVersion(projectItem).blobHash)),
  );
  const items = nodesOn(canvas, projectItem.id);
  const byNative = new Map(items.map((i) => [i.id, originId(i)]));
  const nodes = await Promise.all(
    items.map(async (item): Promise<AnatomyNode> => {
      const details = nodeBodySchema.parse(
        JSON.parse(await read(currentVersion(item).blobHash)),
      );
      const parent = byNative.get(item.properties[PROP.parent] ?? "");
      const comments = Object.values(canvas.threads)
        .filter((t) => t.anchorItemId === item.id)
        .flatMap((t) =>
          t.comments.map((c) => ({
            id: c.id,
            author: c.author.name,
            authorRole: canvas.agents?.[c.author.id]
              ? ("agent" as const)
              : ("human" as const),
            timestamp: c.createdAt,
            text: c.body,
          })),
        );
      return {
        ...details,
        id: originId(item),
        title: item.title,
        ...(parent
          ? {
              parentId: parent,
              ...(item.properties[PROP.relation]
                ? { parentRelation: item.properties[PROP.relation]! }
                : {}),
            }
          : {}),
        marginalia: [
          ...details.marginalia,
          ...(includeDiscussion
            ? comments.filter(
                (c) => !details.marginalia.some((old) => old.id === c.id),
              )
            : []),
        ],
      };
    }),
  );
  const edges = items.flatMap((item) =>
    outgoing(item).flatMap((e) => {
      const to = byNative.get(e.to);
      return to ? [{ ...e, from: originId(item), to }] : [];
    }),
  );
  const checkpoints = await Promise.all(
    checkpointsOn(canvas, projectItem.id).map(async (item) => ({
      ...checkpointSchema.parse(
        JSON.parse(await read(currentVersion(item).blobHash)),
      ),
      title: item.title,
    })),
  );
  return parseProject({
    ...body,
    id: originId(projectItem),
    projectName: projectItem.title,
    nodes,
    edges,
    checkpoints,
  });
}
