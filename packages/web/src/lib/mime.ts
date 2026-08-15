const BY_EXT: Record<string, string> = {
  md: "text/markdown",
  markdown: "text/markdown",
  html: "text/html",
  htm: "text/html",
  txt: "text/plain",
};

/** Browsers report empty/odd types for .md and .html — patch from extension. */
export function mimeTypeOf(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXT[ext] ?? (file.type || "application/octet-stream");
}
