import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const board = readFileSync(fileURLToPath(new URL("../scripts/canvas-board.mjs", import.meta.url)), "utf8");
const hook = readFileSync(fileURLToPath(new URL("../scripts/hooks/post-commit", import.meta.url)), "utf8");

/**
 * **A synchronous exec cannot be interrupted, so its deadline is a wish.**
 *
 * Every child here is spawned with `execFileSync`, which blocks the worker
 * thread — vitest's timer cannot run, so the `120_000` budget on these tests
 * is unenforceable. Measured on 31 Aug under 16 spinners: this file's
 * "NO SIGNAL" test ran for **2,025,845ms, 2,218,012ms and 2,502,849ms** — 34,
 * 37 and 42 minutes — and then reported `Test timed out in 120000ms`, which
 * is true of when the deadline passed and wrong by a factor of seventeen
 * about what happened. Three of four loaded suite runs were dominated by one
 * test nobody could see was running.
 *
 * `lessons.md` #6 names the shape: *a hang that never fails is the thing to
 * avoid, not a slow test that eventually does.* The child gets the deadline
 * instead, under the test's own budget so the useful message wins the race —
 * a killed child raises with the command in it, rather than vitest raising
 * with a number that is not the elapsed time.
 *
 * Not a speed fix. The passing case still takes ~30s on a saturated machine,
 * and that is honest; what changes is that the failing case stops being
 * unbounded.
 */
const CHILD_BUDGET_MS = 90_000;

const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: repo, encoding: "utf8", timeout: 20_000 }).trim();

/**
 * **A `gh` on PATH that answers whatever this test needs**, so no test in this
 * file reaches GitHub.
 *
 * `--only build` is the one panel that shells out to `gh run list`, and it did
 * so for real: a live network call with a 20-second budget, which is why that
 * test took ~20s alone and was the flakiest thing in the suite. Worse than
 * slow, it was NON-DETERMINISTIC — the panel showed whatever CI happened to
 * say at that moment, so a test asserting on the build signal was asserting on
 * the weather.
 *
 * The technique was already in this file: the NO-SIGNAL test below has always
 * written a refusing `gh` onto PATH. This lifts it out so both cases can use
 * it, and so the success path is exercised on purpose rather than by luck.
 */
function ghSaying(stdout: string, exit = 0): NodeJS.ProcessEnv {
  const shim = mkdtempSync(path.join(tmpdir(), "gh-shim-"));
  writeFileSync(
    path.join(shim, "gh"),
    // Single-quoted heredoc: the JSON goes through verbatim, whatever is in it.
    `#!/bin/sh
cat <<'ISOCAN_GH_JSON'
${stdout}
ISOCAN_GH_JSON
exit ${exit}
`,
    { mode: 0o755 },
  );
  return { ...process.env, PATH: `${shim}:${process.env.PATH}` };
}

/**
 * A CI reading where everything passed **on the commit you are standing on**.
 *
 * The sha matters: the panel compares the newest sha GitHub has SEEN against
 * local HEAD, and reports AMBER when they differ — which is right, and which
 * the first version of this fixture tripped over by using forty zeros. A
 * green light for somebody else's commit is exactly the lie that check
 * exists to prevent.
 */
const allGreen = () =>
  JSON.stringify(
    ["release", "review"].map((name) => ({
      name,
      status: "completed",
      conclusion: "success",
      headSha: git("rev-parse", "HEAD"),
      createdAt: "2026-08-31T08:00:00Z",
    })),
  );

/**
 * **The one place this file starts the board**, so the `gh` shim is not
 * something a new test can forget. Returns what the script SAID.
 */
const runBoard = (only: string, env: NodeJS.ProcessEnv = ghSaying(allGreen())) =>
  execFileSync("node", [`${repo}/scripts/canvas-board.mjs`, "--dry-run", "--only", only], {
    cwd: repo,
    encoding: "utf8",
    timeout: CHILD_BUDGET_MS,
    env,
  });

