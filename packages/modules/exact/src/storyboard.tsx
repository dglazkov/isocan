/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useEffect, useState } from "react";
import { newVersionId, type Operation, type RendererFacts } from "@isocan/core";
import { EXACT_PROPS, appIdOf } from "./core.ts";
import { HOST_NAMES, type Host } from "./hosts.ts";
import { exactBridge, exactCanvas, useDoor, useExactStore } from "./live.tsx";
import { parseRunAnswer, parseStory, storyText, withRun, type RunReport, type Storyboard, type StoryRun } from "./story.ts";

/**
 * **A test as a storyboard, in the browser** (exact phase 5; journey Scene 5).
 * A row of steps — each under the frame it acted on — per host it has run
 * on, green, red at the step that failed (with Exact's reason, the frame and
 * the driver's tree there) or grey where the run never reached. **Run** on a
 * host, or on all of them, through one of two doors:
 *
 * - **door open, bridge paired** — the bridge's `/run` runs Exact's own
 *   `test <host>` and answers the report with its frames; this browser keeps
 *   it as the storyboard's next version (`withRun`, the CLI's computation);
 * - **door shut** (*Live frames* off, a home not on this machine, no bridge)
 *   — the browser writes `exact.run` on the storyboard and reaches nothing on
 *   this machine; `isocan exact live` runs it with the CLI's own code and the
 *   run arrives as the storyboard's next version, answered by `exact.ran`.
 */

const ORDER: Host[] = ["web", "ios", "macos"];

