import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  designSystem,
  isDesignSystem,
  itemKind,
  parseDesign,
  checkDesign,
  registerModule,
  unregisterModule,
  type CanvasContents,
  type Item,
  type Operation,
} from "@isocan/core";
import competitionCore, { COMPETITION_COMMAND } from "../src/core.ts";
import { DEFAULT_PACKS } from "../src/packdata.ts";
import { fighters, findFighter, packPath, packProblems, rosterClashes, type FighterPack } from "../src/packs.ts";
import {
  FIGHTER_MIME,
  arenaPlan,
  bellPlan,
  boutRounds,
  findBout,
  readCard,
  startPlan,
  type Minted,
} from "../src/bout.ts";
import { MIN_BOUTS, competitionTally, standings } from "../src/tally.ts";

beforeAll(() => registerModule(competitionCore));
afterAll(() => unregisterModule(competitionCore.name));

const asset = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

describe("the nine default fighters", () => {
  it("are nine, and every one passes the validator a contributed pack must pass", () => {
    expect(DEFAULT_PACKS).toHaveLength(9);
    for (const pack of DEFAULT_PACKS) expect(packProblems(pack), pack.id).toEqual([]);
  });

  it("are read through the contribution point, like anybody's", () => {
    expect(fighters().map((f) => f.pack.id)).toEqual(DEFAULT_PACKS.map((p) => p.id));
    expect(fighters().every((f) => f.module === "@isocan/design-competition")).toBe(true);
  });

  it("lead with the principle and never wear the person's name (decided 11 Sep)", () => {
    for (const pack of DEFAULT_PACKS) {
      const surname = pack.name.split(/[\s&]+/).filter((w) => w.length >= 3 && !/^(and|design)$/i.test(w));
      for (const word of surname) expect(pack.agentName.toLowerCase(), `${pack.id}: ${pack.agentName}`).not.toContain(word.toLowerCase());
      expect(pack.homage).toMatch(/not affiliated/i);
      expect(pack.credit).toMatch(/^after /);
    }
  });

  it("answer to distinct first words — `@Less` is one agent", () => {
    expect(rosterClashes(fighters())).toEqual([]);
  });

  it("ship every file a pack names, and every DESIGN.md reads with isocan's own parser and linter", () => {
    for (const pack of DEFAULT_PACKS) {
      for (const file of ["DESIGN.md", "critique.md", "references.md", "avatar.svg"] as const) {
        expect(statSync(asset(packPath(pack, file))).size, `${pack.id}/${file}`).toBeGreaterThan(0);
      }
      const doc = parseDesign(readFileSync(asset(packPath(pack, "DESIGN.md")), "utf8"));
      expect(doc.problems, pack.id).toEqual([]);
      expect(checkDesign(doc).filter((f) => f.severity === "error"), pack.id).toEqual([]);
    }
  });

  it("have avatars that are emblems: small, no script, no picture, no link", () => {
    for (const pack of DEFAULT_PACKS) {
      const svg = readFileSync(asset(packPath(pack, "avatar.svg")), "utf8");
      expect(svg.length, pack.id).toBeLessThanOrEqual(3072);
      expect(svg).toMatch(/^<svg/);
      expect(svg).not.toMatch(/<script|<image|href=|<foreignObject/i);
    }
  });

  it("carry pictures of the work only where the licence travels into an MIT repo", () => {
    for (const pack of DEFAULT_PACKS) {
      for (const ref of pack.references) if (ref.image) expect(["CC0-1.0", "public-domain"]).toContain(ref.image.licence);
    }
  });

  it("are found the way people name them", () => {
    const all = fighters();
    expect(findFighter(all, "kare")?.pack.id).toBe("kare");
    expect(findFighter(all, "Less but Better")?.pack.id).toBe("rams");
    expect(findFighter(all, "linear")?.pack.id).toBe("linear");
    expect(findFighter(all, "nobody")).toBeNull();
  });
});

