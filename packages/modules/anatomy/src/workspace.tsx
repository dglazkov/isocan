import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { explorationLayout, explorationState, type ExplorationLayout } from "./exploration.ts";
import { InspectorPane } from "./inspector-pane.tsx";
import ReactMarkdown from "react-markdown";
import type { CanvasContents, Item, WorkspaceFacts } from "@isocan/core";
import { newId } from "@isocan/core";
import {
  AXES,
  AXIS_LABELS,
  DISCIPLINES,
  DISCIPLINE_LABELS,
  STATUSES,
  PROP,
  currentVersion,
  projectsOn,
  nodesOn,
  originId,
  readProject,
  convergence,
  decisions,
  projectNeighborhood,
  nodeSchema,
  type AnatomyNode,
  type AnatomyProject,
  type Checkpoint,
  type Evidence,
} from "./core.ts";
import {
  attachSource,
  commentOp,
  emptyProject,
  importProject,
  promoteMock,
  restoreCheckpoint,
  saveCheckpoint,
  saveEdge,
  saveNode,
  saveProject,
  requestAnalysis,
  type AnatomyIO,
} from "./operations.ts";
import "./style.css";

type Lens = "blueprint" | "overview" | "decisions" | "coverage";
function download(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const status = (value: string) => (
  <span className={`anatomy-status anatomy-${value}`}>{value}</span>
);

export default function Workspace({
  canvas,
  viewState,
  project: canvasRecord,
  host,
  selection,
  canEdit,
  canvasView,
}: WorkspaceFacts<ReactNode>) {
  const projects = projectsOn(canvas);
  const { projectId, lens, nodeId } = explorationState(viewState);
  const setProjectId = (id: string) => host.navigateView({ project: id, focus: null, lens: "blueprint" });
  const setLens = (next: Lens) => host.navigateView({ lens: next });
  const selectedProject =
    projects.find((p) => p.id === projectId) ??
    projects.find((p) => p.id === canvasRecord.properties[PROP.analysis]) ??
    projects[0];
  const repository =
    canvasRecord.properties[PROP.repository] ??
    canvasRecord.properties.repository ??
    "";
  const [loaded, setLoaded] = useState<{
    itemId: string;
    project: AnatomyProject;
    canvas: CanvasContents;
  } | null>(null);
  const project =
    loaded?.itemId === selectedProject?.id ? (loaded?.project ?? null) : null;
  const focal = nodeId ? { projectId: selectedProject?.id, nodeId } : null;
  const [search, setSearch] = useState("");
  const prefKey = `anatomy:pane:${canvasRecord.id}`;
  const [panePrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(prefKey) ?? "null") as { left?: boolean; right?: boolean; width?: number; height?: number } | null; } catch { return null; }
  });
  const [leftOpen, setLeftOpen] = useState(() => panePrefs?.left ?? window.innerWidth > 760);
  const [rightOpen, setRightOpen] = useState(() => panePrefs?.right ?? window.innerWidth > 760);
  const [inspectorSize, setInspectorSize] = useState({ width: Math.max(220, Math.min(560, Number(panePrefs?.width) || 340)), height: Math.max(120, Math.min(600, Number(panePrefs?.height) || 280)) });
  useEffect(() => {
    try { localStorage.setItem(prefKey, JSON.stringify({ left: leftOpen, right: rightOpen, ...inspectorSize })); } catch { /* Restricted storage leaves a normal session-local pane. */ }
  }, [prefKey, leftOpen, rightOpen, inspectorSize]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editor, setEditor] = useState<{
    node: AnatomyNode;
    canvas: CanvasContents;
    project: AnatomyProject;
    item: Item;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [checkpointTitle, setCheckpointTitle] = useState("");
  const io = useMemo<AnatomyIO>(
    () => ({
      read: host.readText,
      put: (text, mime, filename) =>
        host.putBlob(new Blob([text], { type: mime }), filename),
      send: host.send,
      snapshot: async () => host.getCanvas(),
    }),
    [host],
  );
  // Geometry and selection do not change file bodies. A drag never refetches
  // the graph, and hash-cached reads make a one-file edit a one-file download.
  const revision = JSON.stringify(
    Object.values(canvas.items)
      .filter(
        (i) =>
          i.id === selectedProject?.id ||
          i.properties[PROP.project] === selectedProject?.id,
      )
      .map((i) => [i.id, i.title, i.currentVersionId, i.properties]),
  );
  useEffect(() => {
    let live = true;
    if (!selectedProject) return;
    const snapshot = host.getCanvas();
    readProject(snapshot, selectedProject, host.readText)
      .then((p) => {
        if (live)
          setLoaded({
            itemId: selectedProject.id,
            project: p,
            canvas: snapshot,
          });
      })
      .catch((err: Error) => {
        if (live) setMessage(`Unable to read project: ${err.message}`);
      });
    return () => {
      live = false;
    };
    // The revision includes every durable field read above, but not geometry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, selectedProject?.id, host]);
  const nativeNodes = selectedProject
    ? nodesOn(canvas, selectedProject.id)
    : [];
  const selectedItem = nativeNodes.find((i) => selection.includes(i.id));
  const selected =
    project?.nodes.find(
      (n) => n.id === (selectedItem ? originId(selectedItem) : ""),
    ) ?? null;
  const openDecisions = project ? decisions(project) : [];
  const decision =
    selected && selected.status !== "settled"
      ? selected
      : (openDecisions[0] ?? null);
  const findNative = (id: string) =>
    nativeNodes.find((i) => originId(i) === id);
  const choose = (nodeId: string, focus = true) => {
    const item = findNative(nodeId);
    if (!item) return;
    host.select([item.id]);
    setRightOpen(true);
    if (window.innerWidth <= 760) setLeftOpen(false);
    if (focus) host.navigateView({ project: selectedProject!.id, focus: nodeId, lens: "blueprint" });
  };
  const jump = (nodeId: string) => {
    if (!project || !selectedProject) return;
    host.navigateView({ project: selectedProject.id, lens: "blueprint", focus: nodeId });
    choose(nodeId, false);
  };
  const fitGraph = () => {
    if (!selectedProject) return;
    host.navigateView({ project: selectedProject.id, focus: null, lens: "blueprint" });
    host.select([]);
    if (!nodeId) host.focus([selectedProject.id]);
  };
  const focalNode =
    focal?.projectId === selectedProject?.id
      ? project?.nodes.find((n) => n.id === focal?.nodeId)
      : undefined;
  const neighborhood =
    project && focalNode ? projectNeighborhood(project, focalNode.id) : null;
  const previousLayout = useRef<ExplorationLayout>();
  const presentedKey = useRef("");
  const viewKey = `${selectedProject?.id}:${lens}:${focalNode?.id ?? ""}`;
  useEffect(() => {
    if (!project || !selectedProject || lens !== "blueprint") { host.present(null); presentedKey.current = ""; return; }
    const layout = explorationLayout(project, focalNode?.id, previousLayout.current);
    previousLayout.current = layout;
    const native = new Map([[layout.root, selectedProject.id], ...nativeNodes.map(i => [originId(i), i.id] as [string, string])]);
    const items = Object.fromEntries(Object.entries(layout.items).flatMap(([id, bounds]) => native.has(id) ? [[native.get(id)!, bounds]] : []));
    const navigated = presentedKey.current !== viewKey;
    // One frame lets pane changes establish the actual visible stage first.
    const frame = requestAnimationFrame(() => {
      host.present({ items, isolate: true, ...(navigated ? { focusIds: [native.get(layout.focus)!], maxScale: 0.9 } : {}) });
      // Only a delivered frame consumes navigation; a superseded read can cancel
      // this callback before the native slot is ready.
      presentedKey.current = viewKey;
    });
    if (navigated) host.select(focalNode ? [native.get(focalNode.id)!] : []);
    return () => cancelAnimationFrame(frame);
    // Native movement is resolved by the host; body revisions are the graph input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, viewKey, host]);
  useEffect(() => () => host.present(null), [host]);
  // The host owns gestures; the module supplies their navigation meaning only
  // while its Blueprint is mounted. Other files retain the native viewer.
  useEffect(() =>
    host.onActivateItem((id) => {
      if (lens !== "blueprint" || !project) return false;
      if (id === selectedProject?.id) {
        fitGraph();
        return true;
      }
      const item = nativeNodes.find((n) => n.id === id);
      if (!item) return false;
      if (!project.nodes.some((n) => n.id === originId(item))) return true;
      jump(originId(item));
      return true;
    }),
  );
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      return true;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const editNode = (node: AnatomyNode) => {
    const item = loaded?.canvas.items[selectedProject?.id ?? ""];
    if (project && loaded && item)
      setEditor({ node, canvas: loaded.canvas, project, item });
  };
  const newNode = () =>
    editNode({
      id: newId("concept"),
      title: "",
      category: "structure",
      status: "missing",
      summary: "",
      reason: "",
      conflictAxis: "goal",
      evidence: [],
      marginalia: [],
      resolutionOptions: [],
    });
  const inspected = lens === "decisions" ? decision : selected;
  const inspectedItem = inspected ? findNative(inspected.id) : null;
  return (
    <div className="anatomy-workspace">
      <header className="anatomy-header">
        <div className="anatomy-project-picker">
          <span className="anatomy-mark" aria-hidden>
            ◈
          </span>
          <select
            aria-label="Anatomy project"
            value={selectedProject?.id ?? ""}
            onChange={(e) => {
              setProjectId(e.target.value);
              host.select([]);
              setMessage("");
              setEditor(null);
              setEvidence(null);
              setCheckpoint(null);
            }}
          >
            {!projects.length && <option value="">Choose a project</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          {project && (
            <span className="anatomy-convergence">
              {convergence(project.nodes)}% settled{" "}
              <small>{project.nodes.length} concepts</small>
            </span>
          )}
        </div>
        <nav aria-label="Exploration lenses" className="anatomy-tabs">
          {(
            [
              ["blueprint", "Blueprint"],
              ["decisions", "Open Decisions"],
              ["coverage", "Coverage"],
              ["overview", "Overview"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={lens === key}
              onClick={() => setLens(key)}
            >
              {label}
              {key === "decisions" && project ? (
                <small>{openDecisions.length}</small>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="anatomy-actions">
          {canEdit && selectedProject && (
            <button onClick={() => setCreating(true)}>New project</button>
          )}
          {project && selectedProject && (
            <button
              onClick={() =>
                void run(async () =>
                  download(
                    await readProject(
                      host.getCanvas(),
                      selectedProject,
                      host.readText,
                      true,
                    ),
                    "project.anatomy.json",
                  ),
                )
              }
            >
              Export
            </button>
          )}
          {canEdit && (
            <label className="anatomy-file-button">
              Import
              <input
                aria-label="Import Anatomy JSON"
                type="file"
                accept=".json"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void run(async () => {
                      const id = await importProject(
                        io,
                        JSON.parse(await file.text()),
                      );
                      setProjectId(id);
                      host.select([id]);
                      requestAnimationFrame(() => host.focus([id]));
                    });
                  e.target.value = "";
                }}
              />
            </label>
          )}
          {project && (
            <button
              aria-pressed={historyOpen}
              onClick={() => setHistoryOpen(!historyOpen)}
            >
              Checkpoints
            </button>
          )}
        </div>
      </header>
      <div className="anatomy-repository">
        <details>
          <summary>
            {repository
              ? `Repository: ${repository}`
              : "Associate a repository"}
          </summary>
          <form
            key={repository}
            onSubmit={(event) => {
              event.preventDefault();
              const value = String(
                new FormData(event.currentTarget).get("repository") ?? "",
              ).trim();
              void run(() =>
                host.send([
                  {
                    type: "project.update",
                    patch: { properties: { [PROP.repository]: value } },
                  },
                ]),
              );
            }}
          >
            <label>
              Repository path or URL{" "}
              <input
                name="repository"
                defaultValue={repository}
                disabled={!canEdit}
              />
            </label>
            {canEdit && <button disabled={busy}>Save repository</button>}
          </form>
        </details>
        {canEdit &&
          selectedProject &&
          canvasRecord.properties[PROP.analysis] !== selectedProject.id && (
            <button
              disabled={busy}
              onClick={() =>
                void run(() =>
                  host.send([
                    {
                      type: "project.update",
                      patch: {
                        properties: { [PROP.analysis]: selectedProject.id },
                      },
                    },
                  ]),
                )
              }
            >
              Attach to this project
            </button>
          )}
        {canEdit && (
          <button
            disabled={busy || !repository}
            onClick={() =>
              void run(async () => {
                await requestAnalysis(io, repository, selectedProject?.id);
                host.openChat();
                setMessage(
                  "Analysis requested in Chat. An agent with repository access can pick it up.",
                );
              })
            }
          >
            {selectedProject
              ? "Ask agent to update analysis"
              : "Ask agent to analyze"}
          </button>
        )}
      </div>
      {message && (
        <div className="anatomy-notice" role="alert">
          {message}
          <button onClick={() => setMessage("")}>Dismiss</button>
        </div>
      )}
      {busy && (
        <div className="anatomy-saving" role="status">
          Saving…
        </div>
      )}
      {!selectedProject ? (
        <section className="anatomy-empty">
          <span className="anatomy-mark">◈</span>
          <h1>See how a project fits together.</h1>
          <p>
            Explore its goals, structure, data and rules. Follow decisions back
            to the evidence, and discuss the concepts on your canvas.
          </p>
          {canEdit && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const id = await importProject(io, emptyProject(newTitle));
                  setProjectId(id);
                  host.select([id]);
                });
              }}
            >
              <input
                aria-label="New project name"
                placeholder="Project name"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
              />
              <button disabled={busy || !newTitle.trim()}>
                Create project
              </button>
            </form>
          )}
          <p>
            Import an Anatomy export above, or ask an agent to build a project
            here.
          </p>
        </section>
      ) : !project ? (
        <p className="anatomy-loading">Reading project files…</p>
      ) : (
        <>
          {historyOpen && (
            <section className="anatomy-checkpoints" aria-label="Checkpoints">
              <div>
                <strong>Evolution checkpoints</strong>
                <span>
                  Preview a saved graph, or restore its concepts and
                  relationships.
                </span>
              </div>
              {project.checkpoints.map((c) => (
                <button key={c.id} onClick={() => setCheckpoint(c)}>
                  {c.title} <small>{c.convergenceScore}%</small>
                </button>
              ))}
              {!project.checkpoints.length && <span>No checkpoints yet.</span>}
              {canEdit && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await saveCheckpoint(
                        io,
                        selectedProject,
                        project,
                        checkpointTitle,
                      );
                      setCheckpointTitle("");
                    });
                  }}
                >
                  <input
                    aria-label="Checkpoint title"
                    placeholder="Checkpoint title"
                    value={checkpointTitle}
                    onChange={(e) => setCheckpointTitle(e.target.value)}
                    required
                  />
                  <button disabled={busy || !checkpointTitle.trim()}>
                    Save checkpoint
                  </button>
                </form>
              )}
            </section>
          )}
          {lens === "blueprint" && (
            <>
              <div className="anatomy-canvas-tools">
                <button
                  aria-pressed={leftOpen}
                  onClick={() => {
                    setLeftOpen(!leftOpen);
                    if (window.innerWidth <= 760) setRightOpen(false);
                  }}
                >
                  Concepts
                </button>
                <nav
                  className="anatomy-breadcrumb"
                  aria-label="Exploration path"
                >
                  <button onClick={fitGraph}>All concepts</button>
                  {neighborhood &&
                    [...neighborhood.ancestors, neighborhood.focus].map((n) => (
                      <span key={n.id}>
                        {" "}
                        /{" "}
                        <button
                          aria-current={
                            n.id === focalNode?.id ? "location" : undefined
                          }
                          onClick={() => jump(n.id)}
                        >
                          {n.title}
                        </button>
                      </span>
                    ))}
                </nav>
                {selected && (
                  <button onClick={() => jump(selected.id)}>
                    Explore connections
                  </button>
                )}
                <button onClick={() => host.focus(focalNode ? [findNative(focalNode.id)!.id] : [selectedProject.id])}>Center view</button>

                <button
                  aria-pressed={rightOpen}
                  onClick={() => {
                    setRightOpen(!rightOpen);
                    if (window.innerWidth <= 760) setLeftOpen(false);
                  }}
                >
                  Inspector
                </button>
              </div>
              <div
                className={`anatomy-blueprint${leftOpen ? " has-tree" : ""}${rightOpen ? " has-inspector" : ""}`}
                style={
                  {
                    "--anatomy-inspector-width": `${inspectorSize.width}px`,
                    "--anatomy-inspector-height": `${inspectorSize.height}px`,
                  } as CSSProperties
                }
              >
                {leftOpen && (
                  <aside
                    className="anatomy-tree"
                    aria-label="Concept hierarchy"
                  >
                    <input
                      aria-label="Search concepts"
                      placeholder="Find a concept…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <Tree
                      nodes={project.nodes}
                      selected={selected?.id ?? null}
                      search={search}
                      choose={choose}
                      explore={jump}
                      ancestors={
                        selected
                          ? projectNeighborhood(
                              project,
                              selected.id,
                            ).ancestors.map((n) => n.id)
                          : []
                      }
                    />
                    {canEdit && (
                      <button className="anatomy-add" onClick={newNode}>
                        + Add concept
                      </button>
                    )}
                  </aside>
                )}
                <div className="anatomy-stage">{canvasView}</div>
                {rightOpen && (
                  <InspectorPane
                    {...inspectorSize}
                    resetKey={selected?.id ?? selectedProject.id}
                    resize={(axis, value) =>
                      setInspectorSize((size) => ({ ...size, [axis]: value }))
                    }
                  >
                    {selected && selectedItem ? (
                      <Inspector
                        key={selected.id}
                        node={selected}
                        item={selectedItem}
                        project={project}
                        canvas={canvas}
                        io={io}
                        canEdit={canEdit}
                        busy={busy}
                        edit={() => editNode(selected)}
                        evidence={setEvidence}
                        jump={jump}
                        run={run}
                        save={(node) =>
                          saveNode(io, canvas, selectedProject, project, node)
                        }
                        promote={() =>
                          promoteMock(
                            io,
                            canvas,
                            selectedProject,
                            project,
                            selected,
                          )
                        }
                        edge={(edge) =>
                          saveEdge(io, canvas, selectedProject, project, edge)
                        }
                      />
                    ) : (
                      <div>
                        <span className="anatomy-eyebrow">Goal & Intent</span>
                        <h2>{project.projectName}</h2>
                        <p className="anatomy-prose">
                          {project.goalStatement ||
                            "This project has no goal yet."}
                        </p>
                        <button onClick={() => setLens("overview")}>
                          {canEdit ? "Edit overview" : "Read overview"}
                        </button>
                        <hr />
                        <p>
                          {project.nodes.length} concepts,{" "}
                          {openDecisions.length} open decisions.
                        </p>
                        <p className="anatomy-muted">
                          Select a concept on the canvas or in the hierarchy to
                          inspect it.
                        </p>
                        {canEdit && (
                          <button onClick={newNode}>Add concept</button>
                        )}
                      </div>
                    )}
                  </InspectorPane>
                )}
              </div>
            </>
          )}
          {lens === "overview" && (
            <Overview
              key={selectedProject.id}
              project={project}
              canEdit={canEdit}
              busy={busy}
              item={loaded!.canvas.items[selectedProject.id]!}
              save={(item, p) => run(() => saveProject(io, item, p))}
            />
          )}
          {lens === "decisions" && (
            <div className="anatomy-decisions">
              <aside
                className="anatomy-decision-nav"
                aria-label="Open decisions"
              >
                {["conflict", "risk", "missing"].map((kind) => (
                  <section key={kind}>
                    <h3>
                      {kind === "missing"
                        ? "Missing"
                        : kind === "risk"
                          ? "Risks"
                          : "Conflicts"}{" "}
                      <small>
                        {openDecisions.filter((n) => n.status === kind).length}
                      </small>
                    </h3>
                    {openDecisions
                      .filter((n) => n.status === kind)
                      .map((n) => (
                        <button
                          key={n.id}
                          aria-pressed={decision?.id === n.id}
                          onClick={() => choose(n.id, false)}
                        >
                          {n.title}
                          <small>{AXIS_LABELS[n.category]}</small>
                        </button>
                      ))}
                  </section>
                ))}
              </aside>
              <main className="anatomy-report">
                {decision && inspectedItem ? (
                  <>
                    <button
                      className="anatomy-jump"
                      onClick={() => jump(decision.id)}
                    >
                      View in Blueprint →
                    </button>
                    <Inspector
                      key={decision.id}
                      node={decision}
                      item={inspectedItem}
                      project={project}
                      canvas={canvas}
                      io={io}
                      canEdit={canEdit}
                      busy={busy}
                      edit={() => editNode(decision)}
                      evidence={setEvidence}
                      jump={jump}
                      run={run}
                      save={(node) =>
                        saveNode(io, canvas, selectedProject, project, node)
                      }
                      promote={() =>
                        promoteMock(
                          io,
                          canvas,
                          selectedProject,
                          project,
                          decision,
                        )
                      }
                      edge={(edge) =>
                        saveEdge(io, canvas, selectedProject, project, edge)
                      }
                    />
                  </>
                ) : (
                  <>
                    <h1>
                      {project.nodes.length
                        ? "No open decisions"
                        : "No concepts yet"}
                    </h1>
                    <p>
                      {project.nodes.length
                        ? "Every recorded concept is settled."
                        : "Add concepts before assessing convergence."}
                    </p>
                  </>
                )}
              </main>
            </div>
          )}
          {lens === "coverage" && (
            <main className="anatomy-coverage">
              <h1>Cross-functional coverage</h1>
              <p>
                Every concept, its recorded assessments, and the evidence behind
                them.
              </p>
              <div className="anatomy-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Concept</th>
                      {DISCIPLINES.map((d) => (
                        <th key={d}>{DISCIPLINE_LABELS[d]}</th>
                      ))}
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {AXES.map((axis) => (
                      <CoverageGroup
                        key={axis}
                        axis={axis}
                        nodes={project.nodes.filter((n) => n.category === axis)}
                        jump={jump}
                        evidence={setEvidence}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </main>
          )}
        </>
      )}
      {editor && canEdit && (
        <NodeEditor
          saveError={message}
          node={editor.node}
          nodes={editor.project.nodes}
          busy={busy}
          close={() => setEditor(null)}
          save={(node) =>
            run(async () => {
              if (node.id !== editor.node.id)
                throw new Error("A concept’s id cannot change while editing");
              const id = await saveNode(
                io,
                editor.canvas,
                editor.item,
                editor.project,
                node,
              );
              setEditor(null);
              host.select([id]);
            })
          }
        />
      )}
      {creating && canEdit && (
        <Dialog title="New Anatomy project" close={() => setCreating(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const id = await importProject(io, emptyProject(newTitle));
                setProjectId(id);
                host.select([id]);
                setCreating(false);
                setNewTitle("");
              });
            }}
          >
            <label>
              Project name
              <input
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </label>
            <button disabled={busy || !newTitle.trim()}>Create project</button>
          </form>
        </Dialog>
      )}
      {evidence && project && selectedProject && (
        <SourceDialog
          evidence={evidence}
          project={project}
          projectItem={selectedProject}
          canvas={canvas}
          io={io}
          canEdit={canEdit}
          close={() => setEvidence(null)}
          run={run}
        />
      )}
      {checkpoint && selectedProject && (
        <Dialog title={checkpoint.title} close={() => setCheckpoint(null)}>
          <p>
            Saved {new Date(checkpoint.timestamp).toLocaleString()} ·{" "}
            {checkpoint.convergenceScore}% settled
          </p>
          <p>This is a saved snapshot. The live canvas has not changed.</p>
          <ul>
            {checkpoint.nodes.map((n) => (
              <li key={n.id}>
                {status(n.status)} {n.title}
                <p>{n.summary}</p>
              </li>
            ))}
          </ul>
          <button onClick={() => download(checkpoint, "checkpoint.json")}>
            Export checkpoint
          </button>
          {canEdit && (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await restoreCheckpoint(
                    io,
                    canvas,
                    selectedProject,
                    checkpoint,
                  );
                  setCheckpoint(null);
                })
              }
            >
              Restore these concepts
            </button>
          )}
        </Dialog>
      )}
    </div>
  );
}