export function StoryboardCard(facts: RendererFacts) {
  const { item, blobHash, readText, canvasId } = facts;
  useExactStore();
  const [parsed, setParsed] = useState<{ hash: string; story?: Storyboard; problem?: string } | null>(null);
  const [status, setStatus] = useState<{ state: "idle" | "running" | "done" | "failed"; via?: "bridge" | "canvas"; seq?: number; hosts?: string[]; said?: string }>({ state: "idle" });
  const [bridge, setBridge] = useState<Awaited<ReturnType<typeof exactBridge>>>(null);
  useEffect(() => {
    let live = true;
    readText()
      .then((t) => { if (live) setParsed({ hash: blobHash, story: parseStory(t) }); })
      .catch((err: unknown) => { if (live) setParsed({ hash: blobHash, problem: err instanceof Error ? err.message : String(err) }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobHash]);
  const door = facts.localTool?.("exact") ?? null;
  const tick = useDoor(door);
  const open = !!door && !door.shut;
  const appId = item ? appIdOf(item) : null;
  useEffect(() => {
    let alive = true;
    if (!open || !appId) { setBridge(null); return; }
    void exactBridge(door!, appId).then((b) => { if (alive) setBridge(b); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appId, tick]);

  const canvas = exactCanvas();
  const answer = parseRunAnswer(canvas?.contents.items[item?.id ?? ""]?.properties?.[EXACT_PROPS.ran]);
  // The canvas door's answer arrives on the storyboard, its runs as the new version.
  useEffect(() => {
    if (status.state !== "running" || status.via !== "canvas" || !answer || answer.seq !== status.seq) return;
    const words = Object.entries(answer.hosts).map(([h, a]) => `${HOST_NAMES[h as Host] ?? h} ${a.verdict === "ok" ? "green" : a.verdict === "fail" ? `red at line ${a.line}` : a.verdict}`).join(", ");
    setStatus({ state: answer.ok ? "done" : "failed", via: "canvas", said: `ran in ${(answer.ms / 1000).toFixed(1)} s — ${words}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer?.seq, status.seq, status.state]);

  if (!parsed || parsed.hash !== blobHash) return <div className="exact-index exact-note">Reading the storyboard…</div>;
  if (!parsed.story || !item) return <div className="exact-index exact-problem">{parsed.problem}</div>;
  const story = parsed.story;
  // The hosts this app has screens of on the canvas: where a run can be asked for.
  const hosts = ORDER.filter((h) => Object.values(canvas?.contents.items ?? {}).some((i) => appIdOf(i) === appId && (i.properties?.[EXACT_PROPS.host] ?? "web") === h && i.properties?.[EXACT_PROPS.route]));
  const shown = ORDER.filter((h) => story.runs[h]);
  const bridgeHosts = bridge?.hello.drive?.hosts ?? [];

  const run = async (want: string[]) => {
    if (!canvas || canvas.id !== canvasId) { setStatus({ state: "failed", said: "the canvas is not ready to run from here" }); return; }
    if (open && bridge && want.every((h) => bridgeHosts.includes(h))) {
      setStatus({ state: "running", via: "bridge", hosts: want });
      try {
        let current = story;
        const words: string[] = [];
        for (const on of want) {
          setStatus({ state: "running", via: "bridge", hosts: want, said: `running on ${HOST_NAMES[on as Host] ?? on}, on your machine…` });
          const r = await door!.fetch(bridge.port, "/run", { method: "POST", body: JSON.stringify({ host: on, file: story.file, test: story.test.name }) });
          const report = (await r.json()) as RunReport;
          if (!report.ok) throw new Error(report.error ?? `the bridge answered ${r.status}`);
          current = withRun(current, report, (f) => f.png ?? null, new Date().toISOString());
          words.push(`${HOST_NAMES[on as Host] ?? on} ${report.verdict === "ok" ? "green" : report.verdict === "fail" ? `red at line ${report.failed?.line}` : report.verdict}`);
        }
        // Kept as the storyboard's next version, as the CLI keeps a run.
        const bytes = storyText(current);
        const now = canvas.contents.items[item.id] ?? item;
        const put = await canvas.putBlob(new Blob([bytes], { type: "application/vnd.isocan.exact-storyboard+json" }), now.versions.at(-1)?.filename ?? "test.exact-storyboard.json");
        const v = now.versions.find((x) => x.id === now.currentVersionId) ?? now.versions.at(-1);
        if (v?.blobHash !== put.blobHash) {
          await canvas.send([{ type: "item.addVersion", itemId: item.id, version: { id: newVersionId(), blobHash: put.blobHash, mimeType: "application/vnd.isocan.exact-storyboard+json", filename: v?.filename ?? "test.exact-storyboard.json", size: put.size } } as Operation]);
        }
        setStatus({ state: "done", via: "bridge", said: `ran on your machine — ${words.join(", ")}` });
      } catch (err) {
        setStatus({ state: "failed", via: "bridge", said: err instanceof Error ? err.message : String(err) });
      }
      return;
    }
    // Off is a whole answer (design §5): ask on the canvas; `isocan exact live` runs it.
    const seq = Date.now();
    setStatus({ state: "running", via: "canvas", seq, hosts: want, said: `asked on the canvas — waiting for \`isocan exact live\` to run it on ${want.map((h) => HOST_NAMES[h as Host] ?? h).join(", ")}…` });
    try {
      await canvas.send([{ type: "item.update", itemId: item.id, patch: { properties: { [EXACT_PROPS.run]: JSON.stringify({ seq, by: canvas.viewer, hosts: want }) } } }]);
    } catch (err) {
      setStatus({ state: "failed", via: "canvas", said: err instanceof Error ? err.message : String(err) });
    }
  };

  const cols = story.test.steps.length;
  return (
    <div className="exact-story" data-exact-story={story.test.name} data-exact-running={status.state} data-exact-via={status.via ?? ""}>
      <div className="exact-story-head" onPointerDown={(e) => e.stopPropagation()}>
        <div>
          <h3>test “{story.test.name}”</h3>
          <p className="exact-note">{story.file}:{story.test.line} · {cols} steps{shown.length ? ` · last run ${shown.map((h) => `${HOST_NAMES[h]} ${verdictWord(story.runs[h]!)}`).join(", ")}` : " · not run yet"}</p>
        </div>
        <div className="exact-story-actions">
          {hosts.map((h) => <button key={h} type="button" className="exact-chip" disabled={status.state === "running"} onClick={() => void run([h])}>Run on {HOST_NAMES[h]}</button>)}
          {hosts.length > 1 && <button type="button" className="btn" disabled={status.state === "running"} onClick={() => void run(hosts)}>Run on all hosts</button>}
        </div>
      </div>
      {status.said && <p className={status.state === "failed" ? "exact-problem" : "exact-note"} role="status">{status.said}</p>}
      <div className="exact-story-grid" style={{ gridTemplateColumns: `72px repeat(${cols}, minmax(0, 1fr))` }}>
        <span />
        {story.test.steps.map((s) => <code key={s.line} className="exact-story-step" title={`line ${s.line}`}>{s.text}</code>)}
        {(shown.length ? shown : []).map((h) => {
          const r = story.runs[h]!;
          return [
            <span key={`${h}-name`} className={`exact-story-host exact-story-${r.verdict}`} data-exact-run-host={h} data-exact-verdict={r.verdict} data-exact-failed-line={r.failed?.line ?? ""}>{HOST_NAMES[h]}<br />{verdictWord(r)}</span>,
            ...story.test.steps.map((s, i) => {
              const step = r.steps[i];
              const src = step?.frame ? story.frames[step.frame] : undefined;
              return (
                <div key={`${h}-${s.line}`} className={`exact-story-cell exact-story-${step?.state ?? "unreached"}`} data-exact-step={`${h}:${s.line}`} data-exact-state={step?.state ?? "unreached"} title={`${s.text} — ${step?.state ?? "unreached"}`}>
                  {src ? <img src={src} alt={`${HOST_NAMES[h]} before ${s.text}`} draggable={false} /> : <span className="exact-note">{s.op.startsWith("expect") || s.op === "clock" ? "" : "—"}</span>}
                </div>
              );
            }),
          ];
        })}
      </div>
      {shown.filter((h) => story.runs[h]!.failed).map((h) => <Failure key={h} host={h} run={story.runs[h]!} story={story} />)}
    </div>
  );
}

const verdictWord = (r: StoryRun) => (r.verdict === "ok" ? "green" : r.verdict === "fail" ? "red" : r.verdict);

/** The step that failed on a host: Exact's reason, the frame it acted on, and what the driver's tree held there. */
function Failure({ host, run, story }: { host: Host; run: StoryRun; story: Storyboard }) {
  const f = run.failed!;
  const step = story.test.steps.find((s) => s.line === f.line);
  const src = f.frame ? story.frames[f.frame] : undefined;
  const named = (f.tree ?? []).filter((r) => r.testId || r.text);
  return (
    <div className="exact-story-failure" data-exact-failure={host} onPointerDown={(e) => e.stopPropagation()}>
      {src && <img src={src} alt={`${HOST_NAMES[host]} at the failing step`} draggable={false} />}
      <div>
        <strong>{HOST_NAMES[host]} stopped at {story.file}:{f.line ?? "?"}{step ? <> — <code>{step.text}</code></> : null}</strong>
        <p className="exact-problem" data-exact-reason>{f.reason}</p>
        {f.tree ? (
          <details>
            <summary>The driver's tree there ({f.tree.length} nodes shown)</summary>
            <ul className="exact-ax" data-exact-tree={JSON.stringify(named.map((r) => r.testId ?? r.text))}>
              {named.slice(0, 80).map((r, i) => <li key={i} style={{ paddingLeft: Math.min(r.depth, 12) * 6 }}>{r.type}{r.testId ? <> <span>{r.testId}</span></> : null}{r.text ? ` “${r.text}”` : ""}{r.label ? ` (${r.label})` : ""}</li>)}
            </ul>
          </details>
        ) : <p className="exact-note">{(f.reply as { note?: string } | null)?.note ?? "no tree was read"}</p>}
      </div>
    </div>
  );
}
