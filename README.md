# Shapecheck

A local workbench for checking JSON response fixtures against a JSON Schema draft-07 contract. Built by **Bakhtiyar Zikirin ([MOYISEY](https://github.com/MOYISEY))**.

**[Open the demo](https://MOYISEY.github.io/shapecheck/)** · [QA evidence](docs/QA.md) · [Security review](docs/SECURITY-REVIEW.md)

Paste a schema, edit response fixtures, and get exact JSON Pointer paths for contract errors. Keep positive and negative examples together, recheck the entire set after edits, and export a portable regression suite. The included Orders example is synthetic; the app never sends API requests.

## Use it

1. Edit the **JSON Schema** and **JSON response** panels. All fixtures are checked after a 500 ms pause. `Ctrl/⌘ + Enter` checks again.
2. Add, rename, duplicate or delete fixtures. Choose whether each response is expected to be **valid** or **invalid**. A negative fixture matches only a contract violation, never a syntax, policy or timeout error.
3. Select a fixture to inspect errors. Each error shows its response pointer and schema rule; **Jump to field** focuses the corresponding token. Missing fields select their parent object.
4. **Save JSON** downloads an editable project. **Import JSON** validates the whole file before asking to replace the current workspace. Malformed imports leave it intact.
5. **Export tests** downloads a ZIP with the project, bundled validator, runnable Node tests, README and third-party licenses. Extract it and run `node --test test.mjs` with Node 22+. No npm installation is needed.

English and Russian cover the interface, errors and help. Light/dark themes, responsive stacked editors, keyboard shortcuts and native modal focus handling are included. User-authored project names and JSON content keep their original language.

## Local data

No backend, analytics, telemetry, HTTP client, remote refs, external fonts or runtime CDN dependencies. Schema and response values stay in the browser tab. **Remember on this device** is off by default; enabling it stores the complete project under `shapecheck.workspace.v1` in localStorage. Turning it off removes that saved copy. Clearing the current and saved workspace requires confirmation and touches only this key. Downloads contain the data you explicitly export. Avoid putting secrets into fixtures you intend to share.

## Supported contract and boundaries

- JSON Schema **draft-07**, using AJV **8.20.0**. `$schema` can be omitted or must be exactly `http://json-schema.org/draft-07/schema#`. An explicit keyword allowlist also checks unused definitions and referenced targets.
- Boolean schemas, object/array/string/number constraints, required/extra fields, enum/const, composition, conditionals and acyclic local JSON Pointer `$ref` beginning with `#/`.
- Unknown keywords, other dialects, OpenAPI extensions, `$defs`, `nullable`, network refs, recursive refs, `$id`, `$async`, `$data`, `pattern`, `patternProperties` and `format` are rejected. Regex and format constraints are deliberately excluded because they can introduce uncontrolled regex work.
- Annotation keywords (title, description, default, examples, readOnly/writeOnly, contentEncoding/contentMediaType) are retained as metadata; they do not assert content encoding or media validity. Defaults are never inserted. No type coercion, property removal or payload mutation.
- 64 KiB schema, 256 KiB per payload, 1 MiB serialized project, 20 fixtures; at least one fixture. Data: maximum 32 levels and 20,000 nodes. Schema: 16 levels and 2,000 nodes; reference traversal budget 8,000 visits.
- At most 100 contract errors per fixture. The whole validation batch has a **2-second deadline** after the worker is ready. Worker asset loading has a separate 10-second deadline. Cancel, timeout, edits and completion terminate the worker; late messages cannot replace current results.
- `__proto__`, `constructor` and `prototype` keys are rejected in inputs and imports, even if a legitimate API happens to use one of those names. Non-finite parsed numbers are rejected.

The worker isolates expensive parsing/compilation/validation from the UI and can be terminated. It is a CPU containment boundary, not a guarantee that arbitrary adversarial input cannot consume memory. AJV internally compiles schema rules using generated functions in the worker; the app never accepts or evaluates user JavaScript. Parser and compilation exceptions are replaced with safe messages without raw input excerpts. React escapes displayed values. A static CSP restricts the document; worker network policy is enforced by the schema guard and absence of loaders, rather than assuming the document CSP is inherited.

Sources: [AJV security model](https://ajv.js.org/security.html), [AJV schema dialects](https://ajv.js.org/json-schema.html), [JSON Schema draft-07](https://json-schema.org/draft-07), [Vite relative base](https://vite.dev/config/shared-options#base).

## Develop and verify

```sh
npm ci
npm run dev

npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

Node 22.12+ is required by the build toolchain (Node 24 was used for QA). Exact dependency versions and `package-lock.json` are committed. `build` bundles the same TypeScript validator and safety policy for the downloadable Node suite, checks TypeScript, then builds the app with `base: './'` for GitHub Pages. Tests use a strict dedicated preview port **4184**, so another project cannot accidentally satisfy the web-server readiness check.

Core modules are in `src/core`; the worker entry is `src/validation.worker.ts`. `App.tsx` manages the local workspace, fixture expectations, error navigation, explicit persistence and import confirmations. `scripts/bundle-export.mjs` creates the bundled Node worker and license file consumed by the ZIP exporter. There is no production server.

The E2E suite downloads an actual export, extracts it, executes Node tests, then introduces a real regression and verifies a non-zero exit. Unit tests cover input boundaries, dialect policy, percent-decoded refs, paths, unsafe keys and worker cancellation/timeout. Live deployment is tested using the same browser scenarios.

## Publishing

Source is on `main`; the built static app is on `gh-pages`. GitHub Pages serves `gh-pages` at the repository root. Release metadata (`release.json`) records the source commit. Rebuild and deploy only after QA passes; do not edit other portfolio projects. The profile README and portfolio integration are outside this repository's scope.

MIT licensed. See [LICENSE](LICENSE).
