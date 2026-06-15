# OpenAPI spec files

**Source of truth:** `openapi.yaml`. Edit YAML only.

**Derived copy:** `openapi.json` is generated from YAML. Regenerate after YAML changes:

```bash
npm ci --prefix backend
node bin/openapi-json-from-yaml.js --write
```

CI runs `node bin/openapi-json-from-yaml.js --check` and fails if JSON drifts.

## What production serves

Swagger UI loads **`/api/openapi.yaml`** (`SWAGGER_JSON_URL` in `docker-compose.yml` and Coolify compose). Both YAML and JSON are mounted under nginx (`electricity-prices-build/nginx.conf`); clients that request JSON get the derived file. Keep JSON in sync so direct `/api/openapi.json` requests match YAML.