function Tree({
  nodes,
  selected,
  search,
  choose,
  explore,
  ancestors,
}: {
  nodes: AnatomyNode[];
  selected: string | null;
  search: string;
  choose: (id: string) => void;
  explore: (id: string) => void;
  ancestors: string[];
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const nodeIds = new Set(nodes.map((n) => n.id));
  function row(node: AnatomyNode, depth: number, seen: Set<string>): ReactNode {
    if (seen.has(node.id)) return null;
    const next = new Set(seen).add(node.id),
      children = nodes.filter((n) => n.parentId === node.id);
    const open = !collapsed.has(node.id) || ancestors.includes(node.id);
    return (
      <div key={node.id}>
        <div
          className="anatomy-tree-row"
          style={{ paddingLeft: Math.min(depth, 8) * 14 }}
        >
          {children.length ? (
            <button
              className="anatomy-chevron"
              aria-label={`${open ? "Collapse" : "Expand"} ${node.title}`}
              onClick={() =>
                setCollapsed((old) => {
                  const next = new Set(old);
                  if (next.has(node.id)) next.delete(node.id);
                  else next.add(node.id);
                  return next;
                })
              }
            >
              {open ? "▾" : "▸"}
            </button>
          ) : (
            <span className="anatomy-chevron" />
          )}
          <button
            aria-pressed={selected === node.id}
            onClick={() => choose(node.id)}
            onDoubleClick={() => explore(node.id)}
            title={`${node.title}. Double-click to explore its connections.`}
          >
            <span className={`anatomy-axis anatomy-axis-${node.category}`}>
              {node.category[0]?.toUpperCase()}
            </span>
            <span>{node.title}</span>
            {node.status !== "settled" && (
              <span
                className={`anatomy-dot anatomy-${node.status}`}
                title={node.status}
              >
                ●
              </span>
            )}
          </button>
        </div>
        {open && children.map((child) => row(child, depth + 1, next))}
      </div>
    );
  }
  if (search.trim())
    return (
      <nav>
        {nodes
          .filter((n) =>
            `${n.title} ${n.summary}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((n) => (
            <button
              className="anatomy-search-result"
              key={n.id}
              onClick={() => choose(n.id)}
              onDoubleClick={() => explore(n.id)}
            >
              {n.title}
            </button>
          ))}
      </nav>
    );
  const roots = nodes.filter((n) => !n.parentId || !nodeIds.has(n.parentId));
  return (
    <nav>
      {roots.map((n) => row(n, 0, new Set()))}
      {!nodes.length && (
        <p className="anatomy-muted">The project starts with a clean canvas.</p>
      )}
    </nav>
  );
}

function Overview({
  project,
  item,
  canEdit,
  busy,
  save,
}: {
  project: AnatomyProject;
  item: Item;
  canEdit: boolean;
  busy: boolean;
  save: (item: Item, p: AnatomyProject) => Promise<boolean>;
}) {
  const original = useRef({ item, project });
  const [editing, setEditing] = useState(false),
    [goal, setGoal] = useState(""),
    [brief, setBrief] = useState("");
  return (
    <main className="anatomy-overview">
      <article>
        <span className="anatomy-eyebrow">Project overview</span>
        <h1>{project.projectName}</h1>
        {editing && canEdit ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save(original.current.item, {
                ...original.current.project,
                goalStatement: goal,
                brief,
              }).then((saved) => {
                if (saved) setEditing(false);
              });
            }}
          >
            <label>
              Goal & Intent
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={5}
              />
            </label>
            <label>
              Narrative overview (Markdown)
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={16}
              />
            </label>
            <div className="anatomy-actions">
              <button disabled={busy}>Save overview</button>
              <button type="button" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <section className="anatomy-goal">
              <h2>Goal & Intent</h2>
              <p>{project.goalStatement || "No goal defined."}</p>
              {canEdit && (
                <button
                  onClick={() => {
                    original.current = { item, project };
                    setGoal(project.goalStatement);
                    setBrief(project.brief ?? "");
                    setEditing(true);
                  }}
                >
                  Edit overview
                </button>
              )}
            </section>
            {project.brief ? (
              <ReactMarkdown>{project.brief}</ReactMarkdown>
            ) : (
              <p className="anatomy-muted">
                Add a narrative overview to explain how the project's concepts
                fit together.
              </p>
            )}
          </>
        )}
        {project.repoPath && (
          <p className="anatomy-muted">
            Repository: <code>{project.repoPath}</code>
          </p>
        )}
      </article>
    </main>
  );
}

type InspectorProps = {
  node: AnatomyNode;
  item: Item;
  project: AnatomyProject;
  canvas: WorkspaceFacts<ReactNode>["canvas"];
  io: AnatomyIO;
  canEdit: boolean;
  busy: boolean;
  edit: () => void;
  evidence: (e: Evidence) => void;
  jump: (id: string) => void;
  run: (action: () => Promise<unknown>) => Promise<boolean>;
  save: (node: AnatomyNode) => Promise<unknown>;
  promote: () => Promise<void>;
  edge: (edge: unknown) => Promise<void>;
};
function Inspector({
  node,
  item,
  project,
  canvas,
  io,
  canEdit,
  busy,
  edit,
  evidence,
  jump,
  run,
  save,
  promote,
  edge,
}: InspectorProps) {
  const [comment, setComment] = useState(""),
    [target, setTarget] = useState(""),
    [relation, setRelation] = useState("");
  const nativeComments = Object.values(canvas.threads)
    .filter((t) => t.anchorItemId === item.id)
    .flatMap((t) => t.comments);
  const history = node.marginalia.filter(
    (c) => !nativeComments.some((n) => n.id === c.id),
  );
  const parents = project.nodes.filter((n) => n.id === node.parentId);
  const outgoing = project.edges.filter((e) => e.from === node.id),
    incoming = project.edges.filter((e) => e.to === node.id);
  return (
    <>
      <div className="anatomy-meta">
        {status(node.status)}
        <span>{AXIS_LABELS[node.category]}</span>
        {node.priority && <span>Priority {node.priority}</span>}
        {node.reversibility && <span>Reversibility {node.reversibility}</span>}
      </div>
      <h2>{node.title}</h2>
      <p className="anatomy-prose">{node.summary}</p>
      {node.status !== "settled" && (
        <section>
          <h3>The concern</h3>
          <p className="anatomy-prose">
            {node.reason || node.knockOnReason || "No rationale recorded."}
          </p>
          {node.conflictAxis && (
            <p className="anatomy-muted">
              {AXIS_LABELS[node.category]} in tension with{" "}
              {AXIS_LABELS[node.conflictAxis]}.
            </p>
          )}
        </section>
      )}
      {canEdit && <button onClick={edit}>Edit concept</button>}
      <section>
        <h3>Discipline assessments</h3>
        {DISCIPLINES.map((d) => (
          <div className="anatomy-assessment" key={d}>
            <strong>{DISCIPLINE_LABELS[d]}</strong>
            {node.lenses?.[d] ? (
              <>
                {status(node.lenses[d]!.status)}
                <p>{node.lenses[d]!.reason || node.lenses[d]!.summary}</p>
              </>
            ) : (
              <span className="anatomy-muted">Not assessed</span>
            )}
          </div>
        ))}
      </section>
      {!!parents.length && (
        <section>
          <h3>Supports</h3>
          {parents.map((n) => (
            <button key={n.id} onClick={() => jump(n.id)}>
              {n.title}
            </button>
          ))}
          <p>{node.parentRelation}</p>
        </section>
      )}
      {[
        ["Outgoing relationships", outgoing, "to"],
        ["Incoming relationships", incoming, "from"],
      ].map(([label, edges, end]) => {
        const list = edges as typeof outgoing;
        return list.length ? (
          <section key={label as string}>
            <h3>{label as string}</h3>
            {list.map((e) => {
              const id = end === "to" ? e.to : e.from;
              return (
                <div className="anatomy-relationship" key={e.id}>
                  <button onClick={() => jump(id)}>
                    {project.nodes.find((n) => n.id === id)?.title ?? id}
                  </button>
                  <p>
                    {e.label}
                    {e.coupling ? ` · ${e.coupling}` : ""}
                  </p>
                </div>
              );
            })}
          </section>
        ) : null;
      })}
      {canEdit && (
        <details>
          <summary>Add relationship</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await edge({
                  id: newId("edge"),
                  from: node.id,
                  to: target,
                  label: relation,
                });
                setRelation("");
              });
            }}
          >
            <select
              aria-label="Relationship target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
            >
              <option value="">Choose concept</option>
              {project.nodes
                .filter((n) => n.id !== node.id)
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
            </select>
            <input
              aria-label="Relationship label"
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              placeholder="Relationship"
            />
            <button disabled={busy || !target}>Add relationship</button>
          </form>
        </details>
      )}
      <section>
        <h3>Evidence & provenance</h3>
        {node.evidence.length ? (
          node.evidence.map((e, i) => (
            <button
              className="anatomy-evidence"
              key={i}
              onClick={() => evidence(e)}
            >
              <strong>{e.sourceTitle || e.sourceId}</strong>
              <span>{e.citation}</span>
              {e.snippet && <q>{e.snippet}</q>}
            </button>
          ))
        ) : (
          <p className="anatomy-muted">No evidence linked.</p>
        )}
      </section>
      {!!node.resolutionOptions.length && (
        <section>
          <h3>Possible resolutions</h3>
          {node.resolutionOptions.map((o) => (
            <div key={o.id} className="anatomy-resolution">
              <strong>{o.label}</strong>
              <p>{o.description}</p>
              {canEdit && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      save({
                        ...node,
                        summary: o.resultingSummary,
                        status: "settled",
                        reason: `Resolved: ${o.label}`,
                      }),
                    )
                  }
                >
                  Choose {o.label}
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      {node.proposedMock && (
        <section>
          <h3>{node.proposedMock.title}</h3>
          <MockPreview html={node.proposedMock.htmlContent} />
          <ul>
            {node.proposedMock.proposedConstraints.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          {node.proposedMock.status === "promoted" ? (
            <p>Promoted source artifact</p>
          ) : (
            canEdit && (
              <button disabled={busy} onClick={() => void run(promote)}>
                Approve and promote mock
              </button>
            )
          )}
        </section>
      )}
      {canEdit && (
        <label className="anatomy-file-button">
          Propose HTML mock
          <input
            aria-label="Propose HTML mock"
            type="file"
            accept=".html,.htm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void run(async () =>
                  save({
                    ...node,
                    proposedMock: {
                      title: file.name,
                      htmlContent: await file.text(),
                      proposedConstraints: [],
                      status: "draft",
                      updatedAt: new Date().toISOString(),
                    },
                  }),
                );
              e.target.value = "";
            }}
          />
        </label>
      )}
      <section>
        <h3>Discussion</h3>
        {history.length > 0 && (
          <details>
            <summary>Imported discussion ({history.length})</summary>
            {history.map((c) => (
              <p key={c.id}>
                <strong>{c.author}</strong> <small>{c.timestamp}</small>
                <br />
                {c.text}
              </p>
            ))}
          </details>
        )}
        {nativeComments.map((c) => (
          <div className="anatomy-comment" key={c.id}>
            <strong>{c.author.name}</strong>
            <p>{c.body}</p>
          </div>
        ))}
        {canEdit && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await io.send([commentOp(canvas, item, comment)]);
                setComment("");
              });
            }}
          >
            <textarea
              aria-label="Comment on concept"
              placeholder="Discuss this concept…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            <button disabled={busy || !comment.trim()}>Post comment</button>
          </form>
        )}
      </section>
    </>
  );
}

function CoverageGroup({
  axis,
  nodes,
  jump,
  evidence,
}: {
  axis: (typeof AXES)[number];
  nodes: AnatomyNode[];
  jump: (id: string) => void;
  evidence: (e: Evidence) => void;
}) {
  if (!nodes.length) return null;
  return (
    <>
      <tr className="anatomy-axis-row">
        <th colSpan={6}>
          {AXIS_LABELS[axis]} · {nodes.length} concepts
        </th>
      </tr>
      {nodes.map((n) => (
        <tr key={n.id}>
          <th>
            <button onClick={() => jump(n.id)}>{n.title}</button>
            {status(n.status)}
          </th>
          {DISCIPLINES.map((d) => (
            <td key={d}>
              {n.lenses?.[d] ? (
                <>
                  {status(n.lenses[d]!.status)}
                  <p>{n.lenses[d]!.reason || n.lenses[d]!.summary}</p>
                </>
              ) : (
                <span className="anatomy-muted">Not assessed</span>
              )}
            </td>
          ))}
          <td>
            {n.evidence.map((e, i) => (
              <button key={i} onClick={() => evidence(e)}>
                {e.sourceTitle || e.sourceId}
              </button>
            ))}
            {!n.evidence.length && (
              <span className="anatomy-muted">No artifacts linked</span>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <div
      className="anatomy-backdrop"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") close();
        if (e.key === "Tab") {
          const controls = Array.from(
            dialog.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
            ) ?? [],
          );
          const first = controls[0],
            last = controls.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
          if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <section
        ref={dialog}
        className="anatomy-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button onClick={close}>Close</button>
        </header>
        {children}
      </section>
    </div>
  );
}
function NodeEditor({
  saveError,
  node,
  nodes,
  busy,
  close,
  save,
}: {
  saveError: string;
  node: AnatomyNode;
  nodes: AnatomyNode[];
  busy: boolean;
  close: () => void;
  save: (n: AnatomyNode) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(node),
    [advanced, setAdvanced] = useState(JSON.stringify(node, null, 2)),
    [rawMode, setRawMode] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog title={node.title ? "Edit concept" : "Add concept"} close={close}>
      {saveError && <p role="alert">{saveError}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            void save(rawMode ? (JSON.parse(advanced) as AnatomyNode) : draft);
          } catch (err) {
            setError(String(err));
          }
        }}
      >
        <label>
          <input
            type="checkbox"
            checked={rawMode}
            onChange={(e) => {
              try {
                if (e.target.checked) setAdvanced(JSON.stringify(draft, null, 2));
                else setDraft(nodeSchema.parse(JSON.parse(advanced)));
                setRawMode(e.target.checked);
                setError("");
              } catch (err) {
                setError(`Keep editing the JSON to correct this error: ${String(err)}`);
              }
            }}
          />{" "}
          Edit complete JSON (citations, assessments and options)
        </label>
        {rawMode ? (
          <textarea
            aria-label="Concept JSON"
            rows={20}
            value={advanced}
            onChange={(e) => setAdvanced(e.target.value)}
          />
        ) : (
          <>
            <label>
              Title
              <input
                required
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <div className="anatomy-form-row">
              <label>
                Axis
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      category: e.target.value as AnatomyNode["category"],
                    })
                  }
                >
                  {AXES.map((a) => (
                    <option key={a} value={a}>
                      {AXIS_LABELS[a]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      status: e.target.value as AnatomyNode["status"],
                    })
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Summary
              <textarea
                required
                rows={4}
                value={draft.summary}
                onChange={(e) =>
                  setDraft({ ...draft, summary: e.target.value })
                }
              />
            </label>
            <label>
              Reason
              <textarea
                rows={3}
                value={draft.reason ?? ""}
                onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
              />
            </label>
            <div className="anatomy-form-row">
              <label>
                Axis in tension
                <select
                  value={draft.conflictAxis ?? ""}
                  onChange={(e) => {
                    const { conflictAxis: _axis, ...rest } = draft;
                    setDraft({
                      ...rest,
                      ...(e.target.value
                        ? {
                            conflictAxis: e.target
                              .value as AnatomyNode["category"],
                          }
                        : {}),
                    });
                  }}
                >
                  <option value="">None</option>
                  {AXES.map((a) => (
                    <option key={a} value={a}>
                      {AXIS_LABELS[a]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Parent
                <select
                  value={draft.parentId ?? ""}
                  onChange={(e) => {
                    const { parentId: _id, ...rest } = draft;
                    setDraft({
                      ...rest,
                      ...(e.target.value ? { parentId: e.target.value } : {}),
                    });
                  }}
                >
                  <option value="">Root concept</option>
                  {nodes
                    .filter((n) => n.id !== draft.id)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <button disabled={busy}>Save concept</button>
      </form>
    </Dialog>
  );
}

function MockPreview({ html }: { html: string }) {
  return (
    <iframe
      className="anatomy-mock"
      title="Mock proposal preview"
      sandbox="allow-scripts"
      srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:">${html}`}
    />
  );
}
function SourceDialog({
  evidence,
  project,
  projectItem,
  canvas,
  io,
  canEdit,
  close,
  run,
}: {
  evidence: Evidence;
  project: AnatomyProject;
  projectItem: Item;
  canvas: WorkspaceFacts<ReactNode>["canvas"];
  io: AnatomyIO;
  canEdit: boolean;
  close: () => void;
  run: (action: () => Promise<unknown>) => Promise<boolean>;
}) {
  const source = project.sources.find((s) => s.id === evidence.sourceId);
  const attachment = Object.values(canvas.items).find(
    (i) =>
      i.properties[PROP.project] === projectItem.id &&
      i.properties[PROP.source] === evidence.sourceId,
  );
  const [text, setText] = useState("");
  const hash = attachment ? currentVersion(attachment).blobHash : null;
  useEffect(() => {
    let live = true;
    setText("");
    if (hash)
      io.read(hash)
        .then((t) => {
          if (live) setText(t);
        })
        .catch((err: Error) => {
          if (live) setText(`Unable to read source: ${err.message}`);
        });
    return () => {
      live = false;
    };
  }, [hash, io]);
  return (
    <Dialog
      title={evidence.sourceTitle || source?.title || evidence.sourceId}
      close={close}
    >
      <code>{source?.pathOrUri || evidence.uri || evidence.sourceId}</code>
      {evidence.citation && <p>{evidence.citation}</p>}
      {evidence.snippet && <blockquote>{evidence.snippet}</blockquote>}
      {attachment ? (
        <pre className="anatomy-source">{text || "Loading source…"}</pre>
      ) : (
        <p className="anatomy-muted">
          This citation has no source file attached. The recorded snippet is
          shown above.
        </p>
      )}
      {canEdit && (
        <label className="anatomy-file-button">
          Attach source file
          <input
            aria-label="Attach source file"
            type="file"
            accept="text/*,.json,.ts,.tsx,.js,.jsx,.md,.py,.css,.html,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void run(async () =>
                  attachSource(
                    io,
                    canvas,
                    projectItem,
                    project,
                    evidence.sourceId,
                    await file.text(),
                    file.name,
                  ),
                );
            }}
          />
        </label>
      )}
    </Dialog>
  );
}
