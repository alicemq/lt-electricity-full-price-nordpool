# UA security baseline checklist

Gate before exposing auth routes or production deploy. Complements [ua0-hygiene](ua0-hygiene.md) and [ua-deploy](ua-deploy.md).

## Authentication strategy

- [ ] Copy or render `SECURITY.md` from flows `templates/SECURITY.md.tpl`
- [ ] Document auth model in `AGENTS.md` and OpenAPI: API keys, session cookies, OAuth, or none
- [ ] Choose pattern using [api-key-vs-session-auth](../../docs/solutions/api-key-vs-session-auth.md)
- [ ] Public routes explicitly marked `security: []` in OpenAPI
- [ ] Admin/ops routes on separate prefix with shared secret or role check

## Login / register / logout (if applicable)

- [ ] Login, register, verify, OAuth callback routes rate-limited per IP
- [ ] Session cookies: `httpOnly`, `secure` in prod, `sameSite=lax` (or `strict`)
- [ ] `SESSION_SECRET` required in production; validated by `validate-deploy-env.js`
- [ ] Logout clears session cookie server-side
- [ ] No JWT or session tokens in `localStorage` or `sessionStorage`
- [ ] OAuth state parameter signed and verified (if using OAuth)

## API keys (if applicable)

- [ ] Keys stored hashed in database; raw key shown once at creation
- [ ] Revocation and optional expiry supported
- [ ] `API_KEYS_ENABLED=0` only in local dev
- [ ] OpenAPI documents `X-Api-Key` (or chosen header) under `securitySchemes`

## Authorization

- [ ] Middleware enforces auth before business logic on protected routes
- [ ] Admin routes separated from public `/v1` (different prefix or middleware stack)
- [ ] Tier or role checks documented; no hardcoded bypass in production

## Transport and headers

- [ ] TLS in production (reverse proxy or platform)
- [ ] Helmet or equivalent: CSP, HSTS (prod), `X-Frame-Options` / frameguard
- [ ] See [security-headers-baseline](../../docs/solutions/security-headers-baseline.md)
- [ ] CORS allowlist explicit; no `*` with credentials

## CSRF

- [ ] SameSite cookies for session auth
- [ ] CSRF token or double-submit for state-changing cookie auth from HTML forms (if applicable)
- [ ] API key auth for machine clients does not use cookies

## Secrets

- [ ] No secrets in git; see [secrets-never-in-git](../../docs/solutions/secrets-never-in-git.md)
- [ ] `deploy/env/*.env.example` only; prod secrets in platform store or Coolify
- [ ] Rotate any secret ever committed to history
- [ ] VAPID keys in deploy secrets only ([ua-push](ua-push.md))

## Rate limiting and abuse

- [ ] Global or per-route rate limits on public endpoints
- [ ] Stricter limits on auth and admin paths
- [ ] Push subscribe and cron endpoints require shared secret or auth

## Input validation

- [ ] Request body/query validated at route boundary (zod or manual checks; see `components/validation/`)
- [ ] Parameterized SQL only; no string concatenation for queries
- [ ] OpenAPI request schemas match runtime validation

## Dependency and CI security

- [ ] `.github/dependabot.yml` enabled (copy from flows templates)
- [ ] Default `ci.yml` gitleaks job enabled (set repo variable `CI_GITLEAKS_ENABLED=0` only with documented exception)
- [ ] Optional: `ci-security.example.yml` for scheduled npm audit
- [ ] GitHub secret scanning enabled on org/repo (Settings → Code security)
- [ ] Branch protection on `main`: required CI, no force push

## OWASP alignment (lite)

- [ ] A01 Broken access control: auth middleware on all protected routes
- [ ] A02 Cryptographic failures: bcrypt/argon2 for passwords; hashed API keys
- [ ] A03 Injection: parameterized queries
- [ ] A07 Identification and authentication failures: rate limits, secure cookies
- [ ] A05 Security misconfiguration: helmet, disable default creds, env validation

Full ASVS is out of scope for small teams; track gaps in product backlog.

## Verification commands

```bash
# No tracked secrets
git ls-files | grep -E '\.env$|\.history/' && echo FAIL || echo OK

# Helmet wired (adjust path)
grep -r applySecurityHeaders services/api/ || echo "WARN: no security headers"

# OpenAPI security schemes
grep -q securitySchemes services/api/openapi.yaml && echo OK || echo "WARN: no securitySchemes"

# Dependabot config
test -f .github/dependabot.yml && echo OK || echo "WARN: no dependabot.yml"
```

## Exit criteria

Auth model documented, secrets validated at deploy, protected routes fail closed without credentials, and security checklist items tracked in an issue or PR test plan.
