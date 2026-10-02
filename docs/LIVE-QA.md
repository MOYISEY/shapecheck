# Live deployment verification

Verified 2026-10-02 at **https://moyisey.github.io/shapecheck/**.

- Deployed application source: [`98f1b2272333d0ead79fd11a93e63026fb71fa8a`](https://github.com/MOYISEY/shapecheck/commit/98f1b2272333d0ead79fd11a93e63026fb71fa8a).
- GitHub Pages branch commit: [`0fff91bb3196e307f41e544ddb012ccd07301b7e`](https://github.com/MOYISEY/shapecheck/commit/0fff91bb3196e307f41e544ddb012ccd07301b7e).
- [Linux CI](https://github.com/MOYISEY/shapecheck/actions/runs/36992459015): successful `npm ci`, Chromium installation, lint, 46 unit tests, TypeScript/build, 8 browser scenarios and runtime dependency audit.
- [Pages deployment](https://github.com/MOYISEY/shapecheck/actions/runs/36992505458): successful; Pages source is `gh-pages` at `/`, HTTPS enforced.
- The public [release manifest](https://moyisey.github.io/shapecheck/release.json) reports the exact source commit above. Each HTML/JS/CSS/worker file was fetched from live and matched its recorded SHA-256. Static asset URLs use the relative base `./`.
- Eight production-browser E2E scenarios passed, including actual ZIP download/extraction/Node execution, intentional regression failure, malformed exported JSON without secret-marker output, fixture management, precise navigation, corrupt imports, opt-in storage, unrelated-storage preservation, RU controls, HTML-like names, cancellation/retry and delayed cold worker loading.
- Observed runtime requests were only same-origin GETs for HTML, bundled JS, CSS and the worker. No remote API, font, telemetry or CDN request occurred. No browser page errors. Desktop and RU dark mobile screenshots were inspected.

Machine-readable release/hash/request evidence: [qa/live-evidence.json](../qa/live-evidence.json). Visual evidence: [desktop](../artifacts/live/desktop.png), [mobile](../artifacts/live/mobile-ru-dark.png). Reproduce with `EXPECTED_SOURCE=98f1b2272333d0ead79fd11a93e63026fb71fa8a node tests/live-evidence.mjs`, and `LIVE_URL=https://moyisey.github.io/shapecheck/ npm run test:e2e` (set environment variables using your shell's syntax).

The first supplementary cold-load run identified a worker-loading/validation timer overlap; this was fixed and the deployed revision separates those deadlines. One subsequent cancellation test failed because its asynchronous network interceptor tried to continue an already-cancelled route, rather than because of a product assertion. The interceptor now supplies a deterministic stalled worker; the passing rerun is counted here. Browser expectation deadlines allow for the application's separate 10-second worker-loading bound; the product's validation deadline remains 2 seconds and is checked independently.

Later `main` commits contain QA evidence and test-harness refinements only. The deployed application remains exactly the recorded source commit. The profile README and external portfolio were not edited. Other browser engines, physical touch devices, full screen-reader testing and the documented Node 22 minimum were not exhaustively exercised; exported suites ran on Node 24 locally and in Linux CI.
