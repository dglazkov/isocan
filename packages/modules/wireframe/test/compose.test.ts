import { describe, expect, it } from "vitest";
import {
  HEADER_OPTIONS, JEV_URL, NAV_OPTIONS, RECIPES, applyProps, applyPropsRound, applyStructure, navOwners, propsRequests, blueprint, component, decideFlow, flowRequest, flowScreen,
  jevAnswerer, pendingRound, presentElements, propsRequest, readResponse, recipe, renderWire, requestBlueprint, responseProblems,
  structureRequest, stubAnswerer, validateWire, wireframe,
  type Answerer, type JevRequest, type JevResponse, type WireSpec,
} from "../src/core.ts";

/**
 * **The composer's rounds, against the stub** (wireframes phase 1, proof 1).
 *
 * The questions are generated from the catalog, the answers are applied to
 * specs, and the chrome round 1 fixes is the same on every screen of a flow.
 * Everything here runs with no key and no network; the Jev answerer is held
 * against a fetch that answers as Jev's reference says it does.
 */

const REQUEST = "an inventory app for Acme's store staff — sign in, count stock, see what is low";

async function composeWith(answerer: Answerer, request = REQUEST): Promise<{ specs: WireSpec[]; flow: ReturnType<typeof decideFlow>; asked: JevRequest[] }> {
  const asked: JevRequest[] = [];
  const ask = async (req: JevRequest) => {
    asked.push(req);
    return Object.keys(req.questions).length === 0 ? ({ answers: {} } as JevResponse) : (await answerer.answer(req)).response;
  };
  const r1 = flowRequest(request);
  const flow = decideFlow(r1, await ask(r1));
  let specs = flow.archetypes.map((a) => flowScreen(a.id, request, "grp_acme", flow));
  const titles = specs.map((s) => s.title);
  specs = await Promise.all(specs.map(async (s) => {
    const req = structureRequest(s, titles);
    return applyStructure(s, req, await ask(req));
  }));
  const requests = propsRequests(specs);
  const responses = await Promise.all(requests.map(ask));
  specs = applyPropsRound(specs, requests, responses);
  return { specs, flow, asked };
}

