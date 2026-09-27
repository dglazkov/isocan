import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);

// packages/core/src/lineage.ts
var PARENT_PROP = "parent";
function parentOf(item) {
  const parent = item.properties[PARENT_PROP];
  return parent && parent.length > 0 ? parent : null;
}
function lineageProperties(parentId) {
  return { [PARENT_PROP]: parentId };
}
function childrenOf(canvas, itemId) {
  return Object.values(canvas.items).filter((item) => parentOf(item) === itemId).sort((a, b) => a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
}

export {
  PARENT_PROP,
  parentOf,
  lineageProperties,
  childrenOf
};
