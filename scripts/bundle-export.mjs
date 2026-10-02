import { build } from 'esbuild';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('src/generated', { recursive: true });
await build({ entryPoints: ['scripts/node-worker.ts'], outfile: 'src/generated/validator.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node22', minify: true, legalComments: 'none' });
const licenses = [];
for (const name of ['ajv','fast-uri','fast-deep-equal','json-schema-traverse','require-from-string']) {
  const directory=`node_modules/${name}`;
  const filename=(await readdir(directory)).find(file=>/^licen[cs]e(?:\.md|\.txt)?$/i.test(file));
  if(!filename)throw new Error(`Missing third-party license for ${name}`);
  const license = await readFile(`${directory}/${filename}`, 'utf8');
  licenses.push(`${name}\n${license}`);
}
await writeFile('src/generated/licenses.txt', licenses.join('\n\n'));
