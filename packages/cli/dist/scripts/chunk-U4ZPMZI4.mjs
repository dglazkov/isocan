import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);

// packages/core/src/design-request.ts
var designRequestsRoute = (canvasId) => `/api/projects/${encodeURIComponent(canvasId)}/design/requests`;
function designRequestBasisCurrent(row, basis) {
  const same = (a, b) => a.home === b.home && a.canvasId === b.canvasId && a.itemId === b.itemId && a.versionId === b.versionId && a.blobHash === b.blobHash;
  return row.status === "current" && row.brief.requestId === basis.requestId && row.brief.epoch === basis.epoch && (same(row.ref, basis.brief) || row.brief.progress === "completed" && !!row.completedFrom && same(row.completedFrom.brief, basis.brief));
}

export {
  designRequestsRoute,
  designRequestBasisCurrent
};