/** Render a panel without touching a canvas, and hand back its HTML. */
const render = (only: string, env: NodeJS.ProcessEnv = ghSaying(allGreen())) => {
  const out = runBoard(only, env);
  const path = out.split("\n").find((l) => l.includes("would publish"))?.split("→ ")[1]?.trim();
  expect(path, `no panel rendered for --only ${only}`).toBeTruthy();
  return readFileSync(path as string, "utf8");
};

/**
 * The read half of `docs/research/2026-08-30-repo-admin-canvas.md`. Its own
 * rule is the thing worth guarding: *every panel is either derived and
 * regenerated, or decided here and nowhere else.*
 */
describe("the board is derived, and says so", () => {
  it("reads personas through core's parser, so there is one parser", () => {
    // Same reason `scripts/persona-run.mjs` does: a second front-matter reader
    // means one persona says two things depending on who asked. The ported
    // board walks the directory itself (iso-api phase 2's honest footnote) —
    // the one-reader rule survives because core is the one reader.
    expect(board).toContain("parsePersona");
    expect(board).not.toContain("splitFrontMatter");
  });

  it("never reads a broken instrument as a zero", () => {
    // "0 contrast failures" and "nothing could be measured" must never render
    // the same. Amber, and it names the command that would not run.
    expect(board).toContain("expected a number on stdout");
    expect(board).toContain("broken");
    expect(board).toMatch(/verdictOf/);
  });

  it("exits non-zero for a broken instrument and NOT for a missed goal", () => {
    // A board that goes red every morning trains everybody to stop looking.
    expect(board).toMatch(/process\.exit\(ambers\.length \? 1 : 0\)/);
  });

  it("tells the reader every panel is regenerated", () => {
    expect(render("recent")).toContain("Regenerated, never edited here");
  });
});

/**
 * **Silting** — a fresh item per run rather than a new version — is named in
 * the note as the single most likely way this goes wrong in week two.
 */
describe("a run stacks a version, never a second item", () => {
  it("finds a panel by a property, not by its title", () => {
    // Title matching means the first person to rename a panel on the canvas
    // gets a duplicate on the next run. The property survives a rename; the
    // title fallback exists only to adopt panels made before this rule.
    expect(board).toContain("properties?.board === slug");
    expect(board).toContain("properties: { board: slug");
  });

  it("writes nothing when the rendered bytes have not changed", () => {
    // Otherwise the version stack is four hundred identical entries, which is
    // not a history of anything.
    expect(board).toContain("if (current?.blobHash === hash) return;");
  });

  it("stacks the version through the edit verb — the one the note wrongly said was missing", () => {
    expect(board).toContain("board.edit(item.id");
  });
});

/**
 * The bug this file exists for. The first parser asked git for `--shortstat`
 * and `--pretty` together, which interleaves them: a reader taking "up to the
 * next separator" swallows every commit after the first. It rendered "nothing
 * landed in the last 14 days" against 470 commits, with a straight face.
 */
describe("Recently reads the actual history", () => {
  it("names the commit at HEAD", () => {
    const html = render("recent");
    expect(html).toContain(git("rev-parse", "--short", "HEAD"));
  }, 120_000);

  it("counts more than one commit when git reports more than one", () => {
    const real = git("rev-list", "--count", "--since=14 days ago", "HEAD");
    if (Number(real) < 2) return; // a fortnight this quiet has nothing to guard
    const html = render("recent");
    expect(html).not.toContain("Nothing landed in the last 14 days");
    expect(Number(html.match(/(\d+) commits in the last 14 days/)![1])).toBeGreaterThan(1);
  }, 120_000);

  it("renders real shas in every row, not whatever fell out of the parse", () => {
    /**
     * **The assertion that actually fails when the parser breaks.** The first
     * version of this test checked that HEAD's sha appeared and that the count
     * was above one — and the broken parser passed both, because it got record
     * one right and turned every later one into a stat line wearing a sha's
     * place. A guard that survives the bug it remembers is worse than no guard:
     * it reports success forever, and is believed.
     */
    const known = new Set(git("log", "--since=14 days ago", "--format=%h").split("\n").filter(Boolean));
    if (known.size < 2) return;
    const rendered = [...render("recent").matchAll(/<td class="num muted" style="width:64px">([^<]*)<\/td>/g)].map(
      (m) => m[1],
    );
    expect(rendered.length).toBeGreaterThan(1);
    for (const sha of rendered) {
      expect(sha, `"${sha}" is not a commit this repository has`).toMatch(/^[0-9a-f]{7,40}$/);
      expect(known.has(sha), `"${sha}" is not in git log`).toBe(true);
    }
  }, 120_000);

  it("says what it left out rather than truncating silently", () => {
    // A cap is fine. A silent cap reads as "this is all of it".
    expect(board).toContain("not shown");
    expect(board).toContain("counted above and not listed");
  });
});

