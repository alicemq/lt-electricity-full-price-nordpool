import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { PUBLIC_GET_PATHS, PUBLIC_WRITE_PATHS } from './public-paths.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(pathToFileURL(path.join(repoRoot, 'backend/package.json')));
const yaml = require('js-yaml');

const openApiDoc = yaml.load(fs.readFileSync(path.join(repoRoot, 'swagger-ui/openapi.yaml'), 'utf8'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
  }
}

function operationBlock(pathItem, method) {
  const block = pathItem?.[method];
  assert.ok(block, `missing ${method.toUpperCase()} operation`);
  return block;
}

function successResponse(operation) {
  const codes = Object.keys(operation.responses || {}).filter((code) => /^[23]/.test(code));
  assert.ok(codes.length > 0, 'missing 2xx/3xx response');
  return codes.map((code) => operation.responses[code]);
}

function hasJsonResponse(operation, preferredStatus = '200') {
  const responses = successResponse(operation);
  const withSchema = responses.find((response) => response.content?.['application/json']?.schema);
  if (withSchema) {
    return withSchema;
  }
  const preferred = operation.responses?.[preferredStatus] || operation.responses?.['302'];
  if (preferred && !preferred.content?.['application/json']?.schema) {
    return null;
  }
  assert.fail(`missing application/json schema on success response (checked ${preferredStatus})`);
}

function schemaContainsMarker(schema, marker, seen = new Set()) {
  if (!schema || seen.has(schema)) {
    return false;
  }
  seen.add(schema);

  if (schema.properties && marker in schema.properties) {
    return true;
  }

  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    if (Array.isArray(schema[key])) {
      for (const item of schema[key]) {
        if (schemaContainsMarker(item, marker, seen)) {
          return true;
        }
      }
    }
  }

  if (schema.properties) {
    for (const prop of Object.values(schema.properties)) {
      if (schemaContainsMarker(prop, marker, seen)) {
        return true;
      }
    }
  }

  if (schema.items) {
    return schemaContainsMarker(schema.items, marker, seen);
  }

  return false;
}

function resolveRef(ref) {
  if (!ref?.startsWith('#/')) {
    return null;
  }
  return ref
    .slice(2)
    .split('/')
    .reduce((node, segment) => node?.[segment], openApiDoc);
}

function resolveSchema(schema, seen = new Set()) {
  if (!schema || seen.has(schema)) {
    return schema;
  }
  seen.add(schema);

  if (schema.$ref) {
    return resolveSchema(resolveRef(schema.$ref), seen);
  }

  const merged = { ...schema };
  if (Array.isArray(schema.allOf)) {
    merged.properties = {};
    for (const part of schema.allOf) {
      const resolved = resolveSchema(part, seen);
      Object.assign(merged.properties, resolved?.properties || {});
    }
  }

  return merged;
}

function assertSchemaMarkers(operation, markers, status = '200') {
  const response = operation.responses?.[status];
  const schema = resolveSchema(response?.content?.['application/json']?.schema);
  if (!schema) {
    return;
  }

  for (const marker of markers) {
    assert.ok(
      schemaContainsMarker(schema, marker),
      `response schema missing property "${marker}"`,
    );
  }
}

for (const { path: routePath, operationId, markers } of PUBLIC_GET_PATHS) {
  test(`OpenAPI GET ${routePath} (${operationId})`, () => {
    const pathItem = openApiDoc.paths?.[routePath];
    assert.ok(pathItem, `path ${routePath} not in spec`);
    const operation = operationBlock(pathItem, 'get');
    assert.equal(operation.operationId, operationId);
    successResponse(operation);
    if (routePath !== '/prices') {
      hasJsonResponse(operation);
    }
    if (markers?.length) {
      assertSchemaMarkers(operation, markers);
    }
  });
}

for (const { path: routePath, method, operationId } of PUBLIC_WRITE_PATHS) {
  test(`OpenAPI ${method.toUpperCase()} ${routePath} (${operationId})`, () => {
    const pathItem = openApiDoc.paths?.[routePath];
    assert.ok(pathItem, `path ${routePath} not in spec`);
    const operation = operationBlock(pathItem, method);
    assert.equal(operation.operationId, operationId);
    successResponse(operation);
  });
}

test('OpenAPI public GET paths have no AdminToken security', () => {
  for (const { path: routePath } of PUBLIC_GET_PATHS) {
    const operation = openApiDoc.paths?.[routePath]?.get;
    const security = operation?.security;
    if (Array.isArray(security)) {
      const usesAdmin = security.some((entry) => Object.hasOwn(entry, 'AdminToken'));
      assert.equal(usesAdmin, false, `${routePath} must not require AdminToken`);
    }
  }
});

console.log(`\nContract sample results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
