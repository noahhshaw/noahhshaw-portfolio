---
name: a11y-check
description: Run an axe-core accessibility audit against one or more URLs from the local dev server, focused on catching color-contrast issues (dark-on-dark text, low-contrast labels) but also surfacing other WCAG violations. Use whenever a UI change ships — especially anything that touches colors, backgrounds, text classes, or theme tokens. Args are space-separated paths or full URLs; defaults to "/sky" if omitted.
---

# a11y-check

Run an automated accessibility audit on the running Next.js app and report violations.

## When to use this

Invoke this skill:
- After any UI change that touches colors, text, backgrounds, borders, or Tailwind classes.
- Before declaring a UI task complete.
- When the user reports a contrast / readability problem.

Do **not** invoke for pure logic/refactor changes that don't affect rendered UI.

## How to run

The runner is `scripts/run.mjs` in this skill directory. It expects the dev server to already be running on `http://localhost:3000` (or whatever `BASE_URL` is set to).

```bash
# Default: audit /sky
node .claude/skills/a11y-check/scripts/run.mjs

# Audit specific paths or URLs
node .claude/skills/a11y-check/scripts/run.mjs /sky /projects /

# Audit with the panel open (some controls only render in interactive state)
node .claude/skills/a11y-check/scripts/run.mjs '/sky?lat=40.71&lon=-74&label=NYC' --click 'button[aria-expanded]'
```

Steps:
1. Confirm the dev server is up (`curl -sf http://localhost:3000 >/dev/null`). If not, start it with `npm run dev` in the background and wait ~5s for it to be ready.
2. Run the runner with the paths the user cares about.
3. Read the JSON report at `/tmp/a11y-report.json` if you need details beyond the printed summary.
4. If violations exist, fix them at the source and re-run. Don't suppress violations.

## Interpreting results

The runner prints one line per violation:
```
[serious] color-contrast (12 nodes) /sky
  .text-slate-500 on bg #020617 — ratio 4.21:1, needs 4.5:1
  selector: aside.absolute > div > section > div.text-xs
```

Severity levels you'll see: `minor`, `moderate`, `serious`, `critical`. Treat `serious` and `critical` as must-fix.

Common contrast fixes in this codebase:
- `text-slate-500` on `slate-950` → use `text-slate-400` (passes AA-large) or `text-slate-300` (passes AAA).
- `text-slate-600` anywhere on a dark bg → too dim, bump to `slate-400`.
- Placeholder text in inputs: add `placeholder:text-slate-400`.
- White text on a colored button (indigo-600, etc.) is fine; double-check disabled states.

## Adding a target URL permanently

If a route should always be audited, add it to the `DEFAULT_PATHS` array in `scripts/run.mjs`.

## Limitations

- Audits only the rendered initial state. Use `--click <selector>` to expand panels, or write a small follow-up script for multi-step flows.
- Canvas contents (the sky rendering) aren't auditable by axe — color choices inside `<canvas>` need manual verification with screenshots.
- The audit needs network access to load `axe-core` from `node_modules`; if not installed, the runner installs it as a devDep on first run.
