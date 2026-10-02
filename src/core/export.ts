import { strToU8, zipSync } from 'fflate';
import workerSource from '../generated/validator.mjs?raw';
import { validateProject } from './safety';
import type { Project } from './types';
export const nodeTestSource = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';

// This fixture suite is local. No HTTP calls, installs, credentials or telemetry.
let text;
try { text = await readFile(new URL('./project.json', import.meta.url), 'utf8'); }
catch { throw new Error('Cannot read project.json'); }
assert.ok(Buffer.byteLength(text) <= 1048576, 'Project exceeds 1 MiB');
let project;
try { project = JSON.parse(text); }
catch { throw new Error('project.json is not valid JSON'); }
const batch = await new Promise((resolve, reject) => {
  const worker = new Worker(new URL('./validator.mjs', import.meta.url));
  const timer = setTimeout(() => { void worker.terminate(); reject(new Error('Validation exceeded 2 seconds')); }, 2000);
  worker.once('message', result => { clearTimeout(timer); void worker.terminate(); resolve(result); });
  worker.once('error', () => { clearTimeout(timer); void worker.terminate(); reject(new Error('Validation worker failed')); });
  worker.postMessage(project);
});
test('Schema and safety policy', () => { assert.equal(batch.schemaIssue, undefined, 'Schema is malformed, unsupported or outside safety limits'); });
if (!batch.schemaIssue) for (const fixture of project.fixtures) {
  test(fixture.name, () => {
    const result = batch.results.find(item => item.id === fixture.id);
    assert.equal(result?.status, fixture.expected, 'Fixture did not meet its expected contract outcome');
  });
}
`;
export const exportReadme = `# Shapecheck regression suite

Requires Node.js 22 or newer. No npm install is required.

Run: node --test test.mjs

project.json is the editable, portable Shapecheck workspace. Import it back into Shapecheck.
validator.mjs bundles the exact safety policy and AJV 8.20.0 used by the app.
test.mjs checks each fixture's expected VALID or INVALID outcome, without changing data.
A syntax, schema, policy or timeout failure always fails the suite, including negative fixtures.

Only JSON Schema draft-07 is supported. The dialect may be omitted, or must be
http://json-schema.org/draft-07/schema#. Local JSON Pointer references (#/...) only.
Regex patterns, patternProperties, formats, schema IDs, async/data keywords,
recursive refs and unsupported keywords are rejected. This is not OpenAPI support.
Limits: 64 KiB schema, 256 KiB per payload, 1 MiB project, 20 fixtures,
32 levels/20,000 nodes in data, 16 levels/2,000 nodes in schemas, 2 seconds per batch.
Keys __proto__, constructor and prototype are rejected. No coercion/default insertion.
At most 100 contract errors are displayed per fixture. All values remain local.

Unzip trusted exports to their own directory. Review downloaded scripts before running them.
AJV may internally compile generated validation code; no user JavaScript is evaluated.

Bundled software: AJV (MIT), fast-uri (BSD-3-Clause), fast-deep-equal (MIT),
json-schema-traverse (MIT), require-from-string (MIT). See LICENSES.txt.
`;
import licenseSource from '../generated/licenses.txt?raw';
export function exportSuite(project: Project) {
  validateProject(project);
  return zipSync({ 'project.json': strToU8(JSON.stringify(project, null, 2)), 'test.mjs': strToU8(nodeTestSource), 'validator.mjs': strToU8(workerSource), 'README.md': strToU8(exportReadme), 'LICENSES.txt': strToU8(licenseSource) });
}
export function download(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
