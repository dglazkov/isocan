import { useState } from "react";
import type { MetaPatch } from "@isocan/core";

/**
 * The web half of `isocan project edit`: title + description, straight to a
 * `project.update` patch. Shared by the project list (inline on the card) and
 * the canvas toolbar (popover under the name), so renaming reads the same way
 * wherever you are.
 */
export function ProjectEditor({
  title: initialTitle,
  description: initialDescription,
  onSave,
  onCancel,
}: {
  title: string;
  description: string;
  onSave: (patch: MetaPatch) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const changed = trimmedTitle !== initialTitle || trimmedDescription !== initialDescription;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmedTitle || busy) return;
    if (!changed) {
      onCancel();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Only what moved: an untouched description stays absent from the patch
      // rather than round-tripping through the oplog as a no-op.
      const patch: MetaPatch = {};
      if (trimmedTitle !== initialTitle) patch.title = trimmedTitle;
      if (trimmedDescription !== initialDescription) patch.description = trimmedDescription;
      await onSave(patch);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form
      className="project-editor"
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <input
        className="text-input"
        autoFocus
        placeholder="Project title"
        aria-label="Project title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="text-input"
        rows={2}
        placeholder="Description"
        aria-label="Project description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          // Enter is a newline here; ⌘/Ctrl+Enter commits, as in the composer.
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(e);
        }}
      />
      {error && <div className="project-editor-error">{error}</div>}
      <div className="row">
        <button className="btn primary" type="submit" disabled={!trimmedTitle || busy}>
          Save
        </button>
        <button className="btn" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
