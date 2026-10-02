import { describe, expect, it, vi } from 'vitest';
import { sampleProject } from './sample';
import { validateBatch } from './validate';
import { guardSchema, importProject, inspectTree, parseJson } from './safety';
import { startValidation, type WorkerLike } from './worker-client';
import { LIMITS } from './types';
import { locatePointer } from './locate';
import { syntaxLocation } from './syntax';
const run = (schema: unknown, payload: string) => validateBatch({ ...sampleProject(),schema:JSON.stringify(schema),fixtures:[{id:'one',name:'One',payload,expected:'valid'}] });
describe('contract validation',() => {
  it('checks synthetic positive and negative fixtures with exact paths',() => { const batch = validateBatch(sampleProject()); expect(batch.results.map(r => r.status)).toEqual(['valid','invalid']); expect(batch.results[1].issues.map(i => i.path)).toEqual(['/id','/items/0/quantity']); expect(batch.results[1].issues[1].schemaPath).toBe('#/definitions/item/properties/quantity/minimum'); });
  it('does not coerce, insert defaults or remove properties',() => { const result = run({type:'object',properties:{id:{type:'integer',default:1}},additionalProperties:false},'{"id":"1","other":true}'); expect(result.results[0].issues.map(i => i.code)).toContain('type'); expect(result.results[0].issues.map(i => i.code)).toContain('additionalProperties'); });
  it('distinguishes payload syntax from contract errors and never echoes input',() => { const result = run({type:'object'},'{"token":"SECRET_SENTINEL",'); expect(result.results[0].status).toBe('syntax'); expect(JSON.stringify(result)).not.toContain('SECRET_SENTINEL'); });
  it('reports missing and extra field paths with pointer escaping',() => { const result = run({type:'object',required:['a/b'],additionalProperties:false},'{"x~y":1}'); expect(result.results[0].issues.map(i => i.path)).toEqual(['/a~1b','/x~0y']); });
  it.each(['null','[]','"string"','1','false'])('accepts root primitive %s under true schema',payload => expect(run(true,payload).results[0].status).toBe('valid'));
  it('rejects infinity created by JSON number overflow',() => expect(run(true,'1e400').results[0].status).toBe('policy'));
  it('caps reported errors',() => { const required = Array.from({length:130},(_,i) => 'field'+i); expect(run({type:'object',required},'{}').results[0].issues).toHaveLength(100); });
});
describe('schema policy',() => {
  it.each([{format:'email'},{pattern:'(a+)+$'},{patternProperties:{'^x':true}},{$ref:'https://example.com/schema'},{$ref:'#'},{$id:'file:///tmp'},{$async:true},{$data:'1/x'},{$schema:'https://json-schema.org/draft/2020-12/schema'},{unknownKeyword:true},{nullable:true},{$defs:{x:{pattern:'x'}}},{contentSchema:{type:'integer'}},{definitions:{unused:{typo:'string'}}}])('rejects unsupported schema %j',schema => expect(run(schema,'{}').schemaIssue).toBeDefined());
  it('allows ordinary property names that look like keywords',() => expect(run({type:'object',properties:{format:{type:'string'},pattern:{type:'integer'}}},'{"format":"plain","pattern":1}').results[0].status).toBe('valid'));
  it('rejects recursive and dangling refs',() => { expect(() => guardSchema({definitions:{loop:{$ref:'#/definitions/loop'}},$ref:'#/definitions/loop'})).toThrow(); expect(() => guardSchema({$ref:'#/definitions/missing'})).toThrow(); });
  it('accepts acyclic local refs',() => expect(run({definitions:{x:{type:'integer'}},type:'array',items:{$ref:'#/definitions/x'}},'[1,2]').results[0].status).toBe('valid'));
  it('checks the exact percent-decoded target AJV will use',() => {
    const schema={examples:[{'a%2Fb':{type:'string'},'a/b':{type:'string',nullable:true}}],$ref:'#/examples/0/a%2Fb'};
    expect(run(schema,'null').schemaIssue?.code).toBe('unknownKeyword');
    expect(run({$ref:'#/definitions/%ZZ',definitions:{x:true}},'null').schemaIssue?.code).toBe('missingRef');
  });
  it('rejects malformed constraint types without leaking schema values',() => { const result = run({type:'string',maxLength:'SECRET_SENTINEL'},'"ok"'); expect(result.schemaStatus).toBe('schema'); expect(JSON.stringify(result)).not.toContain('SECRET_SENTINEL'); });
});
describe('bounded imports',() => {
  it.each(['__proto__','constructor','prototype'])('rejects unsafe key %s',key => expect(() => parseJson(`{"${key}":{}}`,1000)).toThrow());
  it('preserves current data by validating the whole import before returning',() => { const p = sampleProject(); p.fixtures[1].id = p.fixtures[0].id; expect(() => importProject(JSON.stringify(p))).toThrow(); });
  it('rejects empty fixtures, unknown project fields and invalid expectations',() => { const p = sampleProject(); expect(() => importProject(JSON.stringify({...p,fixtures:[]}))).toThrow(); expect(() => importProject(JSON.stringify({...p,token:'secret'}))).toThrow(); expect(() => importProject(JSON.stringify({...p,fixtures:[{...p.fixtures[0],expected:'syntax'}]}))).toThrow(); });
  it('rejects count, byte and depth boundaries',() => { const p = sampleProject(); p.fixtures = Array.from({length:21},(_,i) => ({...p.fixtures[0],id:'f'+i})); expect(() => importProject(JSON.stringify(p))).toThrow(); expect(() => parseJson(' '.repeat(LIMITS.schemaBytes + 1),LIMITS.schemaBytes)).toThrow(); let v:unknown = 0; for(let i=0;i<34;i++) v=[v]; expect(() => inspectTree(v)).toThrow(); });
  it('counts UTF-8 bytes rather than characters',() => expect(() => parseJson('"'+'я'.repeat(50)+'"',100)).toThrow());
  it('rejects array-valued expected metadata',() => {const p=sampleProject();expect(() => importProject(JSON.stringify({...p,fixtures:[{...p.fixtures[0],expected:['valid']}]}))).toThrow();});
});
describe('exact field navigation',() => {
  it('locates syntax errors even when a browser parser omits its offset',()=>{expect(syntaxLocation('{\n "x":\n}')).toEqual({line:3,column:1});expect(syntaxLocation('{"x":1,}')).toEqual({line:1,column:8});});
  it('locates the intended array entry, including repeated keys',() => {const text='{"items":[{"quantity":1},{"quantity":0}]}';const [a,b]=locatePointer(text,'/items/1/quantity');expect(text.slice(a,b)).toBe('"quantity"');expect(a).toBe(text.lastIndexOf('"quantity"'));});
  it('handles escaped keys and missing properties',() => {const text='{"a/b":{"x~y":1}}';const [a,b]=locatePointer(text,'/a~1b/x~0y');expect(text.slice(a,b)).toBe('"x~y"');const [c,d]=locatePointer(text,'/a~1b/missing');expect(text.slice(c,d)).toBe('{"x~y":1}');});
  it('distinguishes the root from an empty property name',() => {const text='{"":1}';const [a,b]=locatePointer(text,'/');expect(text.slice(a,b)).toBe('""');expect(locatePointer(text,'')).toEqual([0,text.length]);});
});
describe('worker lifecycle',() => {
  function fake(): WorkerLike { return {postMessage:vi.fn(),terminate:vi.fn(),onmessage:null,onerror:null}; }
  it('terminates timeout and ignores late completion',() => { vi.useFakeTimers(); const w=fake(); const done=vi.fn(); startValidation(sampleProject(),done,() => w,10); vi.advanceTimersByTime(11); expect(w.terminate).toHaveBeenCalledOnce(); expect(done.mock.calls[0][0].results[0].status).toBe('timeout'); w.onmessage?.({data:{results:[]}} as MessageEvent); expect(done).toHaveBeenCalledOnce(); vi.useRealTimers(); });
  it('cancels without delivering stale results and permits rerun',() => { const w=fake(); const done=vi.fn(); const cancel=startValidation(sampleProject(),done,() => w); cancel(); w.onmessage?.({data:{results:[]}} as MessageEvent); expect(done).not.toHaveBeenCalled(); expect(w.terminate).toHaveBeenCalledOnce(); const w2=fake(); startValidation(sampleProject(),done,() => w2); w2.onmessage?.({data:{results:[]}} as MessageEvent); expect(done).toHaveBeenCalledOnce(); });
});
