import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("dual-face artifacts in web components", () => {
  const stage = read("../src/components/ArtifactStage.tsx");
  const editor = read("../src/components/StageEditor.tsx");
  const itemView = read("../src/components/ItemView.tsx");
  const itemThumb = read("../src/components/ItemThumb.tsx");
  const fanOut = read("../src/components/VersionFanOut.tsx");
  const viewer = read("../src/components/Viewer.tsx");

  it("renders visual face in canvas cards, thumbnails, fan-out, and viewer presentation", () => {
    expect(itemView).toContain("visualFaceOf(current");
    expect(itemThumb).toContain("visualFaceOf(current");
    expect(fanOut).toContain("visualFaceOf(version)");
    expect(viewer).toContain("visualFaceOf(current");
  });

  it("loads the source face in StageEditor for code editing", () => {
    expect(editor).toContain("sourceFaceOf(current)");
  });

  it("preserves visual and named faces in StageEditor when saving a new version", () => {
    expect(editor).toContain("visual: current.visual");
    expect(editor).toContain("faces: current.faces");
  });

  it("offers multi-face toggle in ArtifactStage and ItemView when multiple faces are present", () => {
    expect(stage).toContain("stage-toggle-group");
    expect(stage).toContain("stage-toggle-btn");
    expect(stage).toContain("setPreviewFace");
    expect(stage).toContain("availableFacesOf(current)");
    expect(itemView).toContain("item-face-toggle");
    expect(itemView).toContain("item-face-btn");
    expect(itemView).toContain("soleSelection && spellItOut");
    expect(itemView).toContain("(soleSelection || parentSelected) && spellItOut");
    expect(itemView).toContain("FACE_ARRIVE_BY_MS");
  });

  it("blocks editing dual-face artifacts in non-local unbound environments", () => {
    expect(stage).toContain("hasVisual && !disk.bound");
  });
});
