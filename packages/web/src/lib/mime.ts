import { moduleKinds } from "@isocan/core";

const BY_EXT: Record<string, string> = {
  md: "text/markdown",
  markdown: "text/markdown",
  html: "text/html",
  htm: "text/html",
  txt: "text/plain",
};

/**
 * Browsers report empty/odd types for .md and .html — patch from extension.
 * A loaded module's extensions are asked first, so a dropped `.mmd` lands as
 * the module's kind: the same rule the CLI's `mimeFor` follows.
 */
export function mimeTypeOf(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const added = moduleKinds().find((k) => k.extensions?.includes(ext));
  if (added) return added.mimes[0]!;
  return BY_EXT[ext] ?? (file.type || "application/octet-stream");
}
