import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOC_STATES, burnDown, docStatus, statusProblems, verifyProblems, verifyStatus } from "../src/docstatus.ts";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const fm = (front: string) => `---\n${front}\n---\n# A doc\n\nwords\n`;

/**
 * The roadmap was a hand-kept fourth copy of something the repo already knew,
 * and the cost was measured: on 29 Aug
 * `docs/research/2026-08-26-attaching-a-directory.md` held TWO contradictory
 * verdicts, both dated the same day — "not built" at the top and "1, 2 and 3
 * are built" a hundred lines down. Neither was lying; one was older, and
 * nothing in the file could tell.
 */
describe("where a document says it stands", () => {
  it("reads the states, the date, and the links", () => {
    const doc = docStatus(fm("status: partial\nsince: 2026-08-29\nsee: personas, evals\nnote: step 1"));
    expect(doc).toMatchObject({
      status: "partial",
      since: "2026-08-29",
      see: ["personas", "evals"],
      note: "step 1",
    });
  });

  it("reads the issue that follows the work, as a number, either spelling", () => {
    /* The doc is the argument and the plan; the issue is where the work is
       followed and closed. "#134" and "134" both mean issue 134; a word there
       is not an issue and is dropped rather than guessed at. */
    expect(docStatus(fm("status: partial\nissue: 134")).issue).toBe(134);
    expect(docStatus(fm("status: partial\nissue: #134")).issue).toBe(134);
    expect(docStatus(fm("status: partial\nissue: soon")).issue).toBeUndefined();
    expect(docStatus(fm("status: partial"))).not.toHaveProperty("issue");
  });

  it("every research note that owes work says where it is followed", async () => {
    /* A note that is `designed` or `partial` is work somebody could pick up,
       and a GitHub issue is where that happens; a note with no issue is work
       nobody can find from the tracker. `built`, `noted` and `superseded` owe
       nothing and may stand alone. Added 4 Sep 2026, the day every open note
       got its issue. */
    const dir = path.join(repo, "docs/research");
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md") && f !== "README.md");
    const owing: string[] = [];
    for (const file of files) {
      const doc = docStatus(await fs.readFile(path.join(dir, file), "utf8"));
      if (["designed", "partial", "blocked"].includes(doc.status) && !doc.issue) owing.push(file);
    }
    expect(owing, "research notes owing work with no `issue:` in their front matter").toEqual([]);
  });

  it("a doc with no front matter is untriaged, not broken", () => {
    // An untriaged doc is a real state and counting them is half the point.
    expect(docStatus("# Just a doc\n")).toEqual({ status: "open", see: [] });
  });

  it("an unrecognised word is `open`, never a promotion", () => {
    // A typo must not silently promote a doc to "built".
    expect(docStatus(fm("status: shipped")).status).toBe("open");
    expect(docStatus(fm("status: BUILT")).status).toBe("open");
  });

  it("names what is wrong with a status that says nothing", () => {
    expect(statusProblems(docStatus(fm("status: blocked\nsince: 2026-08-29"))).join(" ")).toContain(
      "blocked with nothing named",
    );
    expect(
      statusProblems(docStatus(fm("status: superseded\nsince: 2026-08-29"))).join(" "),
    ).toContain("superseded by nothing");
    // A verdict nobody can age is a verdict that will be believed forever.
    expect(statusProblems(docStatus(fm("status: built"))).join(" ")).toContain("no date");
    expect(statusProblems(docStatus(fm("status: built\nsince: 2026-08-29")))).toEqual([]);
  });

  it("`noted` is a survey that owes nothing, and is not `open`", () => {
    /**
     * Nine notes were untriaged until 30 Aug, and four of them were surveys of
     * what other people shipped — finished the moment they were read. Left in
     * `open` they read as "nobody has looked", which is a lie once somebody
     * has; marked `designed` they read as "there is work here", which is a
     * different one. Both distort the only number the roadmap is for.
     */
    const doc = docStatus(fm("status: noted\nsince: 2026-08-30\nnote: the finding IS the answer"));
    expect(doc.status).toBe("noted");
    expect(statusProblems(doc), "a note owes no blocker and no successor").toEqual([]);
  });

  it("neither `noted` nor `superseded` counts as done", () => {
    // Reading is not building, and the done column must not be flattered by
    // either.
    const out = burnDown([
      { status: "built" as const, see: [] },
      { status: "noted" as const, see: [] },
      { status: "superseded" as const, see: [] },
    ]);
    expect(out).toMatchObject({ done: 1, left: 0 });
  });

  it("counts what is done and what is left, and superseded is neither", () => {
    const all = [
      { status: "built" as const, see: [] },
      { status: "built" as const, see: [] },
      { status: "open" as const, see: [] },
      { status: "blocked" as const, see: [] },
      { status: "superseded" as const, see: [] },
    ];
    const out = burnDown(all);
    expect(out.done).toBe(2);
    // Superseded work is not work and is not done work.
    expect(out.left).toBe(2);
  });
});

