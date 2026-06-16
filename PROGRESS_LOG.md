# Progress Log

## [2026-06-16] E2E frontend-only mode (#152)

- `bin/run-e2e.sh`: `--frontend-only` / `--with-stack`, `--print-config`, `--help`.
- Documented L5 modes and 10/16 baseline in `docs/checklists/ua-testing.md`.
- CI: `tests/e2e/run-e2e-config.test.js` in `ci.yml`; `e2e.yml` uses `--with-stack`.

## [2026-06-16] UA3 live contract CI + UA10 debt register (#136, #119)

- Wired `tests/contract/live-api-samples.test.js` into `ci-integration.yml` with `CONTRACT_FIXTURE=1`.
- Recorded Swagger UI delivery decision: dedicated container, not Express embed (`docs/decisions/swagger-ui-delivery.md`).
- Populated `docs/review-debt-register.md`; added `docs/checklists/ua-testing.md`.
- Verified upcoming 03:45 slot at frozen 03:48: Vitest + Playwright E2E green on main.

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
