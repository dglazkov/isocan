# Context and addressable MCP sessions

Canvas-groups added `read_context` and `read_context_content` after embed's
original six-tool read surface. Those tools expose item manifests and frozen
request content. They must keep those meanings. Context stage 3 additionally
owes the layered summary shown by `isocan context`, and embed phase 2 owes a
way for a collaborating agent to have a name that replies can reach.

## Finish reading without changing existing requests

Add a distinct `read_context_summary` tool over the same core `contextLayers`
derivation the CLI and Context panel use. Put shared assembly in the API when
it needs daemon reads; do not copy the derivation into MCP. Include inherited
sources, exclusion/override/stale reasons, and only machine facts that the
calling process actually knows. Refused linked sources must be disclosed as
unavailable, never silently converted into an empty successful read.

Expose current canvas and context-summary JSON as MCP resources. Resource
listing follows the caller's discoverable canvases; resource reads use the
same admission checks as tools. Resources are a way to attach existing state,
not a new store or a bypass for reading another canvas. Saved request content
keeps its existing paged tool.

## An explicit session, never a process-global actor switch

The default remains the machine's ambient identity, as the CLI and API
already specify. A collaborating agent claims a session explicitly with a
stable caller-supplied session key and a name. Use the existing session-claim
mechanism under an MCP harness namespace; a missing claim must not fall back
to the person's identity.

Subsequent calls carry that session key. Do not change environment variables
or a shared active actor when a tool is called: one server may serve several
conversations, and simultaneous requests must not borrow each other's names.
Application-level `clientInfo` is not a conversation key.

The first write slice needs only the complete feedback loop: claim the agent,
create or edit an item, post/reply to a comment, and wait a bounded time for
feedback addressed to that agent. Use existing API operations, shared mention
resolution and the existing wait/inbox addressing rule. A read poll must not
mark unrelated work as seen. The wait returns a cursor and can be resumed;
cancellation and a quiet timeout must leave no background process running.

## Proof

A real MCP client on stdio must read both live layered context and a saved
request without changing the latter's shape. Resource reads must agree with
the tools and refuse an inaccessible canvas. Two session keys must claim two
names, create independently attributed items, and receive only the feedback
their own addressing rules select, even when calls overlap. Restarting the
MCP server must preserve the deliberate claim via the existing registry.

No MCP Apps or WebMCP implementation is part of this slice. Those transports
can reuse the proved vocabulary when their own phases are taken up.
