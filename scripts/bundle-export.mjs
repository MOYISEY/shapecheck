import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('src/generated', { recursive: true });
await build({ entryPoints: ['scripts/node-worker.ts'], outfile: 'src/generated/validator.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node22', minify: true, legalComments: 'none' });
const licenses = [];
for (const name of ['ajv','fast-uri','fast-deep-equal','json-schema-traverse','require-from-string']) {
  const license = await readFile(`node_modules/${name}/LICENSE`, 'utf8').catch(() => readFile(`node_modules/${name}/LICENSE.md`, 'utf8'));
  licenses.push(`${name}\n${license}`);
}
await writeFile('src/generated/licenses.txt', licenses.join('\n\n'));