/** A hook that can fail a commit, or block a prompt for fifteen seconds, is a
 *  hook somebody removes in week two. */
describe("the post-commit hook", () => {
  it("cannot fail the commit", () => {
    // The commit already happened. A canvas that was unreachable is not a
    // reason to make somebody think it did not.
    expect(hook).toMatch(/exit 0/);
    expect(hook).not.toMatch(/^\s*set -e/m);
  });

  it("does not block the terminal, and leaves a log that is named", () => {
    expect(hook).toContain("board.log");
    expect(hook).toMatch(/}\s*>>"?\$log"?\s*2>&1\s*&/);
  });

  it("says nothing at all on a machine with no board configured", () => {
    expect(hook).toContain('[ -f "$root/.isocan/board.json" ] || exit 0');
  });
});

/** `--only recent` needs no measurement, and should not pay for eleven. */
describe("measurement is taken once, and only when something asks", () => {
  it("is memoised behind readBoard()", () => {
    expect(board).toContain("(taken ??= all.map(");
  });

  it("does not claim every goal is holding when it measured none", () => {
    expect(render("recent")).toBeTruthy();
    const out = runBoard("recent");
    expect(out).toContain("no goal measured this run");
    expect(out).not.toContain("every goal holding");
  }, 120_000);
});

/**
 * The big word. It was asked for as "a large GREEN or RED so we can quickly
 * see if the build is green" — and the whole risk of a light like that is the
 * case where it cannot see anything and shows green anyway.
 */
describe("the Build signal", () => {
  it("prints the rule it is following, on the panel", () => {
    // A light nobody knows the rule for is a light nobody trusts.
    const html = render("build");
    for (const word of ["GREEN", "AMBER", "RED", "NO SIGNAL"]) expect(html).toContain(word);
  }, 120_000);

  it("reports the runs it was given, and does not claim no signal", () => {
    /**
     * The positive half, and it could not be asserted at all before: this
     * panel called the real `gh`, so what it showed was whatever CI happened
     * to say while the suite ran — a test about a status light that was
     * really a test about the weather.
     *
     * **It asserts the CI reading, not the WORD.** The first version of this
     * expected GREEN and got AMBER, which was the panel being right: `signal`
     * goes amber when any persona goal on the board is missed, so the word
     * folds in measurements that have nothing to do with `gh`. Pinning it
     * would have coupled this test to board state on disk that no fixture
     * here controls.
     */
    const html = render("build", ghSaying(allGreen()));
    expect(html, "a supplied reading is not an absent one").not.toContain("no signal");
    for (const workflow of ["release", "review"]) expect(html).toContain(workflow);
  }, 120_000);

  it("shows NO SIGNAL — never GREEN — when CI cannot be reached", () => {
    /**
     * Forced for real, with a `gh` on PATH that refuses: "nothing failed" and
     * "nothing was asked" are different facts, and the failure mode of every
     * status light ever built is rendering them the same.
     */
    const html = render("build", ghSaying("not logged in", 1));
    const shown = html.match(/letter-spacing:-0\.03em;[\s\S]*?>\s*([A-Z ]+)<\/div>/)?.[1]?.trim();
    expect(shown).toBe("NO SIGNAL");
  }, 120_000);

  it("says so when CI ran a different commit than the one you are on", () => {
    // A green for code nobody pushed is the stale-copy bug in miniature.
    expect(board).toContain("this light is about the pushed commit, not yours");
  });
});

