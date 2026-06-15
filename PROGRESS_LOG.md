# Progress Log

## [2026-06-16] flows v0.7.1 agent infra (#115)

- Pinned `vendor/flows` at `bc16808` (`v0.7.1`).
- Ran `vendor/flows/install.sh --phase ua0 --layout legacy-api-backend --frontend-dir electricity-prices-build --project-name nordpool` (collision-safe: preserved `.cursor/rules/terminal.mdc`).
- Installed `.cursor/rules/` (7 flows rules + product `quality-gates.mdc`), `.cursor/skills/flows-coordinator/SKILL.md`, `.github/ISSUE_TEMPLATE/debt.yml`.
- Merged NordPool domain content into `AGENTS.md`; added `STRATEGY.md` and this log.
- Deferred: `--force-cursor-rules` overwrite of `terminal.mdc` (PO not requested); full `install.sh` ua2+ phases.

## [2025] UA0 foundation (flows v0.6.x)

- Initial revamp hygiene, scope gate, issue templates — see [PR #25](https://github.com/alicemq/lt-electricity-full-price-nordpool/pull/25).

## Template entry format

```markdown
## [YYYY-MM-DD] Short title (#issue, PR #N)

- Bullet outcomes
- Verification command or endpoint
```

Keep entries brief. Link GitHub issues and PRs.
