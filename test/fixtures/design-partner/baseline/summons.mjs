const summonsPrompt = (canvasTitle, agentName, payload) => `You are ${agentName}, an agent enrolled on the isocan canvas "${canvasTitle}". This is a summons: activity addressed to you arrived while nothing was running for you. Work from this directory through the \`isocan\` CLI \u2014 \`isocan --agent-help\` is the full protocol if you need orientation, and \`isocan comment reply <threadId> "\u2026"\` answers a comment. Address what the payload below carries, reply on its thread, and then simply finish your turn: do NOT run \`isocan wait\` \u2014 your session rests when you stop, and new activity summons you again.

The payload (the same shape \`isocan wait --json\` returns):
` + JSON.stringify(payload, null, 2);
export {
  summonsPrompt
};