/** A generator that re-tidies every run argues with whoever is looking. */
describe("placement", () => {
  it("positions panels on creation only, and moves them only when asked", () => {
    expect(board).toContain("if (LAY_OUT && !DRY)");
    expect(board).toMatch(/Positions apply on creation only/);
  });

  it("is a fixed point — a tidy canvas moves nothing", () => {
    expect(board).toContain("layout already tidy");
  });
});

/**
 * **The bug that cost eleven silent failures.** A `post-commit` hook inherits
 * the environment of whatever committed — another agent's session, in a repo
 * with several agents in it — and the CLI then acted as that agent. Every one
 * of the hook's first eleven runs died on `"Kenny" is taken here`, and said so
 * only into a log nobody was reading.
 */
describe("the board speaks as the board", () => {
  it("clears every harness variable and pins one session key", async () => {
    const { boardEnv, BOARD_SESSION } = await import("../scripts/board-identity.mjs");
    const polluted = {
      CLAUDE_CODE_SESSION_ID: "someone-elses-agent",
      CODEX_THREAD_ID: "another-one",
      PI_SESSION_ID: "a-third",
      ANTIGRAVITY_CONVERSATION_ID: "a-fourth",
    };
    const env = boardEnv(false, polluted);
    for (const k of Object.keys(polluted)) expect(env[k], `${k} leaked through`).toBeUndefined();
    expect(env.ISOCAN_SESSION_ID).toBe(BOARD_SESSION);
  });

  it("keeps the caller's identity under --as-me", async () => {
    const { boardEnv } = await import("../scripts/board-identity.mjs");
    const mine = { CLAUDE_CODE_SESSION_ID: "mine" };
    expect(boardEnv(true, mine)).toBe(mine);
  });

  it("publishes under that identity, not the caller's", () => {
    // The one connection every canvas act rides — a stated argument now,
    // where it used to be `env: boardEnv` on every spawn.
    expect(board).toMatch(/connect\(AS_ME \? \{\} : \{ identity: BOARD_IDENTITY \}\)/);
    expect(board).toContain("board-identity.mjs");
  });

  it("has exactly one copy of the rule", () => {
    // Two copies would drift, and the drift would look exactly like the bug.
    const watch = readFileSync(fileURLToPath(new URL("../scripts/board-watch.mjs", import.meta.url)), "utf8");
    expect(watch).toContain("board-identity.mjs");
    expect(watch).not.toContain("CLAUDE_CODE_SESSION_ID");
    expect(board).not.toContain("CLAUDE_CODE_SESSION_ID");
  });
});

/**
 * Two sources of change, because the question was about two: the repository,
 * and the canvas its committed `.isocan/project.json` names.
 */
describe("the watcher", () => {
  const watch = readFileSync(fileURLToPath(new URL("../scripts/board-watch.mjs", import.meta.url)), "utf8");

  it("watches the repo's own canvas, not the board's", () => {
    // The board is where panels are published; the marker is what the
    // repository says its canvas is. Conflating them is the easy mistake.
    expect(watch).toContain('canvasOf("project.json", "projectId")');
    expect(watch).toContain('canvasOf("board.json", "canvas")');
    expect(watch).toContain("--all-ops");
  });

  it("parks as the board, or it cannot see the launcher's own ops", () => {
    // `isocan wait` never wakes you on your own ops.
    expect(watch).toContain("const env = boardEnv();");
    expect(watch).toMatch(/stdio: \["ignore", "pipe", "pipe"\], env \}/);
  });

  it("watches HEAD by comparing it, not by trusting the event", () => {
    // fs.watch on .git fires for index writes and lock files too, so an
    // ordinary `git status` must not wake the board.
    expect(watch).toContain("if (now === head) return;");
  });

  it("debounces, and never runs two refreshes at once", () => {
    // Twelve ops from one drag would be twelve versions of every panel —
    // silting, arriving through the watcher instead of the generator.
    expect(watch).toContain("clearTimeout(timer)");
    expect(watch).toMatch(/if \(running\) \{\s*again = true;/);
  });

  it("says when the board exited non-zero rather than swallowing it", () => {
    expect(watch).toContain("an instrument would not run");
  });
});

