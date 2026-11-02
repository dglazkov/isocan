import type {
  CoreModule,
  Item,
  ItemVersion,
  ModuleKind,
  NodeCapabilities,
} from "@isocan/core";

/**
 * **The record both surfaces register** (`docs/projects/lottie/design.md`).
 *
 * Kept separate from `core.ts` so `lottieActivation` can register the module's
 * MIME types, kind, and capabilities without pulling the SVG renderer,
 * dotLottie ZIP reader, palette remapper, and linter into the first-paint
 * entry chunk (`scripts/bundle-ceiling.mjs`).
 */
export const LOTTIE_JSON_MIME = "application/vnd.lottie+json";
export const LOTTIE_ZIP_MIME = "application/vnd.lottie+zip";
export const LOTTIE_POSTER_FRAME_PROP = "lottiePosterFrame";

export const LOTTIE_KIND: ModuleKind = {
  id: "lottie",
  mimes: [LOTTIE_JSON_MIME, LOTTIE_ZIP_MIME],
  extensions: ["lottie.json", "lottie"],
  label: "Animations",
  noun: "animation",
  icon: "video",
};

export function isLottieItem(_item: Item, version: ItemVersion): boolean {
  const mime = version.mimeType ?? "";
  if (mime === LOTTIE_JSON_MIME || mime === LOTTIE_ZIP_MIME) return true;
  const lower = (version.filename ?? "").toLowerCase();
  return lower.endsWith(".lottie.json") || lower.endsWith(".lottie");
}

export function lottieCapabilities(
  item: Item,
  version: ItemVersion,
): Partial<NodeCapabilities> | null {
  if (!isLottieItem(item, version)) return null;
  const isArchive =
    version.mimeType === LOTTIE_ZIP_MIME ||
    (version.filename ?? "").toLowerCase().endsWith(".lottie");
  return {
    view: true,
    edit: true,
    enter: true,
    file: !isArchive,
  };
}

export const lottieModule: CoreModule = {
  name: "@isocan/lottie",
  propertyKeys: [LOTTIE_POSTER_FRAME_PROP],
  kinds: [LOTTIE_KIND],
  capabilities: lottieCapabilities,
};
