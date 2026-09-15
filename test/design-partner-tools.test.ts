import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { questionnaireFixture } from "../packages/api/test/questionnaire-fixture.ts";
import { createStudyTools, studyCliArguments, STUDY_TOOLS } from "../scripts/lib/design-partner-tools.mjs";
import { nativeStreamAccounting } from "../scripts/lib/design-partner-native.mjs";
const owned: string[] = [];
afterEach(async () => { for (const directory of owned.splice(0)) await fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
const temporary = async () => { const directory = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-study-tools-")); owned.push(directory); return directory; };

it("delivers exact image blocks and real CLI/browser actions through an actual stdio MCP client", async () => {
  const fixture = await questionnaireFixture(), directory = await temporary(), workspace = path.join(directory, "workspace"); await fs.mkdir(workspace);
  await fixture.client.claimActor({ type: "actor.claim", sessionKey: "claude:study-agent", name: "Acme Study Designer" });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=", "base64");
  await fs.writeFile(path.join(workspace, "pixel.png"), png);
  await fs.writeFile(path.join(workspace, "screen.html"), "<!doctype html><title>Acme synthetic transport</title><input id=\"quantity\" type=\"number\" value=\"0\"><form onsubmit=\"event.preventDefault();document.querySelector('#result').textContent='SAVED'\"><input id=\"name\" value=\"Existing\"><select id=\"choice\" size=\"2\"><option value=\"one\">One</option><option value=\"two\">Two</option></select><input id=\"checked\" type=\"checkbox\"><button id=\"submit\">Submit</button></form><output id=\"result\">Empty</output><button id=\"save\" onclick=\"this.textContent='Saved'\">Save</button>");
  const config = { source: process.cwd(), workspace, home: fixture.home, base: fixture.base, canvasId: fixture.canvasId, condition: "B", runId: "synthetic", fixtureId: "inventory", sessionId: "study-agent", deadline: new Date(Date.now() + 25_000).toISOString(), evidence: path.join(directory, "evidence"), questions: path.join(directory, "questions") };
  const configFile = path.join(directory, "config.json"); await fs.writeFile(configFile, JSON.stringify(config));
  const client = new Client({ name: "synthetic-independent-test", version: "1" });
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.resolve("scripts/lib/design-partner-mcp.mjs"), configFile], env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" }, stderr: "pipe" });
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(STUDY_TOOLS.map(tool => tool.name));
    const image = await client.callTool({ name: "read_file", arguments: { path: "pixel.png" } });
    const block = (image.content as any[]).find((part: any) => part.type === "image") as any;
    expect(block.mimeType).toBe("image/png"); expect(Buffer.from(block.data, "base64")).toEqual(png);
    const ls = await client.callTool({ name: "cli", arguments: { args: ["ls", "--json"] } }); expect(ls.isError).not.toBe(true);
    const json = JSON.parse(((ls.content as any[])[0] as any).text); expect(json, JSON.stringify(json)).toMatchObject({ code: 0 }); expect(json.stdout).toContain(fixture.briefItem.id);
    await fs.writeFile(path.join(directory, "private.js"), "PRIVATE_SENTINEL_CONTENT");
    await fs.writeFile(path.join(workspace, "concurrent.html"), "<!doctype html><p>Safe captured content</p>");
    const adding = client.callTool({ name: "cli", arguments: { args: ["add", "concurrent.html"] } });
    const changing = client.callTool({ name: "write_file", arguments: { path: "concurrent.html", content: '<script src="../private.js"></script>' } });
    const [added, changed] = await Promise.all([adding, changing]); expect(added.isError).not.toBe(true); expect(changed.isError).not.toBe(true);
    expect(JSON.parse((added.content as any[])[0].text).code).toBe(0);
    const safeCanvas = (await fixture.client.snapshot(fixture.canvasId)).canvas;
    const safeItem = Object.values(safeCanvas.items).find(item => item.versions.some(version => version.filename === "concurrent.html"))!;
    expect((await fixture.client.downloadBlob(fixture.canvasId, safeItem.versions[0]!.blobHash)).toString()).toContain("Safe captured content");
    const ordered = (await fs.readFile(path.join(directory, "evidence/tools.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line));
    const writeStart = ordered.find(row => row.kind === "tool-start" && row.name === "write_file" && row.input.path === "concurrent.html");
    const addStart = ordered.find(row => row.kind === "tool-start" && row.name === "cli" && row.input.args[1] === "concurrent.html");
    expect(ordered.find(row => row.kind === "tool-result" && row.startSequence === addStart.sequence).sequence).toBeLessThan(writeStart.sequence);

    await fs.writeFile(path.join(workspace, "unsafe.html"), '<script src="../private.js"></script>');
    const before = (await fixture.client.snapshot(fixture.canvasId)).canvas;
    const unsafeAdd = await client.callTool({ name: "cli", arguments: { args: ["add", "unsafe.html"] } }); expect(unsafeAdd.isError).toBe(true); expect(JSON.stringify(unsafeAdd)).not.toContain("PRIVATE_SENTINEL_CONTENT");
    expect((await fixture.client.snapshot(fixture.canvasId)).canvas).toEqual(before);
    await client.callTool({ name: "browser", arguments: { action: "navigate", url: "task:screen.html" } });
    let observed: any;
    const deadline = Date.now() + 5000;
    do { const snapshot = await client.callTool({ name: "browser", arguments: { action: "snapshot" } }); observed = JSON.parse(((snapshot.content as any[])[0] as any).text); if (observed.controls?.some((row: any) => row.id === "save")) break; } while (Date.now() < deadline);
    expect(observed.controls.some((row: any) => row.id === "save")).toBe(true);
    for (const [selector, text] of [["#quantity", "4"], ["#quantity", "2"], ["#name", "Acme"]]) {
      await client.callTool({ name: "browser", arguments: { action: "fill", selector, text } });
      const current = await client.callTool({ name: "browser", arguments: { action: "snapshot" } });
      expect(JSON.parse(((current.content as any[])[0] as any).text).controls.find((row: any) => row.id === selector.slice(1)).value).toBe(text);
    }
    const key = async (key: string) => { const result = await client.callTool({ name: "browser", arguments: { action: "key", key } }); expect(result.isError).not.toBe(true); };
    const state = async () => JSON.parse(((await client.callTool({ name: "browser", arguments: { action: "snapshot" } })).content as any[])[0].text);
    await key("Enter"); expect((await state()).text).toContain("SAVED");
    await key("ArrowLeft"); await key("Backspace"); await key("ArrowRight"); await key(" ");
    expect((await state()).controls.find((row: any) => row.id === "name").value).toBe("Ace ");
    await key("Tab"); expect((await state()).activeId).toBe("choice"); await key("ArrowDown"); await key("ArrowDown");
    expect((await state()).controls.find((row: any) => row.id === "choice").value).toBe("two");
    await key("ArrowUp"); expect((await state()).controls.find((row: any) => row.id === "choice").value).toBe("one");
    await key("Tab"); expect((await state()).activeId).toBe("checked"); await key(" ");
    expect((await state()).controls.find((row: any) => row.id === "checked").checked).toBe(true);
    const canvas = await client.callTool({ name: "browser", arguments: { action: "navigate", url: fixture.base + "/p/" + fixture.canvasId } }); expect(canvas.isError).toBe(true);
    await client.callTool({ name: "browser", arguments: { action: "click", selector: "#save" } });
    const snapshot = await client.callTool({ name: "browser", arguments: { action: "snapshot" } }); expect(((snapshot.content as any[])[0] as any).text).toContain("Saved");
    const shot = await client.callTool({ name: "browser", arguments: { action: "screenshot" } }); expect((shot.content as any[]).some((part: any) => part.type === "image" && part.mimeType === "image/png")).toBe(true);
    const forbidden = await client.callTool({ name: "read_file", arguments: { path: "../config.json" } }); expect(forbidden.isError).toBe(true);
    const trace = await fs.readFile(path.join(directory, "evidence/tools.jsonl"), "utf8"); expect(trace).toContain('"deliveredAs":"MCP image content"'); expect(trace).not.toContain(png.toString("base64"));
  } finally { await client.close(); await transport.close(); await fixture.close(); }
});

it("binds all workflow file options and preserves only supplied inaccessible URL metadata", async () => {
  const directory = await temporary(), config: any = { workspace: directory, base: "http://127.0.0.1:1234", canvasId: "prj_acme", condition: "B", mapping: { unavailableReferences: [{ url: "https://supplied.invalid/reference", state: "inaccessible" }] } };
  await fs.writeFile(path.join(directory, "intent.json"), JSON.stringify({ references: [{ url: "https://supplied.invalid/reference", state: "inaccessible", reason: "Supplied reference is unavailable" }] }));
  for (const verb of ["--update", "--resume", "--cancel", "--complete", "--publish", "--reference", "--application", "--context"]) expect((await studyCliArguments(["design", "brief", "req_acme", verb, "intent.json"], config)).at(-1)).toBe(await fs.realpath(path.join(directory, "intent.json")));
  expect(await studyCliArguments(["design", "receipt", "req_acme", "--publish", "intent.json"], config)).toHaveLength(5);
  await expect(studyCliArguments(["command", "add", "--from", "owner/repo/file"], config)).rejects.toThrow(/read-only/);
  await expect(studyCliArguments(["design", "receipt", "--publish=../private.json"], config)).rejects.toThrow();
  await fs.writeFile(path.join(directory, "intent.json"), JSON.stringify({ home: "https://foreign.invalid", canvasId: "prj_acme" }));
  await expect(studyCliArguments(["design", "start", "intent.json"], config)).rejects.toThrow(/outside/);
  await fs.writeFile(path.join(directory, "intent.json"), JSON.stringify({ canvasId: "prj_sibling" }));
  await expect(studyCliArguments(["design", "start", "intent.json"], config)).rejects.toThrow(/another canvas/);
});

it("refuses extra browser/export capabilities and transitive inliner escapes while retaining contained supports", async () => {
  const directory = await temporary(), workspace = path.join(directory, "workspace"); await fs.mkdir(workspace);
  const config: any = { workspace, base: "http://127.0.0.1:1234", canvasId: "prj_acme", condition: "B" };
  await fs.writeFile(path.join(directory, "private.js"), "const PRIVATE_SENTINEL = true;");
  await fs.writeFile(path.join(directory, "private.png"), "private-image-sentinel");
  await fs.writeFile(path.join(workspace, "safe.css"), "body{color:navy}");
  await fs.writeFile(path.join(workspace, "output.html"), '<link rel="stylesheet" href="safe.css"><main>Acme</main>');
  expect(await studyCliArguments(["add", "output.html"], config)).toHaveLength(2);
  expect(await studyCliArguments(["add", "output.html", "--visual", "output.html"], config)).toHaveLength(4);
  for (const args of [["canvas", "shot", "prj_acme"], ["export", "--git", "https://outside.invalid/repo"], ["add", "output.html", "--visual=../private.js"]]) await expect(studyCliArguments(args, config)).rejects.toThrow();
  for (const html of ['<script src="../private.js"></script>', '<img src="%2e%2e/private.png">', '<link rel="stylesheet" href="unsafe.css">', '<script>const image="../private.png"</script>']) {
    await fs.writeFile(path.join(workspace, "output.html"), html);
    await fs.writeFile(path.join(workspace, "unsafe.css"), 'body{background:url("../private.png")}');
    await expect(studyCliArguments(["add", "output.html"], config)).rejects.toThrow(/contained/);
  }
  await fs.symlink(path.join(directory, "private.js"), path.join(workspace, "literal%20name.css"));
  await fs.writeFile(path.join(workspace, "output.html"), '<link rel="stylesheet" href="literal%20name.css">');
  await expect(studyCliArguments(["add", "output.html"], config)).rejects.toThrow(/symbolic/);
  await fs.mkdir(path.join(workspace, "nested"));
  await fs.writeFile(path.join(workspace, "nested/script.js"), 'const image="fallback.png"');
  await fs.symlink(path.join(directory, "private.png"), path.join(workspace, "fallback.png"));
  await fs.writeFile(path.join(workspace, "output.html"), '<script src="nested/script.js"></script>');
  await expect(studyCliArguments(["add", "output.html"], config)).rejects.toThrow(/symbolic/);
  await fs.writeFile(path.join(workspace, "note.md"), '![Supplied][reference]\n\n[reference]: ../private.png');
  await expect(studyCliArguments(["add", "note.md"], config)).rejects.toThrow(/contained/);
  await fs.symlink(path.join(directory, "private.js"), path.join(workspace, "escape.js"));
  await fs.writeFile(path.join(workspace, "output.html"), '<script src="escape.js"></script>');
  await expect(studyCliArguments(["edit", "itm_acme", "output.html"], config)).rejects.toThrow(/symbolic/);
  await fs.writeFile(path.join(workspace, "output.html"), '<img src="https://supplied.invalid/image">');
  expect(await studyCliArguments(["add", "output.html"], config)).toHaveLength(2);
});

it("retains review markers across MCP reconnection without forcing the baseline to review", async () => {
  const directory = await temporary(), config: any = { workspace: directory, evidence: path.join(directory, "evidence"), questions: path.join(directory, "questions"), deadline: new Date(Date.now() + 2000).toISOString() };
  let tools = await createStudyTools(config);
  await tools.invoke("review_phase", { phase: "review", reason: "Inspect current task" }); await tools.invoke("review_phase", { phase: "repair", reason: "Correct observed save defect" }); await tools.close();
  tools = await createStudyTools(config);
  await expect(tools.invoke("review_phase", { phase: "review", reason: "Reset count" })).rejects.toThrow(/budget/);
  expect(await tools.invoke("review_phase", { phase: "repair", reason: "Correct remaining mobile overflow" })).toMatchObject({ repairRounds: 2 });
  await expect(tools.invoke("review_phase", { phase: "repair", reason: "Third attempt" })).rejects.toThrow(/budget/); await tools.close();
  const other = await createStudyTools({ ...config, evidence: path.join(directory, "other") }); expect(await other.invoke("review_phase", { phase: "finish", reason: "No final review elected" })).toMatchObject({ reviewed: false, repairRounds: 0 }); await other.close();
});

it("counts evolving same-message usage without double-counting repeated input/cache tokens", () => {
  const profile = { model: "synthetic", tools: [] }, limits = { turnsPerRun: 3, tokensPerRun: 25, outputTokensPerTurn: 20, perRunApiEquivalentUsd: 2 };
  const parser = nativeStreamAccounting(profile, limits);
  const input = [{ type: "system", subtype: "init", model: "synthetic", tools: [], mcp_servers: [{ name: "study", status: "connected" }] }, { type: "assistant", message: { id: "one", usage: { input_tokens: 10, output_tokens: 1, cache_read_input_tokens: 2, cache_creation_input_tokens: 3 } } }, { type: "assistant", message: { id: "one", usage: { input_tokens: 10, output_tokens: 15, cache_read_input_tokens: 2, cache_creation_input_tokens: 3 } } }];
  expect(parser.append(Buffer.from(input.map(row => JSON.stringify(row)).join("\n") + "\n"))).toContain("global"); expect(parser.finish()).toMatchObject({ assistantTurns: 1, observedTokens: 30 });
});