/** The repo's own canvas, which is a different canvas from this board's. */
describe("the repo's canvas panel", () => {
  it("never draws an empty canvas from a failed read", () => {
    // Unreachable is not empty — the same rule as a broken instrument.
    expect(board).toContain("Unreachable is not empty");
    expect(board).toContain("unreachable");
  });

  it("opens it by ref, so nothing rebinds this directory", () => {
    expect(board).toContain(".canvas(id)");
  });
});

/**
 * A ninth persona (`journeys`) arrived while the watcher was running, and the
 * board picked it up on its own — but placed it on top of a panel, because the
 * prose row's position was the constant `2 * (ROW + GUT)`: the number of rows
 * that *eight* personas make.
 */
describe("the grid fits however many personas there are", () => {
  it("derives the prose row from the count, not from a constant", () => {
    expect(board).toContain("Math.ceil(all.length / PER_ROW)");
    expect(board).not.toMatch(/PERSONA_TOP \+ 2 \* \(ROW \+ GUT\)/);
  });

  it("gives every panel a slot of its own", () => {
    // Positions are only computed here, so the overlap is checkable without a
    // canvas: two panels claiming one spot is what actually happened.
    const COL = 520, ROW = 460, GUT = 40, PER_ROW = 4, WIDE = COL * PER_ROW + GUT * (PER_ROW - 1);
    const TOP = 520, PERSONA_TOP = TOP + 40 + 300 + 40;
    for (const count of [1, 4, 8, 9, 12, 13]) {
      const rows = Math.max(1, Math.ceil(count / PER_ROW));
      const proseTop = PERSONA_TOP + rows * (ROW + GUT);
      const boxes = [
        { x: 0, y: 0, w: COL, h: TOP },
        { x: COL + GUT, y: 0, w: WIDE - COL - GUT, h: TOP },
        { x: 0, y: TOP + 40, w: WIDE, h: 300 },
        { x: 0, y: proseTop, w: WIDE, h: 620 },
        { x: 0, y: proseTop + 660, w: WIDE, h: 420 },
        ...Array.from({ length: count }, (_, i) => ({
          x: (i % PER_ROW) * (COL + GUT),
          y: PERSONA_TOP + Math.floor(i / PER_ROW) * (ROW + GUT),
          w: COL,
          h: ROW,
        })),
      ];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          const overlaps =
            a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlaps, `with ${count} personas, panel ${i} and ${j} overlap`).toBe(false);
        }
      }
    }
  });
});

/**
 * **No test in this file may reach GitHub**, and that has to be checked
 * rather than remembered.
 *
 * `--only build` shells out to `gh run list`. It used to do so for real: a
 * live network call with a 20-second budget, which made this the slowest and
 * flakiest file in the suite, and — worse — made the build-signal assertions
 * depend on what CI happened to say at that moment.
 */
describe("the board's tests answer their own `gh`", () => {
  const src = readFileSync(fileURLToPath(new URL("./canvas-board.test.ts", import.meta.url)), "utf8");

  it("spawns the board through one helper, which supplies a gh", () => {
    /* Every invocation going through `render` is what makes the shim
       unavoidable; a second `execFileSync` of the script would be a second
       route to the network. */
    const spawns = [...src.matchAll(/execFileSync\(\s*"node",\s*\[`\$\{repo\}\/scripts\/canvas-board\.mjs`/g)];
    expect(spawns.length, "more than one route to the board script").toBe(1);
    expect(src).toMatch(/const runBoard = \(only: string, env: NodeJS\.ProcessEnv = ghSaying\(/);
  });

  it("puts the shim ahead of the real one on PATH", () => {
    /* Behind it and the real `gh` wins, which is the bug wearing a fix. */
    expect(src).toMatch(/PATH: `\$\{shim\}:\$\{process\.env\.PATH\}`/);
  });
});
