---
title: Secrets never in git
tags: [security, hygiene, deploy, agents]
date: 2026-06-14
source: flows
---

# Secrets never in git

## Rule

Secrets MUST NOT appear in source control, build artifacts, or agent-readable history folders. Only `*.env.example` files with placeholders belong in git.

## Checklist

1. `.gitignore` covers `.env`, `.env.*`, `deploy/local.env`, `deploy/local.override.env`, `.history/`
2. `git ls-files` shows no secret files (see [gitignore-untrack-incomplete](gitignore-untrack-incomplete.md))
3. Rotate any credential that was ever committed, even after removal
4. CI and deploy use platform secrets (GitHub Actions secrets, Coolify env), not committed YAML
5. `bin/validate-deploy-env.js` rejects weak production values (`change-me`, `__GENERATE__`)

## Docker

Prefer Docker Compose `secrets:` over inline env for production databases and admin keys when the platform supports it. Env vars are acceptable for small VPS deploys if files are gitignored and permissions restricted (`chmod 600`).

## Agent safety

Agents MUST NOT paste live keys into PRs, issues, or PROGRESS_LOG. Reference secret *names* only.

## Related

- [Untrack secrets before UA0](untrack-secrets-before-ua0.md) (incident playbook)
- [Env single source](env-single-source.md)
- [ua-security checklist](../../agent-handbook/checklists/ua-security.md)
