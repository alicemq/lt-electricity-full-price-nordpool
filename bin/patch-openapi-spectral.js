#!/usr/bin/env node
/**
 * Patch swagger-ui/openapi.yaml for spectral:oas (Fixes #122).
 * - Adds operationId to operations missing one
 * - Removes response examples with null (Spectral 6.15 crash)
 * - Tightens bare object array items that trigger Spectral runtime errors
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../backend/package.json', import.meta.url));
const yaml = require('js-yaml');

const OPENAPI_PATH = new URL('../swagger-ui/openapi.yaml', import.meta.url);

function toOperationId(path, method) {
  const segments = path
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/^\{|\}$/g, ''))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1));
  return `${method.toLowerCase()}${segments.join('')}`;
}

function stripNullExamples(node) {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (node.example && containsNull(node.example)) {
    delete node.example;
  }
  for (const value of Object.values(node)) {
    stripNullExamples(value);
  }
}

function containsNull(value) {
  if (value === null) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(containsNull);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some(containsNull);
  }
  return false;
}

function fixBareObjectItems(node) {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (node.type === 'array' && node.items?.type === 'object' && !node.items.properties && !node.items.additionalProperties) {
    node.items.additionalProperties = true;
  }
  for (const value of Object.values(node)) {
    fixBareObjectItems(value);
  }
}

const doc = yaml.load(fs.readFileSync(OPENAPI_PATH, 'utf8'));

for (const [path, methods] of Object.entries(doc.paths || {})) {
  for (const [method, operation] of Object.entries(methods)) {
    if (!operation || typeof operation !== 'object' || !operation.responses) {
      continue;
    }
    if (!operation.operationId) {
      operation.operationId = toOperationId(path, method);
    }
    if (method !== 'get' && method !== 'post' && method !== 'put' && method !== 'delete' && method !== 'patch') {
      continue;
    }
    if (!operation.description || String(operation.description).trim() === '') {
      operation.description = operation.summary || `${method.toUpperCase()} ${path}`;
    }
  }
}

stripNullExamples(doc);
fixBareObjectItems(doc);

if (doc.paths?.['/nps/price/{country}/current']?.get?.responses?.['200']?.content?.['application/json']?.example?.meta) {
  doc.paths['/nps/price/{country}/current'].get.responses['200'].content['application/json'].example.meta.data_type = 'current_hour';
}

if (doc.paths?.['/latest']?.get?.responses?.['200']?.content?.['application/json']?.example?.data?.[0]) {
  doc.paths['/latest'].get.responses['200'].content['application/json'].example.data[0].country = 'LT';
}

fs.writeFileSync(OPENAPI_PATH, yaml.dump(doc, { lineWidth: 120, noRefs: true, quotingType: "'" }));

console.log('Patched', OPENAPI_PATH.pathname || OPENAPI_PATH);
