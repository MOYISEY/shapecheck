import { LIMITS, type Issue, type Project } from './types';
import { syntaxLocation } from './syntax';
export class InputError extends Error {
  constructor(public issue: Issue, public kind: 'syntax' | 'policy' = 'policy') { super(issue.code); }
}
export const bytes = (value: string) => new TextEncoder().encode(value).length;
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const draft07 = new Set(['$schema','$comment','$ref','title','description','default','examples','readOnly','writeOnly','contentEncoding','contentMediaType','type','enum','const','multipleOf','maximum','exclusiveMaximum','minimum','exclusiveMinimum','maxLength','minLength','items','additionalItems','maxItems','minItems','uniqueItems','contains','maxProperties','minProperties','required','properties','additionalProperties','definitions','dependencies','propertyNames','allOf','anyOf','oneOf','not','if','then','else']);
const fail = (code: string, path = '/'): never => { throw new InputError({ code, path }); };
export function inspectTree(value: unknown, maxDepth: number = LIMITS.depth, maxNodes: number = LIMITS.nodes) {
  const stack = [{ value, depth: 0, path: '' }]; let count = 0;
  while (stack.length) {
    const item = stack.pop()!;
    if (++count > maxNodes) fail('nodes');
    if (item.depth > maxDepth) fail('depth', item.path || '/');
    if (item.value && typeof item.value === 'object') {
      for (const [key, child] of Object.entries(item.value)) {
        const path = item.path + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1');
        if (forbidden.has(key)) fail('unsafeKey', path);
        stack.push({ value: child, depth: item.depth + 1, path });
      }
    } else if (typeof item.value === 'number' && !Number.isFinite(item.value)) fail('finite', item.path || '/');
  }
}
export function parseJson(text: string, maxBytes: number): unknown {
  if (bytes(text) > maxBytes) fail('size');
  let value: unknown;
  try { value = JSON.parse(text); }
  catch (error) {
    const message = error instanceof Error ? error.message : '';
    // Never echo the parser message: it can include a secret from the input.
    const position = /position (\d+)/.exec(message);
    const lineColumn = /line (\d+) column (\d+)/.exec(message);
    let line = lineColumn ? Number(lineColumn[1]) : undefined;
    let column = lineColumn ? Number(lineColumn[2]) : undefined;
    if (position) { const prefix = text.slice(0, Number(position[1])); const lines = prefix.split('\n'); line = lines.length; column = lines.at(-1)!.length + 1; }
    if (!line) {const location=syntaxLocation(text);line=location.line;column=location.column;}
    throw new InputError({ code: 'jsonSyntax', path: '/', line, column }, 'syntax');
  }
  inspectTree(value); return value;
}
export function guardSchema(schema: unknown) {
  inspectTree(schema, LIMITS.schemaDepth, LIMITS.schemaNodes);
  if (typeof schema === 'boolean') return;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) fail('schemaObject');
  const root = schema as Record<string, unknown>;
  if (root.$schema !== undefined && root.$schema !== 'http://json-schema.org/draft-07/schema#') fail('dialect');
  const active = new Set<unknown>(); let visits = 0;
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== 'object') return;
    if (++visits > LIMITS.schemaNodes * 4) fail('complexity', path);
    if (active.has(node)) fail('recursiveRef', path);
    active.add(node);
    const object = node as Record<string, unknown>;
    if (object.$schema !== undefined && object.$schema !== 'http://json-schema.org/draft-07/schema#') fail('dialect',path + '/$schema');
    for (const keyword of ['pattern', 'patternProperties', 'format', '$id', '$async', '$data']) {
      if (Object.hasOwn(object, keyword)) fail('blockedKeyword', path + '/' + keyword);
    }
    for (const keyword of Object.keys(object)) if (!draft07.has(keyword)) fail('unknownKeyword',path + '/' + keyword);
    if (Object.hasOwn(object, '$ref')) {
      const reference = object.$ref;
      if (typeof reference !== 'string' || !reference.startsWith('#/')) return fail('localRef', path + '/$ref');
      let segments: string[];
      try { segments = reference.slice(2).split('/').map(part => decodeURIComponent(part).replace(/~1/g, '/').replace(/~0/g, '~')); }
      catch { return fail('missingRef',path + '/$ref'); }
      let target: unknown = schema;
      for (const segment of segments) {
        if (forbidden.has(segment) || !target || typeof target !== 'object' || !Object.hasOwn(target, segment)) fail('missingRef', path + '/$ref');
        target = (target as Record<string, unknown>)[segment];
      }
      walk(target, reference);
    }
    // Traverse only schema-bearing keywords. Names in properties and data in const/enum are not keywords.
    for (const keyword of ['properties','definitions','patternProperties','dependencies']) {
      const map = object[keyword];
      if (map && typeof map === 'object' && !Array.isArray(map)) for (const [key, child] of Object.entries(map)) if (!Array.isArray(child)) walk(child, path + '/' + keyword + '/' + key);
    }
    for (const keyword of ['items','additionalItems','additionalProperties','contains','propertyNames','not','if','then','else']) {
      const child = object[keyword];
      if (Array.isArray(child)) child.forEach((item,i) => walk(item, path + '/' + keyword + '/' + i)); else walk(child, path + '/' + keyword);
    }
    for (const keyword of ['allOf','anyOf','oneOf']) if (Array.isArray(object[keyword])) (object[keyword] as unknown[]).forEach((item,i) => walk(item, path + '/' + keyword + '/' + i));
    active.delete(node);
  };
  walk(schema, '#');
}
export function validateProject(value: unknown): Project {
  inspectTree(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('project');
  const p = value as Record<string, unknown>;
  if (p.version !== 1 || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80 || typeof p.schema !== 'string' || !Array.isArray(p.fixtures) || !p.fixtures.length || p.fixtures.length > LIMITS.fixtures) fail('project');
  if (Object.keys(p).some(key => !['version','name','schema','fixtures'].includes(key))) fail('project');
  if (bytes(p.schema as string) > LIMITS.schemaBytes) fail('size');
  const seen = new Set<string>();
  const fixtures = (p.fixtures as unknown[]).map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('project');
    const f = value as Record<string, unknown>;
    if (Object.keys(f).some(key => !['id','name','payload','expected'].includes(key)) || typeof f.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(f.id) || seen.has(f.id) || typeof f.name !== 'string' || !f.name.trim() || f.name.length > 80 || typeof f.payload !== 'string' || bytes(f.payload) > LIMITS.payloadBytes || typeof f.expected !== 'string' || !['valid','invalid'].includes(f.expected)) fail('project');
    seen.add(f.id as string);
    return { id: f.id as string, name: f.name as string, payload: f.payload as string, expected: f.expected as 'valid' | 'invalid' };
  });
  const project: Project = { version: 1, name: p.name as string, schema: p.schema as string, fixtures };
  if (bytes(JSON.stringify(project)) > LIMITS.projectBytes) fail('size');
  return project;
}
export function importProject(text: string): Project { return validateProject(parseJson(text, LIMITS.projectBytes)); }
