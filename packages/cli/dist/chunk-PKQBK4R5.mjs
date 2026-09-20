import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);

// packages/core/src/design-repair.ts
var designRepairsRoute = (canvasId) => `/api/projects/${encodeURIComponent(canvasId)}/design/repairs`;

export {
  designRepairsRoute
};
