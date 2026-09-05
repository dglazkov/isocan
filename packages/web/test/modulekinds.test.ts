import { afterEach, describe, expect, it } from "vitest";
import type { Item } from "@isocan/core";
import { registerModule, unregisterModule } from "@isocan/core";
import { ICON_NOUN, KIND_LABEL, iconKindFor, kindLabel, kindNoun } from "../src/lib/kinds.ts";

/**
 * **The union became a string, and the fallbacks are what make that safe**
 * (`docs/projects/modules/design.md`). A module's kind has no entry in the
 * closed records, so every consumer goes through a lookup: the label and the
 * noun come from the module, the icon is the built-in mark it borrowed or the
 * plain file mark, and a kind nobody declared still gets a word rather than
 * `undefined` in a heading.
 */
const fake = {
  name: "@isocan/test-kind",
  kinds: [{ id: "widget", mimes: ["application/x-widget"], label: "Widgets", noun: "widget", icon: "screen" }],
};
const bare = { name: "@isocan/test-bare", kinds: [{ id: "blob", mimes: ["application/x-blob"], label: "Blobs", noun: "blob" }] };

function itemOf(mimeType: string): Item {
  return {
    id: "itm_1",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    title: "T",
    description: "",
    properties: {},
    currentVersionId: "ver_1",
    versions: [{ id: "ver_1", blobHash: "h", mimeType, filename: "f", size: 1 }],
  } as unknown as Item;
}

afterEach(() => {
  unregisterModule(fake.name);
  unregisterModule(bare.name);
});

describe("a module's kind in the app's vocabulary", () => {
  it("keeps the built-ins exactly where they were", () => {
    expect(kindLabel("screen")).toBe(KIND_LABEL.screen);
    expect(kindNoun("site")).toBe(ICON_NOUN.site);
    expect(kindNoun("design-system")).toBe("design system");
  });

  it("takes the label and noun the module declared, and the mark it borrowed", () => {
    registerModule(fake);
    expect(kindLabel("widget")).toBe("Widgets");
    expect(kindNoun("widget")).toBe("widget");
    expect(iconKindFor(itemOf("application/x-widget"))).toBe("screen");
  });

  it("wears the plain file mark when the module named no icon or an unknown one", () => {
    registerModule(bare);
    expect(iconKindFor(itemOf("application/x-blob"))).toBe("other");
    registerModule({ ...fake, kinds: [{ ...fake.kinds[0]!, icon: "hologram" }] });
    expect(iconKindFor(itemOf("application/x-widget"))).toBe("other");
  });

  it("says the kind's own id rather than nothing for a kind no module declared", () => {
    expect(kindLabel("mystery")).toBe("mystery");
    expect(kindNoun("mystery")).toBe("mystery");
  });
});
