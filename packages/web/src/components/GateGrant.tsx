import { useState } from "react";
import {
  LISTEN_ANYONE,
  isSystemActor,
  listenUntil,
  mayWake,
  readsAsTurnedAway,
  rulesOf,
  sameActor,
  untilWords,
  withListener,
  type Actor,
  type Comment,
  type CommentThread,
} from "@isocan/core";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import { actorNameIn, useActorNames } from "../lib/names.ts";
import { useRcPolicies } from "../lib/answerable.ts";

/**
 * **The refusal is the control** (issue #272, 11 Sep 2026).
 *
 * Owner-only summons shipped that afternoon, and within the hour it did the
 * thing it was built to do: Dion asked Lamb — somebody else's agent — for a
 * canvas, and nothing woke. What the thread said was correct and complete,
 * and it was a command line:
 *
 * > Lamb listens only to Dimitri — this did not wake Lamb, and spent
 * > nothing. Dimitri can widen it: `isocan rc listen Lamb --to Dion`
 *
 * Dion's reaction is the whole issue: *"maybe we can have UI that lets you
 * give me access to a lamb … instead of just saying the command line lol"*.
 *
 * **So the thing that said no is where you say yes.** Not a settings panel
 * somebody has to find — the owner scrolling their own canvas reads the
 * refusal like everyone else, and under it, for them alone, are the two
 * buttons that answer it. Nothing is added anywhere for anybody else: a
 * stranger reads the words, which were already the right words.
 *
 * **Only the owner sees a control at all.** The gate lives in a record every
 * admitted member can write, and the rc sets aside a gate its owner did not
 * write (`answerPolicy`, `writtenBy`) — so a button offered to anybody else
 * would be a button whose click is silently discarded, which is worse than
 * no button. The reader is the owner exactly when the policy the rc
 * ANNOUNCED names them, which is the same value dispatch applies.
 *
 * **After the click, a line rather than a comment.** A grant that posted its
 * own system comment would fill a thread with machinery talking about
 * machinery, and the record already exists — it is the enrolment op. What
 * the thread needs is for the refusal above to stop reading as true, so the
 * same place says the gate moved: *Lamb listens to you now — ask again*,
 * under the message that was turned away, to everybody who can see the
 * refusal it corrects.
 */
export interface GateGrantProps {
  canvasId: string;
  viewer: Actor;
  thread: CommentThread;
  comment: Comment;
}

export function GateGrant({ canvasId, viewer, thread, comment }: GateGrantProps) {
  const policies = useRcPolicies(canvasId);
  const joined = useCanvasStore((s) => s.actorJoins);
  const agents = useCanvasStore((s) => s.canvas?.agents);
  const names = useActorNames();
  /**
   * **What the poll has not caught up with yet.** The announced policy is
   * re-read every ten seconds, and a button that goes on offering a grant
   * already given reads as a click that did nothing. The op is already sent
   * and already echoed; this only stops the row lying about it in between.
   */
  const [justGranted, setJustGranted] = useState<Record<string, string | null>>({});
  const [span, setSpan] = useState("never");

  const mentions = [...new Set(comment.mentions ?? [])].filter((id) => policies[id]);
  if (mentions.length === 0) return null;
  const nameOf = (id: string) => actorNameIn(names, { id, name: id });
  const asker = comment.author;
  // The system voice is nobody's ask: it reports a refusal, it does not make
  // one, and a grant offered against it would name isocan as the asker.
  if (isSystemActor(asker.id)) return null;

  const rows = mentions.flatMap((actorId) => {
    const policy = policies[actorId]!;
    const agentName = agents?.[actorId]?.actor.name ?? nameOf(actorId);
    const admits = mayWake(policy, asker.id, joined);
    const owns = sameActor(joined, policy.owner.id, viewer.id);
    const just = justGranted[actorId];
    if (admits || just !== undefined) {
      /* Said only where a refusal stands to be corrected. Everywhere else
         "Lamb listens to you" is an announcement nobody asked for, under a
         message that went through. */
      const refused = thread.comments.some(
        (c) => isSystemActor(c.author.id) && readsAsTurnedAway(c.body, agentName),
      );
      if (!refused && just === undefined) return [];
      const who = sameActor(joined, asker.id, viewer.id) ? "you" : actorNameIn(names, asker);
      const how = just ? `, ${untilWords(just)}` : "";
      return [
        <p className="gate-granted" key={actorId}>
          {agentName} listens to {who} now{how} — {who === "you" ? "ask again" : "they can ask again"}.
        </p>,
      ];
    }
    if (!owns) return [];
    const grant = (to: string) => {
      const record = agents?.[actorId];
      if (!record) return;
      const until = to === LISTEN_ANYONE ? null : listenUntil(span);
      setJustGranted((was) => ({ ...was, [actorId]: until }));
      void sendEchoed(canvasId, viewer, {
        type: "agent.enroll",
        agent: record.actor,
        rules: {
          ...rulesOf(record.rules),
          listen: withListener(policy, to, true, { joined, until }),
        },
      });
    };
    return [
      <p className="gate-grant" key={actorId}>
        <button onClick={() => grant(asker.id)} title={`${agentName} will answer ${actorNameIn(names, asker)} — its turns spend your tokens on your machine`}>
          Let {actorNameIn(names, asker)} ask
        </button>
        <button onClick={() => grant(LISTEN_ANYONE)} title={`${agentName} will answer anyone admitted to this canvas — its turns spend your tokens on your machine`}>
          Let anyone ask
        </button>
        {/* How long, beside the yes rather than behind it: an expiry chosen
            after the grant is a second gesture nobody makes. "Anyone" takes
            no expiry — opening an agent to a room is a standing decision,
            and a room that quietly closes again at midnight is the silent
            gate this whole feature exists to refuse. */}
        <select
          value={span}
          aria-label="How long the grant lasts"
          onChange={(e) => setSpan(e.target.value)}
        >
          <option value="never">no expiry</option>
          <option value="tonight">until tonight</option>
          <option value="7d">for 7 days</option>
        </select>
      </p>,
    ];
  });

  return rows.length > 0 ? <div className="gate-under">{rows}</div> : null;
}
