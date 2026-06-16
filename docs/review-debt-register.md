# Review debt register

Index of known tech debt, bugs, and follow-ups. Link GitHub issues; do not duplicate long prose here.

| ID | Issue | Priority | Area | Status |
| --- | --- | --- | --- | --- |
| UA3 | [#101](https://github.com/alicemq/lt-electricity-full-price-nordpool/issues/101) OpenAPI contract hygiene, Spectral, `/docs` UX | P1 | API / docs | Closed (public-path samples, PR gate docs) |
| UA3 | [#136](https://github.com/alicemq/lt-electricity-full-price-nordpool/issues/136) Live API contract samples in CI | P1 | CI / contract | Closed |
| UA1 | [#117](https://github.com/alicemq/lt-electricity-full-price-nordpool/issues/117) Env single source (`load-env.sh`, `compose.sh`) | P2 | DevOps | Closed via #138 + env SSOT PR |
| UA6 | [#118](https://github.com/alicemq/lt-electricity-full-price-nordpool/issues/118) Post-deploy smoke + bulletproof scripts | P2 | CI / ops | Closed via #138 |
| UA10 | [#119](https://github.com/alicemq/lt-electricity-full-price-nordpool/issues/119) Debt register, UA checklists, adoption log | P2 | Docs | In progress |

## Blockers (PO decisions)

See [PROJECT-GOVERNANCE.md](PROJECT-GOVERNANCE.md) section 5: sync admin API (#101 drift), worker architecture (UA5), secrets rotation (#34 operator).

## Recently closed (context)

| Issue | Outcome |
| --- | --- |
| [#115](https://github.com/alicemq/lt-electricity-full-price-nordpool/issues/115) | flows v0.7.1 agent infra merged (#126) |
| [#116](https://github.com/alicemq/lt-electricity-full-price-nordpool/issues/116) | `GET /ready` Postgres + 24h freshness (#133) |
| [#122](https://github.com/alicemq/lt-electricity-full-price-nordpool/issues/122) | Spectral `spectral:oas` enabled (#128) |
| [#139](https://github.com/alicemq/lt-electricity-full-price-nordpool/issues/139) | Upcoming current MTU slot (#140–#143) |

## How to use

1. File a GitHub issue with user story + dev story (`source:ai`, `type:*`).
2. Add a row here with link and priority label.
3. Remove or mark Done when issue closes.

Last updated: 2026-06-16
