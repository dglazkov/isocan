---
title: CLI lacks voice token generation command
loop:
  - 97076516-303c-4b82-963d-9ba3831dcdb3
loop_rank: P2
loop_state: ACTIVE
loop_goal: pg_v67IPPn4
decision: untriaged
---

# CLI lacks voice token generation command

> **Loop says** (P2): The web application requests single-use Gemini Live tokens from the server endpoint to support voice features. The server implements the route to mint these tokens from the server key. However, the command line interface does not offer any subcommand or option to request voice tokens. This gap prevents command line interface users and automated scripts from getting voice tokens.

- `packages/modules/talk/src/web.tsx#L722-L733`
- `packages/web/src/components/ChooseVoice.tsx#L1-L196`
- `packages/server/src/model-routes.ts#L183-L209`
- `packages/cli/src/main.ts#L556-L663`
- `packages/cli/src/keys.ts#L90-L241`

## Our read

Not yet checked against the code.
