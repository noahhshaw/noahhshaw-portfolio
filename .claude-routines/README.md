# Claude Routines

Specs for Claude routines (Pro/Max subscription, runs on Anthropic infrastructure on a cron schedule).

## Routines defined here

- `baby-morning.md` — daily 7am PT render & send for the baby agent
- `baby-kb-research.md` — hourly check for queued KB update requests; opens GitHub PRs

## How to register

1. Open Claude Code
2. Run the `/schedule` command (or use the Routines UI at `claude.ai/code/routines`)
3. Paste the routine prompt from the relevant `.md` file
4. Set the schedule (cron expression in UTC)
5. Connect required MCP servers (Resend, GitHub) per the routine spec
6. Save

Each spec file documents the schedule, required MCP connectors, environment variables, and the prompt body verbatim.
