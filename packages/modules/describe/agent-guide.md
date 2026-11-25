## Describe items

Generate a caption-first `agentDescription` property on an image, video,
document, or screen so agents that cannot view pixels can reason about it and
cite it accurately.

- `isocan describe <item> [--json]` — call the home's utility Gemini model to
  describe `<item>` and store `properties.agentDescription` (and
  `properties.credentialRef`) via `item.update`.
- `isocan describe item <item> [--json]` — explicit subcommand form of the same
  act.

MCP agents receive the same verb as `describe_item` (`{ item }`). Descriptions
appear in canvas context whenever at least one item carries `agentDescription`.
