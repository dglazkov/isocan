// Bounded source probes for the design-partner research. No canvas or model calls.
// Run: node docs/research/design-partner/probe.mjs [git-ref]
// Default pins the questionnaire implementation reviewed on 14 September 2026.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const ref = process.argv[2] ?? "cb272b208608d0a78bbd0c0435a78f3dccb72e3d";
const read = (path) => execFileSync("git", ["show", `${ref}:${path}`], { cwd: repo, encoding: "utf8" });
const source = read("packages/web/src/components/QuestionnaireDock.tsx");
const core = read("packages/core/src/designsystem.ts");
const cli = read("packages/cli/src/main.ts");
const guide = read("packages/cli/src/agent-guide.md");
const scratch = mkdtempSync(join(tmpdir(), "isocan-design-probe-"));
try {
  // Execute the actual exported parser/selector. Rendering is not part of this probe.
  // The only runtime core import is isSystemActor; use the same pinned ref.
  const outfile = join(scratch, "questionnaire.mjs");
  await build({
    stdin: { contents: source, loader: "tsx", resolveDir: repo, sourcefile: "QuestionnaireDock.tsx" },
    bundle: true, platform: "node", format: "esm", outfile,
    plugins: [{
      name: "pinned-core-model",
      setup(bundler) {
        bundler.onResolve({ filter: /^@isocan\/core$/ }, () => ({ path: "model", namespace: "pinned-core" }));
        bundler.onLoad({ filter: /.*/, namespace: "pinned-core" }, () => ({
          contents: read("packages/core/src/model.ts"), loader: "ts", resolveDir: repo,
        }));
      },
    }],
    logLevel: "silent",
  });
  const { parseQuestionPayload, activeQuestion } = await import(pathToFileURL(outfile));
  const question = {
    id: "c_question", author: { id: "usr_agent_a", name: "Acme Agent A", kind: "agent" },
    body: '/ask {"questions":[{"id":"audience","title":"Who uses this?","renderer":"freeform"}]}',
  };
  const thread = (comments) => ({ id: "thr_acme", comments });
  const otherAgent = {
    id: "c_agent_b", author: { id: "usr_agent_b", name: "Acme Agent B", kind: "agent" },
    body: "I am checking the assets.",
  };
  const result = {
    ref, node: process.version,
    scope: "Source and exported helper behavior; not a browser journey or design-quality evaluation",
    questionnaire: {
      validPayloadAccepted: parseQuestionPayload(question.body) !== null,
      malformedQuestionObjectAccepted: parseQuestionPayload('/ask {"questions":[{}]}') !== null,
      openBeforeReply: activeQuestion(thread([question])) !== null,
      openAfterOtherAgentReply: activeQuestion(thread([question, otherAgent])) !== null,
      sameAuthorFollowupKeepsOpen: activeQuestion(thread([question, { ...otherAgent, author: question.author }])) !== null,
      uploadHandler: source.slice(source.indexOf("  function handleFiles("), source.indexOf("  async function finish(" )).trim(),
      visualCardsUsePaletteSwatches: source.includes("Visual Cards (3-color palette swatches)"),
    },
    sourceObservations: {
      guideLines: guide.trimEnd().split("\n").length,
      guideMentionsQuestionnaire: /questionnaire|QuestionContextPayload|visual-cards/.test(guide),
      arrivalAuditSkipsJson: cli.includes('if (ctx.json || mimeType !== "text/html") return;'),
      addJsonReturnsBeforeCourtesyChecks: /if \(ctx.json\) return printJson\(\{ itemId, placement: placed \}\);[\s\S]{0,200}await noteMissingDesignSystem/.test(cli),
      anySystemClearsCanvasStanding: core.includes('if (Object.values(canvas.items).some(isDesignSystem)) return "fine";'),
    },
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
