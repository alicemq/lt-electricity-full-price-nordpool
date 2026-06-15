#!/usr/bin/env node
/**
 * Verify swagger-ui/openapi.yaml paths match backend/src/v1.js router definitions.
 * Usage: node bin/validate-openapi-routes.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const require = createRequire(pathToFileURL(path.join(repoRoot, 'backend/package.json')));
const yaml = require('js-yaml');

const v1Path = path.join(repoRoot, 'backend/src/v1.js');
const yamlPath = path.join(repoRoot, 'swagger-ui/openapi.yaml');

function expressPathToOpenApi(routePath) {
  return routePath.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}');
}

function extractV1Routes(source, prefix = '') {
  const routes = new Map();
  const pattern = /router\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/g;
  let match = pattern.exec(source);
  while (match) {
    const method = match[1].toUpperCase();
    const openApiPath = prefix + expressPathToOpenApi(match[2]);
    const key = `${method} ${openApiPath}`;
    routes.set(key, { method, path: openApiPath });
    match = pattern.exec(source);
  }
  return routes;
}

function loadRouteMaps() {
  const routes = new Map();
  const routeFiles = [
    { file: 'backend/src/v1.js', prefix: '' },
    { file: 'backend/src/push/router.js', prefix: '/push' },
    { file: 'backend/src/push/adminRouter.js', prefix: '/admin/push' },
  ];

  for (const { file, prefix } of routeFiles) {
    const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    for (const [key, route] of extractV1Routes(source, prefix)) {
      routes.set(key, route);
    }
  }

  return routes;
}

function extractOpenApiPaths(doc) {
  const routes = new Map();
  for (const [routePath, item] of Object.entries(doc.paths || {})) {
    for (const [method, operation] of Object.entries(item)) {
      if (!['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method)) {
        continue;
      }
      const key = `${method.toUpperCase()} ${routePath}`;
      routes.set(key, { method: method.toUpperCase(), path: routePath, operation });
    }
  }
  return routes;
}

const openApiDoc = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
const v1Routes = loadRouteMaps();
const specRoutes = extractOpenApiPaths(openApiDoc);

const missingInSpec = [];
for (const [key, route] of v1Routes) {
  if (!specRoutes.has(key)) {
    missingInSpec.push(key);
  }
}

const extraInSpec = [];
for (const [key] of specRoutes) {
  if (!v1Routes.has(key)) {
    extraInSpec.push(key);
  }
}

let failed = false;

if (missingInSpec.length > 0) {
  failed = true;
  console.error('OpenAPI spec is missing v1.js routes:');
  for (const key of missingInSpec.sort()) {
    console.error(`  - ${key}`);
  }
}

if (extraInSpec.length > 0) {
  failed = true;
  console.error('OpenAPI spec documents routes not defined in v1.js:');
  for (const key of extraInSpec.sort()) {
    console.error(`  - ${key}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`OpenAPI paths match v1.js (${v1Routes.size} routes)`);
