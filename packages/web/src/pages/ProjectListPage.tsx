import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Actor, MetaPatch, Project } from "@isocan/core";
import { newProjectId } from "@isocan/core";
import { listProjects, sendOp } from "../lib/api.ts";
import { ProjectEditor } from "../components/ProjectEditor.tsx";

export function ProjectListPage({ actor }: { actor: Actor }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [title, setTitle] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listProjects().then(setProjects, () => setProjects([]));
  }, []);
  useEffect(refresh, [refresh]);

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
        <span className="who">{actor.name}</span>
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
                  <Link to={`/p/${project.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {project.title}
                  </Link>
                </h3>
                <div className="desc">{project.description || "No description"}</div>
                <div className="meta">
                  updated {new Date(project.updatedAt).toLocaleString()} by {project.updatedBy.name}
                </div>
                <div className="row">
                  <Link className="btn" to={`/p/${project.id}`}>
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
