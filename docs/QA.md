# QA evidence

Verified on 2026-10-02 with Node 24.15.0, TypeScript 5.9.3, AJV 8.20.0 and Playwright Chromium 1.63.0.

| Check | Result |
| --- | --- |
| ESLint | Passed, zero warnings/errors |
| TypeScript | Passed inside production build |
| Vitest | 46 tests passed |
| Production build | Passed, relative base `./` |
| Browser E2E | 8 scenarios passed |
| Actual downloaded export | Node suite passed; deliberate regression failed |
| Corrupt exported project | Failed safely; synthetic secret absent from stdout/stderr |
| Independent code/security review | 54 core/export checks plus 16 focused lifecycle checks passed, no unresolved findings |
| Independent UX/a11y review | 16 settled UI audits, zero axe violations/page errors/document overflow |
| npm audit | 0 vulnerabilities, including development dependencies |

## Critical behavior exercised

- Positive and negative fixtures; JSON syntax separately from contract violations; no coercion/default insertion/property removal.
- Exact response pointers, escaped slash/tilde keys, repeated nested array property names, empty property names, root errors, missing-field navigation and schema-rule paths through local refs.
- Add/rename/duplicate/delete; expected-outcome mismatch and correction; recheck all; Ctrl+Enter; cancel/rerun and stale-worker messages; cold worker asset loading beyond 2 seconds while retaining a separate validation deadline.
- Invalid JSON/unknown structure/prototype keys/array-valued expectation/duplicate IDs/unknown keywords/different dialects/encoded reference bypass/recursive refs/regex/network refs.
- UTF-8 byte limits, project totals, duplicate near the 1 MiB bound, schema/payload depth/node bounds, non-finite numbers and 100-error display limit.
- Opt-in storage, reload persistence, clear cancellation/confirmation, preservation of unrelated localStorage and corrupted saved copies.
- Import replacement confirmation, hostile HTML-like names rendered as text, complete RU/EN controls/help, themes, desktop and 390/320 px mobile editors, 200% text, dialogs and focus restoration.
- Actual ZIP extraction and `node --test test.mjs`, without dependency installation. A genuine fixture regression and malformed inputs yield non-zero exit.

Independent reports: [Security review](SECURITY-REVIEW.md), [UX/a11y review](UX-REVIEW.md). Machine-readable source evidence: [security](../qa/security-review.json), [UX](../artifacts/ux-review/evidence.json). Reusable checks live in `src/core/core.test.ts`, `tests/workbench.spec.ts` and `tests/review/ux-review.mjs`.

The first E2E attempt accidentally reached another project's server on port 4173; it was discarded and no result from that run is counted. The suite now requires its own strict preview port 4184. A transient network issue interrupted dependency audit; the final successful audit is reported above. The initially detected fflate/esbuild advisories were resolved by upgrades to 0.8.3/0.28.2. The first Linux CI attempt hit npm registry ECONNRESET; a rerun reached a genuine case-sensitive third-party license filename error. The bundle script now discovers the exact filename, including require-from-string/license. Supplemental live cold-load verification revealed that downloading the worker had consumed the validation deadline; a ready handshake now separates the 10-second asset-loading bound from the 2-second validation deadline, with dedicated unit and E2E coverage.

## Deployment

Published and verified: [live QA](LIVE-QA.md), [release manifest](https://moyisey.github.io/shapecheck/release.json), [machine-readable evidence](../qa/live-evidence.json). Eight live browser scenarios passed; deployed source is 98f1b2272333d0ead79fd11a93e63026fb71fa8a, Pages commit is 0fff91bb3196e307f41e544ddb012ccd07301b7e. Linux CI and Pages deployment both succeeded. Chromium/Node 24 were executed; other browsers and the Node 22 minimum were not exhaustively tested.