describe("the validator", () => {
  const base = DEFAULT_PACKS.find((p) => p.id === "rams")!;
  const wrong = (patch: Partial<FighterPack>) => packProblems({ ...base, ...patch });

  it("refuses an agent named after the person", () => {
    expect(wrong({ agentName: "Rams Bot" }).join()).toMatch(/named for its principle/);
    expect(wrong({ agentName: "Dieter" }).join()).toMatch(/never its person/);
  });
  it("lets somebody make a pack of themselves", () => {
    expect(packProblems({ ...base, name: "Jun", agentName: "Jun House", self: true, homage: "Jun's own pack." })).toEqual([]);
  });
  it("refuses a picture whose licence does not travel, naming the reference", () => {
    const refs = [{ ...base.references[0]!, image: { source: "https://commons.wikimedia.org/x", licence: "CC-BY-SA-4.0" } }];
    expect(wrong({ references: refs }).join()).toMatch(/does not travel/);
  });
  it("wants three beliefs, a real colour and words for a name", () => {
    expect(wrong({ beliefs: ["one"] }).join()).toMatch(/three lines/);
    expect(wrong({ colour: "orange" }).join()).toMatch(/#rrggbb/);
    expect(wrong({ agentName: "Less, but Better" }).join()).toMatch(/must be words/);
  });
});

describe("the module's surface", () => {
  it("adds one kind — the card — and no operation", () => {
    expect(competitionCore.kinds?.map((k) => k.mimes[0])).toEqual([FIGHTER_MIME]);
  });
  it("offers /design-competition as a command that opens the picker and is still a skill", () => {
    expect(COMPETITION_COMMAND.opens).toBe("fighters");
    expect(COMPETITION_COMMAND.body).toMatch(/isocan competition new/);
    expect(COMPETITION_COMMAND.body).toMatch(/never decide/i);
  });
  it("reads a card back, and refuses an avatar that could script the page", () => {
    const rams = DEFAULT_PACKS.find((p) => p.id === "rams")!;
    const good = readCard(JSON.stringify({ kind: "isocan.fighter", title: rams.title, colour: rams.colour, avatar: "<svg/>" }));
    expect(good?.title).toBe(rams.title);
    const bad = readCard(JSON.stringify({ kind: "isocan.fighter", title: "x", avatar: "<svg><script>alert(1)</script></svg>" }));
    expect(bad?.avatar).toBe("");
    expect(readCard("not json")).toBeNull();
  });
});

// ---------- a bout, as the canvas holds it ----------

const ACTOR = { id: "usr_priya", name: "Priya" };
const blob = (name: string): Minted => ({ blobHash: `h_${name}`, size: 1, mimeType: "text/markdown", filename: name });

/** Apply the plan's `item.add`s to an empty canvas — enough of a reducer to
 *  read the arena back the way both surfaces will. */
function applyAdds(ops: readonly Operation[], canvas: CanvasContents = { items: {}, threads: {}, trash: [] }, by = ACTOR): CanvasContents {
  const now = "2026-09-11T10:00:00.000Z";
  for (const op of ops) {
    if (op.type === "item.add") {
      const at = "x" in op.placement ? op.placement : { x: 0, y: 0 };
      canvas.items[op.itemId] = {
        id: op.itemId, x: at.x, y: at.y, width: op.width, height: op.height, title: op.title ?? "", description: "",
        properties: { ...(op.properties ?? {}) },
        versions: [{ ...op.version, createdAt: now, createdBy: by }], currentVersionId: op.version.id,
        createdAt: now, createdBy: by, updatedAt: now, updatedBy: by,
      } as Item;
    }
    if (op.type === "item.update") {
      const item = canvas.items[op.itemId]!;
      item.properties = { ...item.properties, ...(op.patch.properties ?? {}) };
      for (const k of op.patch.removeProperties ?? []) delete item.properties[k];
    }
  }
  return canvas;
}

function layBout() {
  const chosen = fighters().filter((f) => ["kare", "rams", "linear"].includes(f.pack.id));
  const lanes = Object.fromEntries(chosen.map((f) => [f.pack.id, { area: blob("area.md"), card: blob("card"), design: blob("DESIGN.md"), shelf: blob("refs.md") }]));
  const plan = arenaPlan({
    at: { x: 0, y: 0 }, brief: "a checkout for a plant shop that doesn't feel like a form",
    fighters: chosen.map((f) => ({ source: f.module, pack: f.pack })),
    entryKind: "screen", mode: "exhibition", minutes: 20, decider: ACTOR.id, target: null,
    blobs: { brief: blob("brief.md"), lanes },
  });
  const canvas = applyAdds(plan.ops);
  return { plan, canvas, bout: findBout(canvas, plan.boutId)! };
}

describe("the arena", () => {
  it("is a Brief and a lane per fighter, read back as a bout", () => {
    const { bout } = layBout();
    expect(bout.phase).toBe("laid");
    expect(bout.lanes.map((l) => l.area.title)).toEqual(["Road Signs", "Less but Better", "Fast Is a Feature"]);
  });

  it("gives each lane its own design system — scoped, so the canvas keeps its own", () => {
    const { canvas, bout } = layBout();
    for (const lane of bout.lanes) {
      const system = designSystem(canvas, { at: lane.area });
      expect(system && isDesignSystem(system)).toBe(true);
      expect(system!.title).toContain(DEFAULT_PACKS.find((p) => p.id === lane.packId)!.title);
    }
    expect(designSystem(canvas)).toBeNull();
  });

  it("files the card under its own kind while the module is loaded", () => {
    const { canvas } = layBout();
    const any = Object.values(canvas.items)[0]!;
    const card = { ...any, versions: [{ ...any.versions[0]!, mimeType: FIGHTER_MIME }] };
    expect(itemKind(card)).toBe("fighter");
  });
});

describe("the start, the bell and the tally", () => {
  const fightersActors = { kare: { id: "agt_kare", name: "Road Signs" }, rams: { id: "agt_rams", name: "Less but Better" }, linear: { id: "agt_linear", name: "Fast Is a Feature" } };
  const packs = Object.fromEntries(DEFAULT_PACKS.map((p) => [p.id, p]));

  function started() {
    const laid = layBout();
    const ops = startPlan({ bout: laid.bout, packs, actors: fightersActors, now: new Date("2026-09-11T10:00:00.000Z") });
    const canvas = applyAdds(ops, laid.canvas);
    return { ops, canvas, bout: findBout(canvas, laid.plan.boutId)! };
  }

  it("hands each fighter its brief as a message that mentions it — what wakes an agent", () => {
    const { ops, bout } = started();
    const briefs = ops.filter((op) => op.type === "thread.create");
    expect(briefs).toHaveLength(3);
    expect(briefs.map((op) => (op.type === "thread.create" ? op.comment.mentions : []))).toEqual([["agt_kare"], ["agt_rams"], ["agt_linear"]]);
    expect(bout.phase).toBe("building");
    expect(bout.lanes.map((l) => l.actorId)).toEqual(["agt_kare", "agt_rams", "agt_linear"]);
  });

  function voted(reactions: Record<string, Record<string, string[]>>, extra: Record<string, string> = {}) {
    const { canvas, bout } = started();
    for (const lane of bout.lanes) {
      const id = `entry_${lane.packId}`;
      canvas.items[id] = { ...lane.area, id, title: `${lane.area.title} entry`, x: lane.area.x + 500, y: lane.area.y + 300, width: 100, height: 100, properties: { "competition.entry": bout.brief.id, "competition.fighter": lane.packId }, reactions: reactions[lane.packId] ?? {} } as Item;
    }
    Object.assign(canvas.items[bout.brief.id]!.properties, extra);
    return { canvas, bout: findBout(canvas, bout.brief.id)! };
  }

  it("counts people and agents apart: N…1 for a person, N−1…1 for a fighter", () => {
    const { bout } = voted({
      kare: { "🥇": ["usr_ola", "agt_linear"], "🥈": ["usr_jun"] },
      linear: { "🥇": ["usr_jun"], "🥈": ["usr_ola", "agt_kare"] },
      rams: { "🥉": ["usr_ola", "usr_jun"], "🥇": ["agt_kare"] },
    });
    const tally = competitionTally(bout, new Set());
    const by = Object.fromEntries(tally.entries.map((e) => [e.packId, e]));
    expect(by.kare!.people).toBe(3 + 2);
    expect(by.linear!.people).toBe(3 + 2);
    expect(by.rams!.people).toBe(1 + 1);
    // Fighters rank the two they did not make: 🥇 = 2, 🥈 = 1.
    expect(by.kare!.agents).toBe(2);
    expect(by.rams!.agents).toBe(2);
    expect(by.linear!.agents).toBe(1);
    expect(tally.voters).toEqual({ people: 2, agents: 2 });
  });

  it("drops a fighter's rank of its own entry, and says so", () => {
    const { bout } = voted({ rams: { "🥇": ["agt_rams"] } });
    const tally = competitionTally(bout, new Set());
    expect(tally.entries.find((e) => e.packId === "rams")!.agents).toBe(0);
    expect(tally.dropped[0]?.why).toMatch(/never ranks its own/);
  });

  it("counts the same medal on two entries on neither", () => {
    const { bout } = voted({ kare: { "🥇": ["usr_ola"] }, rams: { "🥇": ["usr_ola"] } });
    const tally = competitionTally(bout, new Set());
    expect(tally.entries.every((e) => e.people === 0)).toBe(true);
    expect(tally.dropped).toHaveLength(2);
  });

  it("lets only the Decider's 🏆 decide; anybody else's is a vote for it", () => {
    const { bout } = voted({ kare: { "🏆": ["usr_ola"] }, rams: { "🏆": [ACTOR.id] } });
    const tally = competitionTally(bout, new Set());
    expect(tally.decided?.properties["competition.fighter"]).toBe("rams");
    expect(tally.entries.find((e) => e.packId === "kare")!.trophies).toBe(1);
  });

  it("curtains the lanes while the vote runs, and keeps the marks once it is decided", () => {
    const { canvas, bout } = voted({});
    const ringing = applyAdds(bellPlan(bout, new Date("2026-09-11T10:20:00.000Z"), 5), canvas);
    const rounds = boutRounds(ringing);
    expect(rounds).toHaveLength(3);
    expect(rounds[0]!.until).toBe("2026-09-11T10:25:00.000Z");
    expect(rounds[0]!.marks).toContain("🥇");
    // The bell asks the fighters to judge — once, on the Brief, mentioning all three.
    const ask = bellPlan(bout, new Date(), 5).find((op) => op.type === "thread.create");
    expect(ask?.type === "thread.create" && ask.comment.mentions).toEqual(["agt_kare", "agt_rams", "agt_linear"]);
  });

  it("gives standings a record at once and a rating only after enough bouts", () => {
    const { canvas } = voted({ kare: { "🥇": ["usr_ola"] }, rams: { "🥈": ["usr_ola"] }, linear: { "🥉": ["usr_ola"] } });
    const rows = standings(canvas, new Set());
    expect(rows.map((r) => r.packId).sort()).toEqual(["kare", "linear", "rams"]);
    expect(rows.every((r) => r.bouts === 1 && r.rating === null)).toBe(true);
    expect(MIN_BOUTS).toBeGreaterThan(1);
  });
});
