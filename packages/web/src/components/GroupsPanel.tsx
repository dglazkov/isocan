import { useEffect, useState } from "react";
import type { Actor, GroupView, SweepReport } from "@isocan/core";
import { grantSubjectOf } from "@isocan/core";
import { addGroupMember, createGroup, deleteGroup, listGroups, removeGroupMember } from "../lib/api.ts";

/**
 * **Groups** (roles design, "The group"): a named set of people access is
 * given to once. This panel is where a person makes one and edits who is in
 * it; the Share dialog is where it is used. Opened from **Groups…** on the
 * canvas list, beside **New space**, because both are things made once and
 * used across canvases.
 *
 * What is listed is the owner's list — `GET /api/groups` answers the groups
 * this person made, members and all — and every control here is theirs,
 * because the daemon refuses anybody else with `not-owner`. A group somebody
 * is merely in is not listed anywhere: they meet it as a row's name and size
 * on the canvases it opens.
 *
 * Adding and removing a member both reach the room. The home sweeps every
 * canvas the group's rows reach and answers with how many, and the count is
 * shown as it answered rather than as this panel believes it should be —
 * `isocan group add|remove` prints the same line.
 */
export function GroupsPanel({ actor, onClose }: { actor: Actor; onClose: () => void }) {
  const [groups, setGroups] = useState<GroupView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  /** The address being typed into each group's add field, by group id. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  /** What the last member write reached, by group id. */
  const [reached, setReached] = useState<Record<string, { reached: number; swept: SweepReport }>>({});

  const reload = async (): Promise<void> => {
    setGroups((await listGroups()).groups);
  };

  useEffect(() => {
    let cancelled = false;
    listGroups()
      .then((answer) => !cancelled && setGroups(answer.groups))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  async function act(work: () => Promise<void>): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function make(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await act(async () => {
      await createGroup(name, actor.id);
      setNewName("");
    });
  }

  async function add(group: GroupView): Promise<void> {
    const who = (drafts[group.id] ?? "").trim();
    if (!who) return;
    await act(async () => {
      const answer = await addGroupMember(group.id, grantSubjectOf(who), actor.id);
      setDrafts((current) => ({ ...current, [group.id]: "" }));
      if (answer.reached !== undefined && answer.swept) {
        setReached((current) => ({ ...current, [group.id]: { reached: answer.reached!, swept: answer.swept! } }));
      }
    });
  }

  async function remove(group: GroupView, member: string): Promise<void> {
    await act(async () => {
      const answer = await removeGroupMember(group.id, member, actor.id);
      if (answer.reached !== undefined && answer.swept) {
        setReached((current) => ({ ...current, [group.id]: { reached: answer.reached!, swept: answer.swept! } }));
      }
    });
  }

  async function drop(group: GroupView): Promise<void> {
    await act(async () => {
      await deleteGroup(group.id, actor.id);
    });
  }

  return (
    <div
      className="share-menu"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="share-head">Groups</div>
      <div className="share-link-note">
        A group is a set of addresses you share a canvas or a space with once. Who is in it is read at
        the door, so taking somebody out reaches every canvas the group opens.
      </div>

      {error && <div className="identity-warning">{error}</div>}

      {groups !== null && groups.length === 0 && (
        <div className="share-link-note">No groups yet.</div>
      )}
      {(groups ?? []).map((group) => {
        const news = reached[group.id];
        return (
          <div key={group.id} className="groups-group">
            <div className="surface-row share-invited">
              <span className="surface-what">
                <b>{group.name}</b>
                <span className="share-roster-kind">
                  {group.size === 1 ? "1 member" : `${group.size} members`} · made {group.at.slice(0, 10)}
                </span>
              </span>
              <span className="share-row-controls">
                <button
                  className="btn danger"
                  disabled={busy}
                  title="Delete this group — its rows stop admitting anybody"
                  onClick={() => void drop(group)}
                >
                  Delete
                </button>
              </span>
            </div>
            {/* Members, each with its own remove. The home refuses anybody
                but the maker, so the controls are simply the maker's. */}
            <div className="groups-members">
              {(group.members ?? []).map((member) => (
                <span key={member} className="groups-member">
                  {member.replace(/^email:/, "")}
                  <button
                    className="btn quiet"
                    disabled={busy}
                    aria-label={`Remove ${member.replace(/^email:/, "")} from ${group.name}`}
                    title="Remove from the group — reaches every canvas it opens"
                    onClick={() => void remove(group, member)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <form
              className="share-address"
              onSubmit={(e) => {
                e.preventDefault();
                void add(group);
              }}
            >
              <input
                className="text-input"
                type="text"
                aria-label={`Add somebody to ${group.name}`}
                placeholder="someone@example.com"
                value={drafts[group.id] ?? ""}
                disabled={busy}
                onChange={(e) => setDrafts((current) => ({ ...current, [group.id]: e.target.value }))}
              />
              <button className="btn primary" type="submit" disabled={busy || !(drafts[group.id] ?? "").trim()}>
                Add
              </button>
            </form>
            {news && (
              <div className="share-link-note">
                {news.reached === 0
                  ? "Nothing shared with this group yet."
                  : `Reached ${news.reached === 1 ? "1 canvas" : `${news.reached} canvases`}. ${sweptWords(news.swept)}`}
              </div>
            )}
          </div>
        );
      })}

      {/* **New group**, last: a field and a button, the pair **New space**
          uses. */}
      <form className="share-address" onSubmit={make}>
        <input
          className="text-input"
          type="text"
          aria-label="Name a new group"
          placeholder="Name a new group…"
          value={newName}
          disabled={busy}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button className="btn primary" type="submit" disabled={busy || !newName.trim()}>
          New group
        </button>
      </form>
    </div>
  );
}

/** What a member write did to the people inside, in the Share dialog's
 * words. */
function sweptWords(swept: SweepReport): string {
  if (swept.expelled === 0 && swept.rerooted === 0) return "Nobody's standing changed.";
  const out = swept.expelled === 0 ? "" : `${swept.expelled === 1 ? "1 surface" : `${swept.expelled} surfaces`} lost a canvas.`;
  const moved = swept.rerooted === 0 ? "" : ` ${swept.rerooted === 1 ? "One" : String(swept.rerooted)} changed standing.`;
  return `${out}${moved}`.trim();
}
