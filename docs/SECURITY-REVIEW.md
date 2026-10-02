# Independent security review

Reviewed 2026-10-02T09:34:41.519Z by the independent code/security reviewer.

**Result: no unresolved security blockers or review findings in the reviewed source snapshot.** 54 executed checks passed: 50 direct core/worker checks and 4 real exported Node test runs. Three additional UI transitions were inspected against the corrected source. Exact SHA-256 hashes and per-check results are in [qa/security-review.json](../qa/security-review.json).

## Scope and method

Reviewed `src/core/safety.ts`, `validate.ts`, `worker-client.ts`, `export.ts`, `src/App.tsx` and `index.html`. The reviewer did not edit product files. TypeScript source was transpiled in memory and tested with its installed AJV dependency, independently of the repository's Vitest tests. Export ZIP contents were extracted to a temporary directory and run with `node --test test.mjs` on v24.15.0.

The exported positive/negative suite exited successfully. A deliberate regression, a malformed negative fixture and malformed project JSON each exited with failure. Synthetic secret markers were absent from stdout and stderr.

## Findings resolved during review

| Finding | Resolution verified |
| --- | --- |
| Array-valued expected metadata was accepted through string conversion | Exact string validation; malformed imports rejected |
| AJV extensions and unreferenced unknown keywords could produce a pass | Explicit draft-07 allowlist in every schema-bearing node |
| Nested unsupported dialect could be ignored | Nested dialect check |
| Percent-encoded refs selected a different target in the guard and AJV | URI-fragment decoding matches AJV; encoded nullable, regex, remote and recursive targets rejected |
| Raw exported parser errors could reveal input | Generic errors; corrupted-file execution contains no synthetic secret |
| Duplicate/format operations could exceed UI byte limits | Add/duplicate total size guard; formatter uses bounded setters |
| Startup fallback removed corrupted saved data | Removal occurs only on explicit storage-off or confirmed clear |

## Confirmed boundaries

- Prototype-related keys are rejected and Object.prototype remained unchanged.
- Remote/file refs, other dialects, regex/format/async/data keywords and recursion are rejected. Valid local percent-encoded refs work. Data containing keyword-like property names stays data.
- No coercion, default insertion or additional-property removal. Syntax/policy failures cannot satisfy an expected invalid contract result.
- Payload/schema values do not appear in normalized errors. Product code has no console logging, fetch/XHR or raw HTML rendering. React renders imported names and error paths as text.
- Cancellation and timeout terminate the worker and ignore late completion; rerun succeeds. Size, depth, node, fixture and displayed-error bounds are checked.
- Only the Shapecheck storage key is accessed. Storage is opt-in and clearing the workspace requires confirmation.

## Limits of this review

This is source and execution evidence, not a penetration-test certificate or live-deployment review. Browser/E2E, accessibility, dependency audit and exact deployed commit verification are documented by the coordinator separately. Worker isolation and a deadline limit stalled work; they are not a hard memory sandbox. JSON Schema contentEncoding/contentMediaType are annotations, not decoding or media-validation features. Node 22 is the documented minimum; these independent export runs used v24.15.0.

The selected controls follow AJV's warning that untrusted schemas can cause expensive compilation and validation: [AJV security considerations](https://ajv.js.org/security.html). Draft-07 and AJV's additional dialect/keyword behavior were checked against [AJV JSON Schema documentation](https://ajv.js.org/json-schema.html).
