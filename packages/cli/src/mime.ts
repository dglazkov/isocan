import path from "node:path";

const BY_EXT: Record<string, string> = {
  md: "text/markdown",
  markdown: "text/markdown",
  html: "text/html",
  htm: "text/html",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export function mimeFor(filename: string): string {
  return BY_EXT[path.extname(filename).slice(1).toLowerCase()] ?? "application/octet-stream";
}

/** Sensible default canvas footprint per media kind (web reads natural sizes). */
export function defaultSize(mimeType: string): { width: number; height: number } {
  if (mimeType.startsWith("image/")) return { width: 480, height: 360 };
  if (mimeType.startsWith("video/")) return { width: 480, height: 270 };
  return { width: 420, height: 320 };
}
