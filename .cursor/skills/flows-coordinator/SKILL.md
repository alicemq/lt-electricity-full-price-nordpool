---
name: flows-coordinator
description: >-
  Coordinate PO requests across parallel subagents in flows or product repos.
  Use when the PO lists multiple separate tasks, issues, or outcomes; when
  delegating work; or when synthesizing subagent results for the PO.
---

# Flows coordinator

Router for PO-driven multi-issue work. The coordinator plans and synthesizes; work subagents implement and verify; one ship subagent publishes.

## When to activate

- PO lists 2+ separate tasks ("fix X and add Y")
- PO gives a backlog slice with multiple issues
- Parallel exploration or implementation is possible

## Procedure

### 0. Scope gate

Before delegation, open or claim a GitHub issue for **each** PO-listed unit. PRs MUST reference issues (`Fixes #N` / `Refs #N`).

### 1. Decompose

Split the PO message into atomic issues. Each issue needs:

- One-sentence outcome
- Acceptance criteria (infer from PO or ask once if missing)
- Independence note (can run parallel with others?)
- API contract note (does this change OpenAPI/routes? if yes, mark for API-first serialization)

### 2. Delegate

For each issue, spawn **exactly one** work subagent with:

- The single issue scope (explicit out-of-scope list)
- Applicable quality gates from AGENTS.md
- Instruction to return: done (verification evidence, files changed) | blocked (with evidence)
- Instruction to verify locally only; MUST NOT commit, push, or open PR (coordinator spawns ship subagent later)

**MUST NOT** assign multiple PO-listed issues to one subagent.

### 3. Parallelize

Launch independent subagents concurrently. If file overlap is likely, either:

- Serialize conflicting issues, or
- Assign non-overlapping paths up front

When parallel subagents touch HTTP/OpenAPI, **serialize API-first**: one subagent owns routes + OpenAPI before dependents run.

### 4. Synthesize

Merge work subagent outputs for the PO:

```text
## Done
- <outcome 1> — verified by <command>; files: <paths>
- <outcome 2> — ...

## Blocked
- <issue> — <what is needed from PO or environment>

## Debt filed
- #<n> — <short title>
```

Use outcome language. Omit stack traces unless the PO asked for debugging detail.

### 5. Integration verification

Re-run applicable quality gates on the **combined merged tree** before ship:

- flows: `npm run test:components`, install dry-run, `bash -n` on touched `.sh`, boilerplate smoke as applicable
- product: `./bin/smoke-local.sh`, unit tests, golden harness as applicable

Combined subagent diffs MAY break integration even when each subagent passed alone.

### 6. Security review

When MUST triggers in AGENTS.md apply (auth, secrets, public endpoints, PII, payments, `type:security`), run `security-review` subagent (readonly) on the **combined diff** before spawning the ship subagent.

### 7. Ship gate

Apply partial-ship rules:

| Situation | Ship subagent |
| --- | --- |
| All PO-listed work subagents report done | MUST spawn |
| Any subagent blocked on PO decision, secrets, or irreversible choice for a PO-listed item | MUST NOT spawn |
| PO deferred optional item; blocked work filed as debt and removed from slice AC | MAY spawn for completed items |

When allowed, spawn **one** ship subagent (ce-commit-push-pr) to:

- Commit the combined slice diff
- Push to the branch
- Open or update a **single** PR with test plan and `Fixes #N` / `Refs #N`

**MUST NOT** spawn a ship subagent per work subagent. **MUST NOT** let work subagents commit, push, or open PRs. **MUST NOT** commit, push, or open PR directly when work subagents were spawned.

Include the PR URL in the final PO summary (or explicit skip reason on explicit PO skip signals).

### 7b. Cornerstone release gate (flows repo only)

After merge to `main` (or before closing the ship loop when PR merges in-session), the ship subagent or coordinator MUST check whether a semver release is warranted when the slice touched user-facing template or install paths (`agent-handbook/templates/**`, `install.sh`, `.cursor/rules/**`, `.cursor/skills/**`, checklists, or other paths adopters receive via `install.sh`).

**Rationale:** v0.7.0 shipped a day late because agent work merged to `main` without cutting a release; adopters pinned on v0.6.2 saw no new cursor rules until the tag landed.

1. Compare `main` to the latest tag: `git fetch --tags && git log $(git describe --tags --abbrev=0)..main --oneline`
2. If commits include adopter-visible template/install changes, follow [docs/release-policy.md](../../../docs/release-policy.md): update CHANGELOG, gap-register, roadmap, write `RELEASE-NOTES-vX.Y.Z.md`, tag, push tag.
3. Create the GitHub release: `gh release create vX.Y.Z --title "vX.Y.Z — …" --notes-file RELEASE-NOTES-vX.Y.Z.md`
4. If `main` is not ahead of the latest tag, or changes are internal-only (no adopter impact), skip release and note why in the PO summary.

Product repos: pin the new tag in `PROGRESS_LOG.md` per release policy; this gate applies only in the flows cornerstone repo.

### 8. CI watch

After push, ship subagent owns fix-ci / loop-on-ci until checks pass or blocked. Coordinator MAY own the loop if the ship subagent cannot continue.

### 9. Register debt

When a subagent finds work outside its single-issue scope:

1. File a GitHub issue per [AGENTS.md issue registration](../../../AGENTS.md#issue-registration) (`source:ai`, appropriate `type:*`).
2. Include **Found during:** the parent issue or PR.
3. List the new issue under **Debt filed** in synthesis; do not expand the subagent's scope.

Blocked on secrets: register debt issue with structured blocker **before** escalating PO once.

### 10. Continue

If the slice is incomplete and nothing blocks, pick the next issue without waiting for PO confirmation.

Agents MUST NOT ask the PO to confirm optional polish, housekeeping, or obvious follow-ups. Apply the polish decision tree in AGENTS.md: same files + within AC → implement; else → debt issue.

## Skill routing (coordinator)

| Need | Use |
| --- | --- |
| Multiple PO-listed issues | This skill + one work subagent per issue |
| GitHub issue/PR/merge ops | gh-cli skill |
| Security-sensitive merged diff (MUST triggers in AGENTS.md) | `security-review` subagent after synthesis, before ship |
| Ship after integration verify + security review | ce-commit-push-pr as **one** ship subagent (skip only on explicit PO skip signals) |
| PR CI failing after push | fix-ci / loop-on-ci — ship subagent owns |

Full matrix: [AGENTS.md — Skill and subagent routing](../../../AGENTS.md#skill-and-subagent-routing).

## Example

**PO:** "Fix login bug and add export button."

| Subagent | Scope | Out of scope |
| --- | --- | --- |
| A | Login bug | Export button |
| B | Export button | Login bug |

Coordinator: scope gate → launch A and B in parallel → synthesize → integration verify → security review if needed → spawn one ship subagent → CI watch.

## References

- [AGENTS.md](../../../AGENTS.md) — operating model, skill routing, issue registration, quality gates
- [AGENTS.md](../../../AGENTS.md) — installed product handbook
- [.cursor/rules/skill-routing.mdc](../../../.cursor/rules/skill-routing.mdc) — always-applied trigger matrix
