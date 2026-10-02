import Ajv, { type ErrorObject } from 'ajv';
import { guardSchema, InputError, parseJson, validateProject } from './safety';
import { LIMITS, type Batch, type Issue, type Project } from './types';
export function errorIssue(error: ErrorObject): Issue {
  const extra = error.keyword === 'required' ? error.params.missingProperty : error.keyword === 'additionalProperties' ? error.params.additionalProperty : undefined;
  const path = error.instancePath + (typeof extra === 'string' ? '/' + extra.replace(/~/g,'~0').replace(/\//g,'~1') : '');
  // Params describe constraints; do not attach data or raw AJV/parser exception messages.
  const params = Object.fromEntries(Object.entries(error.params).filter(([key]) => ['type','limit','missingProperty','additionalProperty','passingSchemas'].includes(key)));
  return { code: error.keyword, path, schemaPath: error.schemaPath, params };
}
export function validateBatch(project: Project): Batch {
  try { validateProject(project); } catch (error) { return { schemaStatus: 'policy', schemaIssue: error instanceof InputError ? error.issue : { code: 'project', path: '/' }, results: [] }; }
  let validate;
  try {
    const schema = parseJson(project.schema, LIMITS.schemaBytes); guardSchema(schema);
    const ajv = new Ajv({ allErrors: true, strictSchema: true, strictTypes: false, strictTuples: false, strictRequired: false, validateFormats: true, coerceTypes: false, useDefaults: false, removeAdditional: false, ownProperties: true, verbose: false, messages: false, logger: false, inlineRefs: true, loopRequired: 50, loopEnum: 50 });
    validate = ajv.compile(schema as object | boolean);
  } catch (error) {
    return { schemaStatus: error instanceof InputError ? error.kind : 'schema', schemaIssue: error instanceof InputError ? error.issue : { code: 'schemaCompile', path: '/' }, results: [] };
  }
  return { results: project.fixtures.map(fixture => {
    try {
      const payload = parseJson(fixture.payload, LIMITS.payloadBytes);
      const valid = validate(payload);
      return { id: fixture.id, status: valid ? 'valid' : 'invalid', issues: valid ? [] : (validate.errors ?? []).slice(0,LIMITS.issues).map(errorIssue) };
    } catch (error) { return { id: fixture.id, status: error instanceof InputError ? error.kind : 'policy', issues: [error instanceof InputError ? error.issue : { code: 'validation', path: '/' }] }; }
  }) };
}
