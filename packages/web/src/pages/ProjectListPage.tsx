import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Actor, MetaPatch, Project } from "@isocan/core";
import { canvasPath, newProjectId } from "@isocan/core";
import { listProjects, sendOp } from "../lib/api.ts";
import { actorColorIn, useActorColors } from "../lib/colors.ts";
import { useDismissOnOutside } from "../lib/dismiss.ts";
import { ProjectEditor } from "../components/ProjectEditor.tsx";
import { IdentityMenu } from "../components/IdentityMenu.tsx";
import { actorNameIn, useActorNames } from "../lib/names.ts";

export function ProjectListPage({
  actor,
  onIdentity,
}: {
  actor: Actor;
  onIdentity: (actor: Actor | null) => void;
}) {
  const colors = useActorColors();
  const names = useActorNames();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [title, setTitle] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const whoRef = useDismissOnOutside<HTMLDivElement>(identityOpen, () => setIdentityOpen(false));

  /**
   * The canvases **this origin is the home of** — not every canvas the daemon
   * holds (phase 10.3; `listProjects` in `lib/api.ts` carries the argument).
   *
   * Every title below is a `<Link>`, and a `<Link>` is a client-side
   * navigation that never touches the server. The daemon's per-canvas page
   * guard therefore cannot see it, and a wide list here would be a working
   * button that opens a local, stale second copy of a canvas that lives at
   * dev.isocan.io. The narrowing is what makes the list's links true: what you
   * can see here is what this door opens.
   *
   * A replica's canvases are not lost — `isocan status` lists every one of
   * them with its home, and each opens in a browser at the address that IS its
   * home. This page is one origin talking about itself.
   */
  const refresh = useCallback(() => {
    listProjects().then(setProjects, () => setProjects([]));
  }, []);
  useEffect(refresh, [refresh]);

  /**
   * A named seam, so the next person meets it as a known cost rather than as a
   * bug: **on a daemon with a birth default set, a canvas created here is born
   * at that home and will not appear in this list** — the list is "canvases
   * this origin is the home of", and the newborn's home is somewhere else. The
   * only rig where that is reachable is a mixed one (a birth default AND at
   * least one local canvas, since a pure replica serves no pages at all), and
   * the honest fix is a sentence saying where it went, with a link to it. That
   * needs `/api/homes` read at this page and a notice this page does not have;
   * phase 10.3's scope was the two changes that close the stale-replica hole,
   * and this is a follow-up rather than a silent omission.
   */
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    await sendOp(null, actor, { type: "project.create", projectId: newProjectId(), title: trimmed });
    setTitle("");
    refresh();
  }

  async function edit(project: Project, patch: MetaPatch) {
    await sendOp(project.id, actor, { type: "project.update", patch });
    setEditing(null);
    refresh();
  }

  async function remove(project: Project) {
    await sendOp(project.id, actor, { type: "project.delete" });
    setConfirmingDelete(null);
    refresh();
  }

  return (
    <div className="projects-page">
      <div className="projects-head">
        <h1>isocan</h1>
        <div className="who" ref={whoRef}>
          <button
            className={`who-btn${identityOpen ? " active" : ""}`}
            title="You — rename yourself, or enter as someone else"
            onClick={() => setIdentityOpen(!identityOpen)}
          >
            <span className="face-mark" style={{ background: actorColorIn(colors, actor.id) }}>
              {actor.name.charAt(0).toUpperCase()}
            </span>
            {actor.name}
          </button>
          {identityOpen && (
            <div className="identity-popover">
              <IdentityMenu
                actor={actor}
                /* No canvas here, so no pass to mint: escalation is onto one
                   canvas, and this page is about all of them. */
                projectId={null}
                onIdentity={onIdentity}
                onClose={() => setIdentityOpen(false)}
              />
            </div>
          )}
        </div>
      </div>
      <div className="project-grid">
        {(projects ?? []).map((project) => (
          <div className="project-card" key={project.id}>
            {editing === project.id ? (
              <ProjectEditor
                title={project.title}
                description={project.description}
                onSave={(patch) => edit(project, patch)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <>
                <h3>
                  <Link to={canvasPath(project.id)} style={{ color: "inherit", textDecoration: "none" }}>
                    {project.title}
                  </Link>
                </h3>
                <div className="desc">{project.description || "No description"}</div>
                <div className="meta">
                  updated {new Date(project.updatedAt).toLocaleString()} by {actorNameIn(names, project.updatedBy)}
                </div>
                <div className="row">
                  <Link className="btn" to={canvasPath(project.id)}>
                    Open
                  </Link>
                  <button
                    className="btn"
                    title="Edit title and description"
                    onClick={() => {
                      setEditing(project.id);
                      setConfirmingDelete(null);
                    }}
                  >
                    Edit
                  </button>
                  {confirmingDelete === project.id ? (
                    <>
                      <button className="btn danger" onClick={() => remove(project)}>
                        Really delete
                      </button>
                      <button className="btn" onClick={() => setConfirmingDelete(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button className="btn danger" onClick={() => setConfirmingDelete(project.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
        <form className="project-card create" onSubmit={create}>
          <input
            className="text-input"
            placeholder="New project title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button className="btn primary" type="submit" disabled={!title.trim()}>
            Create project
          </button>
        </form>
      </div>
      {projects === null && <p style={{ color: "var(--ink-muted)" }}>Loading…</p>}
    </div>
  );
}
