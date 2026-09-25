import type { WirePreset } from "./presets.ts";

/**
 * **Each wire style's DESIGN.md, where the browser can fetch it** — the web's
 * half of reading a style (the terminal's is `presetText` in `style-cli.ts`).
 *
 * Literal paths, one per style, because `new URL("…", import.meta.url)` is
 * what Vite rewrites to an emitted asset — the design competition reaches
 * its packs the same way. The files are assets, never in the entry chunk, and
 * fetched only when a style is chosen. The packs are reached by path, not by
 * package name: were that module removed, its URLs stay unresolved at build
 * (Vite leaves them) and a pick says the pack is not in this build.
 */
export const PRESET_URLS: Readonly<Record<string, () => URL>> = {
  material: () => new URL("../assets/styles/material/DESIGN.md", import.meta.url),
  shadcn: () => new URL("../assets/styles/shadcn/DESIGN.md", import.meta.url),
  glass: () => new URL("../assets/styles/glass/DESIGN.md", import.meta.url),
  ios: () => new URL("../assets/styles/ios/DESIGN.md", import.meta.url),
  fluent: () => new URL("../assets/styles/fluent/DESIGN.md", import.meta.url),
  carbon: () => new URL("../assets/styles/carbon/DESIGN.md", import.meta.url),
  brutalist: () => new URL("../assets/styles/brutalist/DESIGN.md", import.meta.url),
  duarte: () => new URL("../../design-competition/assets/packs/duarte/DESIGN.md", import.meta.url),
  frog: () => new URL("../../design-competition/assets/packs/frog/DESIGN.md", import.meta.url),
  ideo: () => new URL("../../design-competition/assets/packs/ideo/DESIGN.md", import.meta.url),
  ive: () => new URL("../../design-competition/assets/packs/ive/DESIGN.md", import.meta.url),
  kare: () => new URL("../../design-competition/assets/packs/kare/DESIGN.md", import.meta.url),
  linear: () => new URL("../../design-competition/assets/packs/linear/DESIGN.md", import.meta.url),
  rams: () => new URL("../../design-competition/assets/packs/rams/DESIGN.md", import.meta.url),
  tufte: () => new URL("../../design-competition/assets/packs/tufte/DESIGN.md", import.meta.url),
  victor: () => new URL("../../design-competition/assets/packs/victor/DESIGN.md", import.meta.url),
};

/** A wire style's DESIGN.md, fetched — or a refusal that says why it cannot be read here. */
export async function presetUrlText(preset: WirePreset): Promise<string> {
  const url = PRESET_URLS[preset.id]?.();
  const res = url ? await fetch(url).catch(() => null) : null;
  // A missing asset may come back as the app's own page rather than a 404: a DESIGN.md starts with its front matter.
  const text = res?.ok ? await res.text() : "";
  if (!text.startsWith("---")) {
    throw new Error(preset.from === "pack"
      ? `The design competition's packs are not in this build, so "${preset.id}" cannot be read — the wire styles of this module can.`
      : `The ${preset.name} wire style's DESIGN.md could not be fetched.`);
  }
  return text;
}
