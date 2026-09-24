import { describe, expect, it } from "vitest";
import { ARCHETYPE_IDS, ARCHETYPE_WORDS, plainOptions, stubAnswerer } from "../src/core.ts";
import {
  ENRICO_IDS, TOPIC_MAP, archetypeCriteria, cuts, flatten, readTopics, reliability, report, screenRequest, spread, type Row,
} from "../scripts/calibrate.ts";

/**
 * **The calibration harness's pure half** (wireframes phase 6). The dataset
 * never enters the repository: these hierarchies are synthetic, shaped as
 * Enrico's are — a semantic tree of `componentLabel`s, and the raw
 * `activity.root` dump two of its files are.
 */

const SEMANTIC = {
  class: "com.android.internal.policy.PhoneWindow$DecorView",
  bounds: [0, 0, 1440, 2560],
  children: [
    { class: "a.Toolbar", componentLabel: "Toolbar", bounds: [0, 0, 1440, 200], children: [
      { class: "a.ImageButton", componentLabel: "Icon", iconClass: "arrow_backward", bounds: [0, 50, 100, 150] },
      { class: "a.TextView", componentLabel: "Text", text: "Acme  Sign in", bounds: [120, 50, 800, 150] },
    ] },
    { class: "a.EditText", componentLabel: "Input", bounds: [0, 1280, 1440, 1400] },
    { class: "a.Button", componentLabel: "Text Button", textButtonClass: "login", text: "LOG IN", bounds: [0, 2304, 1440, 2400] },
  ],
};

const RAW = {
  activity_name: "com.acme/.Main",
  activity: { root: { class: "a.DecorView", bounds: [0, 0, 1440, 2560], children: [
    { class: "android.widget.TextView", text: "Acme news", bounds: [0, 256, 1440, 400] },
    { class: "android.widget.FrameLayout", bounds: [0, 0, 1, 1], children: [{ class: "android.widget.ImageView", bounds: [0, 512, 1440, 900] }] },
  ] } },
};

describe("the Enrico label map", () => {
  it("covers all 20 of Enrico's topics, and every id it scores against is a catalog id", () => {
    expect(Object.keys(TOPIC_MAP)).toHaveLength(20);
    for (const m of Object.values(TOPIC_MAP)) {
      if (!m) continue;
      expect(m.accept).toContain(m.primary);
      for (const id of m.accept) expect(ARCHETYPE_IDS as readonly string[]).toContain(id);
    }
    expect(Object.entries(TOPIC_MAP).filter(([, m]) => m === null).map(([t]) => t).sort()).toEqual(["bare", "calculator", "camera", "other"]);
  });

  it("offers every catalog id by default, and only the scoreable ones under enrico", () => {
    expect(Object.keys(archetypeCriteria())).toEqual([...ARCHETYPE_IDS]);
    expect(Object.keys(archetypeCriteria("enrico"))).toEqual(ENRICO_IDS);
    expect(ENRICO_IDS).toHaveLength(20);
    expect(archetypeCriteria().welcome).toMatch(/^Welcome: image, heading/);
  });

  it("offers plain words as the options and reads the answer back as the id, or describes the ids in them", () => {
    const words = archetypeCriteria("enrico", "words");
    expect(Object.keys(words)).toEqual(ENRICO_IDS.map((id) => ARCHETYPE_WORDS[id as keyof typeof ARCHETYPE_WORDS]));
    expect(Object.values(words).every((v) => v === null)).toBe(true);
    const { idOf } = plainOptions(ENRICO_IDS);
    for (const id of ENRICO_IDS) expect(idOf(ARCHETYPE_WORDS[id as keyof typeof ARCHETYPE_WORDS])).toBe(id);
    expect(archetypeCriteria("enrico", "described").gallery).toBe(ARCHETYPE_WORDS.gallery);
  });

  it("words every archetype id, each differently", () => {
    expect(Object.keys(ARCHETYPE_WORDS).sort()).toEqual([...ARCHETYPE_IDS].sort());
    expect(new Set(Object.values(ARCHETYPE_WORDS)).size).toBe(ARCHETYPE_IDS.length);
  });

  it("spreads a sample evenly, the same every time", () => {
    expect(spread([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3)).toEqual([1, 4, 7]);
    expect(spread([1, 2], 5)).toEqual([1, 2]);
  });

  it("reads design_topics.csv", () => {
    expect([...readTopics("screen_id,topic\n1,list\n2,login\n\n")]).toEqual([["1", "list"], ["2", "login"]]);
  });
});

describe("flatten", () => {
  it("prints labelled elements, nested, with icon, text and position — containers walked through", () => {
    expect(flatten(SEMANTIC).text).toBe(
      'Toolbar @0%\n  Icon (arrow_backward) @2%\n  Text "Acme Sign in" @2%\nInput @50%\nText Button (login) "LOG IN" @90%\n',
    );
  });

  it("falls back to class names for a raw activity dump", () => {
    expect(flatten(RAW).text).toBe('TextView "Acme news" @10%\nImageView @20%\n');
  });

  it("truncates deterministically and counts what it dropped", () => {
    const a = flatten(SEMANTIC, 40);
    expect(a).toEqual(flatten(SEMANTIC, 40));
    expect(a.dropped).toBeGreaterThan(0);
    expect(a.text.endsWith(`… ${a.dropped} more elements\n`)).toBe(true);
    expect(a.elements).toBe(5);
  });

  it("makes a request the stub can answer over the archetype ids", async () => {
    const req = screenRequest(flatten(SEMANTIC).text);
    const { response } = await stubAnswerer(1).answer(req);
    const a = response.answers.archetype!;
    expect(a.type).toBe("choice");
    expect(ARCHETYPE_IDS as readonly string[]).toContain((a as { choice: string }).choice);
  });
});

describe("the reading", () => {
  it("bins p(choice) against accuracy and weighs the gap by count", () => {
    const pts = [
      { p: 0.95, right: true }, { p: 0.95, right: false },
      { p: 0.55, right: true }, { p: 0.55, right: true },
      { p: 1, right: true },
    ];
    const { bins, ece } = reliability(pts);
    expect(bins).toHaveLength(10);
    expect(bins[9]).toMatchObject({ n: 3, accuracy: 2 / 3 });
    expect(bins[5]).toMatchObject({ n: 2, accuracy: 1 });
    // |2/3 − 0.9667|·3/5 + |1 − 0.55|·2/5
    expect(ece).toBeCloseTo((3 / 5) * Math.abs(2 / 3 - (0.95 + 0.95 + 1) / 3) + (2 / 5) * 0.45, 10);
    expect(cuts(pts, [0.9])).toEqual([{ cut: 0.9, kept: 3, accuracy: 2 / 3 }]);
  });

  it("reports a flat stub as chance, and perfectly calibrated — ECE alone cannot tell a useless judge", () => {
    const rows: Row[] = Array.from({ length: 34 }, (_, i) => ({
      id: String(i), topic: "list", truth: "list", accept: ["list"], choice: ARCHETYPE_IDS[i]!, p: 1 / 34,
      top3: [], ms: 0, tokens: 0, by: "stub", dropped: 0,
    }));
    const md = report(rows, { removed: { other: 1 }, unreadable: [], answerer: "stub", options: 34 });
    expect(md).toContain("accuracy, strict (the primary id): **2.9%**");
    expect(md).toContain("strict **0.000**");
  });
});