describe("the repo's own docs", () => {
  const docsIn = async (dir: string) =>
    (await fs.readdir(path.join(repo, dir)))
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .map((f) => path.join(dir, f));

  it("every research doc says where it stands, even if that is `open`", async () => {
    const missing: string[] = [];
    for (const rel of await docsIn("docs/research")) {
      const text = await fs.readFile(path.join(repo, rel), "utf8");
      if (!text.startsWith("---\n")) missing.push(rel);
    }
    expect(missing, "add front matter — `node scripts/roadmap.mjs` reads it").toEqual([]);
  });

  it("no doc claims a status that says nothing", async () => {
    const complaints: string[] = [];
    for (const rel of await docsIn("docs/research")) {
      const doc = docStatus(await fs.readFile(path.join(repo, rel), "utf8"));
      for (const problem of statusProblems(doc)) complaints.push(`${rel}: ${problem}`);
    }
    expect(complaints).toEqual([]);
  });

  it("every `see:` names a project that exists", async () => {
    /**
     * What makes the roadmap a graph rather than two lists. A `see:` pointing
     * at a directory nobody created is a link that reads as real and goes
     * nowhere — the same failure as a stale verdict, one level up.
     */
    const projects = new Set(
      (await fs.readdir(path.join(repo, "docs/projects"), { withFileTypes: true }))
        .filter((d) => d.isDirectory())
        .map((d) => d.name),
    );
    const broken: string[] = [];
    for (const rel of [...(await docsIn("docs/research"))]) {
      const doc = docStatus(await fs.readFile(path.join(repo, rel), "utf8"));
      for (const see of doc.see) if (!projects.has(see)) broken.push(`${rel} → ${see}`);
    }
    expect(broken, "a `see:` must name a directory in docs/projects").toEqual([]);
  });

  it("uses only the states there are", async () => {
    for (const rel of await docsIn("docs/research")) {
      const text = await fs.readFile(path.join(repo, rel), "utf8");
      const raw = /^status:\s*(\S+)/m.exec(text.split("---")[1] ?? "")?.[1];
      if (raw) {
        expect(DOC_STATES as readonly string[], `${rel} has status "${raw}"`).toContain(raw);
      }
    }
  });
});

/**
 * `docs/verify/` is what needs a person, and the roadmap opens with it. Its
 * table used to be hand-kept in the README beside each walk's own status line
 * — two copies — and the roadmap, where people look first, did not show it.
 */
describe("what a walk says needs a person", () => {
  it("reads the status, what was never exercised, and what you need", () => {
    const walk = verifyStatus(fm('status: broken\nsince: 2026-10-01\nissue: "#9"\nnever: "the mic"\nneeds: "a microphone"'));
    expect(walk).toEqual({ status: "broken", since: "2026-10-01", issue: 9, never: "the mic", needs: "a microphone" });
    expect(verifyProblems(walk)).toEqual([]);
  });

  it("a typo or no front matter never takes a walk off the list", () => {
    expect(verifyStatus("# A walk\n").status).toBe("unverified");
    expect(verifyStatus(fm("status: workz")).status).toBe("unverified");
  });

  it("names what a person about to run it would have to guess", () => {
    const said = verifyProblems(verifyStatus(fm("status: broken"))).join(" ");
    expect(said).toContain("never");
    expect(said).toContain("needs");
    expect(said).toContain("no date");
    expect(said).toContain("no issue");
  });

  it("every walk in docs/verify says enough to start from", async () => {
    const dir = path.join(repo, "docs/verify");
    const names = (await fs.readdir(dir)).filter((f) => f.endsWith(".md") && f !== "README.md");
    expect(names.length).toBeGreaterThan(0);
    const vague: string[] = [];
    for (const name of names) {
      const problems = verifyProblems(verifyStatus(await fs.readFile(path.join(dir, name), "utf8")));
      if (problems.length) vague.push(`${name}: ${problems.join("; ")}`);
    }
    expect(vague).toEqual([]);
  });
});
