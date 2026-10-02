# Independent UX and accessibility review

Reviewed on 2026-10-02 by a separate reviewer who did not edit product code. Verification used the production Vite preview on port 4185, Playwright Chromium, axe-core 4.11.1, and visual inspection of the generated screenshots.

Result: passed within the tested scope. The three findings below were fixed by the implementer, and the final production-build rerun passed the corresponding assertions. No unresolved UX or accessibility blockers were found in the reviewed scenarios.

## Scope and results

- Desktop 1440 × 1000, mobile 390 × 844, and mobile 320 × 740: both EN/RU and light/dark themes. Editors stack on mobile, fixtures scroll within their panel, and the document has no horizontal overflow.
- Sixteen audited states: the twelve viewport/language/theme combinations, desktop EN/RU help dialogs, a 320 px help dialog, and 200% text size on desktop. No axe violations for WCAG 2 A/AA and WCAG 2.1 AA tags in these states.
- Visual inspection confirmed readable error text, constraints, status labels, field paths, and both themes. Expected contract failure has an explicit “Rejected as expected” summary while the individual errors remain visible. Contract validity and expectation mismatches have distinct text.
- The first keyboard stop exposes a skip link which focuses the schema editor. Ctrl+Enter reruns validation. Help and confirmation dialogs open from the keyboard, keep underlying controls out of the tab order, close with Escape or cancellation, and restore focus to the initiating button. Confirmation initially focuses the nondestructive Close control.
- RU/EN switches update the document language and interface controls. New fixtures and duplicate suffixes use the selected language. JSON keywords and user/demo fixture data retain their own text.
- Help content scrolls within the 320 px dialog instead of extending beyond the viewport. At 200% text size, controls and results remain usable without horizontal document scrolling.
- No browser page errors occurred during the review.

## Findings and verification

Three concrete error-navigation findings were reported to the implementer:

1. The root JSON Pointer was conflated with the pointer to a property whose name is empty. The fix uses an empty pointer for the root, displays a localized Root label, and keeps `/` for the empty property. The reviewer checks that `/` selects exactly `""`, `/a~1b~0c` selects exactly `"a/b~c"`, and a root type error selects the whole `{}` value.
2. With non-inlined local references, AJV returned a schema path relative to the referenced schema. The displayed path looked like `#/properties/quantity/minimum`, which could not be found at the project root. The reviewer checks the corrected root path `#/definitions/item/properties/quantity/minimum` for the synthetic demo.
3. Current Chromium can omit a position from its JSON parser error. “Jump to field” then moved the caret to the beginning of malformed input. A bounded syntax-location fallback was added. The reviewer checks that `{\n "x":\n}` focuses the response editor and moves to the offending token rather than character zero.

The nested contract error `/items/0/quantity` selects the exact `"quantity"` key. A missing required property `/missing` selects its containing object, allowing the developer to add the absent field.

Theme color transitions produced transient contrast failures when the initial audit ran immediately after a switch. The final reviewer waits 250 ms for the 150 ms transitions to settle before auditing. The rendered themes themselves pass the checked contrast rules.

## Reproduce and evidence

```sh
npm run build
npm run preview -- --port 4185 --strictPort
# In another terminal:
node tests/review/ux-review.mjs
```

The reviewer can target another deployed URL via `REVIEW_URL`. It writes `artifacts/ux-review/evidence.json` and PNG screenshots for every audited state, with focused interaction assertions in `tests/review/ux-review.mjs`. The reviewer script passes ESLint.

This is a scoped browser review and automated accessibility check. It does not assert complete WCAG conformance or substitute for testing with screen-reader users, physical touch devices, or other browser engines.
