# UA0 hygiene checklist

Gate PR before product feature work. Agents MUST NOT start feature units until UA0 merges.

## Repo state

- [ ] `AGENTS.md` at repo root; `.cursorrc` points to it
- [ ] `.cursor/rules/` and `.cursor/skills/flows-coordinator/` installed via `install.sh` (or copied from flows cornerstone)
- [ ] `STRATEGY.md` skeleton filled with product name and problem statement
- [ ] `PROGRESS_LOG.md` exists with adoption entry
- [ ] Root `.gitignore`: `node_modules/`, `.env`, `dist/`, `.worktrees/`, local overrides
- [ ] `.gitattributes`: `*.sh text eol=lf`
- [ ] No tracked `node_modules/`, `.env`, or IDE history folders (`.history/`)
- [ ] Follow [gitignore-untrack-incomplete](../../docs/solutions/gitignore-untrack-incomplete.md): untrack before relying on `.gitignore` alone

## GitHub discipline

- [ ] Issue templates: feature + bug + debt with required user story and dev story
- [ ] `blank_issues_enabled: false` in issue template config
- [ ] Labels created: `type:feature`, `type:bug`, `type:debt`, `type:docs`, `type:security`, `source:human`, `source:ai`, `priority:p0` through `p2`
- [ ] First issue filed: UA0 hygiene itself

## Contract skeleton

- [ ] `services/api/openapi.yaml` (or equivalent) exists with `openapi: 3.x`
- [ ] Documented paths include at minimum: `/health`, `/ready`, and your primary API prefix
- [ ] Spectral lint runs locally or in CI (non-blocking OK for UA0, required by UA2)

## Agent workflow

- [ ] `docs/plans/agentic-workflow-plan.md` linked from `AGENTS.md`
- [ ] Scope gate documented: no issue, no work
- [ ] Three roles defined: AI Developer, AI QA, AI DevOps

## Verification commands

```bash
test -f AGENTS.md
test -f STRATEGY.md
test -f services/api/openapi.yaml   # adjust path if different
git ls-files | grep -E '\.env$|\.history/|node_modules/' && echo FAIL || echo OK
git status --porcelain | grep -E '\.env$|node_modules' && echo FAIL || echo OK
```

## Exit criteria

A new agent can clone the repo, read `AGENTS.md`, and know role boundaries without reading the full product plan. UA0 PR merges with cross-review APPROVE.
