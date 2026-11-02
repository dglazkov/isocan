import type { SlashCommand } from "@isocan/core";
import { COMPETITION_COMMAND_METADATA } from "./activation.ts";

/**
 * **`/design-competition`** — local on the web (it opens the picker), a skill
 * on the terminal: an agent reading it from the Chat lays the arena and starts
 * the bout with the verbs, and never picks the winner.
 */
export const COMPETITION_COMMAND: SlashCommand = {
  ...COMPETITION_COMMAND_METADATA,
  body: `Run a design competition on this canvas: famous designers' philosophies,
as agents, building rival designs of one brief, side by side — and the room
votes. You set it up; you never vote and never decide.

1. Read the roster: \`isocan competition fighters\`. Every fighter is an HOMAGE
   named for its principle — never refer to an agent as the person.
2. If the brief is missing or one word, ask ONE question in the thread and
   stop: what are we designing, and for whom.
3. Pick three fighters whose philosophies will disagree about THIS brief
   (a dense tool: Fast Is a Feature vs Less but Better vs Show the Data; a
   first-run screen: Road Signs vs Inevitable vs Build to Think), unless the
   person named them. Say why in one line.
4. \`isocan competition new "<brief>" --fighters a,b,c\` lays the arena (add
   \`--attach <item>\` when the message was about a screen, and
   \`--decider <person>\` naming who asked).
5. \`isocan competition start\` enrols one agent per fighter on the rc and
   hands each its brief in its lane. It refuses with a sentence when no rc is
   parked — say that sentence to the person; do not work around it.
6. Post ONE comment: the arena is laid, who is fighting and why, the clock,
   and that people rank 🥇🥈🥉 by *which best answers the brief*.

Never build an entry yourself, never rank one, never place a 🏆.`,
};