describe("round 1: the flow", () => {
  it("asks one yes/no per wave-1 archetype, and the platform, nav and header — every option an id from the catalog", () => {
    const req = flowRequest(REQUEST);
    expect(req.model).toBe("jev-latest");
    expect(req.state).toEqual({ request: REQUEST });
    const needs = Object.keys(req.questions).filter((k) => k.startsWith("needs:"));
    expect(needs).toEqual(RECIPES.map((r) => `needs:${r.id}`));
    for (const id of needs) expect(req.questions[id]!.type).toBe("noul");
    const choiceKeys = (id: string) => Object.keys((req.questions[id] as Extract<JevRequest["questions"][string], { type: "choice" }>).criteria);
    expect(choiceKeys("platform")).toEqual(["app", "web", "site"]);
    expect(choiceKeys("header")).toEqual([...HEADER_OPTIONS]);
    expect(choiceKeys("nav")).toEqual([...NAV_OPTIONS]);
    // Header and nav options are catalog blocks (and `none`), gathered from the recipes, not typed.
    for (const id of [...HEADER_OPTIONS, ...NAV_OPTIONS.filter((n) => n !== "none")]) expect(() => component(id)).not.toThrow();
    expect(HEADER_OPTIONS).toEqual(expect.arrayContaining(["app-bar", "page-header", "navbar"]));
    expect(NAV_OPTIONS).toEqual(expect.arrayContaining(["tab-bar", "side-nav", "none"]));
  });

  it("fixes the chrome once: every screen that can carry the flow's header and nav carries the same ones", async () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { specs, flow } = await composeWith(stubAnswerer(seed));
      expect(specs.length).toBeGreaterThan(0);
      for (const spec of specs) {
        expect(spec.chrome).toEqual(flow.chrome);
        const r = recipe(spec.archetype);
        for (const section of r.sections) {
          const slot = spec.slots.find((s) => s.slot === section.slot);
          if (section.region === "header" && section.options.includes(flow.chrome.header)) expect(slot?.block).toBe(flow.chrome.header);
          if (section.region === "nav" && section.options.includes(flow.chrome.nav)) expect(slot?.block).toBe(flow.chrome.nav);
          if (section.region === "nav" && section.optional && flow.chrome.nav === "none") expect(slot).toBeUndefined();
        }
      }
    }
  });

  it("turns the request's blueprint into one blueprint per archetype, in running order, chrome drawn and the rest blue", async () => {
    const req = flowRequest(REQUEST);
    const res = (await stubAnswerer(7).answer(req)).response;
    const flow = decideFlow(req, res);
    const order = flow.archetypes.map((a) => RECIPES.findIndex((r) => r.id === a.id));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const a of flow.archetypes) {
      const spec = flowScreen(a.id, REQUEST, "grp_acme", flow);
      expect(validateWire(spec)).toEqual([]);
      expect(spec.round).toBe(1);
      for (const slot of spec.slots) {
        const region = recipe(spec.archetype).sections.find((s) => s.slot === slot.slot)!.region;
        if (slot.block !== null) expect(["header", "nav"]).toContain(region);
      }
    }
    // Yes at 0.5 or more, and only for a recipe that draws on the platform.
    for (const a of flow.archetypes) expect(a.p).toBeGreaterThanOrEqual(0.5);
    for (const d of flow.declined) expect(d.why === "platform" || d.p < 0.5).toBe(true);
  });

  it("starts from one blueprint titled with the request, drawn before any answer", () => {
    const spec = requestBlueprint(REQUEST, "grp_acme");
    expect(spec.title).toBe(REQUEST);
    expect(spec.round).toBe(0);
    expect(spec.slots.every((s) => s.block === null)).toBe(true);
    expect(renderWire(spec)).toContain("isocan:wireframe");
    expect(pendingRound([spec])).toBe(1);
  });
});

