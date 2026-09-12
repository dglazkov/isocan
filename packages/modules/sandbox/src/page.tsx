import type { PageFacts } from "@isocan/core";
import { workbenchItemPath } from "@isocan/core";
import { runOf, sandboxesOn, transcriptFor } from "./core.ts";

/**
 * **The Sandboxes page** — the chunk the module's record points at, fetched
 * when somebody opens it and never at boot.
 *
 * It lists, and it says where running happens. There is no Run button, and
 * that absence is the design rather than a gap: this surface has no machine
 * to run on, and a button that posted "somebody please run this" would be a
 * summons wearing a different word. The line under the title is what a
 * person does instead, and it is copyable.
 */
export function SandboxesPage({ canvasId, canvas }: PageFacts) {
  const programs = sandboxesOn(canvas);
  if (programs.length === 0) {
    return (
      <div className="docs-page">
        <p className="doc-quiet">
          No programs on this canvas. Bring a file, then <code>isocan sandbox set &lt;item&gt; --run "node build.mjs"</code>.
        </p>
      </div>
    );
  }
  return (
    <div className="docs-page">
      <p className="doc-quiet sandbox-note">
        A program runs on the machine that types its verb — never on this canvas's home, and never in this browser.
      </p>
      <ol className="docs-list">
        {programs.map((program) => {
          const out = transcriptFor(canvas, program.id);
          return (
            <li key={program.id} className="docs-row">
              <a href={workbenchItemPath(canvasId, program.id)}>
                <b>{program.title}</b>
                <small>
                  <code>{runOf(program)}</code>
                </small>
              </a>
              <p className="sandbox-runs">
                {out ? (
                  <>
                    {out.versions.length} run{out.versions.length === 1 ? "" : "s"}, last{" "}
                    {new Date(out.updatedAt).toLocaleDateString()} —{" "}
                    <a href={workbenchItemPath(canvasId, out.id)}>read the transcript</a>
                  </>
                ) : (
                  <>
                    never run — <code>isocan sandbox run {program.id}</code>
                  </>
                )}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default SandboxesPage;
