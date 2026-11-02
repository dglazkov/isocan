import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { voiceHtml } from "./page.ts";

const script = /<script>([\s\S]*?)<\/script>/.exec(voiceHtml);

// Execute the actual entry's bootstrap, not a copy and not a hand-set theme.
function boot(dark: boolean, stored: string | null = null, refuseStorage = false) {
  const root = { dataset: {} as Record<string, string> };
  let changed = () => {};
  const media = {
    matches: dark,
    addEventListener(type: string, listener: () => void) {
      expect(type).toBe("change");
      changed = listener;
    },
  };
  runInNewContext(script?.[1] ?? "", {
    document: { documentElement: root },
    matchMedia(query: string) {
      expect(query).toBe("(prefers-color-scheme: dark)");
      return media;
    },
    localStorage: {
      getItem(key: string) {
        expect(key).toBe("isocan.theme");
        if (refuseStorage) throw new Error("synthetic storage refusal");
        return stored;
      },
    },
  });
  return { root, change(dark: boolean) { media.matches = dark; changed(); } };
}

describe("the standalone voice entry's automatic theme", () => {
  it("runs a classic pre-paint script in its own head, not React's entry", () => {
    expect(script).not.toBeNull();
    expect(script!.index).toBeLessThan(voiceHtml.indexOf("</head>"));
    expect(voiceHtml).toContain('<meta name="color-scheme" content="light dark"');
  });

  it.each([
    [false, null, "light"],
    [true, null, "dark"],
    [true, "system", "dark"],
    [true, "light", "light"],
    [false, "dark", "dark"],
    [true, "unknown", "dark"],
  ] as const)("resolves OS dark=%s and preference=%s to %s", (dark, saved, expected) => {
    expect(boot(dark, saved).root.dataset.theme).toBe(expected);
  });

  it("follows changes to the OS without injecting an attribute", () => {
    const page = boot(false);
    page.change(true);
    expect(page.root.dataset.theme).toBe("dark");
    page.change(false);
    expect(page.root.dataset.theme).toBe("light");
  });

  it.each(["light", "dark"])("keeps a saved %s preference when the OS changes", (saved) => {
    const page = boot(false, saved);
    page.change(true);
    page.change(false);
    expect(page.root.dataset.theme).toBe(saved);
  });

  it("still follows the OS when storage is unavailable", () => {
    const page = boot(true, null, true);
    expect(page.root.dataset.theme).toBe("dark");
    page.change(false);
    expect(page.root.dataset.theme).toBe("light");
  });
});