describe("rounds 2 and 3: each screen, in place", () => {
  it("asks structure only about the slots round 1 left open — each optional one's yes/no, each choice among its blocks", () => {
    const flow = decideFlow(flowRequest(REQUEST), fakeFlow({ home: 0.9, list: 0.8, detail: 0.7 }, "app", "tab-bar", "app-bar"));
    expect(flow.archetypes.map((a) => a.id)).toEqual(["home", "list", "detail"]);
    const home = flowScreen("home", REQUEST, "grp_acme", flow);
    const req = structureRequest(home, ["Home"]);
    const r = recipe("home");
    for (const slot of home.slots) {
      const section = r.sections.find((s) => s.slot === slot.slot)!;
      const asksChoice = slot.block === null && section.options.length > 1;
      const asksInclude = slot.block === null && section.optional;
      expect(slot.slot in req.questions).toBe(asksChoice);
      expect(`${slot.slot}:include` in req.questions).toBe(asksInclude);
      if (asksChoice) expect(Object.keys((req.questions[slot.slot] as { criteria: object }).criteria)).toEqual(section.options);
    }
    // The chrome is never asked again.
    expect("header" in req.questions).toBe(false);
    expect("nav" in req.questions).toBe(false);
  });

  it("asks props and intents per chosen block — intents filtered to what each element accepts, and a recipe's settled prop left out", () => {
    const home = wireframe("home");
    const req = propsRequest(home);
    expect(req.questions["header:app-bar.leading"]).toBeUndefined();
    expect(req.questions["header:app-bar.actions"]).toMatchObject({ type: "score", criteria: ["0", "1", "2", "3"] });
    const intents = req.questions["header:app-bar#action-1"] as { type: string; criteria: Record<string, null> };
    expect(intents.type).toBe("choice");
    expect(Object.keys(intents.criteria)).toEqual([...component("app-bar").elements!["action-1"]!.accepts]);
    // A count past Jev's ten score levels is a choice over the same numbers.
    const list = wireframe("list", {}, (s) => (s.options.includes("data-table") ? "data-table" : s.options[0]!));
    const listReq = propsRequest(list);
    for (const [id, q] of Object.entries(listReq.questions)) {
      if (q.type === "score") expect(q.criteria.length).toBeLessThanOrEqual(10);
      if (q.type === "choice") expect(Object.keys(q.criteria).length).toBeLessThanOrEqual(255);
      expect(id).toMatch(/^[a-z]+(\.\d+)?:[a-z-]+(\.[a-z-]+|#[a-z]+-?\d*)$/);
    }
  });

  it("writes every answer into the spec: a whole flow draws, validates, and keeps every distribution", async () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { specs } = await composeWith(stubAnswerer(seed));
      for (const spec of specs) {
        expect(validateWire(spec)).toEqual([]);
        expect(spec.round).toBe(3);
        expect(pendingRound([spec])).toBeNull();
        expect(spec.slots.every((s) => s.block !== null)).toBe(true);
        expect(() => renderWire(spec)).not.toThrow();
        for (const slot of spec.slots) {
          const c = component(slot.block!);
          // Intents exist for exactly the elements these props draw, each one its element accepts.
          expect(Object.keys(slot.intents ?? {}).sort()).toEqual(presentElements(c, slot.props).sort());
          const section = recipe(spec.archetype).sections.find((s) => s.slot === slot.slot)!;
          if (section.options.length > 1) expect(slot.p).toBeGreaterThan(0);
        }
      }
    }
  });

  it("draws one nav bar across the flow: asked once, copied to every screen that has it, only `selected` its own", async () => {
    let checked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { specs, asked } = await composeWith(stubAnswerer(seed));
      const owners = navOwners(specs);
      for (const [block, owner] of owners) {
        const navOf = (s: WireSpec) => s.slots.find((x) => x.block === block && recipe(s.archetype).sections.find((y) => y.slot === x.slot)?.region === "nav");
        const bar = navOf(specs[owner]!)!;
        const strip = (props: object) => Object.fromEntries(Object.entries(props).filter(([k]) => k !== "selected"));
        for (const spec of specs) {
          const mine = navOf(spec);
          if (!mine) continue;
          checked++;
          expect(strip(mine.props)).toEqual(strip(bar.props));
          expect(mine.intents).toEqual(bar.intents);
          expect(validateWire(spec)).toEqual([]);
        }
        // Only the owner was asked the bar's intents.
        const round3 = asked.slice(-specs.length);
        const askedIntents = round3.filter((r) => Object.keys(r.questions).some((k) => k.includes(`:${block}#`)));
        expect(askedIntents.length).toBeLessThanOrEqual(1);
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("never gives one block the same intent twice — the next most probable one nobody has, not a sample", () => {
    const home = wireframe("home", {}, (s) => (s.options.includes("tab-bar") ? "tab-bar" : s.options[0]!));
    const req = propsRequest(home);
    const answers: JevResponse["answers"] = {};
    for (const [id, q] of Object.entries(req.questions)) {
      if (q.type === "noul") answers[id] = { type: "noul", noul: 0.2 };
      else if (q.type === "score") answers[id] = { type: "score", score: q.criteria.length - 1, probabilities: Object.fromEntries(q.criteria.map((_, i) => [String(i), i === q.criteria.length - 1 ? 1 : 0])) };
      else {
        const keys = Object.keys(q.criteria);
        // Every tab's first choice is "home"; its runner-up differs.
        const first = keys.includes("home") ? "home" : keys[0]!;
        const second = keys.find((k) => k !== first && k.length === 7 + (Number(id.slice(-1)) % 3)) ?? keys.find((k) => k !== first)!;
        answers[id] = { type: "choice", choice: first, probabilities: Object.fromEntries(keys.map((k) => [k, k === first ? 0.6 : k === second ? 0.3 : 0.1 / (keys.length - 2)])) };
      }
    }
    const out = applyProps(home, req, { answers });
    const tabs = out.slots.find((s) => s.block === "tab-bar")!;
    const values = Object.values(tabs.intents!);
    expect(values[0]).toBe("home");
    expect(new Set(values).size).toBe(values.length);
  });

  it("is the stub's answers, deterministically: one seed is one flow, and seeds differ", async () => {
    const a = await composeWith(stubAnswerer(3));
    const b = await composeWith(stubAnswerer(3));
    expect(a.specs).toStrictEqual(b.specs);
    const shapes = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) shapes.add(JSON.stringify((await composeWith(stubAnswerer(seed))).specs.map((s) => s.slots.map((x) => x.block))));
    expect(shapes.size).toBeGreaterThan(5);
  });

  it("takes argmax, never a sample: Jev's own choice, and the most probable score level", () => {
    const home = wireframe("home");
    const req = propsRequest(home);
    const answers: JevResponse["answers"] = {};
    for (const [id, q] of Object.entries(req.questions)) {
      if (q.type === "noul") answers[id] = { type: "noul", noul: 0.2 };
      else if (q.type === "choice") {
        const keys = Object.keys(q.criteria);
        const pick = keys[keys.length - 1]!;
        answers[id] = { type: "choice", choice: pick, probabilities: Object.fromEntries(keys.map((k) => [k, k === pick ? 0.7 : 0.3 / (keys.length - 1)])) };
      } else answers[id] = { type: "score", score: 1.2, probabilities: Object.fromEntries(q.criteria.map((_, i) => [String(i), i === 1 ? 0.6 : 0.4 / (q.criteria.length - 1)])) };
    }
    const out = applyProps(home, req, { answers });
    const bar = out.slots.find((s) => s.slot === "header")!;
    expect(bar.props.actions).toBe(1);
    expect(bar.props.search).toBe(false);
    expect(bar.props.leading).toBe("none");
  });
});

describe("the answerer seam", () => {
  const req: JevRequest = {
    model: "jev-latest",
    state: { request: REQUEST },
    questions: {
      platform: { type: "choice", instructions: "Which?", criteria: { app: null, web: null } },
      "needs:home": { type: "noul", instructions: "Home?" },
      rows: { type: "score", instructions: "How many?", criteria: ["3", "4"] },
    },
  };
  const good = {
    model: "jev-1.13.0",
    answers: {
      platform: { type: "choice", choice: "app", probabilities: { app: 0.9, web: 0.1 }, confidence: 0.8 },
      "needs:home": { type: "noul", noul: 0.7 },
      rows: { type: "score", score: 0.2, probabilities: { "0": 0.8, "1": 0.2 } },
    },
    usage: { input_tokens: 120, output_tokens: 40 },
  };

  it("accepts a response in Jev's shape", () => {
    expect(responseProblems(req, good)).toEqual([]);
  });

  it("refuses a malformed answer, and a 422-shaped body, saying which", () => {
    const bad = structuredClone(good) as Record<string, any>;
    bad.answers.platform.choice = "desk";
    bad.answers["needs:home"] = { type: "choice", choice: "yes", probabilities: {} };
    bad.answers.rows.probabilities = { "7": 1 };
    bad.answers.extra = { type: "noul", noul: 0.5 };
    const problems = responseProblems(req, bad);
    expect(problems.join("\n")).toMatch(/choice "desk" is not one of app, web/);
    expect(problems.join("\n")).toMatch(/"needs:home" must be a noul, not choice/);
    expect(problems.join("\n")).toMatch(/"7" is not one of its options/);
    expect(problems.join("\n")).toMatch(/"extra" answers no question/);
    const missing = { answers: { platform: good.answers.platform } };
    expect(responseProblems(req, missing)).toEqual(['answer "needs:home" is missing', 'answer "rows" is missing']);
    const unprocessable = { detail: [{ type: "missing", loc: ["body", "questions", "q", "choice", "criteria"], msg: "Field required" }] };
    expect(() => readResponse(req, unprocessable)).toThrow(/refused the request: body\.questions\.q\.choice\.criteria: Field required/);
    expect(() => readResponse(req, { answers: { ...good.answers, "needs:home": { type: "noul", noul: 1.4 } } })).toThrow(/noul must be a number 0–1/);
  });

  it("the stub answers every question in its own type, flat, and valid", async () => {
    const { response, by } = await stubAnswerer(11).answer(req);
    expect(by).toBe("stub (seed 11)");
    expect(responseProblems(req, response)).toEqual([]);
    expect((response.answers.platform as { probabilities: Record<string, number> }).probabilities).toEqual({ app: 0.5, web: 0.5 });
  });

  it("Jev: POSTs the request with the key, retries 429 and 529, and says what a 401 said", async () => {
    const sent: Array<{ url: string; init: RequestInit }> = [];
    const replies = [
      new Response("{}", { status: 429 }),
      new Response("{}", { status: 529 }),
      new Response(JSON.stringify(good), { status: 200 }),
    ];
    const waits: number[] = [];
    const jev = jevAnswerer({
      key: "key-acme",
      fetch: (async (url: string, init: RequestInit) => {
        sent.push({ url, init });
        return replies.shift()!;
      }) as never,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    const answered = await jev.answer(req);
    expect(answered.by).toBe("jev-1.13.0");
    expect(answered.response.usage?.input_tokens).toBe(120);
    expect(sent).toHaveLength(3);
    expect(waits).toEqual([500, 1000]);
    expect(sent[0]!.url).toBe(JEV_URL);
    expect((sent[0]!.init.headers as Record<string, string>).authorization).toBe("Bearer key-acme");
    expect(JSON.parse(sent[0]!.init.body as string)).toEqual(req);

    const denied = jevAnswerer({
      key: "key-wrong",
      fetch: (async () => new Response(JSON.stringify({ detail: { error_type: "authentication_error", message: "Cannot authenticate with the server." } }), { status: 401 })) as never,
    });
    await expect(denied.answer(req)).rejects.toThrow("Jev answered 401: Cannot authenticate with the server.");
  });

  it("Jev with no key is a refusal, never a quiet fall back to the stub", () => {
    expect(() => jevAnswerer({ key: undefined })).toThrow(/needs TYPESAFE_API_KEY/);
    expect(() => jevAnswerer({ key: "" })).toThrow(/--answerer stub/);
  });
});

describe("recipes settle props for their place in a flow", () => {
  it("Home's app bar has no Back chevron; a Detail's still does", () => {
    const home = wireframe("home");
    expect(home.slots.find((s) => s.slot === "header")!.props.leading).toBe("none");
    expect(renderWire(home)).not.toMatch(/aria-label="Back"|>Back</);
    const detail = wireframe("detail");
    expect(detail.slots.find((s) => s.slot === "header")!.props.leading).toBe("back");
    // A spec can still choose otherwise; the recipe's value is a default, under the spec.
    expect(validateWire(blueprint("home"))).toEqual([]);
  });
});

function fakeFlow(needs: Record<string, number>, platform: string, nav: string, header: string) {
  return {
    answers: {
      ...Object.fromEntries(RECIPES.map((r) => [`needs:${r.id}`, { type: "noul", noul: needs[r.id] ?? 0.1 }])),
      platform: { type: "choice", choice: platform, probabilities: { app: 0, web: 0, site: 0, [platform]: 1 } },
      nav: { type: "choice", choice: nav, probabilities: Object.fromEntries([...NAV_OPTIONS].map((n) => [n, n === nav ? 0.8 : 0.2 / (NAV_OPTIONS.length - 1)])) },
      header: { type: "choice", choice: header, probabilities: Object.fromEntries([...HEADER_OPTIONS].map((h) => [h, h === header ? 0.9 : 0.1 / (HEADER_OPTIONS.length - 1)])) },
    },
  } as JevResponse;
}
